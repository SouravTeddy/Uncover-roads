-- Add real walking distance and duration to transit_corridor_cache.
-- Existing rows will have NULL values; cache reads check for NULL walk_distance_m
-- and trigger a refetch so data gets populated on next request.
ALTER TABLE transit_corridor_cache
  ADD COLUMN IF NOT EXISTS walk_distance_m integer,
  ADD COLUMN IF NOT EXISTS walk_duration_min integer;
