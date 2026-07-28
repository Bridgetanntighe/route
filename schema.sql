-- Run this once in Supabase → SQL Editor → New query → Run
-- Project: https://athqfnbwchxvtozrqfcj.supabase.co

create table if not exists public.outreach_visits (
  venue_id text primary key,
  outcome text not null default 'not_visited',
  person text not null default '',
  role text not null default '',
  email text not null default '',
  linkedin text not null default '',
  notes text not null default '',
  warm boolean not null default false,
  follow_up boolean not null default false,
  saved_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Existing projects: add LinkedIn column if the table already exists
alter table public.outreach_visits
  add column if not exists linkedin text not null default '';

create table if not exists public.outreach_places (
  id text primary key,
  name text not null,
  address text not null default '',
  type text not null default '',
  phone text not null default '',
  warm_seed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.outreach_visits enable row level security;
alter table public.outreach_places enable row level security;

drop policy if exists "anon_all_visits" on public.outreach_visits;
create policy "anon_all_visits"
  on public.outreach_visits
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "anon_all_places" on public.outreach_places;
create policy "anon_all_places"
  on public.outreach_places
  for all
  to anon, authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.outreach_visits to anon, authenticated;
grant select, insert, update, delete on public.outreach_places to anon, authenticated;
