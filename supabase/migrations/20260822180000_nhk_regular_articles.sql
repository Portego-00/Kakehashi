-- Server-managed cache for regular NHK News articles.
--
-- An earlier prototype used this table name with translation-oriented columns
-- such as headline and paragraphs_ja. The additive migration below preserves
-- those rows while upgrading the table to the sanitized full-article shape.

create table if not exists public.nhk_regular_articles (
  id text primary key,
  title text not null,
  canonical_url text not null,
  guid text not null,
  published_at timestamptz not null,
  source_updated_at timestamptz,
  image_url text,
  audio_url text,
  content_html text not null default '',
  is_full_article boolean not null default false,
  content_hash text not null,
  scraped_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.nhk_regular_articles
  add column if not exists title text,
  add column if not exists canonical_url text,
  add column if not exists guid text,
  add column if not exists published_at timestamptz,
  add column if not exists source_updated_at timestamptz,
  add column if not exists image_url text,
  add column if not exists audio_url text,
  add column if not exists content_html text,
  add column if not exists is_full_article boolean,
  add column if not exists content_hash text,
  add column if not exists scraped_at timestamptz,
  add column if not exists last_seen_at timestamptz,
  add column if not exists created_at timestamptz;

-- Carry useful metadata forward from the earlier prototype if it is present.
do $legacy_backfill$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'nhk_regular_articles'
      and column_name = 'headline'
  ) then
    execute $sql$
      update public.nhk_regular_articles
      set title = coalesce(title, headline)
      where title is null
    $sql$;

    execute $sql$
      alter table public.nhk_regular_articles
      alter column headline drop not null
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'nhk_regular_articles'
      and column_name = 'date_published'
  ) then
    execute $sql$
      update public.nhk_regular_articles
      set published_at = coalesce(published_at, date_published)
      where published_at is null
    $sql$;

    execute $sql$
      alter table public.nhk_regular_articles
      alter column date_published drop not null
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'nhk_regular_articles'
      and column_name = 'date_modified'
  ) then
    execute $sql$
      update public.nhk_regular_articles
      set source_updated_at = coalesce(source_updated_at, date_modified)
      where source_updated_at is null
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'nhk_regular_articles'
      and column_name = 'fetched_at'
  ) then
    execute $sql$
      update public.nhk_regular_articles
      set scraped_at = coalesce(scraped_at, fetched_at)
      where scraped_at is null
    $sql$;
  end if;
end;
$legacy_backfill$;

update public.nhk_regular_articles
set
  title = coalesce(nullif(btrim(title), ''), id),
  canonical_url = coalesce(
    nullif(btrim(canonical_url), ''),
    'https://news.web.nhk/newsweb/na/' || id
  ),
  guid = coalesce(
    nullif(btrim(guid), ''),
    nullif(btrim(canonical_url), ''),
    'https://news.web.nhk/newsweb/na/' || id
  ),
  published_at = coalesce(published_at, created_at, now()),
  content_html = coalesce(content_html, ''),
  is_full_article = coalesce(is_full_article, false),
  content_hash = coalesce(
    nullif(content_hash, ''),
    md5(coalesce(title, id) || E'\n' || coalesce(content_html, ''))
  ),
  scraped_at = coalesce(scraped_at, created_at, now()),
  last_seen_at = coalesce(last_seen_at, scraped_at, created_at, now()),
  created_at = coalesce(created_at, now());

alter table public.nhk_regular_articles
  alter column title set not null,
  alter column canonical_url set not null,
  alter column guid set not null,
  alter column published_at set not null,
  alter column content_html set default '',
  alter column content_html set not null,
  alter column is_full_article set default false,
  alter column is_full_article set not null,
  alter column content_hash set not null,
  alter column scraped_at set default now(),
  alter column scraped_at set not null,
  alter column last_seen_at set default now(),
  alter column last_seen_at set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

create unique index if not exists nhk_regular_articles_canonical_url_idx
  on public.nhk_regular_articles (canonical_url);

create index if not exists nhk_regular_articles_published_at_idx
  on public.nhk_regular_articles (published_at desc);

create index if not exists nhk_regular_articles_last_seen_at_idx
  on public.nhk_regular_articles (last_seen_at desc);

alter table public.nhk_regular_articles enable row level security;

drop policy if exists "NHK regular articles are publicly readable"
  on public.nhk_regular_articles;

create policy "NHK regular articles are publicly readable"
  on public.nhk_regular_articles
  for select
  to anon, authenticated
  using (true);

-- Client roles may read complete cached stories but may never mutate them. The
-- sync function uses the service role, which bypasses RLS on hosted projects.
revoke all privileges on table public.nhk_regular_articles
  from public, anon, authenticated;

grant select on table public.nhk_regular_articles
  to anon, authenticated;

grant select, insert, update, delete on table public.nhk_regular_articles
  to service_role;

comment on table public.nhk_regular_articles is
  'Server-managed regular NHK News cache. Populate only when NHK authorization and content-display rights permit it.';

comment on column public.nhk_regular_articles.content_html is
  'Sanitized article markup or an RSS summary; is_full_article distinguishes the two.';

comment on column public.nhk_regular_articles.content_hash is
  'Sync-defined hash used to avoid rewriting unchanged article content.';
