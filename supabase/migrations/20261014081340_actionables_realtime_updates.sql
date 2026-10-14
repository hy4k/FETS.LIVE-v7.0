-- Wire the existing shared-work subscriptions; no operational records are written.
begin;
do $$
declare project_table text;
begin
 if not exists(select 1 from pg_publication where pubname='supabase_realtime') then
  raise exception 'Expected Supabase Realtime publication is missing';
 end if;
 if not exists(select 1 from pg_publication where pubname='supabase_realtime' and puballtables) then
  foreach project_table in array array['expansion_institutions','mission_work_items','mission_task_updates','mission_institution_stages','mission_rollout_selections','mission_readiness_observations'] loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=project_table) then
    execute format('alter publication supabase_realtime add table public.%I',project_table);
   end if;
  end loop;
 end if;
end $$;
commit;
