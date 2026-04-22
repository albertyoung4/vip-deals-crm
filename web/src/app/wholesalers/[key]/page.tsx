import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { money, timeago, statusLabel } from "@/lib/format";

interface ListingRow {
  wholesaler_key: string;
  listing_id: string;
  full_address: string | null;
  us_state: string | null;
  county: string | null;
  ask_price: number | null;
  listing_state: string | null;
  savvy_arv: number | null;
  savvy_reno: number | null;
  wholesaler_arv: number | null;
  wholesaler_reno: number | null;
  seller_company: string | null;
  seller_first_name: string | null;
  seller_last_name: string | null;
  seller_email: string | null;
  seller_phone: string | null;
  version_created_at: string | null;
  deal_id: string | null;
  deal_status: string | null;
}

interface ProfileRow {
  wholesaler_key: string;
  seller_company: string | null;
  seller_first_name: string | null;
  seller_last_name: string | null;
  email_override: string | null;
  phone_override: string | null;
  notes: string | null;
  updated_at: string;
}

export default async function WholesalerPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key: rawKey } = await params;
  const key = decodeURIComponent(rawKey);
  const sb = supabaseAdmin();

  const [{ data: listings }, { data: profile }] = await Promise.all([
    sb
      .from("v_wholesaler_listing")
      .select("*")
      .eq("wholesaler_key", key)
      .order("version_created_at", { ascending: false, nullsFirst: false }),
    sb
      .from("wholesaler_profile")
      .select("*")
      .eq("wholesaler_key", key)
      .maybeSingle(),
  ]);

  const rows = (listings ?? []) as ListingRow[];
  const p = (profile ?? null) as ProfileRow | null;

  if (rows.length === 0 && !p) notFound();

  const sample = rows[0];
  const displayName =
    p?.seller_company ||
    sample?.seller_company ||
    [p?.seller_first_name ?? sample?.seller_first_name, p?.seller_last_name ?? sample?.seller_last_name]
      .filter(Boolean)
      .join(" ") ||
    key;

  const email = p?.email_override ?? sample?.seller_email ?? null;
  const phone = p?.phone_override ?? sample?.seller_phone ?? null;

  const activeDeals = rows.filter((r) => r.deal_id).length;
  const untracked = rows.length - activeDeals;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← Back
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{displayName}</h1>
        <div className="text-sm text-neutral-500">
          Wholesaler · {rows.length} listings ({activeDeals} tracked, {untracked} untracked)
        </div>
      </div>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-600">
          Contact
        </h2>
        <div className="text-sm">
          {email && (
            <div>
              <a className="text-blue-700 hover:underline" href={`mailto:${email}`}>
                {email}
              </a>
            </div>
          )}
          {phone && (
            <div>
              <a className="text-blue-700 hover:underline" href={`tel:${phone}`}>
                {phone}
              </a>
            </div>
          )}
          {!email && !phone && (
            <div className="text-neutral-500">No contact on file.</div>
          )}
        </div>
        {p?.notes && (
          <div className="mt-3 text-sm italic text-neutral-600">{p.notes}</div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">All properties</h2>
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-neutral-100 text-left text-xs uppercase tracking-wide text-neutral-600">
              <tr>
                <th className="px-4 py-2">Address</th>
                <th className="px-3 py-2">Listing state</th>
                <th className="px-3 py-2 text-right">Ask</th>
                <th className="px-3 py-2 text-right">Calc ARV</th>
                <th className="px-3 py-2 text-right">Calc rehab</th>
                <th className="px-3 py-2">Deal status</th>
                <th className="px-3 py-2">Added</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.listing_id} className="border-b last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-2.5">
                    {r.deal_id ? (
                      <Link
                        href={`/deals/${r.deal_id}`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {r.full_address ?? "—"}
                      </Link>
                    ) : (
                      <span className="font-medium">{r.full_address ?? "—"}</span>
                    )}
                    <div className="text-xs text-neutral-500">
                      {[r.us_state, r.county].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs">{r.listing_state ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right">{money(r.ask_price)}</td>
                  <td className="px-3 py-2.5 text-right">{money(r.savvy_arv)}</td>
                  <td className="px-3 py-2.5 text-right">{money(r.savvy_reno)}</td>
                  <td className="px-3 py-2.5 text-xs">
                    {r.deal_status ? (
                      statusLabel(r.deal_status)
                    ) : (
                      <span className="text-neutral-400">not tracked</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-neutral-500">
                    {timeago(r.version_created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
