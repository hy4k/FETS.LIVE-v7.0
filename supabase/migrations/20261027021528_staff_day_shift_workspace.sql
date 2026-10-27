-- FETS Live only. New staff-day model; all previous plans/events/reports retained.
begin;
create table public.shift_days_v2(
 id uuid primary key default gen_random_uuid(),branch text not null check(branch in ('calicut','cochin')),day date not null,
 lead_id uuid references public.staff_profiles(id),plan jsonb not null check(jsonb_typeof(plan)='object' and octet_length(plan::text)<=200000),
 status text not null default 'draft' check(status in('draft','published','closed')),version integer not null default 1,
 created_by uuid not null default auth.uid() references auth.users(id),updated_at timestamptz not null default clock_timestamp(),
 change_reason text not null default '',report text not null default '',published_at timestamptz,unique(branch,day)
);
create table public.shift_versions_v2(id bigint generated always as identity primary key,day_id uuid not null references public.shift_days_v2(id),version integer not null,snapshot jsonb not null,actor_id uuid references public.staff_profiles(id),created_at timestamptz not null default clock_timestamp(),unique(day_id,version));
create table public.shift_work_events_v2(
 id uuid primary key default gen_random_uuid(),day_id uuid not null references public.shift_days_v2(id),block_id uuid,
 task_id text not null check(length(task_id) between 1 and 100),kind text not null check(kind in('done','verify','return','help','handover')),
 actor_id uuid not null references public.staff_profiles(id),note text not null default '' check(length(note)<=2000),created_at timestamptz not null default clock_timestamp()
);
create table public.shift_check_events_v2(
 id uuid primary key default gen_random_uuid(),day_id uuid not null references public.shift_days_v2(id),window_no integer not null,
 kind text not null check(kind in('walk','dvr')),due integer not null check(due between 1 and 1440),actor_id uuid not null references public.staff_profiles(id),
 note text not null default '' check(length(note)<=2000),source text not null check(source in('live','online')),online_user_id uuid,
 created_at timestamptz not null default clock_timestamp(),unique(day_id,kind,due)
);
create index shift_work_events_v2_day_idx on public.shift_work_events_v2(day_id,created_at,id);
create index shift_work_events_v2_actor_idx on public.shift_work_events_v2(actor_id,day_id);
create index shift_check_events_v2_actor_idx on public.shift_check_events_v2(actor_id,day_id);
create index shift_days_v2_lead_idx on public.shift_days_v2(lead_id,day);
create index shift_days_v2_creator_idx on public.shift_days_v2(created_by);
create index shift_versions_v2_actor_idx on public.shift_versions_v2(actor_id);
alter table public.shift_days_v2 enable row level security;alter table public.shift_versions_v2 enable row level security;
alter table public.shift_work_events_v2 enable row level security;alter table public.shift_check_events_v2 enable row level security;
revoke all on public.shift_days_v2,public.shift_versions_v2,public.shift_work_events_v2,public.shift_check_events_v2 from public,anon,authenticated;
grant select,insert,update on public.shift_days_v2 to authenticated;
grant select on public.shift_versions_v2 to authenticated;
grant select,insert on public.shift_work_events_v2,public.shift_check_events_v2 to authenticated;
grant all on public.shift_days_v2,public.shift_versions_v2,public.shift_work_events_v2,public.shift_check_events_v2 to service_role;
grant usage,select on sequence public.shift_versions_v2_id_seq to authenticated,service_role;
-- Invoker identity retains the existing trusted duty directory and active staff checks.
create function fets_duty_private.shift_actor_v2() returns uuid language sql stable security invoker set search_path='' as $$
 select s.id from public.staff_profiles s join public.centre_duty_members m on m.profile_id=s.id
 where m.user_id=(select auth.uid()) and s.user_id=m.user_id and s.is_active is distinct from false order by m.branch limit 1
