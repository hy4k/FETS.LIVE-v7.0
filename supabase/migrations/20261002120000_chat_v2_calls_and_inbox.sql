-- Team chat, made dependable.
--
-- 1. One identity rule. Chat rows name people by staff_profiles.id; older rows
--    may hold the auth user id. Every check below accepts either, through one
--    security-definer helper, so no policy ever reads its own table (the old
--    self-referencing member policy is what made groups fail to load).
-- 2. Every policy on conversations, conversation_members and messages is
--    replaced by a small, clear set.
-- 3. An inbox function: conversations with members, last message and unread
--    count in one call. Read state lives on the membership (last_read_at).
-- 4. Messages can be replied to, edited and deleted (soft).
-- 5. Group management: add, remove, rename, leave.
-- 6. Calls ring. A call is a row: ringing → active → ended / missed /
--    declined. Everyone in the conversation sees it in real time, so the
--    other side rings without having to press anything. The media itself
--    stays on LiveKit, one room per conversation.
begin;

-- ---------------------------------------------------------------- identity
create or replace function public.chat_me() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.staff_profiles where user_id = auth.uid() order by is_active desc nulls last limit 1
$$;

create or replace function public.chat_ids_of(p_user uuid) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select array_remove(array_agg(distinct x), null) from (
    select p_user as x
    union all select id from public.staff_profiles where user_id = p_user
    union all select user_id from public.staff_profiles where id = p_user
  ) ids
$$;

create or replace function public.chat_is_member(p_conversation uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.conversation_members m
                  where m.conversation_id = p_conversation
                    and m.user_id = any (public.chat_ids_of(auth.uid())))
$$;

create or replace function public.chat_is_admin(p_conversation uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.conversation_members m
                  where m.conversation_id = p_conversation and m.is_admin
                    and m.user_id = any (public.chat_ids_of(auth.uid())))
      or exists (select 1 from public.conversations c
                  where c.id = p_conversation and c.created_by = any (public.chat_ids_of(auth.uid())))
$$;

-- The LiveKit token function and the send RPC call this two-argument form; older
-- policies call it with one argument, so the live default (auth.uid()) stays.
create or replace function public.is_conversation_member(p_conversation_id uuid, p_user_id uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.conversation_members m
                  where m.conversation_id = p_conversation_id
                    and m.user_id = any (public.chat_ids_of(p_user_id)))
$$;

-- ----------------------------------------------------------------- columns
alter table public.conversation_members add column if not exists last_read_at timestamptz;
alter table public.conversation_members add column if not exists is_admin boolean not null default false;
alter table public.conversation_members add column if not exists joined_at timestamptz not null default now();
alter table public.messages add column if not exists is_deleted boolean not null default false;
alter table public.messages add column if not exists edited_at timestamptz;
alter table public.messages add column if not exists reply_to uuid references public.messages(id) on delete set null;
alter table public.conversations add column if not exists last_message_at timestamptz;
alter table public.conversations add column if not exists last_message_preview text;
alter table public.conversations add column if not exists updated_at timestamptz not null default now();
create index if not exists messages_conversation_time on public.messages(conversation_id, created_at);
create index if not exists conversation_members_user on public.conversation_members(user_id);

-- ---------------------------------------------------------------- policies
do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies
            where schemaname = 'public' and tablename in ('conversations', 'conversation_members', 'messages') loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

create policy chat_conversations_read on public.conversations for select to authenticated using (public.chat_is_member(id));
create policy chat_conversations_create on public.conversations for insert to authenticated with check (created_by = any (public.chat_ids_of(auth.uid())));
create policy chat_conversations_update on public.conversations for update to authenticated using (public.chat_is_member(id)) with check (public.chat_is_member(id));

create policy chat_members_read on public.conversation_members for select to authenticated using (public.chat_is_member(conversation_id));
create policy chat_members_add on public.conversation_members for insert to authenticated with check (public.chat_is_admin(conversation_id));
create policy chat_members_update_self on public.conversation_members for update to authenticated
  using (user_id = any (public.chat_ids_of(auth.uid()))) with check (user_id = any (public.chat_ids_of(auth.uid())));
