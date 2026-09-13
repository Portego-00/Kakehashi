-- Replace per-request study-time Edge Function traffic with short-lived,
-- database-issued capabilities. The WaniKani token is used only for the
-- synchronous identity check and is never inserted, hashed, or returned by
-- these functions. Existing timing rows, archive rows, and legacy write functions
-- are intentionally left untouched.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists http with schema extensions;

-- These tables are disposable caches, not account data. UNLOGGED keeps their
-- changes out of WAL replication; a database restart simply makes clients
-- authenticate again. Only hashes of random capabilities are retained.
create unlogged table if not exists private.study_time_sessions (
  session_token_hash bytea primary key,
  user_id text not null,
  user_name text not null,
  user_level integer not null check (user_level between 1 and 60),
  device_id text not null check (device_id ~ '^[A-Za-z0-9_-]{8,128}$'),
  created_at timestamptz not null,
  expires_at timestamptz not null,
  request_window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  check (expires_at > created_at)
);

create index if not exists study_time_sessions_expiry_idx
  on private.study_time_sessions (expires_at);
create index if not exists study_time_sessions_account_device_idx
  on private.study_time_sessions (user_id, device_id, expires_at desc);

create unlogged table if not exists private.study_time_session_issue_limits (
  rate_key bytea primary key,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0)
);

create index if not exists study_time_session_issue_limits_window_idx
  on private.study_time_session_issue_limits (window_started_at);

alter table private.study_time_sessions enable row level security;
alter table private.study_time_session_issue_limits enable row level security;
revoke all on private.study_time_sessions from public, anon, authenticated;
revoke all on private.study_time_session_issue_limits
  from public, anon, authenticated;

create or replace function private.study_time_rpc_error(error_code text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object('ok', false, 'error', error_code);
$$;

revoke all on function private.study_time_rpc_error(text)
  from public, anon, authenticated;

create or replace function private.study_time_request_ip()
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  request_headers jsonb := '{}'::jsonb;
  request_headers_text text;
  candidate text;
begin
  request_headers_text := pg_catalog.current_setting('request.headers', true);
  if request_headers_text is not null and request_headers_text <> '' then
    begin
      request_headers := request_headers_text::jsonb;
    exception when others then
      request_headers := '{}'::jsonb;
    end;
  end if;

  candidate := coalesce(
    nullif(pg_catalog.btrim(request_headers->>'cf-connecting-ip'), ''),
    nullif(
      pg_catalog.btrim(
        pg_catalog.split_part(request_headers->>'x-forwarded-for', ',', 1)
      ),
      ''
    ),
    'unknown'
  );

  begin
    return candidate::inet::text;
  exception when others then
    return 'unknown';
  end;
end;
$$;

revoke all on function private.study_time_request_ip()
  from public, anon, authenticated;

create or replace function private.take_study_time_session_issue_quota()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_key bytea;
  global_key bytea;
  global_shard integer;
  observed_at timestamptz := pg_catalog.clock_timestamp();
  source_window_started_at timestamptz;
  source_request_count integer;
  global_window_started_at timestamptz;
  global_request_count integer;
begin
  source_key := extensions.digest(
    pg_catalog.convert_to(
      'study-time-session-ip:' || private.study_time_request_ip(),
      'UTF8'
    ),
    'sha256'
  );
  -- Sixteen independent buckets avoid holding one shared rate-limit row lock
  -- during every outbound request. Each shard admits at most 15 requests per
  -- minute, preserving the hard global ceiling of 240 while allowing the
  -- separate eight-slot verification guard to control actual concurrency.
  global_shard := pg_catalog.get_byte(source_key, 0) % 16;
  global_key := extensions.digest(
    pg_catalog.convert_to(
      'study-time-session-global:' || global_shard::text,
      'UTF8'
    ),
    'sha256'
  );

  -- One transaction at a time decides both counters for a shard. A busy shard
  -- fails closed instead of tying up another database connection. This lock is
  -- transaction-scoped, so it cannot leak into a pooled database session.
  if not pg_catalog.pg_try_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'study-time-session-quota-shard:' || global_shard::text,
      0
    )
  ) then
    return false;
  end if;

  -- Bound storage even if callers continually rotate source addresses. Locked
  -- rows are skipped, and the supporting timestamp index keeps this cleanup
  -- independent of the durable study-time tables.
  delete from private.study_time_session_issue_limits
  where rate_key in (
    select stale.rate_key
    from private.study_time_session_issue_limits as stale
    where stale.window_started_at <= observed_at - interval '10 minutes'
    order by stale.window_started_at
    for update skip locked
    limit 512
  );

  select limits.window_started_at, limits.request_count
    into source_window_started_at, source_request_count
  from private.study_time_session_issue_limits as limits
  where limits.rate_key = source_key;
  if source_window_started_at is null
     or source_window_started_at <= observed_at - interval '1 minute' then
    source_window_started_at := observed_at;
    source_request_count := 0;
  end if;

  select limits.window_started_at, limits.request_count
    into global_window_started_at, global_request_count
  from private.study_time_session_issue_limits as limits
  where limits.rate_key = global_key;
  if global_window_started_at is null
     or global_window_started_at <= observed_at - interval '1 minute' then
    global_window_started_at := observed_at;
    global_request_count := 0;
  end if;

  -- Decide both limits before changing either row. Source exhaustion therefore
  -- cannot spend global capacity, and global exhaustion cannot create or
  -- increment a source entry.
  if source_request_count >= 12 or global_request_count >= 15 then
    return false;
  end if;

  insert into private.study_time_session_issue_limits as limits
    (rate_key, window_started_at, request_count)
  values (source_key, source_window_started_at, source_request_count + 1)
  on conflict (rate_key) do update set
    window_started_at = excluded.window_started_at,
    request_count = excluded.request_count;

  insert into private.study_time_session_issue_limits as limits
    (rate_key, window_started_at, request_count)
  values (global_key, global_window_started_at, global_request_count + 1)
  on conflict (rate_key) do update set
    window_started_at = excluded.window_started_at,
    request_count = excluded.request_count;

  return true;