$$;
-- Read-only definer lookup is needed to validate OTHER assignees against the
-- trusted directory (whose RLS exposes only the caller's own membership).
-- It is private, requires an active caller with centre access, and grants no writes.
create function fets_duty_private.shift_member_v2(who uuid,b text) returns boolean language sql stable security definer set search_path='' as $$
 select fets_duty_private.shift_actor_v2() is not null and fets_duty_private.can_read(b)
 and exists(select 1 from public.centre_duty_members m join public.staff_profiles s on s.id=m.profile_id and s.user_id=m.user_id
 where s.id=who and s.is_active is distinct from false and (m.branch=b or(m.branch='*' and m.role='super_admin')))
$$;
create function fets_duty_private.shift_scheduled_v2(who uuid,day_id uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.shift_days_v2 d cross join lateral jsonb_array_elements(d.plan->'people') person join public.staff_profiles p on p.id=(person->>'id')::uuid
 where d.id=day_id and p.id=who and p.is_active is distinct from false and (fets_duty_private.rostered(who,d.branch,d.day) or (person->>'support'='true' and length(btrim(coalesce(person->>'supportReason','')))>=5 and lower(p.branch_assigned) in(d.branch,'global','all'))))
$$;
create function fets_duty_private.shift_owner_v2(p jsonb,t integer) returns uuid language sql immutable security invoker set search_path='' as $$
 select case when count(*)=1 then (array_agg((b->>'staff')::uuid))[1] else null end from jsonb_array_elements(p->'blocks') b
 where b->'duties' ? 'monitor' and (b->>'start')::int<=t and t<(b->>'end')::int
$$;
create function fets_duty_private.shift_slots_v2(p jsonb) returns table(window_no integer,kind text,due integer,owner_id uuid)
 language sql immutable security invoker set search_path='' as $$
 select (w.n-1)::int,k.kind,d.t,fets_duty_private.shift_owner_v2(p,d.t-1)
 from jsonb_array_elements(p->'monitoring') with ordinality w(v,n)
 cross join (values('walk',10),('dvr',6)) k(kind,step)
 cross join lateral generate_series((w.v->>'start')::int+k.step,(w.v->>'end')::int,k.step) d(t)
$$;
create function fets_duty_private.shift_range_v2(a integer,b integer) returns boolean language sql immutable set search_path='' as $$select a is not null and b is not null and a>=0 and a<b and b<=1440$$;
create function fets_duty_private.shift_validate_v2(p jsonb,b text,d date,strict boolean) returns void language plpgsql security invoker set search_path='' as $$
declare person jsonb; block jsonb; task jsonb; w jsonb; prev_end int:=-1; t int; owner uuid; r public.roster_schedules; a int; z int;
begin
 if (p->>'schema') is distinct from '2' or jsonb_typeof(p->'people') is distinct from 'array' or jsonb_typeof(p->'blocks') is distinct from 'array' or jsonb_typeof(p->'opening') is distinct from 'array' or jsonb_typeof(p->'monitoring') is distinct from 'array' then raise exception 'Invalid staff-day plan'; end if;
 if jsonb_array_length(p->'people')>100 or jsonb_array_length(p->'blocks')>500 or jsonb_array_length(p->'opening')>100 or jsonb_array_length(p->'monitoring')>48 then raise exception 'Plan is too large'; end if;
 if not strict then return;end if;
 if jsonb_array_length(p->'people')=0 or jsonb_array_length(p->'monitoring')=0 then raise exception 'Add staff and actual monitoring periods before publishing';end if;
 if (select count(distinct (x->>'id')::uuid) from jsonb_array_elements(p->'people') x)<>jsonb_array_length(p->'people') or (select count(distinct (x->>'id')::uuid) from jsonb_array_elements(p->'blocks') x)<>jsonb_array_length(p->'blocks') then raise exception 'Duplicate staff or duty block';end if;
 for person in select * from jsonb_array_elements(p->'people') loop
  if not fets_duty_private.shift_member_v2((person->>'id')::uuid,b) then raise exception 'Every assigned staff member needs active FETS Live access to this centre';end if;
  if not fets_duty_private.shift_range_v2((person->>'start')::int,(person->>'end')::int) or length(btrim(coalesce(person->>'name','')))=0 then raise exception 'Confirm each staff member and shift hours';end if;
  if person->>'support'='true' then
   if length(btrim(coalesce(person->>'supportReason','')))<5 or not exists(select 1 from public.staff_profiles s where s.id=(person->>'id')::uuid and s.is_active is distinct from false and lower(s.branch_assigned) in(b,'global','all')) then raise exception 'Temporary cover needs an active centre staff member and a management reason';end if;
   continue;
  end if;
  if not fets_duty_private.rostered((person->>'id')::uuid,b,d) then raise exception 'Assigned staff must be on this centre roster for the day';end if;
  select * into r from public.roster_schedules where profile_id=(person->>'id')::uuid and date=d and lower(coalesce(nullif(branch_location,''),b))=b limit 1;
  a:=case when r.shift_start is not null then extract(epoch from r.shift_start)::int/60 when r.shift_code in('D','OT') then 480 end;
  z:=case when r.shift_end is not null then extract(epoch from r.shift_end)::int/60 when r.shift_code in('D','OT') then 1020 end;
  if a is null or z is null or (person->>'start')::int<a or (person->>'end')::int>z then raise exception 'Plan hours must stay within the saved roster; correct the roster first';end if;
 end loop;
 for block in select * from jsonb_array_elements(p->'blocks') loop
  select x into person from jsonb_array_elements(p->'people') x where x->>'id'=block->>'staff';
  if person is null or not fets_duty_private.shift_range_v2((block->>'start')::int,(block->>'end')::int) or (block->>'start')::int<(person->>'start')::int or (block->>'end')::int>(person->>'end')::int then raise exception 'Duty block is outside the assigned staff shift';end if;
  perform (block->>'id')::uuid;
  if (select count(distinct (x->>'id')::uuid) from jsonb_array_elements(block->'tasks') x)<>jsonb_array_length(block->'tasks') then raise exception 'Duplicate checklist item';end if;
  if jsonb_typeof(block->'duties') is distinct from 'array' or jsonb_array_length(block->'duties')=0 or jsonb_typeof(block->'tasks') is distinct from 'array' or jsonb_array_length(block->'tasks')>100 then raise exception 'Choose duties and valid checklist items';end if;
  if exists(select 1 from jsonb_array_elements_text(block->'duties') x where x not in('opening','front','calling','security','proadmin','monitor','admin','training','break','checkout','handover','closing','other')) then raise exception 'Unknown duty';end if;
  if (block->'duties' ?| array['break','training']) and jsonb_array_length(block->'duties')<>1 then raise exception 'Break and training must be separate from working duties';end if;
  if (block->'duties' ? 'monitor') and (block->'duties' ?| array['opening','front','calling','security','proadmin']) then raise exception 'Hall monitoring cannot share an admission duty';end if;
  if block->'duties' ? 'other' and length(btrim(coalesce(block->>'note','')))=0 and jsonb_array_length(block->'tasks')=0 then raise exception 'Describe other assigned work with instructions or checklist items';end if;
  for task in select * from jsonb_array_elements(block->'tasks') loop
   perform (task->>'id')::uuid;if length(btrim(coalesce(task->>'label',''))) not between 1 and 500 then raise exception 'Every checklist item needs a description';end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(p->'blocks') other where other->>'staff'=block->>'staff' and other->>'id'<>block->>'id' and (other->>'start')::int<(block->>'end')::int and (other->>'end')::int>(block->>'start')::int) then raise exception 'A staff member has overlapping duty blocks';end if;
 end loop;
 for person in select * from jsonb_array_elements(p->'people') loop
  if coalesce((select sum((x->>'end')::int-(x->>'start')::int) from jsonb_array_elements(p->'blocks') x where x->>'staff'=person->>'id'),0)<>(person->>'end')::int-(person->>'start')::int then raise exception 'Assign the whole saved shift for every person, including breaks';end if;
 end loop;
 if jsonb_array_length(p->'opening')>0 and (not fets_duty_private.shift_range_v2(0,(p->>'openingBy')::int)) then raise exception 'Set the opening checklist deadline';end if;
 for w in select x from jsonb_array_elements(p->'monitoring') x order by (x->>'start')::int loop
  if not fets_duty_private.shift_range_v2((w->>'start')::int,(w->>'end')::int) or (w->>'start')::int<prev_end then raise exception 'Monitoring periods must be valid and must not overlap';end if;
  prev_end:=(w->>'end')::int;
  for t in (w->>'start')::int..((w->>'end')::int-1) loop
   owner:=fets_duty_private.shift_owner_v2(p,t);if owner is null then raise exception 'Every monitoring minute needs exactly one named owner, including changeovers';end if;
  end loop;
  for block in select x from jsonb_array_elements(p->'blocks') x where x->'duties' ? 'break' and (x->>'start')::int<(w->>'end')::int and (x->>'end')::int>(w->>'start')::int loop
   if nullif(block->>'cover','') is null or block->>'cover'=block->>'staff' then raise exception 'Name the actual hall cover for every break during testing';end if;
   for t in greatest((block->>'start')::int,(w->>'start')::int)..(least((block->>'end')::int,(w->>'end')::int)-1) loop
    if fets_duty_private.shift_owner_v2(p,t) is distinct from (block->>'cover')::uuid then raise exception 'Named break cover must actually hold hall monitoring for the whole break';end if;
   end loop;
  end loop;
 end loop;
 if (select count(distinct (x->>'id')::uuid) from jsonb_array_elements(p->'opening') x)<>jsonb_array_length(p->'opening') then raise exception 'Duplicate opening checklist item';end if;
 for task in select * from jsonb_array_elements(p->'opening') loop
  perform (task->>'id')::uuid;if length(btrim(coalesce(task->>'label',''))) not between 1 and 500 or not exists(select 1 from jsonb_array_elements(p->'people') x where x->>'id'=task->>'owner') then raise exception 'Assign every opening checklist item to one staff member';end if;
  if not exists(select 1 from jsonb_array_elements(p->'blocks') x where x->>'staff'=task->>'owner' and x->'duties' ? 'opening' and (x->>'start')::int<(p->>'openingBy')::int) then raise exception 'Opening task owners must have opening duty before the deadline';end if;
 end loop;
