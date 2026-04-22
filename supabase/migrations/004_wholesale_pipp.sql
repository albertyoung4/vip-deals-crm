-- VIP Deals CRM: wire Savvy/Picket ML estimates + keep original county-tier PIPP.
-- No table renames. Adds ext_wholesale_listing, adds override cols to deal,
-- redirects deal.listing_id FK, rewrites predicted_investor_price + dashboard view.

set search_path to crm, public;

-- ── New table: wholesale listings from mini_ingestor ───────────────────────
-- id = normalized_listing_sale.id = mailbox_listing.listing_id (shared UUIDv7).

create table if not exists ext_wholesale_listing (
  id uuid primary key,
  full_address text,
  us_state text,
  county text,
  list_price numeric,
  listing_state text,
  listing_state_group text,
  version_created_at timestamptz,

  -- Savvy / Picket ML estimates (primary for PIPP math)
  savvy_arv numeric,
  savvy_reno numeric,
  savvy_rent numeric,
  condition_score text,

  -- Wholesaler self-report (also shown in UI, used as last-resort fallback)
  wholesaler_arv numeric,
  wholesaler_reno numeric,
  wholesaler_rent numeric,

  -- Wholesaler contact info denormalized from picket.mailbox_listing via listing_id
  attom_id bigint,
  seller_company text,
  seller_first_name text,
  seller_last_name text,
  seller_email text,
  seller_phone text,

  synced_at timestamptz not null default now()
);

create index if not exists ewl_state_county_idx on ext_wholesale_listing (us_state, county);
create index if not exists ewl_state_group_idx  on ext_wholesale_listing (listing_state_group);
create index if not exists ewl_attom_idx        on ext_wholesale_listing (attom_id);

-- ── Deal: override columns + retarget listing_id FK ────────────────────────

alter table deal add column if not exists override_arv numeric;
alter table deal add column if not exists override_rehab numeric;

-- Drop old views + function + refresh RPC BEFORE dropping their dependencies.
drop view if exists v_deal_dashboard;
drop view if exists v_deal_interest;
drop function if exists predicted_investor_price(bigint, numeric, numeric);
drop function if exists refresh_all_predicted_prices();

-- Drop the old FK to ext_mailbox_listing and retarget to ext_wholesale_listing.
-- (Safe: no deal rows exist yet, and the column stays as uuid.)
alter table deal drop constraint if exists deal_listing_id_fkey;
alter table deal
  add constraint deal_listing_id_fkey
  foreign key (listing_id) references ext_wholesale_listing(id) on delete cascade;

-- The cached column on deal is no longer needed — we compute everything in the view.
alter table deal drop column if exists predicted_investor_price;

-- ── Rebuild v_deal_dashboard with full waterfall + PIPP ────────────────────
-- Surfaces both wholesaler-reported and calculated ARV/rehab side-by-side,
-- plus the chosen values, sources, and predicted spread vs ask price.

