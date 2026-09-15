-- Private, durable delivery to one explicitly approved iPhone installation.
create schema if not exists private;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create table private.issue_activity_push_destination (
  singleton boolean primary key default true check (singleton),
  owner_id text not null,
  installation_id uuid not null,
  expo_push_token text not null check (expo_push_token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$'),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table private.issue_activity_push_outbox (
  id uuid primary key default gen_random_uuid(),
  source_table text not null,
  source_id uuid not null,
  issue_id uuid not null,
  actor_id text,
  activity_type text not null check (activity_type in ('issue_created', 'issue_comment_created', 'issue_liked', 'issue_comment_liked')),
  title text not null,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'awaiting_receipt', 'checking_receipt', 'delivered', 'failed', 'skipped')),
  attempts integer not null default 0,
  receipt_attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  claim_id uuid,
  locked_at timestamptz,
  ticket_id text,
  push_token text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_table, source_id)
);
create index issue_activity_push_due_idx on private.issue_activity_push_outbox (next_attempt_at, created_at)
  where status in ('pending', 'sending', 'awaiting_receipt', 'checking_receipt');
alter table private.issue_activity_push_destination enable row level security;
alter table private.issue_activity_push_outbox enable row level security;
revoke all on private.issue_activity_push_destination, private.issue_activity_push_outbox from public, anon, authenticated, service_role;

create or replace function private.invoke_issue_activity_push()
returns bigint language plpgsql security definer set search_path = pg_catalog as $$
declare v_url text; v_secret text; v_request bigint;
begin
  if not exists (select 1 from private.issue_activity_push_destination) then return null; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'issue_activity_push_project_url' order by created_at desc limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'issue_activity_push_webhook_secret' order by created_at desc limit 1;
  if coalesce(v_url, '') !~ '^https://[A-Za-z0-9.-]+$' or length(coalesce(v_secret, '')) < 32 then return null; end if;
  select net.http_post(
    url := v_url || '/functions/v1/issue-activity-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-issue-activity-secret', v_secret),
    body := '{}'::jsonb, timeout_milliseconds := 120000
  ) into v_request;
  return v_request;
exception when others then
  -- Notification transport failure must never prevent a community write.
  raise warning 'Issue activity push wakeup failed (SQLSTATE %)', sqlstate;
  return null;
end $$;

create or replace function private.enqueue_issue_activity_push()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare v_issue_id uuid; v_issue_title text; v_title text; v_body text; v_type text; v_actor text; v_owner text;
begin
  v_actor := new.user_id::text;
  select owner_id into v_owner from private.issue_activity_push_destination where singleton;
  if v_owner is not null and v_actor = v_owner then return new; end if;
  if tg_table_name = 'issues' then
    v_issue_id := new.id; v_type := 'issue_created'; v_title := 'New issue';
    v_body := coalesce(nullif(new.user_username, ''), 'Someone') || ': ' || left(new.title, 110);
  elsif tg_table_name = 'issue_comments' then
    v_issue_id := new.issue_id; v_type := 'issue_comment_created'; v_title := 'New issue comment';
    select title into v_issue_title from public.issues where id = v_issue_id;
    v_body := coalesce(nullif(new.user_username, ''), 'Someone') || ' on ' || left(coalesce(v_issue_title, 'an issue'), 54) || ': ' || left(new.content, 90);
  elsif tg_table_name = 'issue_likes' then
    v_issue_id := new.issue_id; v_type := 'issue_liked'; v_title := 'Issue liked';
    select title into v_issue_title from public.issues where id = v_issue_id;
    v_body := 'Someone liked ' || left(coalesce(v_issue_title, 'an issue'), 100);
  elsif tg_table_name = 'comment_likes' then
    select issue_id into v_issue_id from public.issue_comments where id = new.comment_id;
    if v_issue_id is null then return new; end if;
    v_type := 'issue_comment_liked'; v_title := 'Comment liked';
    select title into v_issue_title from public.issues where id = v_issue_id;
    v_body := 'Someone liked a comment on ' || left(coalesce(v_issue_title, 'an issue'), 86);
  else return new;
  end if;
  insert into private.issue_activity_push_outbox (source_table, source_id, issue_id, actor_id, activity_type, title, body)
  values (tg_table_name, new.id, v_issue_id, v_actor, v_type, v_title, left(regexp_replace(v_body, '\s+', ' ', 'g'), 240))
  on conflict (source_table, source_id) do nothing;
  if found then perform private.invoke_issue_activity_push(); end if;
  return new;
end $$;

create trigger issue_activity_push_insert after insert on public.issues for each row execute function private.enqueue_issue_activity_push();
create trigger issue_activity_push_insert after insert on public.issue_comments for each row execute function private.enqueue_issue_activity_push();
create trigger issue_activity_push_insert after insert on public.issue_likes for each row execute function private.enqueue_issue_activity_push();
create trigger issue_activity_push_insert after insert on public.comment_likes for each row execute function private.enqueue_issue_activity_push();

