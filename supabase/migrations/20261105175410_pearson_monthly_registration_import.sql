-- Pearson monthly snapshots: reviewed identities, explicit end-time memberships and atomic receipts.
begin;
alter table public.candidates
 add column if not exists email text,
 add column if not exists exam_code text,
 add column if not exists exam_title text,
 add column if not exists exam_owner text,
 add column if not exists exam_end_time time,
 add column if not exists pearson_source_phone text,
 add column if not exists pearson_registration_id uuid,
 add column if not exists pearson_calendar_session_id bigint references public.calendar_sessions(id);
create unique index candidates_pearson_registration_id on public.candidates(pearson_registration_id) where pearson_registration_id is not null;
create index candidates_pearson_membership on public.candidates(pearson_calendar_session_id) where pearson_registration_id is not null;
create index candidates_pearson_identity on public.candidates(branch_location,lower(email),exam_code) where upper(client_name)='PEARSON VUE';
create schema fets_pearson_private;
revoke all on schema fets_pearson_private from public,anon,authenticated,service_role;
-- Authenticated callers can invoke checked entrypoints, but cannot read private tables or call cores.
grant usage on schema fets_pearson_private to authenticated;
create table fets_pearson_private.imports(
 id uuid primary key default gen_random_uuid(),actor_id uuid,branch text not null,
 from_date date not null,through_date date not null,complete boolean not null,source_as_of date not null,
 file_hash text not null,content_hash text not null,filename text not null,source_rows jsonb not null,
 receipt jsonb,created_at timestamptz not null default clock_timestamp(),
 unique(branch,from_date,through_date,complete,source_as_of,content_hash)
);
create table fets_pearson_private.previews(
 id uuid primary key default gen_random_uuid(),actor_id uuid,branch text not null,
 from_date date not null,through_date date not null,complete boolean not null,source_as_of date not null,
 file_hash text not null,content_hash text not null,filename text not null,source_rows jsonb not null,
 target_snapshot jsonb not null,preview jsonb not null,existing_import_id uuid references fets_pearson_private.imports(id),
 expires_at timestamptz not null default clock_timestamp()+interval '30 minutes',applied_import_id uuid references fets_pearson_private.imports(id),
 created_at timestamptz not null default clock_timestamp()
);
create table fets_pearson_private.sessions(
 calendar_id bigint primary key references public.calendar_sessions(id),branch text not null,group_key text not null,exam_aliases text[] not null default '{}',
 import_id uuid not null references fets_pearson_private.imports(id),updated_at timestamptz not null default clock_timestamp(),unique(branch,group_key)
);
create table fets_pearson_private.memberships(
 candidate_id uuid primary key references public.candidates(id),calendar_id bigint not null references public.calendar_sessions(id),
 branch text not null,group_key text not null,active boolean not null default true,
 source_identity text not null,source_row jsonb not null,import_id uuid not null references fets_pearson_private.imports(id),
 updated_at timestamptz not null default clock_timestamp()
);
create table fets_pearson_private.cancellation_reviews(
 id uuid primary key default gen_random_uuid(),candidate_id uuid not null references public.candidates(id),
 branch text not null,import_id uuid not null references fets_pearson_private.imports(id),status text not null default 'pending' check(status in ('pending','cancel','keep','reappeared')),
 candidate_snapshot jsonb not null,decision_actor uuid,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp()
);
create unique index pearson_one_pending_review on fets_pearson_private.cancellation_reviews(candidate_id) where status='pending';
create table fets_pearson_private.audit(
 id bigint generated always as identity primary key,import_id uuid references fets_pearson_private.imports(id),actor_id uuid,
 action text not null,before_snapshot jsonb,after_snapshot jsonb,created_at timestamptz not null default clock_timestamp()
);
alter table fets_pearson_private.imports enable row level security;
alter table fets_pearson_private.previews enable row level security;
alter table fets_pearson_private.sessions enable row level security;
alter table fets_pearson_private.memberships enable row level security;
alter table fets_pearson_private.cancellation_reviews enable row level security;
alter table fets_pearson_private.audit enable row level security;

create function fets_pearson_private.group_key(r jsonb) returns text language sql immutable set search_path='' as $$
 select concat_ws('|',r->>'date',lower(trim(r->>'exam_owner')),to_char((r->>'start_time')::time,'HH24:MI:SS'),to_char((r->>'end_time')::time,'HH24:MI:SS'))
$$;
create function fets_pearson_private.identity_key(r jsonb) returns text language sql immutable set search_path='' as $$
 select md5(jsonb_build_array(lower(trim(r->>'full_name')),lower(nullif(trim(r->>'email'),'')),lower(trim(r->>'exam_code')),r->>'date',(r->>'start_time')::time,(r->>'end_time')::time)::text)
