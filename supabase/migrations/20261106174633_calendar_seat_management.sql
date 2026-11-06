-- Shared timing configuration and anonymous source detail for booked-seat planning.
-- No candidate, Calendar, Pearson provenance or operational business rows are changed.
begin;

create schema fets_calendar_seats_private;
revoke all on schema fets_calendar_seats_private from public,anon,authenticated,service_role;
grant usage on schema fets_calendar_seats_private to authenticated;

create function fets_calendar_seats_private.normalise_provider(p_provider text)
returns text language sql immutable set search_path='' as $$
 select case upper(trim(p_provider))
  when 'PROMETRIC' then 'PROMETRIC' when 'CMAUS' then 'PROMETRIC' when 'PRO' then 'PROMETRIC'
  when 'PEARSON' then 'PEARSON VUE' when 'VUE' then 'PEARSON VUE' when 'PEARSONVUE' then 'PEARSON VUE'
  else nullif(upper(trim(p_provider)),'') end
$$;

create table fets_calendar_seats_private.rules(
 id uuid primary key default gen_random_uuid(),
 branch_location text not null check(branch_location in ('calicut','cochin')),
 provider text not null check(provider=fets_calendar_seats_private.normalise_provider(provider) and length(provider) between 1 and 120),
 exam_code text check(exam_code is null or (exam_code=upper(trim(exam_code)) and length(exam_code) between 1 and 200)),
 exam_name text check(exam_name is null or (exam_name=trim(exam_name) and length(exam_name) between 1 and 500)),
 earlier_minutes integer not null default 0 check(earlier_minutes between 0 and 120),
 later_minutes integer not null default 0 check(later_minutes between 0 and 120),
 updated_at timestamptz not null default clock_timestamp(),
 updated_by uuid not null,
 check(exam_code is null or exam_name is null)
);
create unique index calendar_seat_rule_scope on fets_calendar_seats_private.rules
 (branch_location,provider,coalesce(exam_code,''),coalesce(lower(exam_name),''));
alter table fets_calendar_seats_private.rules enable row level security;
revoke all on fets_calendar_seats_private.rules from public,anon,authenticated,service_role;

