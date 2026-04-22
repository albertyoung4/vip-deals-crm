import { createClient, SupabaseClient } from "@supabase/supabase-js";
import "dotenv/config";
import pg from "pg";

const {
  REBUILT_PG_HOST,
  REBUILT_PG_PORT = "5432",
  REBUILT_PG_DATABASE = "rebuilt_prod",
  REBUILT_PG_USER,
  REBUILT_PG_PASSWORD,
  REBUILT_PG_SSL = "false",

  MINI_INGESTOR_HOST,
  MINI_INGESTOR_PORT = "5432",
  MINI_INGESTOR_DATABASE = "mini_ingestor",
  MINI_INGESTOR_USER,
  MINI_INGESTOR_PASSWORD,
  MINI_INGESTOR_SSL = "false",

  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SYNC_INTERVAL_MINUTES = "15",
} = process.env;

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function makePool(prefix: string, cfg: {
  host: string | undefined; port: string; database: string | undefined;
  user: string | undefined; password: string | undefined; ssl: string;
}): pg.Pool {
  return new pg.Pool({
    host: required(`${prefix}_HOST`, cfg.host),
    port: Number(cfg.port),
    database: cfg.database,
    user: required(`${prefix}_USER`, cfg.user),
    password: required(`${prefix}_PASSWORD`, cfg.password),
    ssl: cfg.ssl === "true" ? { rejectUnauthorized: false } : false,
    max: 4,
    idleTimeoutMillis: 30_000,
  });
}

const rebuiltPool = makePool("REBUILT_PG", {
  host: REBUILT_PG_HOST, port: REBUILT_PG_PORT, database: REBUILT_PG_DATABASE,
  user: REBUILT_PG_USER, password: REBUILT_PG_PASSWORD, ssl: REBUILT_PG_SSL,
});

const miniIngestorPool = makePool("MINI_INGESTOR", {
  host: MINI_INGESTOR_HOST, port: MINI_INGESTOR_PORT, database: MINI_INGESTOR_DATABASE,
  user: MINI_INGESTOR_USER, password: MINI_INGESTOR_PASSWORD, ssl: MINI_INGESTOR_SSL,
});

const supabase: SupabaseClient = createClient(
  required("SUPABASE_URL", SUPABASE_URL),
  required("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY),
  { auth: { persistSession: false }, db: { schema: "crm" } },
);

// ── Source queries ─────────────────────────────────────────────────────────

// mini_ingestor: 3P wholesale listings + Savvy ARV/rehab.
// CTO-approved join: nhs.house_id = nls.id (not nls.house_id).
const Q_WHOLESALE_LISTING = `
  select
    nls.id::text                      as id,
    nh.full_address,
    nh.us_state,
    nh.county,
    nls.list_price::numeric           as list_price,
    nls.listing_state,
    nls.listing_state_group,
    nls.version_created_at,
    nhs.arv_estimate::numeric          as savvy_arv,
    nhs.price_renovation_picket::numeric as savvy_reno,
    nhs.price_rent_predict_ai::numeric as savvy_rent,
    nhs.condition_score::text          as condition_score,
    nullif(nhs.user_arv_estimate::text, '')::numeric        as wholesaler_arv,
    nullif(nhs.user_renovation_estimate::text, '')::numeric as wholesaler_reno,
    nullif(nhs.user_rent_estimate::text, '')::numeric       as wholesaler_rent
  from public.normalized_listing_sale nls
  join public.normalized_house nh
    on nls.house_id = nh.id
   and nls.us_state = nh.us_state
   and nh.version_is_active
  left join public.normalized_house_savvy nhs
    on nls.id = nhs.house_id
  where nls.version_is_active
    and nls.data_source_id = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
    and nls.listing_state_group = 'ACTIVE'
`;

// rebuilt_prod: wholesaler contact info + attom_id, keyed by listing_id
// (which matches nls.id / ext_wholesale_listing.id).
const Q_SELLER_INFO = `
  select
    listing_id::text               as id,
    attom_id,
    seller_info->>'company'        as seller_company,
    seller_info->>'first_name'     as seller_first_name,
    seller_info->>'last_name'      as seller_last_name,
    seller_info->>'email'          as seller_email,
    seller_info->>'phone'          as seller_phone
  from picket.mailbox_listing
  where listing_id is not null
    and seller_info is not null
`;

// rebuilt_prod: bids resolved to the wholesale listing_id (UUIDv7), not mailbox_listing.id.
const Q_BID = `
  select
    b.id::text          as id,
    ml.listing_id::text as listing_id,
    b.user_id::text     as user_id,
    u2.email            as user_email,
    u2.first_name       as user_first_name,
    u2.last_name        as user_last_name,
    u2.phone_number     as user_phone,
    b.price,
    b.created_at
  from picket.bid b
  join picket.user_listing ul on b.listing_id = ul.listing_id
  left join picket.mailbox_listing ml on ml.id = ul.property_id
  join picket.user u2 on b.user_id = u2.id
  where ml.listing_id is not null
    and ml.seller_info is not null
    and not (u2.first_name = 'Jimmy' and u2.last_name = 'Quigg')
`;

const Q_MKTPLACE_USER = `
  select id::text as id, email, first_name, surname, phone_number, normalized_full_name
  from mktplace.users
`;

const Q_MARKET_COUNTY = `
  select county_state, county, county_tier::int as county_tier
  from dbo.market_county
`;

// ── Helpers ─────────────────────────────────────────────────────────────────

async function fetchRows<T>(pool: pg.Pool, sql: string): Promise<T[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(sql);
    return res.rows as T[];
  } finally {
    client.release();
  }
}

