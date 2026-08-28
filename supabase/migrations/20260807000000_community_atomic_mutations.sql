-- Atomic, idempotent write primitives used by the Kakehashi web server.
-- These functions are service-role only: a browser key must never execute them.

create table if not exists public.community_mutation_receipts (
  id uuid primary key,
  user_id text not null,
  action text not null,
  target_id uuid not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.community_mutation_receipts enable row level security;
revoke all on public.community_mutation_receipts from anon, authenticated;

alter table public.issue_comments add column if not exists idempotency_key uuid;
create unique index if not exists issue_comments_idempotency_key_idx on public.issue_comments (idempotency_key) where idempotency_key is not null;

with duplicates as (
  select ctid, row_number() over (partition by issue_id, user_id order by created_at, id) as ordinal from public.issue_likes
)
delete from public.issue_likes target using duplicates where target.ctid = duplicates.ctid and duplicates.ordinal > 1;
with duplicates as (
  select ctid, row_number() over (partition by comment_id, user_id order by created_at, id) as ordinal from public.comment_likes
)
delete from public.comment_likes target using duplicates where target.ctid = duplicates.ctid and duplicates.ordinal > 1;
create unique index if not exists issue_likes_target_user_idx on public.issue_likes (issue_id, user_id);
create unique index if not exists comment_likes_target_user_idx on public.comment_likes (comment_id, user_id);

create or replace function public.community_add_comment(
  p_request_id uuid, p_issue_id uuid, p_user_id text, p_user_email text,
  p_user_username text, p_user_level integer, p_content text,
  p_reply_to_comment_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_result jsonb; v_comment public.issue_comments%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('community-comment:' || p_request_id::text, 0));
  select result into v_result from public.community_mutation_receipts where id = p_request_id;
  if found then return v_result; end if;
  if length(btrim(p_content)) < 1 or length(p_content) > 6000 then raise exception 'Invalid comment content'; end if;
  insert into public.issue_comments (issue_id, user_id, user_email, user_username, user_level, content, reply_to_comment_id, idempotency_key)
  values (p_issue_id, p_user_id, p_user_email, p_user_username, p_user_level, btrim(p_content), p_reply_to_comment_id, p_request_id)
  returning * into v_comment;
  update public.issues set reply_count = (select count(*) from public.issue_comments where issue_id = p_issue_id), updated_at = now() where id = p_issue_id;
  v_result := to_jsonb(v_comment);
  insert into public.community_mutation_receipts (id, user_id, action, target_id, result) values (p_request_id, p_user_id, 'addComment', p_issue_id, v_result);
  return v_result;
end $$;

create or replace function public.community_toggle_issue_like(p_request_id uuid, p_target_id uuid, p_user_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_result jsonb; v_liked boolean; v_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('community-issue-like:' || p_target_id::text || ':' || p_user_id, 0));
  select result into v_result from public.community_mutation_receipts where id = p_request_id;
  if found then return v_result; end if;
  if exists (select 1 from public.issue_likes where issue_id = p_target_id and user_id = p_user_id) then
    delete from public.issue_likes where issue_id = p_target_id and user_id = p_user_id; v_liked := false;
  else
    insert into public.issue_likes (issue_id, user_id) values (p_target_id, p_user_id); v_liked := true;
  end if;
  select count(*) into v_count from public.issue_likes where issue_id = p_target_id;
  update public.issues set likes_count = v_count, updated_at = now() where id = p_target_id;
  if not found then raise exception 'Issue not found'; end if;
  v_result := jsonb_build_object('liked', v_liked, 'likes_count', v_count);
  insert into public.community_mutation_receipts (id, user_id, action, target_id, result) values (p_request_id, p_user_id, 'toggleIssueLike', p_target_id, v_result);
  return v_result;
end $$;

create or replace function public.community_toggle_comment_like(p_request_id uuid, p_target_id uuid, p_user_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_result jsonb; v_liked boolean; v_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('community-comment-like:' || p_target_id::text || ':' || p_user_id, 0));
  select result into v_result from public.community_mutation_receipts where id = p_request_id;
  if found then return v_result; end if;
  if exists (select 1 from public.comment_likes where comment_id = p_target_id and user_id = p_user_id) then
    delete from public.comment_likes where comment_id = p_target_id and user_id = p_user_id; v_liked := false;
  else
    insert into public.comment_likes (comment_id, user_id) values (p_target_id, p_user_id); v_liked := true;
  end if;
  select count(*) into v_count from public.comment_likes where comment_id = p_target_id;
  update public.issue_comments set likes_count = v_count, updated_at = now() where id = p_target_id;
  if not found then raise exception 'Comment not found'; end if;
  v_result := jsonb_build_object('liked', v_liked, 'likes_count', v_count);
  insert into public.community_mutation_receipts (id, user_id, action, target_id, result) values (p_request_id, p_user_id, 'toggleCommentLike', p_target_id, v_result);
  return v_result;
end $$;

revoke all on function public.community_add_comment(uuid, uuid, text, text, text, integer, text, uuid) from public, anon, authenticated;
revoke all on function public.community_toggle_issue_like(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.community_toggle_comment_like(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.community_add_comment(uuid, uuid, text, text, text, integer, text, uuid) to service_role;
grant execute on function public.community_toggle_issue_like(uuid, uuid, text) to service_role;
grant execute on function public.community_toggle_comment_like(uuid, uuid, text) to service_role;
