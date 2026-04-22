-- Auto-create a deal row whenever a bid lands on a listing we aren't
-- already tracking. Fires on ext_bid insert (new bid synced from prod)
-- and only inserts when the listing exists in ext_wholesale_listing and
-- no deal row exists for it yet.

set search_path to crm, public;

create or replace function autotrack_listing_on_bid()
returns trigger
language plpgsql
as $$
begin
  if new.listing_id is null then return new; end if;

  -- Skip the Jimmy Quigg test account (same filter used elsewhere)
  if new.user_first_name = 'Jimmy' and new.user_last_name = 'Quigg' then
    return new;
  end if;

  insert into deal (listing_id, status)
  select new.listing_id, 'contacted_no_response'
  where exists (select 1 from ext_wholesale_listing wl where wl.id = new.listing_id)
    and not exists (select 1 from deal d where d.listing_id = new.listing_id)
  on conflict (listing_id) do nothing;

  return new;
end;
$$;

drop trigger if exists ext_bid_autotrack on ext_bid;
create trigger ext_bid_autotrack
  after insert on ext_bid
  for each row
  execute function autotrack_listing_on_bid();

-- Backfill: create deals for every listing that already has a bid but no deal yet.
insert into deal (listing_id, status)
select distinct b.listing_id, 'contacted_no_response'
from ext_bid b
join ext_wholesale_listing wl on wl.id = b.listing_id
where b.listing_id is not null
  and not (b.user_first_name = 'Jimmy' and b.user_last_name = 'Quigg')
  and not exists (select 1 from deal d where d.listing_id = b.listing_id)
on conflict (listing_id) do nothing;
