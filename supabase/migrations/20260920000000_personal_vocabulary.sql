-- Private text vocabulary, kept separate from review events and SRS cards.
BEGIN;
create table public.custom_vocabulary_libraries (
  user_id text primary key references public.custom_srs_accounts(user_id),
  revision bigint not null default 0 check (revision >= 0)
);
create table public.custom_vocabulary_entries (
  user_id text not null references public.custom_vocabulary_libraries(user_id),
  id text not null,
  kind text not null check (kind in ('deck', 'word')),
  deck_id text,
  identity_key text,
  data jsonb not null,
  revision bigint not null,
  primary key (user_id, id),
  foreign key (user_id, deck_id) references public.custom_vocabulary_entries(user_id, id),
  check ((kind = 'deck' and deck_id is null and identity_key is null) or (kind = 'word' and deck_id is not null and identity_key is not null))
);
create unique index custom_vocabulary_word_identity on public.custom_vocabulary_entries(user_id, deck_id, identity_key) where kind = 'word';
create index custom_vocabulary_changes on public.custom_vocabulary_entries(user_id, revision, id);
create table public.custom_vocabulary_events (
  user_id text not null references public.custom_vocabulary_libraries(user_id),
  event_id text not null,
  request_hash text not null,
  result jsonb not null,
  primary key (user_id, event_id)
);
alter table public.custom_vocabulary_libraries enable row level security;
alter table public.custom_vocabulary_entries enable row level security;
alter table public.custom_vocabulary_events enable row level security;
revoke all on public.custom_vocabulary_libraries, public.custom_vocabulary_entries, public.custom_vocabulary_events from public, anon, authenticated;

