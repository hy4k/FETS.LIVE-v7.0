-- Additive, private Prometric institute outreach. Does not write legacy business records.
create schema fets_outreach_private;
revoke all on schema fets_outreach_private from public,anon,authenticated,service_role;
grant usage on schema fets_outreach_private to authenticated;

create table fets_outreach_private.institutes (
 id uuid primary key default gen_random_uuid(),name text not null,city text not null,state text not null,
 contact_name text not null,contact_role text not null,phone text not null,email text not null,website text not null,
 preferred_centre text not null check(preferred_centre in ('cochin','calicut','undecided')),
 owner_user_id uuid not null references auth.users(id),
 stage text not null check(stage in ('new','contacted','understanding_needs','interested','planning','active_partner','paused','closed')),
 contact_permission text not null check(contact_permission in ('not_asked','allowed','do_not_contact')),
 interest text not null default 'not_discussed' check(interest in ('not_discussed','centre_mock','platform','both','none')),
 notes text not null,last_contact_at timestamptz,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 check(length(name) between 1 and 200 and length(city) between 1 and 120),check(phone<>'' or email<>'')
);
create unique index outreach_unique_institute on fets_outreach_private.institutes(lower(regexp_replace(btrim(name),'\s+',' ','g')),lower(regexp_replace(btrim(city),'\s+',' ','g')));
create index outreach_owner on fets_outreach_private.institutes(owner_user_id);
create table fets_outreach_private.calls (
 id uuid primary key default gen_random_uuid(),institute_id uuid not null references fets_outreach_private.institutes(id),
 actor_user_id uuid not null references auth.users(id),actor_name text not null,request_id uuid not null unique,request_hash text not null,
 occurred_at timestamptz not null,channel text not null check(channel in ('phone','meeting','email','whatsapp','inbound','note')),
 outcome text not null check(outcome in ('not_reached','wrong_contact','callback_requested','feedback_received','interested','not_interested','do_not_contact','permission_update')),
 contact_name text not null,contact_role text not null,summary text not null,answers jsonb not null,concerns jsonb not null,
 interest text not null check(interest in ('not_discussed','centre_mock','platform','both','none')),
 follow_up_permission text not null check(follow_up_permission in ('not_asked','allowed','do_not_contact')),
 advisory_interest text not null check(advisory_interest in ('not_asked','yes','no')),close_reason text not null,
 response_institute jsonb not null,created_at timestamptz not null default clock_timestamp()
);
create index outreach_call_cursor on fets_outreach_private.calls(institute_id,occurred_at desc,id desc);
create table fets_outreach_private.followups (
 id uuid primary key default gen_random_uuid(),institute_id uuid not null references fets_outreach_private.institutes(id),call_id uuid references fets_outreach_private.calls(id),
 kind text not null check(kind in ('retry_contact','requested_callback','send_information','arrange_mock','platform_discussion','internal_review','confirm_attendance')),
 title text not null,due_at timestamptz not null,status text not null check(status in ('open','done','cancelled')),
 completion_note text not null default '',created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp()
);
create unique index outreach_one_open_step on fets_outreach_private.followups(institute_id) where status='open';
create table fets_outreach_private.batches (
 id uuid primary key default gen_random_uuid(),institute_id uuid not null references fets_outreach_private.institutes(id),name text not null,
 delivery text not null check(delivery in ('fets_centre','institute_platform')),centre text,planned_date date,
 status text not null check(status in ('potential','confirmed','completed','cancelled')),
 estimated integer not null check(estimated between 0 and 10000),confirmed integer not null check(confirmed between 0 and 10000),attended integer not null check(attended between 0 and 10000),
 notes text not null,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 check((delivery='fets_centre' and centre in ('cochin','calicut')) or (delivery='institute_platform' and centre is null)),
 check(delivery<>'fets_centre' or centre is not null),check(attended<=confirmed),check(status='completed' or attended=0),
 check(status<>'potential' or (confirmed=0 and attended=0)),check(status not in ('confirmed','completed') or planned_date is not null)
);
-- NULL planned dates also identify the same potential cohort. A centre change is a cohort update, not a second count.
create unique index outreach_unique_batch on fets_outreach_private.batches(institute_id,lower(regexp_replace(btrim(name),'\s+',' ','g')),delivery,coalesce(planned_date,'0001-01-01'::date));
create table fets_outreach_private.institute_changes (
 id uuid primary key default gen_random_uuid(),institute_id uuid not null references fets_outreach_private.institutes(id),actor_user_id uuid not null references auth.users(id),
 reason text not null,before_record jsonb,after_record jsonb not null,created_at timestamptz not null default clock_timestamp()
);

