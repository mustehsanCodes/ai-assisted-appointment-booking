#!/usr/bin/env node
/**
 * Hard scenario coverage against the running API (USER + ADMIN).
 * Usage: node --env-file=apps/api/.env scripts/hard-test.mjs
 */
import { randomUUID } from "node:crypto";

const API = process.env.API_BASE ?? "http://localhost:4000/api";
const results = [];

function assert( cond, name, detail = "") {
  results.push({ ok: !!cond, name, detail: String(detail).slice(0, 240) });
  const mark = cond ? "PASS" : "FAIL";
  console.log(`${mark}  ${name}${detail ? ` — ${String(detail).slice(0, 160)}` : ""}`);
}

async function req(path, { method = "GET", body, cookie } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json, setCookie };
}

function sessionCookie(setCookie) {
  const raw = setCookie.find((c) => c.startsWith("session="));
  return raw ? raw.split(";")[0] : "";
}

function nextWeekdayIso(hour = 10, minute = 0) {
  // Build an Islamabad-local weekday slot as UTC ISO (PKT = UTC+5)
  const now = new Date();
  for (let i = 1; i <= 14; i++) {
    const local = new Date(now.getTime() + i * 86400000);
    // interpret as PKT calendar day roughly via +5 already in wall clock... use UTC noon probe
    const y = local.getUTCFullYear();
    const m = local.getUTCMonth();
    const d = local.getUTCDate();
    // candidate local PKT time -> UTC = local - 5h
    const start = new Date(Date.UTC(y, m, d, hour - 5, minute, 0));
    const pktDay = new Date(start.getTime() + 5 * 3600000).getUTCDay();
    if (pktDay !== 0 && pktDay !== 6 && start > now) return start.toISOString();
  }
  throw new Error("no weekday");
}

const summary = { pass: 0, fail: 0 };

