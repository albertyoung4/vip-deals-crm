import type { Metadata } from "next";
import Link from "next/link";
import LastSyncBadge from "./LastSyncBadge";
import { getCurrentUserOrNull } from "@/lib/current-user";
import { logout } from "./login/actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "VIP Deals CRM",
  description: "Track off-market deals VIP investors are interested in",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUserOrNull();
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-neutral-50 text-neutral-900 flex flex-col">
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
            <Link href="/" className="font-semibold">
              VIP Deals CRM
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              {user && (
                <>
                  <Link href="/" className="hover:text-blue-600">Dashboard</Link>
                  <Link href="/deals/new" className="hover:text-blue-600">Add Deal</Link>
                  <LastSyncBadge />
                  <span className="text-neutral-500">{user.name || user.google_email}</span>
                  <form action={logout}>
                    <button
                      type="submit"
                      className="rounded-md border px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
                    >
                      Sign out
                    </button>
                  </form>
                </>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