-- Canonical, verified active membership; never consult editable JWT metadata.
create function fets_outreach_private.eligible(p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select fets_ai_private.member_active(p_user,null) and exists(
 select 1 from public.staff_profiles p where p.user_id=p_user and (p.role='super_admin' or (
 p.permissions->'actionables' is distinct from 'false'::jsonb and p.permissions->'ws_actionables' is distinct from 'false'::jsonb and exists(
 select 1 from fets_actionables_private.members m where m.user_id=p.user_id and m.profile_id=p.id and m.enabled is true))))
$$;
create function fets_outreach_private.authority() returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not fets_outreach_private.eligible(auth.uid()) or not fets_ai_private.permitted('actionables',null) then
 raise exception 'Verified active Actionables access required' using errcode='42501';end if;
 return exists(select 1 from public.staff_profiles p where p.user_id=auth.uid() and (p.role in ('admin','manager','super_admin') or exists(select 1 from fets_actionables_private.members m where m.user_id=p.user_id and m.profile_id=p.id and m.enabled and m.project_role='manager')));
end $$;
-- Lock actor and proposed owner authority before waiting for any institute row. Recheck after every wait.
-- SHARE locks conflict with revocation UPDATE/DELETE, including non-key permission changes.
create function fets_outreach_private.lock_authority(p_target uuid default null) returns boolean
language plpgsql volatile security definer set search_path='' as $$
begin
 perform u.id from auth.users u where u.id=auth.uid() or u.id=p_target order by u.id for share;
 perform p.id from public.staff_profiles p where p.user_id=auth.uid() or p.user_id=p_target order by p.user_id,p.id for share;
 perform m.user_id from public.centre_duty_members m where m.user_id=auth.uid() or m.user_id=p_target order by m.user_id,m.profile_id,m.branch for share;
 perform m.user_id from fets_actionables_private.members m where m.user_id=auth.uid() or m.user_id=p_target order by m.user_id for share;
 return fets_outreach_private.authority();
end $$;
create function fets_outreach_private.check_scope(p_owner uuid,p_manager boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not p_manager and p_owner is distinct from auth.uid() then raise exception 'Institute owner access required; reload after reassignment' using errcode='42501';end if;
end $$;
create function fets_outreach_private.object(p jsonb,keys text[]) returns void
language plpgsql immutable set search_path='' as $$
begin
 if jsonb_typeof(p) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p) k where not(k=any(keys))) or exists(select 1 from unnest(keys) k where not(p?k)) then raise exception 'Invalid payload: missing or unknown keys' using errcode='22023';end if;
end $$;
create function fets_outreach_private.txt(p jsonb,k text,max_length integer,required boolean default false) returns text
language plpgsql immutable set search_path='' as $$
declare v text;
begin
 if jsonb_typeof(p->k) is distinct from 'string' then raise exception 'Invalid text field: %',k using errcode='22023';end if;
 v:=btrim(p->>k);if length(v)>max_length or (required and v='') or v ~ '[\x00-\x08\x0B\x0C\x0E-\x1F]' then raise exception 'Invalid text length or content: %',k using errcode='22023';end if;return v;
end $$;
create function fets_outreach_private.choice(p jsonb,k text,choices text[]) returns text
language plpgsql immutable set search_path='' as $$
declare v text;
begin v:=fets_outreach_private.txt(p,k,80,true);if not(v=any(choices)) then raise exception 'Invalid choice: %',k using errcode='22023';end if;return v;end $$;
create function fets_outreach_private.uid(p jsonb,k text,nullable boolean default false) returns uuid
language plpgsql immutable set search_path='' as $$
begin if nullable and p->k='null'::jsonb then return null;end if;return fets_outreach_private.txt(p,k,36,true)::uuid;end $$;
create function fets_outreach_private.instant(p jsonb,k text,nullable boolean default false) returns timestamptz
language plpgsql immutable set search_path='' as $$
declare v text;t timestamptz;
begin
 if nullable and p->k='null'::jsonb then return null;end if;
 v:=fets_outreach_private.txt(p,k,50,true);if v !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$' then raise exception 'Explicit ISO timestamp required: %',k using errcode='22023';end if;
 t:=v::timestamptz;if not isfinite(t) then raise exception 'Finite timestamp required' using errcode='22023';end if;return t;
