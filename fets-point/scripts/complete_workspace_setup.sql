-- FETS LIVE: My Desk + centre duties + audited coverage changes
-- RUN ONLY in project qqewusetilxxfvfkmsed, SQL Editor, as postgres.
-- This is separate from setup_chat_and_tools.sql. Existing chat, calendar,
-- roster and historical handovers are not replaced or deleted.
-- Rerunnable. All installation steps run in one transaction.
BEGIN;
DO $preflight$
DECLARE item record;
BEGIN
 FOR item IN SELECT * FROM (VALUES
 ('staff_profiles','id'),('staff_profiles','user_id'),('staff_profiles','role'),
 ('staff_profiles','is_active'),('staff_profiles','permissions'),('staff_profiles','branch_assigned'),
 ('roster_schedules','profile_id'),('roster_schedules','date'),
 ('roster_schedules','shift_code'),('roster_schedules','branch_location')) AS fields(table_name,column_name)
 LOOP
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=item.table_name AND c.column_name=item.column_name) THEN
   RAISE EXCEPTION 'Required existing column %.% is missing. Nothing has been installed; share this error for a schema-compatible update.',item.table_name,item.column_name;
  END IF;
 END LOOP;
END $preflight$;

DO $step_personal_desk$
BEGIN
 IF to_regclass('public.desk_journal_entries') is null THEN
  EXECUTE $install_personal_desk$
-- Personal staff data. Auth user IDs (not staff profile IDs) own every row.
create table public.desk_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cover text not null default 'peach' check (cover in ('peach', 'sage', 'lilac')),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);
create table public.desk_journal_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  note text not null default '' check (char_length(note) <= 2000),
  mood text not null default '' check (mood in ('', 'bright', 'steady', 'focused', 'slow')),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, entry_date)
);
create table public.desk_focus_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  duration_minutes integer not null check (duration_minutes in (25, 50)),
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index desk_focus_sessions_user_completed_idx
  on public.desk_focus_sessions (user_id, completed_at desc);

-- No staff member (including a manager) can read another person's journal.
alter table public.desk_preferences enable row level security;
alter table public.desk_journal_entries enable row level security;
alter table public.desk_focus_sessions enable row level security;
revoke all on public.desk_preferences, public.desk_journal_entries, public.desk_focus_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.desk_preferences, public.desk_journal_entries to authenticated;
grant select, insert, delete on public.desk_focus_sessions to authenticated;
grant all on public.desk_preferences, public.desk_journal_entries, public.desk_focus_sessions to service_role;

do $$
declare tab text;
begin
  foreach tab in array array['desk_preferences', 'desk_journal_entries', 'desk_focus_sessions'] loop
    execute format('create policy own_select on public.%I for select to authenticated using ((select auth.uid()) = user_id)', tab);
    execute format('create policy own_insert on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', tab);
    execute format('create policy own_delete on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', tab);
  end loop;
  foreach tab in array array['desk_preferences', 'desk_journal_entries'] loop
    execute format('create policy own_update on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', tab);
  end loop;
end $$;

-- Compare-and-swap prevents a stale tab/device from silently overwriting a note.
-- Invoker security preserves the table policies; the client cannot choose an owner.
create function public.desk_save_journal(p_date date, p_note text, p_mood text, p_version integer)
returns public.desk_journal_entries
language plpgsql security invoker set search_path = '' as $$
declare result public.desk_journal_entries;
begin
  if (select auth.uid()) is null then raise exception 'Sign in to save your desk' using errcode = '28000'; end if;
  if p_version is null then
    insert into public.desk_journal_entries (user_id, entry_date, note, mood)
    values ((select auth.uid()), p_date, p_note, p_mood)
    on conflict (user_id, entry_date) do nothing returning * into result;
  else
    update public.desk_journal_entries set note = p_note, mood = p_mood, version = version + 1, updated_at = now()
    where user_id = (select auth.uid()) and entry_date = p_date and version = p_version
    returning * into result;
  end if;
  if result.user_id is null then raise exception 'This entry changed on another device. Reload before saving.' using errcode = '40001'; end if;
  return result;
