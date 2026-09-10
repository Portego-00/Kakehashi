-- Run after both handwriting migrations in a disposable database.
begin;
do $$
declare result boolean; i integer;
begin
  if has_function_privilege('anon', 'public.reserve_notebook_drawing_v2(text,uuid,integer,integer,integer,integer,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.reserve_notebook_drawing_v2(text,uuid,integer,integer,integer,integer,text)', 'EXECUTE') then raise exception 'client format reservation access'; end if;
  if not has_function_privilege('service_role', 'public.reserve_notebook_drawing_v2(text,uuid,integer,integer,integer,integer,text)', 'EXECUTE') then raise exception 'missing server format reservation access'; end if;
  perform public.reserve_notebook_drawing('format-legacy', '00a00000-0000-4000-8000-000000000001', 1, 1, 64, 64);
  if (select ink_format from public.notebook_drawings where user_id = 'format-legacy') <> 'pencilkit-v1' then raise exception 'legacy format changed'; end if;
  result := public.reserve_notebook_drawing_v2('format-portable', '00a00000-0000-4000-8000-000000000002', 1, 1, 64, 64, 'strokes-v1');
  if result is distinct from true then raise exception 'portable reservation failed'; end if;
  if (select ink_format from public.notebook_drawings where user_id = 'format-portable') <> 'strokes-v1' then raise exception 'portable format missing'; end if;
  if public.complete_notebook_drawing('other-owner', '00a00000-0000-4000-8000-000000000002') then raise exception 'foreign completion allowed'; end if;
  if not public.complete_notebook_drawing('format-portable', '00a00000-0000-4000-8000-000000000002') then raise exception 'portable completion failed'; end if;
  begin
    perform public.reserve_notebook_drawing_v2('format-portable', '00a00000-0000-4000-8000-000000000002', 1, 1, 64, 64, 'pencilkit-v1');
    raise exception 'format changed on immutable asset';
  exception when unique_violation then null;
  end;
  if (select ink_format from public.notebook_drawings where user_id = 'format-portable') <> 'strokes-v1' then raise exception 'immutable format was overwritten'; end if;
  begin
    perform public.reserve_notebook_drawing_v2('format-invalid', gen_random_uuid(), 1, 1, 64, 64, 'strokes-v2');
    raise exception 'unknown format accepted';
  exception when raise_exception then
    if sqlerrm <> 'invalid handwriting format' then raise; end if;
  end;
  -- Mixed formats share the same pending byte quota and account lock.
  for i in 1..49 loop
    perform public.reserve_notebook_drawing('format-quota', gen_random_uuid(), 1, 1, 1048576, 1048576);
  end loop;
  if not public.reserve_notebook_drawing_v2('format-quota', gen_random_uuid(), 1, 1, 1048576, 1048576, 'strokes-v1') then raise exception 'valid mixed-format reservation rejected'; end if;
  if public.reserve_notebook_drawing_v2('format-quota', gen_random_uuid(), 1, 1, 1, 1, 'strokes-v1') then raise exception 'portable quota bypass'; end if;
  if public.reserve_notebook_drawing('format-quota', gen_random_uuid(), 1, 1, 1, 1) then raise exception 'legacy quota bypass'; end if;
end;
$$;
rollback;
