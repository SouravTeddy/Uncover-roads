ALTER TABLE route_profile_cache
  ADD COLUMN IF NOT EXISTS character_scores   jsonb,
  ADD COLUMN IF NOT EXISTS top_character      text,
  ADD COLUMN IF NOT EXISTS path_names         jsonb,
  ADD COLUMN IF NOT EXISTS landmark_peeks     jsonb,
  ADD COLUMN IF NOT EXISTS route_type         text,
  ADD COLUMN IF NOT EXISTS route_computed_at  timestamptz;

-- Drop scenic_score if it exists from an old column (no longer used)
ALTER TABLE route_profile_cache
  DROP COLUMN IF EXISTS scenic_score;