end $$;
create function fets_outreach_private.number(p jsonb,k text,nullable boolean default false) returns integer
language plpgsql immutable set search_path='' as $$
declare v numeric;
begin if nullable and p->k='null'::jsonb then return null;end if;if jsonb_typeof(p->k) is distinct from 'number' then raise exception 'Integer required: %',k using errcode='22023';end if;v:=(p->>k)::numeric;if v<0 or v>10000 or trunc(v)<>v then raise exception 'Whole count 0..10000 required: %',k using errcode='22023';end if;return v::integer;end $$;
create function fets_outreach_private.institute_json(i fets_outreach_private.institutes) returns jsonb language sql immutable set search_path='' as $$select to_jsonb(i)$$;
create function fets_outreach_private.call_json(c fets_outreach_private.calls) returns jsonb language sql immutable set search_path='' as $$select to_jsonb(c)-array['request_id','request_hash','response_institute']$$;

create function fets_outreach_private.context() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare manager boolean;
begin
 manager:=fets_outreach_private.authority();
 return jsonb_build_object('viewer',jsonb_build_object('user_id',auth.uid(),'can_manage',manager),
 'staff',coalesce((select jsonb_agg(jsonb_build_object('user_id',p.user_id,'full_name',coalesce(p.full_name,'Staff')) order by p.full_name,p.user_id) from public.staff_profiles p where (manager or p.user_id=auth.uid()) and fets_outreach_private.eligible(p.user_id)),'[]'::jsonb),
 'institutes',coalesce((select jsonb_agg(to_jsonb(i) order by i.name,i.id) from fets_outreach_private.institutes i where manager or i.owner_user_id=auth.uid()),'[]'::jsonb),
 'followups',coalesce((select jsonb_agg(to_jsonb(f) order by f.due_at,f.id) from fets_outreach_private.followups f join fets_outreach_private.institutes i on i.id=f.institute_id where manager or i.owner_user_id=auth.uid()),'[]'::jsonb),
 'batches',coalesce((select jsonb_agg(to_jsonb(b) order by b.created_at,b.id) from fets_outreach_private.batches b join fets_outreach_private.institutes i on i.id=b.institute_id where manager or i.owner_user_id=auth.uid()),'[]'::jsonb));
end $$;
create function fets_outreach_private.detail(p_institute_id uuid,p_before timestamptz default null,p_before_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare manager boolean;i fets_outreach_private.institutes;page jsonb;more boolean;cursor_at timestamptz;cursor_id uuid;
begin
 manager:=fets_outreach_private.authority();select * into i from fets_outreach_private.institutes where id=p_institute_id;
 if not found then raise exception 'Institute unavailable or access denied' using errcode='42501';end if;perform fets_outreach_private.check_scope(i.owner_user_id,manager);
 if (p_before is null)<>(p_before_id is null) or (p_before is not null and not isfinite(p_before)) then raise exception 'Invalid history cursor' using errcode='22023';end if;
 select coalesce(jsonb_agg(fets_outreach_private.call_json(c) order by c.occurred_at desc,c.id desc),'[]'::jsonb) into page from (select * from fets_outreach_private.calls where institute_id=i.id and (p_before is null or (occurred_at,id)<(p_before,p_before_id)) order by occurred_at desc,id desc limit 50) c;
 select occurred_at,id into cursor_at,cursor_id from fets_outreach_private.calls where institute_id=i.id and (p_before is null or (occurred_at,id)<(p_before,p_before_id)) order by occurred_at desc,id desc offset 49 limit 1;
 more:=cursor_id is not null and exists(select 1 from fets_outreach_private.calls where institute_id=i.id and (occurred_at,id)<(cursor_at,cursor_id));
 return jsonb_build_object('institute',to_jsonb(i),'calls',page,'has_more',more,'next_cursor',case when more then jsonb_build_object('at',cursor_at,'id',cursor_id) else null end,
 'followups',coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at,f.id) from fets_outreach_private.followups f where institute_id=i.id),'[]'::jsonb),
 'batches',coalesce((select jsonb_agg(to_jsonb(b) order by b.created_at,b.id) from fets_outreach_private.batches b where institute_id=i.id),'[]'::jsonb));
