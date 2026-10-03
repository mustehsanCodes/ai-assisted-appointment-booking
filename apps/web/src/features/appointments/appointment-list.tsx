"use client";
import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Clock3, Info, ShieldAlert } from "lucide-react";
import type { Appointment } from "@appointment/contracts";
import { api, ApiClientError } from "@/lib/api-client";
import { InlineLoader } from "@/components/ui/loading-screen";
import { Button } from "@/components/ui/button";

function statusClass(status: Appointment["status"]) {
  return `badge badge-${status.toLowerCase()}`;
}

function statusHint(status: Appointment["status"]) {
  switch (status) {
    case "PENDING":
      return "Awaiting admin approval. You can cancel this request until it is approved.";
    case "CONFIRMED":
      return "Approved by an administrator. Only an admin can cancel or reschedule this booking.";
    case "REJECTED":
      return "Admin rejected this request. You can book a new time from the Book page.";
    case "CANCELLED":
      return "This appointment was cancelled.";
    default:
      return "";
  }
}

export function AppointmentList() {
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const q = useQuery({
    queryKey: ["appointments"],
    queryFn: () => api<{ appointments: Appointment[] }>("/appointments"),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => api(`/appointments/${id}/cancel`, { method: "POST" }),
    onSuccess: async () => {
      setError("");
      await qc.invalidateQueries({ queryKey: ["appointments"] });
      await qc.invalidateQueries({ queryKey: ["availability"] });
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? err.message : "Could not cancel appointment.");
    },
  });

  if (q.isPending)
    return (
      <div className="card panel" style={{ minHeight: 180, display: "grid", placeItems: "center" }}>
        <InlineLoader label="Loading appointments…" />
      </div>
    );
  if (q.isError)
    return (
      <div role="alert" className="form-error">
        Could not load appointments. Please refresh the page.
      </div>
    );

  const appointments = q.data.appointments;
  const pending = appointments.filter((a) => a.status === "PENDING");
  const active = appointments.filter(
    (a) =>
      (a.status === "PENDING" || a.status === "CONFIRMED") && new Date(a.startsAt) > new Date(),
  );

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section className="card panel rules-banner">
        <div className="rules-banner-head">
          <Info size={18} color="#4f46e5" />
          <strong>How booking approval works</strong>
        </div>
        <ol className="rules-steps">
          <li>
            You submit a request → status <span className="badge badge-pending">PENDING</span>
          </li>
          <li>
            An <strong>ADMIN</strong> approves or rejects it on the Admin page
          </li>
          <li>
            Approved → <span className="badge badge-confirmed">CONFIRMED</span> (you can no longer
            change it yourself)
          </li>
          <li>Only one upcoming PENDING or CONFIRMED appointment is allowed per account</li>
        </ol>
        <p className="field-hint" style={{ margin: "10px 0 0" }}>
          Chat drafts are not appointments. Use{" "}
          <Link href="/dashboard" style={{ color: "var(--primary)", fontWeight: 700 }}>
            Book → Manual Booking
          </Link>{" "}
          to submit a request.
        </p>
      </section>

      {pending.length > 0 && (
        <div className="card panel pending-banner">
          <ShieldAlert size={18} color="#c2410c" />
          <div>
            <strong>
              {pending.length} request{pending.length > 1 ? "s" : ""} waiting for admin approval
            </strong>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              Cancel is available on each PENDING card below until an admin decides.
            </p>
          </div>
        </div>
      )}

      {active.length > 1 && (
        <div className="form-error" role="alert">
          You currently have more than one active upcoming appointment from older data. New bookings
          are blocked until extras are cancelled by an admin.
        </div>
      )}

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      {!appointments.length ? (
        <div className="card empty">
          <CalendarDays size={30} className="muted" />
          <h2 style={{ margin: "14px 0 6px" }}>No appointments yet</h2>
          <p className="muted">Submit a request from Book — it will appear here as PENDING.</p>
          <Button asChild className="auth-submit" style={{ marginTop: 12, width: "auto" }}>
            <Link href="/dashboard">Go to Book</Link>
          </Button>
        </div>
      ) : (
        appointments.map((a) => (
          <article className={`card panel appointment-card status-${a.status.toLowerCase()}`} key={a.id}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                alignItems: "flex-start",
              }}
            >
              <div>
                <span className={statusClass(a.status)}>{a.status}</span>
                <h2 style={{ margin: "12px 0 6px" }}>
                  {new Intl.DateTimeFormat("en-PK", {
                    dateStyle: "full",
                    timeZone: "Asia/Karachi",
                  }).format(new Date(a.startsAt))}
                </h2>
                <p className="muted" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Clock3 size={15} />
                  {new Intl.DateTimeFormat("en-PK", {
                    timeStyle: "short",
                    timeZone: "Asia/Karachi",
                  }).format(new Date(a.startsAt))}{" "}
                  · 30 minutes · Islamabad (PKT)
                </p>
                <p className="field-hint" style={{ marginTop: 10 }}>
                  {statusHint(a.status)}
                </p>
              </div>
              <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                <span className="icon-tile">
                  <CalendarDays size={20} />
                </span>
                {a.status === "PENDING" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={cancel.isPending}
                    onClick={() => cancel.mutate(a.id)}
                  >
                    Cancel request
                  </Button>
                ) : a.status === "CONFIRMED" ? (
                  <span className="field-hint" style={{ maxWidth: 140, textAlign: "right" }}>
                    Admin-managed
                  </span>
                ) : null}
              </div>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
