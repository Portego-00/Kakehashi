-- Older app builds turn these Realtime events into local alerts on any device
-- signed in as Portego. Stop that legacy path so the server-approved iPhone is
-- the only recipient, including while older builds remain installed elsewhere.
-- Community screens use ordinary reads/mutations; the push triggers do not
-- depend on the Realtime publication.
do $$
declare activity_table text;
begin
  foreach activity_table in array array['issues', 'issue_comments', 'issue_likes', 'comment_likes'] loop
    if exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = activity_table
    ) then
      execute format('alter publication supabase_realtime drop table public.%I', activity_table);
    end if;
  end loop;
end $$;