end $$;

create function fets_outreach_private.save_institute(p_payload jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare p jsonb:=p_payload;i fets_outreach_private.institutes;old_i fets_outreach_private.institutes;manager boolean;target uuid;record_id uuid;expected timestamptz;reason text;stamp timestamptz;
begin
 perform fets_outreach_private.object(p,array['id','expected_updated_at','name','city','state','contact_name','contact_role','phone','email','website','preferred_centre','owner_user_id','stage','contact_permission','notes','change_reason']);
 target:=fets_outreach_private.uid(p,'owner_user_id');manager:=fets_outreach_private.lock_authority(target);
 if not fets_outreach_private.eligible(target) then raise exception 'Owner requires active verified Actionables authorisation' using errcode='42501';end if;
 if not manager and target<>auth.uid() then raise exception 'Only managers can assign another owner' using errcode='42501';end if;
 record_id:=fets_outreach_private.uid(p,'id',true);expected:=fets_outreach_private.instant(p,'expected_updated_at',true);reason:=fets_outreach_private.txt(p,'change_reason',2000);
 if record_id is not null then
  select * into old_i from fets_outreach_private.institutes where id=record_id for update;
  manager:=fets_outreach_private.authority();
  if old_i.id is null then raise exception 'Institute unavailable or access denied' using errcode='42501';end if;
  perform fets_outreach_private.check_scope(old_i.owner_user_id,manager);
  if old_i.updated_at is distinct from expected then raise exception 'Institute changed; reload before saving' using errcode='40001';end if;
  i:=old_i;
 elsif expected is not null then raise exception 'Institute changed; reload before saving' using errcode='40001';
 else i.id:=gen_random_uuid();i.created_at:=clock_timestamp();i.interest:='not_discussed';end if;
 i.name:=fets_outreach_private.txt(p,'name',200,true);i.city:=fets_outreach_private.txt(p,'city',120,true);i.state:=fets_outreach_private.txt(p,'state',120);
 i.contact_name:=fets_outreach_private.txt(p,'contact_name',200);i.contact_role:=fets_outreach_private.txt(p,'contact_role',120);i.phone:=fets_outreach_private.txt(p,'phone',80);i.email:=fets_outreach_private.txt(p,'email',254);i.website:=fets_outreach_private.txt(p,'website',500);
 if i.phone='' and i.email='' then raise exception 'A business phone or email is required' using errcode='22023';end if;
 if i.email<>'' and i.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid business email' using errcode='22023';end if;
 if i.website<>'' and i.website !~* '^https?://[^[:space:]]+$' then raise exception 'Website must use http or https' using errcode='22023';end if;
 i.preferred_centre:=fets_outreach_private.choice(p,'preferred_centre',array['cochin','calicut','undecided']);i.owner_user_id:=target;
 i.stage:=fets_outreach_private.choice(p,'stage',array['new','contacted','understanding_needs','interested','planning','active_partner','paused','closed']);
 i.contact_permission:=fets_outreach_private.choice(p,'contact_permission',array['not_asked','allowed','do_not_contact']);i.notes:=fets_outreach_private.txt(p,'notes',5000);
 if ((i.stage in ('paused','closed') and i.stage is distinct from old_i.stage) or (i.contact_permission='do_not_contact' and i.contact_permission is distinct from old_i.contact_permission) or (old_i.id is not null and target<>old_i.owner_user_id)) and reason='' then raise exception 'A change reason is required' using errcode='22023';end if;
 if old_i.contact_permission='do_not_contact' and i.contact_permission<>'do_not_contact' and (not manager or reason='') then raise exception 'Manager permission and change reason required to restore contact' using errcode='42501';end if;
 stamp:=greatest(clock_timestamp(),coalesce(old_i.updated_at,'-infinity'::timestamptz)+interval '1 microsecond');i.updated_at:=stamp;
 if old_i.id is null then insert into fets_outreach_private.institutes select i.*;
 else update fets_outreach_private.institutes set name=i.name,city=i.city,state=i.state,contact_name=i.contact_name,contact_role=i.contact_role,phone=i.phone,email=i.email,website=i.website,preferred_centre=i.preferred_centre,owner_user_id=i.owner_user_id,stage=i.stage,contact_permission=i.contact_permission,notes=i.notes,updated_at=i.updated_at where id=i.id;end if;
 if i.contact_permission='do_not_contact' or i.stage in ('paused','closed') then
 update fets_outreach_private.followups set status='cancelled',completion_note='Institute contact/stage closed: '||reason,updated_at=greatest(stamp,updated_at+interval '1 microsecond') where institute_id=i.id and status='open' and (i.stage in ('paused','closed') or kind<>'internal_review');end if;
 insert into fets_outreach_private.institute_changes(institute_id,actor_user_id,reason,before_record,after_record) values(i.id,auth.uid(),reason,case when old_i.id is not null then to_jsonb(old_i) end,to_jsonb(i));
 return to_jsonb(i);
end $$;

create function fets_outreach_private.record_call(p_payload jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare p jsonb:=p_payload;i fets_outreach_private.institutes;c fets_outreach_private.calls;prior fets_outreach_private.calls;manager boolean;expected timestamptz;next jsonb;a jsonb;v text;req uuid;reason text;newstage text;stamp timestamptz;nextkind text;nexttitle text;nextdue timestamptz;
begin
 perform fets_outreach_private.object(p,array['institute_id','request_id','expected_updated_at','occurred_at','channel','outcome','contact_name','contact_role','summary','answers','concerns','interest','follow_up_permission','advisory_interest','stage','next_step','close_reason']);
 manager:=fets_outreach_private.lock_authority();
 select * into i from fets_outreach_private.institutes where id=fets_outreach_private.uid(p,'institute_id') for update;
 manager:=fets_outreach_private.authority();if i.id is null then raise exception 'Institute unavailable or access denied' using errcode='42501';end if;perform fets_outreach_private.check_scope(i.owner_user_id,manager);
 req:=fets_outreach_private.uid(p,'request_id');
 select * into prior from fets_outreach_private.calls where request_id=req;
 if found then
 if prior.actor_user_id<>auth.uid() or prior.institute_id<>i.id or prior.request_hash<>md5(p::text) then raise exception 'Request ID reuse with different actor or payload' using errcode='22023';end if;
 return jsonb_build_object('call_id',prior.id,'institute',prior.response_institute);end if;
 expected:=fets_outreach_private.instant(p,'expected_updated_at');if i.updated_at is distinct from expected then raise exception 'Institute changed; reload before logging' using errcode='40001';end if;
 c.id:=gen_random_uuid();c.institute_id:=i.id;c.actor_user_id:=auth.uid();select coalesce(full_name,'Staff') into c.actor_name from public.staff_profiles where user_id=auth.uid();c.request_id:=req;c.request_hash:=md5(p::text);
 c.occurred_at:=fets_outreach_private.instant(p,'occurred_at');c.channel:=fets_outreach_private.choice(p,'channel',array['phone','meeting','email','whatsapp','inbound','note']);c.outcome:=fets_outreach_private.choice(p,'outcome',array['not_reached','wrong_contact','callback_requested','feedback_received','interested','not_interested','do_not_contact','permission_update']);
 c.contact_name:=fets_outreach_private.txt(p,'contact_name',200);c.contact_role:=fets_outreach_private.txt(p,'contact_role',120);c.summary:=fets_outreach_private.txt(p,'summary',5000,true);
 c.interest:=fets_outreach_private.choice(p,'interest',array['not_discussed','centre_mock','platform','both','none']);c.follow_up_permission:=fets_outreach_private.choice(p,'follow_up_permission',array['not_asked','allowed','do_not_contact']);c.advisory_interest:=fets_outreach_private.choice(p,'advisory_interest',array['not_asked','yes','no']);
 reason:=fets_outreach_private.txt(p,'close_reason',2000);c.close_reason:=reason;
 newstage:=fets_outreach_private.choice(p,'stage',array['new','contacted','understanding_needs','interested','planning','active_partner','paused','closed']);
 a:=p->'answers';perform fets_outreach_private.object(a,array['annual_students','exam_cycle','booking_influence','main_worries','student_queries','current_mock_format','environment_gap','readiness_needs','expectations','improvements']);
 c.answers:=jsonb_build_object('annual_students',fets_outreach_private.number(a,'annual_students',true));
 foreach v in array array['exam_cycle','booking_influence','main_worries','student_queries','current_mock_format','environment_gap','readiness_needs','expectations','improvements'] loop c.answers:=c.answers||jsonb_build_object(v,fets_outreach_private.txt(a,v,1500));end loop;
 if jsonb_typeof(p->'concerns') is distinct from 'array' or jsonb_array_length(p->'concerns')>20 then raise exception 'Invalid concern tags' using errcode='22023';end if;
 c.concerns:='[]';for a in select value from jsonb_array_elements(p->'concerns') loop v:=fets_outreach_private.txt(jsonb_build_object('tag',a),'tag',80,true);if not(v=any(array['availability','travel','check_in','requirements','waiting','communication','comfort','noise','environment','computers','lockers','cleanliness','anxiety','other'])) then raise exception 'Invalid concern tag' using errcode='22023';end if;if c.concerns ? v then raise exception 'Duplicate concern tag' using errcode='22023';end if;c.concerns:=c.concerns||jsonb_build_array(v);end loop;
 next:=p->'next_step';if (next='null'::jsonb)=(reason='') then raise exception 'Supply exactly one next step or close reason' using errcode='22023';end if;
 if next<>'null'::jsonb then perform fets_outreach_private.object(next,array['kind','title','due_at']);nextkind:=fets_outreach_private.choice(next,'kind',array['retry_contact','requested_callback','send_information','arrange_mock','platform_discussion','internal_review','confirm_attendance']);nexttitle:=fets_outreach_private.txt(next,'title',300,true);nextdue:=fets_outreach_private.instant(next,'due_at');end if;
 if newstage in ('paused','closed') and (reason='' or next<>'null'::jsonb) then raise exception 'Paused/closed stage needs closure reason and no next step' using errcode='22023';end if;
 if c.outcome='do_not_contact' and c.follow_up_permission<>'do_not_contact' then raise exception 'Do not contact outcome requires contact permission update' using errcode='22023';end if;
 if i.contact_permission='do_not_contact' then
 if c.channel not in ('inbound','note') then raise exception 'Do not contact suppresses outbound logging' using errcode='22023';end if;
 if c.follow_up_permission<>'do_not_contact' and not(c.channel='inbound' and c.outcome='permission_update') then raise exception 'Inbound permission update required to restore contact' using errcode='42501';end if;
 end if;
 if c.follow_up_permission='do_not_contact' and nextkind is not null and nextkind<>'internal_review' then raise exception 'Do not contact suppresses outbound next steps' using errcode='22023';end if;
 stamp:=greatest(clock_timestamp(),i.updated_at+interval '1 microsecond');
 update fets_outreach_private.followups set status='cancelled',completion_note='Superseded by interaction '||c.id::text,updated_at=greatest(stamp,updated_at+interval '1 microsecond') where institute_id=i.id and status='open';
 i.stage:=newstage;i.contact_permission:=c.follow_up_permission;i.interest:=c.interest;
 if c.contact_name<>'' then i.contact_name:=c.contact_name;end if;if c.contact_role<>'' then i.contact_role:=c.contact_role;end if;
 if c.channel<>'note' then i.last_contact_at:=greatest(i.last_contact_at,c.occurred_at);end if;i.updated_at:=stamp;
 update fets_outreach_private.institutes set stage=i.stage,contact_permission=i.contact_permission,interest=i.interest,contact_name=i.contact_name,contact_role=i.contact_role,last_contact_at=i.last_contact_at,updated_at=i.updated_at where id=i.id;
 c.response_institute:=to_jsonb(i);c.created_at:=stamp;insert into fets_outreach_private.calls select c.*;
 if nextkind is not null then insert into fets_outreach_private.followups(institute_id,call_id,kind,title,due_at,status,created_at,updated_at) values(i.id,c.id,nextkind,nexttitle,nextdue,'open',stamp,stamp);end if;
 return jsonb_build_object('call_id',c.id,'institute',to_jsonb(i));
end $$;

create function fets_outreach_private.save_batch(p_payload jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare p jsonb:=p_payload;b fets_outreach_private.batches;old_b fets_outreach_private.batches;i fets_outreach_private.institutes;manager boolean;expected timestamptz;day text;
begin
 perform fets_outreach_private.object(p,array['id','expected_updated_at','institute_id','name','delivery','centre','planned_date','status','estimated','confirmed','attended','notes']);
 manager:=fets_outreach_private.lock_authority();select * into i from fets_outreach_private.institutes where id=fets_outreach_private.uid(p,'institute_id') for update;
 manager:=fets_outreach_private.authority();if i.id is null then raise exception 'Institute unavailable or access denied' using errcode='42501';end if;perform fets_outreach_private.check_scope(i.owner_user_id,manager);
 b.id:=fets_outreach_private.uid(p,'id',true);expected:=fets_outreach_private.instant(p,'expected_updated_at',true);
 if b.id is not null then select * into old_b from fets_outreach_private.batches where id=b.id and institute_id=i.id for update;
 if old_b.id is null or old_b.updated_at is distinct from expected then raise exception 'Batch changed; reload before saving' using errcode='40001';end if;
 elsif expected is not null then raise exception 'Batch changed; reload before saving' using errcode='40001';else b.id:=gen_random_uuid();end if;
 b.institute_id:=i.id;b.name:=fets_outreach_private.txt(p,'name',200,true);b.delivery:=fets_outreach_private.choice(p,'delivery',array['fets_centre','institute_platform']);
 if p->'centre'='null'::jsonb then b.centre:=null;else b.centre:=fets_outreach_private.choice(p,'centre',array['cochin','calicut']);end if;
 if p->'planned_date'='null'::jsonb then b.planned_date:=null;else day:=fets_outreach_private.txt(p,'planned_date',10,true);if day!~'^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid planned date' using errcode='22023';end if;b.planned_date:=day::date;end if;
 b.status:=fets_outreach_private.choice(p,'status',array['potential','confirmed','completed','cancelled']);b.estimated:=fets_outreach_private.number(p,'estimated');b.confirmed:=fets_outreach_private.number(p,'confirmed');b.attended:=fets_outreach_private.number(p,'attended');b.notes:=fets_outreach_private.txt(p,'notes',5000);
 b.created_at:=coalesce(old_b.created_at,clock_timestamp());b.updated_at:=greatest(clock_timestamp(),coalesce(old_b.updated_at,'-infinity'::timestamptz)+interval '1 microsecond');
 if old_b.id is null then insert into fets_outreach_private.batches select b.*;else update fets_outreach_private.batches set name=b.name,delivery=b.delivery,centre=b.centre,planned_date=b.planned_date,status=b.status,estimated=b.estimated,confirmed=b.confirmed,attended=b.attended,notes=b.notes,updated_at=b.updated_at where id=b.id;end if;
 return to_jsonb(b);
end $$;

create function fets_outreach_private.update_followup(p_payload jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare p jsonb:=p_payload;f fets_outreach_private.followups;i fets_outreach_private.institutes;manager boolean;record_id uuid;institute uuid;expected timestamptz;new_status text;note text;new_due timestamptz;
begin
 perform fets_outreach_private.object(p,array['id','expected_updated_at','status','due_at','note']);manager:=fets_outreach_private.lock_authority();record_id:=fets_outreach_private.uid(p,'id');
 select institute_id into institute from fets_outreach_private.followups where id=record_id;
 select * into i from fets_outreach_private.institutes where id=institute for update;
 manager:=fets_outreach_private.authority();if i.id is null then raise exception 'Institute unavailable or access denied' using errcode='42501';end if;perform fets_outreach_private.check_scope(i.owner_user_id,manager);
 select * into f from fets_outreach_private.followups where id=record_id for update;
 expected:=fets_outreach_private.instant(p,'expected_updated_at');if f.updated_at is distinct from expected or f.status<>'open' then raise exception 'Follow-up changed; reload before saving' using errcode='40001';end if;
 new_status:=fets_outreach_private.choice(p,'status',array['open','done','cancelled']);note:=fets_outreach_private.txt(p,'note',2000,true);new_due:=fets_outreach_private.instant(p,'due_at');
 if new_status='open' and (i.contact_permission='do_not_contact' and f.kind<>'internal_review' or i.stage in ('paused','closed')) then raise exception 'Institute contact permission or stage prevents outbound next step' using errcode='22023';end if;
 f.status:=new_status;f.completion_note:=note;f.due_at:=new_due;f.updated_at:=greatest(clock_timestamp(),f.updated_at+interval '1 microsecond');
 update fets_outreach_private.followups set status=f.status,completion_note=f.completion_note,due_at=f.due_at,updated_at=f.updated_at where id=f.id;return to_jsonb(f);
end $$;

-- Defense in depth. RPCs are the only access; no table grants, deletion or mutable actor APIs.
alter table fets_outreach_private.institutes enable row level security;
alter table fets_outreach_private.calls enable row level security;
alter table fets_outreach_private.followups enable row level security;
alter table fets_outreach_private.batches enable row level security;
alter table fets_outreach_private.institute_changes enable row level security;
create policy outreach_institute_scope on fets_outreach_private.institutes for select to authenticated using(fets_outreach_private.eligible(auth.uid()) and (owner_user_id=auth.uid() or fets_outreach_private.authority()));
create policy outreach_call_scope on fets_outreach_private.calls for select to authenticated using(exists(select 1 from fets_outreach_private.institutes i where i.id=institute_id));
create policy outreach_followup_scope on fets_outreach_private.followups for select to authenticated using(exists(select 1 from fets_outreach_private.institutes i where i.id=institute_id));
create policy outreach_batch_scope on fets_outreach_private.batches for select to authenticated using(exists(select 1 from fets_outreach_private.institutes i where i.id=institute_id));
revoke all on all tables in schema fets_outreach_private from public,anon,authenticated,service_role;
revoke all on all functions in schema fets_outreach_private from public,anon,authenticated,service_role;

create function public.outreach_context() returns jsonb language sql stable security invoker set search_path='' as $$select fets_outreach_private.context()$$;
create function public.outreach_detail(p_institute_id uuid,p_before timestamptz default null,p_before_id uuid default null) returns jsonb language sql stable security invoker set search_path='' as $$select fets_outreach_private.detail(p_institute_id,p_before,p_before_id)$$;
create function public.outreach_save_institute(p_payload jsonb) returns jsonb language sql volatile security invoker set search_path='' as $$select fets_outreach_private.save_institute(p_payload)$$;
create function public.outreach_record_call(p_payload jsonb) returns jsonb language sql volatile security invoker set search_path='' as $$select fets_outreach_private.record_call(p_payload)$$;
create function public.outreach_save_batch(p_payload jsonb) returns jsonb language sql volatile security invoker set search_path='' as $$select fets_outreach_private.save_batch(p_payload)$$;
create function public.outreach_update_followup(p_payload jsonb) returns jsonb language sql volatile security invoker set search_path='' as $$select fets_outreach_private.update_followup(p_payload)$$;
revoke all on function public.outreach_context(),public.outreach_detail(uuid,timestamptz,uuid),public.outreach_save_institute(jsonb),public.outreach_record_call(jsonb),public.outreach_save_batch(jsonb),public.outreach_update_followup(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.outreach_context(),public.outreach_detail(uuid,timestamptz,uuid),public.outreach_save_institute(jsonb),public.outreach_record_call(jsonb),public.outreach_save_batch(jsonb),public.outreach_update_followup(jsonb) to authenticated;
grant execute on function fets_outreach_private.context(),fets_outreach_private.detail(uuid,timestamptz,uuid),fets_outreach_private.save_institute(jsonb),fets_outreach_private.record_call(jsonb),fets_outreach_private.save_batch(jsonb),fets_outreach_private.update_followup(jsonb) to authenticated;
