-- Calendar candidate roster: adds roster columns to candidates and keeps
-- calendar_sessions.candidate_count in sync automatically.
-- Contract columns (do not rename without coordinating with fets.online):
--   roster_number, exam_part, exam_start_time, source
-- fets.online reads: full_name, phone, roster_number, exam_part, exam_start_time,
--   client_name, exam_name, exam_date, branch_location, status

begin;

alter table public.candidates
  add column if not exists roster_number   text,
  add column if not exists exam_part       text,
  add column if not exists exam_start_time time,
  add column if not exists source          text default 'tracker'
    check (source in ('upload','manual','tracker'));

-- Safe re-upload index: (centre, IST day, upper(provider), roster_number)
-- exam_date is timestamptz; ::date alone is session-timezone-dependent and
-- cannot be used in a unique index. The explicit AT TIME ZONE cast is immutable.
create unique index if not exists candidates_roster_uniq
  on public.candidates
  (branch_location,
   ((exam_date at time zone 'Asia/Kolkata')::date),
   upper(client_name),
   roster_number)
  where roster_number is not null;

-- Supporting index for the trigger's group-count query
create index if not exists candidates_roster_group_idx
  on public.candidates
  (branch_location,
   ((exam_date at time zone 'Asia/Kolkata')::date),
   upper(client_name),
   exam_name,
   exam_start_time);

create index if not exists calendar_sessions_roster_match_idx
  on public.calendar_sessions
  (branch_location, date, upper(client_name), exam_name, start_time);

-- ── Private schema for helpers ────────────────────────────────────────────
create schema if not exists fets_roster_private;
revoke all on schema fets_roster_private from public;
grant usage on schema fets_roster_private to authenticated, service_role;

-- sync_group: recalculate candidate_count for one (centre, day, provider, exam, time) group.
-- Runs as the caller so existing RLS on calendar_sessions is enforced.
create or replace function fets_roster_private.sync_group(
  p_day    date,
  p_branch text,
  p_client text,   -- already upper()
  p_exam   text,
  p_start  time
) returns void language plpgsql security invoker set search_path = '' as $$
declare
  n          integer;
  target_id  bigint;
  sess_count integer;
  changed    integer;
  dur        interval;
begin
  if p_day is null
     or p_branch not in ('calicut','cochin')
     or nullif(trim(p_client),'') is null
  then return; end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_branch || ':' || p_day::text, 73109)
  );

  -- Count roster rows for this group
  select count(*) into n
    from public.candidates c
   where c.branch_location = p_branch
     and (c.exam_date at time zone 'Asia/Kolkata')::date = p_day
     and upper(c.client_name) = p_client
     and c.exam_name is not distinct from p_exam
     and c.exam_start_time is not distinct from p_start;

  -- Find matching calendar sessions
  select min(s.id), count(*) into target_id, sess_count
    from public.calendar_sessions s
   where s.branch_location = p_branch
     and s.date = p_day
     and upper(s.client_name) = p_client
     and s.exam_name is not distinct from p_exam
     and s.start_time is not distinct from p_start;

  if target_id is not null then
    -- Assign full count to first session, zero to duplicates
    update public.calendar_sessions s
       set candidate_count = case when s.id = target_id then n else 0 end,
           updated_at = now()
     where s.branch_location = p_branch
       and s.date = p_day
       and upper(s.client_name) = p_client
       and s.exam_name is not distinct from p_exam
       and s.start_time is not distinct from p_start;

    get diagnostics changed = row_count;
    if changed <> sess_count then
      raise exception 'Your centre access does not allow updating these calendar sessions';
    end if;

  elsif n > 0 then
    -- No session yet — create one, reusing a known duration if available
    select s.end_time - s.start_time into dur
      from public.calendar_sessions s
     where upper(s.client_name) = p_client
       and s.exam_name is not distinct from p_exam
       and s.end_time > s.start_time
       and coalesce(s.status,'scheduled') <> 'cancelled'
     order by (s.branch_location = p_branch) desc, s.date desc, s.id desc
     limit 1;

    insert into public.calendar_sessions
      (client_name, exam_name, date, branch_location,
       start_time, end_time, candidate_count, user_id, status)
    values
      (p_client, p_exam, p_day, p_branch,
       p_start, p_start + coalesce(dur, interval '0'),
       n, auth.uid(), 'scheduled');
  end if;
end;
$$;

-- Statement-level trigger function: reconciles all affected groups after DML
create or replace function fets_roster_private.sync_changed_roster()
  returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  g record;
  src text;
begin
  if tg_op = 'INSERT' then
    src := 'select distinct
              (exam_date at time zone ''Asia/Kolkata'')::date as day,
              branch_location, upper(client_name) as client,
              exam_name, exam_start_time
            from roster_new';
  elsif tg_op = 'DELETE' then
    src := 'select distinct
              (exam_date at time zone ''Asia/Kolkata'')::date as day,
              branch_location, upper(client_name) as client,
              exam_name, exam_start_time
            from roster_old';
  else
    src := 'select distinct
              (exam_date at time zone ''Asia/Kolkata'')::date as day,
              branch_location, upper(client_name) as client,
              exam_name, exam_start_time
            from roster_new
            union
            select distinct
              (exam_date at time zone ''Asia/Kolkata'')::date as day,
              branch_location, upper(client_name) as client,
              exam_name, exam_start_time
            from roster_old';
  end if;

  for g in execute src loop
    perform fets_roster_private.sync_group(
      g.day, g.branch_location, g.client, g.exam_name, g.exam_start_time
    );
  end loop;
  return null;
end;
$$;