create function fets_calendar_seats_private.context(p_branch text,p_from date,p_through date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if p_branch is null or p_branch not in ('calicut','cochin') then
  raise exception 'Choose Calicut or Cochin' using errcode='22023';
 end if;
 if p_from is null or p_through is null or not isfinite(p_from) or not isfinite(p_through)
  or p_through<p_from or p_through-p_from>61 then
  raise exception 'Choose a date window of at most 62 days' using errcode='22023';
 end if;
 if auth.uid() is null or not coalesce(fets_ai_private.member_active(auth.uid(),p_branch),false) then
  raise exception 'Verified active centre membership required' using errcode='42501';
 end if;
 select jsonb_build_object(
  'rules',(select coalesce(jsonb_agg(jsonb_build_object(
   'id',r.id,'branch_location',r.branch_location,'provider',r.provider,'exam_code',r.exam_code,'exam_name',r.exam_name,
   'earlier_minutes',r.earlier_minutes,'later_minutes',r.later_minutes,'updated_at',r.updated_at)
   order by r.provider,coalesce(r.exam_code,''),coalesce(lower(r.exam_name),''),r.id),'[]'::jsonb)
   from fets_calendar_seats_private.rules r where r.branch_location=p_branch),
  'details',(select coalesce(jsonb_agg(jsonb_build_object(
   'session_id',d.session_id,'branch_location',d.branch_location,'provider',d.provider,'date',d.day,
   'start_time',d.start_time,'end_time',d.end_time,'exam_code',d.exam_code,'exam_title',d.exam_title,
   'count',d.n,'status',d.status)
   order by d.session_id,d.day,d.start_time,d.end_time,d.exam_code,d.exam_title,d.status),'[]'::jsonb)
   from (
    select c.pearson_calendar_session_id as session_id,c.branch_location,
     fets_calendar_seats_private.normalise_provider(c.client_name) as provider,
     (c.exam_date at time zone 'Asia/Kolkata')::date as day,c.exam_start_time as start_time,c.exam_end_time as end_time,
     nullif(upper(trim(c.exam_code)),'') as exam_code,nullif(trim(c.exam_title),'') as exam_title,
     case
      when coalesce(nullif(lower(trim(c.status)),''),'registered')<>'registered' then lower(trim(c.status))
      when c.check_out_time is not null then 'completed'
      when c.check_in_time is not null then 'checked_in'
      when nullif(trim(c.locker_key),'') is not null then 'in_progress'
      else 'registered' end as status,
     count(*)::integer as n
    from public.candidates c join public.calendar_sessions s on s.id=c.pearson_calendar_session_id
    where c.pearson_registration_id is not null and c.pearson_calendar_session_id is not null
     and c.branch_location=p_branch and s.branch_location=p_branch
     and coalesce(lower(trim(c.status)),'registered') not in ('cancelled','canceled')
     -- Preserve disagreements with Calendar rather than borrowing Calendar timing.
     -- Pending missing bookings remain registered until an explicit cancellation.
     and (s.date between p_from and p_through or (c.exam_date at time zone 'Asia/Kolkata')::date between p_from and p_through)
    group by c.pearson_calendar_session_id,c.branch_location,fets_calendar_seats_private.normalise_provider(c.client_name),
     (c.exam_date at time zone 'Asia/Kolkata')::date,c.exam_start_time,c.exam_end_time,
     nullif(upper(trim(c.exam_code)),''),nullif(trim(c.exam_title),''),
     case
      when coalesce(nullif(lower(trim(c.status)),''),'registered')<>'registered' then lower(trim(c.status))
      when c.check_out_time is not null then 'completed'
      when c.check_in_time is not null then 'checked_in'
      when nullif(trim(c.locker_key),'') is not null then 'in_progress'
      else 'registered' end
   ) d),
  'can_edit_rules',coalesce(fets_ai_private.permitted('calendar',p_branch),false)
 ) into result;
 return result;
end $$;

create function fets_calendar_seats_private.save_rule(
 p_branch text,p_provider text,p_exam_code text,p_exam_name text,
 p_earlier_minutes integer,p_later_minutes integer,p_expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 provider_key text:=fets_calendar_seats_private.normalise_provider(p_provider);
 code_key text:=nullif(upper(trim(p_exam_code)),'');
 name_key text:=nullif(trim(p_exam_name),'');
 saved fets_calendar_seats_private.rules;
begin
 if p_branch is null or p_branch not in ('calicut','cochin') then
  raise exception 'Choose Calicut or Cochin' using errcode='22023';
 end if;
 if provider_key is null or length(provider_key)>120 or length(code_key)>200 or length(name_key)>500
  or (code_key is not null and name_key is not null)
  or p_earlier_minutes is null or p_earlier_minutes not between 0 and 120
  or p_later_minutes is null or p_later_minutes not between 0 and 120 then
  raise exception 'Choose a provider, one exam code or title, and whole-minute limits from 0 to 120' using errcode='22023';
 end if;
 if auth.uid() is null or not coalesce(fets_ai_private.permitted('calendar',p_branch),false) then
  raise exception 'Calendar edit permission and verified centre membership required' using errcode='42501';
 end if;
 -- A scope lock covers a missing row as well as updates. Aliases share the lock.
 perform pg_advisory_xact_lock(hashtextextended(jsonb_build_array(p_branch,provider_key,code_key,lower(name_key))::text,73110));
 -- Hold canonical authority rows through the write, then recheck after waiting.
 perform 1 from auth.users where id=auth.uid() for share;
 perform 1 from public.staff_profiles where user_id=auth.uid() for share;
 perform 1 from public.centre_duty_members where user_id=auth.uid() for share;
 if not coalesce(fets_ai_private.permitted('calendar',p_branch),false) then
  raise exception 'Calendar edit permission and verified centre membership required' using errcode='42501';
 end if;
 select * into saved from fets_calendar_seats_private.rules r
  where r.branch_location=p_branch and r.provider=provider_key
   and r.exam_code is not distinct from code_key and lower(r.exam_name) is not distinct from lower(name_key)
  for update;
 if found then
  if p_expected_updated_at is null or saved.updated_at is distinct from p_expected_updated_at then
   raise exception 'Rule changed; reload the current rule before saving' using errcode='40001';
  end if;
  update fets_calendar_seats_private.rules set
   earlier_minutes=p_earlier_minutes,later_minutes=p_later_minutes,
   updated_at=greatest(clock_timestamp(),saved.updated_at+interval '1 microsecond'),updated_by=auth.uid()
   where id=saved.id returning * into saved;
 else
  if p_expected_updated_at is not null then
   raise exception 'Rule changed; reload the current rule before saving' using errcode='40001';
  end if;
  insert into fets_calendar_seats_private.rules(branch_location,provider,exam_code,exam_name,earlier_minutes,later_minutes,updated_by)
   values(p_branch,provider_key,code_key,name_key,p_earlier_minutes,p_later_minutes,auth.uid()) returning * into saved;
 end if;
 return jsonb_build_object('id',saved.id,'branch_location',saved.branch_location,'provider',saved.provider,
  'exam_code',saved.exam_code,'exam_name',saved.exam_name,'earlier_minutes',saved.earlier_minutes,
  'later_minutes',saved.later_minutes,'updated_at',saved.updated_at);
end $$;

create function public.calendar_seat_context(p_branch text,p_from date,p_through date)
returns jsonb language sql stable security invoker set search_path='' as $$
 select fets_calendar_seats_private.context(p_branch,p_from,p_through)
$$;
create function public.save_calendar_seat_rule(
 p_branch text,p_provider text,p_exam_code text,p_exam_name text,
 p_earlier_minutes integer,p_later_minutes integer,p_expected_updated_at timestamptz)
returns jsonb language sql security invoker set search_path='' as $$
 select fets_calendar_seats_private.save_rule(p_branch,p_provider,p_exam_code,p_exam_name,p_earlier_minutes,p_later_minutes,p_expected_updated_at)
$$;

revoke all on all functions in schema fets_calendar_seats_private from public,anon,authenticated,service_role;
grant execute on function fets_calendar_seats_private.context(text,date,date),fets_calendar_seats_private.save_rule(text,text,text,text,integer,integer,timestamptz) to authenticated;
revoke all on function public.calendar_seat_context(text,date,date),public.save_calendar_seat_rule(text,text,text,text,integer,integer,timestamptz) from public,anon,service_role;
grant execute on function public.calendar_seat_context(text,date,date),public.save_calendar_seat_rule(text,text,text,text,integer,integer,timestamptz) to authenticated;

comment on function public.calendar_seat_context(text,date,date) is 'Verified centre members: timing rules and anonymous Pearson source groups over at most 62 days; no candidate identity fields.';
comment on function public.save_calendar_seat_rule(text,text,text,text,integer,integer,timestamptz) is 'Calendar editors only: versioned centre timing configuration. Does not reschedule or update business bookings.';
commit;
