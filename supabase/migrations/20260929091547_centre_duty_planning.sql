-- Centre duty planning is additive: existing handovers and roster remain untouched.
-- Memberships are trusted authorization records, seeded once from existing staff.
-- Provision new centres/colleagues through a trusted server or migration, never user metadata.
create schema if not exists fets_duty_private;
revoke all on schema fets_duty_private from public, anon;
grant usage on schema fets_duty_private to authenticated, service_role;

create table public.centre_duty_members (
  user_id uuid not null references auth.users(id) on delete cascade,
  branch text not null check (branch = lower(branch) and length(branch) between 1 and 80),
  profile_id uuid not null references public.staff_profiles(id) on delete cascade,
  role text not null check (role in ('staff','planner','super_admin')),
  primary key (user_id,branch), unique (profile_id,branch)
);
alter table public.centre_duty_members enable row level security;
-- Clients can inspect only their own trusted access records.
create policy duty_directory on public.centre_duty_members for select to authenticated using (user_id=(select auth.uid()));
revoke all on public.centre_duty_members from public,anon,authenticated;
grant select on public.centre_duty_members to authenticated;
grant all on public.centre_duty_members to service_role;
insert into public.centre_duty_members(user_id,branch,profile_id,role)
select distinct on (user_id,lower(branch_assigned)) user_id,lower(branch_assigned),id,'staff'
from public.staff_profiles where user_id is not null and coalesce(is_active,true)
and branch_assigned is not null and lower(branch_assigned) not in ('global','all','both','')
order by user_id,lower(branch_assigned),id;
insert into public.centre_duty_members(user_id,branch,profile_id,role)
select distinct on (user_id) user_id,'*',id,'super_admin' from public.staff_profiles
where user_id is not null and coalesce(is_active,true) and lower(replace(role,' ','_'))='super_admin'
order by user_id,id on conflict (user_id,branch) do nothing;

create function fets_duty_private.is_admin() returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.centre_duty_members where user_id=(select auth.uid()) and role='super_admin' and branch='*')
$$;
create function fets_duty_private.can_read(b text) returns boolean language sql stable security invoker set search_path='' as $$
 select fets_duty_private.is_admin() or exists(select 1 from public.centre_duty_members where user_id=(select auth.uid()) and branch=b)
$$;
create function fets_duty_private.can_plan(b text) returns boolean language sql stable security invoker set search_path='' as $$
 select fets_duty_private.is_admin() or exists(select 1 from public.centre_duty_members where user_id=(select auth.uid()) and branch=b and role='planner')
$$;
create function fets_duty_private.me() returns uuid language sql stable security invoker set search_path='' as $$
 select profile_id from public.centre_duty_members where user_id=(select auth.uid()) order by branch limit 1
$$;

create table public.centre_lead_weeks (
 branch text not null check (branch=lower(branch) and branch not in ('global','*','all')),
 week_start date not null check(extract(isodow from week_start)=1),
 lead_id uuid not null references public.staff_profiles(id),
 version integer not null default 1 check(version>0),
 updated_at timestamptz not null default now(),
 primary key(branch,week_start)
);
create index centre_lead_weeks_lead_idx on public.centre_lead_weeks(lead_id,week_start);
alter table public.centre_lead_weeks enable row level security;
create policy lead_read on public.centre_lead_weeks for select to authenticated using(fets_duty_private.can_read(branch));
create policy lead_insert on public.centre_lead_weeks for insert to authenticated with check(fets_duty_private.can_plan(branch));
create policy lead_update on public.centre_lead_weeks for update to authenticated using(fets_duty_private.can_plan(branch)) with check(fets_duty_private.can_plan(branch));

create function fets_duty_private.week_lead(b text,d date) returns uuid language sql stable security invoker set search_path='' as $$
 select lead_id from public.centre_lead_weeks where branch=b and week_start=d-(extract(isodow from d)::integer-1)
$$;
create function fets_duty_private.rostered(p uuid,b text,d date) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.roster_schedules r join public.staff_profiles s on s.id=r.profile_id
 where r.profile_id=p and r.date=d and lower(coalesce(nullif(r.branch_location,''),s.branch_assigned))=b
 and coalesce(s.is_active,true) and coalesce(r.shift_code,'')<>''
 and upper(r.shift_code) not in ('RD','OFF','WO','L','LEAVE','LV','H','HOLIDAY','TO','TOIL','TR','TP','T','PH','TRD')
 and not(coalesce((s.permissions->>'is_roster_active')::boolean,true)=false and (s.permissions->>'roster_excluded_month' is null or s.permissions->>'roster_excluded_month'=to_char(d,'YYYY-MM'))))
