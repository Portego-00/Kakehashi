-- Existing objects remain immutable PencilKit originals. New portable drawings
-- carry an explicit format so legacy editors never interpret JSON as PKDrawing.
alter table public.notebook_drawings
  add column ink_format text not null default 'pencilkit-v1'
  check (ink_format in ('pencilkit-v1', 'strokes-v1'));

-- Keep the original six-argument RPC intact for already-deployed clients.
-- Its existing insert receives the legacy format through the column default.
create function public.reserve_notebook_drawing_v2(
  p_user_id text, p_id uuid, p_width integer, p_height integer,
  p_ink_bytes integer, p_preview_bytes integer, p_ink_format text
) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_ink_format is null or p_ink_format not in ('pencilkit-v1', 'strokes-v1') then
    raise exception 'invalid handwriting format';
  end if;
  -- The original function holds the account lock until this transaction ends,
  -- checks both quotas, and refuses an existing immutable ID.
  if not public.reserve_notebook_drawing(p_user_id, p_id, p_width, p_height, p_ink_bytes, p_preview_bytes) then
    return false;
  end if;
  update public.notebook_drawings set ink_format = p_ink_format
    where id = p_id and user_id = p_user_id and status = 'pending';
  return true;
end;
$$;
revoke all on function public.reserve_notebook_drawing_v2(text, uuid, integer, integer, integer, integer, text) from public, anon, authenticated;
grant execute on function public.reserve_notebook_drawing_v2(text, uuid, integer, integer, integer, integer, text) to service_role;
