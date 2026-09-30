-- Append-only changes preserve the published agreement and historical ownership.
create table public.centre_duty_changes (
 id uuid primary key default gen_random_uuid(),
 plan_id uuid not null references public.centre_day_plans(id),
 kind text not null check(kind in ('coverage','lead')),
 block integer check(block between 0 and 5),
 lane text check(lane in ('front','floor','control')),
 staff_id uuid not null references public.staff_profiles(id),
 starts integer not null check(starts between 480 and 1019),
 ends integer not null check(ends between 481 and 1020 and ends>starts),
 shift_start integer not null check(shift_start between 0 and 1439),
 shift_end integer not null check(shift_end between 1 and 1440 and shift_end>shift_start),
 reason text not null check(length(trim(reason)) between 5 and 2000),
 actor_id uuid not null references public.staff_profiles(id),
 created_at timestamptz not null default clock_timestamp(),
 check((kind='coverage' and block is not null and lane is not null) or (kind='lead' and block is null and lane is null))
);
create index centre_duty_changes_plan_idx on public.centre_duty_changes(plan_id,created_at);
create index centre_duty_changes_staff_idx on public.centre_duty_changes(staff_id);
create index centre_duty_changes_actor_idx on public.centre_duty_changes(actor_id);
alter table public.centre_duty_changes enable row level security;
create policy changes_read on public.centre_duty_changes for select to authenticated using(exists(select 1 from public.centre_day_plans p where p.id=plan_id and fets_duty_private.can_read(p.branch)));
create policy changes_insert on public.centre_duty_changes for insert to authenticated with check(actor_id=fets_duty_private.me() and exists(select 1 from public.centre_day_plans p where p.id=plan_id and fets_duty_private.can_read(p.branch)));
revoke all on public.centre_duty_changes from public,anon,authenticated;
grant select,insert on public.centre_duty_changes to authenticated;
grant all on public.centre_duty_changes to service_role;

create function fets_duty_private.resolved_owner(pid uuid,block_num integer,lane_name text,t integer) returns uuid language sql stable security invoker set search_path='' as $$
 select coalesce((select c.staff_id from public.centre_duty_changes c where c.plan_id=pid and c.kind='coverage' and c.block=block_num and c.lane=lane_name and c.starts<=t and c.ends>t order by c.created_at desc,c.id desc limit 1),fets_duty_private.owner_at(p.plan,block_num,lane_name,t)) from public.centre_day_plans p where p.id=pid
$$;
create function fets_duty_private.resolved_lead(pid uuid) returns uuid language sql stable security invoker set search_path='' as $$
 select coalesce((select c.staff_id from public.centre_duty_changes c where c.plan_id=pid and c.kind='lead'
 and (p.day<(clock_timestamp() at time zone 'Asia/Kolkata')::date or (p.day=(clock_timestamp() at time zone 'Asia/Kolkata')::date and c.starts<=extract(hour from clock_timestamp() at time zone 'Asia/Kolkata')::int*60+extract(minute from clock_timestamp() at time zone 'Asia/Kolkata')::int)) order by c.created_at desc,c.id desc limit 1),p.lead_id) from public.centre_day_plans p where p.id=pid
$$;
create function fets_duty_private.owned_block(pid uuid,block_num integer,lane_name text,staff uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from generate_series(480+block_num*90,569+block_num*90) t where fets_duty_private.resolved_owner(pid,block_num,lane_name,t)=staff)
$$;
create function fets_duty_private.change_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.centre_day_plans;b jsonb;t integer;local_now timestamp:=clock_timestamp() at time zone 'Asia/Kolkata';
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.plan_id::text,0));
 select * into p from public.centre_day_plans where id=new.plan_id;
 if p.id is null or p.status<>'published' then raise exception 'A published plan is required'; end if;
 if exists(select 1 from public.centre_duty_reports where plan_id=p.id) then raise exception 'The final report has closed this shift'; end if;
 new.actor_id:=fets_duty_private.me();new.created_at:=clock_timestamp();
 if not(fets_duty_private.is_admin() or fets_duty_private.resolved_lead(p.id)=new.actor_id) then raise exception 'Only the current lead or super admin may change coverage'; end if;
 t:=extract(hour from local_now)::int*60+extract(minute from local_now)::int;
 if p.day<local_now::date or (p.day=local_now::date and new.starts<=t) then raise exception 'Changes take effect from a future minute; past ownership cannot be rewritten'; end if;
 if not fets_duty_private.rostered(new.staff_id,p.branch,p.day) or new.shift_start>new.starts or new.shift_end<new.ends then raise exception 'Replacement must be rostered and confirmed for the full coverage period'; end if;
 if new.kind='coverage' then
  b:=p.plan->'blocks'->new.block;
  if new.starts<(b->>'start')::int or new.ends>(b->>'end')::int then raise exception 'Coverage must fit the selected rotation block'; end if;
  if exists(select 1 from jsonb_array_elements(p.plan->'breaks') pause where pause->>'staff'=new.staff_id::text and (pause->>'start')::int<new.ends and (pause->>'end')::int>new.starts) then raise exception 'Replacement has a planned break during this period'; end if;
 else
  if new.ends<>1020 then raise exception 'An acting lead remains assigned until the end of the day'; end if;
 end if;
 return new;
end $$;
create trigger centre_change_guard before insert on public.centre_duty_changes for each row execute function fets_duty_private.change_guard();