async function upsertBatched<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
  onConflict: string,
  batchSize = 500,
): Promise<void> {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize).map((row) => ({
      ...row,
      synced_at: new Date().toISOString(),
    }));
    const { error } = await supabase
      .from(table)
      .upsert(chunk, { onConflict, ignoreDuplicates: false });
    if (error) {
      throw new Error(`upsert ${table} failed (batch ${i}): ${error.message}`);
    }
  }
}

function log(step: string, detail: string): void {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${step}: ${detail}`);
}

// ── Sync steps ──────────────────────────────────────────────────────────────

async function syncMarketCounty(): Promise<number> {
  const rows = await fetchRows<Record<string, unknown>>(rebuiltPool, Q_MARKET_COUNTY);
  await upsertBatched("ext_market_county", rows, "county_state,county");
  return rows.length;
}

async function syncWholesaleListings(): Promise<{ total: number; with_seller: number }> {
  const [listings, sellers] = await Promise.all([
    fetchRows<Record<string, unknown>>(miniIngestorPool, Q_WHOLESALE_LISTING),
    fetchRows<Record<string, unknown>>(rebuiltPool, Q_SELLER_INFO),
  ]);

  const sellerById = new Map<string, Record<string, unknown>>();
  for (const s of sellers) {
    if (typeof s.id === "string") sellerById.set(s.id, s);
  }

  let matched = 0;
  const merged = listings.map((l) => {
    const id = l.id as string;
    const s = sellerById.get(id);
    if (s) matched++;
    return {
      ...l,
      attom_id: s?.attom_id ?? null,
      seller_company: s?.seller_company ?? null,
      seller_first_name: s?.seller_first_name ?? null,
      seller_last_name: s?.seller_last_name ?? null,
      seller_email: s?.seller_email ?? null,
      seller_phone: s?.seller_phone ?? null,
    };
  });

  await upsertBatched("ext_wholesale_listing", merged, "id");
  return { total: merged.length, with_seller: matched };
}

async function syncBids(): Promise<number> {
  const rows = await fetchRows<Record<string, unknown>>(rebuiltPool, Q_BID);
  await upsertBatched("ext_bid", rows, "id");
  return rows.length;
}

async function syncMktplaceUsers(): Promise<number> {
  const rows = await fetchRows<Record<string, unknown>>(rebuiltPool, Q_MKTPLACE_USER);
  await upsertBatched("ext_mktplace_user", rows, "id");
  return rows.length;
}

// ── Orchestration ───────────────────────────────────────────────────────────

async function runOnce(): Promise<void> {
  const start = Date.now();
  log("sync", "starting");

  const countyN = await syncMarketCounty();
  log("ext_market_county", `${countyN} rows`);

  const ws = await syncWholesaleListings();
  log("ext_wholesale_listing", `${ws.total} rows (${ws.with_seller} with seller_info)`);

  const bidN = await syncBids();
  log("ext_bid", `${bidN} rows`);

  const userN = await syncMktplaceUsers();
  log("ext_mktplace_user", `${userN} rows`);

  log("sync", `done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
}

async function main(): Promise<void> {
  const once = process.argv.includes("--once");

  if (once) {
    await runOnce();
    await Promise.all([rebuiltPool.end(), miniIngestorPool.end()]);
    return;
  }

  const intervalMs = Number(SYNC_INTERVAL_MINUTES) * 60_000;
  log("sync", `running every ${SYNC_INTERVAL_MINUTES} min`);

  while (true) {
    try {
      await runOnce();
    } catch (err) {
      console.error("sync failed:", err);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