$$;
create function fets_pearson_private.has_progress(c jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(c->>'status','registered') not in ('registered','cancelled')
 or nullif(c->>'check_in_time','') is not null or nullif(c->>'check_out_time','') is not null
 or nullif(c->>'completed_at','') is not null or nullif(c->>'locker_key','') is not null
$$;
create function fets_pearson_private.check_access(b text) returns void language plpgsql set search_path='' as $$
begin
 if b is null or b not in ('cochin','calicut') then raise exception 'Choose Cochin or Calicut';end if;
 if auth.uid() is null or not coalesce(fets_ai_private.permitted('ws_candidate-tracker',b),false)
  or not coalesce(fets_ai_private.permitted('calendar',b),false) then
  raise exception 'Verified Candidate Tracker and Calendar centre access required' using errcode='42501';end if;
end $$;
create function fets_pearson_private.lock_scope(b text,f date,t date) returns void language plpgsql set search_path='' as $$
declare d date;
begin
 -- The existing daily importer uses this exact namespace. Acquire all old/new days first.
 for d in select affected_day from (
  select generate_series(f::timestamp,t::timestamp,interval '1 day')::date as affected_day
  union select (exam_date at time zone 'Asia/Kolkata')::date from public.candidates where branch_location=b and upper(client_name)='PEARSON VUE'
  union select date from public.calendar_sessions where branch_location=b and upper(client_name)='PEARSON VUE'
 ) days where affected_day is not null order by affected_day loop
  perform pg_advisory_xact_lock(hashtextextended(b||':'||d::text,73109));
 end loop;
end $$;
create function fets_pearson_private.scope_snapshot(b text) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object(
 'candidates',(select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]') from public.candidates c where c.branch_location=b and upper(c.client_name)='PEARSON VUE'),
 'calendar',(select coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]') from public.calendar_sessions s where s.branch_location=b and upper(s.client_name)='PEARSON VUE'),
 'memberships',(select coalesce(jsonb_agg(to_jsonb(m) order by m.candidate_id),'[]') from fets_pearson_private.memberships m where m.branch=b),
 'sessions',(select coalesce(jsonb_agg(to_jsonb(s) order by s.calendar_id),'[]') from fets_pearson_private.sessions s where s.branch=b),
 'reviews',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]') from fets_pearson_private.cancellation_reviews r where r.branch=b))
$$;

-- Owner-only operational cores take an explicit audit actor. They are never granted to app roles.
create function fets_pearson_private.preview_core(
 p_branch text,p_from date,p_through date,p_complete boolean,p_source_as_of date,p_file_hash text,p_filename text,p_rows jsonb,p_actor uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 r jsonb;current_candidate jsonb;s jsonb;options jsonb;session_options jsonb;output_rows jsonb:='[]';output_sessions jsonb:='[]';missing jsonb:='[]';warnings jsonb:='[]';
 snap jsonb;canonical text;prior_sessions jsonb:='{}';prior_ids bigint[];prior fets_pearson_private.imports;pid uuid:=gen_random_uuid();expiry timestamptz:=clock_timestamp()+interval '30 minutes';
 chosen uuid;sid bigint;kind text;groups record;exact_count integer;changes jsonb;result jsonb;n_new integer:=0;n_existing integer:=0;n_review integer:=0;
begin
 if p_branch is null or p_branch not in ('cochin','calicut') or p_from is null or p_through is null or p_complete is null or p_source_as_of is null
  or p_from>p_through or p_through-p_from>366 or p_source_as_of>(clock_timestamp() at time zone 'Asia/Kolkata')::date then raise exception 'Invalid centre, coverage or source-as-of date';end if;
 if p_file_hash is null or p_file_hash!~'^[a-f0-9]{64}$' or nullif(trim(p_filename),'') is null or length(p_filename)>300 then raise exception 'A file SHA-256 and filename are required';end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 5000 then raise exception 'Expected 1 to 5000 Pearson rows';end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  if jsonb_typeof(r) is distinct from 'object' or coalesce(r->>'source_row','')!~'^[1-9][0-9]{0,7}$'
   or coalesce(r->>'date','')!~'^\d{4}-\d{2}-\d{2}$' or (r->>'date')::date not between p_from and p_through
   or coalesce(r->>'start_time','')!~'^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
   or coalesce(r->>'end_time','')!~'^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
   or (r->>'end_time')::time<=(r->>'start_time')::time
   or nullif(trim(r->>'full_name'),'') is null or length(r->>'full_name')>300
   or nullif(trim(r->>'exam_code'),'') is null or length(r->>'exam_code')>300
   or nullif(trim(r->>'exam_owner'),'') is null or length(r->>'exam_owner')>300
   or nullif(trim(r->>'exam_title'),'') is null or length(r->>'exam_title')>1000
   or length(coalesce(r->>'email',''))>320 or length(coalesce(r->>'phone',''))>200
   or coalesce(r->>'email','') like '% %' then raise exception 'Invalid Pearson row %',r->>'source_row';end if;
 end loop;
 if (select count(distinct (value->>'source_row')::int) from jsonb_array_elements(p_rows))<>jsonb_array_length(p_rows)
 or (select count(distinct fets_pearson_private.identity_key(value)) from jsonb_array_elements(p_rows))<>jsonb_array_length(p_rows) then raise exception 'Duplicate source rows or booking identities';end if;
 select encode(sha256(convert_to(jsonb_agg(value-'source_row' order by (value-'source_row')::text)::text,'UTF8')),'hex') into canonical from jsonb_array_elements(p_rows);
 perform fets_pearson_private.lock_scope(p_branch,p_from,p_through);
 if p_actor is not null then perform fets_pearson_private.check_access(p_branch);end if;
 snap:=fets_pearson_private.scope_snapshot(p_branch);
 if exists(select 1 from fets_pearson_private.imports i where i.branch=p_branch and i.file_hash=p_file_hash and (i.content_hash<>canonical or i.from_date<>p_from or i.through_date<>p_through or i.complete<>p_complete or i.source_as_of<>p_source_as_of)) then raise exception 'File digest reused with different rows or coverage';end if;
 select * into prior from fets_pearson_private.imports i where i.branch=p_branch and i.from_date=p_from and i.through_date=p_through and i.complete=p_complete and i.source_as_of=p_source_as_of and i.content_hash=canonical;
 if prior.id is null and exists(select 1 from fets_pearson_private.imports i where i.branch=p_branch and i.source_as_of>p_source_as_of and i.from_date<=p_through and i.through_date>=p_from) then raise exception 'An older source snapshot cannot overwrite a newer import';end if;
 if prior.id is null and exists(select 1 from fets_pearson_private.imports i where i.branch=p_branch and i.source_as_of=p_source_as_of and i.from_date<=p_through and i.through_date>=p_from) then warnings:=warnings||jsonb_build_array('Another file has the same source-as-of date. Review changes; upload time does not establish source ordering.');end if;
 for r in select value from jsonb_array_elements(p_rows) order by (value->>'source_row')::int loop
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'full_name',c.full_name,'date',(c.exam_date at time zone 'Asia/Kolkata')::date,'start_time',c.exam_start_time,'exam_code',c.exam_code,'email',c.email) order by c.id),'[]') into options
  from public.candidates c where c.branch_location=p_branch and upper(c.client_name)='PEARSON VUE' and (
   (nullif(trim(r->>'email'),'') is not null and lower(c.email)=lower(trim(r->>'email')) and lower(c.exam_code)=lower(trim(r->>'exam_code')))
   or lower(trim(c.full_name))=lower(trim(r->>'full_name'))
   or (lower(c.exam_code)=lower(trim(r->>'exam_code')) and (c.exam_date at time zone 'Asia/Kolkata')::date=(r->>'date')::date and c.exam_start_time=(r->>'start_time')::time)
   or (c.pearson_registration_id is null and (c.exam_date at time zone 'Asia/Kolkata')::date=(r->>'date')::date));
  select count(*),(array_agg(c.id order by c.id))[1] into exact_count,chosen from public.candidates c
  where c.branch_location=p_branch and upper(c.client_name)='PEARSON VUE' and c.pearson_registration_id is not null and exists(select 1 from fets_pearson_private.memberships m where m.candidate_id=c.id and m.active)
   and nullif(trim(r->>'email'),'') is not null and lower(c.email)=lower(trim(r->>'email')) and lower(c.exam_code)=lower(trim(r->>'exam_code'))
   and lower(trim(c.full_name))=lower(trim(r->>'full_name')) and (c.exam_date at time zone 'Asia/Kolkata')::date=(r->>'date')::date
   and c.exam_start_time=(r->>'start_time')::time and c.exam_end_time=(r->>'end_time')::time;
  if exact_count=1 then kind:='exact';n_existing:=n_existing+1;
  elsif jsonb_array_length(options)>0 or nullif(trim(r->>'email'),'') is null then kind:='review';chosen:=null;n_review:=n_review+1;
  else kind:='new';chosen:=null;n_new:=n_new+1;end if;
  changes:='[]';
  if chosen is not null then
   select to_jsonb(x) into current_candidate from public.candidates x where x.id=chosen;
   for s in select jsonb_build_object('key',k) from unnest(array['full_name','email','exam_code','exam_title','exam_owner','pearson_source_phone']) k loop
    if current_candidate->>(s->>'key') is distinct from r->>(case when s->>'key'='pearson_source_phone' then 'phone' else s->>'key' end) then changes:=changes||jsonb_build_array(s->>'key');end if;
   end loop;
  end if;
  output_rows:=output_rows||jsonb_build_array(r||jsonb_build_object('candidate_id',chosen,'match_kind',kind,'possible_candidates',options,'changes',changes));
 end loop;
 -- Build reviewed reschedule choices once. Correlating this expansion to every
 -- Calendar row inside every source group makes a monthly preview cubic.
 if exists(select 1 from fets_pearson_private.memberships where branch=p_branch) then
  select coalesce(jsonb_object_agg(group_id,calendar_ids),'{}') into prior_sessions from (
   select fets_pearson_private.group_key(rv.value) group_id,jsonb_agg(distinct m.calendar_id) calendar_ids
   from jsonb_array_elements(output_rows) rv(value)
   cross join lateral (
    select (rv.value->>'candidate_id')::uuid candidate_id where rv.value->>'candidate_id' is not null
    union select (choice.value->>'id')::uuid from jsonb_array_elements(rv.value->'possible_candidates') choice(value)
   ) choices
   join fets_pearson_private.memberships m on m.candidate_id=choices.candidate_id and m.branch=p_branch
   group by 1
  ) prior_groups;
 end if;
 for groups in select fets_pearson_private.group_key(value) key,min(value->>'date') as day,min(value->>'exam_owner') owner,min((value->>'start_time')::time) start,min((value->>'end_time')::time) finish,count(*) n from jsonb_array_elements(p_rows) group by 1 order by 1 loop
  select coalesce(array_agg(value::bigint),'{}') into prior_ids from jsonb_array_elements_text(coalesce(prior_sessions->groups.key,'[]'));
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'date',s.date,'exam_name',s.exam_name,'start_time',s.start_time,'end_time',s.end_time,'candidate_count',s.candidate_count) order by s.id),'[]') into session_options
  from public.calendar_sessions s where s.branch_location=p_branch and upper(s.client_name)='PEARSON VUE' and (s.date=groups.day::date or s.id=any(prior_ids));
  select m.calendar_id into sid from fets_pearson_private.sessions m join public.calendar_sessions s on s.id=m.calendar_id where m.branch=p_branch and m.group_key=groups.key;
  if sid is not null then kind:='exact';
  elsif jsonb_array_length(session_options)>0 then kind:='review';
  else kind:='new';end if;
  output_sessions:=output_sessions||jsonb_build_array(jsonb_build_object('group_key',groups.key,'date',groups.day,'exam_owner',groups.owner,'start_time',groups.start,'end_time',groups.finish,'candidate_count',groups.n,'calendar_id',sid,'match_kind',kind,'possible_sessions',session_options));
 end loop;
 if p_complete then
  select coalesce(jsonb_agg(jsonb_build_object('id',coalesce(v.id,c.id),'candidate_id',c.id,'full_name',c.full_name,'date',(c.exam_date at time zone 'Asia/Kolkata')::date,'start_time',c.exam_start_time,'exam_code',c.exam_code,'status','pending','updated_at',coalesce(v.updated_at,c.updated_at),'has_progress',fets_pearson_private.has_progress(to_jsonb(c))) order by c.id),'[]') into missing
  from fets_pearson_private.memberships m join public.candidates c on c.id=m.candidate_id
  left join fets_pearson_private.cancellation_reviews v on v.candidate_id=c.id and v.status='pending'
  where m.branch=p_branch and m.active and (c.exam_date at time zone 'Asia/Kolkata')::date between greatest(p_from,p_source_as_of,(clock_timestamp() at time zone 'Asia/Kolkata')::date) and p_through
   and (c.exam_date at time zone 'Asia/Kolkata')::date+coalesce(c.exam_start_time,'00:00'::time)>(clock_timestamp() at time zone 'Asia/Kolkata')
   and not exists(select 1 from jsonb_array_elements(output_rows) rv(value) where rv.value->>'candidate_id'=c.id::text);
  if jsonb_array_length(missing)>0 and n_review>0 then warnings:=warnings||jsonb_build_array('Potential missing bookings remain counted. Binding a reviewed row to an existing booking resolves that booking; choosing new keeps the missing booking in review.');end if;
 end if;
 result:=jsonb_build_object('preview_id',pid,'expires_at',expiry,'branch',p_branch,'from',p_from,'through',p_through,'rows',output_rows,'sessions',output_sessions,'missing',missing,'warnings',warnings,
 'counts',jsonb_build_object('incoming',jsonb_array_length(p_rows),'new',n_new,'existing',n_existing,'review',n_review,'sessions',jsonb_array_length(output_sessions),'missing',jsonb_array_length(missing)),
 'existing_receipt',case when prior.id is null then null else prior.receipt||'{"already_applied":true}'::jsonb end);
 insert into fets_pearson_private.previews(id,actor_id,branch,from_date,through_date,complete,source_as_of,file_hash,content_hash,filename,source_rows,target_snapshot,preview,existing_import_id,expires_at)
 values(pid,p_actor,p_branch,p_from,p_through,p_complete,p_source_as_of,p_file_hash,canonical,p_filename,p_rows,snap,result,prior.id,expiry);
 return result;