create policy chat_members_remove on public.conversation_members for delete to authenticated
  using (user_id = any (public.chat_ids_of(auth.uid())) or public.chat_is_admin(conversation_id));

create policy chat_messages_read on public.messages for select to authenticated using (public.chat_is_member(conversation_id));
create policy chat_messages_send on public.messages for insert to authenticated
  with check (public.chat_is_member(conversation_id) and sender_id = any (public.chat_ids_of(auth.uid())));
create policy chat_messages_edit on public.messages for update to authenticated
  using (sender_id = any (public.chat_ids_of(auth.uid()))) with check (sender_id = any (public.chat_ids_of(auth.uid())));
create policy chat_messages_delete on public.messages for delete to authenticated using (sender_id = any (public.chat_ids_of(auth.uid())));

-- --------------------------------------------------------------- messaging
create or replace function public.chat_send(p_conversation uuid, p_content text, p_type text default 'text',
                                            p_file_path text default null, p_reply_to uuid default null)
returns public.messages language plpgsql security definer set search_path = '' as $$
declare me uuid := public.chat_me(); m public.messages;
begin
  if me is null or not public.chat_is_member(p_conversation) then raise exception 'You are not in this conversation'; end if;
  if length(btrim(coalesce(p_content, ''))) = 0 and p_file_path is null then raise exception 'Write a message first'; end if;
  if p_reply_to is not null and not exists (select 1 from public.messages where id = p_reply_to and conversation_id = p_conversation) then
    raise exception 'You can only reply to a message in this conversation';
  end if;
  insert into public.messages(conversation_id, sender_id, content, type, file_path, status, reply_to)
  values (p_conversation, me, left(coalesce(p_content, ''), 10000), coalesce(p_type, 'text'), p_file_path, 'sent', p_reply_to)
  returning * into m;
  update public.conversations set last_message_at = m.created_at, updated_at = now(),
    last_message_preview = case when m.type = 'text' then left(m.content, 120) when m.type = 'image' then 'Photo' when m.type = 'call_log' then m.content else 'Attachment: ' || left(m.content, 100) end
   where id = p_conversation;
  update public.conversation_members set last_read_at = m.created_at
   where conversation_id = p_conversation and user_id = any (public.chat_ids_of(auth.uid()));
  return m;
end $$;

create or replace function public.chat_edit(p_message uuid, p_content text) returns public.messages
language plpgsql security definer set search_path = '' as $$
declare m public.messages;
begin
  if length(btrim(coalesce(p_content, ''))) = 0 then raise exception 'A message cannot be empty'; end if;
  update public.messages set content = left(p_content, 10000), edited_at = now()
   where id = p_message and sender_id = any (public.chat_ids_of(auth.uid())) and not is_deleted and type = 'text'
  returning * into m;
  if m.id is null then raise exception 'You can only edit your own text messages'; end if;
  return m;
end $$;

