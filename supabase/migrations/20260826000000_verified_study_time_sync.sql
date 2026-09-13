-- Harden study-time rows now that they are used for account-visible history.
--
-- Older app versions write through upsert_study_time_days() with the public
-- anon key and provide their own user_id. Those writes were acceptable while
-- the table was private developer analytics, but they must not be allowed to
-- change user-visible totals. Legacy rows have no server-verification evidence
-- and remain quarantined from account-visible history. Future verified writes
-- go through an Edge Function / web server that validates the WaniKani token,
-- then calls the service-role-only function below.

alter table public.study_time_days
  add column if not exists verified boolean not null default false;

alter table public.study_time_days
  add column if not exists verified_at timestamptz;

-- Fail closed if an earlier draft of this migration marked legacy rows trusted:
-- only rows carrying the server-written verification timestamp are eligible.
update public.study_time_days
set verified = false
where verified_at is null;

drop index if exists public.study_time_days_verified_user_day_idx;
create index if not exists study_time_days_verified_user_day_idx
  on public.study_time_days (user_id, day)
  where verified and verified_at is not null;

-- Legacy write path retained so older clients fail softly: they may create or
-- update unverified analytics rows, but cannot alter a verified row and their
-- data is excluded from account-visible history.
create or replace function public.upsert_study_time_days(rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if rows is null or jsonb_typeof(rows) <> 'array' then
    raise exception 'rows must be a jsonb array';
  end if;
  if jsonb_array_length(rows) > 31 then
    raise exception 'too many rows in one push';
  end if;

  insert into public.study_time_days
    (user_id, device_id, day, activity_ms, study_total_ms, app_total_ms,
     user_name, user_level, app_version, platform, updated_at, verified)
  select
    r->>'user_id',
    r->>'device_id',
    (r->>'day')::date,
    coalesce(r->'activity_ms', '{}'::jsonb),
    coalesce((r->>'study_total_ms')::bigint, 0),
    coalesce((r->>'app_total_ms')::bigint, 0),
    nullif(r->>'user_name', ''),
    (r->>'user_level')::integer,
    nullif(r->>'app_version', ''),
    nullif(r->>'platform', ''),
    coalesce((r->>'updated_at')::timestamptz, now()),
    false
  from jsonb_array_elements(rows) as r
  where coalesce(r->>'user_id', '') <> ''
    and coalesce(r->>'device_id', '') <> ''
    and (r->>'day') is not null
  on conflict (user_id, device_id, day) do update set
    activity_ms = excluded.activity_ms,
    study_total_ms = greatest(study_time_days.study_total_ms, excluded.study_total_ms),
    app_total_ms = greatest(study_time_days.app_total_ms, excluded.app_total_ms),
    user_name = excluded.user_name,
    user_level = excluded.user_level,
    app_version = excluded.app_version,
    platform = excluded.platform,
    updated_at = excluded.updated_at
  where not study_time_days.verified;
end;
$$;

revoke all on function public.upsert_study_time_days(jsonb) from public;
grant execute on function public.upsert_study_time_days(jsonb) to anon, authenticated;

-- Merge absolute per-activity totals monotonically. This makes verified
-- retries and out-of-order requests safe for both totals and breakdowns.
create or replace function public.merge_study_time_activity_ms(
  existing jsonb,
  incoming jsonb
)
returns jsonb
language sql
immutable
parallel safe
set search_path = public
as $$
  select coalesce(
    jsonb_object_agg(
      keys.key,
      to_jsonb(greatest(
        coalesce((existing->>keys.key)::bigint, 0),
        coalesce((incoming->>keys.key)::bigint, 0)
      ))
    ),
    '{}'::jsonb
  )
  from (
    select jsonb_object_keys(coalesce(existing, '{}'::jsonb)) as key
    union
    select jsonb_object_keys(coalesce(incoming, '{}'::jsonb)) as key
  ) as keys;
$$;

revoke all on function public.merge_study_time_activity_ms(jsonb, jsonb) from public;

create or replace function public.upsert_verified_study_time_days(rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if rows is null or jsonb_typeof(rows) <> 'array' then
    raise exception 'rows must be a jsonb array';
  end if;
  if jsonb_array_length(rows) > 31 then
    raise exception 'too many rows in one push';
  end if;

  insert into public.study_time_days
    (user_id, device_id, day, activity_ms, study_total_ms, app_total_ms,
     user_name, user_level, app_version, platform, updated_at, verified,
     verified_at)
  select
    r->>'user_id',
    r->>'device_id',
    (r->>'day')::date,
    coalesce(r->'activity_ms', '{}'::jsonb),
    coalesce((r->>'study_total_ms')::bigint, 0),
    coalesce((r->>'app_total_ms')::bigint, 0),
    nullif(r->>'user_name', ''),
    (r->>'user_level')::integer,
    nullif(r->>'app_version', ''),
    nullif(r->>'platform', ''),
    coalesce((r->>'updated_at')::timestamptz, now()),
    true,
    now()
  from jsonb_array_elements(rows) as r
  where coalesce(r->>'user_id', '') <> ''
    and coalesce(r->>'device_id', '') <> ''
    and (r->>'day') is not null
  on conflict (user_id, device_id, day) do update set
    activity_ms = case
      when study_time_days.verified and study_time_days.verified_at is not null
        then public.merge_study_time_activity_ms(
          study_time_days.activity_ms,
          excluded.activity_ms
        )
      else excluded.activity_ms
    end,
    study_total_ms = case
      when study_time_days.verified and study_time_days.verified_at is not null
        then greatest(study_time_days.study_total_ms, excluded.study_total_ms)
      else excluded.study_total_ms
    end,
    app_total_ms = case
      when study_time_days.verified and study_time_days.verified_at is not null
        then greatest(study_time_days.app_total_ms, excluded.app_total_ms)
      else excluded.app_total_ms
    end,
    user_name = excluded.user_name,
    user_level = excluded.user_level,
    app_version = excluded.app_version,
    platform = excluded.platform,
    updated_at = excluded.updated_at,
    verified = true,
    verified_at = coalesce(study_time_days.verified_at, excluded.verified_at);
end;
$$;

revoke all on function public.upsert_verified_study_time_days(jsonb) from public;
revoke all on function public.upsert_verified_study_time_days(jsonb) from anon, authenticated;
grant execute on function public.upsert_verified_study_time_days(jsonb) to service_role;
