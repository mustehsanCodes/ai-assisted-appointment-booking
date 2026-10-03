import { CalendarCheck2 } from "lucide-react";

type LoadingScreenProps = {
  title?: string;
  subtitle?: string;
  fullscreen?: boolean;
};

export function LoadingScreen({
  title = "Loading",
  subtitle = "Preparing your workspace…",
  fullscreen = true,
}: LoadingScreenProps) {
  return (
    <div
      className={fullscreen ? "loading-screen loading-screen-full" : "loading-screen"}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="loading-orb" aria-hidden="true">
        <span className="loading-ring" />
        <span className="loading-ring loading-ring-delay" />
        <span className="loading-mark">
          <CalendarCheck2 size={22} />
        </span>
      </div>
      <p className="loading-title">{title}</p>
      <p className="loading-subtitle">{subtitle}</p>
      <span className="sr-only">{title}. {subtitle}</span>
    </div>
  );
}

export function InlineLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="inline-loader" role="status" aria-live="polite" aria-busy="true">
      <span className="inline-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