end $$;

create function public.desk_save_preferences(p_cover text, p_version integer)
returns public.desk_preferences
language plpgsql security invoker set search_path = '' as $$
declare result public.desk_preferences;
begin
  if (select auth.uid()) is null then raise exception 'Sign in to save your desk' using errcode = '28000'; end if;
  if p_version is null then
    insert into public.desk_preferences (user_id, cover) values ((select auth.uid()), p_cover)
    on conflict (user_id) do nothing returning * into result;
  else
    update public.desk_preferences set cover = p_cover, version = version + 1, updated_at = now()
    where user_id = (select auth.uid()) and version = p_version returning * into result;
  end if;
  if result.user_id is null then raise exception 'Your preferences changed on another device. Reload before saving.' using errcode = '40001'; end if;
  return result;
end $$;
revoke all on function public.desk_save_journal(date, text, text, integer) from public, anon;
revoke all on function public.desk_save_preferences(text, integer) from public, anon;
grant execute on function public.desk_save_journal(date, text, text, integer) to authenticated;
grant execute on function public.desk_save_preferences(text, integer) to authenticated;
comment on table public.desk_journal_entries is 'Private daily notes and self check-ins; visible only to their owner through the application.';
comment on table public.desk_focus_sessions is 'Personal completed focus sessions, not attendance or performance scores.';

$install_personal_desk$;
 ELSIF NOT (to_regprocedure('public.desk_save_journal(date,text,text,integer)') is not null and to_regclass('public.desk_preferences') is not null and to_regclass('public.desk_focus_sessions') is not null) THEN
  RAISE EXCEPTION 'An incomplete personal_desk installation already exists. No changes committed. Share this error before retrying.';
 END IF;
END $step_personal_desk$;

DO $step_centre_duties$
BEGIN
 IF to_regclass('public.centre_day_plans') is null THEN
  EXECUTE $install_centre_duties$
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

$install_centre_duties$;
 ELSIF NOT (to_regclass('public.centre_duty_reports') is not null and to_regclass('public.centre_duty_events') is not null and to_regclass('public.centre_lead_weeks') is not null and to_regprocedure('fets_duty_private.plan_guard()') is not null) THEN
  RAISE EXCEPTION 'An incomplete centre_duties installation already exists. No changes committed. Share this error before retrying.';
 END IF;
END $step_centre_duties$;

DO $step_coverage$
BEGIN
 IF to_regclass('public.centre_duty_changes') is null THEN
  EXECUTE $install_coverage$
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

$install_coverage$;
 ELSIF NOT (to_regprocedure('public.fets_workspace_capabilities()') is not null and to_regprocedure('fets_duty_private.change_guard()') is not null) THEN
  RAISE EXCEPTION 'An incomplete coverage installation already exists. No changes committed. Share this error before retrying.';
 END IF;
END $step_coverage$;

DO $verify$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.centre_duty_members WHERE branch='*' AND role='super_admin') THEN
  RAISE EXCEPTION 'No active super admin found in staff_profiles. No changes committed. Confirm your existing staff profile role before running setup.';
 END IF;
 IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('desk_preferences','desk_journal_entries','desk_focus_sessions','centre_duty_members','centre_lead_weeks','centre_day_plans','centre_duty_events','centre_duty_reports','centre_duty_changes') AND c.relrowsecurity)<>9 THEN
  RAISE EXCEPTION 'Workspace security verification failed. No changes committed.';
 END IF;
END $verify$;
NOTIFY pgrst, 'reload schema';
COMMIT;
SELECT 'READY — refresh fets.live and open My Desk or Handover' AS status,
 (SELECT count(*) FROM public.centre_duty_members WHERE role='super_admin') AS super_admin_access_records,
 (SELECT count(*) FROM public.centre_duty_members WHERE role='staff') AS staff_centre_access_records,
 2 AS workspace_schema_version;