end $$;
create policy shift_day_read_v2 on public.shift_days_v2 for select to authenticated using(fets_duty_private.shift_actor_v2() is not null and fets_duty_private.can_read(branch) and (status<>'draft' or fets_duty_private.can_plan(branch) or lead_id=fets_duty_private.shift_actor_v2()));
create policy shift_day_insert_v2 on public.shift_days_v2 for insert to authenticated with check(fets_duty_private.shift_actor_v2() is not null and (fets_duty_private.can_plan(branch) or fets_duty_private.week_lead(branch,day)=fets_duty_private.shift_actor_v2()));
create policy shift_day_update_v2 on public.shift_days_v2 for update to authenticated using(fets_duty_private.can_plan(branch) or lead_id=fets_duty_private.shift_actor_v2()) with check(fets_duty_private.shift_actor_v2() is not null and (fets_duty_private.can_plan(branch) or lead_id=fets_duty_private.shift_actor_v2()));
create policy shift_versions_read_v2 on public.shift_versions_v2 for select to authenticated using(exists(select 1 from public.shift_days_v2 d where d.id=day_id));
create policy shift_versions_insert_v2 on public.shift_versions_v2 for insert to authenticated with check(actor_id=fets_duty_private.shift_actor_v2() and exists(select 1 from public.shift_days_v2 d where d.id=day_id and (fets_duty_private.can_plan(d.branch) or d.lead_id=fets_duty_private.shift_actor_v2())));
grant insert on public.shift_versions_v2 to authenticated;
create policy shift_work_read_v2 on public.shift_work_events_v2 for select to authenticated using(exists(select 1 from public.shift_days_v2 d where d.id=day_id));
create policy shift_work_insert_v2 on public.shift_work_events_v2 for insert to authenticated with check(actor_id=fets_duty_private.shift_actor_v2() and exists(select 1 from public.shift_days_v2 d where d.id=day_id));
create policy shift_check_read_v2 on public.shift_check_events_v2 for select to authenticated using(exists(select 1 from public.shift_days_v2 d where d.id=day_id));
create policy shift_check_insert_v2 on public.shift_check_events_v2 for insert to authenticated with check(actor_id=fets_duty_private.shift_actor_v2() and source='live' and online_user_id is null and exists(select 1 from public.shift_days_v2 d where d.id=day_id));
create function fets_duty_private.shift_day_guard_v2() returns trigger language plpgsql security invoker set search_path='' as $$
declare who uuid:=fets_duty_private.shift_actor_v2(); old_b jsonb; new_b jsonb; cutoff int; today date:=(clock_timestamp() at time zone 'Asia/Kolkata')::date;
begin
 if who is null then raise exception 'Active staff account required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(new.id::text,0));
 if tg_op='INSERT' then
  if new.status='closed' or not(fets_duty_private.can_plan(new.branch) or fets_duty_private.week_lead(new.branch,new.day)=who) then raise exception 'Planner access required' using errcode='42501';end if;
  if not fets_duty_private.can_plan(new.branch) and exists(select 1 from jsonb_array_elements(new.plan->'people') x where x->>'support'='true') then raise exception 'Only a planner can assign temporary cover';end if;
  new.created_by:=auth.uid();new.version:=1;
 else
  if (new.id,new.branch,new.day,new.created_by) is distinct from (old.id,old.branch,old.day,old.created_by) or old.status='closed' then raise exception 'Day identity and closed shifts cannot be changed';end if;
  if not(fets_duty_private.can_plan(old.branch) or old.lead_id=who) then raise exception 'Planner or day lead required' using errcode='42501';end if;
  if new.lead_id is distinct from old.lead_id and not fets_duty_private.can_plan(old.branch) then raise exception 'Only a planner can appoint the day lead';end if;
  if not fets_duty_private.can_plan(old.branch) and exists(select 1 from jsonb_array_elements(new.plan->'people') x where x->>'support'='true' and not exists(select 1 from jsonb_array_elements(old.plan->'people') y where y=x)) then raise exception 'Only a planner can change temporary cover';end if;
  if old.status='published' then
   if new.status='draft' then raise exception 'A published day cannot become an unpublished draft';end if;
   if length(btrim(new.change_reason))=0 then raise exception 'Give a reason for changing a published plan';end if;
   cutoff:=case when old.day<today then 1440 when old.day=today then extract(epoch from (clock_timestamp() at time zone 'Asia/Kolkata')::time)::int/60 else 0 end;
   for old_b in select x from jsonb_array_elements(old.plan->'blocks') x where (x->>'start')::int<cutoff loop
    select x into new_b from jsonb_array_elements(new.plan->'blocks') x where x->>'id'=old_b->>'id';
    if new_b is null or (new_b-'end') is distinct from (old_b-'end') or least((new_b->>'end')::int,cutoff)<>least((old_b->>'end')::int,cutoff) then raise exception 'Past work is immutable. Split an ongoing block at the current time to change future cover';end if;
   end loop;
   if exists(select 1 from jsonb_array_elements(new.plan->'blocks') x where (x->>'start')::int<cutoff and not exists(select 1 from jsonb_array_elements(old.plan->'blocks') y where y->>'id'=x->>'id')) then raise exception 'New duties cannot be backdated';end if;
   if new.plan->'opening' is distinct from old.plan->'opening' then raise exception 'Opening ownership cannot change after publication';end if;
   if exists(select 1 from fets_duty_private.shift_slots_v2(old.plan) a where a.due<=cutoff and not exists(select 1 from fets_duty_private.shift_slots_v2(new.plan) b where (b.kind,b.due,b.owner_id) is not distinct from (a.kind,a.due,a.owner_id))) then raise exception 'Past monitoring slots and owners must be retained';end if;
  end if;
  new.version:=old.version+1;
 end if;
 if new.lead_id is not null and not exists(select 1 from jsonb_array_elements(new.plan->'people') x where x->>'id'=new.lead_id::text) then raise exception 'Choose a day lead from the staff on this plan';end if;
 perform fets_duty_private.shift_validate_v2(new.plan,new.branch,new.day,new.status<>'draft');
 if new.status='closed' then
  if tg_op='INSERT' or old.status<>'published' then raise exception 'Publish the day before closing it';end if;
  if length(btrim(new.report))=0 then raise exception 'Record the closing handover and pending work';end if;
  if new.day>today or (new.day=today and exists(select 1 from jsonb_array_elements(new.plan->'monitoring') w where (w->>'end')::int>extract(epoch from (clock_timestamp() at time zone 'Asia/Kolkata')::time)::int/60)) then raise exception 'Monitoring has not reached its planned finish';end if;
 end if;
 new.published_at:=case when tg_op='UPDATE' and old.published_at is not null then old.published_at when new.status in('published','closed') then clock_timestamp() else null end;
 new.updated_at:=clock_timestamp();return new;
