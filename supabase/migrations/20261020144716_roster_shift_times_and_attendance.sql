-- FETS Live only. Additive: existing schedules, attendance and payroll codes remain.
begin;
alter table public.roster_schedules alter column overtime_hours type numeric using overtime_hours::numeric;
alter table public.roster_schedules
 add column shift_label text,
 add column shift_start time,
 add column shift_end time,
 add column grace_minutes integer not null default 0,
 add column version bigint not null default 1,
 add constraint roster_shift_times_valid check (
   ((shift_start is null and shift_end is null) or (shift_start is not null and shift_end is not null and shift_end>shift_start))
   and grace_minutes between 0 and 60 and char_length(coalesce(shift_label,''))<=50
 );
create table public.roster_shift_types (
 id uuid primary key default gen_random_uuid(), branch_location text not null check(branch_location in ('calicut','cochin')),
 shift_label text not null check(char_length(btrim(shift_label)) between 1 and 50),
 shift_code text not null check(shift_code in ('D','HD')),
 shift_start time not null, shift_end time not null check(shift_end>shift_start),
 grace_minutes integer not null default 0 check(grace_minutes between 0 and 60),
 archived boolean not null default false, created_at timestamptz not null default now()
);
alter table public.roster_shift_types enable row level security;
revoke all on public.roster_shift_types from anon,authenticated;
grant select,insert,update on public.roster_shift_types to authenticated;
grant all on public.roster_shift_types to service_role;
create policy "Staff read shift types" on public.roster_shift_types for select to authenticated using(true);
create policy "Roster administrator creates shift types" on public.roster_shift_types for insert to authenticated with check(exists(select 1 from public.staff_profiles s where s.user_id=auth.uid() and s.role='super_admin' and lower(s.email)='mithun@fets.in'));
create policy "Roster administrator updates shift types" on public.roster_shift_types for update to authenticated using(exists(select 1 from public.staff_profiles s where s.user_id=auth.uid() and s.role='super_admin' and lower(s.email)='mithun@fets.in')) with check(exists(select 1 from public.staff_profiles s where s.user_id=auth.uid() and s.role='super_admin' and lower(s.email)='mithun@fets.in'));

create function public.roster_timing_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='UPDATE' then
  new.version:=old.version+1;
  -- Older clients changing a code cannot leave the former shift's hours behind.
  if new.shift_code is distinct from old.shift_code and new.shift_start is not distinct from old.shift_start and new.shift_end is not distinct from old.shift_end and new.shift_label is not distinct from old.shift_label then
   new.shift_start:=null;new.shift_end:=null;new.shift_label:=null;new.grace_minutes:=0;
  end if;
 else new.version:=1; end if;
 if upper(new.shift_code) not in ('D','E','HD','OT') then new.shift_start:=null;new.shift_end:=null;new.shift_label:=null;new.grace_minutes:=0;end if;
 new.updated_at:=clock_timestamp();
 return new;
end $$;
revoke all on function public.roster_timing_guard() from public,anon,authenticated;
create trigger roster_timing_guard before insert or update on public.roster_schedules for each row execute function public.roster_timing_guard();

