import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { money } from "@/lib/format";
import { addDealAndRedirect } from "./actions";

interface Listing {
  id: string;
  full_address: string | null;
  us_state: string | null;
  county: string | null;
  list_price: number | null;
  savvy_arv: number | null;
  savvy_reno: number | null;
  wholesaler_arv: number | null;
  wholesaler_reno: number | null;
  seller_company: string | null;
  seller_first_name: string | null;
  seller_last_name: string | null;
}

export default async function NewDeal({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const sb = supabaseAdmin();

  const baseSelect = sb
    .from("ext_wholesale_listing")
    .select(
      "id, full_address, us_state, county, list_price, savvy_arv, savvy_reno, wholesaler_arv, wholesaler_reno, seller_company, seller_first_name, seller_last_name",
    )
    .order("version_created_at", { ascending: false, nullsFirst: false })
    .limit(50);

  const query = q.trim()
    ? baseSelect.ilike("full_address", `%${q.trim()}%`)
    : baseSelect;

  const { data: listings, error } = await query;
  const rows = (listings ?? []) as Listing[];

  const { data: existingDeals } = await sb.from("deal").select("listing_id");
  const taken = new Set(((existingDeals ?? []) as { listing_id: string }[]).map((d) => d.listing_id));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← Back
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Add Deal</h1>
        <p className="text-sm text-neutral-500">
          Pick a 3rd-party wholesale listing to start tracking.
        </p>
      </div>

      <form className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by address…"
          className="flex-1 rounded-md border px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Search
        </button>
      </form>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error.message}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-neutral-100 text-left text-xs uppercase tracking-wide text-neutral-600">
            <tr>
              <th className="px-4 py-2">Address</th>
              <th className="px-3 py-2 text-right">Ask</th>
              <th className="px-3 py-2 text-right">Calc ARV</th>
              <th className="px-3 py-2 text-right">Calc rehab</th>
              <th className="px-3 py-2">Wholesaler</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => {
              const isTaken = taken.has(l.id);
              return (
                <tr key={l.id} className="border-b last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{l.full_address ?? "—"}</div>
                    <div className="text-xs text-neutral-500">
                      {l.us_state} · {l.county}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">{money(l.list_price)}</td>
                  <td className="px-3 py-2.5 text-right">{money(l.savvy_arv)}</td>
                  <td className="px-3 py-2.5 text-right">{money(l.savvy_reno)}</td>
                  <td className="px-3 py-2.5 text-xs">
                    {l.seller_company ||
                      [l.seller_first_name, l.seller_last_name].filter(Boolean).join(" ") ||
                      <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {isTaken ? (
                      <span className="text-xs text-neutral-400">tracked</span>
                    ) : (
                      <form action={addDealAndRedirect}>
                        <input type="hidden" name="listing_id" value={l.id} />
                        <button
                          type="submit"
                          className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          Track
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-neutral-500">
                  No listings matched.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
