import { supabaseAdmin } from "@/lib/supabase";
import { timeago } from "@/lib/format";

// Read the most recent synced_at across the ext_ tables that the sync job
// writes to. Whichever is newest tells us when the last sync finished.
export default async function LastSyncBadge() {
  const sb = supabaseAdmin();

  const tables = [
    "ext_bid",
    "ext_wholesale_listing",
    "ext_mktplace_user",
    "ext_mailbox_listing",
  ] as const;

  const results = await Promise.all(
    tables.map((t) =>
      sb.from(t).select("synced_at").order("synced_at", { ascending: false }).limit(1).maybeSingle(),
    ),
  );

  const latest = results
    .map((r) => (r.data as { synced_at?: string } | null)?.synced_at)
    .filter((v): v is string => !!v)
    .sort()
    .pop();

  const isStale = latest ? Date.now() - new Date(latest).getTime() > 60 * 60_000 : true;

  return (
    <span
      title={latest ? `Last sync: ${new Date(latest).toLocaleString()}` : "No sync recorded"}
      className={
        "rounded-md border px-2 py-1 text-xs " +
        (isStale
          ? "border-amber-300 bg-amber-50 text-amber-800"
          : "border-neutral-200 bg-neutral-50 text-neutral-600")
      }
    >
      Synced {timeago(latest)}
    </span>
  );
}
