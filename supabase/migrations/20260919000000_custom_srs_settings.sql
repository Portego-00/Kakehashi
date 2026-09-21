-- Per-account scheduling policies. Deploy before the web server and Edge Function.
BEGIN;

create function public.patch_custom_srs_state_v2(
  p_user_id text, p_expected_revision bigint, p_metadata jsonb,
  p_assignments jsonb, p_reviews jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_account public.custom_srs_accounts;
  v_revision bigint;
begin
  if length(btrim(coalesce(p_user_id, ''))) < 1 or length(p_user_id) > 128 or p_expected_revision is null or p_expected_revision < -1 then
    raise exception 'invalid account or revision';
  end if;
  if jsonb_typeof(p_metadata) is distinct from 'object'
    or jsonb_typeof(p_assignments) is distinct from 'object'
    or jsonb_typeof(p_reviews) is distinct from 'array'
    or jsonb_typeof(p_metadata->'policy') is distinct from 'object'
    or jsonb_typeof(p_metadata->'enrolledPackIds') is distinct from 'array'
    or p_metadata->>'version' is distinct from '1'
    or p_metadata ? 'assignments' or p_metadata ? 'reviewLog' then
    raise exception 'invalid patch';
  end if;
  -- Bound individual commands, not the lifetime size of an account.
  if octet_length(p_assignments::text) > 2000000 or octet_length(p_reviews::text) > 2000000 then
    raise exception 'patch too large';
  end if;
  if p_expected_revision = -1 then
    insert into public.custom_srs_accounts(user_id, metadata, revision)
    values (p_user_id, p_metadata, 0) on conflict do nothing returning revision into v_revision;
    if v_revision is null then return null; end if;
  else
    select * into v_account from public.custom_srs_accounts where user_id = p_user_id for update;
    if not found or v_account.revision <> p_expected_revision then return null; end if;
    -- Only the v2 writer can advance a scheduling policy; stale writes still fail the account revision lock.
    if (v_account.metadata->'policy' is distinct from p_metadata->'policy' and (
        p_metadata->'policy'->>'id' is distinct from 'custom-srs'
        or p_metadata->'policy'->>'version' is distinct from '2'
        or jsonb_typeof(p_metadata->'policy'->'settings') is distinct from 'object'
        or (p_metadata->'policy'->>'settingsRevision')::bigint is distinct from
          coalesce((v_account.metadata->'policy'->>'settingsRevision')::bigint, 0) + 1
      )) or not ((p_metadata->'enrolledPackIds') @> (v_account.metadata->'enrolledPackIds')) then
      raise exception 'unsafe metadata replacement';
    end if;
    v_revision := v_account.revision + 1;
    update public.custom_srs_accounts set metadata = p_metadata, revision = v_revision, updated_at = now() where user_id = p_user_id;
  end if;
  if exists (
    select 1 from jsonb_each(p_assignments) e join public.custom_srs_assignments c on c.user_id = p_user_id and c.word_id = e.key
    where (c.assignment->>'stage')::int > 0 and coalesce((e.value->>'stage')::int, 0) = 0
  ) then raise exception 'unsafe learned card reset'; end if;
  insert into public.custom_srs_assignments(user_id, word_id, assignment)
  select p_user_id, key, value from jsonb_each(p_assignments)
  on conflict (user_id, word_id) do update set assignment = excluded.assignment
  where custom_srs_assignments.assignment is distinct from excluded.assignment;
  insert into public.custom_srs_review_history(user_id, event_id, entry)
  select p_user_id, value->>'eventId', value from jsonb_array_elements(p_reviews)
  on conflict (user_id, event_id) do nothing;
  return jsonb_build_object('revision', v_revision);
end;
$$;

revoke all on function public.patch_custom_srs_state_v2(text, bigint, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.patch_custom_srs_state_v2(text, bigint, jsonb, jsonb, jsonb) to service_role;

COMMIT;