end $$;

create function fets_pearson_private.reconcile_session(p_id bigint) returns void language plpgsql set search_path='' as $$
declare s public.calendar_sessions;n integer;c record;matches integer;
begin
 select * into s from public.calendar_sessions where id=p_id;
 if not found or upper(s.client_name) is distinct from 'PEARSON VUE' or not exists(select 1 from fets_pearson_private.sessions ps where ps.calendar_id=p_id and ps.branch=s.branch_location) then raise exception 'Managed Calendar session changed centre/provider; review its scope first';end if;
 if exists(select 1 from fets_pearson_private.memberships m join public.candidates mc on mc.id=m.candidate_id where m.calendar_id=p_id and (mc.branch_location is distinct from s.branch_location or upper(mc.client_name) is distinct from 'PEARSON VUE' or mc.pearson_calendar_session_id is distinct from p_id or mc.pearson_registration_id is null)) then raise exception 'Managed candidate membership changed scope';end if;
 select count(*) into n from fets_pearson_private.memberships where calendar_id=p_id and active;
 for c in select x.* from public.candidates x where x.pearson_registration_id is null and x.branch_location=s.branch_location and upper(x.client_name)='PEARSON VUE'
  and (x.exam_date at time zone 'Asia/Kolkata')::date=s.date and x.exam_start_time is not distinct from s.start_time
  and (x.exam_name is not distinct from s.exam_name or fets_pearson_private.has_source_exam(s.id,x.exam_name) or exists(select 1 from public.candidates mc where mc.pearson_calendar_session_id=p_id and mc.exam_name is not distinct from x.exam_name)) loop
  select count(*) into matches from fets_pearson_private.sessions ps join public.calendar_sessions cs on cs.id=ps.calendar_id
   where cs.branch_location=s.branch_location and cs.date=s.date and cs.start_time is not distinct from c.exam_start_time
   and (cs.exam_name is not distinct from c.exam_name or fets_pearson_private.has_source_exam(cs.id,c.exam_name) or exists(select 1 from public.candidates mc where mc.pearson_calendar_session_id=cs.id and mc.exam_name is not distinct from c.exam_name));
  if matches<>1 then raise exception 'Resolve ambiguous legacy Pearson membership before replacing Calendar totals';end if;
  n:=n+1;
 end loop;
 update public.calendar_sessions set candidate_count=n,updated_at=clock_timestamp() where id=p_id;
