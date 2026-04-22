-- Seed dispo reps. Emails are guesses — correct any that are wrong
-- by updating google_email before the user signs in for the first time.

set search_path to crm, public;

insert into app_user (google_email, name, role, active) values
  ('scott.pennebaker@rebuilt.com', 'Scott Pennebaker', 'dispo', true),
  ('miguel.aguilar@rebuilt.com',   'Miguel Aguilar',   'dispo', true),
  ('dustin.helpburn@rebuilt.com',  'Dustin Helpburn',  'dispo', true),
  ('alec.prieto@rebuilt.com',      'Alec Prieto',      'dispo', true),
  ('maegan.grace@rebuilt.com',     'Maegan Grace',     'dispo', true)
on conflict (google_email) do update
  set name = excluded.name,
      role = excluded.role,
      active = true;

-- Al Young is already in the table as the DEV user (albert@rebuilt.com, role=admin).
-- Make sure he's active and named so the picker shows him.
update app_user
  set name = coalesce(name, 'Al Young'), active = true
  where google_email = 'albert@rebuilt.com';
