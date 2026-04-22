-- Grant the crm schema to all Supabase PostgREST roles.
-- Required because Supabase only auto-grants on `public` by default.
-- service_role is what the sync job + Next.js server-side use; authenticated
-- is what end-user sessions will use; anon is for pre-login.

grant usage on schema crm to postgres, anon, authenticated, service_role;

grant all on all tables    in schema crm to postgres, anon, authenticated, service_role;
grant all on all sequences in schema crm to postgres, anon, authenticated, service_role;
grant all on all functions in schema crm to postgres, anon, authenticated, service_role;
grant all on all routines  in schema crm to postgres, anon, authenticated, service_role;

alter default privileges in schema crm grant all on tables    to postgres, anon, authenticated, service_role;
alter default privileges in schema crm grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges in schema crm grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema crm grant all on routines  to postgres, anon, authenticated, service_role;
