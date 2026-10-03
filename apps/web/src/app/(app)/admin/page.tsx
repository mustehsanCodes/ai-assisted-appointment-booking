"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, ShieldCheck, Users, X } from "lucide-react";
import type { AdminOverview, Appointment, AuthUser } from "@appointment/contracts";
import { api, ApiClientError } from "@/lib/api-client";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { Button } from "@/components/ui/button";

function statusClass(status: Appointment["status"]) {
  return `badge badge-${status.toLowerCase()}`;
}

export default function AdminPage() {
  const router = useRouter(),
    qc = useQueryClient(),
    [actionError, setActionError] = useState(""),
    me = useQuery({ queryKey: ["me"], queryFn: () => api<{ user: AuthUser }>("/auth/me") }),
    overview = useQuery({
      queryKey: ["admin-overview"],
      queryFn: () => api<AdminOverview>("/admin/overview"),
      enabled: me.data?.user.role === "ADMIN",
    });

  useEffect(() => {
    if (me.data && me.data.user.role !== "ADMIN") router.replace("/dashboard");
  }, [me.data, router]);

  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "reject" | "cancel" }) =>
      api(`/admin/appointments/${id}/${action}`, { method: "POST" }),
    onSuccess: async () => {
      setActionError("");
      await qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (error) => {
      setActionError(error instanceof ApiClientError ? error.message : "Action failed.");
    },
  });

  if (me.isPending || overview.isPending)
    return (
      <main className="page">
        <LoadingScreen
          fullscreen={false}
          title="Admin workspace"
          subtitle="Loading accounts and appointments…"
        />
      </main>
    );
  if (overview.isError)
    return (
      <main className="page">
        <div className="form-error">You do not have permission to view this workspace.</div>
      </main>
    );

  const data = overview.data;
  const pending = data.appointments.filter((a) => a.status === "PENDING").length;
  const confirmed = data.appointments.filter((a) => a.status === "CONFIRMED").length;

  return (
    <main className="page">
      <header className="page-heading">
        <p className="eyebrow">ADMINISTRATION</p>
        <h1>Operations overview</h1>
        <p className="muted">
          Approve pending bookings, reject or cancel when needed, and keep one active appointment per
          user.
        </p>
      </header>

      <section className="card panel permissions-card">
        <p className="eyebrow">ADMIN PERMISSIONS</p>
        <ul className="permissions-list">
          <li>
            <strong>Approve / reject</strong> pending consultation requests
          </li>
          <li>
            <strong>Cancel</strong> pending or confirmed appointments
          </li>
          <li>
            <strong>Reschedule</strong> via API when a slot must move (Islamabad PKT)
          </li>
          <li>
            Users may cancel/reschedule <strong>only while PENDING</strong>
          </li>
          <li>
            Each user may hold <strong>one upcoming PENDING or CONFIRMED</strong> appointment
          </li>
        </ul>
      </section>

      <section className="stats">
        <div className="card stat">
          <Users size={20} color="#4f46e5" />
          <div className="stat-value">{data.users.length}</div>
          <span className="muted">Total accounts</span>
        </div>
        <div className="card stat">
          <CalendarDays size={20} color="#4f46e5" />
          <div className="stat-value">{pending}</div>
          <span className="muted">Awaiting approval</span>
        </div>
        <div className="card stat">
          <ShieldCheck size={20} color="#4f46e5" />
          <div className="stat-value">{confirmed}</div>
          <span className="muted">Confirmed</span>
        </div>
      </section>

      {actionError && (
        <div className="form-error" style={{ marginBottom: 16 }}>
          {actionError}
        </div>
      )}

      <section className="card data-card">
        <div className="panel-header" style={{ padding: 20 }}>
          <div>
            <p className="eyebrow">ACCESS</p>
            <h2>Accounts & roles</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Can approve bookings</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`badge ${user.role === "ADMIN" ? "admin" : ""}`}>
                      {user.role}
                    </span>
                  </td>
                  <td>{user.role === "ADMIN" ? "Yes" : "No — book only"}</td>
                  <td>
                    {new Intl.DateTimeFormat("en-PK", { dateStyle: "medium" }).format(
                      new Date(user.createdAt),
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card data-card" style={{ marginTop: 22 }}>
        <div className="panel-header" style={{ padding: 20 }}>
          <div>
            <p className="eyebrow">SCHEDULE</p>
            <h2>Appointment approvals</h2>
          </div>
        </div>
        {!data.appointments.length ? (
          <div className="empty">
            <CalendarDays className="muted" />
            <p>No appointments have been booked.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>Start time</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.appointments.map((item) => (
                  <tr key={item.id}>
                    <td>{item.user.name}</td>
                    <td>{item.user.email}</td>
                    <td>
                      {new Intl.DateTimeFormat("en-PK", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Karachi",
                      }).format(new Date(item.startsAt))}
                    </td>
                    <td>
                      <span className={statusClass(item.status)}>{item.status}</span>
                    </td>
                    <td>
                      <div className="admin-actions">
                        {item.status === "PENDING" && (
                          <>
                            <Button
                              size="sm"
                              disabled={act.isPending}
                              onClick={() => act.mutate({ id: item.id, action: "approve" })}
                            >
                              <Check size={14} /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={act.isPending}
                              onClick={() => act.mutate({ id: item.id, action: "reject" })}
                            >
                              <X size={14} /> Reject
                            </Button>
                          </>
                        )}
                        {(item.status === "PENDING" || item.status === "CONFIRMED") && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={act.isPending}
                            onClick={() => act.mutate({ id: item.id, action: "cancel" })}
                          >
                            Cancel
                          </Button>
                        )}
                        {item.status !== "PENDING" &&
                          item.status !== "CONFIRMED" && (
                            <span className="muted" style={{ fontSize: 12 }}>
                              No actions
                            </span>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
