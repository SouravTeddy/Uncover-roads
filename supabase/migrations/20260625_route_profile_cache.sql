CREATE TABLE IF NOT EXISTS route_profile_cache (
  corridor_key      text PRIMARY KEY,
  distance_km       numeric,
  duration_min      integer,
  elevation_gain_m  integer,
  elevation_loss_m  integer,
  peak_elevation_m  integer,
  road_character    numeric,        -- 0 = all motorway, 1 = all scenic/rural
  sample_elevations jsonb,          -- list[int] for sparkline
  fetched_at        timestamptz NOT NULL DEFAULT now()
);
