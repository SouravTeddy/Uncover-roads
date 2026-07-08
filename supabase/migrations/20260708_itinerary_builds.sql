-- supabase/migrations/20260708_itinerary_builds.sql

create table if not exists itinerary_builds (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  status      text        not null default 'pending'
                          check (status in ('pending', 'running', 'done', 'failed')),
  city        text        not null,
  result      jsonb,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists itinerary_builds_user_status
  on itinerary_builds(user_id, status);
create index if not exists itinerary_builds_user_created
  on itinerary_builds(user_id, created_at desc);

alter table itinerary_builds enable row level security;

create policy "users manage own builds"
  on itinerary_builds for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
