-- Add image_url column to city_whitelist for storing Unsplash photo URLs.
-- Populated by city/photo_seeder.py (background job, no AI credits required).
alter table city_whitelist
  add column if not exists image_url text;
