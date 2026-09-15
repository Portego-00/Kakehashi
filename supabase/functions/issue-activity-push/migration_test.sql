-- Run as the migration/admin role. EVERYTHING, including pg_net requests and
-- temporary fixture destinations, is rolled back. No test notification is sent.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '20s';
do $test$
declare
  v_owner text := gen_random_uuid()::text;
  v_other text := gen_random_uuid()::text;
  v_installation uuid := gen_random_uuid();
  v_issue uuid := gen_random_uuid();
  v_own_issue uuid := gen_random_uuid();
  v_comment uuid := gen_random_uuid();
  v_issue_like uuid := gen_random_uuid();
  v_comment_like uuid := gen_random_uuid();
  v_claims jsonb; v_claim jsonb; v_count integer; v_enabled boolean;
begin
  -- Isolate the test queue within this rollback-only transaction.
  delete from private.issue_activity_push_outbox;
  delete from private.issue_activity_push_destination;
  if not public.register_issue_activity_push(v_owner, v_installation, 'ExpoPushToken[test-original]') then
    raise exception 'Initial trusted registration failed';
  end if;
  if public.register_issue_activity_push(v_other, v_installation, 'ExpoPushToken[test-other-owner]') then
    raise exception 'Destination owner was replaced';
  end if;
  if public.register_issue_activity_push(v_owner, gen_random_uuid(), 'ExpoPushToken[test-other-phone]') then
    raise exception 'Destination installation was replaced';
  end if;

  insert into public.issues (id, user_id, user_email, user_username, title, content)
  values (v_issue, v_other, 'fixture@example.invalid', 'Fixture', null, 'Fixture content');
  insert into public.issues (id, user_id, user_email, user_username, title, content)
  values (v_own_issue, v_owner, 'fixture@example.invalid', 'Owner', 'Owner issue', 'Fixture content');
  insert into public.issue_comments (id, issue_id, user_id, user_email, user_username, content)
  values (v_comment, v_issue, v_other, 'fixture@example.invalid', 'Fixture', 'Fixture comment');
  insert into public.issue_likes (id, issue_id, user_id) values (v_issue_like, v_issue, v_other);
  insert into public.comment_likes (id, comment_id, user_id) values (v_comment_like, v_comment, v_other);
  select count(*) into v_count from private.issue_activity_push_outbox;
  if v_count <> 5 then raise exception 'Expected five activities including owner activity, got %', v_count; end if;
  if not exists (select 1 from private.issue_activity_push_outbox where source_id = v_issue and body = 'Fixture: Untitled issue') then
    raise exception 'Nullable issue title was not handled';
  end if;
  if exists (select 1 from private.issue_activity_push_outbox where to_jsonb(issue_activity_push_outbox)::text like '%fixture@example.invalid%') then
    raise exception 'Unneeded private source fields leaked to queue';
  end if;

  update public.issues set title = 'Changed' where id = v_issue;
  delete from public.issue_likes where id = v_issue_like;
  select count(*) into v_count from private.issue_activity_push_outbox;
  if v_count <> 5 then raise exception 'Updates/deletes incorrectly enqueued notifications'; end if;
  if public.claim_issue_activity_push(v_other, v_installation) <> '[]'::jsonb then raise exception 'Wrong owner claimed events'; end if;
  if public.claim_issue_activity_push(v_owner, gen_random_uuid()) <> '[]'::jsonb then raise exception 'Wrong phone claimed events'; end if;
  v_claims := public.claim_issue_activity_push(v_owner, v_installation, 10);
  if jsonb_array_length(v_claims) <> 5 then raise exception 'Expected five claimed notifications'; end if;
  if public.claim_issue_activity_push(v_owner, v_installation, 10) <> '[]'::jsonb then raise exception 'Already claimed notifications were claimed twice'; end if;
  v_claim := v_claims->0;
  if public.finish_issue_activity_push((v_claim->>'id')::uuid, gen_random_uuid(), 'delivered') then raise exception 'Stale claim completed notification'; end if;
  if not public.finish_issue_activity_push((v_claim->>'id')::uuid, (v_claim->>'claim_id')::uuid, 'awaiting_receipt', null, 'test-ticket', 900) then
    raise exception 'Ticket was not persisted';
  end if;
  if public.claim_issue_activity_push(v_owner, v_installation, 10) <> '[]'::jsonb then raise exception 'Receipt was claimed before due'; end if;
  update private.issue_activity_push_outbox set next_attempt_at = now() - interval '1 second' where id = (v_claim->>'id')::uuid;
  v_claims := public.claim_issue_activity_push(v_owner, v_installation, 10);
  if jsonb_array_length(v_claims) <> 1 or v_claims->0->>'status' <> 'checking_receipt' then raise exception 'Receipt was resent as notification'; end if;
  v_claim := v_claims->0;
  if not public.register_issue_activity_push(v_owner, v_installation, 'ExpoPushToken[test-rotated]') then raise exception 'Approved token rotation failed'; end if;
  perform public.finish_issue_activity_push((v_claim->>'id')::uuid, (v_claim->>'claim_id')::uuid, 'failed', 'DeviceNotRegistered');
  select enabled into v_enabled from private.issue_activity_push_destination;
  if not v_enabled then raise exception 'Old receipt disabled newly rotated token'; end if;

  update private.issue_activity_push_outbox set locked_at = now() - interval '6 minutes' where status = 'sending';
  v_claims := public.claim_issue_activity_push(v_owner, v_installation, 10);
  if jsonb_array_length(v_claims) <> 4 then raise exception 'Expired claims were not recovered'; end if;
  v_claim := v_claims->0;
  if v_claim->>'push_token' <> 'ExpoPushToken[test-rotated]' then raise exception 'Recovered send did not use current approved token'; end if;
  perform public.finish_issue_activity_push((v_claim->>'id')::uuid, (v_claim->>'claim_id')::uuid, 'failed', 'DeviceNotRegistered');
  select enabled into v_enabled from private.issue_activity_push_destination;
  if v_enabled then raise exception 'Unregistered token remained enabled'; end if;

  if has_table_privilege('anon', 'private.issue_activity_push_destination', 'SELECT')
    or has_table_privilege('authenticated', 'private.issue_activity_push_destination', 'SELECT')
    or has_table_privilege('anon', 'private.issue_activity_push_outbox', 'INSERT')
    or has_function_privilege('anon', 'public.register_issue_activity_push(text,uuid,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.claim_issue_activity_push(text,uuid,integer)', 'EXECUTE')
    or has_function_privilege('anon', 'public.finish_issue_activity_push(uuid,uuid,text,text,text,integer)', 'EXECUTE')
  then raise exception 'Public role can access private delivery state'; end if;
  if not has_function_privilege('service_role', 'public.register_issue_activity_push(text,uuid,text)', 'EXECUTE') then
    raise exception 'Service registration privilege missing';
  end if;
end $test$;
rollback;
select 'issue activity SQL tests passed; all fixtures rolled back' as result;
