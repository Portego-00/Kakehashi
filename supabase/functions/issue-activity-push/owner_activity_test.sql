-- Regression: the owner liking a website issue must notify their approved
-- iPhone too. Run as administrator; all rows and pg_net requests roll back.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '20s';
do $test$
declare
  v_owner text;
  v_installation uuid;
  v_issue uuid := gen_random_uuid();
  v_comment uuid := gen_random_uuid();
  v_count integer;
begin
  select owner_id, installation_id into v_owner, v_installation
    from private.issue_activity_push_destination where singleton;
  if v_owner is null then raise exception 'Register the approved iPhone before this test'; end if;

  insert into public.issues (id, user_id, user_email, user_username, title, content)
  values (v_issue, v_owner, 'fixture@example.invalid', 'Owner', 'Owner activity fixture', 'Fixture');
  insert into public.issue_comments (id, issue_id, user_id, user_email, user_username, content)
  values (v_comment, v_issue, v_owner, 'fixture@example.invalid', 'Owner', 'Fixture');
  insert into public.issue_likes (issue_id, user_id) values (v_issue, v_owner);
  insert into public.comment_likes (comment_id, user_id) values (v_comment, v_owner);

  select count(*) into v_count from private.issue_activity_push_outbox
    where issue_id = v_issue and actor_id = v_owner and status = 'pending';
  if v_count <> 4 then
    raise exception 'Owner activity must queue all four notifications; got %', v_count;
  end if;

  -- Isolate only the fixtures for claiming, inside the same rolled-back tx.
  delete from private.issue_activity_push_outbox where issue_id <> v_issue;
  perform public.claim_issue_activity_push(v_owner, v_installation, 10);
  select count(*) into v_count from private.issue_activity_push_outbox
    where issue_id = v_issue and actor_id = v_owner and status = 'sending';
  if v_count <> 4 then
    raise exception 'Owner activity must remain eligible for delivery; got %', v_count;
  end if;
end $test$;
rollback;
select 'owner activity queues and dispatches all four notification types; fixtures rolled back' as result;