end $$;

create function fets_pearson_private.apply_core(p_preview_id uuid,p_candidate_bindings jsonb,p_session_bindings jsonb,p_actor uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 p fets_pearson_private.previews;i fets_pearson_private.imports;r jsonb;s jsonb;b jsonb;snapshot jsonb;
 resolved_rows jsonb:='[]';resolved_sessions jsonb:='[]';chosen uuid;sid bigint;new_id uuid;owner_id uuid;fallback_owner uuid;
 imported uuid:=gen_random_uuid();result_receipt jsonb;ins integer:=0;upd integer:=0;reviews integer:=0;
begin
 select * into p from fets_pearson_private.previews where id=p_preview_id for update;
 if not found or p.actor_id is distinct from p_actor then raise exception 'Preview is not available to this actor' using errcode='42501';end if;
 if p_actor is not null then perform fets_pearson_private.check_access(p.branch);end if;
 if p.applied_import_id is not null then select x.receipt into result_receipt from fets_pearson_private.imports x where x.id=p.applied_import_id;return result_receipt||'{"already_applied":true}'::jsonb;end if;
 if p.expires_at<clock_timestamp() then raise exception 'Preview expired; preview the file again';end if;
 perform fets_pearson_private.lock_scope(p.branch,p.from_date,p.through_date);
 if p_actor is not null then
  perform 1 from auth.users where id=p_actor for share;perform 1 from public.staff_profiles where user_id=p_actor for share;perform 1 from public.centre_duty_members where user_id=p_actor for share;
  perform fets_pearson_private.check_access(p.branch);
 end if;
 if p.expires_at<clock_timestamp() then raise exception 'Preview expired; preview the file again';end if;
 if p.existing_import_id is not null then
  select * into i from fets_pearson_private.imports where id=p.existing_import_id;
  update fets_pearson_private.previews set applied_import_id=i.id where id=p.id;
  return i.receipt||'{"already_applied":true}'::jsonb;
 end if;
 -- A concurrent equivalent preview can finish first: return its receipt without replaying any rows.
 select * into i from fets_pearson_private.imports where branch=p.branch and from_date=p.from_date and through_date=p.through_date and complete=p.complete and source_as_of=p.source_as_of and content_hash=p.content_hash;
 if i.id is not null then update fets_pearson_private.previews set applied_import_id=i.id where id=p.id;return i.receipt||'{"already_applied":true}'::jsonb;end if;
 perform 1 from public.calendar_sessions where branch_location=p.branch and upper(client_name)='PEARSON VUE' order by id for update;
 perform 1 from public.candidates where branch_location=p.branch and upper(client_name)='PEARSON VUE' order by id for update;
 snapshot:=fets_pearson_private.scope_snapshot(p.branch);
 if snapshot is distinct from p.target_snapshot then raise exception 'Preview is stale; candidates or Calendar changed. Preview again';end if;
 if exists(select 1 from fets_pearson_private.imports where branch=p.branch and source_as_of>p.source_as_of and from_date<=p.through_date and through_date>=p.from_date) then raise exception 'A newer source snapshot was imported';end if;
 if jsonb_typeof(p_candidate_bindings) is distinct from 'array' or jsonb_typeof(p_session_bindings) is distinct from 'array' then raise exception 'Bindings must be arrays';end if;
 if (select count(distinct value->>'source_row') from jsonb_array_elements(p_candidate_bindings))<>jsonb_array_length(p_candidate_bindings)
 or (select count(distinct value->>'group_key') from jsonb_array_elements(p_session_bindings))<>jsonb_array_length(p_session_bindings) then raise exception 'Duplicate binding keys';end if;
 for b in select value from jsonb_array_elements(p_candidate_bindings) loop
  if not (b?'candidate_id') or not exists(select 1 from jsonb_array_elements(p.preview->'rows') rv(value) where rv.value->>'source_row'=b->>'source_row') then raise exception 'Candidate binding outside preview';end if;
 end loop;
 for b in select value from jsonb_array_elements(p_session_bindings) loop
  if not (b?'calendar_id') or not exists(select 1 from jsonb_array_elements(p.preview->'sessions') rv(value) where rv.value->>'group_key'=b->>'group_key') then raise exception 'Session binding outside preview';end if;
 end loop;
 for r in select value from jsonb_array_elements(p.preview->'rows') loop
  select value into b from jsonb_array_elements(p_candidate_bindings) where value->>'source_row'=r->>'source_row';
  if r->>'match_kind'='review' and b is null then raise exception 'Resolve candidate row % before saving',r->>'source_row';end if;
  chosen:=case when b is not null then (b->>'candidate_id')::uuid else (r->>'candidate_id')::uuid end;
  if chosen is not null and not exists(select 1 from jsonb_array_elements(p.target_snapshot->'candidates') c where c->>'id'=chosen::text) then raise exception 'Candidate binding outside centre/provider snapshot';end if;
  if exists(select 1 from fets_pearson_private.memberships m where m.branch=p.branch and m.source_identity=fets_pearson_private.identity_key(r) and m.candidate_id is distinct from chosen) then raise exception 'An existing booking identity cannot be assigned to a new or different candidate';end if;
  resolved_rows:=resolved_rows||jsonb_build_array(r||jsonb_build_object('target_candidate_id',chosen));
 end loop;
 if (select count(*) from jsonb_array_elements(resolved_rows) where value->>'target_candidate_id' is not null)
 <> (select count(distinct value->>'target_candidate_id') from jsonb_array_elements(resolved_rows)) then raise exception 'Candidate bindings must be one-to-one';end if;
 for s in select value from jsonb_array_elements(p.preview->'sessions') loop
  select value into b from jsonb_array_elements(p_session_bindings) where value->>'group_key'=s->>'group_key';
  if s->>'match_kind'='review' and b is null then raise exception 'Resolve Calendar session % before saving',s->>'group_key';end if;
  sid:=case when b is not null then (b->>'calendar_id')::bigint else (s->>'calendar_id')::bigint end;
  if sid is not null and not exists(select 1 from jsonb_array_elements(p.target_snapshot->'calendar') c where (c->>'id')::bigint=sid) then raise exception 'Calendar binding outside centre/provider snapshot';end if;
  if sid is not null and exists(select 1 from public.calendar_sessions old_session where old_session.id=sid
   and (old_session.date,old_session.start_time,old_session.end_time,old_session.exam_name) is distinct from ((s->>'date')::date,(s->>'start_time')::time,(s->>'end_time')::time,s->>'exam_owner')
   and exists(select 1 from public.candidates legacy where legacy.pearson_registration_id is null and legacy.branch_location=p.branch and upper(legacy.client_name)='PEARSON VUE'
    and (legacy.exam_date at time zone 'Asia/Kolkata')::date=old_session.date and legacy.exam_start_time is not distinct from old_session.start_time
    and (lower(trim(legacy.exam_name))=lower(trim(old_session.exam_name)) or fets_pearson_private.has_source_exam(sid,legacy.exam_name) or exists(select 1 from public.candidates mc where mc.pearson_calendar_session_id=sid and lower(trim(mc.exam_name))=lower(trim(legacy.exam_name))))
    and not exists(select 1 from jsonb_array_elements(resolved_rows) rv(value) where rv.value->>'target_candidate_id'=legacy.id::text)))
   then raise exception 'Resolve all legacy/manual attendees before changing this Calendar slot';end if;
  if sid is not null and (select date from public.calendar_sessions where id=sid)<>(s->>'date')::date and not exists(
   select 1 from fets_pearson_private.memberships m join jsonb_array_elements(resolved_rows) rv(value) on rv.value->>'target_candidate_id'=m.candidate_id::text
   where m.calendar_id=sid and fets_pearson_private.group_key(rv.value)=s->>'group_key') then raise exception 'Calendar binding outside source day or an explicitly reviewed member reschedule';end if;
  if sid is not null and not p.complete and not exists(select 1 from fets_pearson_private.sessions where calendar_id=sid) and (select candidate_count from public.calendar_sessions where id=sid)>(s->>'candidate_count')::int then raise exception 'A complete snapshot is required to replace a larger legacy session total';end if;
  if sid is not null and exists(select 1 from fets_pearson_private.memberships m where m.calendar_id=sid and m.active and m.group_key<>s->>'group_key'
    and not exists(select 1 from jsonb_array_elements(resolved_rows) rv(value) where rv.value->>'target_candidate_id'=m.candidate_id::text)) then raise exception 'Calendar session still has other active memberships; keep or review them';end if;
  resolved_sessions:=resolved_sessions||jsonb_build_array(s||jsonb_build_object('target_calendar_id',sid));
 end loop;
 if (select count(*) from jsonb_array_elements(resolved_sessions) where value->>'target_calendar_id' is not null)
 <> (select count(distinct value->>'target_calendar_id') from jsonb_array_elements(resolved_sessions)) then raise exception 'Calendar bindings must be one-to-one';end if;
 -- A trusted operator does not impersonate a user. Prefer an existing bound calendar owner;
 -- the canonical active verified SuperAdmin is only a fallback for genuinely new sessions.
 select x.user_id into fallback_owner from public.calendar_sessions x where x.id in (select (value->>'target_calendar_id')::bigint from jsonb_array_elements(resolved_sessions)) and x.user_id is not null order by x.id limit 1;
 if fallback_owner is null then
  select sp.user_id into fallback_owner from public.staff_profiles sp join auth.users u on u.id=sp.user_id where sp.role='super_admin' and sp.is_active and coalesce(sp.status,'active')='active'
   and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<statement_timestamp()) order by sp.user_id limit 1;
 end if;
 if coalesce(p_actor,fallback_owner) is null then raise exception 'An existing Calendar owner or verified administrator is required for the operational import';end if;
 insert into fets_pearson_private.imports(id,actor_id,branch,from_date,through_date,complete,source_as_of,file_hash,content_hash,filename,source_rows)
 values(imported,p_actor,p.branch,p.from_date,p.through_date,p.complete,p.source_as_of,p.file_hash,p.content_hash,p.filename,p.source_rows);
 -- Bind sessions before touching candidates, so transition-table sync cannot create generic duplicates.
 for s in select value from jsonb_array_elements(resolved_sessions) order by value->>'group_key' loop
  sid:=(s->>'target_calendar_id')::bigint;
  if sid is null then
   insert into public.calendar_sessions(client_name,exam_name,date,branch_location,start_time,end_time,candidate_count,user_id,status)
   values('PEARSON VUE',s->>'exam_owner',(s->>'date')::date,p.branch,(s->>'start_time')::time,(s->>'end_time')::time,0,coalesce(p_actor,fallback_owner),'scheduled') returning id into sid;
  else
   update public.calendar_sessions set exam_name=s->>'exam_owner',date=(s->>'date')::date,start_time=(s->>'start_time')::time,end_time=(s->>'end_time')::time,updated_at=clock_timestamp() where id=sid;
  end if;
  -- Remove the old key only when the full prior session was explicitly rebound.
  delete from fets_pearson_private.sessions where calendar_id=sid and group_key<>s->>'group_key';
  if exists(select 1 from fets_pearson_private.sessions where branch=p.branch and group_key=s->>'group_key' and calendar_id<>sid) then raise exception 'This source group is already assigned to a different Calendar session';end if;
  insert into fets_pearson_private.sessions as stored(calendar_id,branch,group_key,import_id,exam_aliases) values(sid,p.branch,s->>'group_key',imported,
   array(select distinct title from (
    select rr.value->>'exam_title' title from jsonb_array_elements(resolved_rows) rr(value) where fets_pearson_private.group_key(rr.value)=s->>'group_key'
    union select s->>'exam_owner'
    union select old_slot.value->>'exam_name' from jsonb_array_elements(p.target_snapshot->'calendar') old_slot(value) where (old_slot.value->>'id')::bigint=sid
   ) aliases where title is not null))
   on conflict(calendar_id) do update set group_key=excluded.group_key,import_id=excluded.import_id,exam_aliases=array(select distinct alias from unnest(stored.exam_aliases||excluded.exam_aliases) names(alias)),updated_at=clock_timestamp();
  resolved_sessions:=jsonb_set(resolved_sessions,array[(select (ord-1)::text from jsonb_array_elements(resolved_sessions) with ordinality x(v,ord) where v->>'group_key'=s->>'group_key')],s||jsonb_build_object('target_calendar_id',sid));
 end loop;
 -- Adopt/update the whole existing source set in one statement. Otherwise a first
 -- legacy row could trigger a generic old-label session while another row in its
 -- old group was still unmanaged, after the reviewed Calendar had been retimed.
 update public.candidates c set
  full_name=rr.value->>'full_name',phone=case when nullif(trim(c.phone),'') is null then nullif(rr.value->>'phone','') else c.phone end,
  email=nullif(rr.value->>'email',''),exam_code=rr.value->>'exam_code',exam_title=rr.value->>'exam_title',exam_owner=rr.value->>'exam_owner',
  exam_end_time=(rr.value->>'end_time')::time,pearson_source_phone=rr.value->>'phone',pearson_registration_id=coalesce(c.pearson_registration_id,c.id),
  pearson_calendar_session_id=(ss.value->>'target_calendar_id')::bigint,exam_start_time=(rr.value->>'start_time')::time,exam_name=rr.value->>'exam_title',
  exam_date=(rr.value->>'date')::timestamp at time zone 'Asia/Kolkata',status=case when m.active=false and c.status='cancelled' then 'registered' else c.status end,
  source='upload',updated_at=clock_timestamp()
 from jsonb_array_elements(resolved_rows) rr(value)
 join jsonb_array_elements(resolved_sessions) ss(value) on ss.value->>'group_key'=fets_pearson_private.group_key(rr.value)
 left join fets_pearson_private.memberships m on m.candidate_id=(rr.value->>'target_candidate_id')::uuid
 where c.id=(rr.value->>'target_candidate_id')::uuid;
 get diagnostics upd=row_count;
 for r in select value from jsonb_array_elements(resolved_rows) order by (value->>'source_row')::int loop
  chosen:=(r->>'target_candidate_id')::uuid;
  select (value->>'target_calendar_id')::bigint into sid from jsonb_array_elements(resolved_sessions) where value->>'group_key'=fets_pearson_private.group_key(r);
  select coalesce(user_id,p_actor,fallback_owner) into owner_id from public.calendar_sessions where id=sid;
  if chosen is null then
   new_id:=gen_random_uuid();
   insert into public.candidates(id,full_name,phone,email,exam_code,exam_title,exam_owner,exam_end_time,pearson_source_phone,pearson_registration_id,pearson_calendar_session_id,
    exam_start_time,client_name,exam_name,exam_date,branch_location,status,source,user_id,confirmation_number)
   values(new_id,r->>'full_name',nullif(r->>'phone',''),nullif(r->>'email',''),r->>'exam_code',r->>'exam_title',r->>'exam_owner',(r->>'end_time')::time,r->>'phone',new_id,sid,
    (r->>'start_time')::time,'PEARSON VUE',r->>'exam_title',(r->>'date')::timestamp at time zone 'Asia/Kolkata',p.branch,'registered','upload',owner_id,'FETS-'||new_id::text);
   chosen:=new_id;ins:=ins+1;
  end if;
  insert into fets_pearson_private.memberships(candidate_id,calendar_id,branch,group_key,active,source_identity,source_row,import_id)
  values(chosen,sid,p.branch,fets_pearson_private.group_key(r),true,fets_pearson_private.identity_key(r),r-array['candidate_id','match_kind','possible_candidates','changes','target_candidate_id'],imported)
  on conflict(candidate_id) do update set calendar_id=excluded.calendar_id,group_key=excluded.group_key,active=true,source_identity=excluded.source_identity,source_row=excluded.source_row,import_id=excluded.import_id,updated_at=clock_timestamp();
  update fets_pearson_private.cancellation_reviews set status='reappeared',updated_at=clock_timestamp() where candidate_id=chosen and status='pending';
 end loop;
 if p.complete then
  insert into fets_pearson_private.cancellation_reviews(candidate_id,branch,import_id,candidate_snapshot)
  select c.id,p.branch,imported,to_jsonb(c) from fets_pearson_private.memberships m join public.candidates c on c.id=m.candidate_id
  where m.branch=p.branch and m.active and m.import_id<>imported and (c.exam_date at time zone 'Asia/Kolkata')::date between greatest(p.from_date,p.source_as_of,(clock_timestamp() at time zone 'Asia/Kolkata')::date) and p.through_date
   and (c.exam_date at time zone 'Asia/Kolkata')::date+coalesce(c.exam_start_time,'00:00'::time)>(clock_timestamp() at time zone 'Asia/Kolkata')
  on conflict(candidate_id) where status='pending' do nothing;
  get diagnostics reviews=row_count;
 end if;
 -- Counts are replacements over explicit active memberships, including pending missing bookings.
 for sid in select (value->>'target_calendar_id')::bigint from jsonb_array_elements(resolved_sessions)
 union select (old_member.value->>'calendar_id')::bigint from jsonb_array_elements(p.target_snapshot->'memberships') old_member(value)
  where exists(select 1 from jsonb_array_elements(resolved_rows) rr(value) where rr.value->>'target_candidate_id'=old_member.value->>'candidate_id')
 order by 1 loop perform fets_pearson_private.reconcile_session(sid);end loop;
 result_receipt:=jsonb_build_object('import_id',imported,'saved',jsonb_array_length(p.source_rows),'inserted',ins,'updated',upd,'sessions',jsonb_array_length(resolved_sessions),'cancellation_reviews',reviews,'already_applied',false,'file_hash',p.file_hash);
 update fets_pearson_private.imports set receipt=result_receipt where id=imported;
 update fets_pearson_private.previews set applied_import_id=imported where id=p.id;
 insert into fets_pearson_private.audit(import_id,actor_id,action,before_snapshot,after_snapshot) values(imported,p_actor,case when p_actor is null then 'operational_import' else 'staff_import' end,p.target_snapshot,fets_pearson_private.scope_snapshot(p.branch));
 return result_receipt;
