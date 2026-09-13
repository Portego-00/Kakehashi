-- Read the complete streak history as one date per active day. Returning a
-- scalar JSON object avoids PostgREST's row limit and session-history paging.
-- app_sessions stays the source of truth; no rows or existing policies change.
create or replace function public.get_app_session_active_days(
  p_user_id text,
  p_timezone text default 'UTC'
) returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if p_user_id is null or pg_catalog.btrim(p_user_id) = '' then
    raise exception using errcode = '22023', message = 'A user ID is required';
  end if;
  if p_timezone is null or pg_catalog.btrim(p_timezone) = '' then
    raise exception using errcode = '22023', message = 'A timezone is required';
  end if;

  -- Validate even when this account has no sessions. Clients send their IANA
  -- timezone; timezone() raises 22023 for an unsupported name. Do not silently
  -- substitute UTC, which could move activity to a different calendar day.
  perform pg_catalog.timezone(p_timezone, timestamptz '2000-01-01 00:00:00+00');

  select pg_catalog.jsonb_build_object(
    'activeDays',
    coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.to_char(days.active_day, 'YYYY-MM-DD')
        order by days.active_day
      ),
      '[]'::jsonb
    )
  ) into v_result
  from (
    select distinct
      (sessions.session_started_at at time zone p_timezone)::date as active_day
    from public.app_sessions as sessions
    where sessions.user_id = p_user_id
      and pg_catalog.isfinite(sessions.session_started_at)
  ) as days;

  return v_result;
end;
$$;

-- Native clients use the existing anonymous SELECT policy; the web server may
-- use a service role. SECURITY INVOKER keeps table grants and RLS authoritative.
revoke all on function public.get_app_session_active_days(text, text) from public;
grant execute on function public.get_app_session_active_days(text, text)
  to anon, authenticated, service_role;

comment on function public.get_app_session_active_days(text, text) is
  'Complete distinct app-session dates in the requested timezone. Read-only; respects caller table permissions and RLS.';
