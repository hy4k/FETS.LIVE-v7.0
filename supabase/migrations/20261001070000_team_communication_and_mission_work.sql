begin;
create or replace function public.fets_is_active_staff() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.staff_profiles where user_id=auth.uid() and is_active)
$$;
revoke all on function public.fets_is_active_staff() from public,anon;
grant execute on function public.fets_is_active_staff() to authenticated;
create table if not exists public.chat_work_items(
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 message_id uuid references public.messages(id) on delete set null,
 kind text not null check(kind in ('follow_up','decision')),
 title text not null check(length(btrim(title)) between 1 and 2000),
 owner_id uuid references public.staff_profiles(id) on delete set null,
 due_date date,
 status text not null default 'open' check(status in ('open','done')),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now()
);
create table if not exists public.chat_saved_messages(
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 message_id uuid not null references public.messages(id) on delete cascade,
 created_at timestamptz not null default now(),primary key(user_id,message_id)
);
alter table public.chat_work_items enable row level security;
alter table public.chat_saved_messages enable row level security;
create policy chat_work_read on public.chat_work_items for select to authenticated using(public.is_conversation_member(conversation_id) and public.fets_is_active_staff());
create policy chat_work_insert on public.chat_work_items for insert to authenticated with check(created_by=auth.uid() and public.is_conversation_member(conversation_id) and public.fets_is_active_staff());
create policy chat_work_update on public.chat_work_items for update to authenticated using(public.is_conversation_member(conversation_id) and public.fets_is_active_staff()) with check(public.is_conversation_member(conversation_id) and public.fets_is_active_staff());
create policy chat_work_delete on public.chat_work_items for delete to authenticated using(created_by=auth.uid() and public.is_conversation_member(conversation_id));
create policy chat_saved_read on public.chat_saved_messages for select to authenticated using(user_id=auth.uid() and exists(select 1 from public.messages m where m.id=message_id));
create policy chat_saved_insert on public.chat_saved_messages for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.messages m where m.id=message_id));
create policy chat_saved_delete on public.chat_saved_messages for delete to authenticated using(user_id=auth.uid());
create or replace function public.chat_work_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.conversation_id,new.created_by,new.created_at,new.message_id,new.kind) is distinct from (old.conversation_id,old.created_by,old.created_at,old.message_id,old.kind) then raise exception 'Work item origin cannot change';end if;
 if new.message_id is not null and not exists(select 1 from public.messages where id=new.message_id and conversation_id=new.conversation_id) then raise exception 'Message must belong to this conversation';end if;
 if new.owner_id is not null and not exists(select 1 from public.conversation_members where conversation_id=new.conversation_id and user_id=new.owner_id) then raise exception 'Assign a conversation member';end if;
 return new;
end $$;
create trigger chat_work_guard before insert or update on public.chat_work_items for each row execute function public.chat_work_guard();
create table if not exists public.mission_work_items(
 id uuid primary key default gen_random_uuid(),
 institution_id uuid references public.expansion_institutions(id) on delete set null,
 title text not null check(length(btrim(title)) between 1 and 2000),
 district text check(district in ('Kottayam','Ernakulam','Thrissur','Calicut','Kannur')),
 owner_id uuid references public.staff_profiles(id) on delete set null,
 due_date date,
 status text not null default 'open' check(status in ('open','in_progress','blocked','done')),
 blocker text,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now()
);
alter table public.mission_work_items enable row level security;
create policy mission_work_read on public.mission_work_items for select to authenticated using(public.fets_is_active_staff());
create policy mission_work_insert on public.mission_work_items for insert to authenticated with check(public.fets_is_active_staff() and created_by=auth.uid());
create policy mission_work_update on public.mission_work_items for update to authenticated using(public.fets_is_active_staff()) with check(public.fets_is_active_staff());
create policy mission_work_delete on public.mission_work_items for delete to authenticated using(public.fets_is_active_staff() and created_by=auth.uid());
create index chat_work_conversation_idx on public.chat_work_items(conversation_id,created_at);
create index mission_work_owner_idx on public.mission_work_items(owner_id,status);
grant select,insert,update,delete on public.chat_work_items,public.chat_saved_messages,public.mission_work_items to authenticated;
do $$ declare name text;begin foreach name in array array['chat_work_items','mission_work_items'] loop
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename=name and schemaname='public') then execute format('alter publication supabase_realtime add table public.%I',name);end if;
end loop;end $$;
notify pgrst,'reload schema';
commit;