end $$;

create function fets_pearson_private.preview_checked(p_branch text,p_from date,p_through date,p_complete boolean,p_source_as_of date,p_file_hash text,p_filename text,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform fets_pearson_private.check_access(p_branch);
 return fets_pearson_private.preview_core(p_branch,p_from,p_through,p_complete,p_source_as_of,p_file_hash,p_filename,p_rows,auth.uid());
end $$;
create function fets_pearson_private.apply_checked(p_preview_id uuid,p_candidate_bindings jsonb,p_session_bindings jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b text;
begin
 select branch into b from fets_pearson_private.previews where id=p_preview_id and actor_id=auth.uid();
 perform fets_pearson_private.check_access(b);
 return fets_pearson_private.apply_core(p_preview_id,p_candidate_bindings,p_session_bindings,auth.uid());
end $$;
create function fets_pearson_private.list_checked(p_branch text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform fets_pearson_private.check_access(p_branch);
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'candidate_id',c.id,'full_name',c.full_name,'date',(c.exam_date at time zone 'Asia/Kolkata')::date,
  'start_time',c.exam_start_time,'exam_code',c.exam_code,'status',r.status,'updated_at',greatest(r.updated_at,c.updated_at),'has_progress',fets_pearson_private.has_progress(to_jsonb(c))) order by c.exam_date,c.id),'[]') into result
 from fets_pearson_private.cancellation_reviews r join public.candidates c on c.id=r.candidate_id where r.branch=p_branch and r.status='pending';
 return result;
