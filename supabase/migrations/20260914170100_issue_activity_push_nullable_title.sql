-- Legacy issues permit an empty title; notification enqueueing must still succeed.
create or replace function private.enqueue_issue_activity_push()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare v_issue_id uuid; v_issue_title text; v_title text; v_body text; v_type text; v_actor text; v_owner text;
begin
  v_actor := new.user_id::text;
  select owner_id into v_owner from private.issue_activity_push_destination where singleton;
  if v_owner is not null and v_actor = v_owner then return new; end if;
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

