-- Immutable private PencilKit originals and PNG previews. Clients never receive
-- a Storage credential or public/signed URL; the notebook API checks ownership.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('notebook-drawings', 'notebook-drawings', false, 1048576, array['application/octet-stream', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Also protects the bucket if unrelated permissive policies are added later.
-- The server's service role bypasses RLS.
create policy notebook_drawings_server_only on storage.objects as restrictive
for all to anon, authenticated
using (bucket_id <> 'notebook-drawings') with check (bucket_id <> 'notebook-drawings');

create table public.notebook_drawings (
  id uuid primary key,
  user_id text not null check (user_id ~ '^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$' and user_id <> 'demo-level-21'),
  width integer not null check (width between 1 and 4096),
  height integer not null check (height between 1 and 4096),
  ink_bytes integer not null check (ink_bytes between 1 and 1048576),
  preview_bytes integer not null check (preview_bytes between 1 and 1048576),
  status text not null default 'pending' check (status in ('pending', 'ready')),
  created_at timestamptz not null default now(),
  check (width::bigint * height <= 16000000)
);
create index notebook_drawings_owner on public.notebook_drawings(user_id);
alter table public.notebook_drawings enable row level security;
revoke all on public.notebook_drawings from public, anon, authenticated;
grant select on public.notebook_drawings to service_role;

-- Reserve before uploading, under an account-scoped transaction lock, so
-- parallel saves cannot exceed 100 MiB or 2,000 immutable revisions. Pending
-- uploads count too; uncertain failures retain their reservation until an
-- operator reconciles both storage objects. Never age out metadata blindly.
create function public.reserve_notebook_drawing(
  p_user_id text, p_id uuid, p_width integer, p_height integer,
  p_ink_bytes integer, p_preview_bytes integer
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_bytes bigint; v_count bigint;
begin
  if p_user_id is null or p_user_id !~ '^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$' or p_user_id = 'demo-level-21'
    or p_id is null or p_width is null or p_width not between 1 and 4096
    or p_height is null or p_height not between 1 and 4096 or p_width::bigint * p_height > 16000000
    or p_ink_bytes is null or p_ink_bytes not between 1 and 1048576
    or p_preview_bytes is null or p_preview_bytes not between 1 and 1048576
    then raise exception 'invalid handwriting metadata'; end if;
  perform pg_advisory_xact_lock(hashtextextended('notebook-drawings:' || p_user_id, 0));
  select coalesce(sum(ink_bytes::bigint + preview_bytes), 0), count(*) into v_bytes, v_count
    from public.notebook_drawings where user_id = p_user_id;
  if v_count >= 2000 or v_bytes + p_ink_bytes + p_preview_bytes > 104857600 then return false; end if;
  insert into public.notebook_drawings(id, user_id, width, height, ink_bytes, preview_bytes)
    values (p_id, p_user_id, p_width, p_height, p_ink_bytes, p_preview_bytes);
  return true;
end;
$$;
revoke all on function public.reserve_notebook_drawing(text, uuid, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_notebook_drawing(text, uuid, integer, integer, integer, integer) to service_role;

create function public.complete_notebook_drawing(p_user_id text, p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.notebook_drawings set status = 'ready' where id = p_id and user_id = p_user_id and status = 'pending';
  return exists(select 1 from public.notebook_drawings where id = p_id and user_id = p_user_id and status = 'ready');
end;
$$;
revoke all on function public.complete_notebook_drawing(text, uuid) from public, anon, authenticated;
grant execute on function public.complete_notebook_drawing(text, uuid) to service_role;