end;
$$;

revoke all on function private.take_study_time_session_issue_quota()
  from public, anon, authenticated;

create or replace function private.acquire_study_time_verification_slot()
returns boolean
language plpgsql
volatile
set search_path = ''
as $$
declare
  slot integer;
  source_lock bigint;
begin
  -- One outbound verification per source at a time, plus eight globally. The
  -- transaction-scoped locks are released for every success/error return.
  source_lock := pg_catalog.hashtextextended(
    'study-time-verification-source:' || private.study_time_request_ip(),
    0
  );
  if not pg_catalog.pg_try_advisory_xact_lock(source_lock) then
    return false;
  end if;

  for slot in 0..7 loop
    if pg_catalog.pg_try_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'study-time-verification-global:' || slot::text,
        0
      )
    ) then
      return true;
    end if;
  end loop;
  return false;
end;
$$;

revoke all on function private.acquire_study_time_verification_slot()
  from public, anon, authenticated;

create or replace function private.study_time_millisecond_value(value jsonb)
returns bigint
language plpgsql
immutable
set search_path = ''
as $$
declare
  parsed numeric;
begin
  if pg_catalog.jsonb_typeof(value) <> 'number' then
    return null;
  end if;
  -- The maximum accepted value is eight digits. Bound text size before the
  -- regex/numeric cast so a capability holder cannot submit giant literals to
  -- amplify database CPU or memory work.
  if pg_catalog.octet_length(value::text) > 8 then
    return null;
  end if;
  if value::text !~ '^(0|[1-9][0-9]*)$' then
    return null;
  end if;
  parsed := value::text::numeric;
  if parsed < 0 or parsed > 86400000 then
    return null;
  end if;
  return parsed::bigint;
exception when others then
  return null;
end;
$$;

revoke all on function private.study_time_millisecond_value(jsonb)
  from public, anon, authenticated;

create or replace function private.study_time_date_key(value text)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  parsed date;
begin
  if value is null or value !~ '^\d{4}-\d{2}-\d{2}$' then
    return null;
  end if;
  parsed := value::date;
  if pg_catalog.to_char(parsed, 'YYYY-MM-DD') <> value then
    return null;
  end if;
  return parsed;
exception when others then
  return null;
end;
$$;

revoke all on function private.study_time_date_key(text)
  from public, anon, authenticated;

create or replace function private.study_time_activity_value(
  activity_ms jsonb,
  activity_key text
)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    private.study_time_millisecond_value(activity_ms->activity_key),
    0
  );
$$;

revoke all on function private.study_time_activity_value(jsonb, text)
  from public, anon, authenticated;

