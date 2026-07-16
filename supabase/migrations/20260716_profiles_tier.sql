-- Add tier column to profiles for server-side tier enforcement
-- Values: 'free' | 'pack' | 'pro' — defaults to free
alter table profiles
  add column if not exists tier text not null default 'free'
  check (tier in ('free', 'pack', 'pro'));

-- Add pack_trips_remaining for server-side pack balance
alter table profiles
  add column if not exists pack_trips_remaining integer not null default 0;
