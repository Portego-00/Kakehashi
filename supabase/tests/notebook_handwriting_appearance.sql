-- Run after all three handwriting migrations in a disposable database.
begin;
do $$
declare i integer; v_id uuid; before_count bigint;
begin
  if has_function_privilege('anon', 'public.reserve_notebook_drawing_v3(text,uuid,integer,integer,integer,integer,text,text,integer)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.reserve_notebook_drawing_v3(text,uuid,integer,integer,integer,integer,text,text,integer)', 'EXECUTE') then raise exception 'client appearance reservation access'; end if;
  if not has_function_privilege('service_role', 'public.reserve_notebook_drawing_v3(text,uuid,integer,integer,integer,integer,text,text,integer)', 'EXECUTE') then raise exception 'missing server appearance reservation access'; end if;
  v_id := gen_random_uuid();
  if not public.reserve_notebook_drawing_v3('appearance', v_id, 768, 576, 128, 256, 'pencilkit-v1', 'themed-v1', 384) then raise exception 'appearance reservation failed'; end if;
  if not exists(select 1 from public.notebook_drawings where notebook_drawings.id = v_id and preview_format = 'themed-v1' and dark_preview_bytes = 384 and ink_format = 'pencilkit-v1' and status = 'pending') then raise exception 'appearance metadata missing'; end if;
  if public.complete_notebook_drawing('other-owner', v_id) then raise exception 'foreign appearance completion allowed'; end if;
  if not public.complete_notebook_drawing('appearance', v_id) then raise exception 'appearance completion failed'; end if;
  begin
    perform public.reserve_notebook_drawing('appearance', v_id, 768, 576, 128, 256);
    raise exception 'immutable themed asset replaced';
  exception when unique_violation then null; end;
  begin
    perform public.reserve_notebook_drawing_v3('invalid-appearance', gen_random_uuid(), 1, 1, 1, 1, 'strokes-v1', 'themed-v1', 1);
    raise exception 'portable themed appearance accepted';
  exception when raise_exception then if sqlerrm <> 'invalid handwriting appearance' then raise; end if; end;
  begin
    insert into public.notebook_drawings(id, user_id, width, height, ink_bytes, preview_bytes, dark_preview_bytes)
      values(gen_random_uuid(), 'invalid-appearance', 1, 1, 1, 1, 1);
    raise exception 'dark object without preview format accepted';
  exception when check_violation then null; end;
  -- 33 pending themed revisions consume 99 MiB, including their dark PNGs.
  for i in 1..33 loop
    if not public.reserve_notebook_drawing_v3('appearance-quota', gen_random_uuid(), 1, 1, 1048576, 1048576, 'pencilkit-v1', 'themed-v1', 1048576) then raise exception 'themed quota unexpectedly full'; end if;
  end loop;
  if public.reserve_notebook_drawing('appearance-quota', gen_random_uuid(), 1, 1, 1048576, 1048576) then raise exception 'legacy RPC ignored dark bytes'; end if;
  if public.reserve_notebook_drawing_v2('appearance-quota', gen_random_uuid(), 1, 1, 1048576, 1048576, 'strokes-v1') then raise exception 'portable RPC ignored dark bytes'; end if;
  select count(*) into before_count from public.notebook_drawings where user_id = 'appearance-quota';
  if public.reserve_notebook_drawing_v3('appearance-quota', gen_random_uuid(), 1, 1, 1, 1, 'pencilkit-v1', 'themed-v1', 1048576) then raise exception 'dark object bypassed remaining quota'; end if;
  if (select count(*) from public.notebook_drawings where user_id = 'appearance-quota') <> before_count then raise exception 'failed quota left a reservation'; end if;
  if not public.reserve_notebook_drawing('appearance-quota', gen_random_uuid(), 1, 1, 524288, 524288) then raise exception 'exact quota fit rejected'; end if;
  if public.reserve_notebook_drawing_v3('appearance-quota', gen_random_uuid(), 1, 1, 1, 1, 'pencilkit-v1', 'themed-v1', 1) then raise exception 'themed quota exceeded'; end if;
end;
$$;
rollback;
