-- Private, portable text notebooks. One current document per verified WaniKani
-- account; pages reference shared sentences rather than duplicating their text.
create table if not exists public.notebook_states (
  user_id text primary key check (user_id ~ '^[1-9][0-9]{0,19}$'),
  state jsonb not null,
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notebook_state_shape check (
    jsonb_typeof(state) = 'object'
    and state ->> 'version' = '1'
    and jsonb_typeof(state -> 'pages') = 'array'
    and jsonb_typeof(state -> 'sentences') = 'array'
  ),
  constraint notebook_state_bounds check (
    jsonb_array_length(state -> 'pages') <= 200
    and jsonb_array_length(state -> 'sentences') <= 1500
    and octet_length(state::text) <= 8388608
  )
);

alter table public.notebook_states enable row level security;
revoke all on public.notebook_states from public, anon, authenticated;
grant select on public.notebook_states to service_role;

-- A null result means the account revision changed. The API retries unrelated
-- writes against the new state and checks each item's revision before editing.
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
  if p_user_id is null or p_user_id !~ '^[1-9][0-9]{0,19}$' then raise exception 'invalid user id'; end if;
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
