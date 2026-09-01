-- Canonical, per-account state for Kakehashi custom vocabulary reviews.
-- Browser roles have no table or function access; authenticated Next.js routes
-- validate every mutation and use the service role for optimistic writes.

create table if not exists public.custom_srs_states (
  user_id text primary key,
  state jsonb not null,
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint custom_srs_state_object check (jsonb_typeof(state) = 'object')
);

alter table public.custom_srs_states enable row level security;
revoke all on public.custom_srs_states from public, anon, authenticated;

create or replace function public.compare_and_set_custom_srs_state(
  p_user_id text,
  p_expected_revision bigint,
  p_state jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revision bigint;
begin
  if length(btrim(coalesce(p_user_id, ''))) < 1 or length(p_user_id) > 128 then
    raise exception 'invalid user id';
  end if;
  if p_expected_revision < -1 then raise exception 'invalid revision'; end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' then raise exception 'state must be an object'; end if;
  if octet_length(p_state::text) > 2000000 then raise exception 'state is too large'; end if;

  if p_expected_revision = -1 then
    insert into public.custom_srs_states (user_id, state, revision)
    values (p_user_id, p_state, 0)
    on conflict (user_id) do nothing
    returning revision into v_revision;
  else
    update public.custom_srs_states
      set state = p_state, revision = revision + 1, updated_at = now()
      where user_id = p_user_id and revision = p_expected_revision
      returning revision into v_revision;
  end if;

  if v_revision is null then return null; end if;
  return jsonb_build_object('revision', v_revision);
end;
$$;

revoke all on function public.compare_and_set_custom_srs_state(text, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.compare_and_set_custom_srs_state(text, bigint, jsonb) to service_role;