create or replace function private.consume_study_time_session(
  session_token text
)
returns private.study_time_sessions
language plpgsql
security definer
set search_path = ''
set lock_timeout = '2s'
as $$
declare
  session private.study_time_sessions%rowtype;
  observed_at timestamptz := pg_catalog.clock_timestamp();
  token_hash bytea;
begin
  if session_token is null
     or session_token !~ '^st1_[0-9a-f]{64}$' then
    return null;
  end if;

  token_hash := extensions.digest(
    pg_catalog.convert_to(session_token, 'UTF8'),
    'sha256'
  );
  select stored.* into session
  from private.study_time_sessions as stored
  where stored.session_token_hash = token_hash
    and stored.expires_at > observed_at
  for update;

  if not found then
    return null;
  end if;
  if session.request_window_started_at > observed_at - interval '1 minute'
     and session.request_count >= 80 then
    raise sqlstate 'ST429' using message = 'study time session rate limit';
  end if;

  update private.study_time_sessions as stored set
    request_window_started_at = case
      when stored.request_window_started_at <= observed_at - interval '1 minute'
        then observed_at
      else stored.request_window_started_at
    end,
    request_count = case
      when stored.request_window_started_at <= observed_at - interval '1 minute'
        then 1
      else stored.request_count + 1
    end
  where stored.session_token_hash = token_hash
  returning stored.* into session;

  return session;
end;
$$;

revoke all on function private.consume_study_time_session(text)
  from public, anon, authenticated;

