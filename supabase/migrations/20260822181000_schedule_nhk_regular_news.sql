-- Schedule the regular NHK News sync without copying secrets into cron.job.
--
-- Required Vault secret names:
--   nhk_regular_news_project_url  e.g. https://<project-ref>.supabase.co
--   nhk_regular_news_sync_secret  shared with the Edge Function secret
--
-- The private invoker deliberately returns NULL without making a request when
-- Vault, pg_net, or either secret is unavailable. This makes later extension
-- maintenance and secret rotation safe.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

-- The Edge Function calls this once during its authenticated bootstrap. Keeping
-- the function in the exposed schema lets PostgREST route the service-role RPC;
-- explicit grants prevent client roles from invoking it.
create or replace function public.configure_nhk_regular_news_sync(
  p_project_url text,
  p_sync_secret text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  normalized_project_url text;
  project_url_secret_id uuid;
  sync_secret_id uuid;
begin
  normalized_project_url := regexp_replace(
    btrim(coalesce(p_project_url, '')),
    '/+$',
    ''
  );
  p_sync_secret := btrim(coalesce(p_sync_secret, ''));

  if normalized_project_url !~ '^https://[A-Za-z0-9.-]+$'
     or length(p_sync_secret) < 32 then
    raise exception using
      errcode = '22023',
      message = 'Invalid NHK regular news sync configuration';
  end if;

  if to_regclass('vault.secrets') is null then
    raise exception using
      errcode = '55000',
      message = 'Supabase Vault is unavailable';
  end if;

  execute $sql$
    select id
    from vault.secrets
    where name = 'nhk_regular_news_project_url'
    order by created_at desc
    limit 1
  $sql$
  into project_url_secret_id;

  if project_url_secret_id is null then
    execute $sql$
      select vault.create_secret($1, $2, $3)
    $sql$
    using
      normalized_project_url,
      'nhk_regular_news_project_url',
      'Project origin used by the NHK sync cron job';
  else
    execute $sql$
      select vault.update_secret($1, $2, $3, $4)
    $sql$
    using
      project_url_secret_id,
      normalized_project_url,
      'nhk_regular_news_project_url',
      'Project origin used by the NHK sync cron job';
  end if;

  execute $sql$
    select id
    from vault.secrets
    where name = 'nhk_regular_news_sync_secret'
    order by created_at desc
    limit 1
  $sql$
  into sync_secret_id;

  if sync_secret_id is null then
    execute $sql$
      select vault.create_secret($1, $2, $3)
    $sql$
    using
      p_sync_secret,
      'nhk_regular_news_sync_secret',
      'Shared secret used only to invoke the NHK sync function';
  else
    execute $sql$
      select vault.update_secret($1, $2, $3, $4)
    $sql$
    using
      sync_secret_id,
      p_sync_secret,
      'nhk_regular_news_sync_secret',
      'Shared secret used only to invoke the NHK sync function';
  end if;
end;
$function$;

revoke all on function public.configure_nhk_regular_news_sync(text, text)
  from public, anon, authenticated;

grant execute on function public.configure_nhk_regular_news_sync(text, text)
  to service_role;

create or replace function private.invoke_sync_nhk_regular_news()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  project_url text;
  sync_secret text;
  request_id bigint;
begin
  if to_regclass('vault.decrypted_secrets') is null then
    return null;
  end if;

  if not exists (
    select 1
    from pg_proc as procedure
    join pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'net'
      and procedure.proname = 'http_post'
  ) then
    return null;
  end if;

  execute $vault$
    select
      (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'nhk_regular_news_project_url'
        order by created_at desc
        limit 1
      ),
      (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'nhk_regular_news_sync_secret'
        order by created_at desc
        limit 1
      )
  $vault$
  into project_url, sync_secret;

  project_url := regexp_replace(btrim(coalesce(project_url, '')), '/+$', '');
  sync_secret := btrim(coalesce(sync_secret, ''));

  if project_url !~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?$'
     or length(sync_secret) < 32 then
    return null;
  end if;

  execute $request$
    select net.http_post(
      url := $1,
      headers := $2,
      body := $3
    )
  $request$
  into request_id
  using
    project_url || '/functions/v1/sync-nhk-regular-news',
    jsonb_build_object(
      'Content-Type', 'application/json',
      'x-nhk-sync-secret', sync_secret
    ),
    '{}'::jsonb;

  return request_id;
exception
  when others then
    -- Do not include exception text: upstream errors can echo request details.
    raise warning 'NHK regular news sync invocation skipped (SQLSTATE %)', sqlstate;
    return null;
end;
$function$;

revoke all on function private.invoke_sync_nhk_regular_news()
  from public, anon, authenticated, service_role;

comment on function private.invoke_sync_nhk_regular_news() is
  'Reads the NHK sync URL/secret from Vault and queues a guarded pg_net request.';

-- Stop only the obsolete prototype job, if one exists. The deployed function
-- itself remains available for rollback but no longer receives scheduled calls.
do $disable_legacy_schedule$
declare
  legacy_job record;
begin
  if to_regclass('cron.job') is null then
    return;
  end if;

  for legacy_job in
    select jobid
    from cron.job
    where jobname = 'nhk-news-scraper'
       or command like '%/functions/v1/nhk-news-scraper%'
  loop
    perform cron.unschedule(legacy_job.jobid);
  end loop;
end;
$disable_legacy_schedule$;

do $schedule$
declare
  scheduled_job_id bigint;
begin
  if not exists (
    select 1
    from pg_proc as procedure
    join pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'cron'
      and procedure.proname = 'schedule'
  ) then
    raise notice 'NHK regular news sync was not scheduled: pg_cron is not enabled.';
    return;
  end if;

  begin
    execute 'select cron.schedule($1, $2, $3)'
      into scheduled_job_id
      using
        'sync-nhk-regular-news',
        '*/30 * * * *',
        'select private.invoke_sync_nhk_regular_news();';

    raise notice 'NHK regular news sync scheduled as cron job %.', scheduled_job_id;
  exception
    when others then
      raise notice 'NHK regular news sync was not scheduled (SQLSTATE %).', sqlstate;
  end;
end;
$schedule$;
