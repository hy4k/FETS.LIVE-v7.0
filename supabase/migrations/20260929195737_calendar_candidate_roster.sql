begin;

alter table public.candidates
  add column if not exists roster_number text,
  add column if not exists exam_part text,
  add column if not exists exam_start_time time,
  add column if not exists source text;

-- Old rows remain nullable; later writes outside the Calendar are tracker entries.
alter table public.candidates alter column source set default 'tracker';
alter table public.candidates add constraint candidates_roster_source_check check (source in ('upload','manual','tracker'));

-- exam_date is timestamptz. An explicit IST conversion is immutable; ::date alone is not.
create unique index if not exists candidates_roster_uniq on public.candidates
  (branch_location, ((exam_date at time zone 'Asia/Kolkata')::date), upper(client_name), roster_number)
  where roster_number is not null;

create index if not exists candidates_calendar_group_idx on public.candidates
 (branch_location, ((exam_date at time zone 'Asia/Kolkata')::date), upper(client_name), exam_name, exam_start_time);
create index if not exists calendar_sessions_roster_match_idx on public.calendar_sessions
 (branch_location, date, upper(client_name), exam_name, start_time);

create schema if not exists fets_roster_private;
revoke all on schema fets_roster_private from public;
grant usage on schema fets_roster_private to authenticated, service_role;

-- All helpers run as the caller. Existing candidates/calendar RLS remains in force.
create or replace function fets_roster_private.sync_group(
  p_day date, p_branch text, p_client text, p_exam text, p_start time
) returns void language plpgsql security invoker set search_path = '' as $$
declare
  n integer; target_id bigint; expected integer; changed integer; duration interval;
begin
  if p_day is null or p_branch not in ('calicut','cochin') or nullif(trim(p_client),'') is null then return; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_branch || ':' || p_day::text, 73109));
  select count(*) into n from public.candidates c
   where c.branch_location=p_branch and (c.exam_date at time zone 'Asia/Kolkata')::date=p_day
     and upper(c.client_name)=upper(p_client) and c.exam_name is not distinct from p_exam
     and c.exam_start_time is not distinct from p_start;
  select min(s.id),count(*) into target_id,expected from public.calendar_sessions s
   where s.branch_location=p_branch and s.date=p_day and upper(s.client_name)=upper(p_client)
     and s.exam_name is not distinct from p_exam and s.start_time is not distinct from p_start;
  if target_id is not null then
    -- Preserve duplicate planned sessions, but count this roster once.
    update public.calendar_sessions s set candidate_count=case when s.id=target_id then n else 0 end,updated_at=now()
     where s.branch_location=p_branch and s.date=p_day and upper(s.client_name)=upper(p_client)
       and s.exam_name is not distinct from p_exam and s.start_time is not distinct from p_start;
    get diagnostics changed = row_count;
    if changed <> expected then raise exception 'Your centre access does not allow updating these calendar sessions'; end if;
  elsif n > 0 then
    -- Reuse a duration already configured for this exam, otherwise leave end=start.
    select s.end_time-s.start_time into duration from public.calendar_sessions s
     where upper(s.client_name)=upper(p_client) and s.exam_name is not distinct from p_exam
       and s.end_time>s.start_time and coalesce(s.status,'scheduled')<>'cancelled'
     order by (s.branch_location=p_branch) desc,s.date desc,s.id desc limit 1;
    insert into public.calendar_sessions(client_name,exam_name,date,branch_location,start_time,end_time,candidate_count,user_id,status)
      values(upper(p_client),p_exam,p_day,p_branch,p_start,p_start+coalesce(duration,interval '0'),n,auth.uid(),'scheduled');
  end if;
end;
$$;

create or replace function fets_roster_private.sync_changed_roster() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare g record; query_text text;
begin
  if tg_op='INSERT' then query_text := 'select * from roster_new';
  elsif tg_op='DELETE' then query_text := 'select * from roster_old';
  else query_text := 'select * from roster_new union all select * from roster_old'; end if;
  for g in execute 'select distinct (exam_date at time zone ''Asia/Kolkata'')::date as day,branch_location,upper(client_name) as client,exam_name,exam_start_time from (' || query_text || ') r order by branch_location,day,client,exam_name,exam_start_time' loop
    perform fets_roster_private.sync_group(g.day,g.branch_location,g.client,g.exam_name,g.exam_start_time);
  end loop;
  return null;
end;
$$;