end $$;
create function fets_pearson_private.decide_checked(p_review_id uuid,p_decision text,p_expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r fets_pearson_private.cancellation_reviews;c public.candidates;before_state jsonb;after_state jsonb;b text;day date;sid bigint;
begin
 if p_decision is null or p_decision not in ('cancel','keep') or p_expected_updated_at is null then raise exception 'Choose cancel or keep and the current review version';end if;
 select branch into b from fets_pearson_private.cancellation_reviews where id=p_review_id;
 perform fets_pearson_private.check_access(b);
 -- Same lock order as apply: days, review and then candidate.
 perform fets_pearson_private.lock_scope(b,null,null);
 perform 1 from auth.users where id=auth.uid() for share;perform 1 from public.staff_profiles where user_id=auth.uid() for share;perform 1 from public.centre_duty_members where user_id=auth.uid() for share;
 perform fets_pearson_private.check_access(b);
 perform 1 from public.calendar_sessions cs join fets_pearson_private.memberships m on m.calendar_id=cs.id join fets_pearson_private.cancellation_reviews rv on rv.candidate_id=m.candidate_id where rv.id=p_review_id order by cs.id for update of cs;
 select * into r from fets_pearson_private.cancellation_reviews where id=p_review_id for update;
 select * into c from public.candidates where id=r.candidate_id for update;
 if r.status<>'pending' or p_expected_updated_at is distinct from greatest(r.updated_at,c.updated_at) then raise exception 'Cancellation review is stale; refresh before deciding';end if;
 if c.branch_location<>b or upper(c.client_name)<>'PEARSON VUE' then raise exception 'Candidate is outside the review centre/provider';end if;
 if p_decision='cancel' and fets_pearson_private.has_progress(to_jsonb(c)) then raise exception 'A booking with operational progress cannot be cancelled by import review';end if;
 before_state:=jsonb_build_object('review',to_jsonb(r),'candidate',to_jsonb(c));
 if p_decision='cancel' then
  update fets_pearson_private.memberships set active=false,updated_at=clock_timestamp() where candidate_id=c.id returning calendar_id into sid;
  update public.candidates set status='cancelled',updated_at=clock_timestamp() where id=c.id;
  perform fets_pearson_private.reconcile_session(sid);
 end if;
 update fets_pearson_private.cancellation_reviews set status=p_decision,decision_actor=auth.uid(),updated_at=clock_timestamp() where id=r.id;
 select jsonb_build_object('review',to_jsonb(rv),'candidate',to_jsonb(ca)) into after_state from fets_pearson_private.cancellation_reviews rv join public.candidates ca on ca.id=rv.candidate_id where rv.id=r.id;
 insert into fets_pearson_private.audit(import_id,actor_id,action,before_snapshot,after_snapshot) values(r.import_id,auth.uid(),'cancellation_'||p_decision,before_state,after_state);
 return jsonb_build_object('review_id',r.id,'decision',p_decision,'candidate_id',c.id);
end $$;

-- This predicate exposes only a membership bit, enabling the invoker's legacy sync to
-- avoid managed sessions without granting any private source/history table access.
create function fets_pearson_private.is_managed_session(p_id bigint) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from fets_pearson_private.sessions where calendar_id=p_id)
$$;

