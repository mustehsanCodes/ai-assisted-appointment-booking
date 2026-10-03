import { AppointmentList } from "@/features/appointments/appointment-list";
export default function Page() {
  return (
    <main className="page" style={{ maxWidth: 880 }}>
      <header className="page-heading">
        <p className="eyebrow">YOUR SCHEDULE</p>
        <h1>My appointments</h1>
        <p className="muted">
          Pending requests wait for admin approval. Confirmed bookings can only be changed by an
          administrator.
        </p>
      </header>
      <AppointmentList />
    </main>
  );
}