create or replace function public.create_study_time_session(
  wani_kani_token text,
  device_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  response extensions.http_response;
  identity_payload jsonb;
  verified_user_id text;
  verified_user_name text;
  verified_user_level integer;
  issued_at timestamptz := pg_catalog.clock_timestamp();
  expires_at timestamptz;
  raw_session_token text;
  session_hash bytea;
begin
  -- Reject whitespace/control characters before using the credential as an
  -- HTTP header value. The WaniKani token format is otherwise kept opaque.
  if wani_kani_token is null
     or pg_catalog.octet_length(wani_kani_token) < 20
     or pg_catalog.octet_length(wani_kani_token) > 512
     or wani_kani_token !~ '^[!-~]+$'
     or device_id is null
     or device_id !~ '^[A-Za-z0-9_-]{8,128}$' then
    return private.study_time_rpc_error('invalid_request');
  end if;
  if not private.take_study_time_session_issue_quota() then
    return private.study_time_rpc_error('rate_limited');
  end if;
  if not private.acquire_study_time_verification_slot() then
    return private.study_time_rpc_error('rate_limited');
  end if;

  perform pg_catalog.set_config('http.curlopt_connecttimeout_ms', '1000', true);
  perform pg_catalog.set_config('http.curlopt_timeout_ms', '3000', true);

  begin
    response := extensions.http((
      'GET'::extensions.http_method,
      'https://api.wanikani.com/v2/user',
      array[
        extensions.http_header('Accept', 'application/json'),
        extensions.http_header('Authorization', 'Bearer ' || wani_kani_token),
        extensions.http_header('Wanikani-Revision', '20170710')
      ]::extensions.http_header[],
      null,
      null
    )::extensions.http_request);
  exception when others then
    return private.study_time_rpc_error('upstream_unavailable');
  end;

  if response.status in (401, 403) then
    return private.study_time_rpc_error('invalid_token');
  end if;
  if response.status < 200 or response.status >= 300 then
    return private.study_time_rpc_error('upstream_unavailable');
  end if;

  begin
    identity_payload := response.content::jsonb;
    verified_user_id := pg_catalog.btrim(identity_payload #>> '{data,id}');
    verified_user_name := pg_catalog.btrim(
      identity_payload #>> '{data,username}'
    );
    if identity_payload #>> '{data,level}' is null
       or identity_payload #>> '{data,level}' !~ '^\d{1,2}$' then
      return private.study_time_rpc_error('upstream_unavailable');
    end if;
    verified_user_level := (identity_payload #>> '{data,level}')::integer;
  exception when others then
    return private.study_time_rpc_error('upstream_unavailable');
  end;

  if verified_user_id is null or verified_user_id = ''
     or pg_catalog.octet_length(verified_user_id) > 256
     or verified_user_name is null or verified_user_name = ''
     or pg_catalog.octet_length(verified_user_name) > 128
     or verified_user_level is null
     or verified_user_level < 1 or verified_user_level > 60 then
    return private.study_time_rpc_error('upstream_unavailable');
  end if;

  expires_at := issued_at + interval '5 minutes';
  raw_session_token := 'st1_' ||
    pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  session_hash := extensions.digest(
    pg_catalog.convert_to(raw_session_token, 'UTF8'),
    'sha256'
  );

  -- Opportunistic bounded cleanup means expiry data cannot grow forever and
  -- never touches durable study-time/account history.
  delete from private.study_time_sessions
  where session_token_hash in (
    select expired.session_token_hash
    from private.study_time_sessions as expired
    where expired.expires_at <= issued_at
    order by expired.expires_at
    limit 512
  );

  insert into private.study_time_sessions
    (session_token_hash, user_id, user_name, user_level, device_id,
     created_at, expires_at, request_window_started_at, request_count)
  values
    (session_hash, verified_user_id, verified_user_name, verified_user_level,
     device_id, issued_at, expires_at, issued_at, 0);

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'sessionToken', raw_session_token,
    'expiresAt', expires_at,
    'user', pg_catalog.jsonb_build_object(
      'id', verified_user_id,
      'name', verified_user_name,
      'level', verified_user_level
    )
  );
end;
$$;

create or replace function public.sync_study_time_days(
  session_token text,
  days jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session private.study_time_sessions%rowtype;
  raw_day jsonb;
  raw_activity record;
  activity_ms jsonb;
  computed_study_total_ms bigint;
  study_total_ms bigint;
  app_total_ms bigint;
  parsed_day date;
  app_version text;
  platform_value text;
  rows jsonb := '[]'::jsonb;
  seen_days date[] := array[]::date[];
  observed_at timestamptz := pg_catalog.clock_timestamp();
  allowed_activities constant text[] := array[
    'reviews', 'bunpro_reviews', 'lessons', 'bunpro_lessons',
    'recent_lessons_review', 'custom_review', 'custom_lesson',
    'test_session', 'meaning_reading', 'similar_kanji', 'kana_kanji',
    'writing_practice', 'writing_freehand', 'context_sentence',
    'listening_practice', 'jlpt', 'crossword', 'word_search', 'wordle',
    'news', 'songs', 'epub', 'video'
  ];
  allowed_day_keys constant text[] := array[
    'day', 'activityMs', 'studyTotalMs', 'appTotalMs', 'appVersion',
    'platform'
  ];
begin
  begin
    session := private.consume_study_time_session(session_token);
  exception
    when sqlstate 'ST429' or lock_not_available then
      return private.study_time_rpc_error('rate_limited');
  end;
  if session.session_token_hash is null then
    return private.study_time_rpc_error('session_expired');
  end if;

  if days is null
     or pg_catalog.jsonb_typeof(days) <> 'array'
     or pg_catalog.jsonb_array_length(days) < 1
     or pg_catalog.jsonb_array_length(days) > 14 then
    return private.study_time_rpc_error('invalid_request');
  end if;

  for raw_day in select value from pg_catalog.jsonb_array_elements(days) loop
    if pg_catalog.jsonb_typeof(raw_day) <> 'object'
       or (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(raw_day)) <> 6
       or exists (
         select 1
         from pg_catalog.jsonb_object_keys(raw_day) as supplied(key)
         where not (supplied.key = any(allowed_day_keys))
       )
       or pg_catalog.jsonb_typeof(raw_day->'day') <> 'string'
       or pg_catalog.jsonb_typeof(raw_day->'activityMs') <> 'object'
       or pg_catalog.jsonb_typeof(raw_day->'platform') <> 'string' then
      return private.study_time_rpc_error('invalid_request');
    end if;

    parsed_day := private.study_time_date_key(raw_day->>'day');
    if parsed_day is null
       or parsed_day < (observed_at at time zone 'UTC')::date - 430
       or parsed_day > (observed_at at time zone 'UTC')::date + 1 then
      return private.study_time_rpc_error('invalid_request');
    end if;
    if parsed_day = any(seen_days) then
      return private.study_time_rpc_error('invalid_request');
    end if;
    seen_days := pg_catalog.array_append(seen_days, parsed_day);

    study_total_ms := private.study_time_millisecond_value(
      raw_day->'studyTotalMs'
    );
    app_total_ms := private.study_time_millisecond_value(raw_day->'appTotalMs');
    if study_total_ms is null or app_total_ms is null then
      return private.study_time_rpc_error('invalid_request');
    end if;

    activity_ms := '{}'::jsonb;
    computed_study_total_ms := 0;
    if (select pg_catalog.count(*)
        from pg_catalog.jsonb_object_keys(raw_day->'activityMs')) > 23 then
      return private.study_time_rpc_error('invalid_request');
    end if;
    for raw_activity in
      select activity.key, activity.value
      from pg_catalog.jsonb_each(raw_day->'activityMs') as activity(key, value)
    loop
      if not (raw_activity.key = any(allowed_activities))
         or private.study_time_millisecond_value(raw_activity.value) is null then
        return private.study_time_rpc_error('invalid_request');
      end if;
      computed_study_total_ms := computed_study_total_ms +
        private.study_time_millisecond_value(raw_activity.value);
      if computed_study_total_ms > 86400000 then
        return private.study_time_rpc_error('invalid_request');
      end if;
      activity_ms := activity_ms || pg_catalog.jsonb_build_object(
        raw_activity.key,
        private.study_time_millisecond_value(raw_activity.value)
      );
    end loop;

    if study_total_ms <> computed_study_total_ms
       or app_total_ms < computed_study_total_ms then
      return private.study_time_rpc_error('invalid_request');
    end if;

    if pg_catalog.jsonb_typeof(raw_day->'appVersion') = 'null' then
      app_version := null;
    elsif pg_catalog.jsonb_typeof(raw_day->'appVersion') = 'string' then
      app_version := pg_catalog.btrim(raw_day->>'appVersion');
      if app_version = ''
         or pg_catalog.octet_length(app_version) > 64
         or app_version ~ '[[:cntrl:]]' then
        return private.study_time_rpc_error('invalid_request');
      end if;
    else
      return private.study_time_rpc_error('invalid_request');
    end if;

    platform_value := raw_day->>'platform';
    if not (platform_value = any(array[
      'ios', 'android', 'web', 'macos', 'windows'
    ]::text[])) then
      return private.study_time_rpc_error('invalid_request');
    end if;

    rows := rows || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'user_id', session.user_id,
      'device_id', session.device_id,
      'day', pg_catalog.to_char(parsed_day, 'YYYY-MM-DD'),
      'activity_ms', activity_ms,
      'study_total_ms', study_total_ms,
      'app_total_ms', app_total_ms,
      'user_name', session.user_name,
      'user_level', session.user_level,
      'app_version', app_version,
      'platform', platform_value,
      'updated_at', observed_at
    ));
  end loop;

  begin
    perform public.upsert_verified_study_time_days(rows);
  exception when others then
    return private.study_time_rpc_error('storage_unavailable');
  end;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'synced', true,
    'acceptedDays', pg_catalog.jsonb_array_length(days),
    'expiresAt', session.expires_at
  );