-- Retain only reviewed exam labels, including the previous bound display label.
-- This keeps a manual attendee associated with its original slot after the last
-- imported attendee reschedules elsewhere; it is never a guessed provider alias.
create function fets_pearson_private.has_source_exam(p_id bigint,p_exam text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from fets_pearson_private.sessions where calendar_id=p_id and p_exam=any(exam_aliases))
$$;

-- Imported schedule/source columns are owned by the reviewed engine. Staff can still
-- change notes, locker and operational progress through the existing tracker.
create function fets_pearson_private.guard_managed_candidate() returns trigger language plpgsql security invoker set search_path='' as $$
declare owner_name text;
begin
 select pg_get_userbyid(c.relowner) into owner_name from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='fets_pearson_private' and c.relname='imports';
 if current_user=owner_name then if tg_op='DELETE' then return old;else return new;end if;end if;
 if tg_op='DELETE' then
  if old.pearson_registration_id is not null then raise exception 'Use Pearson cancellation review to preserve booking history';end if;return old;
 end if;
 if tg_op='INSERT' then
  if new.pearson_registration_id is not null or new.pearson_calendar_session_id is not null then raise exception 'Pearson membership is assigned by the reviewed importer';end if;return new;
 end if;
 if new.pearson_registration_id is distinct from old.pearson_registration_id or new.pearson_calendar_session_id is distinct from old.pearson_calendar_session_id
 or (old.pearson_registration_id is not null and (
  (to_jsonb(new)-array['phone','address','status','check_in_time','check_out_time','locker_key','notes','updated_at','completed_at','attendance_status','exam_status','photo_url','id_proof','id_proof_type','id_proof_number'])
  is distinct from (to_jsonb(old)-array['phone','address','status','check_in_time','check_out_time','locker_key','notes','updated_at','completed_at','attendance_status','exam_status','photo_url','id_proof','id_proof_type','id_proof_number'])
  or (new.status='cancelled' and old.status is distinct from 'cancelled') or (old.status='cancelled' and new.status is distinct from old.status))) then raise exception 'Update imported source or cancel through the Pearson reviewed importer';end if;
 return new;
end $$;
create trigger candidates_pearson_source_guard before insert or update or delete on public.candidates for each row execute function fets_pearson_private.guard_managed_candidate();

-- Direct Calendar writes must participate too: locking existing targets alone cannot
-- protect a preview against inserts into an otherwise empty source slot. The trigger
-- only locks Pearson old/new days; it never changes another provider's data or access.
create function fets_pearson_private.lock_calendar_write() returns trigger language plpgsql security invoker set search_path='' as $$
declare affected jsonb:='[]';d record;
begin
 if tg_op<>'INSERT' and upper(old.client_name)='PEARSON VUE' then affected:=affected||jsonb_build_array(jsonb_build_object('branch',old.branch_location,'day',old.date));end if;
 if tg_op<>'DELETE' and upper(new.client_name)='PEARSON VUE' then affected:=affected||jsonb_build_array(jsonb_build_object('branch',new.branch_location,'day',new.date));end if;
 for d in select distinct value->>'branch' branch,value->>'day' as day from jsonb_array_elements(affected) where value->>'branch' in ('cochin','calicut') and value->>'day' is not null order by 1,2 loop
  perform pg_advisory_xact_lock(hashtextextended(d.branch||':'||d.day,73109));
 end loop;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
create trigger calendar_pearson_day_lock before insert or update or delete on public.calendar_sessions for each row execute function fets_pearson_private.lock_calendar_write();

-- Preserve invoker/RLS semantics for the old daily/manual importer. Managed Pearson
-- rows never create generic title/start groups, including colliding end times.
create or replace function fets_roster_private.sync_changed_roster() returns trigger language plpgsql security invoker set search_path='' as $$
declare g record;query_text text;
begin
 if tg_op='INSERT' then query_text:='select * from roster_new';
 elsif tg_op='DELETE' then query_text:='select * from roster_old';
 else query_text:='select * from roster_new union all select * from roster_old';end if;
 for g in execute 'select distinct (exam_date at time zone ''Asia/Kolkata'')::date as day,branch_location,upper(client_name) as client,exam_name,exam_start_time from ('||query_text||') r where pearson_registration_id is null order by branch_location,day,client,exam_name,exam_start_time' loop
  perform fets_roster_private.sync_group(g.day,g.branch_location,g.client,g.exam_name,g.exam_start_time);
 end loop;return null;
