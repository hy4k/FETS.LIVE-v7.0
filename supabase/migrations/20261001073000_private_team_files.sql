begin;
insert into storage.buckets(id,name,public,file_size_limit) values('chat-files','chat-files',false,20971520) on conflict(id) do nothing;
drop policy if exists chat_files_read on storage.objects;
drop policy if exists chat_files_insert on storage.objects;
drop policy if exists chat_files_delete on storage.objects;
create policy chat_files_read on storage.objects for select to authenticated using(bucket_id='chat-files' and public.fets_is_active_staff() and exists(select 1 from public.conversations c where c.id::text=split_part(storage.objects.name,'/',1) and public.is_conversation_member(c.id)));
create policy chat_files_insert on storage.objects for insert to authenticated with check(bucket_id='chat-files' and split_part(storage.objects.name,'/',2)=auth.uid()::text and public.fets_is_active_staff() and exists(select 1 from public.conversations c where c.id::text=split_part(storage.objects.name,'/',1) and public.is_conversation_member(c.id)));
create policy chat_files_delete on storage.objects for delete to authenticated using(bucket_id='chat-files' and split_part(storage.objects.name,'/',2)=auth.uid()::text and public.fets_is_active_staff());
drop policy if exists chat_files_member_isolation on storage.objects;
create policy chat_files_member_isolation on storage.objects as restrictive for all to authenticated
 using(bucket_id<>'chat-files' or (public.fets_is_active_staff() and exists(select 1 from public.conversations c where c.id::text=split_part(storage.objects.name,'/',1) and public.is_conversation_member(c.id))))
 with check(bucket_id<>'chat-files' or (split_part(storage.objects.name,'/',2)=auth.uid()::text and public.fets_is_active_staff() and exists(select 1 from public.conversations c where c.id::text=split_part(storage.objects.name,'/',1) and public.is_conversation_member(c.id))));
drop policy if exists chat_files_no_anonymous on storage.objects;
create policy chat_files_no_anonymous on storage.objects as restrictive for select to anon using(bucket_id<>'chat-files');
drop policy if exists chat_files_no_replace on storage.objects;
create policy chat_files_no_replace on storage.objects as restrictive for update to authenticated using(bucket_id<>'chat-files');
-- The shared expansion workspace is for active FETS staff, not arbitrary signed-in users.
drop policy if exists "Staff full access to expansion_institutions" on public.expansion_institutions;
drop policy if exists "Staff full access to expansion_activity_logs" on public.expansion_activity_logs;
create policy "Staff full access to expansion_institutions" on public.expansion_institutions for all to authenticated using(public.fets_is_active_staff()) with check(public.fets_is_active_staff());
create policy "Staff full access to expansion_activity_logs" on public.expansion_activity_logs for all to authenticated using(public.fets_is_active_staff()) with check(public.fets_is_active_staff());
do $$ declare name text;begin foreach name in array array['expansion_institutions','expansion_activity_logs'] loop
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename=name and schemaname='public') then execute format('alter publication supabase_realtime add table public.%I',name);end if;
end loop;end $$;
notify pgrst,'reload schema';
commit;
