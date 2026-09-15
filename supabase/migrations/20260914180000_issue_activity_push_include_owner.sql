-- Personal delivery restricts the recipient, not whose activity is reported.
-- Include the owner’s website/app likes, comments and new issues too.
-- Preserve the singleton destination and verified owner/installation checks.
create or replace function private.enqueue_issue_activity_push()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare v_issue_id uuid; v_issue_title text; v_title text; v_body text; v_type text; v_actor text;
begin
  v_actor := new.user_id::text;
  if tg_table_name = 'issues' then
    v_issue_id := new.id; v_type := 'issue_created'; v_title := 'New issue';
    v_body := coalesce(nullif(new.user_username, ''), 'Someone') || ': ' || left(coalesce(nullif(new.title, ''), 'Untitled issue'), 110);
  elsif tg_table_name = 'issue_comments' then
    v_issue_id := new.issue_id; v_type := 'issue_comment_created'; v_title := 'New issue comment';
    select title into v_issue_title from public.issues where id = v_issue_id;
    v_body := coalesce(nullif(new.user_username, ''), 'Someone') || ' on ' || left(coalesce(v_issue_title, 'an issue'), 54) || ': ' || left(coalesce(new.content, ''), 90);
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


create or replace function public.claim_issue_activity_push(p_owner_id text, p_installation_id uuid, p_limit integer default 10)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare v_destination private.issue_activity_push_destination%rowtype; v_result jsonb;
begin
  select * into v_destination from private.issue_activity_push_destination
  where singleton and owner_id = p_owner_id and installation_id = p_installation_id;
  if not found then return '[]'::jsonb; end if;
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