$$;
create function fets_duty_private.lead_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.branch,new.week_start) is distinct from (old.branch,old.week_start) then raise exception 'Lead identity is immutable'; end if;
 if not exists(select 1 from generate_series(0,6) i where fets_duty_private.rostered(new.lead_id,new.branch,new.week_start+i)) then raise exception 'Lead must be rostered at this centre during the week'; end if;
 if tg_op='UPDATE' then new.version:=old.version+1; else new.version:=1; end if;
 new.updated_at:=now();return new;
end $$;
create trigger centre_lead_guard before insert or update on public.centre_lead_weeks for each row execute function fets_duty_private.lead_guard();

create table public.centre_day_plans (
 id uuid primary key default gen_random_uuid(),
 branch text not null check(branch=lower(branch) and branch not in ('global','*','all')),
 day date not null,
 lead_id uuid references public.staff_profiles(id),
 plan jsonb not null check(jsonb_typeof(plan)='object' and octet_length(plan::text)<=30000),
 status text not null default 'draft' check(status in ('draft','published')),
 version integer not null default 1 check(version>0),
 created_by uuid not null default auth.uid() references auth.users(id),
 updated_at timestamptz not null default now(),
 unique(branch,day)
);
create index centre_day_plans_creator_idx on public.centre_day_plans(created_by);
create index centre_day_plans_lead_idx on public.centre_day_plans(lead_id,day);
alter table public.centre_day_plans enable row level security;
create policy plan_read on public.centre_day_plans for select to authenticated using(fets_duty_private.can_read(branch));
create policy plan_insert on public.centre_day_plans for insert to authenticated with check(fets_duty_private.can_plan(branch) or fets_duty_private.week_lead(branch,day)=fets_duty_private.me());
create policy plan_update on public.centre_day_plans for update to authenticated using(fets_duty_private.can_plan(branch) or fets_duty_private.week_lead(branch,day)=fets_duty_private.me()) with check(fets_duty_private.can_plan(branch) or fets_duty_private.week_lead(branch,day)=fets_duty_private.me());

create function fets_duty_private.available(p jsonb,staff text,starts integer,ends integer) returns boolean language sql immutable security invoker set search_path='' as $$
 select exists(select 1 from jsonb_array_elements(p->'availability') a where a->>'staff'=staff and (a->>'confirmed')::boolean and (a->>'start')::integer<=starts and (a->>'end')::integer>=ends)
$$;
create function fets_duty_private.owner_at(p jsonb,block_num integer,lane_name text,t integer) returns uuid language sql immutable security invoker set search_path='' as $$
 select coalesce((select nullif(b->>'cover','') from jsonb_array_elements(p->'breaks') b where b->>'staff'=p->'blocks'->block_num->'owners'->>lane_name and (b->>'start')::integer<=t and (b->>'end')::integer>t limit 1),p->'blocks'->block_num->'owners'->>lane_name)::uuid
