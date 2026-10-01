begin;
alter table public.mission_work_items add column if not exists impact text check(length(impact)<=1000);
create table public.mission_posts (
 id uuid primary key default gen_random_uuid(),
 author_id uuid references public.staff_profiles(id) on delete set null,
 kind text not null check(kind in ('update','help','win','activity','comment')),
 content text not null check(length(btrim(content)) between 1 and 4000),
 institution_id uuid references public.expansion_institutions(id) on delete set null,
 work_item_id uuid references public.mission_work_items(id) on delete set null,
 parent_id uuid references public.mission_posts(id) on delete cascade,
 resolved boolean not null default false,
 created_at timestamptz not null default now(),
 check ((kind='comment')=(parent_id is not null))
);
create index mission_posts_feed on public.mission_posts(created_at desc) where parent_id is null;
create index mission_posts_thread on public.mission_posts(parent_id,created_at);
create index mission_posts_work on public.mission_posts(work_item_id);
create table public.mission_reactions (
 post_id uuid not null references public.mission_posts(id) on delete cascade,
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 reaction text not null check(reaction in ('celebrate','help')),
 created_at timestamptz not null default now(),primary key(post_id,user_id,reaction)
);
create table public.mission_visits (
 user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
 last_seen_at timestamptz not null default now() check(last_seen_at <= now()+interval '1 minute')
);
alter table public.mission_posts enable row level security;
alter table public.mission_reactions enable row level security;
alter table public.mission_visits enable row level security;
create policy mission_posts_read on public.mission_posts for select to authenticated using(public.fets_is_active_staff());
create policy mission_posts_insert on public.mission_posts for insert to authenticated with check(public.fets_is_active_staff() and kind<>'activity' and author_id in(select id from public.staff_profiles where user_id=auth.uid()));
create policy mission_posts_update on public.mission_posts for update to authenticated using(public.fets_is_active_staff() and kind='help' and author_id in(select id from public.staff_profiles where user_id=auth.uid())) with check(public.fets_is_active_staff() and kind='help' and author_id in(select id from public.staff_profiles where user_id=auth.uid()));
create policy mission_reactions_read on public.mission_reactions for select to authenticated using(public.fets_is_active_staff());
create policy mission_reactions_insert on public.mission_reactions for insert to authenticated with check(public.fets_is_active_staff() and user_id=auth.uid());
create policy mission_reactions_delete on public.mission_reactions for delete to authenticated using(public.fets_is_active_staff() and user_id=auth.uid());
create policy mission_visits_own on public.mission_visits for all to authenticated using(public.fets_is_active_staff() and user_id=auth.uid()) with check(public.fets_is_active_staff() and user_id=auth.uid());
create function public.mission_post_guard() returns trigger language plpgsql set search_path='' as $$
declare parent public.mission_posts;begin
 if tg_op='UPDATE' then
  if (new.id,new.author_id,new.kind,new.content,new.parent_id,new.created_at) is distinct from (old.id,old.author_id,old.kind,old.content,old.parent_id,old.created_at) then raise exception 'Only the help resolution can change';end if;
  if (new.institution_id,new.work_item_id) is distinct from (old.institution_id,old.work_item_id) and not (pg_trigger_depth()>1 and (new.institution_id is null or new.institution_id=old.institution_id) and (new.work_item_id is null or new.work_item_id=old.work_item_id)) then raise exception 'Post context cannot change';end if;
 else
  new.created_at:=now();
  if new.parent_id is not null then
   select * into parent from public.mission_posts where id=new.parent_id;
   if not found or parent.parent_id is not null then raise exception 'Reply to a main update';end if;
   new.institution_id:=parent.institution_id;new.work_item_id:=parent.work_item_id;
  elsif new.work_item_id is not null then
   select institution_id into new.institution_id from public.mission_work_items where id=new.work_item_id;
  end if;
 end if;
 if new.resolved and new.kind<>'help' then raise exception 'Only help requests can be resolved';end if;
 return new;
end $$;
create trigger mission_post_guard before insert or update on public.mission_posts for each row execute function public.mission_post_guard();
create function public.mission_reaction_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if new.reaction='help' and not exists(select 1 from public.mission_posts where id=new.post_id and kind='help' and not resolved) then raise exception 'This help request is already resolved or unavailable';end if;
 return new;
end $$;
create trigger mission_reaction_guard before insert on public.mission_reactions for each row execute function public.mission_reaction_guard();
create function public.mission_record_work_activity() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid; message text;begin
 select id into actor from public.staff_profiles where user_id=auth.uid() and is_active limit 1;
 if tg_op='INSERT' then message:='Added a next step: '||new.title;
 elsif new.status is distinct from old.status then message:=case new.status when 'done' then 'Completed: ' when 'blocked' then 'Needs a hand: ' when 'in_progress' then 'Started: ' else 'Reopened: ' end||new.title||case when new.status='blocked' then E'\n'||coalesce(new.blocker,'Help needed') else '' end;
 elsif new.owner_id is distinct from old.owner_id then message:='Updated ownership: '||new.title;
 elsif (new.due_date,new.title,new.impact) is distinct from (old.due_date,old.title,old.impact) then message:='Updated the next step: '||new.title;
 else return new;end if;
 insert into public.mission_posts(author_id,kind,content,work_item_id,institution_id) values(actor,'activity',left(message,4000),new.id,new.institution_id);
 return new;