-- Atomic compare-and-save: a stale preview cannot overwrite another editor's work.
create function public.roster_save_batch(p_changes jsonb) returns integer language plpgsql security invoker set search_path='' as $$
declare c jsonb; v jsonb; r public.roster_schedules; pid uuid; d date; affected integer:=0;
begin
 if auth.uid() is null or not exists(select 1 from public.staff_profiles s where s.user_id=auth.uid() and s.role='super_admin' and lower(s.email)='mithun@fets.in') then raise exception 'Only the roster administrator can edit schedules' using errcode='42501';end if;
 if jsonb_typeof(p_changes) is distinct from 'array' or jsonb_array_length(p_changes) not between 1 and 366 then raise exception 'Choose 1–366 roster entries';end if;
 if (select count(*) from jsonb_array_elements(p_changes))<>(select count(distinct (x->>'profile_id',x->>'date')) from jsonb_array_elements(p_changes)x) then raise exception 'Duplicate roster dates';end if;
 for c in select value from jsonb_array_elements(p_changes) order by value->>'profile_id',value->>'date' loop
  pid:=(c->>'profile_id')::uuid;d:=(c->>'date')::date;v:=c->'value';
  if pid is null or d is null or c->>'branch_location' is null or c->>'branch_location' not in ('calicut','cochin') then raise exception 'Choose a staff member, date and centre';end if;
  perform pg_advisory_xact_lock(hashtextextended(pid::text||d::text,0));
  select * into r from public.roster_schedules where profile_id=pid and date=d for update;
  if (r.id is not null and (c->>'expected_version')::bigint is distinct from r.version) or (r.id is null and c->>'expected_version' is not null) then raise exception 'The roster changed elsewhere. Refresh and review the dates again.' using errcode='40001';end if;
  if v='null'::jsonb then
   delete from public.roster_schedules where profile_id=pid and date=d;
  else
   if v is null or v->>'shift_code' is null or v->>'shift_code' not in ('D','HD','RD','L','TOIL','TR','TP','TRD','PH') then raise exception 'Choose a roster type';end if;
   if v->>'shift_code' in ('D','E','HD') and (v->>'shift_start' is null or v->>'shift_end' is null) then raise exception 'Set the working shift start and end times';end if;
   if coalesce((v->>'overtime_hours')::numeric,0) not between 0 and 24 then raise exception 'Overtime must be 0–24 hours';end if;
   insert into public.roster_schedules(profile_id,date,branch_location,shift_code,overtime_hours,shift_label,shift_start,shift_end,grace_minutes)
   values(pid,d,c->>'branch_location',v->>'shift_code',coalesce((v->>'overtime_hours')::numeric,0),nullif(btrim(v->>'shift_label'),''),(v->>'shift_start')::time,(v->>'shift_end')::time,coalesce((v->>'grace_minutes')::integer,0))
   on conflict(profile_id,date) do update set branch_location=excluded.branch_location,shift_code=excluded.shift_code,overtime_hours=excluded.overtime_hours,shift_label=excluded.shift_label,shift_start=excluded.shift_start,shift_end=excluded.shift_end,grace_minutes=excluded.grace_minutes;
  end if;
  affected:=affected+1;
 end loop;
 return affected;
end $$;
revoke all on function public.roster_save_batch(jsonb) from public,anon;
grant execute on function public.roster_save_batch(jsonb) to authenticated;

-- Also correct status for existing clients; do not rewrite historical attendance.
create function public.attendance_roster_status() returns trigger language plpgsql security invoker set search_path='' as $$
declare r public.roster_schedules;
begin
 if new.check_in is not null and new.status in ('present','late') then
  select * into r from public.roster_schedules where profile_id=new.staff_id and date=new.date;
  if r.shift_start is null and r.shift_end is null and r.shift_code in ('D','OT') then r.shift_start:='08:00';r.shift_end:='17:00';end if;
  new.status:=case when r.shift_code in ('D','E','HD','OT') and r.shift_start is not null and new.check_in>r.shift_start+make_interval(mins=>r.grace_minutes) then 'late' else 'present' end;
 end if;
 return new;
end $$;
revoke all on function public.attendance_roster_status() from public,anon,authenticated;
create trigger attendance_roster_status before insert or update on public.staff_attendance for each row execute function public.attendance_roster_status();

