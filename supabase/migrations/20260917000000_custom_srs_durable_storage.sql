-- Preserve the original snapshot for rollback; keep the old read/write API working.
-- Explicit transaction: the Supabase CLI may execute statements individually.
begin;
lock table public.custom_srs_states in access exclusive mode;
alter table public.custom_srs_states rename to custom_srs_states_legacy_backup;
revoke all on public.custom_srs_states_legacy_backup from public, anon, authenticated, service_role;

create table public.custom_srs_accounts (
  user_id text primary key,
  metadata jsonb not null,
  revision bigint not null check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.custom_srs_assignments (
  user_id text not null references public.custom_srs_accounts(user_id),
  word_id text not null,
  assignment jsonb not null,
  primary key (user_id, word_id)
);
create table public.custom_srs_review_history (
  user_id text not null references public.custom_srs_accounts(user_id),
  event_id text not null,
  entry jsonb not null,
  sequence bigint generated always as identity,
  primary key (user_id, event_id)
);
create index custom_srs_review_history_recent on public.custom_srs_review_history(user_id, sequence desc);

insert into public.custom_srs_accounts(user_id, metadata, revision, created_at, updated_at)
select user_id, state - 'assignments' - 'reviewLog', revision, created_at, updated_at
from public.custom_srs_states_legacy_backup;
insert into public.custom_srs_assignments(user_id, word_id, assignment)
select s.user_id, a.key, a.value from public.custom_srs_states_legacy_backup s
cross join lateral jsonb_each(s.state->'assignments') a;
insert into public.custom_srs_review_history(user_id, event_id, entry)
select s.user_id, e.value->>'eventId', e.value from public.custom_srs_states_legacy_backup s
cross join lateral jsonb_array_elements(s.state->'reviewLog') with ordinality e(value, position)
order by s.user_id, e.position
on conflict (user_id, event_id) do nothing;

alter table public.custom_srs_accounts enable row level security;
alter table public.custom_srs_assignments enable row level security;
alter table public.custom_srs_review_history enable row level security;
revoke all on public.custom_srs_accounts, public.custom_srs_assignments, public.custom_srs_review_history from public, anon, authenticated;

-- Existing clients receive a bounded recent-history window, while the archive never prunes.
create view public.custom_srs_states as
select a.user_id, a.revision, a.created_at, a.updated_at,
  a.metadata || jsonb_build_object(
    'assignments', coalesce((select jsonb_object_agg(c.word_id, c.assignment) from public.custom_srs_assignments c where c.user_id = a.user_id), '{}'::jsonb),
    'reviewLog', coalesce((select jsonb_agg(h.entry order by h.sequence) from (
      select entry, sequence from public.custom_srs_review_history where user_id = a.user_id order by sequence desc limit 2000
    ) h), '[]'::jsonb)
  ) as state
from public.custom_srs_accounts a;
revoke all on public.custom_srs_states from public, anon, authenticated;
grant select on public.custom_srs_states to service_role;

create function public.patch_custom_srs_state(
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
    -- Old servers must not replace a future policy or erase enrollments.
    if v_account.metadata->'policy' is distinct from p_metadata->'policy'
      or not ((p_metadata->'enrolledPackIds') @> (v_account.metadata->'enrolledPackIds')) then
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

-- Compatibility writer for app/server versions that still submit full snapshots.
create or replace function public.compare_and_set_custom_srs_state(
  p_user_id text, p_expected_revision bigint, p_state jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_assignments jsonb;
begin
  if jsonb_typeof(p_state->'assignments') is distinct from 'object' or jsonb_typeof(p_state->'reviewLog') is distinct from 'array' then
    raise exception 'invalid state';
  end if;
  if exists(select 1 from public.custom_srs_assignments where user_id = p_user_id and not ((p_state->'assignments') ? word_id)) then
    raise exception 'unsafe assignment removal';
  end if;
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) into v_assignments
  from jsonb_each(p_state->'assignments') e
  left join public.custom_srs_assignments c on c.user_id = p_user_id and c.word_id = e.key
  where c.assignment is distinct from e.value;
  return public.patch_custom_srs_state(p_user_id, p_expected_revision, p_state - 'assignments' - 'reviewLog', v_assignments, p_state->'reviewLog');
end;
$$;
revoke all on function public.patch_custom_srs_state(text, bigint, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.patch_custom_srs_state(text, bigint, jsonb, jsonb, jsonb) to service_role;
revoke all on function public.compare_and_set_custom_srs_state(text, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.compare_and_set_custom_srs_state(text, bigint, jsonb) to service_role;

-- Mutation reads need only the affected cards and the event being retried.
create function public.read_custom_srs_cards(p_user_id text, p_word_ids text[], p_event_id text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('revision', a.revision, 'state', a.metadata || jsonb_build_object(
    'assignments', coalesce((select jsonb_object_agg(c.word_id, c.assignment) from public.custom_srs_assignments c where c.user_id = a.user_id and c.word_id = any(p_word_ids)), '{}'::jsonb),
    'reviewLog', coalesce((select jsonb_agg(h.entry) from public.custom_srs_review_history h where h.user_id = a.user_id and h.event_id = p_event_id), '[]'::jsonb)
  )) from public.custom_srs_accounts a where a.user_id = p_user_id;
$$;
revoke all on function public.read_custom_srs_cards(text, text[], text) from public, anon, authenticated;
grant execute on function public.read_custom_srs_cards(text, text[], text) to service_role;
grant select on public.custom_srs_review_history to service_role;

create function public.read_custom_srs_revision(p_user_id text)
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce((select revision from public.custom_srs_accounts where user_id = p_user_id), -1);
$$;
revoke all on function public.read_custom_srs_revision(text) from public, anon, authenticated;
grant execute on function public.read_custom_srs_revision(text) to service_role;

commit;
