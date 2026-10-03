import { AuthBoundary } from "@/features/auth/auth-boundary";
import { AppHeader } from "@/components/layout/app-header";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AuthBoundary>
      <AppHeader />
      {children}
    </AuthBoundary>
  );
}