create function public.read_custom_vocabulary(
  p_user_id text, p_after_revision bigint default 0, p_after_id text default '', p_until_revision bigint default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_revision bigint; v_entries jsonb; v_last jsonb; v_more boolean;
begin
  if p_after_revision < 0 or length(p_after_id) > 64 then raise exception 'Invalid library cursor'; end if;
  select coalesce(revision, 0) into v_revision from custom_vocabulary_libraries where user_id = p_user_id;
  v_revision := coalesce(v_revision, 0);
  if p_until_revision is not null then
    if p_until_revision < p_after_revision or p_until_revision > v_revision then raise exception 'Invalid library cursor'; end if;
    v_revision := p_until_revision;
  end if;
  if p_after_revision > v_revision then raise exception 'Library cache is ahead of the server. Reload the library'; end if;
  select coalesce(jsonb_agg(row_data order by revision, id), '[]'::jsonb), count(*) > 200 into v_entries, v_more from (
    select revision, id, jsonb_build_object('id', id, 'kind', kind, 'deckId', deck_id, 'data', data, 'revision', revision) as row_data
    from custom_vocabulary_entries where user_id = p_user_id and (revision > p_after_revision or (p_after_id <> '' and revision = p_after_revision and id > p_after_id)) and revision <= v_revision
    order by revision, id limit 201
  ) entries;
  if v_more then v_entries := v_entries - 200; v_last := v_entries->199; end if;
  return jsonb_build_object('revision', v_revision, 'entries', v_entries,
    'cursor', case when v_more then jsonb_build_object('revision', v_last->'revision', 'id', v_last->'id') else null end);
end;
$$;

create function public.mutate_custom_vocabulary(
  p_user_id text, p_expected_revision bigint, p_event_id text, p_operations jsonb, p_initial_metadata jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_account custom_srs_accounts; v_revision bigint; v_old custom_vocabulary_entries;
  v_op jsonb; v_action text; v_id text; v_deck text; v_data jsonb; v_now text;
  v_added integer := 0; v_skipped integer := 0; v_changed integer := 0;
  v_prior custom_vocabulary_events; v_result jsonb;
begin
  if length(btrim(coalesce(p_user_id, ''))) < 1 or length(p_user_id) > 128
    or p_expected_revision < 0 or p_event_id !~* '^[0-9a-f-]{36}$'
    or jsonb_typeof(p_operations) is distinct from 'array' or jsonb_array_length(p_operations) not between 1 and 1001
    or octet_length(p_operations::text) > 2500000 then raise exception 'Invalid vocabulary request'; end if;
  if p_initial_metadata->>'version' is distinct from '1' or jsonb_typeof(p_initial_metadata->'policy') is distinct from 'object' then raise exception 'Invalid initial state'; end if;
  insert into custom_srs_accounts(user_id, metadata, revision) values(p_user_id, p_initial_metadata, 0) on conflict do nothing;
  select * into v_account from custom_srs_accounts where user_id = p_user_id for update;
  insert into custom_vocabulary_libraries(user_id) values(p_user_id) on conflict do nothing;
  select revision into v_revision from custom_vocabulary_libraries where user_id = p_user_id for update;
  select * into v_prior from custom_vocabulary_events where user_id = p_user_id and event_id = p_event_id;
  if found then
    if v_prior.request_hash <> md5(p_operations::text) then raise exception 'This request ID was already used for different content'; end if;
    return v_prior.result;
  end if;
  if v_revision <> p_expected_revision then raise exception 'Your library changed on another device. Refresh it before saving'; end if;
  v_revision := v_revision + 1;
  v_now := to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  for v_op in select value from jsonb_array_elements(p_operations) loop
    v_action := v_op->>'action'; v_id := v_op->>'id';
    if v_id is null or v_id !~* '^personal:[0-9a-f-]{36}$' then raise exception 'Invalid vocabulary ID'; end if;
    select * into v_old from custom_vocabulary_entries where user_id = p_user_id and id = v_id;
    if v_action = 'create_deck' then
      if found then raise exception 'Deck ID already exists'; end if;
      if length(btrim(coalesce(v_op->>'title', ''))) not between 1 and 100 then raise exception 'Invalid deck title'; end if;
      if (select count(*) from custom_vocabulary_entries where user_id = p_user_id and kind = 'deck') >= 100 then raise exception 'The limit is 100 private decks'; end if;
      insert into custom_vocabulary_entries(user_id, id, kind, data, revision) values(p_user_id, v_id, 'deck', jsonb_build_object('title', v_op->>'title'), v_revision);
      v_account.metadata := jsonb_set(v_account.metadata, '{enrolledPackIds}', (v_account.metadata->'enrolledPackIds') || jsonb_build_array(v_id));
      v_changed := v_changed + 1;
    elsif v_action = 'rename_deck' then
      if not found or v_old.kind <> 'deck' then raise exception 'Deck not found'; end if;
      if length(btrim(coalesce(v_op->>'title', ''))) not between 1 and 100 then raise exception 'Invalid deck title'; end if;
      update custom_vocabulary_entries set data = jsonb_build_object('title', v_op->>'title'), revision = v_revision where user_id = p_user_id and id = v_id;
      v_changed := v_changed + 1;
    elsif v_action in ('create_word', 'edit_word') then
      if v_action = 'edit_word' and (not found or v_old.kind <> 'word') then raise exception 'Word not found'; end if;
      if v_action = 'create_word' and found then raise exception 'Word ID already exists'; end if;
      v_deck := case when v_action = 'create_word' then v_op->>'deckId' else v_old.deck_id end;
      if not exists(select 1 from custom_vocabulary_entries where user_id = p_user_id and id = v_deck and kind = 'deck') then raise exception 'Deck not found'; end if;
      if jsonb_typeof(v_op->'word') is distinct from 'object' or length(coalesce(v_op->>'identityKey', '')) not between 1 and 2000 then raise exception 'Invalid word'; end if;
      if exists(select 1 from custom_vocabulary_entries where user_id = p_user_id and deck_id = v_deck and identity_key = v_op->>'identityKey' and id <> v_id) then
        if v_action = 'edit_word' then raise exception 'This spelling and reading already exist in the deck'; end if;
        v_skipped := v_skipped + 1; continue;
      end if;
      if v_action = 'create_word' then
        if (select count(*) from custom_vocabulary_entries where user_id = p_user_id and kind = 'word') >= 10000 then raise exception 'The limit is 10,000 private words, including archived words'; end if;
        insert into custom_vocabulary_entries(user_id, id, kind, deck_id, identity_key, data, revision)
          values(p_user_id, v_id, 'word', v_deck, v_op->>'identityKey', jsonb_build_object('word', v_op->'word', 'archived', false), v_revision);
        insert into custom_srs_assignments(user_id, word_id, assignment) values(p_user_id, v_id, jsonb_build_object(
          'wordId', v_id, 'packId', v_deck, 'stage', 0, 'availableAt', null, 'startedAt', null, 'burnedAt', null,
          'updatedAt', v_now, 'correctReviews', 0, 'incorrectReviews', 0, 'card', null));
        v_added := v_added + 1;
      else
        update custom_vocabulary_entries set data = jsonb_set(data, '{word}', v_op->'word'), identity_key = v_op->>'identityKey', revision = v_revision where user_id = p_user_id and id = v_id;
        -- Preserve the schedule but invalidate answers against an edited definition.
        update custom_srs_assignments set assignment = jsonb_set(assignment, '{updatedAt}', to_jsonb(v_now)) where user_id = p_user_id and word_id = v_id;
        v_changed := v_changed + 1;
      end if;
    elsif v_action = 'archive_word' then
      if not found or v_old.kind <> 'word' then raise exception 'Word not found'; end if;
      if jsonb_typeof(v_op->'archived') is distinct from 'boolean' then raise exception 'Invalid archive state'; end if;
      update custom_vocabulary_entries set data = jsonb_set(data, '{archived}', v_op->'archived'), revision = v_revision where user_id = p_user_id and id = v_id;
      update custom_srs_assignments set assignment = assignment || jsonb_build_object('archivedAt', case when (v_op->>'archived')::boolean then v_now else null end, 'updatedAt', v_now) where user_id = p_user_id and word_id = v_id;
      v_changed := v_changed + 1;
    else raise exception 'Unsupported vocabulary action'; end if;
  end loop;
  update custom_vocabulary_libraries set revision = v_revision where user_id = p_user_id;
  update custom_srs_accounts set metadata = v_account.metadata || jsonb_build_object('personalLibraryRevision', v_revision, 'updatedAt', v_now), revision = revision + 1, updated_at = now() where user_id = p_user_id;
  v_result := jsonb_build_object('revision', v_revision, 'added', v_added, 'skipped', v_skipped, 'changed', v_changed);
  insert into custom_vocabulary_events values(p_user_id, p_event_id, md5(p_operations::text), v_result);
  return v_result;
end;
$$;
revoke all on function public.read_custom_vocabulary(text, bigint, text, bigint) from public, anon, authenticated;
revoke all on function public.mutate_custom_vocabulary(text, bigint, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.read_custom_vocabulary(text, bigint, text, bigint) to service_role;
grant execute on function public.mutate_custom_vocabulary(text, bigint, text, jsonb, jsonb) to service_role;
COMMIT;