end $$;
create trigger shift_day_guard_v2 before insert or update on public.shift_days_v2 for each row execute function fets_duty_private.shift_day_guard_v2();
create function fets_duty_private.shift_day_history_v2() returns trigger language plpgsql security invoker set search_path='' as $$
begin if pg_trigger_depth()<1 then raise exception 'History is trigger-only';end if; insert into public.shift_versions_v2(day_id,version,snapshot,actor_id) values(new.id,new.version,to_jsonb(new),fets_duty_private.shift_actor_v2());return new;end $$;
create trigger shift_day_history_v2 after insert or update on public.shift_days_v2 for each row execute function fets_duty_private.shift_day_history_v2();
create function fets_duty_private.shift_history_guard_v2() returns trigger language plpgsql security invoker set search_path='' as $$
begin if tg_op<>'INSERT' or pg_trigger_depth()<2 then raise exception 'History is written only by the plan audit trigger';end if;return new;end $$;
create trigger shift_history_guard_v2 before insert or update or delete on public.shift_versions_v2 for each row execute function fets_duty_private.shift_history_guard_v2();
create function fets_duty_private.shift_work_guard_v2() returns trigger language plpgsql security invoker set search_path='' as $$
declare d public.shift_days_v2; b jsonb; task jsonb; owner uuid; latest public.shift_work_events_v2; now_at timestamptz:=clock_timestamp(); mins int; lead boolean;
begin
 if tg_op<>'INSERT' then raise exception 'Work records are immutable';end if;
 perform pg_advisory_xact_lock(hashtextextended(new.day_id::text,0));
 select * into d from public.shift_days_v2 where id=new.day_id;
 new.actor_id:=fets_duty_private.shift_actor_v2();new.created_at:=now_at;new.note:=btrim(new.note);
 if d.id is null or d.status<>'published' or new.actor_id is null or not fets_duty_private.can_read(d.branch) then raise exception 'Published open shift required' using errcode='42501';end if;
 if d.day<>(now_at at time zone 'Asia/Kolkata')::date then raise exception 'Record work on its actual day; historical completion cannot be fabricated';end if;
 mins:=extract(epoch from (now_at at time zone 'Asia/Kolkata')::time)::int/60;
 if new.block_id is null then
  select x into task from jsonb_array_elements(d.plan->'opening') x where x->>'id'=new.task_id;
  owner:=nullif(task->>'owner','')::uuid;
 else
  select x into b from jsonb_array_elements(d.plan->'blocks') x where x->>'id'=new.block_id::text;
  if b is null then raise exception 'Duty block not found';end if;
  owner:=(b->>'staff')::uuid;
  if new.kind not in('help','handover') then select x into task from jsonb_array_elements(b->'tasks') x where x->>'id'=new.task_id;end if;
  if mins<(b->>'start')::int then raise exception 'The assigned duty has not started';end if;
 end if;
 if new.kind not in('help','handover') and task is null then raise exception 'Checklist item not found';end if;
 lead:=fets_duty_private.can_plan(d.branch) or d.lead_id=new.actor_id;
 if new.kind in('verify','return') then
  if not lead or new.actor_id=owner then raise exception 'An independent lead or planner must review this task';end if;
  select * into latest from public.shift_work_events_v2 where day_id=d.id and block_id is not distinct from new.block_id and task_id=new.task_id and kind in('done','verify','return') order by created_at desc,id desc limit 1;
  if latest.kind is distinct from 'done' then raise exception 'Submit the task before independent review';end if;
  if new.kind='return' and length(new.note)=0 then raise exception 'Explain what needs to be corrected';end if;
 else
  if owner is distinct from new.actor_id or not fets_duty_private.shift_scheduled_v2(owner,d.id) then raise exception 'Only the assigned rostered staff member can record this work' using errcode='42501';end if;
  if new.kind='done' then
   select * into latest from public.shift_work_events_v2 where day_id=d.id and block_id is not distinct from new.block_id and task_id=new.task_id and kind in('done','verify','return') order by created_at desc,id desc limit 1;
   if latest.kind in('done','verify') then raise exception 'This task is already submitted';end if;
  end if;
 end if;
 return new;
