"use client";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, Clock3, LoaderCircle } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
export function BookingForm() {
  const qc = useQueryClient(),
    [selectedDate, setSelectedDate] = useState<Date>(),
    [slot, setSlot] = useState(""),
    [review, setReview] = useState(false),
    [key, setKey] = useState(() => crypto.randomUUID());
  const date = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
  const availability = useQuery({
    queryKey: ["availability", date],
    queryFn: () => api<{ slots: string[] }>(`/appointments/availability?date=${date}`),
    enabled: !!date,
  });
  const book = useMutation({
    mutationFn: () =>
      api("/appointments", {
        method: "POST",
        body: JSON.stringify({
          serviceCode: "CONSULTATION_30",
          startsAt: slot,
          idempotencyKey: key,
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["appointments"] });
      void qc.invalidateQueries({ queryKey: ["availability"] });
    },
  });
  const formatted = useMemo(
    () =>
      slot
        ? new Intl.DateTimeFormat("en-PK", {
            dateStyle: "full",
            timeStyle: "short",
            timeZone: "Asia/Karachi",
          }).format(new Date(slot))
        : "",
    [slot],
  );
  if (book.isSuccess)
    return (
      <section className="card success-card" role="status">
        <CheckCircle2 className="success-icon" size={38} />
        <p className="eyebrow" style={{ marginTop: 18 }}>
          REQUEST SUBMITTED
        </p>
        <h2>Waiting for admin approval</h2>
        <p>{formatted}</p>
        <p className="muted">30-minute consultation · Islamabad (PKT)</p>
        <p className="field-hint" style={{ marginTop: 12 }}>
          Your booking is PENDING. An administrator must approve it. You can cancel from Appointments
          until then. Only one upcoming active appointment is allowed per account.
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            book.reset();
            setReview(false);
            setSlot("");
            setKey(crypto.randomUUID());
          }}
        >
          Back to booking
        </Button>
      </section>
    );
  return (
    <section className="card panel">
      <header className="panel-header">
        <div>
          <p className="eyebrow">MANUAL BOOKING</p>
          <h2>Choose an available time</h2>
          <p className="muted">Weekdays, 09:00–17:00 · Islamabad (PKT)</p>
        </div>
        <span className="icon-tile">
          <CalendarClock size={21} />
        </span>
      </header>
      <div style={{ paddingTop: 20 }}>
        <div className="field-group">
          <span className="label">Appointment date</span>
          <DatePicker
            value={selectedDate}
            onChange={(value) => {
              setSelectedDate(value);
              setSlot("");
              setReview(false);
              setKey(crypto.randomUUID());
            }}
          />
        </div>
        {availability.isPending && date && (
          <p className="muted" style={{ marginTop: 16 }}>
            <LoaderCircle size={15} className="animate-spin" /> Loading available times…
          </p>
        )}
        {availability.isError && (
          <div className="form-error" role="alert" style={{ marginTop: 16 }}>
            Could not load slots. Check the date and try again.
          </div>
        )}
        {availability.data && (
          <>
            {
              <div className="slot-grid">
                {availability.data.slots.map((s) => (
                  <Button
                    type="button"
                    size="sm"
                    variant={slot === s ? "default" : "secondary"}
                    className="slot"
                    key={s}
                    onClick={() => {
                      setSlot(s);
                      setReview(false);
                      setKey(crypto.randomUUID());
                    }}
                  >
                    {new Intl.DateTimeFormat("en-PK", {
                      hour: "numeric",
                      minute: "2-digit",
                      timeZone: "Asia/Karachi",
                    }).format(new Date(s))}
                  </Button>
                ))}
              </div>
            }
            {!availability.data.slots.length && (
              <div className="empty">
                <Clock3 className="muted" />
                <p>No available times on this date.</p>
              </div>
            )}
          </>
        )}
        {slot && !review && (
          <Button style={{ width: "100%", marginTop: 18 }} onClick={() => setReview(true)}>
            Review appointment
          </Button>
        )}
        {review && (
          <div className="review">
            <p className="eyebrow">FINAL REVIEW</p>
            <h3>{formatted}</h3>
            <p className="muted">30-minute consultation. Confirming will reserve this time.</p>
            {book.isError && (
              <div className="form-error" role="alert">
                {book.error.message}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <Button disabled={book.isPending} onClick={() => book.mutate()}>
                {book.isPending && <LoaderCircle size={16} className="animate-spin" />}
                {book.isPending ? "Confirming…" : "Confirm booking"}
              </Button>
              <Button variant="ghost" onClick={() => setReview(false)}>
                Change
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
