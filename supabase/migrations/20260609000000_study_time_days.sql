-- Study/app time tracking rollups, pushed by the app for developer analytics.
--
-- The client upserts ABSOLUTE day totals keyed by (user_id, device_id, day).
-- Values only ever grow on the device, so duplicate or retried requests
-- simply rewrite the same row and can never double count time.
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

alter table public.study_time_days enable row level security;

-- Table-level privileges (RLS still applies on top of these). SELECT is
-- granted because upserts (INSERT ... ON CONFLICT DO UPDATE) may need to read
-- conflicting rows, but clients still cannot SELECT data: there is no SELECT
-- policy, so RLS returns nothing for reads.
grant select, insert, update on public.study_time_days to anon, authenticated;

-- Same trust model as app_sessions: clients write with the anon key but can
-- never read usage data back. Developer access goes through the dashboard or
-- the service role, which bypass RLS.
drop policy if exists "Clients can insert study time rows" on public.study_time_days;
create policy "Clients can insert study time rows"
  on public.study_time_days
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Clients can update study time rows" on public.study_time_days;
create policy "Clients can update study time rows"
  on public.study_time_days
  for update
  to anon, authenticated
  using (true)
  with check (true);
