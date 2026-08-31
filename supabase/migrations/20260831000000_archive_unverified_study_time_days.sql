-- Preserve unverified study-time rows before verified uploads can replace a
-- row at the live table's (user_id, device_id, day) primary key.
--
-- This is intentionally additive and safe to re-run. Deploy it before the
-- study-time Edge Functions so the initial archive and conflict trigger are in
-- place before any verified upload is accepted.

-- Hold off legacy and verified writers until both the backfill and the
-- conflict trigger are installed. Reads remain available during the migration.
begin;

lock table public.study_time_days in share row exclusive mode;

create table if not exists public.study_time_days_unverified_archive (
  archive_id bigint generated always as identity primary key,
  user_id text not null,
  device_id text not null,
  day date not null,
  source_row jsonb not null,
  snapshot_fingerprint text not null,
  archive_reason text not null,
  archived_at timestamptz not null default now()
);

create unique index if not exists study_time_days_unverified_archive_snapshot_idx
  on public.study_time_days_unverified_archive
    (user_id, device_id, day, snapshot_fingerprint);

alter table public.study_time_days_unverified_archive enable row level security;
revoke all on public.study_time_days_unverified_archive
  from public, anon, authenticated;

-- Service-side inserts are the archive's only mutation. Even privileged
-- accidental UPDATE, DELETE, or TRUNCATE statements fail instead of silently
-- weakening the preservation guarantee.
create or replace function public.reject_study_time_archive_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'study_time_days_unverified_archive is append-only';
  return null;
end;
$$;

revoke all on function public.reject_study_time_archive_mutation()
  from public;

drop trigger if exists reject_study_time_archive_update_or_delete
  on public.study_time_days_unverified_archive;
create trigger reject_study_time_archive_update_or_delete
before update or delete on public.study_time_days_unverified_archive
for each statement
execute function public.reject_study_time_archive_mutation();

drop trigger if exists reject_study_time_archive_truncate
  on public.study_time_days_unverified_archive;
create trigger reject_study_time_archive_truncate
before truncate on public.study_time_days_unverified_archive
for each statement
execute function public.reject_study_time_archive_mutation();

insert into public.study_time_days_unverified_archive
  (user_id, device_id, day, source_row, snapshot_fingerprint, archive_reason)
select
  source.user_id,
  source.device_id,
  source.day,
  to_jsonb(source),
  md5(to_jsonb(source)::text),
  'pre_verification_snapshot'
from public.study_time_days as source
where not source.verified or source.verified_at is null
on conflict (user_id, device_id, day, snapshot_fingerprint)
do nothing;

-- A row-level BEFORE trigger captures the locked, conflicting OLD row before
-- an unverified row can be replaced by a verified upsert.
create or replace function public.archive_study_time_day_before_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  snapshot jsonb;
begin
  if (not old.verified or old.verified_at is null)
     and new.verified and new.verified_at is not null then
    snapshot := to_jsonb(old);
    insert into public.study_time_days_unverified_archive
      (user_id, device_id, day, source_row, snapshot_fingerprint,
       archive_reason)
    values
      (old.user_id, old.device_id, old.day, snapshot, md5(snapshot::text),
       'verified_conflict')
    on conflict (user_id, device_id, day, snapshot_fingerprint)
    do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.archive_study_time_day_before_verification()
  from public;

drop trigger if exists archive_study_time_day_before_verification
  on public.study_time_days;
create trigger archive_study_time_day_before_verification
before update on public.study_time_days
for each row
execute function public.archive_study_time_day_before_verification();

commit;
