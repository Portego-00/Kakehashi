# Regular NHK News ingestion operations

This document covers the storage and scheduling scaffolding for the
`sync-nhk-regular-news` Edge Function. The scaffolding does not authorize access
to NHK or provide NHK credentials.

The included importer reproduces NHK ONE's accountless reader confirmation in a
short-lived server session. Before enabling it in production, confirm that your
use is permitted to cover automated retrieval, temporary storage, images, and
in-app display. The importer never accepts or forwards an end user's NHK,
WaniKani, or JPDB credentials.

## Required configuration

The Edge Function endpoint has Supabase JWT verification disabled because it is
called by `pg_net`. It must reject every request whose `x-nhk-sync-secret`
header does not match its Edge Function secret.

Generate one random secret of at least 32 characters and store the same value as
an Edge Function secret:

```sh
export NHK_REGULAR_NEWS_SYNC_SECRET="$(openssl rand -hex 32)"
supabase secrets set \
  NHK_REGULAR_NEWS_SYNC_SECRET="$NHK_REGULAR_NEWS_SYNC_SECRET"
```

The scheduling migration enables `pg_cron` and `pg_net`. Supabase Vault is
available on hosted projects. The authenticated bootstrap call below stores or
rotates the project URL and shared secret in Vault without putting either value
in `cron.job` or a migration file.

## Deploy and schedule

1. Apply these migrations in order:

   - `20260822180000_nhk_regular_articles.sql`
   - `20260822181000_schedule_nhk_regular_news.sql`
   - `20260822182000_harden_nhk_regular_news_sync.sql`

   The final corrective migration is required for both new and existing
   deployments. Its compatibility guard relaxes only obsolete required columns
   that have no default; it is a schema no-op where the earlier translation
   columns already default to empty arrays. It also raises pg_net's request
   timeout from its two-second default to 140 seconds, below the hosted Edge
   request idle limit.

2. Configure the Edge Function secret as shown above.
3. Deploy the function. The `supabase/config.toml` entry already sets
   `verify_jwt = false`:

   ```sh
   supabase functions deploy sync-nhk-regular-news
   ```

4. Bootstrap Vault and immediately run the first import. Replace `PROJECT_REF`
   with the linked project reference:

   ```sh
   curl --fail-with-body --silent --show-error \
     -X POST \
     "https://PROJECT_REF.supabase.co/functions/v1/sync-nhk-regular-news" \
     -H "x-nhk-sync-secret: $NHK_REGULAR_NEWS_SYNC_SECRET" \
     -H "x-nhk-bootstrap: true"

   curl --fail-with-body --silent --show-error \
     -X POST \
     "https://PROJECT_REF.supabase.co/functions/v1/sync-nhk-regular-news" \
     -H "x-nhk-sync-secret: $NHK_REGULAR_NEWS_SYNC_SECRET"

   unset NHK_REGULAR_NEWS_SYNC_SECRET
   ```

5. Confirm the job, the queued HTTP result, and a recent complete row:

   ```sql
   select jobid, jobname, schedule, active
   from cron.job
   where jobname = 'sync-nhk-regular-news';

   select *
   from cron.job_run_details
   where jobid = (
     select jobid from cron.job where jobname = 'sync-nhk-regular-news'
   )
   order by start_time desc
   limit 20;

   select id, status_code, timed_out, error_msg, created
   from net._http_response
   order by created desc
   limit 20;

   select id, published_at, scraped_at, length(content_html) as content_length
   from public.nhk_regular_articles
   where is_full_article = true
   order by scraped_at desc
   limit 20;
   ```

The job runs every 30 minutes. It queues one request through `pg_net`; the
secret is read from Vault at run time and is not embedded in `cron.job`. A
healthy run has a 2xx pg_net response and a recently scraped full row with a
nontrivial `content_length`; a successful `cron.job_run_details` row alone only
proves that PostgreSQL queued the request.

## Upgrade an existing deployment

If the first two NHK migrations or an earlier version of the Edge Function are
already deployed:

1. Apply only pending migrations, including
   `20260822182000_harden_nhk_regular_news_sync.sql`.
2. Redeploy `sync-nhk-regular-news` so streamed body limits and conservative
   lead-only completeness checks take effect.
3. Repeat the authenticated manual import command from step 4 above.
4. Run all three verification queries from step 5. Do not treat the upgrade as
   complete until pg_net reports 2xx and a fresh full row exists.

## Disable or roll back

Disable ingestion without removing stored rows:

```sql
select cron.unschedule('sync-nhk-regular-news');
```

Rotate or delete both copies of the shared secret after disabling the job. A
missing Vault secret also makes the private invoker a no-op.

To remove the database scaffolding after the job is disabled:

```sql
drop function if exists private.invoke_sync_nhk_regular_news();
drop function if exists public.configure_nhk_regular_news_sync(text, text);
drop table if exists public.nhk_regular_articles;
```

Only drop the `private` schema if it is empty and no other feature uses it.
Removing the table permanently deletes cached article rows, so export anything
that the NHK authorization permits retaining before running the rollback.
