-- map_data_cache: parsed places by ~5km tile key (Google Places or Overpass)
create table if not exists map_data_cache (
  tile_key   text primary key,
  places     jsonb not null default '[]'::jsonb,
  fetched_at timestamptz not null default now()
);

create index if not exists map_data_cache_fetched_at_idx on map_data_cache (fetched_at);

-- overpass_cache: raw Overpass API results keyed by SHA-256 of the query string.
-- Shared across all backend endpoints that call fetch_overpass().
create table if not exists overpass_cache (
  query_hash text primary key,
  result     jsonb not null,
  fetched_at timestamptz not null default now()
);

create index if not exists overpass_cache_fetched_at_idx on overpass_cache (fetched_at);

-- RLS: service role only (no public access — these are internal cache tables)
alter table map_data_cache enable row level security;
alter table overpass_cache  enable row level security;
