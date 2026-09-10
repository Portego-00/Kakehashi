-- A second transparent PNG preserves PencilKit's real light/dark ink rendering.
-- Existing immutable opaque previews retain their original representation.
alter table public.notebook_drawings
  add column dark_preview_bytes integer not null default 0 check (dark_preview_bytes between 0 and 1048576),
  add column preview_format text,
  add constraint notebook_drawing_preview_format check (
    (preview_format is null and dark_preview_bytes = 0)
    or (preview_format is not null and preview_format = 'themed-v1' and dark_preview_bytes > 0 and ink_format = 'pencilkit-v1')
  );

-- Retain the original RPC signature and v2 wrapper. All generations count the
-- third object in the account quota, including pending/uncertain uploads.
create or replace function public.reserve_notebook_drawing(
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
  select coalesce(sum(ink_bytes::bigint + preview_bytes + dark_preview_bytes), 0), count(*) into v_bytes, v_count
    from public.notebook_drawings where user_id = p_user_id;
  if v_count >= 2000 or v_bytes + p_ink_bytes + p_preview_bytes > 104857600 then return false; end if;
  insert into public.notebook_drawings(id, user_id, width, height, ink_bytes, preview_bytes)
    values (p_id, p_user_id, p_width, p_height, p_ink_bytes, p_preview_bytes);
  return true;
end;
$$;

create function public.reserve_notebook_drawing_v3(
  p_user_id text, p_id uuid, p_width integer, p_height integer,
  p_ink_bytes integer, p_preview_bytes integer, p_ink_format text,
  p_preview_format text, p_dark_preview_bytes integer
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_bytes bigint;
begin
  if p_ink_format is distinct from 'pencilkit-v1' or p_preview_format is distinct from 'themed-v1'
    or p_dark_preview_bytes is null or p_dark_preview_bytes not between 1 and 1048576
    then raise exception 'invalid handwriting appearance'; end if;
  perform pg_advisory_xact_lock(hashtextextended('notebook-drawings:' || p_user_id, 0));
  select coalesce(sum(ink_bytes::bigint + preview_bytes + dark_preview_bytes), 0) into v_bytes
    from public.notebook_drawings where user_id = p_user_id;
  if v_bytes + p_ink_bytes + p_preview_bytes + p_dark_preview_bytes > 104857600 then return false; end if;
  -- The original validator, count quota and immutable insert remain authoritative.
  if not public.reserve_notebook_drawing(p_user_id, p_id, p_width, p_height, p_ink_bytes, p_preview_bytes) then
    return false;
  end if;
  update public.notebook_drawings set preview_format = p_preview_format, dark_preview_bytes = p_dark_preview_bytes
    where id = p_id and user_id = p_user_id and status = 'pending';
  return true;
end;
$$;
revoke all on function public.reserve_notebook_drawing_v3(text, uuid, integer, integer, integer, integer, text, text, integer) from public, anon, authenticated;
grant execute on function public.reserve_notebook_drawing_v3(text, uuid, integer, integer, integer, integer, text, text, integer) to service_role;
