create table if not exists reco_interactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users on delete cascade,
  reco_id       text not null,
  dimension     text not null,
  archetype     text not null,
  action        text not null,
  conflict_present boolean not null default false,
  significance  float not null default 0,
  signal_snapshot jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists reco_interactions_user_created_idx on reco_interactions (user_id, created_at desc);
create index if not exists reco_interactions_arch_dim_idx on reco_interactions (archetype, dimension, action);