async function run() {
  console.log(`\nHard testing → ${API}\n`);

  // Health
  {
    const h = await req("/health");
    assert(h.status === 200 && h.json.status === "ok", "Health liveness");
    const r = await req("/health/ready");
    assert(r.status === 200 && r.json.status === "ready", "Health readiness (DB)");
  }

  // USER auth
  let userCookie = "";
  {
    const login = await req("/auth/login", {
      method: "POST",
      body: { email: "demo@example.com", password: "DemoPassword123!" },
    });
    userCookie = sessionCookie(login.setCookie);
    assert(login.status === 200 && login.json.user?.role === "USER", "USER login", login.json.user?.email);
    assert(!!userCookie, "USER session cookie set");
    const me = await req("/auth/me", { cookie: userCookie });
    assert(me.status === 200 && me.json.user?.role === "USER", "USER /auth/me");
    const bad = await req("/auth/login", {
      method: "POST",
      body: { email: "demo@example.com", password: "wrong-password" },
    });
    assert(bad.status === 401 || bad.status === 400, "USER bad password rejected", `status=${bad.status}`);
  }

  // ADMIN auth + RBAC
  let adminCookie = "";
  {
    const login = await req("/auth/login", {
      method: "POST",
      body: { email: "admin@example.com", password: "DemoPassword123!" },
    });
    adminCookie = sessionCookie(login.setCookie);
    assert(login.status === 200 && login.json.user?.role === "ADMIN", "ADMIN login");
    const overview = await req("/admin/overview", { cookie: adminCookie });
    assert(overview.status === 200 && Array.isArray(overview.json.users), "ADMIN overview 200");
    const forbidden = await req("/admin/overview", { cookie: userCookie });
    assert(forbidden.status === 403, "USER forbidden from admin overview", `status=${forbidden.status}`);
    const anon = await req("/admin/overview");
    assert(anon.status === 401, "Anon forbidden from admin overview");
  }

  // Availability Islamabad weekday
  let freeSlot = "";
  {
    // find next weekday date in PKT
    let date = "";
    for (let i = 1; i <= 14; i++) {
      const d = new Date(Date.now() + i * 86400000);
      const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(d);
      const day = new Date(d.getTime() + 5 * 3600000).getUTCDay();
      // use API
      const av = await req(`/appointments/availability?date=${key}`, { cookie: userCookie });
      if (av.status === 200 && av.json.slots?.length) {
        date = key;
        freeSlot = av.json.slots.find((s) => s !== "2026-10-07T05:00:00.000Z") ?? av.json.slots[0];
        // prefer a slot not the known booked one if possible
        const alt = av.json.slots.find((s) => !s.startsWith("2026-10-07T05:00"));
        if (alt) freeSlot = alt;
        assert(true, `Availability for ${date}`, `${av.json.slots.length} slots (Islamabad/PKT)`);
        // times should be 09:00-16:30 PKT => UTC 04:00-11:30
        const sample = av.json.slots[0];
        const pkt = new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "Asia/Karachi",
        }).format(new Date(sample));
        assert(pkt >= "09:00" && pkt <= "16:30", "Slot maps to Islamabad business hours", `${sample} → ${pkt} PKT`);
        break;
      }
      if (av.status === 400) continue;
    }
    assert(!!freeSlot, "Found a free bookable slot");

    const weekend = await req("/appointments/availability?date=2026-10-04", { cookie: userCookie });
    assert(
      weekend.status === 200 && weekend.json.slots?.length === 0,
      "Weekend returns zero slots",
      `count=${weekend.json.slots?.length}`,
    );
  }

  // Chat: proper availability-aware reply
  {
    const created = await req("/chat/sessions", { method: "POST", cookie: userCookie });
    assert(created.status === 201 || created.status === 200, "Create chat session");
    const sid = created.json.session?.id;
    const sent = await req(`/chat/sessions/${sid}/messages`, {
      method: "POST",
      cookie: userCookie,
      body: {
        content: "give me available appointment slots in Islamabad",
        clientMessageId: randomUUID(),
      },
    });
    assert(sent.status === 200, "Chat send status", `status=${sent.status}`);
    const assistant = [...(sent.json.messages ?? [])].reverse().find((m) => m.role === "ASSISTANT");
    const text = assistant?.content ?? "";
    assert(!!assistant, "Assistant replied");
    assert(
      /\d{1,2}:\d{2}/.test(text) || /Islamabad|PKT|09:|10:|11:|manual/i.test(text),
      "Assistant reply includes Islamabad times or concrete slots",
      text,
    );
    assert(!/Karachi/i.test(text), "Assistant reply does not say Karachi", text);

    const hist = await req("/chat/sessions", { cookie: userCookie });
    assert(hist.status === 200 && hist.json.sessions?.length > 0, "Chat history list");
  }

  // Booking + approval + duplicate rules
  {
    // Ensure demo user has no active booking before tests (cancel any PENDING/CONFIRMED via admin)
    {
      const overview = await req("/admin/overview", { cookie: adminCookie });
      for (const a of overview.json.appointments ?? []) {
        if (
          a.user?.email === "demo@example.com" &&
          (a.status === "PENDING" || a.status === "CONFIRMED") &&
          new Date(a.startsAt) > new Date()
        ) {
          await req(`/admin/appointments/${a.id}/cancel`, {
            method: "POST",
            cookie: adminCookie,
          });
        }
      }
    }

    const key = randomUUID();
    const first = await req("/appointments", {
      method: "POST",
      cookie: userCookie,
      body: { serviceCode: "CONSULTATION_30", startsAt: freeSlot, idempotencyKey: key },
    });
    assert(
      (first.status === 201 || first.status === 200) && first.json.appointment?.status === "PENDING",
      "USER book creates PENDING appointment",
      `status=${first.status} appt=${first.json.appointment?.status}`,
    );
    const appointmentId = first.json.appointment?.id;

    const replay = await req("/appointments", {
      method: "POST",
      cookie: userCookie,
      body: { serviceCode: "CONSULTATION_30", startsAt: freeSlot, idempotencyKey: key },
    });
    assert(replay.status === 200, "Idempotent replay returns 200", `status=${replay.status}`);

    let other = nextWeekdayIso(11, 0);
    if (other === freeSlot) other = nextWeekdayIso(11, 30);
    const conflict = await req("/appointments", {
      method: "POST",
      cookie: userCookie,
      body: { serviceCode: "CONSULTATION_30", startsAt: other, idempotencyKey: key },
    });
    assert(conflict.status === 409, "Idempotency conflict returns 409", `status=${conflict.status}`);

    const dup = await req("/appointments", {
      method: "POST",
      cookie: userCookie,
      body: {
        serviceCode: "CONSULTATION_30",
        startsAt: other,
        idempotencyKey: randomUUID(),
      },
    });
    assert(
      dup.status === 409 && dup.json.error?.code === "DUPLICATE_ACTIVE_APPOINTMENT",
      "Duplicate active appointment blocked",
      `status=${dup.status} code=${dup.json.error?.code}`,
    );

    // second user race on same slot
    const signupEmail = `racer-${Date.now()}@example.com`;
    const signup = await req("/auth/signup", {
      method: "POST",
      body: { name: "Slot Racer", email: signupEmail, password: "DemoPassword123!" },
    });
    const racerCookie = sessionCookie(signup.setCookie);
    assert(signup.status === 201, "Signup second user for slot race");
    const race = await req("/appointments", {
      method: "POST",
      cookie: racerCookie,
      body: {
        serviceCode: "CONSULTATION_30",
        startsAt: freeSlot,
        idempotencyKey: randomUUID(),
      },
    });
    assert(
      race.status === 409,
      "Second user gets SLOT_UNAVAILABLE on held pending slot",
      `status=${race.status} code=${race.json.error?.code}`,
    );

    const forbiddenApprove = await req(`/admin/appointments/${appointmentId}/approve`, {
      method: "POST",
      cookie: userCookie,
    });
    assert(forbiddenApprove.status === 403, "USER cannot approve appointments");

    const approved = await req(`/admin/appointments/${appointmentId}/approve`, {
      method: "POST",
      cookie: adminCookie,
    });
    assert(
      approved.status === 200 && approved.json.appointment?.status === "CONFIRMED",
      "ADMIN approves pending appointment",
      `status=${approved.status}`,
    );

    const userCancelConfirmed = await req(`/appointments/${appointmentId}/cancel`, {
      method: "POST",
      cookie: userCookie,
    });
    assert(
      userCancelConfirmed.status === 409,
      "USER cannot cancel after confirmation",
      `status=${userCancelConfirmed.status}`,
    );

    const list = await req("/appointments", { cookie: userCookie });
    assert(
      list.status === 200 && list.json.appointments?.some((a) => a.status === "CONFIRMED"),
      "USER appointments list shows confirmed",
      `count=${list.json.appointments?.length}`,
    );
  }

  // ADMIN sees appointments
  {
    const overview = await req("/admin/overview", { cookie: adminCookie });
    assert(
      overview.status === 200 && overview.json.appointments?.length >= 1,
      "ADMIN sees appointments across users",
      `count=${overview.json.appointments?.length}`,
    );
  }

  for (const r of results) {
    if (r.ok) summary.pass++;
    else summary.fail++;
  }
  console.log(`\n=== SUMMARY: ${summary.pass} passed, ${summary.fail} failed of ${results.length} ===\n`);
  if (summary.fail) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