create or replace view v_deal_dashboard as
with base as (
  select
    d.id                as deal_id,
    d.status,
    d.marketplace_url,
    d.dropbox_url,
    d.override_arv,
    d.override_rehab,
    d.created_at        as deal_created_at,
    d.updated_at        as deal_updated_at,

    wl.id               as listing_id,
    wl.full_address,
    wl.us_state,
    wl.county,
    wl.list_price       as ask_price,
    wl.listing_state,
    wl.listing_state_group,
    wl.version_created_at as listing_created_at,

    wl.savvy_arv        as calc_arv,
    wl.savvy_reno       as calc_rehab,
    wl.savvy_rent       as calc_rent,
    wl.condition_score,

    wl.wholesaler_arv,
    wl.wholesaler_reno  as wholesaler_rehab,
    wl.wholesaler_rent,

    wl.attom_id,
    wl.seller_company,
    wl.seller_first_name,
    wl.seller_last_name,
    wl.seller_email,
    wl.seller_phone,

    mc.county_tier::int as county_tier
  from deal d
  join ext_wholesale_listing wl on wl.id = d.listing_id
  left join ext_market_county mc
    on mc.county_state = wl.us_state
   and mc.county = wl.county
),
chosen as (
  select
    base.*,
    coalesce(override_arv, calc_arv, wholesaler_arv)       as arv_used,
    case
      when override_arv    is not null then 'override'
      when calc_arv        is not null then 'calc'
      when wholesaler_arv  is not null then 'wholesaler'
      else null
    end                                                     as arv_source,
    coalesce(override_rehab, calc_rehab, wholesaler_rehab) as rehab_used,
    case
      when override_rehab    is not null then 'override'
      when calc_rehab        is not null then 'calc'
      when wholesaler_rehab  is not null then 'wholesaler'
      else null
    end                                                     as rehab_source
  from base
),
weights as (
  select
    chosen.*,
    -- County weight from tier 1-14, default 0 when no match
    case county_tier
      when 1  then -0.15 when 2  then -0.13 when 3  then -0.13
      when 4  then -0.11 when 5  then -0.06 when 6  then -0.03
      when 7  then -0.03 when 8  then -0.02 when 9  then  0.00
      when 10 then  0.00 when 11 then  0.04 when 12 then  0.05
      when 13 then  0.08 when 14 then  0.12
      else 0
    end::numeric as county_weight,
    -- Reno ratio on the chosen numbers
    case
      when arv_used is null or arv_used = 0 then null
      else coalesce(rehab_used, 0) / arv_used
    end::numeric as reno_ratio
  from chosen
),
weights2 as (
  select
    weights.*,
    case
      when reno_ratio is null then 0
      when reno_ratio >= 0 and reno_ratio < 0.20 then 0.02
      else 0.00
    end::numeric as reno_weight
  from weights
),
final as (
  select
    weights2.*,
    (0.70 + county_weight + reno_weight)                          as pred_inv_pct,
    case
      when arv_used is null or arv_used = 0 then null
      else round(((0.70 + county_weight + reno_weight) * arv_used
                   - coalesce(rehab_used, 0))::numeric, 0)
    end as pipp
  from weights2
)
select
  final.*,
  -- predicted spread vs ASK price (replacing original acquisition_price term)
  case
    when pipp is null or ask_price is null then null
    else pipp - ask_price
  end as predicted_spread,

  -- aggregates for the dashboard row
  coalesce(bid_stats.bid_count, 0)       as bid_count,
  bid_stats.max_bid,
  bid_stats.latest_bid_at,

  coalesce(int_stats.interest_count, 0)  as interest_count,
  int_stats.last_interest_at,

  coalesce(note_stats.note_count, 0)     as note_count,
  note_stats.last_note_at
from final
left join lateral (
  select count(*) as bid_count, max(price) as max_bid, max(created_at) as latest_bid_at
  from ext_bid b
  where b.listing_id = final.listing_id
    and not (b.user_first_name = 'Jimmy' and b.user_last_name = 'Quigg')
) bid_stats on true
left join lateral (
  select count(*) as interest_count, max(created_at) as last_interest_at
  from interest i where i.deal_id = final.deal_id
) int_stats on true
left join lateral (
  select count(*) as note_count, max(created_at) as last_note_at
  from note n where n.deal_id = final.deal_id
) note_stats on true;

-- ── Rebuild v_deal_interest to use the new listing_id key ──────────────────
-- ext_bid.listing_id will now be the wholesale UUIDv7 (sync rewrite handles that).

create or replace view v_deal_interest as
select
  b.id,
  d.id as deal_id,
  b.user_id as investor_user_id,
  coalesce(
    nullif(trim(coalesce(b.user_first_name, '') || ' ' || coalesce(b.user_last_name, '')), ''),
    b.user_email
  ) as investor_name,
  b.user_email as investor_email,
  b.user_phone as investor_phone,
  'bid'::interest_source as source,
  b.price as bid_price,
  b.id as bid_id,
  null::text as notes,
  null::uuid as created_by,
  b.created_at
from ext_bid b
join deal d on d.listing_id = b.listing_id
where not (b.user_first_name = 'Jimmy' and b.user_last_name = 'Quigg')

union all

select
  i.id,
  i.deal_id,
  i.investor_user_id,
  i.investor_name,
  i.investor_email,
  i.investor_phone,
  i.source,
  i.bid_price,
  i.bid_id,
  i.notes,
  i.created_by,
  i.created_at
from interest i
where i.source <> 'bid';