end $$;
create or replace function fets_roster_private.sync_group(p_day date,p_branch text,p_client text,p_exam text,p_start time)
returns void language plpgsql security invoker set search_path='' as $$
declare n integer;target_id bigint;expected integer;changed integer;duration interval;
begin
 if p_day is null or p_branch not in ('calicut','cochin') or nullif(trim(p_client),'') is null then return;end if;
 perform pg_advisory_xact_lock(hashtextextended(p_branch||':'||p_day::text,73109));
 if upper(p_client)='PEARSON VUE' then
  select min(s.id),count(*) into target_id,expected from public.calendar_sessions s
   where s.branch_location=p_branch and s.date=p_day and upper(s.client_name)='PEARSON VUE' and s.start_time is not distinct from p_start
   and fets_pearson_private.is_managed_session(s.id) and (s.exam_name is not distinct from p_exam or fets_pearson_private.has_source_exam(s.id,p_exam) or exists(select 1 from public.candidates c where c.pearson_calendar_session_id=s.id and c.exam_name is not distinct from p_exam));
  if expected>1 then
   if not exists(select 1 from public.candidates c where c.pearson_registration_id is null and c.branch_location=p_branch and (c.exam_date at time zone 'Asia/Kolkata')::date=p_day and upper(c.client_name)='PEARSON VUE' and c.exam_start_time is not distinct from p_start and c.exam_name is not distinct from p_exam) then return;end if;
   raise exception 'Pearson appointment end times are ambiguous; use the monthly reviewed importer';
  end if;
  if target_id is not null then
   select count(*) into n from public.candidates c where c.pearson_calendar_session_id=target_id and c.pearson_registration_id is not null and coalesce(c.status,'registered')<>'cancelled';
   select n+count(*) into n from public.candidates c where c.pearson_registration_id is null and c.branch_location=p_branch and (c.exam_date at time zone 'Asia/Kolkata')::date=p_day
    and upper(c.client_name)='PEARSON VUE' and c.exam_start_time is not distinct from p_start
    and (c.exam_name is not distinct from (select exam_name from public.calendar_sessions where id=target_id) or fets_pearson_private.has_source_exam(target_id,c.exam_name) or exists(select 1 from public.candidates mc where mc.pearson_calendar_session_id=target_id and mc.exam_name is not distinct from c.exam_name));
   update public.calendar_sessions set candidate_count=n,updated_at=now() where id=target_id;
   get diagnostics changed=row_count;if changed<>1 then raise exception 'Your centre access does not allow updating this Calendar session';end if;return;
  end if;
 end if;
 select count(*) into n from public.candidates c where c.branch_location=p_branch and (c.exam_date at time zone 'Asia/Kolkata')::date=p_day
  and upper(c.client_name)=upper(p_client) and c.exam_name is not distinct from p_exam and c.exam_start_time is not distinct from p_start and c.pearson_registration_id is null;
 select min(s.id),count(*) into target_id,expected from public.calendar_sessions s where s.branch_location=p_branch and s.date=p_day and upper(s.client_name)=upper(p_client)
  and s.exam_name is not distinct from p_exam and s.start_time is not distinct from p_start and not fets_pearson_private.is_managed_session(s.id);
 if target_id is not null then
  update public.calendar_sessions s set candidate_count=case when s.id=target_id then n else 0 end,updated_at=now() where s.branch_location=p_branch and s.date=p_day and upper(s.client_name)=upper(p_client)
   and s.exam_name is not distinct from p_exam and s.start_time is not distinct from p_start and not fets_pearson_private.is_managed_session(s.id);
  get diagnostics changed=row_count;if changed<>expected then raise exception 'Your centre access does not allow updating these Calendar sessions';end if;
 elsif n>0 then
  select s.end_time-s.start_time into duration from public.calendar_sessions s where upper(s.client_name)=upper(p_client) and s.exam_name is not distinct from p_exam
   and s.end_time>s.start_time and coalesce(s.status,'scheduled')<>'cancelled' order by (s.branch_location=p_branch) desc,s.date desc,s.id desc limit 1;
  insert into public.calendar_sessions(client_name,exam_name,date,branch_location,start_time,end_time,candidate_count,user_id,status)
   values(upper(p_client),p_exam,p_day,p_branch,p_start,p_start+coalesce(duration,interval '0'),n,auth.uid(),'scheduled');
 end if;
end $$;

create function public.preview_pearson_roster(p_branch text,p_from date,p_through date,p_complete boolean,p_source_as_of date,p_file_hash text,p_filename text,p_rows jsonb)
returns jsonb language sql security invoker set search_path='' as $$select fets_pearson_private.preview_checked(p_branch,p_from,p_through,p_complete,p_source_as_of,p_file_hash,p_filename,p_rows)$$;
create function public.apply_pearson_roster(p_preview_id uuid,p_candidate_bindings jsonb,p_session_bindings jsonb)
returns jsonb language sql security invoker set search_path='' as $$select fets_pearson_private.apply_checked(p_preview_id,p_candidate_bindings,p_session_bindings)$$;
create function public.list_pearson_cancellation_reviews(p_branch text)
returns jsonb language sql security invoker set search_path='' as $$select fets_pearson_private.list_checked(p_branch)$$;
create function public.decide_pearson_cancellation(p_review_id uuid,p_decision text,p_expected_updated_at timestamptz)
returns jsonb language sql security invoker set search_path='' as $$select fets_pearson_private.decide_checked(p_review_id,p_decision,p_expected_updated_at)$$;
revoke all on all tables in schema fets_pearson_private from public,anon,authenticated,service_role;
revoke all on all sequences in schema fets_pearson_private from public,anon,authenticated,service_role;
revoke all on all functions in schema fets_pearson_private from public,anon,authenticated,service_role;
grant execute on function fets_pearson_private.preview_checked(text,date,date,boolean,date,text,text,jsonb),fets_pearson_private.apply_checked(uuid,jsonb,jsonb),fets_pearson_private.list_checked(text),fets_pearson_private.decide_checked(uuid,text,timestamptz) to authenticated;
grant usage on schema fets_pearson_private to service_role;
grant execute on function fets_pearson_private.is_managed_session(bigint),fets_pearson_private.has_source_exam(bigint,text) to authenticated,service_role;
revoke all on function public.preview_pearson_roster(text,date,date,boolean,date,text,text,jsonb),public.apply_pearson_roster(uuid,jsonb,jsonb),public.list_pearson_cancellation_reviews(text),public.decide_pearson_cancellation(uuid,text,timestamptz) from public,anon,service_role;
grant execute on function public.preview_pearson_roster(text,date,date,boolean,date,text,text,jsonb),public.apply_pearson_roster(uuid,jsonb,jsonb),public.list_pearson_cancellation_reviews(text),public.decide_pearson_cancellation(uuid,text,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;
