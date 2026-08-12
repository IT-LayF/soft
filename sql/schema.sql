create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  login text not null unique,
  password_hash text not null,
  nickname text not null,
  role text not null default 'user' check (role in ('user','admin')),
  blocked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists licenses (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null unique,
  key_cipher text,
  key_hint text not null,
  duration_days integer,
  user_id uuid references users(id) on delete set null,
  activated_at timestamptz,
  expires_at timestamptz,
  hwid_hash text,
  max_activations integer not null default 1,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists releases (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('mod','launcher')),
  version text not null,
  filename text not null,
  sha256 text not null,
  size_bytes bigint not null,
  chunk_count integer not null,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  unique(kind, version)
);

create table if not exists release_chunks (
  release_id uuid references releases(id) on delete cascade,
  chunk_index integer not null,
  data bytea not null,
  primary key(release_id, chunk_index)
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  plan text not null,
  amount integer not null,
  status text not null default 'pending',
  provider_id text unique,
  license_id uuid references licenses(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table orders add column if not exists license_id uuid references licenses(id) on delete set null;
alter table licenses add column if not exists max_activations integer not null default 1;

create table if not exists license_activations (
  license_id uuid not null references licenses(id) on delete cascade,
  hwid_hash text not null,
  activated_at timestamptz not null default now(),
  primary key(license_id, hwid_hash)
);

create table if not exists free_key_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  claim_date date not null default current_date,
  daily_slot integer check (daily_slot between 1 and 3),
  license_id uuid references licenses(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(user_id, claim_date)
);

alter table free_key_claims add column if not exists daily_slot integer check (daily_slot between 1 and 3);
create unique index if not exists free_key_daily_slot on free_key_claims(claim_date,daily_slot) where daily_slot is not null;

create table if not exists telemetry_sessions (
  user_id uuid primary key references users(id) on delete cascade,
  nickname text not null,
  server_address text not null,
  last_seen timestamptz not null default now()
);

create table if not exists download_events (
  id bigserial primary key,
  kind text not null,
  created_at timestamptz not null default now()
);

create table if not exists pvp_clips (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'PvP moment',
  player_name text,
  server_address text,
  telegram_file_id text,
  telegram_message_id bigint,
  video_url text,
  youtube_url text,
  status text not null default 'pending' check (status in ('pending','public','rejected')),
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists pvp_clips_status_created on pvp_clips(status, created_at desc);
create index if not exists pvp_clips_telegram_message on pvp_clips(telegram_message_id);