create trigger candidates_roster_insert_sync after insert on public.candidates
 referencing new table as roster_new for each statement execute function fets_roster_private.sync_changed_roster();
create trigger candidates_roster_update_sync after update on public.candidates
 referencing old table as roster_old new table as roster_new for each statement execute function fets_roster_private.sync_changed_roster();
create trigger candidates_roster_delete_sync after delete on public.candidates
 referencing old table as roster_old for each statement execute function fets_roster_private.sync_changed_roster();

-- PostgREST onConflict cannot target a partial expression index. This RPC uses the exact index expression.
create or replace function public.save_calendar_roster(p_date date,p_branch text,p_provider text,p_source text,p_rows jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare item jsonb; total integer; existing integer; g record;
begin
  if auth.uid() is null then raise exception 'Sign in to save a roster'; end if;
  if p_date is null or p_branch not in ('calicut','cochin') or p_branch is null then raise exception 'Choose a date and centre'; end if;
  if p_provider is null or p_provider not in ('PROMETRIC','PEARSON VUE','CELPIP','PSI','ITTS') then raise exception 'Choose a supported provider'; end if;
  if p_source is null or p_source not in ('upload','manual') then raise exception 'Invalid roster source'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'Expected candidate rows'; end if;
  total := jsonb_array_length(p_rows);
  if total<1 or total>2000 then raise exception 'Save between 1 and 2000 candidates at a time'; end if;
  for item in select value from jsonb_array_elements(p_rows) loop
    if nullif(trim(item->>'roster_number'),'') is null or length(item->>'roster_number')>200 then raise exception 'Every candidate needs a provider roster number (maximum 200 characters)'; end if;
    if nullif(trim(item->>'full_name'),'') is null or length(item->>'full_name')>300 then raise exception 'Every candidate needs a full name'; end if;
    if nullif(trim(item->>'exam_name'),'') is null then raise exception 'Every candidate needs an exam name'; end if;
    if coalesce(item->>'exam_start_time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' then raise exception 'Every candidate needs a valid IST start time'; end if;
  end loop;
  if (select count(distinct trim(value->>'roster_number')) from jsonb_array_elements(p_rows))<>total then raise exception 'Duplicate roster numbers in this upload; resolve them before saving'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_branch || ':' || p_date::text,73109));
  select count(*) into existing from public.candidates c where c.branch_location=p_branch
   and (c.exam_date at time zone 'Asia/Kolkata')::date=p_date and upper(c.client_name)=p_provider
   and c.roster_number in (select trim(value->>'roster_number') from jsonb_array_elements(p_rows));
  insert into public.candidates(full_name,phone,roster_number,exam_part,exam_start_time,client_name,exam_name,exam_date,branch_location,status,source,user_id)
   select trim(v->>'full_name'),nullif(trim(v->>'phone'),''),trim(v->>'roster_number'),nullif(trim(v->>'exam_part'),''),
     (v->>'exam_start_time')::time,p_provider,trim(v->>'exam_name'),p_date::timestamp at time zone 'Asia/Kolkata',p_branch,'registered',p_source,auth.uid()
   from jsonb_array_elements(p_rows) v
   on conflict (branch_location, ((exam_date at time zone 'Asia/Kolkata')::date), upper(client_name), roster_number)
   where roster_number is not null do update set
     full_name=excluded.full_name,phone=excluded.phone,exam_part=excluded.exam_part,
     exam_start_time=excluded.exam_start_time,exam_name=excluded.exam_name,source=excluded.source,updated_at=now();
  -- Also reconcile existing groups in this centre/day after a re-upload.
  for g in select distinct upper(client_name) as client,exam_name,exam_start_time from public.candidates
    where branch_location=p_branch and (exam_date at time zone 'Asia/Kolkata')::date=p_date
    order by client,exam_name,exam_start_time loop
    perform fets_roster_private.sync_group(p_date,p_branch,g.client,g.exam_name,g.exam_start_time);
  end loop;
  return jsonb_build_object('saved',total,'inserted',total-existing,'updated',existing,'calendar_synced',true);
end;
$$;

revoke all on function public.save_calendar_roster(date,text,text,text,jsonb) from public,anon;
grant execute on function public.save_calendar_roster(date,text,text,text,jsonb) to authenticated;
revoke all on all functions in schema fets_roster_private from public,anon;
grant execute on all functions in schema fets_roster_private to authenticated,service_role;
notify pgrst,'reload schema';
commit;