end $$;
create trigger mission_work_activity after insert or update on public.mission_work_items for each row execute function public.mission_record_work_activity();
create or replace function public.mission_record_centre_activity() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid;begin
 select id into actor from public.staff_profiles where user_id=auth.uid() and is_active limit 1;
 if tg_op='INSERT' or new.stage is distinct from old.stage then
  insert into public.mission_posts(author_id,kind,content,institution_id) values(actor,'activity',case when tg_op='INSERT' then 'Added to our shortlist: '||new.name else new.name||' moved to '||replace(new.stage::text,'_',' ') end,new.id);
 end if;return new;
end $$;
create trigger mission_centre_activity after insert or update on public.expansion_institutions for each row execute function public.mission_record_centre_activity();
revoke all on function public.mission_record_work_activity(),public.mission_record_centre_activity() from public,anon,authenticated;
grant select,insert,update on public.mission_posts to authenticated;
grant select,insert,delete on public.mission_reactions to authenticated;
grant select,insert,update on public.mission_visits to authenticated;
alter publication supabase_realtime add table public.mission_posts,public.mission_reactions;
notify pgrst,'reload schema';

alter table public.mission_posts add column last_activity_at timestamptz not null default now(), add column reply_count integer not null default 0 check(reply_count>=0);
update public.mission_posts set last_activity_at=created_at;
create index mission_posts_recent_activity on public.mission_posts(last_activity_at desc) where parent_id is null;
create or replace function public.mission_post_guard() returns trigger language plpgsql set search_path='' as $$
declare parent public.mission_posts;begin
 if tg_op='UPDATE' then
  if (new.id,new.author_id,new.kind,new.content,new.parent_id,new.created_at) is distinct from (old.id,old.author_id,old.kind,old.content,old.parent_id,old.created_at) then raise exception 'Only the help resolution can change';end if;
  if (new.institution_id,new.work_item_id) is distinct from (old.institution_id,old.work_item_id) and not (pg_trigger_depth()>1 and (new.institution_id is null or new.institution_id=old.institution_id) and (new.work_item_id is null or new.work_item_id=old.work_item_id)) then raise exception 'Post context cannot change';end if;
  if pg_trigger_depth()<2 and (new.last_activity_at,new.reply_count) is distinct from (old.last_activity_at,old.reply_count) then raise exception 'Conversation activity is maintained automatically';end if;
  if new.resolved is distinct from old.resolved then new.last_activity_at:=now();end if;
 else
  new.created_at:=now();new.last_activity_at:=now();new.reply_count:=0;
  if new.parent_id is not null then
   select * into parent from public.mission_posts where id=new.parent_id;
   if not found or parent.parent_id is not null then raise exception 'Reply to a main update';end if;
   new.institution_id:=parent.institution_id;new.work_item_id:=parent.work_item_id;
  elsif new.work_item_id is not null then
   select institution_id into new.institution_id from public.mission_work_items where id=new.work_item_id;
  end if;
 end if;
 if new.resolved and new.kind<>'help' then raise exception 'Only help requests can be resolved';end if;
 return new;
end $$;
create function public.mission_reply_activity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.mission_posts set last_activity_at=now(),reply_count=reply_count+1 where id=new.parent_id;
 return new;
end $$;
create trigger mission_reply_activity after insert on public.mission_posts for each row when(new.parent_id is not null) execute function public.mission_reply_activity();
create function public.mission_field_note_activity() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid;begin
 select id into actor from public.staff_profiles where user_id=auth.uid() and is_active limit 1;
 if length(btrim(coalesce(new.content,'')))>0 then
  insert into public.mission_posts(author_id,kind,content,institution_id) values(actor,'update',left(new.content,4000),new.institution_id);
 end if;return new;
end $$;
create trigger mission_field_note_activity after insert on public.expansion_activity_logs for each row execute function public.mission_field_note_activity();
create function public.mission_visit_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' then new.last_seen_at:=greatest(old.last_seen_at,new.last_seen_at);end if;
 new.last_seen_at:=least(new.last_seen_at,now());return new;
end $$;
create trigger mission_visit_guard before insert or update on public.mission_visits for each row execute function public.mission_visit_guard();
revoke all on function public.mission_reply_activity(),public.mission_field_note_activity() from public,anon,authenticated;
notify pgrst,'reload schema';

commit;
