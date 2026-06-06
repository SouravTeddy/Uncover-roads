-- place_dynamic_profiles: discovery-stage badges for curated tab picks
-- Stage is derived from rating + rating_count via the /api/places/seed-profiles endpoint.
-- No realtime data; re-seeded whenever city is re-seeded.

create table if not exists place_dynamic_profiles (
  place_id   text primary key,
  city_id    text,
  stage      text not null default 'mainstream',  -- hidden_gem | rising | mainstream
  signals    jsonb not null default '{}'::jsonb,  -- {velocity_ratio: float, crowd_ratio: float}
  updated_at timestamptz not null default now()
);

create index if not exists place_dynamic_profiles_city_id_idx on place_dynamic_profiles (city_id);

-- Row-level security: public read, no direct writes
alter table place_dynamic_profiles enable row level security;

create policy "public read"
  on place_dynamic_profiles for select
  using (true);