drop trigger if exists candidates_roster_insert_sync on public.candidates;
drop trigger if exists candidates_roster_update_sync on public.candidates;
drop trigger if exists candidates_roster_delete_sync on public.candidates;

create trigger candidates_roster_insert_sync
  after insert on public.candidates
  referencing new table as roster_new
  for each statement execute function fets_roster_private.sync_changed_roster();

create trigger candidates_roster_update_sync
  after update on public.candidates
  referencing old table as roster_old new table as roster_new
  for each statement execute function fets_roster_private.sync_changed_roster();

create trigger candidates_roster_delete_sync
  after delete on public.candidates
  referencing old table as roster_old
  for each statement execute function fets_roster_private.sync_changed_roster();

-- ── Public RPC: save_calendar_roster ─────────────────────────────────────
-- PostgREST cannot target a partial expression index via onConflict, so we
-- use an RPC that calls the exact index expression.
create or replace function public.save_calendar_roster(
  p_date     date,
  p_branch   text,
  p_provider text,   -- stored as UPPER in client_name
  p_source   text,   -- 'upload' | 'manual'
  p_rows     jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  item     jsonb;
  total    integer;
  existing integer;
  g        record;
begin
  if auth.uid() is null then
    raise exception 'Sign in to save a roster';
  end if;
  if p_date is null or p_branch not in ('calicut','cochin') then
    raise exception 'Choose a date and centre (calicut or cochin)';
  end if;
  if p_provider not in ('PROMETRIC','PEARSON VUE','CELPIP','PSI','ITTS') then
    raise exception 'Choose a supported provider';
  end if;
  if p_source not in ('upload','manual') then
    raise exception 'Invalid source';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'Expected an array of candidate rows';
  end if;

  total := jsonb_array_length(p_rows);
  if total < 1 or total > 2000 then
    raise exception 'Save between 1 and 2000 candidates at a time';
  end if;

  -- Validate each row
  for item in select value from jsonb_array_elements(p_rows) loop
    if nullif(trim(item->>'roster_number'),'') is null
       or length(item->>'roster_number') > 200 then
      raise exception 'Every candidate needs a provider roster number (max 200 chars)';
    end if;
    if nullif(trim(item->>'full_name'),'') is null
       or length(item->>'full_name') > 300 then
      raise exception 'Every candidate needs a full name';
    end if;
    if nullif(trim(item->>'exam_name'),'') is null then
      raise exception 'Every candidate needs an exam name';
    end if;
    if coalesce(item->>'exam_start_time','') !~
       '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' then
      raise exception 'Every candidate needs a valid IST start time (HH:MM or HH:MM:SS)';
    end if;
  end loop;

  -- Reject duplicate roster numbers within the batch
  if (select count(distinct trim(value->>'roster_number'))
        from jsonb_array_elements(p_rows)) <> total then
    raise exception 'Duplicate roster numbers in this upload; resolve them before saving';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_branch || ':' || p_date::text, 73109)
  );

  -- Count how many of these roster_numbers already exist (for the result summary)
  select count(*) into existing
    from public.candidates c
   where c.branch_location = p_branch
     and (c.exam_date at time zone 'Asia/Kolkata')::date = p_date
     and upper(c.client_name) = p_provider
     and c.roster_number in (
       select trim(value->>'roster_number') from jsonb_array_elements(p_rows)
     );

  -- Upsert: new rows get status='registered'; existing rows update name/phone/part/exam/time
  -- but keep status, check_in_time, locker_key and other operational fields.
  insert into public.candidates
    (full_name, phone, roster_number, exam_part, exam_start_time,
     client_name, exam_name, exam_date, branch_location, status, source, user_id)
  select
    trim(v->>'full_name'),
    nullif(trim(v->>'phone'),''),
    trim(v->>'roster_number'),
    nullif(trim(v->>'exam_part'),''),
    (v->>'exam_start_time')::time,
    p_provider,
    trim(v->>'exam_name'),
    p_date::timestamp at time zone 'Asia/Kolkata',
    p_branch,
    'registered',
    p_source,
    auth.uid()
  from jsonb_array_elements(p_rows) v
  on conflict (branch_location,
               ((exam_date at time zone 'Asia/Kolkata')::date),
               upper(client_name),
               roster_number)
  where roster_number is not null
  do update set
    full_name        = excluded.full_name,
    phone            = excluded.phone,
    exam_part        = excluded.exam_part,
    exam_start_time  = excluded.exam_start_time,
    exam_name        = excluded.exam_name,
    source           = excluded.source,
    updated_at       = now();

  -- Reconcile all groups for this centre/day (handles time changes from re-uploads)
  for g in
    select distinct
      upper(client_name) as client,
      exam_name,
      exam_start_time
    from public.candidates
    where branch_location = p_branch
      and (exam_date at time zone 'Asia/Kolkata')::date = p_date
    order by client, exam_name, exam_start_time
  loop
    perform fets_roster_private.sync_group(
      p_date, p_branch, g.client, g.exam_name, g.exam_start_time
    );
  end loop;

  return jsonb_build_object(
    'saved',            total,
    'inserted',         total - existing,
    'updated',          existing,
    'calendar_synced',  true
  );
end;
$$;

revoke all on function public.save_calendar_roster(date,text,text,text,jsonb)
  from public, anon;
grant execute on function public.save_calendar_roster(date,text,text,text,jsonb)
  to authenticated;

revoke all on all functions in schema fets_roster_private from public, anon;
grant execute on all functions in schema fets_roster_private
  to authenticated, service_role;

notify pgrst, 'reload schema';

commit;

select 'ROSTER MIGRATION READY — run save_calendar_roster() from Calendar page' as result;
