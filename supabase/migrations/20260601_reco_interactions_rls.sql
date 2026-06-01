-- Enable RLS on reco_interactions (was missing from original migration)
alter table reco_interactions enable row level security;

-- Authenticated users can insert their own interactions
create policy "users_insert_own_interactions" on reco_interactions
  for insert to authenticated
  with check (auth.uid() = user_id);

-- Authenticated users can read their own interactions
create policy "users_select_own_interactions" on reco_interactions
  for select to authenticated
  using (auth.uid() = user_id);
