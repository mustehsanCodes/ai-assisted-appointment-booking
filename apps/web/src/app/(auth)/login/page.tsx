import Link from "next/link";
import { CalendarCheck2 } from "lucide-react";
import { AuthForm } from "@/features/auth/auth-form";
export default function Page() {
  return (
    <main className="auth-page">
      <section className="auth-main">
        <div className="auth-box">
          <Link className="brand" href="/">
            <span className="brand-mark">
              <CalendarCheck2 size={19} />
            </span>
            <span>Consult</span>
          </Link>
          <div className="auth-intro">
            <p className="eyebrow">WELCOME BACK</p>
            <h1>Sign in to your account</h1>
            <p className="muted">Manage your consultations and continue where you left off.</p>
          </div>
          <div className="card auth-card">
            <AuthForm mode="login" />
          </div>
          <p className="auth-link">
            New to Consult? <Link href="/signup">Create an account</Link>
          </p>
        </div>
      </section>
      <aside className="auth-aside">
        <div className="auth-quote">
          <h2>Scheduling that feels effortless.</h2>
          <p>
            Use the booking assistant or choose a time yourself. Every appointment is reviewed
            before it is confirmed.
          </p>
        </div>
      </aside>
    </main>
  );
}
