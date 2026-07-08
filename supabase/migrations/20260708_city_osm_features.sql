-- supabase/migrations/20260708_city_osm_features.sql

create table if not exists city_osm_features (
  city_id    text        primary key,
  elements   jsonb       not null default '[]',
  bbox_s     double precision not null,
  bbox_w     double precision not null,
  bbox_n     double precision not null,
  bbox_e     double precision not null,
  cached_at  timestamptz not null default now()
);

-- No RLS needed: read-only by all authenticated users, written only by server-side jobs.
-- Backend uses service role key which bypasses RLS.