-- Only the Edge Function can register, after checking both server-pinned IDs.
create or replace function public.register_issue_activity_push(p_owner_id text, p_installation_id uuid, p_expo_push_token text)
returns boolean language plpgsql security definer set search_path = pg_catalog as $$
begin
  insert into private.issue_activity_push_destination (owner_id, installation_id, expo_push_token)
  values (p_owner_id, p_installation_id, p_expo_push_token)
  on conflict (singleton) do update set expo_push_token = excluded.expo_push_token, enabled = true, updated_at = now()
    where issue_activity_push_destination.owner_id = excluded.owner_id
      and issue_activity_push_destination.installation_id = excluded.installation_id;
  if not found then return false; end if;
  perform private.invoke_issue_activity_push();
  return true;
end $$;

create or replace function public.claim_issue_activity_push(p_owner_id text, p_installation_id uuid, p_limit integer default 10)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare v_destination private.issue_activity_push_destination%rowtype; v_result jsonb;
begin
  select * into v_destination from private.issue_activity_push_destination
  where singleton and owner_id = p_owner_id and installation_id = p_installation_id;
  if not found then return '[]'::jsonb; end if;
  update private.issue_activity_push_outbox set status = 'skipped', updated_at = now()
    where status = 'pending' and actor_id = p_owner_id;
  -- A crashed worker may be reclaimed after its five-minute lease expires.
  update private.issue_activity_push_outbox set status = case when status = 'sending' then 'pending' else 'awaiting_receipt' end,
    locked_at = null, claim_id = null, updated_at = now()
    where status in ('sending', 'checking_receipt') and locked_at < now() - interval '5 minutes';
  update private.issue_activity_push_outbox set status = 'failed', last_error = 'RetryLimit', updated_at = now()
    where (status = 'pending' and attempts >= 8) or (status = 'awaiting_receipt' and receipt_attempts >= 24);
  with due as (
    select id from private.issue_activity_push_outbox
    where next_attempt_at <= now() and (status = 'awaiting_receipt' or (status = 'pending' and v_destination.enabled))
    order by next_attempt_at, created_at for update skip locked limit greatest(1, least(p_limit, 20))
  ), claimed as (
    update private.issue_activity_push_outbox q set
      status = case when q.status = 'pending' then 'sending' else 'checking_receipt' end,
      attempts = q.attempts + case when q.status = 'pending' then 1 else 0 end,
      receipt_attempts = q.receipt_attempts + case when q.status = 'awaiting_receipt' then 1 else 0 end,
      push_token = case when q.status = 'pending' then v_destination.expo_push_token else q.push_token end,
      claim_id = gen_random_uuid(), locked_at = now(), updated_at = now()
    from due where q.id = due.id returning q.*
  ) select coalesce(jsonb_agg(to_jsonb(claimed)), '[]'::jsonb) into v_result from claimed;
  return v_result;
end $$;

create or replace function public.finish_issue_activity_push(
  p_id uuid, p_claim_id uuid, p_status text, p_error text default null,
  p_ticket_id text default null, p_retry_seconds integer default 60
) returns boolean language plpgsql security definer set search_path = pg_catalog as $$
declare v_row private.issue_activity_push_outbox%rowtype;
begin
  if p_status not in ('pending', 'awaiting_receipt', 'delivered', 'failed') then raise exception 'Invalid delivery status'; end if;
  select * into v_row from private.issue_activity_push_outbox where id = p_id and claim_id = p_claim_id
    and status in ('sending', 'checking_receipt') for update;
  if not found then return false; end if;
  if p_error = 'DeviceNotRegistered' then
    update private.issue_activity_push_destination set enabled = false, updated_at = now() where expo_push_token = v_row.push_token;
    p_status := 'failed';
  end if;
  update private.issue_activity_push_outbox set status = p_status,
    ticket_id = coalesce(p_ticket_id, ticket_id), last_error = left(p_error, 80),
    next_attempt_at = now() + make_interval(secs => greatest(60, least(p_retry_seconds, 3600))),
    claim_id = null, locked_at = null, updated_at = now()
  where id = p_id;
  return true;
end $$;

revoke all on function private.invoke_issue_activity_push() from public, anon, authenticated, service_role;
revoke all on function private.enqueue_issue_activity_push() from public, anon, authenticated, service_role;
revoke all on function public.register_issue_activity_push(text, uuid, text) from public, anon, authenticated;
revoke all on function public.claim_issue_activity_push(text, uuid, integer) from public, anon, authenticated;
revoke all on function public.finish_issue_activity_push(uuid, uuid, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.register_issue_activity_push(text, uuid, text) to service_role;
grant execute on function public.claim_issue_activity_push(text, uuid, integer) to service_role;
grant execute on function public.finish_issue_activity_push(uuid, uuid, text, text, text, integer) to service_role;

select cron.schedule('issue-activity-push-retry', '* * * * *',
  $$select private.invoke_issue_activity_push() where exists (
    select 1 from private.issue_activity_push_outbox where
      (status in ('pending', 'awaiting_receipt') and next_attempt_at <= now())
      or (status in ('sending', 'checking_receipt') and locked_at < now() - interval '5 minutes')
  )$$);

-- Limit retention of finished notifications, including their private token snapshots.
select cron.schedule('issue-activity-push-cleanup', '17 3 * * *',
  $$delete from private.issue_activity_push_outbox
    where status in ('delivered', 'failed', 'skipped') and updated_at < now() - interval '30 days'$$);