end $$;
create trigger shift_work_guard_v2 before insert or update or delete on public.shift_work_events_v2 for each row execute function fets_duty_private.shift_work_guard_v2();
create function fets_duty_private.shift_check_guard_v2() returns trigger language plpgsql security invoker set search_path='' as $$
declare d public.shift_days_v2; slot record; at_due timestamptz; now_at timestamptz:=clock_timestamp(); who uuid:=fets_duty_private.shift_actor_v2();
begin
 if tg_op<>'INSERT' then raise exception 'Check records are immutable';end if;
 perform pg_advisory_xact_lock(hashtextextended(new.day_id::text,0));
 select * into d from public.shift_days_v2 where id=new.day_id;
 if d.id is null or d.status<>'published' or who is null or not fets_duty_private.can_read(d.branch) then raise exception 'Published open shift required' using errcode='42501';end if;
 select * into slot from fets_duty_private.shift_slots_v2(d.plan) s where s.window_no=new.window_no and s.kind=new.kind and s.due=new.due;
 if slot is null or slot.owner_id is distinct from who then raise exception 'Only the assigned owner or named break cover can record this check' using errcode='42501';end if;
 if not fets_duty_private.shift_scheduled_v2(who,d.id) then raise exception 'Your current roster no longer covers this shift; contact the lead';end if;
 at_due:=(d.day::timestamp at time zone 'Asia/Kolkata')+new.due*interval '1 minute';
 if at_due<d.published_at or now_at<at_due or now_at>=at_due+(case when new.kind='walk' then 10 else 6 end)*interval '1 minute' then raise exception 'Check is not currently due; missed checks cannot be backfilled';end if;
 new.actor_id:=who;new.created_at:=now_at;new.note:=btrim(new.note);
 if current_setting('role',true)='service_role' then
  if new.source<>'online' or new.online_user_id is null then raise exception 'Verified Online provenance required';end if;
 else new.source:='live';new.online_user_id:=null;end if;
 return new;