create or replace function public.chat_delete(p_message uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.messages set is_deleted = true, content = '', file_path = null, edited_at = now()
   where id = p_message and sender_id = any (public.chat_ids_of(auth.uid()));
  if not found then raise exception 'You can only delete your own messages'; end if;
end $$;

create or replace function public.chat_mark_read(p_conversation uuid) returns void
language sql security definer set search_path = '' as $$
  update public.conversation_members set last_read_at = now()
   where conversation_id = p_conversation and user_id = any (public.chat_ids_of(auth.uid()))
$$;

-- Everything the conversation list needs, in one round trip.
create or replace function public.chat_inbox() returns table (
  id uuid, name text, is_group boolean, created_by uuid, last_message_at timestamptz, last_message_preview text,
  unread integer, my_last_read timestamptz, members jsonb
) language sql stable security definer set search_path = '' as $$
  with mine as (
    select m.conversation_id, max(m.last_read_at) as last_read
      from public.conversation_members m
     where m.user_id = any (public.chat_ids_of(auth.uid()))
     group by m.conversation_id
  )
  select c.id, c.name, c.is_group, c.created_by, c.last_message_at, c.last_message_preview,
         (select count(*)::int from public.messages x
           where x.conversation_id = c.id and not x.is_deleted
             and x.sender_id <> all (public.chat_ids_of(auth.uid()))
             and x.created_at > coalesce(mine.last_read, '-infinity'::timestamptz)) as unread,
         mine.last_read,
         (select coalesce(jsonb_agg(jsonb_build_object(
                  'user_id', coalesce(s.id, m.user_id), 'full_name', coalesce(s.full_name, 'Teammate'),
                  'avatar_url', s.avatar_url, 'is_admin', m.is_admin, 'last_read_at', m.last_read_at) order by s.full_name), '[]'::jsonb)
            from public.conversation_members m
            left join public.staff_profiles s on s.id = m.user_id or s.user_id = m.user_id
           where m.conversation_id = c.id) as members
    from public.conversations c join mine on mine.conversation_id = c.id
   order by coalesce(c.last_message_at, c.updated_at) desc nulls last
$$;

-- ------------------------------------------------------------------ groups
create or replace function public.create_group_conversation(p_name text, p_member_ids uuid[]) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.chat_me(); cid uuid; member uuid; resolved uuid;
begin
  if me is null then raise exception 'Active staff sign-in required'; end if;
  if nullif(btrim(p_name), '') is null then raise exception 'Give the group a name'; end if;
  insert into public.conversations(name, is_group, created_by, last_message_at, last_message_preview)
  values (btrim(p_name), true, me, now(), 'Group created') returning id into cid;
  insert into public.conversation_members(conversation_id, user_id, is_admin, last_read_at) values (cid, me, true, now());
  foreach member in array coalesce(p_member_ids, array[]::uuid[]) loop
    select id into resolved from public.staff_profiles where (id = member or user_id = member) and coalesce(is_active, true)
     order by (id = member) desc limit 1;
    if resolved is null then raise exception 'A selected teammate is no longer active'; end if;
    if resolved <> me then
      insert into public.conversation_members(conversation_id, user_id, is_admin) values (cid, resolved, false)
      on conflict do nothing;
    end if;
  end loop;
  return cid;
end $$;

create or replace function public.chat_add_members(p_conversation uuid, p_member_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare member uuid; resolved uuid;
begin
  if not exists (select 1 from public.conversations where id = p_conversation and is_group) then raise exception 'Only groups take new members'; end if;
  if not public.chat_is_admin(p_conversation) then raise exception 'Only a group admin can add people'; end if;
  foreach member in array coalesce(p_member_ids, array[]::uuid[]) loop
    select id into resolved from public.staff_profiles where (id = member or user_id = member) and coalesce(is_active, true)
     order by (id = member) desc limit 1;
    if resolved is null then raise exception 'A selected teammate is no longer active'; end if;
    if not exists (select 1 from public.conversation_members where conversation_id = p_conversation and user_id = any (public.chat_ids_of(resolved))) then
      insert into public.conversation_members(conversation_id, user_id, is_admin) values (p_conversation, resolved, false);
    end if;
  end loop;
end $$;

create or replace function public.chat_remove_member(p_conversation uuid, p_member uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.chat_is_admin(p_conversation) then raise exception 'Only a group admin can remove people'; end if;
  delete from public.conversation_members where conversation_id = p_conversation and user_id = any (public.chat_ids_of(p_member));
end $$;

create or replace function public.chat_rename(p_conversation uuid, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if nullif(btrim(p_name), '') is null then raise exception 'Give the group a name'; end if;
  if not public.chat_is_admin(p_conversation) then raise exception 'Only a group admin can rename it'; end if;
  update public.conversations set name = left(btrim(p_name), 100), updated_at = now() where id = p_conversation and is_group;
end $$;

create or replace function public.chat_leave(p_conversation uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.conversation_members where conversation_id = p_conversation and user_id = any (public.chat_ids_of(auth.uid()));
  -- A group never loses its last admin.
  if not exists (select 1 from public.conversation_members where conversation_id = p_conversation and is_admin) then
    update public.conversation_members set is_admin = true
     where conversation_id = p_conversation
       and user_id = (select user_id from public.conversation_members where conversation_id = p_conversation order by joined_at, user_id limit 1);
  end if;
end $$;

-- ------------------------------------------------------------------- calls
create table if not exists public.chat_calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  kind text not null check (kind in ('audio', 'video')),
  status text not null default 'ringing' check (status in ('ringing', 'active', 'ended', 'missed', 'declined')),
  started_by uuid not null references public.staff_profiles(id) on delete cascade,
  participants uuid[] not null default '{}',
  declined uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz
);
create index if not exists chat_calls_live on public.chat_calls(conversation_id) where status in ('ringing', 'active');
alter table public.chat_calls enable row level security;
drop policy if exists chat_calls_read on public.chat_calls;
create policy chat_calls_read on public.chat_calls for select to authenticated using (public.chat_is_member(conversation_id));
revoke all on public.chat_calls from public, anon;
grant select on public.chat_calls to authenticated;
grant all on public.chat_calls to service_role;

-- Close a call and leave its line in the conversation.
create or replace function public.chat_call_finish(p_call uuid, p_status text) returns public.chat_calls
language plpgsql security definer set search_path = '' as $$
declare c public.chat_calls; mins integer; label text; kind text;
begin
  update public.chat_calls set status = p_status, ended_at = now(), participants = '{}'
   where id = p_call and status in ('ringing', 'active') returning * into c;
  if c.id is null then select * into c from public.chat_calls where id = p_call; return c; end if;
  kind := case c.kind when 'video' then 'video' else 'voice' end;
  mins := greatest(1, ceil(extract(epoch from (c.ended_at - coalesce(c.answered_at, c.created_at))) / 60.0)::int);
  label := case p_status
    when 'missed' then 'Missed ' || kind || ' call'
    when 'declined' then 'Declined ' || kind || ' call'
    else initcap(kind) || ' call · ' || mins || ' min' end;
  insert into public.messages(conversation_id, sender_id, content, type, status) values (c.conversation_id, c.started_by, label, 'call_log', 'sent');
  update public.conversations set last_message_at = now(), last_message_preview = label, updated_at = now() where id = c.conversation_id;
  return c;
end $$;

-- A call that nobody is in, or that rang for over a minute unanswered, is over.
create or replace function public.chat_call_settle(p_call uuid) returns public.chat_calls
language plpgsql security definer set search_path = '' as $$
declare c public.chat_calls;
begin
  select * into c from public.chat_calls where id = p_call for update;
  if c.id is null or c.status not in ('ringing', 'active') then return c; end if;
  if c.status = 'ringing' and c.created_at < now() - interval '60 seconds' then return public.chat_call_finish(c.id, 'missed'); end if;
  if c.status = 'active' and coalesce(array_length(c.participants, 1), 0) = 0 then return public.chat_call_finish(c.id, 'ended'); end if;
  return c;
end $$;

create or replace function public.chat_call_start(p_conversation uuid, p_kind text) returns public.chat_calls
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.chat_me(); c public.chat_calls;
begin
  if me is null or not public.chat_is_member(p_conversation) then raise exception 'You are not in this conversation'; end if;
  perform pg_advisory_xact_lock(hashtextextended('chat-call:' || p_conversation::text, 0));
  for c in select * from public.chat_calls where conversation_id = p_conversation and status in ('ringing', 'active') loop
    perform public.chat_call_settle(c.id);
  end loop;
  -- Someone already started one here: join it instead of ringing twice.
  select * into c from public.chat_calls where conversation_id = p_conversation and status in ('ringing', 'active') order by created_at desc limit 1;
  if c.id is not null then
    update public.chat_calls set participants = array(select distinct unnest(participants || me)),
      status = case when status = 'ringing' and started_by <> me then 'active' else status end,
      answered_at = case when status = 'ringing' and started_by <> me then now() else answered_at end
     where id = c.id returning * into c;
    return c;
  end if;
  insert into public.chat_calls(conversation_id, kind, started_by, participants)
  values (p_conversation, case when p_kind = 'video' then 'video' else 'audio' end, me, array[me]) returning * into c;
  return c;
end $$;

create or replace function public.chat_call_join(p_call uuid) returns public.chat_calls
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.chat_me(); c public.chat_calls;
begin
  select * into c from public.chat_calls where id = p_call for update;
  if c.id is null or not public.chat_is_member(c.conversation_id) then raise exception 'This call is not in your conversations'; end if;
  if c.status not in ('ringing', 'active') then raise exception 'This call has ended'; end if;
  update public.chat_calls set participants = array(select distinct unnest(participants || me)),
    declined = array_remove(declined, me), status = 'active', answered_at = coalesce(answered_at, now())
   where id = c.id returning * into c;
  return c;
end $$;

create or replace function public.chat_call_decline(p_call uuid) returns public.chat_calls
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.chat_me(); c public.chat_calls; grp boolean; others integer;
begin
  select * into c from public.chat_calls where id = p_call for update;
  if c.id is null or not public.chat_is_member(c.conversation_id) then raise exception 'This call is not in your conversations'; end if;
  if c.status <> 'ringing' then return c; end if;
  update public.chat_calls set declined = array(select distinct unnest(declined || me)) where id = c.id returning * into c;
  select is_group into grp from public.conversations where id = c.conversation_id;
  select count(*) into others from public.conversation_members m
   where m.conversation_id = c.conversation_id and m.user_id <> all (public.chat_ids_of(c.started_by))
     and m.user_id <> all (c.declined);
  if not grp or others = 0 then
    return public.chat_call_finish(c.id, 'declined');
  end if;
  return c;
end $$;

create or replace function public.chat_call_leave(p_call uuid) returns public.chat_calls
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.chat_me(); c public.chat_calls; grp boolean;
begin
  select * into c from public.chat_calls where id = p_call for update;
  if c.id is null or not public.chat_is_member(c.conversation_id) then raise exception 'This call is not in your conversations'; end if;
  if c.status not in ('ringing', 'active') then return c; end if;
  select is_group into grp from public.conversations where id = c.conversation_id;
  -- The caller hangs up before anyone answers: a missed call.
  if c.status = 'ringing' and c.started_by = me then return public.chat_call_finish(c.id, 'missed'); end if;
  -- One-to-one: either side hanging up ends it for both.
  if not grp then return public.chat_call_finish(c.id, case when c.status = 'ringing' then 'missed' else 'ended' end); end if;
  update public.chat_calls set participants = array_remove(participants, me) where id = c.id;
  return public.chat_call_settle(c.id);
end $$;

-- ---------------------------------------------------------------- realtime
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['messages', 'conversations', 'conversation_members', 'chat_calls'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- ------------------------------------------------------------------ grants
grant select, insert, update, delete on public.conversations, public.conversation_members, public.messages to authenticated;
revoke all on function public.chat_me(), public.chat_ids_of(uuid), public.chat_is_member(uuid), public.chat_is_admin(uuid),
  public.is_conversation_member(uuid, uuid), public.chat_send(uuid, text, text, text, uuid), public.chat_edit(uuid, text),
  public.chat_delete(uuid), public.chat_mark_read(uuid), public.chat_inbox(), public.create_group_conversation(text, uuid[]),
  public.chat_add_members(uuid, uuid[]), public.chat_remove_member(uuid, uuid), public.chat_rename(uuid, text), public.chat_leave(uuid),
  public.chat_call_finish(uuid, text), public.chat_call_settle(uuid), public.chat_call_start(uuid, text), public.chat_call_join(uuid), public.chat_call_decline(uuid),
  public.chat_call_leave(uuid) from public, anon;
grant execute on function public.chat_me(), public.chat_ids_of(uuid), public.chat_is_member(uuid), public.chat_is_admin(uuid),
  public.is_conversation_member(uuid, uuid), public.chat_send(uuid, text, text, text, uuid), public.chat_edit(uuid, text),
  public.chat_delete(uuid), public.chat_mark_read(uuid), public.chat_inbox(), public.create_group_conversation(text, uuid[]),
  public.chat_add_members(uuid, uuid[]), public.chat_remove_member(uuid, uuid), public.chat_rename(uuid, text), public.chat_leave(uuid),
  public.chat_call_settle(uuid), public.chat_call_start(uuid, text), public.chat_call_join(uuid), public.chat_call_decline(uuid),
  public.chat_call_leave(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
