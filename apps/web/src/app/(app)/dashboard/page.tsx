import { Sparkles } from "lucide-react";
import { ChatPanel } from "@/features/chat/chat-panel";
import { BookingForm } from "@/features/appointments/booking-form";
export default function Dashboard() {
  return (
    <main className="page">
      <header className="page-heading">
        <p className="eyebrow">YOUR WORKSPACE</p>
        <h1>Book a consultation</h1>
        <p className="muted">Ask the assistant for help or choose an available time directly.</p>
      </header>
      <div className="dashboard-grid">
        <ChatPanel />
        <BookingForm />
      </div>
      <p
        className="muted"
        style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 18, fontSize: 13 }}
      >
        <Sparkles size={14} /> Your booking is only created after you explicitly confirm it.
      </p>
    </main>
  );
}