-- Current-day actions use server time in India, reject duplicate clock-ins and
-- preserve every completed break. No backdated/fabricated attendance is seeded.
create function public.roster_attendance_action(p_action text,p_staff uuid default null) returns public.staff_attendance language plpgsql security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); sid uuid; r public.staff_attendance; local_now timestamp:=clock_timestamp() at time zone 'Asia/Kolkata'; d date; t time; meta jsonb; steps jsonb; last_step jsonb; n integer; is_admin boolean;
begin
 if uid is null then raise exception 'Sign in first' using errcode='42501';end if;
 select id into sid from public.staff_profiles where user_id=uid;
 select exists(select 1 from public.staff_profiles where user_id=uid and role='super_admin' and lower(email)='mithun@fets.in') into is_admin;
 if sid is null or (p_staff is not null and p_staff<>sid and not is_admin) then raise exception 'You can only record your own attendance' using errcode='42501';end if;
 sid:=coalesce(p_staff,sid); d:=local_now::date;t:=date_trunc('minute',local_now)::time;
 if p_action not in ('in','out','break','back') or p_action is null then raise exception 'Unknown attendance action';end if;
 perform pg_advisory_xact_lock(hashtextextended(sid::text||d::text,1));
 select * into r from public.staff_attendance where staff_id=sid and date=d for update;
 if p_action='in' then
  if r.check_in is not null then raise exception 'Already checked in today. Refresh your attendance.';end if;
  if r.check_out is not null then raise exception 'Attendance needs administrator review';end if;
  insert into public.staff_attendance(staff_id,date,check_in,status,branch_location,notes)
  values(sid,d,t,'present',coalesce((select branch_location from public.roster_schedules where profile_id=sid and date=d),(select branch_assigned from public.staff_profiles where id=sid)),jsonb_build_object('breakMins',0,'steps','[]'::jsonb)::text)
  on conflict(staff_id,date) do update set check_in=excluded.check_in,status=excluded.status,branch_location=excluded.branch_location
  returning * into r;
  return r;
 end if;
 if r.check_in is null then raise exception 'Check in first';end if;
 if r.check_out is not null then raise exception 'Already checked out today';end if;
 begin meta:=coalesce(r.notes,'{}')::jsonb;exception when others then raise exception 'Attendance notes need administrator review';end;
 if jsonb_typeof(meta)<>'object' then raise exception 'Attendance notes need administrator review';end if;
 steps:=coalesce(meta->'steps','[]'::jsonb);n:=jsonb_array_length(steps);last_step:=steps->(n-1);
 if p_action='break' then
  if last_step->>'out' is not null and last_step->>'in' is null then raise exception 'A break is already open';end if;
  steps:=steps||jsonb_build_array(jsonb_build_object('out',to_char(t,'HH24:MI')));
 else
  if p_action='back' and (last_step->>'out' is null or last_step->>'in' is not null) then raise exception 'No open break';end if;
  if last_step->>'out' is not null and last_step->>'in' is null then
   meta:=jsonb_set(meta,'{breakMins}',to_jsonb(coalesce((meta->>'breakMins')::integer,0)+greatest(0,floor(extract(epoch from(t-(last_step->>'out')::time))/60)::integer)));
   steps:=jsonb_set(steps,array[(n-1)::text],last_step||jsonb_build_object('in',to_char(t,'HH24:MI')));
  end if;
 end if;
 meta:=jsonb_set(meta,'{steps}',steps);
 update public.staff_attendance set notes=meta::text,check_out=case when p_action='out' then t else check_out end where id=r.id returning * into r;
 return r;
end $$;
revoke all on function public.roster_attendance_action(text,uuid) from public,anon;
grant execute on function public.roster_attendance_action(text,uuid) to authenticated;
-- OT is requested time outside that date's roster, never the old fixed 17:00 cutoff.
-- This does not approve a claim or change the existing payroll rate.
create function public.ot_claim_roster_hours() returns trigger language plpgsql security invoker set search_path='' as $$
declare r public.roster_schedules; outside_hours numeric;
begin
 if new.toil_payout is true or new.status='rejected' then return new;end if;
 if TG_OP='UPDATE' and old.status='approved' and new.date=old.date and new.start_time is not distinct from old.start_time and new.end_time is not distinct from old.end_time and new.ot_hours is not distinct from old.ot_hours then return new;end if;
 select * into r from public.roster_schedules where profile_id=new.profile_id and date=new.date;
 -- Existing zero-hour TOIL rest-day requests are not hourly overtime.
 if new.end_time is null and new.ot_hours=0 and r.shift_code in ('PH','RD','TP','TR') then return new;end if;
 if r.shift_start is null and r.shift_end is null and r.shift_code in ('D','OT') then r.shift_start:='08:00';r.shift_end:='17:00';end if;
 if r.shift_code is null or r.shift_code not in ('D','E','HD','OT') or r.shift_start is null or r.shift_end is null then raise exception 'Set the rostered working hours before requesting overtime';end if;
 if new.start_time is null or new.end_time is null or new.end_time<=new.start_time then raise exception 'Choose valid same-day overtime hours';end if;
 outside_hours:=(extract(epoch from(new.end_time-new.start_time))-greatest(0,extract(epoch from(least(new.end_time,r.shift_end)-greatest(new.start_time,r.shift_start)))))/3600;
 if outside_hours<=0 then raise exception 'These hours are inside the rostered shift, not overtime';end if;
 if new.status='approved' then
  if new.ot_hours<0 or new.ot_hours>round(outside_hours,2) then raise exception 'Approved overtime exceeds the time outside the rostered shift';end if;
 else new.ot_hours:=round(outside_hours,2);end if;
 return new;
end $$;
revoke all on function public.ot_claim_roster_hours() from public,anon,authenticated;
create trigger ot_claim_roster_hours before insert or update on public.staff_ot_claims for each row execute function public.ot_claim_roster_hours();

notify pgrst,'reload schema';
commit;
