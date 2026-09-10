-- Execute after 20260909000000_notebook_handwriting.sql in a disposable database.
-- All test data is rolled back. No real account IDs or credentials are used.
begin;
do $$
declare result boolean; i integer;
begin
  if (select public from storage.buckets where id = 'notebook-drawings') then raise exception 'drawing bucket must be private'; end if;
  if has_table_privilege('anon', 'public.notebook_drawings', 'SELECT') or has_table_privilege('authenticated', 'public.notebook_drawings', 'SELECT') then raise exception 'client metadata access'; end if;
  if has_function_privilege('anon', 'public.reserve_notebook_drawing(text,uuid,integer,integer,integer,integer)', 'EXECUTE') then raise exception 'client reservation access'; end if;
  if not has_function_privilege('service_role', 'public.reserve_notebook_drawing(text,uuid,integer,integer,integer,integer)', 'EXECUTE') then raise exception 'missing server reservation access'; end if;
  if not exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'notebook_drawings_server_only' and permissive = 'RESTRICTIVE') then raise exception 'missing private bucket policy'; end if;

  result := public.reserve_notebook_drawing('drawing-test-owner', '00a00000-0000-4000-8000-000000000001', 1, 1, 64, 64);
  if result is distinct from true then raise exception 'first reservation failed'; end if;
  if (select status from public.notebook_drawings where user_id = 'drawing-test-owner') <> 'pending' then raise exception 'prematurely readable upload'; end if;
  if public.complete_notebook_drawing('wrong-owner', '00a00000-0000-4000-8000-000000000001') then raise exception 'foreign completion allowed'; end if;
  if not public.complete_notebook_drawing('drawing-test-owner', '00a00000-0000-4000-8000-000000000001') then raise exception 'owner completion failed'; end if;
  if not public.complete_notebook_drawing('drawing-test-owner', '00a00000-0000-4000-8000-000000000001') then raise exception 'ready completion retry failed'; end if;
  begin
    perform public.reserve_notebook_drawing('drawing-test-owner', '00a00000-0000-4000-8000-000000000001', 1, 1, 64, 64);
    raise exception 'immutable id overwritten';
  exception when unique_violation then null;
  end;
  begin
    perform public.reserve_notebook_drawing('drawing-test-owner', gen_random_uuid(), 4096, 4096, 64, 64);
    raise exception 'oversized canvas accepted';
  exception when raise_exception then
    if sqlerrm <> 'invalid handwriting metadata' then raise; end if;
  end;

  -- Pending uploads must consume bytes before any object is written.
  for i in 1..50 loop
    if not public.reserve_notebook_drawing('drawing-test-bytes', gen_random_uuid(), 10, 10, 1048576, 1048576) then raise exception 'quota rejected valid reservation %', i; end if;
  end loop;
  if public.reserve_notebook_drawing('drawing-test-bytes', gen_random_uuid(), 1, 1, 1, 1) then raise exception '100 MiB quota bypassed'; end if;
  if (select count(*) from public.notebook_drawings where user_id = 'drawing-test-bytes') <> 50 then raise exception 'failed quota reservation wrote metadata'; end if;
  for i in 1..2000 loop
    if not public.reserve_notebook_drawing('drawing-test-count', gen_random_uuid(), 1, 1, 1, 1) then raise exception 'count rejected valid reservation %', i; end if;
  end loop;
  if public.reserve_notebook_drawing('drawing-test-count', gen_random_uuid(), 1, 1, 1, 1) then raise exception 'revision count quota bypassed'; end if;
end;
$$;
rollback;