create or replace function fets_duty_private.event_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.centre_day_plans; b jsonb; owner uuid; primary_owner uuid; local_now timestamp:=clock_timestamp() at time zone 'Asia/Kolkata'; t integer; step integer; latest text;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.plan_id::text,0));
 select * into p from public.centre_day_plans where id=new.plan_id;
 if p.id is null or p.status<>'published' then raise exception 'A published plan is required'; end if;
 if exists(select 1 from public.centre_duty_reports where plan_id=p.id) then raise exception 'Report already submitted; this shift is closed'; end if;
 new.actor_id:=fets_duty_private.me();new.created_at:=clock_timestamp();
 b:=p.plan->'blocks'->new.block;t:=extract(hour from local_now)::integer*60+extract(minute from local_now)::integer;
 primary_owner:=(b->'owners'->>new.lane)::uuid;
 if new.kind in ('walk','dvr','submit','support') and not fets_duty_private.rostered(new.actor_id,p.branch,p.day) then raise exception 'Your current roster no longer covers this shift; contact the lead'; end if;
 if new.kind in ('walk','dvr') then
  step:=case when new.kind='walk' then 10 else 6 end;
  if (new.kind='walk' and new.lane<>'floor') or (new.kind='dvr' and new.lane<>'control') or p.day<>local_now::date or new.due<=(b->>'start')::integer or new.due>(b->>'end')::integer or mod(new.due-(b->>'start')::integer,step)<>0 or t<new.due or t>=new.due+step then raise exception 'Check is not currently due; missed checks cannot be backfilled'; end if;
  owner:=fets_duty_private.resolved_owner(p.id,new.block,new.lane,new.due-1);
  if new.actor_id is distinct from owner then raise exception 'Only the assigned owner or named break cover can record this check'; end if;
 elsif new.kind in ('verify','return') then
  if not(fets_duty_private.is_admin() or fets_duty_private.resolved_lead(p.id)=new.actor_id) or fets_duty_private.owned_block(p.id,new.block,new.lane,new.actor_id) then raise exception 'An independent lead or super admin must review'; end if;
  select kind into latest from public.centre_duty_events where plan_id=p.id and block=new.block and lane=new.lane and kind in ('submit','verify','return') order by created_at desc,id desc limit 1;
  if latest is distinct from 'submit' then raise exception 'Owner must submit before review'; end if;
  if new.kind='return' and length(trim(new.note))=0 then raise exception 'Explain what needs follow-up'; end if;
 elsif new.kind='submit' then
  if not fets_duty_private.owned_block(p.id,new.block,new.lane,new.actor_id) or p.day<>local_now::date or t<(b->>'end')::integer or length(trim(new.note))=0 then raise exception 'Owner must submit a note after the block ends, on the shift date'; end if;
  select kind into latest from public.centre_duty_events where plan_id=p.id and block=new.block and lane=new.lane and kind in ('submit','verify','return') order by created_at desc,id desc limit 1;
  if latest='verify' then raise exception 'Block already reviewed'; end if;
 else
  if p.day<>local_now::date or (new.actor_id is distinct from primary_owner and new.actor_id is distinct from fets_duty_private.resolved_owner(p.id,new.block,new.lane,t)) or length(trim(new.note))=0 then raise exception 'A named owner must describe the support needed'; end if;
 end if;
 return new;
end $$;

create or replace function fets_duty_private.report_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.centre_day_plans; entries jsonb; changes jsonb;
begin
 if tg_op='UPDATE' then
  if not fets_duty_private.is_admin() then raise exception 'Only super admin can acknowledge'; end if;
  new.acknowledged_at:=now();new.acknowledged_by:=fets_duty_private.me();return new;
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.plan_id::text,0));
 select * into p from public.centre_day_plans where id=new.plan_id;
 if p.id is null or p.status<>'published' or not(fets_duty_private.is_admin() or fets_duty_private.resolved_lead(p.id)=fets_duty_private.me()) then raise exception 'Only the lead or super admin can submit a published shift report'; end if;
 if (clock_timestamp() at time zone 'Asia/Kolkata')::date<p.day or ((clock_timestamp() at time zone 'Asia/Kolkata')::date=p.day and (clock_timestamp() at time zone 'Asia/Kolkata')::time<time '17:00') then raise exception 'Final report is available after 17:00 India time'; end if;
 select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at,e.id),'[]'::jsonb) into entries from public.centre_duty_events e where e.plan_id=p.id;
 new.branch:=p.branch;new.day:=p.day;new.submitted_by:=fets_duty_private.me();new.created_at:=now();new.acknowledged_at:=null;new.acknowledged_by:=null;
 select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at,c.id),'[]'::jsonb) into changes from public.centre_duty_changes c where c.plan_id=p.id;
 new.snapshot:=jsonb_build_object('plan',p.plan,'lead_id',fets_duty_private.resolved_lead(p.id),'events',entries,'changes',changes);return new;
end $$;

-- A narrow capability probe enables clients only after the complete schema exists.
create function public.fets_workspace_capabilities() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('version',2,'desk',auth.uid() is not null,'duties',exists(select 1 from public.centre_duty_members where user_id=(select auth.uid())))
$$;
revoke all on function public.fets_workspace_capabilities() from public,anon;
grant execute on function public.fets_workspace_capabilities() to authenticated;
revoke all on all functions in schema fets_duty_private from public,anon;
grant execute on all functions in schema fets_duty_private to authenticated,service_role;
notify pgrst, 'reload schema';
