"use client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/lib/api-client";
import type { AuthUser } from "@appointment/contracts";
import { LoadingScreen } from "@/components/ui/loading-screen";

export function AuthBoundary({ children }: { children: React.ReactNode }) {
  const router = useRouter(),
    q = useQuery({
      queryKey: ["me"],
      queryFn: () => api<{ user: AuthUser }>("/auth/me"),
      retry: false,
    });
  useEffect(() => {
    if (q.isError) router.replace("/login");
  }, [q.isError, router]);
  if (q.isPending)
    return <LoadingScreen title="Welcome back" subtitle="Checking your session…" />;
  if (q.isError) return null;
  return children;
}