end;
$$;

create or replace function public.get_study_time_history(session_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session private.study_time_sessions%rowtype;
  result jsonb;
  observed_at timestamptz := pg_catalog.clock_timestamp();
begin
  begin
    session := private.consume_study_time_session(session_token);
  exception
    when sqlstate 'ST429' or lock_not_available then
      return private.study_time_rpc_error('rate_limited');
  end;
  if session.session_token_hash is null then
    return private.study_time_rpc_error('session_expired');
  end if;

  begin
    with candidate_rows as materialized (
      -- Match the former Edge handler's hard input-row ceiling. LIMIT keeps a
      -- malicious account/device fan-out from forcing an unbounded aggregate;
      -- the HAVING clause below rejects rather than returning partial history.
      select row.day, row.activity_ms, row.app_total_ms
      from public.study_time_days as row
      where row.user_id = session.user_id
        and row.device_id <> session.device_id
        and row.verified
        and row.verified_at is not null
        and row.day >= (observed_at at time zone 'UTC')::date - interval '430 days'
        and row.day <= (observed_at at time zone 'UTC')::date + 1
      order by row.day, row.device_id
      limit 30001
    ), aggregated as (
      select
        row.day,
        pg_catalog.sum(greatest(row.app_total_ms, 0))::numeric
          as app_total_ms,
        pg_catalog.sum(
          private.study_time_activity_value(row.activity_ms, 'reviews') +
          private.study_time_activity_value(row.activity_ms, 'bunpro_reviews')
        )::numeric as reviews_ms,
        pg_catalog.sum(
          private.study_time_activity_value(row.activity_ms, 'lessons') +
          private.study_time_activity_value(row.activity_ms, 'bunpro_lessons')
        )::numeric as lessons_ms,
        pg_catalog.sum(
          private.study_time_activity_value(row.activity_ms, 'recent_lessons_review') +
          private.study_time_activity_value(row.activity_ms, 'custom_review') +
          private.study_time_activity_value(row.activity_ms, 'custom_lesson') +
          private.study_time_activity_value(row.activity_ms, 'test_session') +
          private.study_time_activity_value(row.activity_ms, 'meaning_reading') +
          private.study_time_activity_value(row.activity_ms, 'similar_kanji') +
          private.study_time_activity_value(row.activity_ms, 'kana_kanji') +
          private.study_time_activity_value(row.activity_ms, 'writing_practice') +
          private.study_time_activity_value(row.activity_ms, 'writing_freehand') +
          private.study_time_activity_value(row.activity_ms, 'context_sentence') +
          private.study_time_activity_value(row.activity_ms, 'listening_practice') +
          private.study_time_activity_value(row.activity_ms, 'jlpt') +
          private.study_time_activity_value(row.activity_ms, 'crossword') +
          private.study_time_activity_value(row.activity_ms, 'word_search') +
          private.study_time_activity_value(row.activity_ms, 'wordle') +
          private.study_time_activity_value(row.activity_ms, 'extra_study') +
          private.study_time_activity_value(row.activity_ms, 'extra-study')
        )::numeric as extra_study_ms,
        pg_catalog.sum(
          private.study_time_activity_value(row.activity_ms, 'news')
        )::numeric as news_ms,
        pg_catalog.sum(
          private.study_time_activity_value(row.activity_ms, 'songs')
        )::numeric as songs_ms,
        pg_catalog.sum(
          private.study_time_activity_value(row.activity_ms, 'epub') +
          private.study_time_activity_value(row.activity_ms, 'reading')
        )::numeric as epub_ms,
        pg_catalog.sum(
          private.study_time_activity_value(row.activity_ms, 'video')
        )::numeric as video_ms
      from candidate_rows as row
      group by row.day
    )
    select pg_catalog.jsonb_build_object(
      'ok', true,
      'days', coalesce(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'day', pg_catalog.to_char(aggregated.day, 'YYYY-MM-DD'),
            'appTotalMs', aggregated.app_total_ms,
            'byCategoryMs', pg_catalog.jsonb_build_object(
              'reviews', aggregated.reviews_ms,
              'lessons', aggregated.lessons_ms,
              'extra_study', aggregated.extra_study_ms,
              'news', aggregated.news_ms,
              'songs', aggregated.songs_ms,
              'epub', aggregated.epub_ms,
              'video', aggregated.video_ms
            )
          ) order by aggregated.day
        ),
        '[]'::jsonb
      ),
      'expiresAt', session.expires_at
    ) into result
    from aggregated
    having (
      select pg_catalog.count(*) from candidate_rows
    ) <= 30000;
  exception when others then
    return private.study_time_rpc_error('storage_unavailable');
  end;

  if result is null then
    return private.study_time_rpc_error('storage_unavailable');
  end if;

  return result;
end;
$$;

revoke all on function public.create_study_time_session(text, text)
  from public, anon, authenticated;
revoke all on function public.sync_study_time_days(text, jsonb)
  from public, anon, authenticated;
revoke all on function public.get_study_time_history(text)
  from public, anon, authenticated;

grant execute on function public.create_study_time_session(text, text)
  to anon, authenticated;
grant execute on function public.sync_study_time_days(text, jsonb)
  to anon, authenticated;
grant execute on function public.get_study_time_history(text)
  to anon, authenticated;

comment on function public.create_study_time_session(text, text) is
  'Validates a WaniKani token without retaining it and returns a five-minute, device-bound study-time capability.';
comment on function public.sync_study_time_days(text, jsonb) is
  'Validates and monotonically upserts absolute study-time totals for the account and device bound to a short-lived capability.';
comment on function public.get_study_time_history(text) is
  'Returns verified, aggregated other-device study-time history for the account bound to a short-lived capability.';

commit;