end $$;
create trigger shift_check_guard_v2 before insert or update or delete on public.shift_check_events_v2 for each row execute function fets_duty_private.shift_check_guard_v2();
create function public.fets_shift_check_snapshot_v2(p_branch text,p_day date) returns jsonb language plpgsql security invoker set search_path='' as $$
declare d public.shift_days_v2;who uuid:=fets_duty_private.shift_actor_v2();result jsonb;
begin
 if who is null or not fets_duty_private.can_read(p_branch) then raise exception 'Centre access required' using errcode='42501';end if;
 select * into d from public.shift_days_v2 where branch=p_branch and day=p_day and status in('published','closed');
 if d.id is null then return jsonb_build_object('connected',true,'server_now',clock_timestamp(),'plan',null,'checks','[]'::jsonb,'reason','Publish the actual day plan in The Shift before recording checks.');end if;
 select jsonb_build_object('connected',true,'server_now',clock_timestamp(),'viewer_id',who,'viewer_rostered',fets_duty_private.shift_scheduled_v2(who,d.id),
 'plan',jsonb_build_object('id',d.id,'day',d.day,'branch',d.branch,'version',d.version,'closed',d.status='closed','format',2,'tracking_from',d.published_at),
 'checks',coalesce(jsonb_agg(jsonb_build_object('block',s.window_no,'kind',s.kind,'due',s.due,'owner_id',s.owner_id,'owner_name',coalesce(person.v->>'name',profile.full_name),
 'event',case when e.id is null then null else jsonb_build_object('id',e.id,'actor_id',e.actor_id,'actor_name',coalesce(person.v->>'name',profile.full_name),'created_at',e.created_at,'note',e.note,'source',e.source) end) order by s.due,s.kind),'[]'::jsonb)) into result
 from fets_duty_private.shift_slots_v2(d.plan) s left join public.shift_check_events_v2 e on e.day_id=d.id and e.kind=s.kind and e.due=s.due
 left join public.staff_profiles profile on profile.id=s.owner_id left join lateral(select x v from jsonb_array_elements(d.plan->'people') x where x->>'id'=s.owner_id::text) person on true;
 return result;
