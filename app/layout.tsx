import type { Metadata } from "next";
import "./globals.css";
import "@/components/ledgerlab/desktop/responsive.css";

export const metadata: Metadata = {
  title: "LedgerLab · Accounting practice",
  description: "Learn the work behind the numbers. A complete accounting practice workspace with bookkeeping, month-end, payroll, reconciliations and financial statements.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
