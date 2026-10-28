-- Additive My Desk workflow. Existing journals, vault records and resolved
-- applications remain intact. No attendance or roster records are seeded.
create schema if not exists desk_workspace_private;
revoke all on schema desk_workspace_private from public,anon;
grant usage on schema desk_workspace_private to authenticated;

create function desk_workspace_private.actor() returns public.staff_profiles
language plpgsql security definer set search_path='' as $$
declare actor public.staff_profiles;
begin
 select * into actor from public.staff_profiles where user_id=auth.uid() and is_active is not false;
 if auth.uid() is null or actor.id is null then raise exception 'Sign in with an active staff account' using errcode='42501';end if;
 return actor;
end $$;
revoke all on function desk_workspace_private.actor() from public,anon,authenticated,service_role;

create table public.desk_team_rounds(
 user_id uuid not null references auth.users(id),round_date date not null,
 choice smallint not null check(choice between 0 and 2),joined_at timestamptz not null default clock_timestamp(),
 primary key(user_id,round_date)
);
create index desk_team_rounds_date on public.desk_team_rounds(round_date);
alter table public.desk_team_rounds enable row level security;
revoke all on public.desk_team_rounds from public,anon,authenticated,service_role;
grant select on public.desk_team_rounds to authenticated;
create policy team_round_own_read on public.desk_team_rounds for select to authenticated using(user_id=(select auth.uid()));

create function desk_workspace_private.round_snapshot() returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.staff_profiles; d date:=(clock_timestamp() at time zone 'Asia/Kolkata')::date;
begin
 a:=desk_workspace_private.actor();
 return jsonb_build_object('day',d,'choice',(select choice from public.desk_team_rounds where user_id=a.user_id and round_date=d),
 'participants',(select coalesce(jsonb_agg(jsonb_build_object('name',s.full_name) order by r.joined_at),'[]'::jsonb) from public.desk_team_rounds r join public.staff_profiles s on s.user_id=r.user_id where r.round_date=d and s.is_active is not false));
