-- WaniKani session identities may be opaque UUIDs rather than numeric IDs.
-- Ownership still comes exclusively from the verified server session.
alter table public.notebook_states drop constraint if exists notebook_states_user_id_check;
alter table public.notebook_states add constraint notebook_states_user_id_check
  check (user_id ~ '^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$');

create or replace function public.compare_and_set_notebook_state(
  p_user_id text,
  p_expected_revision bigint,
  p_state jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revision bigint;
begin
  if p_user_id is null or p_user_id !~ '^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$' then raise exception 'invalid user id'; end if;
  if p_expected_revision is null or p_expected_revision < -1 then raise exception 'invalid revision'; end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object'
    or p_state ->> 'version' is distinct from '1'
    or jsonb_typeof(p_state -> 'pages') is distinct from 'array'
    or jsonb_typeof(p_state -> 'sentences') is distinct from 'array'
    then raise exception 'invalid notebook state'; end if;
  if jsonb_array_length(p_state -> 'pages') > 200
    or jsonb_array_length(p_state -> 'sentences') > 1500
    or octet_length(p_state::text) > 8388608
    then raise exception 'notebook state is too large'; end if;

  if p_expected_revision = -1 then
    insert into public.notebook_states (user_id, state, revision)
      values (p_user_id, p_state, 0)
      on conflict (user_id) do nothing
      returning revision into v_revision;
  else
    update public.notebook_states
      set state = p_state, revision = revision + 1, updated_at = now()
      where user_id = p_user_id and revision = p_expected_revision
      returning revision into v_revision;
  end if;
  if v_revision is null then return null; end if;
  return jsonb_build_object('revision', v_revision);
end;
$$;
revoke all on function public.compare_and_set_notebook_state(text, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.compare_and_set_notebook_state(text, bigint, jsonb) to service_role;
