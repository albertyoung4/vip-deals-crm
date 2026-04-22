-- VIP Deals CRM: views and functions
set search_path to crm, public;

-- ── Predicted investor price ────────────────────────────────────────────────
-- Port of the prospect_contract predicted-price SQL, adapted for wholesale
-- listings where all we know up front is attom_id + ARV + rehab.
-- Formula: predicted_inv_pct = 0.70 + county_tier_points + reno_points
--          predicted_investor_price = predicted_inv_pct * arv - rehab

create or replace function predicted_investor_price(
  p_attom_id bigint,
  p_arv numeric,
  p_rehab numeric
) returns numeric language sql stable as $$
  with params as (
    select 0.70::numeric as base_pct
  ),
  loc as (
    select situs_state_code, situs_county
    from ext_property_registry
    where attom_id = p_attom_id
    limit 1
  ),
  tier as (
    select mc.county_tier
    from loc
    left join ext_market_county mc
      on mc.county_state = loc.situs_state_code
     and mc.county = loc.situs_county
  ),
  county_pts as (
    select coalesce(
      case t.county_tier
        when 1  then -0.15 when 2  then -0.13 when 3  then -0.13
        when 4  then -0.11 when 5  then -0.06 when 6  then -0.03
        when 7  then -0.03 when 8  then -0.02 when 9  then  0.00
        when 10 then  0.00 when 11 then  0.04 when 12 then  0.05
        when 13 then  0.08 when 14 then  0.12
      end, 0)::numeric as pts
    from tier t
  ),
  reno_pts as (
    select case
      when p_arv is null or p_arv = 0 then 0::numeric
      when p_rehab is null then 0::numeric
      when p_rehab / p_arv >= 0 and p_rehab / p_arv < 0.20 then 0.02
      else 0.00
    end as pts
  )
  select case
    when p_arv is null or p_arv = 0 then null
    else round(
      ((p.base_pct + coalesce(cp.pts, 0) + rp.pts) * p_arv - coalesce(p_rehab, 0))::numeric,
      0
    )
  end
  from params p, county_pts cp, reno_pts rp;
$$;

-- ── Marketplace URL generator ──────────────────────────────────────────────
-- Produces URLs like https://m.rebuilt.com/houses/1843-25th-Ave-N_Nashville_TN-37208

create or replace function marketplace_url(
  p_street text,
  p_city text,
  p_state text,
  p_zip text
) returns text language sql immutable as $$
  select case
    when p_street is null or p_city is null or p_state is null or p_zip is null then null
    else 'https://m.rebuilt.com/houses/'
      || regexp_replace(trim(p_street), '\s+', '-', 'g') || '_'
      || regexp_replace(trim(p_city),   '\s+', '-', 'g') || '_'
      || trim(p_state) || '-' || trim(p_zip)
  end;
$$;

-- ── Dashboard view: one row per deal, joined with listing + bid aggregates ─

create or replace view v_deal_dashboard as
select
  d.id as deal_id,
  d.status,
  d.marketplace_url,
  d.dropbox_url,
  d.predicted_investor_price,
  d.created_at as deal_created_at,
  d.updated_at as deal_updated_at,

  ml.id as listing_id,
  ml.full_address,
  ml.list_price as ask_price,
  ml.user_arv_estimate as arv,
  ml.user_renovation_estimate as rehab,
  ml.user_rent_estimate as rent_estimate,
  ml.attom_id,
  ml.status as listing_status,
  ml.seller_company,
  ml.seller_first_name,
  ml.seller_last_name,
  ml.seller_email,
  ml.seller_phone,

  coalesce(bid_stats.bid_count, 0) as bid_count,
  bid_stats.max_bid,
  bid_stats.latest_bid_at,

  coalesce(int_stats.interest_count, 0) as interest_count,
  int_stats.last_interest_at,

  coalesce(note_stats.note_count, 0) as note_count,
  note_stats.last_note_at
from deal d
join ext_mailbox_listing ml on ml.id = d.listing_id
left join lateral (
  select count(*) as bid_count,
         max(price) as max_bid,
         max(created_at) as latest_bid_at
  from ext_bid b
  where b.listing_id = ml.id
    and not (b.user_first_name = 'Jimmy' and b.user_last_name = 'Quigg')
) bid_stats on true
left join lateral (
  select count(*) as interest_count, max(created_at) as last_interest_at
  from interest i where i.deal_id = d.id
) int_stats on true
left join lateral (
  select count(*) as note_count, max(created_at) as last_note_at
  from note n where n.deal_id = d.id
) note_stats on true;

-- ── Unified interest view: bids + manual interest in one list ──────────────

create or replace view v_deal_interest as
-- Bids auto-flow through as interest rows
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

-- Manual interest entries
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

-- ── Activity summary view (for the dashboard landing page) ─────────────────

create or replace view v_activity_summary as
select
  (select count(*) from deal)                                            as total_deals,
  (select count(*) from deal where status not in ('closed'))             as active_deals,
  (select count(*) from ext_bid where created_at > now() - interval '7 days'
     and not (user_first_name = 'Jimmy' and user_last_name = 'Quigg'))    as bids_last_7d,
  (select count(*) from ext_bid where created_at > now() - interval '30 days'
     and not (user_first_name = 'Jimmy' and user_last_name = 'Quigg'))    as bids_last_30d,
  (select count(distinct user_id) from ext_bid
     where not (user_first_name = 'Jimmy' and user_last_name = 'Quigg'))  as unique_bidders_all_time,
  (select count(distinct user_id) from ext_bid
     where created_at > now() - interval '30 days'
     and not (user_first_name = 'Jimmy' and user_last_name = 'Quigg'))    as unique_bidders_30d,
  (select count(*) from note where created_at > now() - interval '7 days') as notes_last_7d;

-- ── RPC: refresh predicted_investor_price for every deal ──────────────────
-- Called by the sync job after listing/property_registry/market_county refresh.
-- Returns the number of rows updated.

create or replace function refresh_all_predicted_prices() returns integer
language plpgsql as $$
declare
  updated_count integer;
begin
  update deal d
     set predicted_investor_price = predicted_investor_price(
       ml.attom_id, ml.user_arv_estimate, ml.user_renovation_estimate
     )
    from ext_mailbox_listing ml
   where ml.id = d.listing_id;
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

-- ── Top VIP investors view ─────────────────────────────────────────────────

create or replace view v_vip_investors as
with all_touches as (
  select user_id as investor_user_id, user_email as email,
         coalesce(nullif(trim(user_first_name || ' ' || user_last_name), ''), user_email) as name,
         price, created_at
  from ext_bid
  where not (user_first_name = 'Jimmy' and user_last_name = 'Quigg')
  union all
  select investor_user_id, investor_email as email, investor_name as name,
         bid_price as price, created_at
  from interest
)
select
  investor_user_id,
  email,
  max(name) as name,
  count(*) as touch_count,
  max(created_at) as last_touch_at,
  max(price) as max_bid
from all_touches
where investor_user_id is not null or email is not null
group by investor_user_id, email
order by touch_count desc, last_touch_at desc;
