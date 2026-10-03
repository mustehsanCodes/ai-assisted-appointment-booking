import "./globals.css";
import { Providers } from "./providers";
export const metadata = {
  title: "Consult — Appointment booking",
  description: "AI-assisted consultation booking",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