end $$;
create function public.fets_shift_record_check_v2(p_plan uuid,p_block integer,p_kind text,p_due integer,p_note text default '') returns jsonb language plpgsql security invoker set search_path='' as $$
declare e public.shift_check_events_v2;who uuid:=fets_duty_private.shift_actor_v2();
begin
 if who is null then raise exception 'Active staff account required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_plan::text,0));
 select * into e from public.shift_check_events_v2 where day_id=p_plan and kind=p_kind and due=p_due;
 if e.id is not null then
  if e.actor_id is distinct from who or e.window_no is distinct from p_block or e.note is distinct from btrim(coalesce(p_note,'')) then raise exception 'This check is already recorded; refresh the log' using errcode='23505';end if;
 else
  insert into public.shift_check_events_v2(day_id,window_no,kind,due,note,source,online_user_id) values(p_plan,p_block,p_kind,p_due,btrim(coalesce(p_note,'')),case when current_setting('role',true)='service_role' then 'online' else 'live' end,nullif(current_setting('fets.online_user',true),'')::uuid) returning * into e;
 end if;return to_jsonb(e);
end $$;
-- Server-only compatibility wrappers retain old historical check records and
-- verified-email/centre identity. The browser never supplies its own actor.
create function public.fets_online_shift_snapshot_v2(p_online_user uuid,p_email text,p_branch text,p_day date) returns jsonb language plpgsql security invoker set search_path='' as $$
declare uid uuid;prior text:=current_setting('request.jwt.claim.sub',true);result jsonb;
begin
 uid:=fets_duty_private.online_actor(p_online_user,p_email,p_branch);perform set_config('request.jwt.claim.sub',uid::text,true);
 if exists(select 1 from public.shift_days_v2 where branch=p_branch and day=p_day and status in('published','closed')) then result:=public.fets_shift_check_snapshot_v2(p_branch,p_day);
 else result:=public.fets_online_check_snapshot(p_online_user,p_email,p_branch,p_day);end if;
 perform set_config('request.jwt.claim.sub',coalesce(prior,''),true);return result;
