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
            <p className="eyebrow">GET STARTED</p>
            <h1>Create your account</h1>
            <p className="muted">Book and manage consultations from one secure workspace.</p>
          </div>
          <div className="card auth-card">
            <AuthForm mode="signup" />
          </div>
          <p className="auth-link">
            Already have an account? <Link href="/login">Sign in</Link>
          </p>
        </div>
      </section>
      <aside className="auth-aside">
        <div className="auth-quote">
          <h2>Your time, clearly organized.</h2>
          <p>
            Available slots come directly from the server, and you always review the details before
            booking.
          </p>
        </div>
      </aside>
    </main>
  );
}
