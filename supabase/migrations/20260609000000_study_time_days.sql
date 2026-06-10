-- Study/app time tracking rollups, pushed by the app for developer analytics.
--
-- The client calls the upsert_study_time_days() function with ABSOLUTE day
-- totals keyed by (user_id, device_id, day). Values only ever grow on the
-- device (and totals are merged with greatest() server-side), so duplicate or
-- retried requests can never double count time.
--
-- Clients have NO direct table access (no grants, RLS enabled, no policies):
-- the security definer function is the only write path, and nothing can read
-- the data back except the dashboard / service role.
--
-- Safe to re-run: recreates the function and re-applies grants/locks.
--
-- Example developer queries:
--   total in-app hours per day across all users:
--     select day, round(sum(app_total_ms) / 3600000.0, 1) as hours
--     from public.study_time_days group by day order by day desc;
--   per-user totals:
--     select user_id, max(user_name) as user_name,
--            round(sum(app_total_ms) / 3600000.0, 1) as app_hours,
--            round(sum(study_total_ms) / 3600000.0, 1) as study_hours
--     from public.study_time_days group by user_id order by app_hours desc;

create table if not exists public.study_time_days (
  user_id text not null,
  device_id text not null,
  day date not null,
  -- Per-activity milliseconds, e.g. {"reviews": 1200000, "news": 300000}
  activity_ms jsonb not null default '{}'::jsonb,
  study_total_ms bigint not null default 0,
  app_total_ms bigint not null default 0,
  user_name text,
  user_level integer,
  app_version text,
  platform text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, device_id, day)
);

create index if not exists study_time_days_day_idx
  on public.study_time_days (day);
create index if not exists study_time_days_user_day_idx
  on public.study_time_days (user_id, day);

-- Lock the table down completely for client roles. Reads and writes both go
-- through code that bypasses RLS (the function below / dashboard / service
-- role), so no client-facing grants or policies are needed at all.
alter table public.study_time_days enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'study_time_days'
  loop
    execute format('drop policy %I on public.study_time_days', p.policyname);
  end loop;
end $$;

revoke all on public.study_time_days from anon, authenticated;

-- The single write path for clients. SECURITY DEFINER runs as the function
-- owner (table owner), so client roles need no table privileges and RLS does
-- not apply inside. Totals merge with greatest() so out-of-order or repeated
-- pushes of absolute values stay monotonic.
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
     user_name, user_level, app_version, platform, updated_at)
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
    coalesce((r->>'updated_at')::timestamptz, now())
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
    updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.upsert_study_time_days(jsonb) from public;
grant execute on function public.upsert_study_time_days(jsonb) to anon, authenticated;
