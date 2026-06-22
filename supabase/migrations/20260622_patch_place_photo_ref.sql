-- RPC: patch a single place's photo_ref inside the map_data_cache places JSON array.
-- Called by the backend after /place-image resolves a Google photo for a place
-- that had no photo_ref at tile-build time (OSM fallback or Google Nearby miss).
create or replace function patch_place_photo_ref(p_place_id text, p_photo_ref text)
returns void language plpgsql security definer as $$
begin
  update map_data_cache
  set places = (
    select jsonb_agg(
      case when elem->>'id' = p_place_id
        then jsonb_set(elem::jsonb, '{photo_ref}', to_jsonb(p_photo_ref))
        else elem
      end
    )
    from jsonb_array_elements(places::jsonb) as elem
  )
  where places::jsonb @> jsonb_build_array(jsonb_build_object('id', p_place_id));
end;
$$;
