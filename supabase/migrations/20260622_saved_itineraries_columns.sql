-- Add missing columns to saved_itineraries that were never persisted to the DB
-- despite being read by loadSavedItineraries and written by the app's save flow.
ALTER TABLE saved_itineraries
  ADD COLUMN IF NOT EXISTS trip_details      jsonb,
  ADD COLUMN IF NOT EXISTS travel_date       text,
  ADD COLUMN IF NOT EXISTS city_lat          double precision,
  ADD COLUMN IF NOT EXISTS city_lon          double precision,
  ADD COLUMN IF NOT EXISTS selected_places   jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS journey_legs      jsonb;
