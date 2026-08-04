-- patch_place_photo_ref does `WHERE places @> jsonb_build_array(...)` on every
-- call (fired from a background thread per photo resolved). With no index,
-- this does a full sequential scan across all rows and their JSON arrays,
-- causing timeouts under real concurrency and starving backend resources
-- enough to collaterally break unrelated endpoints.
create index if not exists map_data_cache_places_gin_idx
  on map_data_cache
  using gin (places jsonb_path_ops);
