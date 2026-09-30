-- Chat foreign keys reference staff_profiles.id, which can differ from auth.uid().
begin;
create or replace function public.create_group_conversation(p_name text,p_member_ids uuid[])
returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid; cid uuid; member uuid; resolved uuid;
begin
 select id into me from public.staff_profiles where user_id=auth.uid() and is_active limit 1;
 if me is null then raise exception 'Active staff sign-in required';end if;
 if nullif(btrim(p_name),'') is null then raise exception 'Group name required';end if;
 insert into public.conversations(name,is_group,created_by) values(btrim(p_name),true,me) returning id into cid;
 insert into public.conversation_members(conversation_id,user_id,is_admin) values(cid,me,true);
 foreach member in array coalesce(p_member_ids,array[]::uuid[]) loop
  select id into resolved from public.staff_profiles where (id=member or user_id=member) and is_active order by (id=member) desc limit 1;
  if resolved is null then raise exception 'Selected teammate is no longer active';end if;
  insert into public.conversation_members(conversation_id,user_id,is_admin) values(cid,resolved,resolved=me) on conflict(conversation_id,user_id) do nothing;
 end loop;
 return cid;
end $$;
create or replace function public.get_or_create_conversation(user_id_1 uuid,user_id_2 uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid; other uuid; cid uuid;
begin
 select id into me from public.staff_profiles where user_id=auth.uid() and is_active limit 1;
 if me is null or user_id_1 not in (me,auth.uid()) then raise exception 'Start conversations as yourself';end if;
 select id into other from public.staff_profiles where (id=user_id_2 or user_id=user_id_2) and is_active order by (id=user_id_2) desc limit 1;
 if other is null or other=me then raise exception 'Choose an active teammate';end if;
 perform pg_advisory_xact_lock(hashtextextended(least(me,other)::text||greatest(me,other)::text,0));
 select c.id into cid from public.conversations c join public.conversation_members a on a.conversation_id=c.id join public.conversation_members b on b.conversation_id=c.id
 where not c.is_group and a.user_id=me and b.user_id=other limit 1;
 if cid is not null then return cid;end if;
 insert into public.conversations(is_group,created_by) values(false,me) returning id into cid;
 insert into public.conversation_members(conversation_id,user_id) values(cid,me),(cid,other);
 return cid;
end $$;
create or replace function public.send_chat_message(p_conversation_id uuid,p_sender_id uuid,p_content text,p_type text default 'text',p_file_path text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid; mid uuid;
begin
 select id into me from public.staff_profiles where user_id=auth.uid() and is_active limit 1;
 if me is null or p_sender_id is null or p_sender_id not in (me,auth.uid()) or not public.is_conversation_member(p_conversation_id,auth.uid()) then raise exception 'Send messages only as yourself in your conversations';end if;
 insert into public.messages(conversation_id,sender_id,content,type,file_path,status) values(p_conversation_id,me,p_content,p_type,p_file_path,'sent') returning id into mid;
 update public.conversations set last_message_at=now(),updated_at=now(),last_message_preview=case when p_type='text' then left(p_content,100) else '['||upper(p_type)||'] Attachment' end where id=p_conversation_id;
 return mid;
end $$;
-- Only group administrators or the conversation creator may add memberships.
create or replace function public.can_manage_chat_members(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.staff_profiles s where s.user_id=auth.uid() and s.is_active and
 (exists(select 1 from public.conversations c where c.id=p_conversation_id and c.created_by=s.id)
 or exists(select 1 from public.conversation_members m where m.conversation_id=p_conversation_id and m.user_id in (s.id,s.user_id) and m.is_admin)))
$$;
drop policy if exists chat_members_insert on public.conversation_members;
create policy chat_members_insert on public.conversation_members for insert to authenticated with check(public.can_manage_chat_members(conversation_id));
revoke all on function public.create_group_conversation(text,uuid[]),public.get_or_create_conversation(uuid,uuid),public.send_chat_message(uuid,uuid,text,text,text),public.can_manage_chat_members(uuid) from public,anon;
grant execute on function public.create_group_conversation(text,uuid[]),public.get_or_create_conversation(uuid,uuid),public.send_chat_message(uuid,uuid,text,text,text),public.can_manage_chat_members(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
