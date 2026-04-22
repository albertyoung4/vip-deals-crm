import type { Metadata } from "next";
import Link from "next/link";
import LastSyncBadge from "./LastSyncBadge";
import "./globals.css";

export const metadata: Metadata = {
  title: "VIP Deals CRM",
  description: "Track off-market deals VIP investors are interested in",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-neutral-50 text-neutral-900 flex flex-col">
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
            <Link href="/" className="font-semibold">
              VIP Deals CRM
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/" className="hover:text-blue-600">Dashboard</Link>
              <Link href="/deals/new" className="hover:text-blue-600">Add Deal</Link>
              <LastSyncBadge />
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
