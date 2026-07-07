ALTER TABLE transit_corridor_cache
  ADD COLUMN IF NOT EXISTS walk_route_points jsonb;
