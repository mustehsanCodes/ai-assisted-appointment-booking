"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CalendarCheck2, LayoutDashboard, LogOut, MessagesSquare, ShieldCheck } from "lucide-react";
import type { AuthUser } from "@appointment/contracts";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
export function AppHeader() {
  const router = useRouter(),
    qc = useQueryClient(),
    { data } = useQuery({ queryKey: ["me"], queryFn: () => api<{ user: AuthUser }>("/auth/me") });
  const user = data?.user;
  return (
    <header className="app-header">
      <div className="header-inner">
        <Link className="brand" href={user?.role === "ADMIN" ? "/admin" : "/dashboard"}>
          <span className="brand-mark">
            <CalendarCheck2 size={18} />
          </span>
          <span className="brand-text">Consult</span>
        </Link>
        <nav className="nav" aria-label="Primary navigation">
          {user?.role === "ADMIN" ? (
            <Link className="nav-link" href="/admin">
              <ShieldCheck size={17} className="mobile-label" />
              <span className="desktop-label">Admin</span>
            </Link>
          ) : (
            <>
              <Link className="nav-link" href="/dashboard">
                <LayoutDashboard size={17} className="mobile-label" />
                <span className="desktop-label">Book</span>
              </Link>
              <Link className="nav-link" href="/chats">
                <MessagesSquare size={17} className="mobile-label" />
                <span className="desktop-label">Chats</span>
              </Link>
              <Link className="nav-link" href="/appointments">
                <BookOpen size={17} className="mobile-label" />
                <span className="desktop-label">Appointments</span>
              </Link>
            </>
          )}
          <span className="role-pill">{user?.role ?? "USER"}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await api("/auth/logout", { method: "POST" });
              qc.clear();
              router.replace("/login");
            }}
          >
            <LogOut size={16} />
            <span className="desktop-label">Sign out</span>
          </Button>
        </nav>
      </div>
    </header>
  );
}
