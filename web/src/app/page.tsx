import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { DashboardRow } from "@/lib/types";
import { money, timeago, statusLabel } from "@/lib/format";
import AddInterestModal from "./AddInterestModal";
import AssignDispoRep from "./deals/[id]/AssignDispoRep";

interface ActivitySummary {
  total_deals: number;
  active_deals: number;
  bids_last_7d: number;
  bids_last_30d: number;
  unique_bidders_all_time: number;
  unique_bidders_30d: number;
  notes_last_7d: number;
}

interface BidRow {
  id: string;
  listing_id: string;
  user_first_name: string | null;
  user_last_name: string | null;
  user_email: string | null;
  user_phone: string | null;
  price: number | null;
  created_at: string;
}

interface ListingRow {
  id: string;
  full_address: string | null;
  us_state: string | null;
  county: string | null;
}

export default async function Home() {
  const sb = supabaseAdmin();

  const [
    { data: deals, error: dealsErr },
    { data: summary },
    { data: recentBids },
  ] = await Promise.all([
    sb
      .from("v_deal_dashboard")
      .select("*")
      .order("deal_updated_at", { ascending: false })
      .limit(200),
    sb.from("v_activity_summary").select("*").maybeSingle(),
    sb
      .from("ext_bid")
      .select("id, listing_id, user_first_name, user_last_name, user_email, user_phone, price, created_at")
      .not("user_first_name", "eq", "Jimmy")
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  const rows = (deals ?? []) as DashboardRow[];
  const s = (summary ?? null) as ActivitySummary | null;
  const bids = (recentBids ?? []) as BidRow[];

  // Resolve listing addresses + tracked-deal lookup for each bid
  const listingIds = [...new Set(bids.map((b) => b.listing_id).filter(Boolean))];
  const listingById = new Map<string, ListingRow>();
  const dealByListing = new Map<string, string>();
  if (listingIds.length > 0) {
    const [{ data: listings }, { data: dealLinks }] = await Promise.all([
      sb
        .from("ext_wholesale_listing")
        .select("id, full_address, us_state, county")
        .in("id", listingIds),
      sb.from("deal").select("id, listing_id").in("listing_id", listingIds),
    ]);
    for (const l of (listings ?? []) as ListingRow[]) listingById.set(l.id, l);
    for (const d of (dealLinks ?? []) as { id: string; listing_id: string }[]) {
      dealByListing.set(d.listing_id, d.id);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Active deals" value={s?.active_deals ?? "—"} />
        <Stat label="Bids (7d)" value={s?.bids_last_7d ?? "—"} />
        <Stat label="Bids (30d)" value={s?.bids_last_30d ?? "—"} />
        <Stat label="Unique bidders (30d)" value={s?.unique_bidders_30d ?? "—"} />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent bids</h2>
          <span className="text-xs text-neutral-500">latest {bids.length}</span>
        </div>

        {bids.length === 0 ? (
          <div className="rounded border bg-white px-4 py-6 text-sm text-neutral-500">
            No bids yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead className="border-b bg-neutral-100 text-left text-xs uppercase tracking-wide text-neutral-600">
                <tr>
                  <th className="px-4 py-2">When</th>
                  <th className="px-3 py-2">Investor</th>
                  <th className="px-3 py-2 text-right">Bid</th>
                  <th className="px-3 py-2">Property</th>
                </tr>
              </thead>
              <tbody>
                {bids.map((b) => {
                  const listing = listingById.get(b.listing_id);
                  const dealId = dealByListing.get(b.listing_id);
                  const name =
                    [b.user_first_name, b.user_last_name].filter(Boolean).join(" ") ||
                    b.user_email ||
                    "—";
                  return (
                    <tr key={b.id} className="border-b last:border-0 hover:bg-neutral-50">
                      <td className="px-4 py-2 text-xs text-neutral-500">
                        {timeago(b.created_at)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{name}</div>
                        <div className="text-xs text-neutral-500">
                          {[b.user_email, b.user_phone].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {b.price == null ? (
                          <span className="text-neutral-400">—</span>
                        ) : (
                          money(b.price)
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {dealId ? (
                          <Link
                            href={`/deals/${dealId}`}
                            className="text-blue-700 hover:underline"
                          >
                            {listing?.full_address ?? "(view)"}
                          </Link>
                        ) : (
                          <span>{listing?.full_address ?? "—"}</span>
                        )}
                        <div className="text-xs text-neutral-500">
                          {[listing?.us_state, listing?.county].filter(Boolean).join(" · ")}
                          {!dealId && listing && (
                            <span className="ml-2 text-neutral-400">· not tracked</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Deals</h2>
          <div className="flex items-center gap-2">
            <Link
              href="/deals/new"
              className="rounded-md border px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              + Add Deal
            </Link>
            <AddInterestModal />
          </div>
        </div>

        {dealsErr && (
          <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Failed to load deals: {dealsErr.message}
          </div>
        )}

        {rows.length === 0 && !dealsErr && (
          <div className="rounded border bg-white px-4 py-6 text-sm text-neutral-500">
            No deals yet. Click <span className="font-medium">+ Add Deal</span> to start tracking one.
          </div>
        )}

        {rows.length > 0 && (
          <div className="overflow-hidden rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead className="border-b bg-neutral-100 text-left text-xs uppercase tracking-wide text-neutral-600">
                <tr>
                  <th className="px-4 py-2">Address</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Dispo rep</th>
                  <th className="px-3 py-2 text-right">Ask</th>
                  <th className="px-3 py-2 text-right">ARV</th>
                  <th className="px-3 py-2 text-right">Rehab</th>
                  <th className="px-3 py-2 text-right">PIPP</th>
                  <th className="px-3 py-2 text-right">Spread</th>
                  <th className="px-3 py-2 text-right">Bids</th>
                  <th className="px-3 py-2">Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.deal_id} className="border-b last:border-0 hover:bg-neutral-50">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/deals/${d.deal_id}`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {d.full_address ?? "—"}
                      </Link>
                      <div className="text-xs text-neutral-500">
                        {d.seller_company ||
                          [d.seller_first_name, d.seller_last_name].filter(Boolean).join(" ") ||
                          "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs">{statusLabel(d.status)}</td>
                    <td className="px-3 py-2.5 text-xs">
                      <AssignDispoRep
                        dealId={d.deal_id}
                        currentId={d.dispo_rep_id}
                        currentName={d.dispo_rep_name}
                        currentEmail={d.dispo_rep_email}
                        compact
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right">{money(d.ask_price)}</td>
                    <td
                      className={
                        "px-3 py-2.5 text-right " +
                        (d.arv_source === "wholesaler" ? "text-red-700" : "")
                      }
                      title={d.arv_source === "wholesaler" ? "Wholesaler-reported (no calc)" : undefined}
                    >
                      {money(d.arv_used)}
                    </td>
                    <td
                      className={
                        "px-3 py-2.5 text-right " +
                        (d.rehab_source === "wholesaler" ? "text-red-700" : "")
                      }
                      title={d.rehab_source === "wholesaler" ? "Wholesaler-reported (no calc)" : undefined}
                    >
                      {money(d.rehab_used)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium">{money(d.pipp)}</td>
                    <td
                      className={
                        "px-3 py-2.5 text-right font-medium " +
                        (d.predicted_spread == null
                          ? "text-neutral-400"
                          : d.predicted_spread >= 0
                            ? "text-green-700"
                            : "text-red-700")
                      }
                    >
                      {money(d.predicted_spread)}
                    </td>
                    <td className="px-3 py-2.5 text-right">{d.bid_count}</td>
                    <td className="px-3 py-2.5 text-xs text-neutral-500">
                      {timeago(d.deal_updated_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
