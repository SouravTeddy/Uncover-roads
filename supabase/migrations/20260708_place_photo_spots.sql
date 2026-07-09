-- supabase/migrations/20260708_place_photo_spots.sql

create table if not exists place_photo_spots (
  id           bigserial   primary key,
  place_id     text        not null,
  city_id      text        not null,
  description  text        not null,
  timing       text,
  source       text        not null,
  source_url   text,
  confidence   float       not null default 0.5,
  updated_at   timestamptz not null default now(),
  unique (place_id, source)
);

create index if not exists place_photo_spots_place_id_idx on place_photo_spots (place_id);
create index if not exists place_photo_spots_city_id_idx  on place_photo_spots (city_id);

-- No RLS needed: read-only by authenticated users, written only by server-side seeder jobs.
-- Backend uses service role key which bypasses RLS.
