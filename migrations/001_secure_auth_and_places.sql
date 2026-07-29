-- Safe, non-destructive migration for Covent Garden Catering outreach tracker
-- Run in Supabase → SQL Editor after reviewing.
-- Preserves all existing outreach_visits and outreach_places rows.
-- Project: https://athqfnbwchxvtozrqfcj.supabase.co

-- ---------------------------------------------------------------------------
-- 1) Custom places: add area / cluster / route_order / updated_at
-- ---------------------------------------------------------------------------
alter table public.outreach_places
  add column if not exists area text not null default 'covent-garden';

alter table public.outreach_places
  add column if not exists cluster text not null default 'added-nearby';

alter table public.outreach_places
  add column if not exists route_order integer not null default 999;

alter table public.outreach_places
  add column if not exists updated_at timestamptz not null default now();

-- Backfill any null-ish legacy values (defaults already cover new columns)
update public.outreach_places
set area = coalesce(nullif(trim(area), ''), 'covent-garden')
where area is null or trim(area) = '';

update public.outreach_places
set cluster = coalesce(nullif(trim(cluster), ''), 'added-nearby')
where cluster is null or trim(cluster) = '';

-- Normalize known legacy area id
update public.outreach_places
set area = 'st-pauls-cheapside'
where area = 'st-pauls';

-- ---------------------------------------------------------------------------
-- 2) Visits: ensure updated_at exists and is populated
-- ---------------------------------------------------------------------------
alter table public.outreach_visits
  add column if not exists updated_at timestamptz not null default now();

alter table public.outreach_visits
  add column if not exists linkedin text not null default '';

update public.outreach_visits
set updated_at = coalesce(updated_at, saved_at, now())
where updated_at is null;

-- ---------------------------------------------------------------------------
-- 3) Authorised team members (managed in Supabase, not in public JS)
-- ---------------------------------------------------------------------------
create table if not exists public.outreach_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.outreach_members enable row level security;

-- Members can see their own membership row (needed for client gate checks)
drop policy if exists "members_read_self" on public.outreach_members;
create policy "members_read_self"
  on public.outreach_members
  for select
  to authenticated
  using (user_id = auth.uid());

-- No insert/update/delete from the client — add members in the SQL editor:
--   insert into public.outreach_members (user_id, email)
--   select id, email from auth.users where email = 'name@example.com';

grant select on public.outreach_members to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Replace anonymous open policies with member-only access
-- ---------------------------------------------------------------------------
drop policy if exists "anon_all_visits" on public.outreach_visits;
drop policy if exists "anon_all_places" on public.outreach_places;
drop policy if exists "members_all_visits" on public.outreach_visits;
drop policy if exists "members_all_places" on public.outreach_places;

create policy "members_all_visits"
  on public.outreach_visits
  for all
  to authenticated
  using (
    exists (
      select 1 from public.outreach_members m where m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.outreach_members m where m.user_id = auth.uid()
    )
  );

create policy "members_all_places"
  on public.outreach_places
  for all
  to authenticated
  using (
    exists (
      select 1 from public.outreach_members m where m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.outreach_members m where m.user_id = auth.uid()
    )
  );

-- Revoke anonymous table privileges (policies alone are not enough)
revoke all on public.outreach_visits from anon;
revoke all on public.outreach_places from anon;
revoke all on public.outreach_members from anon;

grant select, insert, update, delete on public.outreach_visits to authenticated;
grant select, insert, update, delete on public.outreach_places to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Helper note (does not modify data)
-- After running this migration:
--   1. Enable Email OTP / magic link in Supabase Auth.
--   2. Insert authorised users into outreach_members (see above).
--   3. Deploy the app version that requires a signed-in member for cloud sync.
-- Until members sign in, the app stores data on-device only.
-- ---------------------------------------------------------------------------