$$;
create function fets_duty_private.plan_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare a jsonb; b jsonb; c jsonb; l text; n integer:=0; staff text; starts integer; ends integer; effective uuid;
begin
 if tg_op='UPDATE' then
  if old.status='published' then raise exception 'Published plans are immutable; contact the administrator for an audited correction'; end if;
  if (new.id,new.branch,new.day,new.created_by) is distinct from (old.id,old.branch,old.day,old.created_by) then raise exception 'Plan identity is immutable'; end if;
  new.version:=old.version+1;
 else new.created_by:=auth.uid();new.version:=1; end if;
 new.updated_at:=now();
 if jsonb_typeof(new.plan->'blocks') is distinct from 'array' or jsonb_array_length(new.plan->'blocks')<>6 or jsonb_typeof(new.plan->'breaks') is distinct from 'array' or jsonb_typeof(new.plan->'availability') is distinct from 'array' then raise exception 'Invalid duty plan structure'; end if;
 if new.status<>'published' then return new; end if;
 effective:=coalesce(nullif(new.plan->>'actingLead','')::uuid,fets_duty_private.week_lead(new.branch,new.day));
 if effective is null or new.lead_id is distinct from effective or not fets_duty_private.rostered(effective,new.branch,new.day) then raise exception 'Choose a rostered weekly or acting lead'; end if;
 if jsonb_array_length(new.plan->'availability')<>(select count(distinct x->>'staff') from jsonb_array_elements(new.plan->'availability') x) then raise exception 'Duplicate availability'; end if;
 for a in select * from jsonb_array_elements(new.plan->'availability') loop
  if not fets_duty_private.rostered((a->>'staff')::uuid,new.branch,new.day) or coalesce((a->>'confirmed')::boolean,false)=false or (a->>'start')::integer<0 or (a->>'end')::integer>1440 or (a->>'start')::integer >= (a->>'end')::integer then raise exception 'Confirm rostered staff and actual shift hours'; end if;
 end loop;
 for b in select * from jsonb_array_elements(new.plan->'blocks') loop
  starts:=(b->>'start')::integer;ends:=(b->>'end')::integer;
  if starts is distinct from 480+n*90 or ends is distinct from 570+n*90 then raise exception 'Six continuous 90-minute blocks are required'; end if;
  if (select count(distinct x.value) from jsonb_each_text(b->'owners') x where x.key in ('front','floor','control'))<>3 then raise exception 'Three different owners required per block'; end if;
  foreach l in array array['front','floor','control'] loop
   staff:=b->'owners'->>l;
   if staff is null or not fets_duty_private.available(new.plan,staff,starts,ends) or not fets_duty_private.rostered(staff::uuid,new.branch,new.day) then raise exception 'Missing owner or gap in confirmed shift coverage'; end if;
   if (select count(*) from jsonb_array_elements(new.plan->'breaks') x where x->>'staff'=staff)<>2 then raise exception 'Each primary owner needs two planned breaks'; end if;
  end loop;n:=n+1;
 end loop;
 for b in select * from jsonb_array_elements(new.plan->'breaks') loop
  starts:=(b->>'start')::integer;ends:=(b->>'end')::integer;
  if ends-starts is distinct from 30 or starts<480 or ends>1020 or nullif(b->>'cover','') is null or b->>'cover'=b->>'staff' or length(trim(coalesce(b->>'note','')))=0 or not fets_duty_private.available(new.plan,b->>'staff',starts,ends) or not fets_duty_private.available(new.plan,b->>'cover',starts,ends) then raise exception 'Break needs available named cover and an arrangement'; end if;
  for c in select * from jsonb_array_elements(new.plan->'breaks') loop
   if b<>c and (c->>'start')::integer<ends and (c->>'end')::integer>starts and ((c->>'staff') in (b->>'staff',b->>'cover') or c->>'cover'=b->>'cover') then raise exception 'Overlapping break or cover conflict'; end if;
  end loop;
 end loop;
 return new;
end $$;
create trigger centre_plan_guard before insert or update on public.centre_day_plans for each row execute function fets_duty_private.plan_guard();

create table public.centre_duty_events (
 id uuid primary key default gen_random_uuid(),
 plan_id uuid not null references public.centre_day_plans(id),
 block integer not null check(block between 0 and 5),
 lane text not null check(lane in ('front','floor','control')),
 kind text not null check(kind in ('walk','dvr','submit','verify','return','support')),
 due integer not null default 0 check(due between 0 and 1440),
 actor_id uuid not null references public.staff_profiles(id),
 note text not null default '' check(length(note)<=2000),
 created_at timestamptz not null default clock_timestamp()
);
create index centre_duty_events_plan_idx on public.centre_duty_events(plan_id,created_at);
create index centre_duty_events_actor_idx on public.centre_duty_events(actor_id);
create unique index centre_check_once on public.centre_duty_events(plan_id,block,lane,kind,due) where kind in ('walk','dvr');
alter table public.centre_duty_events enable row level security;
create policy event_read on public.centre_duty_events for select to authenticated using(exists(select 1 from public.centre_day_plans p where p.id=plan_id and fets_duty_private.can_read(p.branch)));
create policy event_insert on public.centre_duty_events for insert to authenticated with check(actor_id=fets_duty_private.me() and exists(select 1 from public.centre_day_plans p where p.id=plan_id and fets_duty_private.can_read(p.branch)));

create table public.centre_duty_reports (
 id uuid primary key default gen_random_uuid(),
 plan_id uuid not null unique references public.centre_day_plans(id),
 branch text not null,day date not null,
 summary text not null check(length(trim(summary)) between 1 and 4000),
 followups text not null check(length(trim(followups)) between 1 and 4000),
 recognition text not null default '' check(length(recognition)<=2000),
 snapshot jsonb not null,
 submitted_by uuid not null references public.staff_profiles(id),
 created_at timestamptz not null default now(),
 acknowledged_at timestamptz,acknowledged_by uuid references public.staff_profiles(id),
 unique(branch,day)
);
create index centre_duty_reports_month_idx on public.centre_duty_reports(branch,day desc);
create index centre_duty_reports_submitter_idx on public.centre_duty_reports(submitted_by);
create index centre_duty_reports_ack_idx on public.centre_duty_reports(acknowledged_by);
alter table public.centre_duty_reports enable row level security;
create policy report_read on public.centre_duty_reports for select to authenticated using(fets_duty_private.can_read(branch));
create policy report_insert on public.centre_duty_reports for insert to authenticated with check(fets_duty_private.can_read(branch) and submitted_by=fets_duty_private.me());
create policy report_ack on public.centre_duty_reports for update to authenticated using(fets_duty_private.is_admin()) with check(fets_duty_private.is_admin());

