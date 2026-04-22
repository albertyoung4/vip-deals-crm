-- Fix: normalized_house.county is UPPERCASE ("DAVIDSON"), dbo.market_county
-- is title case ("Davidson"), so the join was missing every county.
-- Update v_deal_dashboard to use case-insensitive join on county name.

set search_path to crm, public;

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
   and lower(mc.county) = lower(wl.county)      -- case-insensitive fix
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
    case county_tier
      when 1  then -0.15 when 2  then -0.13 when 3  then -0.13
      when 4  then -0.11 when 5  then -0.06 when 6  then -0.03
      when 7  then -0.03 when 8  then -0.02 when 9  then  0.00
      when 10 then  0.00 when 11 then  0.04 when 12 then  0.05
      when 13 then  0.08 when 14 then  0.12
      else 0
    end::numeric as county_weight,
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
    (0.70 + county_weight + reno_weight) as pred_inv_pct,
    case
      when arv_used is null or arv_used = 0 then null
      else round(((0.70 + county_weight + reno_weight) * arv_used
                   - coalesce(rehab_used, 0))::numeric, 0)
    end as pipp
  from weights2
)
select
  final.*,
  case
    when pipp is null or ask_price is null then null
    else pipp - ask_price
  end as predicted_spread,

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
