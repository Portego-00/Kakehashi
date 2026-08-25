-- Correct already-deployed NHK ingestion scaffolding without rewriting its
-- migration history.
--
-- 1. Legacy prototype tables may still contain translation-era required
--    columns that the normalized importer no longer writes. Relax only those
--    non-contract columns that have neither a default nor a generated value.
-- 2. pg_net defaults to a two-second request timeout. Give the importer enough
--    time to finish while remaining below Supabase's 150-second request idle
--    limit.

do $relax_legacy_required_columns$
declare
  legacy_column record;
  contract_columns constant text[] := array[
    'id',
    'title',
    'canonical_url',
    'guid',
    'published_at',
    'source_updated_at',
    'image_url',
    'audio_url',
    'content_html',
    'is_full_article',
    'content_hash',
    'scraped_at',
    'last_seen_at',
    'created_at'
  ];
begin
  if to_regclass('public.nhk_regular_articles') is null then
    raise exception using
      errcode = '42P01',
      message = 'public.nhk_regular_articles must exist before applying the hardening migration';
  end if;

  for legacy_column in
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'nhk_regular_articles'
      and column_name <> all (contract_columns)
      and is_nullable = 'NO'
      and column_default is null
      and is_identity = 'NO'
      and is_generated = 'NEVER'
    order by ordinal_position
  loop
    if exists (
      select 1
      from pg_constraint as constraint_definition
      join pg_class as table_definition
        on table_definition.oid = constraint_definition.conrelid
      join pg_namespace as table_schema
        on table_schema.oid = table_definition.relnamespace
      join pg_attribute as constrained_column
        on constrained_column.attrelid = table_definition.oid
       and constrained_column.attname = legacy_column.column_name
       and constrained_column.attnum = any (constraint_definition.conkey)
      where table_schema.nspname = 'public'
        and table_definition.relname = 'nhk_regular_articles'
        and constraint_definition.contype = 'p'
    ) then
      raise exception using
        errcode = '55000',
        message = format(
          'Legacy primary-key column public.nhk_regular_articles.%I requires a manual migration',
          legacy_column.column_name
        );
    end if;

    execute format(
      'alter table public.nhk_regular_articles alter column %I drop not null',
      legacy_column.column_name
    );
  end loop;
end;
$relax_legacy_required_columns$;

create schema if not exists private;

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
      body := $3,
      timeout_milliseconds := $4
    )
  $request$
  into request_id
  using
    project_url || '/functions/v1/sync-nhk-regular-news',
    jsonb_build_object(
      'Content-Type', 'application/json',
      'x-nhk-sync-secret', sync_secret
    ),
    '{}'::jsonb,
    140000;

  return request_id;
exception
  when others then
    -- Never include exception text: upstream errors can echo request details.
    raise warning 'NHK regular news sync invocation skipped (SQLSTATE %)', sqlstate;
    return null;
end;
$function$;

revoke all on function private.invoke_sync_nhk_regular_news()
  from public, anon, authenticated, service_role;

comment on function private.invoke_sync_nhk_regular_news() is
  'Queues a Vault-authenticated NHK sync with a 140-second pg_net timeout.';
