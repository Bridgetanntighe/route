-- Legacy bootstrap schema (kept for reference).
-- For existing projects, run the non-destructive migration instead:
--   migrations/001_secure_auth_and_places.sql
--
-- Do not re-run the anonymous open policies below on production.

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

create table if not exists public.outreach_places (
  id text primary key,
  name text not null,
  address text not null default '',
  type text not null default '',
  phone text not null default '',
  warm_seed boolean not null default false,
  area text not null default 'covent-garden',
  cluster text not null default 'added-nearby',
  route_order integer not null default 999,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.outreach_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.outreach_visits enable row level security;
alter table public.outreach_places enable row level security;
alter table public.outreach_members enable row level security;

-- New installs should use member-only policies from
-- migrations/001_secure_auth_and_places.sql — never anonymous open access.
