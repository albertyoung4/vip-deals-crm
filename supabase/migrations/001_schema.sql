-- VIP Deals CRM: schema
-- Run in Supabase SQL editor, or via `supabase db push`.
-- Sharing project xpvvgecwajqmveuuhnmc with OMR (fb_deal_posts, posters, hc_property_data),
-- so everything lives in its own `crm` schema.
-- After running: add `crm` to Supabase → API Settings → Exposed Schemas.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create schema if not exists crm;
set search_path to crm, public;

-- ── Enums ──────────────────────────────────────────────────────────────────

do $$ begin
  create type deal_status as enum (
    'contacted_no_response',
    'contacted_in_discussion',
    'scheduling_walk_thru',
    'walk_thru_complete',
    'bid_accepted',
    'assignment_sent',
    'assignment_signed',
    'closed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type interest_source as enum ('bid', 'email', 'phone', 'sms', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attachment_kind as enum ('photo', 'dropbox', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_role as enum ('manager', 'dispo', 'admin');
exception when duplicate_object then null; end $$;

-- ── App users ──────────────────────────────────────────────────────────────
-- One row per CRM user. Linked to Supabase Auth on first sign-in.

create table if not exists app_user (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  google_email text unique not null,
  name text,
  role user_role not null default 'dispo',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── External / synced tables (read-only cache of rebuilt_prod) ─────────────

create table if not exists ext_mailbox_listing (
  id uuid primary key,
  full_address text,
  list_price numeric,
  user_arv_estimate numeric,
  user_renovation_estimate numeric,
  user_rent_estimate numeric,
  close_price numeric,
  close_date date,
  status text,
  created_at timestamptz,
  seller_company text,
  seller_first_name text,
  seller_last_name text,
  seller_email text,
  seller_phone text,
  attom_id bigint,
  synced_at timestamptz not null default now()
);
create index if not exists ext_mailbox_listing_attom_idx on ext_mailbox_listing (attom_id);
create index if not exists ext_mailbox_listing_created_idx on ext_mailbox_listing (created_at desc);

create table if not exists ext_bid (
  id uuid primary key,
  listing_id uuid,
  user_id uuid,
  user_email text,
  user_first_name text,
  user_last_name text,
  user_phone text,
  price numeric,
  created_at timestamptz,
  synced_at timestamptz not null default now()
);
create index if not exists ext_bid_listing_idx on ext_bid (listing_id);
create index if not exists ext_bid_email_idx on ext_bid (user_email);
create index if not exists ext_bid_created_idx on ext_bid (created_at desc);

create table if not exists ext_mktplace_user (
  id uuid primary key,
  email text,
  first_name text,
  surname text,
  phone_number text,
  normalized_full_name text,
  synced_at timestamptz not null default now()
);
create index if not exists ext_mktplace_user_email_idx on ext_mktplace_user (email);
create index if not exists ext_mktplace_user_name_trgm_idx
  on ext_mktplace_user using gin (normalized_full_name gin_trgm_ops);

create table if not exists ext_market_county (
  county_state text not null,
  county text not null,
  county_tier int,
  synced_at timestamptz not null default now(),
  primary key (county_state, county)
);

create table if not exists ext_property_registry (
  attom_id bigint primary key,
  property_address_full text,
  situs_state_code text,
  situs_county text,
  property_address_zip text,
  synced_at timestamptz not null default now()
);

-- ── CRM core tables ────────────────────────────────────────────────────────

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists deal (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid unique references ext_mailbox_listing(id) on delete cascade,
  status deal_status not null default 'contacted_no_response',
  marketplace_url text,
  dropbox_url text,
  predicted_investor_price numeric,
  created_by uuid references app_user(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists deal_status_idx on deal (status);
create index if not exists deal_updated_idx on deal (updated_at desc);

drop trigger if exists deal_touch on deal;
create trigger deal_touch before update on deal
  for each row execute function touch_updated_at();

create table if not exists interest (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deal(id) on delete cascade,
  investor_user_id uuid,
  investor_name text,
  investor_email text,
  investor_phone text,
  source interest_source not null,
  bid_price numeric,
  bid_id uuid,
  notes text,
  created_by uuid references app_user(id),
  created_at timestamptz not null default now()
);
create index if not exists interest_deal_idx on interest (deal_id);
create index if not exists interest_investor_idx on interest (investor_user_id);
create index if not exists interest_bid_idx on interest (bid_id);

create table if not exists note (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deal(id) on delete cascade,
  author_id uuid not null references app_user(id),
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists note_deal_idx on note (deal_id, created_at desc);

create table if not exists attachment (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deal(id) on delete cascade,
  kind attachment_kind not null,
  url text not null,
  label text,
  uploaded_by uuid references app_user(id),
  created_at timestamptz not null default now()
);
create index if not exists attachment_deal_idx on attachment (deal_id);