exception when others then perform set_config('request.jwt.claim.sub',coalesce(prior,''),true);raise;
end $$;
create function public.fets_online_shift_record_v2(p_online_user uuid,p_email text,p_branch text,p_plan uuid,p_block integer,p_kind text,p_due integer,p_note text default '') returns jsonb language plpgsql security invoker set search_path='' as $$
declare uid uuid;prior text:=current_setting('request.jwt.claim.sub',true);prior_online text:=current_setting('fets.online_user',true);result jsonb;
begin
 uid:=fets_duty_private.online_actor(p_online_user,p_email,p_branch);perform set_config('request.jwt.claim.sub',uid::text,true);perform set_config('fets.online_user',p_online_user::text,true);
 if exists(select 1 from public.shift_days_v2 where id=p_plan and branch=p_branch) then result:=public.fets_shift_record_check_v2(p_plan,p_block,p_kind,p_due,p_note);
 else result:=to_jsonb(public.fets_online_record_check(p_online_user,p_email,p_branch,p_plan,p_block,p_kind,p_due,p_note));end if;
 perform set_config('request.jwt.claim.sub',coalesce(prior,''),true);perform set_config('fets.online_user',coalesce(prior_online,''),true);return result;
exception when others then perform set_config('request.jwt.claim.sub',coalesce(prior,''),true);perform set_config('fets.online_user',coalesce(prior_online,''),true);raise;
end $$;
revoke all on function public.fets_online_shift_snapshot_v2(uuid,text,text,date),public.fets_online_shift_record_v2(uuid,text,text,uuid,integer,text,integer,text) from public,anon,authenticated;
grant execute on function public.fets_online_shift_snapshot_v2(uuid,text,text,date),public.fets_online_shift_record_v2(uuid,text,text,uuid,integer,text,integer,text) to service_role;
revoke all on function public.fets_shift_check_snapshot_v2(text,date),public.fets_shift_record_check_v2(uuid,integer,text,integer,text) from public,anon;
grant execute on function public.fets_shift_check_snapshot_v2(text,date),public.fets_shift_record_check_v2(uuid,integer,text,integer,text) to authenticated,service_role;
-- Private helpers are not exposed through PostgREST; revoke anonymous defaults.
revoke all on function fets_duty_private.shift_actor_v2(),fets_duty_private.shift_member_v2(uuid,text),fets_duty_private.shift_scheduled_v2(uuid,uuid),fets_duty_private.shift_owner_v2(jsonb,integer),fets_duty_private.shift_slots_v2(jsonb),fets_duty_private.shift_range_v2(integer,integer),fets_duty_private.shift_validate_v2(jsonb,text,date,boolean),fets_duty_private.shift_day_guard_v2(),fets_duty_private.shift_day_history_v2(),fets_duty_private.shift_history_guard_v2(),fets_duty_private.shift_work_guard_v2(),fets_duty_private.shift_check_guard_v2() from public,anon;
grant execute on function fets_duty_private.shift_actor_v2(),fets_duty_private.shift_member_v2(uuid,text),fets_duty_private.shift_scheduled_v2(uuid,uuid),fets_duty_private.shift_owner_v2(jsonb,integer),fets_duty_private.shift_slots_v2(jsonb),fets_duty_private.shift_range_v2(integer,integer),fets_duty_private.shift_validate_v2(jsonb,text,date,boolean),fets_duty_private.shift_day_guard_v2(),fets_duty_private.shift_day_history_v2(),fets_duty_private.shift_history_guard_v2(),fets_duty_private.shift_work_guard_v2(),fets_duty_private.shift_check_guard_v2() to authenticated,service_role;
notify pgrst,'reload schema';
commit;