create function fets_duty_private.event_guard() returns trigger language plpgsql security invoker set search_path='' as $$
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
  owner:=fets_duty_private.owner_at(p.plan,new.block,new.lane,new.due-1);
  if new.actor_id is distinct from owner then raise exception 'Only the assigned owner or named break cover can record this check'; end if;
 elsif new.kind in ('verify','return') then
  if not(fets_duty_private.is_admin() or p.lead_id=new.actor_id) or new.actor_id=primary_owner then raise exception 'An independent lead or super admin must review'; end if;
  select kind into latest from public.centre_duty_events where plan_id=p.id and block=new.block and lane=new.lane and kind in ('submit','verify','return') order by created_at desc,id desc limit 1;
  if latest is distinct from 'submit' then raise exception 'Owner must submit before review'; end if;
  if new.kind='return' and length(trim(new.note))=0 then raise exception 'Explain what needs follow-up'; end if;
 elsif new.kind='submit' then
  if new.actor_id is distinct from primary_owner or p.day<>local_now::date or t<(b->>'end')::integer or length(trim(new.note))=0 then raise exception 'Owner must submit a note after the block ends, on the shift date'; end if;
  select kind into latest from public.centre_duty_events where plan_id=p.id and block=new.block and lane=new.lane and kind in ('submit','verify','return') order by created_at desc,id desc limit 1;
  if latest='verify' then raise exception 'Block already reviewed'; end if;
 else
  if p.day<>local_now::date or (new.actor_id is distinct from primary_owner and new.actor_id is distinct from fets_duty_private.owner_at(p.plan,new.block,new.lane,t)) or length(trim(new.note))=0 then raise exception 'A named owner must describe the support needed'; end if;
 end if;
 return new;
end $$;
create trigger centre_event_guard before insert on public.centre_duty_events for each row execute function fets_duty_private.event_guard();

create function fets_duty_private.report_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.centre_day_plans; entries jsonb;
begin
 if tg_op='UPDATE' then
  if not fets_duty_private.is_admin() then raise exception 'Only super admin can acknowledge'; end if;
  new.acknowledged_at:=now();new.acknowledged_by:=fets_duty_private.me();return new;
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.plan_id::text,0));
 select * into p from public.centre_day_plans where id=new.plan_id;
 if p.id is null or p.status<>'published' or not(fets_duty_private.is_admin() or p.lead_id=fets_duty_private.me()) then raise exception 'Only the lead or super admin can submit a published shift report'; end if;
 if (clock_timestamp() at time zone 'Asia/Kolkata')::date<p.day or ((clock_timestamp() at time zone 'Asia/Kolkata')::date=p.day and (clock_timestamp() at time zone 'Asia/Kolkata')::time<time '17:00') then raise exception 'Final report is available after 17:00 India time'; end if;
 select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at,e.id),'[]'::jsonb) into entries from public.centre_duty_events e where e.plan_id=p.id;
 new.branch:=p.branch;new.day:=p.day;new.submitted_by:=fets_duty_private.me();new.created_at:=now();new.acknowledged_at:=null;new.acknowledged_by:=null;
 new.snapshot:=jsonb_build_object('plan',p.plan,'lead_id',p.lead_id,'events',entries);return new;
end $$;
create trigger centre_report_guard before insert or update on public.centre_duty_reports for each row execute function fets_duty_private.report_guard();

revoke all on public.centre_lead_weeks,public.centre_day_plans,public.centre_duty_events,public.centre_duty_reports from public,anon,authenticated;
grant select,insert,update on public.centre_lead_weeks,public.centre_day_plans to authenticated;
grant select,insert on public.centre_duty_events,public.centre_duty_reports to authenticated;
grant update(acknowledged_at) on public.centre_duty_reports to authenticated;
grant all on public.centre_lead_weeks,public.centre_day_plans,public.centre_duty_events,public.centre_duty_reports to service_role;
revoke all on all functions in schema fets_duty_private from public,anon;
grant execute on all functions in schema fets_duty_private to authenticated,service_role;
