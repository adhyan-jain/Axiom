import type { Metadata } from "next";
import Navigation from "@/components/Navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: "Axiom — Company-OS",
  description: "Agentic company-OS for solo founders.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <Navigation />
        {children}
      </body>
    </html>
  );
}
