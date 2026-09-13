import type { Metadata } from "next";
import { Big_Shoulders_Display, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import Navigation from "@/components/Navigation";
import "./globals.css";

// Display: Big Shoulders Display — a condensed, civic/engineering-drawing
// grotesk. Deliberately not Inter/Roboto/Space Grotesk — reads as
// instrumentation, not SaaS marketing.
const display = Big_Shoulders_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
  display: "swap",
});

// Body/UI: Public Sans — a highly legible, neutral grotesk built for dense
// operational reading (US Web Design System heritage: instrumentation, not decor).
const body = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

// Numerics: IBM Plex Mono, tabular figures — ARR/burn/runway/deltas need to
// feel measured and precise, not typeset prose.
const num = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-num",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Axiom — Company-OS",
  description: "Agentic company-OS for solo founders.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${num.variable}`}>
      <body className="min-h-screen bg-base font-body text-ink-primary antialiased">
        <Navigation />
        {children}
      </body>
    </html>
  );
}
