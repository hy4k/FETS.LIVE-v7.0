-- Additional workstations are protected settings for one canonical centre/date.
-- Existing Calendar/source snapshot functions and all business bookings remain unchanged.
begin;

create table fets_calendar_seats_private.capacity_adjustments(
 branch_location text not null check(branch_location in ('calicut','cochin')),
 date date not null check(isfinite(date)),
 extra_systems integer not null check(extra_systems between 0 and 100),
 start_time time not null check(start_time<time '24:00'),
 end_time time not null,
 note text not null default '' check(length(note)<=500),
 updated_at timestamptz not null default clock_timestamp(),
 updated_by uuid not null,
 primary key(branch_location,date),
 check(end_time>start_time)
);
alter table fets_calendar_seats_private.capacity_adjustments enable row level security;
revoke all on fets_calendar_seats_private.capacity_adjustments from public,anon,authenticated,service_role;

create function fets_calendar_seats_private.planning_context(p_branch text,p_from date,p_through date)
returns jsonb language sql stable security definer set search_path='' as $$
 -- The existing checked function validates canonical membership and bounded dates.
 -- STABLE composition uses one request snapshot for source, Calendar and capacity.
 select fets_calendar_seats_private.context(p_branch,p_from,p_through) || jsonb_build_object(
  'capacity_adjustments',(select coalesce(jsonb_agg(jsonb_build_object(
   'branch_location',c.branch_location,'date',c.date,'extra_systems',c.extra_systems,
   'start_time',c.start_time,'end_time',c.end_time,'note',c.note,'updated_at',c.updated_at)
   order by c.date),'[]'::jsonb)
   from fets_calendar_seats_private.capacity_adjustments c
   where c.branch_location=p_branch and c.date between p_from and p_through))
$$;

create function fets_calendar_seats_private.save_capacity(
 p_branch text,p_date date,p_extra_systems integer,p_start_time time,p_end_time time,
 p_note text,p_expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 note_value text:=trim(coalesce(p_note,''));
 saved fets_calendar_seats_private.capacity_adjustments;
begin
 if p_branch is null or p_branch not in ('calicut','cochin') then
  raise exception 'Choose Calicut or Cochin' using errcode='22023';
 end if;
 if p_date is null or not isfinite(p_date)
  or p_extra_systems is null or p_extra_systems not between 0 and 100
  or p_start_time is null or p_end_time is null or p_start_time>=time '24:00' or p_end_time<=p_start_time
  or length(note_value)>500 then
  raise exception 'Choose a date, 0 to 100 whole additional systems, a same-day availability interval and a note of at most 500 characters' using errcode='22023';
 end if;
 if auth.uid() is null or not coalesce(fets_ai_private.permitted('calendar',p_branch),false) then
  raise exception 'Calendar edit permission and verified centre membership required' using errcode='42501';
 end if;
 -- Includes missing rows, so two first saves cannot overwrite each other.
 perform pg_advisory_xact_lock(hashtextextended(jsonb_build_array(p_branch,p_date)::text,73111));
 -- Hold canonical authority rows through the write and recheck after any wait.
 perform 1 from auth.users where id=auth.uid() for share;
 perform 1 from public.staff_profiles where user_id=auth.uid() for share;
 perform 1 from public.centre_duty_members where user_id=auth.uid() for share;
 if not coalesce(fets_ai_private.permitted('calendar',p_branch),false) then
  raise exception 'Calendar edit permission and verified centre membership required' using errcode='42501';
 end if;
 select * into saved from fets_calendar_seats_private.capacity_adjustments c
  where c.branch_location=p_branch and c.date=p_date for update;
 if found then
  if p_expected_updated_at is null or saved.updated_at is distinct from p_expected_updated_at then
   raise exception 'Capacity changed; reload the current date before saving' using errcode='40001';
  end if;
  update fets_calendar_seats_private.capacity_adjustments set
   extra_systems=p_extra_systems,start_time=p_start_time,end_time=p_end_time,note=note_value,
   updated_at=greatest(clock_timestamp(),saved.updated_at+interval '1 microsecond'),updated_by=auth.uid()
   where branch_location=p_branch and date=p_date returning * into saved;
 else
  if p_expected_updated_at is not null then
   raise exception 'Capacity changed; reload the current date before saving' using errcode='40001';
  end if;
  insert into fets_calendar_seats_private.capacity_adjustments(branch_location,date,extra_systems,start_time,end_time,note,updated_by)
   values(p_branch,p_date,p_extra_systems,p_start_time,p_end_time,note_value,auth.uid()) returning * into saved;
 end if;
 -- A zero keeps the version row, preventing a stale first-save from recreating capacity.
 return jsonb_build_object('branch_location',saved.branch_location,'date',saved.date,'extra_systems',saved.extra_systems,
  'start_time',saved.start_time,'end_time',saved.end_time,'note',saved.note,'updated_at',saved.updated_at);
end $$;

create function public.calendar_seat_planning_context(p_branch text,p_from date,p_through date)
returns jsonb language sql stable security invoker set search_path='' as $$
 select fets_calendar_seats_private.planning_context(p_branch,p_from,p_through)
$$;
create function public.save_calendar_seat_capacity(
 p_branch text,p_date date,p_extra_systems integer,p_start_time time,p_end_time time,
 p_note text,p_expected_updated_at timestamptz)
returns jsonb language sql security invoker set search_path='' as $$
 select fets_calendar_seats_private.save_capacity(p_branch,p_date,p_extra_systems,p_start_time,p_end_time,p_note,p_expected_updated_at)
$$;

revoke all on function fets_calendar_seats_private.planning_context(text,date,date),
 fets_calendar_seats_private.save_capacity(text,date,integer,time,time,text,timestamptz) from public,anon,authenticated,service_role;
grant execute on function fets_calendar_seats_private.planning_context(text,date,date),
 fets_calendar_seats_private.save_capacity(text,date,integer,time,time,text,timestamptz) to authenticated;
revoke all on function public.calendar_seat_planning_context(text,date,date),
 public.save_calendar_seat_capacity(text,date,integer,time,time,text,timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.calendar_seat_planning_context(text,date,date),
 public.save_calendar_seat_capacity(text,date,integer,time,time,text,timestamptz) to authenticated;

comment on table fets_calendar_seats_private.capacity_adjustments is 'Versioned additional systems for one canonical centre/date. Zero clears additional capacity while retaining its version. No bookings are changed.';
comment on function public.calendar_seat_planning_context(text,date,date) is 'Verified centre members: existing anonymous seat snapshot plus scoped daily additional systems, over at most 62 days.';
comment on function public.save_calendar_seat_capacity(text,date,integer,time,time,text,timestamptz) is 'Calendar editors: versioned additional systems for a single date and same-day interval, including 24:00 end. Does not change business bookings.';
commit;