end $$;
create function desk_workspace_private.round_join(p_choice integer,p_day date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.staff_profiles;d date:=(clock_timestamp() at time zone 'Asia/Kolkata')::date;
begin
 a:=desk_workspace_private.actor();
 if p_choice is null or p_choice not between 0 and 2 then raise exception 'Choose one answer';end if;
 if p_day is distinct from d then raise exception 'A new round is available. Refresh and try today’s round.' using errcode='40001';end if;
 insert into public.desk_team_rounds(user_id,round_date,choice)values(a.user_id,d,p_choice) on conflict(user_id,round_date) do nothing;
 return desk_workspace_private.round_snapshot();
end $$;
revoke all on function desk_workspace_private.round_snapshot(),desk_workspace_private.round_join(integer,date) from public,anon,authenticated,service_role;
grant execute on function desk_workspace_private.round_snapshot(),desk_workspace_private.round_join(integer,date) to authenticated;
create function public.desk_team_round() returns jsonb language sql security invoker set search_path='' as $$select desk_workspace_private.round_snapshot()$$;
create function public.desk_team_round_join(p_choice integer,p_day date) returns jsonb language sql security invoker set search_path='' as $$select desk_workspace_private.round_join(p_choice,p_day)$$;
revoke all on function public.desk_team_round(),public.desk_team_round_join(integer,date) from public,anon,authenticated,service_role;
grant execute on function public.desk_team_round(),public.desk_team_round_join(integer,date) to authenticated;

alter table public.staff_applications add column workflow_version integer not null default 0,
 add column half_day_period text check(half_day_period in ('first','second')),
 add column roster_snapshot jsonb,
 add column partner_reply text check(partner_reply in ('accepted','declined')),
 add column partner_replied_at timestamptz,
 add column version bigint not null default 1;
create index staff_applications_partner_pending on public.staff_applications(swap_with_id,status) where kind='swap';
create policy application_partner_read on public.staff_applications for select to authenticated
 using(kind='swap' and swap_with_id in (select id from public.staff_profiles where user_id=(select auth.uid()) and is_active is not false));
create function desk_workspace_private.application_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if current_user in ('authenticated','anon') and
  (new.workflow_version<>0 or (TG_OP='UPDATE' and old.workflow_version<>0)) then
  raise exception 'Use the current My Desk request form' using errcode='42501';
 end if;
 if TG_OP='UPDATE' then new.version:=old.version+1;end if;
 return new;
end $$;
revoke all on function desk_workspace_private.application_guard() from public,anon,authenticated,service_role;
create trigger desk_application_guard before insert or update on public.staff_applications for each row execute function desk_workspace_private.application_guard();

create function desk_workspace_private.request_submit(p_kind text,p_date date,p_partner uuid,p_swap_date date,p_period text,p_reason text) returns public.staff_applications
language plpgsql security definer set search_path='' as $$
declare a public.staff_profiles;b public.staff_profiles;r public.roster_schedules;result public.staff_applications;snapshot jsonb:='[]';entry record;d date:=(clock_timestamp() at time zone 'Asia/Kolkata')::date;
begin
 a:=desk_workspace_private.actor();
 if p_kind is null or p_kind not in ('swap','leave') or p_date is null or p_date<d or length(coalesce(p_reason,''))>2000 then raise exception 'Choose a current or future date and a valid request';end if;
 if p_kind='leave' and (p_period is null or p_period not in ('first','second')) then raise exception 'Choose which half of the shift you need off';end if;
 if p_kind='swap' then
  select * into b from public.staff_profiles where id=p_partner and is_active is not false;
  if b.id is null or b.id=a.id or b.branch_assigned is distinct from a.branch_assigned or p_swap_date is null or p_swap_date<d then raise exception 'Choose another active staff member at your centre and both dates';end if;
 end if;
 for entry in select distinct pid,dt from (values(a.id,p_date),(case when p_kind='swap' then b.id end,p_date),(case when p_kind='swap' then a.id end,p_swap_date),(case when p_kind='swap' then b.id end,p_swap_date)) as cells(pid,dt) where pid is not null and dt is not null order by pid,dt loop
  select * into r from public.roster_schedules where profile_id=entry.pid and date=entry.dt;
  if r.id is null then raise exception 'Set the roster for both staff on the requested dates first';end if;
  if coalesce(r.overtime_hours,0)<>0 then raise exception 'Approved overtime on these dates needs separate roster review';end if;
  if p_kind='leave' then
   if r.shift_start is null and r.shift_end is null and r.shift_code in ('D','OT') then r.shift_start:='08:00';r.shift_end:='17:00';end if;
   if r.shift_code not in ('D','E','OT') or r.shift_start is null or r.shift_end is null or r.shift_end<=r.shift_start or mod(extract(epoch from(r.shift_end-r.shift_start))::integer,120)<>0 then raise exception 'A working roster with hours divisible into two equal minute-based halves is required';end if;
  end if;
  snapshot:=snapshot||jsonb_build_array(to_jsonb(r));
 end loop;
 insert into public.staff_applications(kind,status,applicant_id,applicant_name,branch,request_date,leave_type,swap_with_name,swap_with_id,swap_date,reason,workflow_version,half_day_period,roster_snapshot)
 values(p_kind,'pending',a.id,a.full_name,a.branch_assigned,p_date,case when p_kind='leave' then 'Half-day' end,b.full_name,b.id,p_swap_date,coalesce(p_reason,''),1,case when p_kind='leave' then p_period end,snapshot) returning * into result;
 return result;
end $$;

create function desk_workspace_private.swap_reply(p_id uuid,p_accept boolean,p_version bigint) returns public.staff_applications
language plpgsql security definer set search_path='' as $$
declare a public.staff_profiles;r public.staff_applications;
begin
 a:=desk_workspace_private.actor();select * into r from public.staff_applications where id=p_id for update;
 if r.id is null or r.kind<>'swap' or r.swap_with_id is distinct from a.id or r.workflow_version<>1 then raise exception 'This swap is not addressed to you' using errcode='42501';end if;
 if r.status<>'pending' or r.partner_reply is not null or r.version is distinct from p_version or p_accept is null then raise exception 'The request changed. Refresh before replying.' using errcode='40001';end if;
 update public.staff_applications set partner_reply=case when p_accept then 'accepted' else 'declined' end,partner_replied_at=clock_timestamp() where id=r.id returning * into r;
 return r;
end $$;

create function desk_workspace_private.request_resolve(p_id uuid,p_status text,p_version bigint,p_reply text) returns public.staff_applications
language plpgsql security definer set search_path='' as $$
declare a public.staff_profiles;app public.staff_applications;r public.roster_schedules;source jsonb;cell jsonb;mid time;
begin
 a:=desk_workspace_private.actor();
 if a.role is distinct from 'super_admin' or lower(a.email) is distinct from 'mithun@fets.in' then raise exception 'Only the roster administrator can resolve this request' using errcode='42501';end if;
 if p_status is null or p_status not in ('approved','rejected') or length(coalesce(p_reply,''))>2000 then raise exception 'Choose approve or reject';end if;
 select * into app from public.staff_applications where id=p_id for update;
 if app.id is null or app.workflow_version<>1 or app.status<>'pending' or app.version is distinct from p_version then raise exception 'The request changed. Refresh before reviewing it.' using errcode='40001';end if;
 if p_status='approved' then
  if app.kind='swap' and app.partner_reply is distinct from 'accepted' then raise exception 'The colleague must accept the swap before management approval';end if;
  if app.request_date<(clock_timestamp() at time zone 'Asia/Kolkata')::date then raise exception 'Past dates require separate roster review';end if;
  for cell in select value from jsonb_array_elements(app.roster_snapshot) order by value->>'profile_id',value->>'date' loop
   if (cell->>'date')::date<(clock_timestamp() at time zone 'Asia/Kolkata')::date then raise exception 'Past dates require separate roster review';end if;
   perform pg_advisory_xact_lock(hashtextextended((cell->>'profile_id')||(cell->>'date'),0));
   select * into r from public.roster_schedules where profile_id=(cell->>'profile_id')::uuid and date=(cell->>'date')::date for update;
   if r.id is null or r.version is distinct from (cell->>'version')::bigint then raise exception 'The roster changed after this request. Reject it and ask for a new request.' using errcode='40001';end if;
   if exists(select 1 from public.staff_attendance where staff_id=r.profile_id and date=r.date and check_in is not null) then raise exception 'Attendance is already recorded. These dates need separate administrator review.';end if;
  end loop;
  if app.kind='leave' then
   cell:=app.roster_snapshot->0;mid:=(cell->>'shift_start')::time+(((cell->>'shift_end')::time-(cell->>'shift_start')::time)/2);
   update public.roster_schedules set shift_code='HD',shift_label=case when app.half_day_period='first' then 'Half day · second half working' else 'Half day · first half working' end,
    shift_start=case when app.half_day_period='first' then mid else (cell->>'shift_start')::time end,
    shift_end=case when app.half_day_period='second' then mid else (cell->>'shift_end')::time end,
    overtime_hours=0 where id=(cell->>'id')::uuid;
  elsif app.kind='swap' then
   for cell in select value from jsonb_array_elements(app.roster_snapshot) loop
    select value into source from jsonb_array_elements(app.roster_snapshot) where value->>'date'=cell->>'date' and value->>'profile_id'<>cell->>'profile_id';
    if source is null then raise exception 'Both roster entries are required';end if;
    update public.roster_schedules set shift_code=source->>'shift_code',shift_label=source->>'shift_label',shift_start=(source->>'shift_start')::time,shift_end=(source->>'shift_end')::time,grace_minutes=coalesce((source->>'grace_minutes')::integer,0),overtime_hours=0 where id=(cell->>'id')::uuid;
   end loop;
  else raise exception 'Unsupported roster request';end if;
 end if;
 update public.staff_applications set status=p_status,admin_reply=nullif(btrim(p_reply),''),resolved_by=a.id,resolved_at=clock_timestamp() where id=app.id returning * into app;
 return app;
end $$;

revoke all on function desk_workspace_private.request_submit(text,date,uuid,date,text,text),desk_workspace_private.swap_reply(uuid,boolean,bigint),desk_workspace_private.request_resolve(uuid,text,bigint,text) from public,anon,authenticated,service_role;
grant execute on function desk_workspace_private.request_submit(text,date,uuid,date,text,text),desk_workspace_private.swap_reply(uuid,boolean,bigint),desk_workspace_private.request_resolve(uuid,text,bigint,text) to authenticated;
create function public.desk_request_submit(p_kind text,p_date date,p_partner uuid default null,p_swap_date date default null,p_period text default null,p_reason text default '') returns public.staff_applications language sql security invoker set search_path='' as $$select desk_workspace_private.request_submit(p_kind,p_date,p_partner,p_swap_date,p_period,p_reason)$$;
create function public.desk_swap_reply(p_id uuid,p_accept boolean,p_version bigint) returns public.staff_applications language sql security invoker set search_path='' as $$select desk_workspace_private.swap_reply(p_id,p_accept,p_version)$$;
create function public.desk_request_resolve(p_id uuid,p_status text,p_version bigint,p_reply text default '') returns public.staff_applications language sql security invoker set search_path='' as $$select desk_workspace_private.request_resolve(p_id,p_status,p_version,p_reply)$$;
revoke all on function public.desk_request_submit(text,date,uuid,date,text,text),public.desk_swap_reply(uuid,boolean,bigint),public.desk_request_resolve(uuid,text,bigint,text) from public,anon,authenticated,service_role;
grant execute on function public.desk_request_submit(text,date,uuid,date,text,text),public.desk_swap_reply(uuid,boolean,bigint),public.desk_request_resolve(uuid,text,bigint,text) to authenticated;

-- Browser code-only edits still clear stale hours. The validated atomic resolver
-- supplies a complete saved shift, including when two shifts share their hours.
create or replace function public.roster_timing_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='UPDATE' then
  new.version:=old.version+1;
  -- Older clients changing a code cannot leave the former shift's hours behind.
  if current_user in ('authenticated','anon') and new.shift_code is distinct from old.shift_code and new.shift_start is not distinct from old.shift_start and new.shift_end is not distinct from old.shift_end and new.shift_label is not distinct from old.shift_label then
   new.shift_start:=null;new.shift_end:=null;new.shift_label:=null;new.grace_minutes:=0;
  end if;
 else new.version:=1; end if;
 if upper(new.shift_code) not in ('D','E','HD','OT') then new.shift_start:=null;new.shift_end:=null;new.shift_label:=null;new.grace_minutes:=0;end if;
 new.updated_at:=clock_timestamp();
 return new;
end $$;
