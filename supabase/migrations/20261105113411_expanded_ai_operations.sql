-- Closed, caller-authorized domain operations and immutable human review proposals.
-- No business data is seeded and existing ai_settings.allowed_tools is preserved.
begin;

-- A BEFORE boundary reads OLD stored authority, before a caller's proposed
-- role/permission changes can become visible to any AFTER synchronization.
create function fets_ai_private.profile_authority_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); a public.staff_profiles; operator boolean; super boolean; delegated boolean; k text;
begin
 operator:=actor is null and current_setting('role',true) in ('none','postgres','service_role');
 if operator then return case when tg_op='DELETE' then old else new end;end if;
 select * into a from public.staff_profiles where user_id=actor;
 if not found and tg_op='INSERT' and new.user_id=actor and new.role in ('staff','fetsian') and coalesce(new.permissions,'{}')='{}'::jsonb and new.is_active is true and exists(select 1 from auth.users u where u.id=actor and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<statement_timestamp())) then return new;end if;
 if a.id is null or not a.is_active or not exists(select 1 from auth.users u where u.id=actor and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<statement_timestamp())) then raise exception 'Verified active staff required' using errcode='42501';end if;
 super:=a.role='super_admin';delegated:=super or a.permissions @> '{"user_management_edit":true}'::jsonb;
 if tg_op='DELETE' then
  if not super or old.user_id=actor then raise exception 'Another administrator must archive this account' using errcode='42501';end if;return old;
 end if;
 if tg_op='INSERT' then
  if not super and (new.user_id is distinct from actor or new.role not in ('staff','fetsian') or coalesce(new.permissions,'{}')<>'{}'::jsonb or new.is_active is distinct from true) then raise exception 'Administrator assigns account authority' using errcode='42501';end if;return new;
 end if;
 if old.role='super_admin' and (new.role<>'super_admin' or new.is_active is distinct from true) and not exists(select 1 from public.staff_profiles p where p.user_id<>old.user_id and p.role='super_admin' and p.is_active) then raise exception 'Keep at least one super administrator enabled' using errcode='42501';end if;
 if new.id is distinct from old.id or new.user_id is distinct from old.user_id then raise exception 'Account identity is immutable' using errcode='42501';end if;
 if (new.role,new.permissions,new.is_active,new.branch_assigned,new.base_centre,new.status,new.employment_end_date) is distinct from (old.role,old.permissions,old.is_active,old.branch_assigned,old.base_centre,old.status,old.employment_end_date) then
  if not delegated or (not super and old.user_id=actor) then raise exception 'Cannot change your own authority or unassigned permissions' using errcode='42501';end if;
  if not super then
   if old.role='super_admin' or new.role='super_admin' or new.role is distinct from old.role then raise exception 'Only a super administrator changes roles' using errcode='42501';end if;
   for k in select jsonb_object_keys(coalesce(new.permissions,'{}')||coalesce(old.permissions,'{}')) loop
    if (new.permissions->k) is distinct from (old.permissions->k) and ((jsonb_typeof(new.permissions->k) is distinct from 'boolean') or (new.permissions->k='true'::jsonb and a.permissions->k is distinct from 'true'::jsonb)) then raise exception 'Cannot delegate authority you do not hold' using errcode='42501';end if;
   end loop;
  end if;
 end if;
 if not delegated and a.permissions @> '{"staff_edit":true}'::jsonb is not true and actor is distinct from old.user_id then raise exception 'Edit your own profile or ask management' using errcode='42501';end if;
 return new;
end $$;
revoke all on function fets_ai_private.profile_authority_guard() from public,anon,authenticated;
create trigger aaa_fets_ai_profile_authority before insert or update or delete on public.staff_profiles for each row execute function fets_ai_private.profile_authority_guard();

-- Preserve Actionables synchronization and its last-manager invariant; authority
-- has already been checked against the old profile by the BEFORE trigger.
create or replace function fets_actionables_private.profile_security_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); operator boolean; manager boolean;
begin
 operator:=actor is null and current_setting('role',true) in ('none','postgres','service_role');
 if actor is null and not operator then raise exception 'Sign in to change staff profiles' using errcode='42501';end if;
 if tg_op='DELETE' then delete from fets_actionables_private.members where profile_id=old.id;return old;end if;
 manager:=operator or exists(select 1 from fets_actionables_private.members where user_id=actor and enabled and project_role='manager') or exists(select 1 from public.staff_profiles where user_id=actor and is_active and (role='super_admin' or permissions @> '{"user_management_edit":true}'::jsonb));
 if manager and new.user_id is not null then
  if not operator and exists(select 1 from fets_actionables_private.members where user_id=new.user_id and enabled and project_role='manager') and (not coalesce(new.is_active,false) or lower(coalesce(new.role,'')) not in ('admin','super_admin')) and not exists(select 1 from fets_actionables_private.members where user_id<>new.user_id and enabled and project_role='manager') then raise exception 'Keep at least one project manager enabled';end if;
  insert into fets_actionables_private.members(user_id,profile_id,full_name,project_role,enabled) values(new.user_id,new.id,coalesce(new.full_name,'Staff'),case when new.role in ('admin','super_admin') then 'manager' else 'staff' end,coalesce(new.is_active,false)) on conflict(user_id) do update set full_name=excluded.full_name,project_role=excluded.project_role,enabled=excluded.enabled;
 elsif tg_op='UPDATE' and actor=new.user_id then update fets_actionables_private.members set full_name=coalesce(new.full_name,'Staff') where user_id=actor;end if;
 return new;
end $$;

-- Legacy permissive delegation policies must not create a new centre authority.
create function fets_ai_private.delegation_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null and current_setting('role',true) in ('none','postgres','service_role') then return case when tg_op='DELETE' then old else new end;end if;
 if not exists(select 1 from public.staff_profiles p join auth.users u on u.id=p.user_id where p.user_id=auth.uid() and p.is_active and p.role='super_admin' and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<statement_timestamp())) then raise exception 'Super administrator manages centre delegation' using errcode='42501';end if;
 return case when tg_op='DELETE' then old else new end;
end $$;
revoke all on function fets_ai_private.delegation_guard() from public,anon,authenticated;
create trigger aaa_fets_ai_delegation_authority before insert or update or delete on public.staff_branch_delegations for each row execute function fets_ai_private.delegation_guard();

create or replace function fets_ai_private.member_active(p_user uuid,p_branch text default null) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.staff_profiles p join auth.users u on u.id=p.user_id where p.user_id=p_user and p.is_active is true and coalesce(p.status,'active')='active' and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<statement_timestamp())
 and exists(select 1 from public.centre_duty_members m where m.user_id=p.user_id and m.profile_id=p.id)
 and (p_branch is null or p.role='super_admin' or (p_branch<>'global' and (exists(select 1 from public.centre_duty_members m where m.user_id=p.user_id and m.profile_id=p.id and m.branch=p_branch)))))
$$;
create or replace function fets_ai_private.actor_role(p_branch text default null) returns text
language sql stable security definer set search_path='' as $$
 select case when not fets_ai_private.member_active(auth.uid(),p_branch) then null when p.role='super_admin' then 'super_admin' when p.role in ('admin','manager') or exists(select 1 from public.centre_duty_members m where m.user_id=p.user_id and (p_branch is null or m.branch=p_branch) and m.role='planner') then 'manager' else 'staff' end from public.staff_profiles p where p.user_id=auth.uid()
$$;

create function fets_ai_private.permitted(p_permission text,p_branch text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare p public.staff_profiles; chosen jsonb;
begin
 if not fets_ai_private.member_active(auth.uid(),p_branch) then return false;end if;
 select * into p from public.staff_profiles where user_id=auth.uid();
 if p.role='super_admin' then return true;end if;
 chosen:=p.permissions->p_permission;
 if p_permission like 'ws_%' then
  if jsonb_typeof(chosen)='boolean' then return chosen='true'::jsonb;end if;
  return p_permission in ('ws_fets-chat','ws_candidate-tracker');
 end if;
 if p_permission='actionables' then return exists(select 1 from fets_actionables_private.members m where m.user_id=auth.uid() and m.enabled);end if;
 if p_permission in ('desk','shift','lost_found','profile') then return true;end if;
 if p_permission in ('calendar','catalogue') then
  if jsonb_typeof(p.permissions->'ws_client-directory')='boolean' and p.permissions->'ws_client-directory'='false'::jsonb then return false;end if;
  return p.permissions @> '{"can_edit_calendar":true}'::jsonb or p.permissions @> '{"can_edit_roster":true}'::jsonb or p.permissions @> '{"ws_client-directory":true}'::jsonb or p.role in ('admin','manager') or exists(select 1 from public.centre_duty_members m where m.user_id=auth.uid() and (p_branch is null or m.branch=p_branch) and m.role='planner');
 end if;
 if p_permission in ('can_edit_roster','user_management_edit') then return chosen='true'::jsonb and (p_permission<>'user_management_edit' or coalesce(p.permissions->'ws_user-management','true'::jsonb)='true'::jsonb);end if;
 if p_permission='staff_edit' then return (p.permissions @> '{"staff_edit":true}'::jsonb or p.permissions @> '{"user_management_edit":true}'::jsonb) and coalesce(p.permissions->'ws_user-management','true'::jsonb)='true'::jsonb;end if;
 return false;
end $$;

create table public.fets_ai_reviews(
 id uuid primary key default gen_random_uuid(),user_id uuid not null,request_id uuid not null,
 operation text not null,label text not null,module text not null,path text not null,branch text not null,
 status text not null default 'pending' check(status in ('pending','applied','cancelled','expired','stale','blocked')),
 apply_mode text not null check(apply_mode in ('database','module')),record_id text,
 before_values jsonb not null default '{}',proposed_values jsonb not null,
 summary text not null,expires_at timestamptz not null default clock_timestamp()+interval '20 minutes',
 created_at timestamptz not null default clock_timestamp(),decided_at timestamptz,result jsonb,
 argument_hash text not null,target_hash text,unique(user_id,request_id)
);
alter table public.fets_ai_reviews enable row level security;
revoke all on public.fets_ai_reviews from public,anon,authenticated;
grant select(id,operation,label,module,path,branch,status,apply_mode,record_id,before_values,proposed_values,summary,expires_at,created_at,decided_at,result) on public.fets_ai_reviews to authenticated;
create policy fets_ai_own_reviews on public.fets_ai_reviews for select to authenticated using(user_id=auth.uid() and fets_ai_private.member_active(auth.uid(),branch));
create index fets_ai_reviews_actor_created on public.fets_ai_reviews(user_id,created_at desc);

create table fets_ai_private.operation_requests(user_id uuid not null,request_id uuid not null,operation text not null,argument_hash text not null,result jsonb,created_at timestamptz not null default clock_timestamp(),primary key(user_id,request_id));
revoke all on fets_ai_private.operation_requests from public,anon,authenticated;

create function fets_ai_private.operation_catalog() returns jsonb language sql immutable set search_path='' as $catalog$ select $registry$[{"name":"create_incident","label":"Create case","module":"incident-log","path":"/incident-log","permission":"ws_case","review":false,"applyMode":"database","scope":"centre","parameters":{"type":"OBJECT","properties":{"title":{"type":"STRING","description":""},"description":{"type":"STRING","description":""},"severity":{"type":"STRING","enum":["minor","major","critical"]},"category":{"type":"STRING","enum":["computer","equipment","property","staff","candidate","client","utility","other","roster","calendar","facility","systems","network","exam","assets","vendor"]},"status":{"type":"STRING","enum":["open","assigned","in_progress","escalated","closed"]},"assigned_to":{"type":"STRING","description":"Verified Auth user UUID"},"notes":{"type":"STRING","description":""},"due_date":{"type":"STRING","description":"YYYY-MM-DD"}},"required":["title","description","severity"],"additionalProperties":false}},{"name":"update_incident","label":"Update case","module":"incident-log","path":"/incident-log","permission":"ws_case","review":false,"applyMode":"database","scope":"centre","parameters":{"type":"OBJECT","properties":{"title":{"type":"STRING","description":""},"description":{"type":"STRING","description":""},"severity":{"type":"STRING","enum":["minor","major","critical"]},"category":{"type":"STRING","enum":["computer","equipment","property","staff","candidate","client","utility","other","roster","calendar","facility","systems","network","exam","assets","vendor"]},"status":{"type":"STRING","enum":["open","assigned","in_progress","escalated","closed"]},"assigned_to":{"type":"STRING","description":"Verified Auth user UUID"},"notes":{"type":"STRING","description":""},"due_date":{"type":"STRING","description":"YYYY-MM-DD"},"id":{"type":"STRING","description":"Exact saved record ID"},"expected_updated_at":{"type":"STRING","description":"Exact updated_at from the current record"}},"required":["id","expected_updated_at"],"additionalProperties":false}},{"name":"create_task","label":"Create task","module":"my-desk","path":"/my-desk","permission":"desk","review":false,"applyMode":"database","scope":"centre","parameters":{"type":"OBJECT","properties":{"title":{"type":"STRING","description":""},"description":{"type":"STRING","description":""},"priority":{"type":"STRING","enum":["low","medium","high"]},"status":{"type":"STRING","enum":["pending","in_progress","completed","cancelled"]},"assigned_to":{"type":"STRING","description":"Verified Auth user UUID"},"due_date":{"type":"STRING","description":"ISO timestamp"}},"required":["title"],"additionalProperties":false}},{"name":"update_task","label":"Update task","module":"my-desk","path":"/my-desk","permission":"desk","review":false,"applyMode":"database","scope":"centre","parameters":{"type":"OBJECT","properties":{"title":{"type":"STRING","description":""},"description":{"type":"STRING","description":""},"priority":{"type":"STRING","enum":["low","medium","high"]},"status":{"type":"STRING","enum":["pending","in_progress","completed","cancelled"]},"assigned_to":{"type":"STRING","description":"Verified Auth user UUID"},"due_date":{"type":"STRING","description":"ISO timestamp"},"id":{"type":"STRING","description":"Exact saved record ID"},"expected_updated_at":{"type":"STRING","description":"Exact updated_at from the current record"}},"required":["id","expected_updated_at"],"additionalProperties":false}},{"name":"create_session","label":"Create session","module":"fets-calendar","path":"/calendar","permission":"calendar","review":false,"applyMode":"database","scope":"centre","parameters":{"type":"OBJECT","properties":{"client_name":{"type":"STRING","description":""},"exam_name":{"type":"STRING","description":""},"date":{"type":"STRING","description":"YYYY-MM-DD"},"start_time":{"type":"STRING","description":"HH:mm"},"end_time":{"type":"STRING","description":"HH:mm"},"candidate_count":{"type":"INTEGER","description":""},"status":{"type":"STRING","enum":["scheduled","in_progress","completed","cancelled"]}},"required":["client_name","exam_name","date","start_time","end_time"],"additionalProperties":false}},{"name":"update_session","label":"Update session","module":"fets-calendar","path":"/calendar","permission":"calendar","review":false,"applyMode":"database","scope":"centre","parameters":{"type":"OBJECT","properties":{"client_name":{"type":"STRING","description":""},"exam_name":{"type":"STRING","description":""},"date":{"type":"STRING","description":"YYYY-MM-DD"},"start_time":{"type":"STRING","description":"HH:mm"},"end_time":{"type":"STRING","description":"HH:mm"},"candidate_count":{"type":"INTEGER","description":""},"status":{"type":"STRING","enum":["scheduled","in_progress","completed","cancelled"]},"id":{"type":"STRING","description":"Exact saved record ID"},"expected_updated_at":{"type":"STRING","description":"Exact updated_at from the current record"}},"required":["id","expected_updated_at"],"additionalProperties":false}},{"name":"delete_session","label":"Delete session","module":"fets-calendar","path":"/calendar","permission":"calendar","review":true,"applyMode":"database","scope":"centre","parameters":{"type":"OBJECT","properties":{"id":{"type":"STRING","description":"Exact saved record ID"},"expected_updated_at":{"type":"STRING","description":"Exact current record version or timestamp"},"reason":{"type":"STRING","description":"Reason for irreversible removal"}},"required":["id","expected_updated_at","reason"],"additionalProperties":false}},{"name":"delete_incident","label":"Delete case","module":"incident-log","path":"/incident-log","permission":"ws_case","review":true,"applyMode":"database","scope":"centre","parameters":{"type":"OBJECT","properties":{"id":{"type":"STRING","description":"Exact saved record ID"},"expected_updated_at":{"type":"STRING","description":"Exact current record version or timestamp"},"reason":{"type":"STRING","description":"Reason for irreversible removal"}},"required":["id","expected_updated_at","reason"],"additionalProperties":false}},{"name":"delete_task","label":"Delete task","module":"my-desk","path":"/my-desk","permission":"desk","review":true,"applyMode":"database","scope":"centre","parameters":{"type":"OBJECT","properties":{"id":{"type":"STRING","description":"Exact saved record ID"},"expected_updated_at":{"type":"STRING","description":"Exact current record version or timestamp"},"reason":{"type":"STRING","description":"Reason for irreversible removal"}},"required":["id","expected_updated_at","reason"],"additionalProperties":false}},{"name":"add_case_comment","label":"Add case comment","module":"incident-log","path":"/incident-log","permission":"ws_case","review":false,"applyMode":"database","scope":"centre","parameters":{"type":"OBJECT","properties":{"incident_id":{"type":"STRING","description":""},"body":{"type":"STRING","description":""}},"required":["incident_id","body"],"additionalProperties":false}},{"name":"create_client","label":"Create client","module":"client-directory","path":"/calendar","permission":"catalogue","review":false,"applyMode":"database","scope":"shared","parameters":{"type":"OBJECT","properties":{"name":{"type":"STRING","description":""},"color":{"type":"STRING","description":""},"logo_url":{"type":"STRING","description":"Public HTTPS URL"}},"required":["name"],"additionalProperties":false}},{"name":"update_client","label":"Update client","module":"client-directory","path":"/calendar","permission":"catalogue","review":false,"applyMode":"database","scope":"shared","parameters":{"type":"OBJECT","properties":{"name":{"type":"STRING","description":""},"color":{"type":"STRING","description":""},"logo_url":{"type":"STRING","description":"Public HTTPS URL"},"id":{"type":"STRING","description":"Exact saved record ID"},"expected_updated_at":{"type":"STRING","description":"Exact updated_at from the current record"}},"required":["id","expected_updated_at"],"additionalProperties":false}},{"name":"delete_client","label":"Delete client","module":"client-directory","path":"/calendar","permission":"catalogue","review":true,"applyMode":"module","scope":"shared","parameters":{"type":"OBJECT","properties":{"id":{"type":"STRING","description":"Exact saved record ID"},"expected_updated_at":{"type":"STRING","description":"Exact current record version or timestamp"},"reason":{"type":"STRING","description":"Reason for irreversible removal"}},"required":["id","expected_updated_at","reason"],"additionalProperties":false}},{"name":"create_programme","label":"Create programme","module":"client-directory","path":"/calendar","permission":"catalogue","review":false,"applyMode":"database","scope":"shared","parameters":{"type":"OBJECT","properties":{"client_id":{"type":"STRING","description":""},"name":{"type":"STRING","description":""},"locations":{"type":"ARRAY","items":{"type":"STRING","description":""},"description":"Centre IDs"}},"required":["client_id","name"],"additionalProperties":false}},{"name":"update_programme","label":"Update programme","module":"client-directory","path":"/calendar","permission":"catalogue","review":false,"applyMode":"database","scope":"shared","parameters":{"type":"OBJECT","properties":{"id":{"type":"STRING","description":""},"name":{"type":"STRING","description":""},"locations":{"type":"ARRAY","items":{"type":"STRING","description":""},"description":""},"expected_snapshot":{"type":"STRING","description":"Exact expected_snapshot returned by read_operation_target for this operation and target"}},"required":["id","expected_snapshot"],"additionalProperties":false}},{"name":"delete_programme","label":"Delete programme","module":"client-directory","path":"/calendar","permission":"catalogue","review":true,"applyMode":"database","scope":"shared","parameters":{"type":"OBJECT","properties":{"id":{"type":"STRING","description":"Exact saved record ID"},"reason":{"type":"STRING","description":"Reason for irreversible removal"},"expected_snapshot":{"type":"STRING","description":"Exact expected_snapshot returned by read_operation_target for this operation and target"}},"required":["id","expected_snapshot","reason"],"additionalProperties":false}},{"name":"import_candidate_roster","label":"Prepare candidate roster import","module":"candidate-tracker","path":"/candidate-tracker","permission":"ws_candidate-tracker","review":true,"applyMode":"module","scope":"centre","parameters":{"type":"OBJECT","properties":{"day":{"type":"STRING","description":""},"provider":{"type":"STRING","enum":["pearson","prometric","paragon","other"]},"source_name":{"type":"STRING","description":""},"row_count":{"type":"INTEGER","description":""}},"required":["day","provider","source_name","row_count"],"additionalProperties":false}},{"name":"set_roster_shift","label":"Set roster shift","module":"fets-roster","path":"/roster","permission":"can_edit_roster","review":false,"applyMode":"database","scope":"centre","parameters":{"type":"OBJECT","properties":{"profile_id":{"type":"STRING","description":"Verified staff profile UUID"},"date":{"type":"STRING","description":""},"shift_code":{"type":"STRING","enum":["D","HD","RD"]},"shift_label":{"type":"STRING","description":""},"shift_start":{"type":"STRING","description":""},"shift_end":{"type":"STRING","description":""},"grace_minutes":{"type":"INTEGER","description":""},"expected_version":{"type":"INTEGER","description":"0 for new shift; exact current version to replace"}},"required":["profile_id","date","shift_code","expected_version"],"additionalProperties":false}},{"name":"remove_roster_shift","label":"Remove roster shift","module":"fets-roster","path":"/roster","permission":"can_edit_roster","review":true,"applyMode":"module","scope":"centre","parameters":{"type":"OBJECT","properties":{"id":{"type":"STRING","description":""},"expected_updated_at":{"type":"STRING","description":""},"reason":{"type":"STRING","description":""}},"required":["id","expected_updated_at","reason"],"additionalProperties":false}},{"name":"prepare_roster_bulk_change","label":"Prepare bulk roster change","module":"fets-roster","path":"/roster","permission":"can_edit_roster","review":true,"applyMode":"module","scope":"centre","parameters":{"type":"OBJECT","properties":{"from":{"type":"STRING","description":""},"to":{"type":"STRING","description":""},"profile_ids":{"type":"ARRAY","items":{"type":"STRING","description":""},"description":""},"shift_code":{"type":"STRING","description":""},"reason":{"type":"STRING","description":""}},"required":["from","to","profile_ids","shift_code","reason"],"additionalProperties":false}},{"name":"prepare_shift_plan","label":"Prepare Shift plan","module":"handover","path":"/handover","permission":"shift","review":true,"applyMode":"module","scope":"centre","parameters":{"type":"OBJECT","properties":{"day":{"type":"STRING","description":""},"lead_id":{"type":"STRING","description":"Verified profile UUID"},"instructions":{"type":"STRING","description":""}},"required":["day","lead_id","instructions"],"additionalProperties":false}},{"name":"prepare_shift_report","label":"Prepare Shift closing report","module":"handover","path":"/handover","permission":"shift","review":true,"applyMode":"module","scope":"centre","parameters":{"type":"OBJECT","properties":{"day":{"type":"STRING","description":""},"summary":{"type":"STRING","description":""},"pending":{"type":"STRING","description":""}},"required":["day","summary"],"additionalProperties":false}},{"name":"prepare_daily_report","label":"Prepare daily operations report","module":"handover","path":"/handover","permission":"shift","review":true,"applyMode":"module","scope":"centre","parameters":{"type":"OBJECT","properties":{"day":{"type":"STRING","description":""},"kind":{"type":"STRING","enum":["opening","closing"]},"overall":{"type":"STRING","enum":["ready","issues"]},"issues":{"type":"STRING","description":""},"action_taken":{"type":"STRING","description":""},"pending":{"type":"STRING","description":""},"manager_attention":{"type":"BOOLEAN","description":""}},"required":["day","kind","overall"],"additionalProperties":false}},{"name":"prepare_handover_signature","label":"Prepare handover for responsible staff","module":"handover","path":"/handover","permission":"shift","review":true,"applyMode":"module","scope":"centre","parameters":{"type":"OBJECT","properties":{"id":{"type":"STRING","description":""},"summary":{"type":"STRING","description":""},"expected_snapshot":{"type":"STRING","description":"Exact expected_snapshot returned by read_operation_target for this operation and target"}},"required":["id","expected_snapshot","summary"],"additionalProperties":false}},{"name":"prepare_shift_task","label":"Prepare Shift duty","module":"handover","path":"/handover","permission":"shift","review":true,"applyMode":"module","scope":"centre","parameters":{"type":"OBJECT","properties":{"day":{"type":"STRING","description":""},"title":{"type":"STRING","description":""},"assigned_to":{"type":"STRING","description":""},"instructions":{"type":"STRING","description":""},"expected_result":{"type":"STRING","description":""},"due_minute":{"type":"INTEGER","description":""},"priority":{"type":"STRING","enum":["normal","important"]}},"required":["day","title","assigned_to","instructions","expected_result"],"additionalProperties":false}},{"name":"prepare_shift_task_review","label":"Prepare independent Shift duty review","module":"handover","path":"/handover","permission":"shift","review":true,"applyMode":"module","scope":"centre","parameters":{"type":"OBJECT","properties":{"id":{"type":"STRING","description":""},"expected_updated_at":{"type":"STRING","description":""},"decision":{"type":"STRING","enum":["verified","rework"]},"review_note":{"type":"STRING","description":""}},"required":["id","expected_updated_at","decision","review_note"],"additionalProperties":false}},{"name":"self_check_in","label":"Record my check-in","module":"my-desk","path":"/my-desk","permission":"desk","review":false,"applyMode":"database","scope":"centre","parameters":{"type":"OBJECT","properties":{},"required":[],"additionalProperties":false}},{"name":"self_check_out","label":"Record my check-out","module":"my-desk","path":"/my-desk","permission":"desk","review":false,"applyMode":"database","scope":"centre","parameters":{"type":"OBJECT","properties":{},"required":[],"additionalProperties":false}},{"name":"correct_attendance","label":"Correct attendance","module":"attn-admin","path":"/attn-admin","permission":"ws_attn-admin","review":true,"applyMode":"module","scope":"centre","parameters":{"type":"OBJECT","properties":{"id":{"type":"STRING","description":""},"expected_updated_at":{"type":"STRING","description":""},"check_in":{"type":"STRING","description":""},"check_out":{"type":"STRING","description":""},"status":{"type":"STRING","enum":["present","absent","late","half_day"]},"notes":{"type":"STRING","description":""},"reason":{"type":"STRING","description":""}},"required":["id","expected_updated_at","reason"],"additionalProperties":false}},{"name":"submit_application","label":"Submit my application","module":"my-desk","path":"/my-desk","permission":"desk","review":true,"applyMode":"module","scope":"own","parameters":{"type":"OBJECT","properties":{"kind":{"type":"STRING","enum":["leave","toil","swap","emergency_duty","reimbursement"]},"request_date":{"type":"STRING","description":""},"leave_type":{"type":"STRING","description":""},"half_day_period":{"type":"STRING","enum":["first","second"]},"swap_with_id":{"type":"STRING","description":""},"swap_date":{"type":"STRING","description":""},"reason":{"type":"STRING","description":""}},"required":["kind","request_date","reason"],"additionalProperties":false}},{"name":"withdraw_application","label":"Withdraw my application","module":"my-desk","path":"/my-desk","permission":"desk","review":true,"applyMode":"module","scope":"own","parameters":{"type":"OBJECT","properties":{"id":{"type":"STRING","description":""},"expected_updated_at":{"type":"STRING","description":""},"reason":{"type":"STRING","description":""}},"required":["id","expected_updated_at","reason"],"additionalProperties":false}},{"name":"respond_to_swap","label":"Record my swap response","module":"my-desk","path":"/my-desk","permission":"desk","review":true,"applyMode":"module","scope":"own","parameters":{"type":"OBJECT","properties":{"id":{"type":"STRING","description":""},"expected_updated_at":{"type":"STRING","description":""},"accept":{"type":"BOOLEAN","description":""},"reason":{"type":"STRING","description":""}},"required":["id","expected_updated_at","accept"],"additionalProperties":false}},{"name":"resolve_application","label":"Resolve staff application","module":"user-management","path":"/user-management","permission":"user_management_edit","review":true,"applyMode":"module","scope":"centre","parameters":{"type":"OBJECT","properties":{"id":{"type":"STRING","description":""},"expected_updated_at":{"type":"STRING","description":""},"decision":{"type":"STRING","enum":["approved","rejected"]},"admin_reply":{"type":"STRING","description":""}},"required":["id","expected_updated_at","decision","admin_reply"],"additionalProperties":false}},{"name":"submit_ot_claim","label":"Submit my overtime claim","module":"my-desk","path":"/my-desk","permission":"desk","review":false,"applyMode":"database","scope":"own","parameters":{"type":"OBJECT","properties":{"date":{"type":"STRING","description":""},"start_time":{"type":"STRING","description":""},"end_time":{"type":"STRING","description":""},"notes":{"type":"STRING","description":""}},"required":["date","start_time","end_time"],"additionalProperties":false}},{"name":"update_ot_claim","label":"Edit my pending overtime claim","module":"my-desk","path":"/my-desk","permission":"desk","review":false,"applyMode":"database","scope":"own","parameters":{"type":"OBJECT","properties":{"id":{"type":"STRING","description":""},"expected_updated_at":{"type":"STRING","description":""},"start_time":{"type":"STRING","description":""},"end_time":{"type":"STRING","description":""},"notes":{"type":"STRING","description":""}},"required":["id","expected_updated_at"],"additionalProperties":false}},{"name":"resolve_ot_claim","label":"Resolve overtime claim","module":"staff-ot","path":"/staff-ot","permission":"ws_staff-ot","review":true,"applyMode":"module","scope":"centre","parameters":{"type":"OBJECT","properties":{"id":{"type":"STRING","description":""},"expected_updated_at":{"type":"STRING","description":""},"decision":{"type":"STRING","enum":["approved","rejected"]},"approved_hours":{"type":"NUMBER"},"reason":{"type":"STRING","description":""}},"required":["id","expected_updated_at","reason"],"additionalProperties":false}},{"name":"settle_toil","label":"Settle TOIL record","module":"staff-ot","path":"/staff-ot","permission":"ws_staff-ot","review":true,"applyMode":"module","scope":"centre","parameters":{"type":"OBJECT","properties":{"id":{"type":"STRING","description":""},"expected_updated_at":{"type":"STRING","description":""},"compensated_date":{"type":"STRING","description":""},"paid_amount":{"type":"NUMBER"},"reason":{"type":"STRING","description":""}},"required":["id","expected_updated_at","reason"],"additionalProperties":false}},{"name":"update_payroll","label":"Update monthly payroll","module":"staff-ot","path":"/staff-ot","permission":"ws_staff-ot","review":true,"applyMode":"module","scope":"centre","parameters":{"type":"OBJECT","properties":{"id":{"type":"STRING","description":""},"expected_updated_at":{"type":"STRING","description":""},"month":{"type":"STRING","description":""},"paid_days":{"type":"NUMBER"},"adjustment":{"type":"NUMBER"},"reason":{"type":"STRING","description":""}},"required":["id","expected_updated_at","reason"],"additionalProperties":false}},{"name":"create_institution","label":"Create institution","module":"actionables","path":"/actionables","permission":"actionables","review":false,"applyMode":"database","scope":"shared","parameters":{"type":"OBJECT","properties":{"name":{"type":"STRING","description":""},"district":{"type":"STRING","enum":["Kottayam","Ernakulam","Thrissur","Calicut","Kannur"]},"address":{"type":"STRING","description":""},"primary_contact_name":{"type":"STRING","description":""},"primary_contact_phone":{"type":"STRING","description":""},"primary_contact_email":{"type":"STRING","description":""},"primary_contact_role":{"type":"STRING","description":""},"website":{"type":"STRING","description":"Public HTTPS URL"},"notes":{"type":"STRING","description":""}},"required":["name","district","primary_contact_name"],"additionalProperties":false}},{"name":"update_institution","label":"Update institution","module":"actionables","path":"/actionables","permission":"actionables","review":false,"applyMode":"database","scope":"shared","parameters":{"type":"OBJECT","properties":{"name":{"type":"STRING","description":""},"district":{"type":"STRING","enum":["Kottayam","Ernakulam","Thrissur","Calicut","Kannur"]},"address":{"type":"STRING","description":""},"primary_contact_name":{"type":"STRING","description":""},"primary_contact_phone":{"type":"STRING","description":""},"primary_contact_email":{"type":"STRING","description":""},"primary_contact_role":{"type":"STRING","description":""},"website":{"type":"STRING","description":"Public HTTPS URL"},"notes":{"type":"STRING","description":""},"id":{"type":"STRING","description":"Exact saved record ID"},"expected_updated_at":{"type":"STRING","description":"Exact updated_at from the current record"}},"required":["id","expected_updated_at"],"additionalProperties":false}},{"name":"delete_institution","label":"Delete institution and dependent history","module":"actionables","path":"/actionables","permission":"actionables","review":true,"applyMode":"module","scope":"shared","parameters":{"type":"OBJECT","properties":{"id":{"type":"STRING","description":"Exact saved record ID"},"expected_updated_at":{"type":"STRING","description":"Exact current record version or timestamp"},"reason":{"type":"STRING","description":"Reason for irreversible removal"}},"required":["id","expected_updated_at","reason"],"additionalProperties":false}},{"name":"create_institution_stage","label":"Create institution stage","module":"actionables","path":"/actionables","permission":"actionables","review":false,"applyMode":"database","scope":"shared","parameters":{"type":"OBJECT","properties":{"institution_id":{"type":"STRING","description":""},"title":{"type":"STRING","description":""},"instructions":{"type":"STRING","description":""},"contact_script":{"type":"STRING","description":""}},"required":["institution_id","title"],"additionalProperties":false}},{"name":"update_institution_stage","label":"Edit institution stage","module":"actionables","path":"/actionables","permission":"actionables","review":false,"applyMode":"database","scope":"shared","parameters":{"type":"OBJECT","properties":{"id":{"type":"STRING","description":""},"title":{"type":"STRING","description":""},"instructions":{"type":"STRING","description":""},"contact_script":{"type":"STRING","description":""},"expected_snapshot":{"type":"STRING","description":"Exact expected_snapshot returned by read_operation_target for this operation and target"}},"required":["id","expected_snapshot"],"additionalProperties":false}},{"name":"complete_institution_stage","label":"Record stage completion","module":"actionables","path":"/actionables","permission":"actionables","review":true,"applyMode":"module","scope":"shared","parameters":{"type":"OBJECT","properties":{"id":{"type":"STRING","description":""},"completion_note":{"type":"STRING","description":""},"expected_snapshot":{"type":"STRING","description":"Exact expected_snapshot returned by read_operation_target for this operation and target"}},"required":["id","expected_snapshot","completion_note"],"additionalProperties":false}},{"name":"delete_institution_stage","label":"Delete institution stage","module":"actionables","path":"/actionables","permission":"actionables","review":true,"applyMode":"module","scope":"shared","parameters":{"type":"OBJECT","properties":{"id":{"type":"STRING","description":"Exact saved record ID"},"reason":{"type":"STRING","description":"Reason for irreversible removal"},"expected_snapshot":{"type":"STRING","description":"Exact expected_snapshot returned by read_operation_target for this operation and target"}},"required":["id","expected_snapshot","reason"],"additionalProperties":false}},{"name":"delete_institution_duty","label":"Delete institution duty","module":"actionables","path":"/actionables","permission":"actionables","review":true,"applyMode":"module","scope":"shared","parameters":{"type":"OBJECT","properties":{"id":{"type":"STRING","description":"Exact saved record ID"},"expected_updated_at":{"type":"STRING","description":"Exact current record version or timestamp"},"reason":{"type":"STRING","description":"Reason for irreversible removal"}},"required":["id","expected_updated_at","reason"],"additionalProperties":false}},{"name":"delete_institution_result","label":"Delete institution result","module":"actionables","path":"/actionables","permission":"actionables","review":true,"applyMode":"module","scope":"shared","parameters":{"type":"OBJECT","properties":{"id":{"type":"STRING","description":"Exact saved record ID"},"expected_updated_at":{"type":"STRING","description":"Exact current record version or timestamp"},"reason":{"type":"STRING","description":"Reason for irreversible removal"}},"required":["id","expected_updated_at","reason"],"additionalProperties":false}},{"name":"create_institution_duty","label":"Create institution duty","module":"actionables","path":"/actionables","permission":"actionables","review":false,"applyMode":"database","scope":"shared","parameters":{"type":"OBJECT","properties":{"institution_id":{"type":"STRING","description":""},"title":{"type":"STRING","description":""},"instructions":{"type":"STRING","description":""},"owner_id":{"type":"STRING","description":"Verified profile UUID"},"institution_stage_id":{"type":"STRING","description":""},"due_at":{"type":"STRING","description":"ISO timestamp including +05:30 or Z"},"report_to_id":{"type":"STRING","description":"Verified Auth UUID"},"report_instructions":{"type":"STRING","description":""}},"required":["institution_id","title","instructions","owner_id","due_at","report_to_id","report_instructions"],"additionalProperties":false}},{"name":"update_institution_duty","label":"Update institution duty","module":"actionables","path":"/actionables","permission":"actionables","review":false,"applyMode":"database","scope":"shared","parameters":{"type":"OBJECT","properties":{"institution_id":{"type":"STRING","description":""},"title":{"type":"STRING","description":""},"instructions":{"type":"STRING","description":""},"owner_id":{"type":"STRING","description":"Verified profile UUID"},"institution_stage_id":{"type":"STRING","description":""},"due_at":{"type":"STRING","description":"ISO timestamp including +05:30 or Z"},"report_to_id":{"type":"STRING","description":"Verified Auth UUID"},"report_instructions":{"type":"STRING","description":""},"id":{"type":"STRING","description":"Exact saved record ID"},"expected_updated_at":{"type":"STRING","description":"Exact updated_at from the current record"}},"required":["id","expected_updated_at"],"additionalProperties":false}},{"name":"record_institution_result","label":"Record duty result","module":"actionables","path":"/actionables","permission":"actionables","review":false,"applyMode":"database","scope":"shared","parameters":{"type":"OBJECT","properties":{"work_item_id":{"type":"STRING","description":""},"content":{"type":"STRING","description":""},"status":{"type":"STRING","enum":["in_progress","blocked","done"]},"follow_up_at":{"type":"STRING","description":""}},"required":["work_item_id","content","status"],"additionalProperties":false}},{"name":"create_asset","label":"Create asset","module":"system-manager","path":"/system-manager","permission":"ws_system-manager","review":false,"applyMode":"database","scope":"centre","parameters":{"type":"OBJECT","properties":{"name":{"type":"STRING","description":""},"system_type":{"type":"STRING","enum":["admin","server","workstation","peripheral","rented"]},"status":{"type":"STRING","enum":["operational","maintenance","fault"]},"serial_number":{"type":"STRING","description":""},"category_name":{"type":"STRING","description":""},"it_item_type":{"type":"STRING","description":""}},"required":["name","system_type"],"additionalProperties":false}},{"name":"update_asset","label":"Update asset","module":"system-manager","path":"/system-manager","permission":"ws_system-manager","review":false,"applyMode":"database","scope":"centre","parameters":{"type":"OBJECT","properties":{"name":{"type":"STRING","description":""},"system_type":{"type":"STRING","enum":["admin","server","workstation","peripheral","rented"]},"status":{"type":"STRING","enum":["operational","maintenance","fault"]},"serial_number":{"type":"STRING","description":""},"category_name":{"type":"STRING","description":""},"it_item_type":{"type":"STRING","description":""},"id":{"type":"STRING","description":"Exact saved record ID"},"expected_updated_at":{"type":"STRING","description":"Exact updated_at from the current record"}},"required":["id","expected_updated_at"],"additionalProperties":false}},{"name":"delete_asset","label":"Delete asset","module":"system-manager","path":"/system-manager","permission":"ws_system-manager","review":true,"applyMode":"module","scope":"centre","parameters":{"type":"OBJECT","properties":{"id":{"type":"STRING","description":"Exact saved record ID"},"expected_updated_at":{"type":"STRING","description":"Exact current record version or timestamp"},"reason":{"type":"STRING","description":"Reason for irreversible removal"}},"required":["id","expected_updated_at","reason"],"additionalProperties":false}},{"name":"add_asset_service_note","label":"Record asset service note","module":"system-manager","path":"/system-manager","permission":"ws_system-manager","review":false,"applyMode":"database","scope":"centre","parameters":{"type":"OBJECT","properties":{"system_id":{"type":"STRING","description":""},"description":{"type":"STRING","description":""}},"required":["system_id","description"],"additionalProperties":false}},{"name":"create_lost_found_item","label":"Create lost or found item","module":"command-center","path":"/","permission":"lost_found","review":false,"applyMode":"database","scope":"centre","parameters":{"type":"OBJECT","properties":{"description":{"type":"STRING","description":""},"found_location":{"type":"STRING","description":""},"category":{"type":"STRING","enum":["electronics","documents","clothing","accessories","other"]},"item_type":{"type":"STRING","enum":["lost","found"]},"locker":{"type":"STRING","description":""},"perishable":{"type":"BOOLEAN","description":""}},"required":["description","found_location"],"additionalProperties":false}},{"name":"update_lost_found_item","label":"Update lost or found item","module":"command-center","path":"/","permission":"lost_found","review":false,"applyMode":"database","scope":"centre","parameters":{"type":"OBJECT","properties":{"description":{"type":"STRING","description":""},"found_location":{"type":"STRING","description":""},"category":{"type":"STRING","enum":["electronics","documents","clothing","accessories","other"]},"item_type":{"type":"STRING","enum":["lost","found"]},"locker":{"type":"STRING","description":""},"perishable":{"type":"BOOLEAN","description":""},"id":{"type":"STRING","description":"Exact saved record ID"},"expected_snapshot":{"type":"STRING","description":"Exact expected_snapshot returned by read_operation_target for this operation and target"}},"required":["id","expected_snapshot"],"additionalProperties":false}},{"name":"release_lost_found_item","label":"Prepare property release","module":"command-center","path":"/","permission":"lost_found","review":true,"applyMode":"module","scope":"centre","parameters":{"type":"OBJECT","properties":{"id":{"type":"STRING","description":""},"claimant_name":{"type":"STRING","description":""},"reason":{"type":"STRING","description":""},"expected_snapshot":{"type":"STRING","description":"Exact expected_snapshot returned by read_operation_target for this operation and target"}},"required":["id","expected_snapshot","claimant_name","reason"],"additionalProperties":false}},{"name":"delete_lost_found_item","label":"Delete lost or found item","module":"command-center","path":"/","permission":"lost_found","review":true,"applyMode":"module","scope":"centre","parameters":{"type":"OBJECT","properties":{"id":{"type":"STRING","description":"Exact saved record ID"},"reason":{"type":"STRING","description":"Reason for irreversible removal"},"expected_snapshot":{"type":"STRING","description":"Exact expected_snapshot returned by read_operation_target for this operation and target"}},"required":["id","expected_snapshot","reason"],"additionalProperties":false}},{"name":"publish_news","label":"Publish announcement","module":"news-manager","path":"/news-manager","permission":"ws_news-manager","review":true,"applyMode":"module","scope":"centre","parameters":{"type":"OBJECT","properties":{"content":{"type":"STRING","description":""},"priority":{"type":"STRING","enum":["normal","high","urgent"]},"expires_at":{"type":"STRING","description":""}},"required":["content","priority"],"additionalProperties":false}},{"name":"remove_news","label":"Remove announcement","module":"news-manager","path":"/news-manager","permission":"ws_news-manager","review":true,"applyMode":"module","scope":"centre","parameters":{"type":"OBJECT","properties":{"id":{"type":"STRING","description":""},"reason":{"type":"STRING","description":""},"expected_snapshot":{"type":"STRING","description":"Exact expected_snapshot returned by read_operation_target for this operation and target"}},"required":["id","expected_snapshot","reason"],"additionalProperties":false}},{"name":"publish_business_update","label":"Prepare business profile update","module":"business","path":"/business","permission":"ws_business","review":true,"applyMode":"module","scope":"centre","parameters":{"type":"OBJECT","properties":{"destination":{"type":"STRING","description":"Exact known business location"},"content":{"type":"STRING","description":""},"source_url":{"type":"STRING","description":""}},"required":["destination","content"],"additionalProperties":false}},{"name":"reply_business_review","label":"Prepare business review reply","module":"business","path":"/business","permission":"ws_business","review":true,"applyMode":"module","scope":"centre","parameters":{"type":"OBJECT","properties":{"review_id":{"type":"STRING","description":""},"destination":{"type":"STRING","description":""},"reply":{"type":"STRING","description":""}},"required":["review_id","destination","reply"],"additionalProperties":false}},{"name":"send_team_message","label":"Send team message","module":"fets-chat","path":"/fets-chat","permission":"ws_fets-chat","review":true,"applyMode":"database","scope":"centre","parameters":{"type":"OBJECT","properties":{"conversation_id":{"type":"STRING","description":""},"content":{"type":"STRING","description":""}},"required":["conversation_id","content"],"additionalProperties":false}},{"name":"create_team_group","label":"Create team group","module":"fets-chat","path":"/fets-chat","permission":"ws_fets-chat","review":true,"applyMode":"module","scope":"centre","parameters":{"type":"OBJECT","properties":{"name":{"type":"STRING","description":""},"member_ids":{"type":"ARRAY","items":{"type":"STRING","description":""},"description":"Verified Auth UUIDs"}},"required":["name","member_ids"],"additionalProperties":false}},{"name":"add_team_members","label":"Invite team members","module":"fets-chat","path":"/fets-chat","permission":"ws_fets-chat","review":true,"applyMode":"module","scope":"centre","parameters":{"type":"OBJECT","properties":{"conversation_id":{"type":"STRING","description":""},"member_ids":{"type":"ARRAY","items":{"type":"STRING","description":""},"description":""}},"required":["conversation_id","member_ids"],"additionalProperties":false}},{"name":"remove_team_member","label":"Remove team member","module":"fets-chat","path":"/fets-chat","permission":"ws_fets-chat","review":true,"applyMode":"module","scope":"centre","parameters":{"type":"OBJECT","properties":{"conversation_id":{"type":"STRING","description":""},"member_id":{"type":"STRING","description":""}},"required":["conversation_id","member_id"],"additionalProperties":false}},{"name":"create_desk_note","label":"Create personal note","module":"my-desk","path":"/my-desk","permission":"desk","review":false,"applyMode":"database","scope":"own","parameters":{"type":"OBJECT","properties":{"title":{"type":"STRING","description":""},"content":{"type":"STRING","description":""},"category":{"type":"STRING","enum":["note","idea","task","reflection","dream","memo","journal","quote"]},"is_starred":{"type":"BOOLEAN","description":""},"is_pinned":{"type":"BOOLEAN","description":""}},"required":["title","content"],"additionalProperties":false}},{"name":"update_desk_note","label":"Update personal note","module":"my-desk","path":"/my-desk","permission":"desk","review":false,"applyMode":"database","scope":"own","parameters":{"type":"OBJECT","properties":{"title":{"type":"STRING","description":""},"content":{"type":"STRING","description":""},"category":{"type":"STRING","enum":["note","idea","task","reflection","dream","memo","journal","quote"]},"is_starred":{"type":"BOOLEAN","description":""},"is_pinned":{"type":"BOOLEAN","description":""},"id":{"type":"STRING","description":"Exact saved record ID"},"expected_updated_at":{"type":"STRING","description":"Exact updated_at from the current record"}},"required":["id","expected_updated_at"],"additionalProperties":false}},{"name":"delete_desk_note","label":"Delete personal note","module":"my-desk","path":"/my-desk","permission":"desk","review":true,"applyMode":"database","scope":"own","parameters":{"type":"OBJECT","properties":{"id":{"type":"STRING","description":"Exact saved record ID"},"expected_updated_at":{"type":"STRING","description":"Exact current record version or timestamp"},"reason":{"type":"STRING","description":"Reason for irreversible removal"}},"required":["id","expected_updated_at","reason"],"additionalProperties":false}},{"name":"save_desk_journal","label":"Save my journal","module":"my-desk","path":"/my-desk","permission":"desk","review":false,"applyMode":"database","scope":"own","parameters":{"type":"OBJECT","properties":{"date":{"type":"STRING","description":""},"note":{"type":"STRING","description":""},"mood":{"type":"STRING","enum":["","bright","steady","focused","slow"]},"expected_version":{"type":"INTEGER","description":""}},"required":["date","note","expected_version"],"additionalProperties":false}},{"name":"save_desk_preferences","label":"Save my desk preferences","module":"my-desk","path":"/my-desk","permission":"desk","review":false,"applyMode":"database","scope":"own","parameters":{"type":"OBJECT","properties":{"cover":{"type":"STRING","enum":["peach","sage","lilac"]},"expected_version":{"type":"INTEGER","description":""}},"required":["cover","expected_version"],"additionalProperties":false}},{"name":"prepare_document","label":"Prepare document in existing workspace","module":"my-desk","path":"/my-desk","permission":"desk","review":true,"applyMode":"module","scope":"own","parameters":{"type":"OBJECT","properties":{"title":{"type":"STRING","description":""},"purpose":{"type":"STRING","description":""},"content":{"type":"STRING","description":""}},"required":["title","purpose","content"],"additionalProperties":false}},{"name":"share_document","label":"Prepare document sharing","module":"my-desk","path":"/my-desk","permission":"desk","review":true,"applyMode":"module","scope":"own","parameters":{"type":"OBJECT","properties":{"document_id":{"type":"STRING","description":""},"destination":{"type":"STRING","description":""},"reason":{"type":"STRING","description":""}},"required":["document_id","destination","reason"],"additionalProperties":false}},{"name":"update_staff_profile","label":"Edit staff profile","module":"profile","path":"/profile","permission":"profile","review":false,"applyMode":"database","scope":"own","parameters":{"type":"OBJECT","properties":{"id":{"type":"STRING","description":""},"expected_updated_at":{"type":"STRING","description":""},"full_name":{"type":"STRING","description":""},"department":{"type":"STRING","description":""},"position":{"type":"STRING","description":""},"bio":{"type":"STRING","description":""}},"required":["id","expected_updated_at"],"additionalProperties":false}},{"name":"prepare_staff_invitation","label":"Prepare staff invitation","module":"user-management","path":"/user-management","permission":"user_management_edit","review":true,"applyMode":"module","scope":"centre","parameters":{"type":"OBJECT","properties":{"full_name":{"type":"STRING","description":""},"email":{"type":"STRING","description":""},"branch":{"type":"STRING","enum":["cochin","calicut","kannur"]},"role":{"type":"STRING","enum":["fetsian","staff","admin"]}},"required":["full_name","email","branch","role"],"additionalProperties":false}},{"name":"change_staff_access","label":"Prepare staff access change","module":"user-management","path":"/user-management","permission":"user_management_edit","review":true,"applyMode":"module","scope":"centre","parameters":{"type":"OBJECT","properties":{"id":{"type":"STRING","description":""},"expected_updated_at":{"type":"STRING","description":""},"role":{"type":"STRING","enum":["fetsian","staff","admin","super_admin"]},"is_active":{"type":"BOOLEAN","description":""},"permission_key":{"type":"STRING","description":"One known User Management boolean key"},"permission_value":{"type":"BOOLEAN","description":""},"reason":{"type":"STRING","description":""}},"required":["id","expected_updated_at","reason"],"additionalProperties":false}},{"name":"archive_staff","label":"Prepare staff archival","module":"user-management","path":"/user-management","permission":"user_management_edit","review":true,"applyMode":"module","scope":"centre","parameters":{"type":"OBJECT","properties":{"id":{"type":"STRING","description":""},"expected_updated_at":{"type":"STRING","description":""},"employment_end_date":{"type":"STRING","description":""},"reason":{"type":"STRING","description":""}},"required":["id","expected_updated_at","employment_end_date","reason"],"additionalProperties":false}},{"name":"grant_branch_delegation","label":"Prepare branch delegation","module":"branch-delegation","path":"/branch-delegation","permission":"ws_branch-delegation","review":true,"applyMode":"module","scope":"centre","parameters":{"type":"OBJECT","properties":{"profile_id":{"type":"STRING","description":""},"allowed_branch":{"type":"STRING","enum":["cochin","calicut","both"]},"start_date":{"type":"STRING","description":""},"end_date":{"type":"STRING","description":""},"reason":{"type":"STRING","description":""}},"required":["profile_id","allowed_branch","start_date","end_date","reason"],"additionalProperties":false}},{"name":"revoke_branch_delegation","label":"Prepare delegation removal","module":"branch-delegation","path":"/branch-delegation","permission":"ws_branch-delegation","review":true,"applyMode":"module","scope":"centre","parameters":{"type":"OBJECT","properties":{"id":{"type":"STRING","description":""},"reason":{"type":"STRING","description":""},"expected_snapshot":{"type":"STRING","description":"Exact expected_snapshot returned by read_operation_target for this operation and target"}},"required":["id","expected_snapshot","reason"],"additionalProperties":false}},{"name":"publish_knowledge","label":"Publish verified guide","module":"fets-intelligence","path":"/fets-intelligence","permission":"knowledge","review":true,"applyMode":"database","scope":"shared","parameters":{"type":"OBJECT","properties":{"title":{"type":"STRING","description":""},"content":{"type":"STRING","description":""},"source_url":{"type":"STRING","description":"Verified public source URL"},"category":{"type":"STRING","description":""}},"required":["title","content","source_url"],"additionalProperties":false}},{"name":"archive_knowledge","label":"Archive guide","module":"fets-intelligence","path":"/fets-intelligence","permission":"knowledge","review":true,"applyMode":"database","scope":"shared","parameters":{"type":"OBJECT","properties":{"id":{"type":"STRING","description":""},"expected_updated_at":{"type":"STRING","description":""},"reason":{"type":"STRING","description":""}},"required":["id","expected_updated_at","reason"],"additionalProperties":false}},{"name":"change_ai_settings","label":"Prepare supported AI settings","module":"fets-intelligence","path":"/fets-intelligence","permission":"settings","review":true,"applyMode":"module","scope":"shared","parameters":{"type":"OBJECT","properties":{"provider":{"type":"STRING","enum":["gemini","claude"]},"gemini_model":{"type":"STRING","description":""},"claude_model":{"type":"STRING","description":""},"max_tool_iterations":{"type":"INTEGER","description":""},"reason":{"type":"STRING","description":""}},"required":["reason"],"additionalProperties":false}},{"name":"prepare_access_item","label":"Prepare Access Hub metadata","module":"access-hub","path":"/access-hub","permission":"ws_access-hub","review":true,"applyMode":"module","scope":"own","parameters":{"type":"OBJECT","properties":{"title":{"type":"STRING","description":""},"category":{"type":"STRING","description":""},"url":{"type":"STRING","description":"Public portal URL; never credentials"},"description":{"type":"STRING","description":""}},"required":["title","category","url"],"additionalProperties":false}},{"name":"open_access_portal","label":"Open Access Hub workflow","module":"access-hub","path":"/access-hub","permission":"ws_access-hub","review":true,"applyMode":"module","scope":"own","parameters":{"type":"OBJECT","properties":{"title":{"type":"STRING","description":""},"url":{"type":"STRING","description":"Public portal URL; account secrets are entered only in the existing module"}},"required":["title","url"],"additionalProperties":false}}]$registry$::jsonb $catalog$;
create function fets_ai_private.operation_definition(n text) returns jsonb language sql immutable set search_path='' as $$select d from jsonb_array_elements(fets_ai_private.operation_catalog()) d where d->>'name'=n$$;
create or replace function fets_ai_private.execute_action(p_tool text,p_args jsonb,p_branch text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); b text:=lower(btrim(p_branch)); role_name text; settings public.ai_settings;
 arg_hash text; result jsonb; prev jsonb; saved jsonb; allowed text[]; k text;
 rec_id text; target_user uuid; table_name text; module_path text; err text; outcome text;
 is_update boolean:=p_tool like 'update_%'; i public.incidents; t public.user_tasks; c public.calendar_sessions;
begin
 if actor is null or p_request_id is null then raise exception 'Authenticated identity and request UUID required' using errcode='42501';end if;
 if p_tool is null or length(p_tool)>80 or p_args is null or jsonb_typeof(p_args)<>'object' or octet_length(p_args::text)>20000 or b is null or length(b)>80 then raise exception 'Invalid action request' using errcode='22023';end if;
 arg_hash:=encode(sha256(convert_to(jsonb_build_object('branch',b,'args',p_args)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||p_request_id::text||':'||p_tool||':'||arg_hash,92704));
 role_name:=fets_ai_private.actor_role(b);
 if role_name is null or b not in ('cochin','calicut') then
  -- Do not replay previously authorized evidence after access has been revoked.
  result:=jsonb_build_object('type','action-result','tool',p_tool,'status','blocked','message','Active verified centre membership required');
  insert into public.fets_ai_action_log(user_id,branch,request_id,tool_name,argument_hash,status,is_write,error_message,result)
   values(actor,b,p_request_id,p_tool,arg_hash,'blocked',true,result->>'message',result) on conflict do nothing;
  return result;
 end if;
 select l.result into result from public.fets_ai_action_log l where l.user_id=actor and l.request_id=p_request_id and l.tool_name=p_tool and l.argument_hash=arg_hash;
 if found then return result||jsonb_build_object('replayed',true);end if;
 outcome:='succeeded';
 -- A subtransaction rolls back any failed mutation while retaining its audit below.
 begin
  if p_tool not in ('create_incident','update_incident','create_task','update_task','create_session','update_session') then raise exception 'Unknown or forbidden action tool' using errcode='42501';end if;
  select * into settings from public.ai_settings where id=1 for share;
  if not found or settings.kill_switch is distinct from false or settings.autonomous_enabled is distinct from true then raise exception 'Operational writes are OFF' using errcode='42501';end if;
  if not fets_ai_private.permitted(case when p_tool in ('create_incident','update_incident') then 'ws_case' when p_tool in ('create_session','update_session') then 'calendar' else 'desk' end,b) then raise exception 'User Management does not permit this operation' using errcode='42501';end if;
  if p_tool in ('create_incident','update_incident') then
   allowed:=array['title','description','severity','category','status','notes','due_date','assigned_to'];table_name:='incidents';module_path:='/incident-log';
  elsif p_tool in ('create_task','update_task') then
   allowed:=array['title','description','priority','status','due_date','assigned_to'];table_name:='user_tasks';module_path:='/my-desk';
  else
   allowed:=array['client_name','exam_name','date','start_time','end_time','candidate_count','status'];table_name:='calendar_sessions';module_path:='/calendar';
  end if;
  if is_update then allowed:=allowed||array['id','expected_updated_at'];end if;
  for k in select jsonb_object_keys(p_args) loop
   if not(k=any(allowed)) then raise exception 'Unknown or immutable action field: %',k using errcode='42501';end if;
   if jsonb_typeof(p_args->k) not in ('string','null','number') then raise exception 'Action fields must be scalar values' using errcode='22023';end if;
  end loop;
  if is_update and (nullif(p_args->>'id','') is null or nullif(p_args->>'expected_updated_at','') is null) then raise exception 'Updates require id and expected_updated_at' using errcode='42501';end if;
  if p_args ? 'title' and (p_args->>'title' is null or length(btrim(p_args->>'title')) not between 1 and 200) then raise exception 'Title must contain 1 to 200 characters' using errcode='22023';end if;
  foreach k in array array['description','notes'] loop
   if length(p_args->>k)>12000 then raise exception 'Action text is too long' using errcode='22023';end if;
  end loop;
  if p_args ? 'assigned_to' and p_args->>'assigned_to' is not null then
   target_user:=(p_args->>'assigned_to')::uuid;
   if not fets_ai_private.member_active(target_user,b) then raise exception 'Assignee must be active verified staff in this centre' using errcode='42501';end if;
   if role_name='staff' and target_user<>actor then raise exception 'Staff may only create or assign their own work' using errcode='42501';end if;
  end if;
  if p_tool in ('create_incident','update_incident') then
   if p_args ? 'severity' and coalesce(p_args->>'severity','') not in ('critical','major','minor') then raise exception 'Invalid incident severity' using errcode='22023';end if;
   if p_args ? 'status' and coalesce(p_args->>'status','') not in ('open','assigned','in_progress','escalated','closed') then raise exception 'Invalid incident status' using errcode='22023';end if;
   if p_args ? 'category' and coalesce(p_args->>'category','') not in ('computer','equipment','property','staff','candidate','client','utility','other','roster','calendar','facility','systems','network','exam','assets','vendor') then raise exception 'Invalid incident category' using errcode='22023';end if;
   if is_update then
    select * into i from public.incidents where id=(p_args->>'id')::uuid for update;
    if not found or i.branch_location is distinct from b or (role_name='staff' and i.user_id<>actor and i.assigned_to is distinct from actor) then raise exception 'Incident is outside your owned or assigned centre scope' using errcode='42501';end if;
    if i.updated_at is distinct from (p_args->>'expected_updated_at')::timestamptz then raise exception 'Record changed; reload before updating' using errcode='42501';end if;
    if p_args ? 'assigned_to' and role_name='staff' and i.assigned_to is distinct from target_user then raise exception 'Only management can reassign existing work' using errcode='42501';end if;
    prev:=jsonb_build_object('id',i.id,'title',i.title,'status',i.status,'severity',i.severity,'category',i.category,'updated_at',i.updated_at);
    update public.incidents set
     title=case when p_args ? 'title' then p_args->>'title' else i.title end,
     description=case when p_args ? 'description' then p_args->>'description' else i.description end,
     severity=case when p_args ? 'severity' then p_args->>'severity' else i.severity end,
     category=case when p_args ? 'category' then p_args->>'category' else i.category end,
     status=case when p_args ? 'status' then p_args->>'status' else i.status end,
     notes=case when p_args ? 'notes' then p_args->>'notes' else i.notes end,
     due_date=case when p_args ? 'due_date' then (p_args->>'due_date')::date else i.due_date end,
     assigned_to=case when p_args ? 'assigned_to' then target_user else i.assigned_to end,
     completed_at=case when p_args->>'status'='closed' then clock_timestamp() when p_args ? 'status' and p_args->>'status'<>'closed' then null else i.completed_at end,
     updated_at=clock_timestamp() where id=i.id returning * into i;
   else
    if nullif(btrim(p_args->>'title'),'') is null or nullif(btrim(p_args->>'description'),'') is null then raise exception 'Incident title and description required' using errcode='22023';end if;
    insert into public.incidents(title,description,severity,category,status,notes,due_date,assigned_to,user_id,reporter,branch_location)
     values(btrim(p_args->>'title'),p_args->>'description',coalesce(p_args->>'severity','minor'),coalesce(p_args->>'category','other'),coalesce(p_args->>'status','open'),p_args->>'notes',(p_args->>'due_date')::date,target_user,actor,
      (select s.full_name from public.staff_profiles s join public.centre_duty_members m on m.profile_id=s.id and m.user_id=s.user_id where m.user_id=actor order by m.branch limit 1),b) returning * into i;
   end if;
   rec_id:=i.id::text;saved:=jsonb_build_object('id',i.id,'title',i.title,'status',i.status,'severity',i.severity,'category',i.category,'updated_at',i.updated_at);
  elsif p_tool in ('create_task','update_task') then
   if p_args ? 'priority' and coalesce(p_args->>'priority','') not in ('low','medium','high') then raise exception 'Invalid task priority' using errcode='22023';end if;
   if p_args ? 'status' and coalesce(p_args->>'status','') not in ('pending','in_progress','completed','cancelled') then raise exception 'Invalid task status' using errcode='22023';end if;
   if is_update then
    select * into t from public.user_tasks where id=(p_args->>'id')::uuid for update;
    if not found or (t.branch_location is not null and t.branch_location<>b) or (role_name='staff' and t.assigned_to<>actor and t.assigned_by<>actor) then raise exception 'Task is outside your owned or assigned centre scope' using errcode='42501';end if;
    -- Legacy tasks have no centre: require both identities to belong only to this centre.
    if t.branch_location is null and (
     not fets_ai_private.member_active(t.assigned_to,b) or not fets_ai_private.member_active(t.assigned_by,b)
     or exists(select 1 from public.centre_duty_members where user_id in (t.assigned_to,t.assigned_by) and branch<>b)
    ) then raise exception 'Legacy task centre is ambiguous; use existing workflow' using errcode='42501';end if;
    if t.updated_at is distinct from (p_args->>'expected_updated_at')::timestamptz then raise exception 'Record changed; reload before updating' using errcode='42501';end if;
    if p_args ? 'assigned_to' and role_name='staff' and t.assigned_to is distinct from target_user then raise exception 'Only management can reassign existing work' using errcode='42501';end if;
    prev:=jsonb_build_object('id',t.id,'title',t.title,'status',t.status,'priority',t.priority,'updated_at',t.updated_at);
    update public.user_tasks set title=case when p_args ? 'title' then p_args->>'title' else t.title end,
     description=case when p_args ? 'description' then p_args->>'description' else t.description end,
     priority=case when p_args ? 'priority' then p_args->>'priority' else t.priority end,
     status=case when p_args ? 'status' then p_args->>'status' else t.status end,
     due_date=case when p_args ? 'due_date' then (p_args->>'due_date')::timestamptz else t.due_date end,
     assigned_to=case when p_args ? 'assigned_to' then target_user else t.assigned_to end,
     completed_at=case when p_args->>'status'='completed' then clock_timestamp() when p_args ? 'status' and p_args->>'status'<>'completed' then null else t.completed_at end,
     updated_at=clock_timestamp() where id=t.id returning * into t;
   else
    if nullif(btrim(p_args->>'title'),'') is null then raise exception 'Task title required' using errcode='22023';end if;
    insert into public.user_tasks(title,description,priority,status,due_date,assigned_to,assigned_by,branch_location)
     values(btrim(p_args->>'title'),p_args->>'description',coalesce(p_args->>'priority','medium'),coalesce(p_args->>'status','pending'),(p_args->>'due_date')::timestamptz,coalesce(target_user,actor),actor,b) returning * into t;
   end if;
   rec_id:=t.id::text;saved:=jsonb_build_object('id',t.id,'title',t.title,'status',t.status,'priority',t.priority,'updated_at',t.updated_at);
  else
   foreach k in array array['client_name','exam_name'] loop
    if p_args ? k and (p_args->>k is null or length(btrim(p_args->>k)) not between 1 and 200) then raise exception 'Calendar names must contain 1 to 200 characters' using errcode='22023';end if;
   end loop;
   if p_args ? 'status' and coalesce(p_args->>'status','') not in ('scheduled','in_progress','completed','cancelled') then raise exception 'Invalid session status' using errcode='22023';end if;
   if p_args ? 'candidate_count' and (p_args->>'candidate_count' is null or (p_args->>'candidate_count')::integer not between 0 and 10000) then raise exception 'Invalid candidate total' using errcode='22023';end if;
   if is_update then
    select * into c from public.calendar_sessions where id=(p_args->>'id')::bigint for update;
    if not found or c.branch_location is distinct from b then raise exception 'Session is outside the selected centre' using errcode='42501';end if;
    if c.updated_at is distinct from (p_args->>'expected_updated_at')::timestamptz then raise exception 'Record changed; reload before updating' using errcode='42501';end if;
    prev:=jsonb_build_object('id',c.id::text,'client_name',c.client_name,'exam_name',c.exam_name,'date',c.date,'start_time',c.start_time,'end_time',c.end_time,'status',c.status,'candidate_count',c.candidate_count,'updated_at',c.updated_at);
    c.client_name:=case when p_args ? 'client_name' then p_args->>'client_name' else c.client_name end;
    c.exam_name:=case when p_args ? 'exam_name' then p_args->>'exam_name' else c.exam_name end;
    c.date:=case when p_args ? 'date' then (p_args->>'date')::date else c.date end;
    c.start_time:=case when p_args ? 'start_time' then (p_args->>'start_time')::time else c.start_time end;
    c.end_time:=case when p_args ? 'end_time' then (p_args->>'end_time')::time else c.end_time end;
    c.candidate_count:=case when p_args ? 'candidate_count' then (p_args->>'candidate_count')::int else c.candidate_count end;
    c.status:=case when p_args ? 'status' then p_args->>'status' else c.status end;
   else
    c.client_name:=btrim(p_args->>'client_name');c.exam_name:=btrim(p_args->>'exam_name');c.date:=(p_args->>'date')::date;c.start_time:=(p_args->>'start_time')::time;c.end_time:=(p_args->>'end_time')::time;c.candidate_count:=coalesce((p_args->>'candidate_count')::int,0);c.status:=coalesce(p_args->>'status','scheduled');
   end if;
   if nullif(c.client_name,'') is null or nullif(c.exam_name,'') is null or c.date is null or c.start_time is null or c.end_time is null or c.start_time>=c.end_time then raise exception 'Session needs client, exam, date and increasing start/end times' using errcode='22023';end if;
   if is_update then
    update public.calendar_sessions set client_name=c.client_name,exam_name=c.exam_name,date=c.date,start_time=c.start_time,end_time=c.end_time,candidate_count=c.candidate_count,status=c.status,updated_at=clock_timestamp() where id=c.id returning * into c;
   else
    insert into public.calendar_sessions(client_name,exam_name,date,start_time,end_time,candidate_count,status,user_id,branch_location)
     values(c.client_name,c.exam_name,c.date,c.start_time,c.end_time,c.candidate_count,c.status,actor,b) returning * into c;
   end if;
   rec_id:=c.id::text;saved:=jsonb_build_object('id',c.id::text,'client_name',c.client_name,'exam_name',c.exam_name,'date',c.date,'start_time',c.start_time,'end_time',c.end_time,'status',c.status,'candidate_count',c.candidate_count,'updated_at',c.updated_at);
  end if;
  result:=jsonb_build_object('type','action-result','tool',p_tool,'status','succeeded','recordId',rec_id,'path',module_path,'title',coalesce(saved->>'title',saved->>'exam_name'),'record',saved,'message','Saved');
 exception when others then
  get stacked diagnostics err=message_text;
  -- Do not expose constraint definitions, triggers, SQL text or unrelated data.
  outcome:=case when sqlstate in ('42501','22023','22P02','22007','22008','23502','23503','23514','22001') then 'blocked' else 'failed' end;
  if outcome='failed' then err:='The database could not complete the action. Retry or use the existing module.';end if;
  saved:=null;rec_id:=null;
  result:=jsonb_build_object('type','action-result','tool',p_tool,'status',outcome,'message',err);
 end;
 insert into public.fets_ai_action_log(user_id,branch,request_id,tool_name,argument_hash,status,is_write,table_affected,record_id,before_snapshot,after_snapshot,error_message,result)
 values(actor,b,p_request_id,p_tool,arg_hash,outcome,true,table_name,rec_id,prev,saved,case when outcome<>'succeeded' then err end,result);
 return result;
end $$;

CREATE OR REPLACE FUNCTION public.notify_shift_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  staff_name TEXT;
  staff_branch TEXT;
  old_shift TEXT;
  new_shift TEXT;
  is_leave_or_ot BOOLEAN;
BEGIN
  -- Only notify on shift_code change
  IF OLD.shift_code = NEW.shift_code THEN
    RETURN NEW;
  END IF;

  old_shift := COALESCE(OLD.shift_code, 'None');
  new_shift := COALESCE(NEW.shift_code, 'None');

  -- STRICT FILTER: ONLY notify for leave and OT related changes
  is_leave_or_ot := FALSE;
  
  -- Leave codes: CL (Casual Leave), SL (Sick Leave), EL (Earned Leave), PLV (Privilege Leave), AL (Annual Leave), Absent
  IF old_shift IN ('CL', 'SL', 'EL', 'PLV', 'AL', 'absent', 'Absent', 'LOP', 'WFH') OR 
     new_shift IN ('CL', 'SL', 'EL', 'PLV', 'AL', 'absent', 'Absent', 'LOP', 'WFH') THEN
    is_leave_or_ot := TRUE;
  END IF;

  -- OT/Overtime check: only if overtime_hours changed or if it's explicitly OT
  IF (OLD.overtime_hours IS DISTINCT FROM NEW.overtime_hours AND NEW.overtime_hours > 0) OR
     old_shift = 'OT' OR new_shift = 'OT' THEN
    is_leave_or_ot := TRUE;
  END IF;

  -- If it's NOT a leave or OT change, skip notification completely
  IF NOT is_leave_or_ot THEN
    RETURN NEW;
  END IF;

  -- Get staff info
  SELECT full_name, branch_assigned INTO staff_name, staff_branch
  FROM public.staff_profiles
  WHERE id = NEW.profile_id;

  -- Create notification only for leave/OT changes
  INSERT INTO public.notifications (
    recipient_id,
    type,
    title,
    message,
    link,
    priority,
    metadata,
    branch_location
  ) VALUES (
    NEW.profile_id,
    'shift_changed',
    CASE 
      WHEN NEW.overtime_hours > 0 THEN 'Overtime Updated'
      WHEN new_shift IN ('CL', 'SL', 'EL', 'PLV', 'AL', 'LOP', 'WFH', 'absent', 'Absent') THEN 'Leave Updated'
      ELSE 'Roster Update'
    END,
    CASE
      WHEN NEW.overtime_hours > 0 THEN 'OT on ' || TO_CHAR(NEW.date, 'DD Mon') || ': ' || NEW.overtime_hours || ' hrs'
      ELSE 'Leave on ' || TO_CHAR(NEW.date, 'DD Mon') || ': ' || new_shift
    END,
    'fets-roster',
    'low',  -- Keep it low priority - informational only
    jsonb_build_object(
      'schedule_id', NEW.id,
      'date', NEW.date,
      'old_shift', old_shift,
      'new_shift', new_shift,
      'overtime_hours', NEW.overtime_hours
    ),
    staff_branch
  );

  RETURN NEW;
END;
$function$
;
create function fets_ai_private.review_json(r public.fets_ai_reviews) returns jsonb language sql stable set search_path='' as $$
 select jsonb_strip_nulls(jsonb_build_object('type','change-review','id',r.id,'operation',r.operation,'label',r.label,'module',r.module,'path',r.path,'branch',r.branch,'status',case when r.status='pending' and r.expires_at<=clock_timestamp() then 'expired' else r.status end,'applyMode',r.apply_mode,'recordId',r.record_id,'before',r.before_values,'proposed',r.proposed_values,'summary',r.summary,'expiresAt',r.expires_at,'createdAt',r.created_at,'result',r.result))
$$;

-- Exact field schema validation applies equally to previews and direct operations.
create function fets_ai_private.validate_values(def jsonb,v jsonb) returns void language plpgsql immutable set search_path='' as $$
declare k text; s jsonb; t text; item jsonb;
begin
 if v is null or jsonb_typeof(v)<>'object' or octet_length(v::text)>20000 then raise exception 'Operation values must be one bounded object' using errcode='22023';end if;
 for k in select jsonb_array_elements_text(def->'parameters'->'required') loop if not v?k or v->k='null'::jsonb or v->>k='' then raise exception 'Required operation field: %',k using errcode='22023';end if;end loop;
 for k in select jsonb_object_keys(v) loop
  s:=def->'parameters'->'properties'->k;
  if s is null then raise exception 'Unknown or immutable operation field: %',k using errcode='42501';end if;
  t:=jsonb_typeof(v->k);
  if t='null' then raise exception 'Omit optional values instead of supplying null' using errcode='22023';end if;
  if (s->>'type'='STRING' and t<>'string') or (s->>'type' in ('NUMBER','INTEGER') and t<>'number') or (s->>'type'='BOOLEAN' and t<>'boolean') or (s->>'type'='ARRAY' and t<>'array') then raise exception 'Wrong value type for field: %',k using errcode='22023';end if;
  if t='string' and length(v->>k)>12000 then raise exception 'Text is too long: %',k using errcode='22023';end if;
  if s->>'type'='INTEGER' and (v->>k)::numeric<>trunc((v->>k)::numeric) then raise exception 'Whole number required: %',k using errcode='22023';end if;
  if s?'enum' and not (s->'enum' @> jsonb_build_array(v->k)) then raise exception 'Unsupported field value: %',k using errcode='22023';end if;
  if t='array' then
   if jsonb_array_length(v->k)>100 then raise exception 'Too many list values' using errcode='22023';end if;
   for item in select jsonb_array_elements(v->k) loop if jsonb_typeof(item)<>'string' or length(item#>>'{}')>200 then raise exception 'Lists accept bounded text IDs only' using errcode='22023';end if;end loop;
  end if;
  if k in ('url','website','logo_url','source_url') and v->>k<>'' and v->>k !~ '^https?://[^[:space:]]+$' then raise exception 'A public HTTP(S) URL is required: %',k using errcode='22023';end if;
 end loop;
end $$;

create function fets_ai_private.access(p_branch text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.staff_profiles; d jsonb; operations jsonb:='[]';modules jsonb:='[]';permissions jsonb:='{}';k text; allowed boolean;b text:=lower(btrim(p_branch));pb text;centres jsonb:='[]';
begin
 pb:=case when b='global' then null else b end;
 if not fets_ai_private.member_active(auth.uid(),pb) then raise exception 'Active verified centre membership required' using errcode='42501';end if;
 select * into p from public.staff_profiles where user_id=auth.uid();
 foreach k in array array['cochin','calicut','kannur'] loop if fets_ai_private.member_active(auth.uid(),k) then centres:=centres||jsonb_build_array(k);end if;end loop;
 for d in select jsonb_array_elements(fets_ai_private.operation_catalog()) loop
  k:=d->>'permission';allowed:=coalesce(fets_ai_private.permitted(k,pb),false);permissions:=permissions||jsonb_build_object(k,allowed);
  if allowed then operations:=operations||jsonb_build_array(d->>'name');if not modules ? (d->>'module') then modules:=modules||jsonb_build_array(d->>'module');end if;end if;
 end loop;
 -- Read-only modules use the same boolean authority as their related writes.
 foreach k in array array['command-center','profile','fets-intelligence','handover','actionables','my-desk','fets-calendar','fets-roster'] loop if not modules?k then modules:=modules||jsonb_build_array(k);end if;end loop;
 if fets_ai_private.permitted('ws_candidate-tracker',pb) then modules:=modules||'"candidate-tracker"'::jsonb;end if;
 if fets_ai_private.permitted('ws_dashboard',pb) then modules:=modules||'"dashboard"'::jsonb;end if;
 if coalesce(p.permissions->'ws_client-directory','true'::jsonb)='true'::jsonb then modules:=modules||jsonb_build_array('client-directory');end if;
 if p.role='super_admin' then modules:=modules||'["calendar","clients","cases","tasks","roster","shift","attendance","applications","overtime","systems","lost-found","news","business","chat","desk","users","delegation","knowledge","access-hub","candidates","dashboard"]'::jsonb;end if;
 return jsonb_build_object('userId',auth.uid(),'profileId',p.id,'branch',b,'admin',p.role='super_admin','role',fets_ai_private.actor_role(pb),'permissions',permissions,'centres',centres,'modules',modules,'operations',operations);
end $$;
create function public.fets_ai_access(p_branch text) returns jsonb language sql security invoker set search_path='' as $$select fets_ai_private.access(p_branch)$$;

-- Static projections and scope rules. Raw rows are hashed inside the server and
-- never returned; reviews only expose the named safe fields below.
create function fets_ai_private.target_state(n text,v jsonb,b text,do_lock boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare raw jsonb; safe jsonb;pk text:=v->>'id';actor uuid:=auth.uid();pid uuid;admin boolean;target text;linked uuid;expected text:=v->>'expected_updated_at';
begin
 select id,role='super_admin' into pid,admin from public.staff_profiles where user_id=actor;
 if n='add_case_comment' then pk:=coalesce(v->>'incident_id',v->>'id');end if;
 if n in ('send_team_message','add_team_members','remove_team_member') then pk:=coalesce(v->>'conversation_id',v->>'id');end if;
 if n='add_asset_service_note' then pk:=coalesce(v->>'system_id',v->>'id');end if;
 if n='record_institution_result' then pk:=v->>'work_item_id';end if;
 if n='create_institution_stage' or n='create_institution_duty' then pk:=v->>'institution_id';end if;
 if n='create_programme' then pk:=v->>'client_id';end if;
 if pk is null then return '{}';end if;
 if n in ('update_session','delete_session') then
  if do_lock then perform 1 from public.calendar_sessions where id=pk::bigint for update;end if;
  select to_jsonb(t),jsonb_build_object('id',t.id::text,'client_name',t.client_name,'exam_name',t.exam_name,'date',t.date,'start_time',t.start_time,'end_time',t.end_time,'status',t.status,'candidate_count',t.candidate_count,'updated_at',t.updated_at) into raw,safe from public.calendar_sessions t where t.id=pk::bigint and t.branch_location=b;
 elsif n in ('update_incident','delete_incident','add_case_comment') then
  if do_lock then perform 1 from public.incidents where id=pk::uuid for update;end if;
  select to_jsonb(t),jsonb_build_object('id',t.id,'title',t.title,'status',t.status,'severity',t.severity,'notes',t.notes,'updated_at',t.updated_at) into raw,safe from public.incidents t where t.id=pk::uuid and t.branch_location=b and (admin or fets_ai_private.actor_role(b)='manager' or t.user_id=actor or t.assigned_to=actor);
 elsif n in ('update_task','delete_task') then
  if do_lock then perform 1 from public.user_tasks where id=pk::uuid for update;end if;
  select to_jsonb(t),jsonb_build_object('id',t.id,'title',t.title,'status',t.status,'priority',t.priority,'updated_at',t.updated_at) into raw,safe from public.user_tasks t where t.id=pk::uuid and (t.branch_location=b or (t.branch_location is null and fets_ai_private.member_active(t.assigned_to,b) and fets_ai_private.member_active(t.assigned_by,b) and not exists(select 1 from public.centre_duty_members m where m.user_id in(t.assigned_to,t.assigned_by) and m.branch<>b))) and (admin or fets_ai_private.actor_role(b)='manager' or t.assigned_to=actor or t.assigned_by=actor);
 elsif n in ('update_client','delete_client','create_programme') then
  if do_lock then perform 1 from public.clients where id=pk::uuid for update;end if;
  select to_jsonb(t),jsonb_build_object('id',t.id,'name',t.name,'color',t.color,'logo_url',t.logo_url,'updated_at',t.updated_at) into raw,safe from public.clients t where t.id=pk::uuid;
 elsif n in ('update_programme','delete_programme') then
  if do_lock then perform 1 from public.client_exams where id=pk::uuid for update;end if;
  select to_jsonb(t),jsonb_build_object('id',t.id,'client_id',t.client_id,'name',t.name,'locations',t.locations,'updated_at',t.created_at) into raw,safe from public.client_exams t where t.id=pk::uuid;
 elsif n in ('remove_roster_shift','set_roster_shift') then
  if do_lock then perform 1 from public.roster_schedules where id=pk::uuid for update;end if;
  select to_jsonb(t),jsonb_build_object('id',t.id,'profile_id',t.profile_id,'date',t.date,'shift_code',t.shift_code,'version',t.version,'updated_at',t.updated_at) into raw,safe from public.roster_schedules t where t.id=pk::uuid and t.branch_location=b;
 elsif n='correct_attendance' then
  if do_lock then perform 1 from public.staff_attendance where id=pk::uuid for update;end if;
  select to_jsonb(t),jsonb_build_object('id',t.id,'staff_id',t.staff_id,'date',t.date,'check_in',t.check_in,'check_out',t.check_out,'status',t.status,'hasBreakEvidence',t.notes is not null,'updated_at',t.updated_at) into raw,safe from public.staff_attendance t where t.id=pk::uuid and t.branch_location=b;
 elsif n in ('update_ot_claim','resolve_ot_claim') then
  if do_lock then perform 1 from public.staff_ot_claims where id=pk::uuid for update;end if;
  select to_jsonb(t),jsonb_build_object('id',t.id,'profile_id',t.profile_id,'date',t.date,'start_time',t.start_time,'end_time',t.end_time,'status',t.status,'notes',t.notes,'updated_at',t.updated_at) into raw,safe from public.staff_ot_claims t join public.staff_profiles p on p.id=t.profile_id where t.id=pk::uuid and p.branch_assigned=b and (n='resolve_ot_claim' or t.profile_id=pid);
 elsif n in ('withdraw_application','respond_to_swap','resolve_application') then
  if do_lock then perform 1 from public.staff_applications where id=pk::uuid for update;end if;
  select to_jsonb(t),jsonb_build_object('id',t.id,'kind',t.kind,'status',t.status,'request_date',t.request_date,'applicant_id',t.applicant_id,'swap_with_id',t.swap_with_id,'version',t.version,'updated_at',t.version::text) into raw,safe from public.staff_applications t where t.id=pk::uuid and t.branch=b and (n='resolve_application' or (n='withdraw_application' and t.applicant_id=pid) or (n='respond_to_swap' and t.swap_with_id=pid));
 elsif n='settle_toil' then
  if do_lock then perform 1 from public.toil_records where id=pk::uuid for update;end if;
  select to_jsonb(t),jsonb_build_object('id',t.id,'staff_id',t.staff_id,'work_date',t.work_date,'toil_type',t.toil_type,'compensated_date',t.compensated_date,'updated_at',t.updated_at) into raw,safe from public.toil_records t where t.id=pk::uuid and t.branch_location=b;
 elsif n in ('update_institution','delete_institution','create_institution_stage','create_institution_duty') then
  if do_lock then perform 1 from public.expansion_institutions where id=pk::uuid for update;end if;
  select to_jsonb(t),jsonb_build_object('id',t.id,'name',t.name,'district',t.district,'address',t.address,'primary_contact_name',t.primary_contact_name,'primary_contact_phone',t.primary_contact_phone,'primary_contact_email',t.primary_contact_email,'website',t.website,'notes',t.notes,'updated_at',t.updated_at) into raw,safe from public.expansion_institutions t where t.id=pk::uuid;
 elsif n in ('update_institution_stage','delete_institution_stage','complete_institution_stage') then
  if do_lock then perform 1 from public.mission_institution_stages where id=pk::uuid for update;end if;
  select to_jsonb(t),jsonb_build_object('id',t.id,'institution_id',t.institution_id,'title',t.title,'instructions',t.instructions,'contact_script',t.contact_script,'completion_note',t.completion_note,'completed_at',t.completed_at,'updated_at',t.created_at) into raw,safe from public.mission_institution_stages t where t.id=pk::uuid;
 elsif n in ('update_institution_duty','delete_institution_duty','record_institution_result') then
  if do_lock then perform 1 from public.mission_work_items where id=pk::uuid for update;end if;
  select to_jsonb(t),jsonb_build_object('id',t.id,'institution_id',t.institution_id,'institution_stage_id',t.institution_stage_id,'title',t.title,'instructions',t.instructions,'owner_id',t.owner_id,'report_to_id',t.report_to_id,'due_at',t.due_at,'status',t.status,'updated_at',t.updated_at) into raw,safe from public.mission_work_items t where t.id=pk::uuid;
 elsif n='delete_institution_result' then
  if do_lock then perform 1 from public.mission_task_updates where id=pk::uuid for update;end if;
  select to_jsonb(t),jsonb_build_object('id',t.id,'work_item_id',t.work_item_id,'content',t.content,'status',t.status,'updated_at',t.updated_at) into raw,safe from public.mission_task_updates t where t.id=pk::uuid;
 elsif n in ('update_asset','delete_asset','add_asset_service_note') then
  if do_lock then perform 1 from public.systems where id=pk::uuid for update;end if;
  select to_jsonb(t),jsonb_build_object('id',t.id,'name',t.name,'system_type',t.system_type,'status',t.status,'serial_number',t.serial_number,'updated_at',t.updated_at) into raw,safe from public.systems t where t.id=pk::uuid and t.branch_location=b;
 elsif n in ('update_lost_found_item','delete_lost_found_item','release_lost_found_item') then
  if do_lock then perform 1 from public.lost_found_items where id=pk::uuid for update;end if;
  select to_jsonb(t),jsonb_build_object('id',t.id,'description',t.description,'found_location',t.found_location,'category',t.category,'item_type',t.item_type,'status',t.status,'locker',t.locker,'updated_at',t.created_at) into raw,safe from public.lost_found_items t where t.id=pk::uuid and t.branch_location=b;
 elsif n in ('update_desk_note','delete_desk_note') then
  if do_lock then perform 1 from public.slate_entries where id=pk::uuid for update;end if;
  select to_jsonb(t),jsonb_build_object('id',t.id,'title',t.title,'content',t.content,'category',t.category,'is_starred',t.is_starred,'is_pinned',t.is_pinned,'updated_at',t.updated_at) into raw,safe from public.slate_entries t where t.id=pk::uuid and t.user_id=actor;
 elsif n in ('update_staff_profile','change_staff_access','archive_staff','update_payroll') then
  if do_lock then perform 1 from public.staff_profiles where id=pk::uuid for update;end if;
  select to_jsonb(t),jsonb_build_object('id',t.id,'full_name',t.full_name,'department',t.department,'position',t.position,'bio',t.bio,'role',t.role,'is_active',t.is_active,'branch_assigned',t.branch_assigned,'updated_at',t.updated_at) into raw,safe from public.staff_profiles t where t.id=pk::uuid and (admin or t.branch_assigned=b or t.user_id=actor) and (n<>'update_staff_profile' or t.user_id=actor or coalesce(fets_ai_private.permitted('staff_edit',b),false)) and (n<>'change_staff_access' or t.user_id<>actor) and (n<>'archive_staff' or t.user_id<>actor);
 elsif n='revoke_branch_delegation' then
  if do_lock then perform 1 from public.staff_branch_delegations where id=pk::uuid for update;end if;
  select to_jsonb(t),jsonb_build_object('id',t.id,'profile_id',t.profile_id,'allowed_branch',t.allowed_branch,'start_date',t.start_date,'end_date',t.end_date,'updated_at',t.created_at) into raw,safe from public.staff_branch_delegations t join public.staff_profiles p on p.id=t.profile_id where t.id=pk::uuid and (admin or p.branch_assigned=b);
 elsif n='archive_knowledge' then
  if do_lock then perform 1 from public.ai_external_knowledge where id=pk::uuid for update;end if;
  select to_jsonb(t),jsonb_build_object('id',t.id,'title',t.title,'is_active',t.is_active,'version',t.version,'updated_at',t.updated_at) into raw,safe from public.ai_external_knowledge t where t.id=pk::uuid and (t.branch='*' or t.branch=b);
 elsif n='prepare_handover_signature' then
  if do_lock then perform 1 from public.shift_handovers where id=pk::uuid for update;end if;
  select to_jsonb(t),jsonb_build_object('id',t.id,'date',t.date,'status',t.status,'overall_summary',t.overall_summary,'updated_at',t.created_at) into raw,safe from public.shift_handovers t where t.id=pk::uuid and t.branch=b and (admin or actor=any(t.outgoing_user_ids) or actor=any(t.incoming_user_ids));
 elsif n='prepare_shift_task_review' then
  if do_lock then perform 1 from public.centre_day_tasks where id=pk::uuid for update;end if;
  select to_jsonb(t),jsonb_build_object('id',t.id,'title',t.title,'status',t.status,'version',t.version,'completion_note',t.completion_note,'updated_at',t.updated_at) into raw,safe from public.centre_day_tasks t where t.id=pk::uuid and t.branch=b;
 elsif n in ('send_team_message','add_team_members','remove_team_member') then
  if do_lock then perform 1 from public.conversations where id=pk::uuid for update;end if;
  select to_jsonb(t),jsonb_build_object('id',t.id,'name',t.name,'is_group',t.is_group,'updated_at',t.updated_at) into raw,safe from public.conversations t where t.id=pk::uuid and exists(select 1 from public.conversation_members m where m.conversation_id=t.id and m.user_id=any(public.chat_ids_of(actor)));
 elsif n='remove_news' then
  select to_jsonb(t),jsonb_build_object('id',t.id,'content',t.content,'is_active',t.is_active,'updated_at',t.created_at) into raw,safe from public.news_ticker t where t.id=pk::uuid and t.branch_location in (b,'global');
 else raise exception 'No verified target contract for operation' using errcode='42501';
 end if;
 if n='delete_incident' and raw is not null then
  raw:=raw||jsonb_build_object('_comments',(select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]') from public.incident_comments c where c.incident_id=pk::uuid));
  safe:=safe||jsonb_build_object('dependentComments',jsonb_array_length(raw->'_comments'));
 end if;
 if raw is null then raise exception 'Record is outside your permitted owner, centre or workflow scope' using errcode='42501';end if;
 if v?'expected_snapshot' and v->>'expected_snapshot' is distinct from encode(sha256(convert_to(raw::text,'UTF8')),'hex') then raise exception 'Record changed; reload its exact snapshot' using errcode='42501';end if;
 if expected is not null and expected is distinct from safe->>'updated_at' and expected is distinct from safe->>'version' then raise exception 'Record changed; reload before preparing or applying' using errcode='42501';end if;
 return jsonb_build_object('before',safe,'recordId',pk,'hash',encode(sha256(convert_to(raw::text,'UTF8')),'hex'));
end $$;

-- A closed branch per supported domain; this is not an arbitrary table writer.
create function fets_ai_private.perform_operation(n text,v jsonb,b text,req uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();pid uuid;rec jsonb;keep text[];rid text;other_user uuid;old_asset_status text;t public.roster_schedules;att public.staff_attendance;cl public.staff_ot_claims;expected bigint;d public.staff_profiles;state jsonb;
begin
 select id into pid from public.staff_profiles where user_id=actor;
 if n in ('create_incident','update_incident','create_task','update_task','create_session','update_session') then return fets_ai_private.execute_action(n,v,b,req);end if;
 case n
 when 'delete_session' then delete from public.calendar_sessions where id=(v->>'id')::bigint returning jsonb_build_object('id',id::text) into rec;
 when 'delete_task' then delete from public.user_tasks where id=(v->>'id')::uuid returning jsonb_build_object('id',id) into rec;
 when 'delete_incident' then delete from public.incidents where id=(v->>'id')::uuid returning jsonb_build_object('id',id) into rec;
 when 'add_case_comment' then
  if nullif(btrim(v->>'body'),'') is null then raise exception 'Comment text is required' using errcode='22023';end if;
  insert into public.incident_comments(incident_id,body,author_id,author_full_name) values((v->>'incident_id')::uuid,v->>'body',actor,(select full_name from public.staff_profiles where id=pid)) returning jsonb_build_object('id',id::text,'incident_id',incident_id,'body',body,'created_at',created_at) into rec;
 when 'create_client' then
  if nullif(btrim(v->>'name'),'') is null then raise exception 'Client name is required' using errcode='22023';end if;
  insert into public.clients(name,color,logo_url) values(btrim(v->>'name'),v->>'color',v->>'logo_url') returning to_jsonb(clients) into rec;
 when 'update_client' then update public.clients set name=coalesce(v->>'name',name),color=coalesce(v->>'color',color),logo_url=coalesce(v->>'logo_url',logo_url),updated_at=clock_timestamp() where id=(v->>'id')::uuid returning to_jsonb(clients) into rec;
 when 'delete_client' then delete from public.clients where id=(v->>'id')::uuid returning jsonb_build_object('id',id) into rec;
 when 'create_programme' then
  if nullif(btrim(v->>'name'),'') is null then raise exception 'Programme name is required' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements_text(coalesce(v->'locations','[]')) x where x not in ('cochin','calicut','kannur')) then raise exception 'Unknown programme centre' using errcode='22023';end if;
  insert into public.client_exams(client_id,name,locations) values((v->>'client_id')::uuid,btrim(v->>'name'),array(select jsonb_array_elements_text(coalesce(v->'locations','[]')))) returning to_jsonb(client_exams) into rec;
 when 'update_programme' then
  if exists(select 1 from jsonb_array_elements_text(coalesce(v->'locations','[]')) x where x not in ('cochin','calicut','kannur')) then raise exception 'Unknown programme centre' using errcode='22023';end if;
  update public.client_exams set name=coalesce(v->>'name',name),locations=case when v?'locations' then array(select jsonb_array_elements_text(v->'locations')) else locations end where id=(v->>'id')::uuid returning to_jsonb(client_exams) into rec;
 when 'delete_programme' then delete from public.client_exams where id=(v->>'id')::uuid returning jsonb_build_object('id',id) into rec;
 when 'set_roster_shift' then
  select * into d from public.staff_profiles where id=(v->>'profile_id')::uuid;
  if not found or not fets_ai_private.member_active(d.user_id,b) then raise exception 'Choose verified active staff in this centre' using errcode='42501';end if;
  if (v->>'date')::date<(clock_timestamp() at time zone 'Asia/Kolkata')::date then raise exception 'Past roster changes require the existing reviewed roster workflow' using errcode='42501';end if;
  if v->>'shift_code'='OT' then raise exception 'Overtime and financial roster effects require the OT workflow' using errcode='42501';end if;
  if v->>'shift_code' not in ('D','HD','RD') then raise exception 'Leave roster changes require the application workflow' using errcode='42501';end if;
  if v->>'shift_code' in ('D','HD') and (not v?'shift_start' or not v?'shift_end') then raise exception 'Set the actual working shift start and end times' using errcode='22023';end if;
  if v?'shift_start' is distinct from v?'shift_end' then raise exception 'Provide both actual shift times' using errcode='22023';end if;
  if v?'shift_start' and ((v->>'shift_end')::time<=(v->>'shift_start')::time) then raise exception 'Shift end must follow start' using errcode='22023';end if;
  if coalesce((v->>'grace_minutes')::int,0) not between 0 and 60 then raise exception 'Grace minutes must be 0 to 60' using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended(d.id::text||(v->>'date'),0));
  select * into t from public.roster_schedules where profile_id=d.id and date=(v->>'date')::date for update;
  expected:=(v->>'expected_version')::bigint;
  if found then
   if coalesce(t.overtime_hours,0)>0 or t.shift_code not in ('D','HD','RD') or exists(select 1 from public.staff_ot_claims c where c.profile_id=t.profile_id and c.date=t.date and lower(c.status) in ('pending','approved')) then raise exception 'This roster has financial, leave or overtime effects; continue in the roster and OT workflow' using errcode='42501';end if;
   if t.branch_location<>b or t.version<>expected then raise exception 'Roster changed; reload the current version' using errcode='42501';end if;
   update public.roster_schedules set shift_code=v->>'shift_code',shift_label=v->>'shift_label',shift_start=(v->>'shift_start')::time,shift_end=(v->>'shift_end')::time,grace_minutes=coalesce((v->>'grace_minutes')::int,0),updated_at=clock_timestamp() where id=t.id returning to_jsonb(roster_schedules) into rec;
  else
   if expected<>0 then raise exception 'Roster changed; expected an existing shift' using errcode='42501';end if;
   insert into public.roster_schedules(profile_id,date,shift_code,shift_label,shift_start,shift_end,grace_minutes,branch_location,status) values(d.id,(v->>'date')::date,v->>'shift_code',v->>'shift_label',(v->>'shift_start')::time,(v->>'shift_end')::time,coalesce((v->>'grace_minutes')::int,0),b,'confirmed') returning to_jsonb(roster_schedules) into rec;
  end if;
 when 'remove_roster_shift' then delete from public.roster_schedules where id=(v->>'id')::uuid returning jsonb_build_object('id',id) into rec;
 when 'self_check_in' then
  if coalesce((select branch_location from public.roster_schedules where profile_id=pid and date=(clock_timestamp() at time zone 'Asia/Kolkata')::date),(select branch_assigned from public.staff_profiles where id=pid)) is distinct from b then raise exception 'Attendance follows your actual roster centre; select that centre' using errcode='42501';end if;
  rec:=to_jsonb(public.roster_attendance_action('in',pid));
 when 'self_check_out' then
  if exists(select 1 from public.staff_attendance where staff_id=pid and date=(clock_timestamp() at time zone 'Asia/Kolkata')::date and branch_location is distinct from b) then raise exception 'Select the centre of your open attendance' using errcode='42501';end if;
  rec:=to_jsonb(public.roster_attendance_action('out',pid));
 when 'submit_ot_claim' then
  if (v->>'date')::date>(clock_timestamp() at time zone 'Asia/Kolkata')::date then raise exception 'Cannot claim future overtime' using errcode='22023';end if;
  if exists(select 1 from public.staff_ot_claims where profile_id=pid and date=(v->>'date')::date and status<>'rejected') then raise exception 'A claim for this day already exists' using errcode='42501';end if;
  insert into public.staff_ot_claims(profile_id,date,start_time,end_time,notes,status,toil_payout) values(pid,(v->>'date')::date,(v->>'start_time')::time,(v->>'end_time')::time,v->>'notes','pending',false) returning to_jsonb(staff_ot_claims) into rec;
 when 'update_ot_claim' then
  select * into cl from public.staff_ot_claims where id=(v->>'id')::uuid and profile_id=pid for update;
  if cl.status<>'pending' then raise exception 'Only your pending claim can be edited' using errcode='42501';end if;
  update public.staff_ot_claims set start_time=coalesce((v->>'start_time')::time,start_time),end_time=coalesce((v->>'end_time')::time,end_time),notes=coalesce(v->>'notes',notes),updated_at=clock_timestamp() where id=cl.id returning to_jsonb(staff_ot_claims) into rec;
 when 'create_institution' then
  if nullif(btrim(coalesce(v->>'primary_contact_phone','')),'') is null and nullif(btrim(coalesce(v->>'primary_contact_email','')),'') is null then raise exception 'Add a phone or email for the contact point' using errcode='22023';end if;
  insert into public.expansion_institutions(name,district,address,primary_contact_name,primary_contact_phone,primary_contact_email,primary_contact_role,website,notes) select x.name,x.district,x.address,x.primary_contact_name,x.primary_contact_phone,x.primary_contact_email,x.primary_contact_role,x.website,x.notes from jsonb_populate_record(null::public.expansion_institutions,v) x returning to_jsonb(expansion_institutions) into rec;
 when 'update_institution' then
  update public.expansion_institutions set name=coalesce(v->>'name',name),district=case when v?'district' then (jsonb_populate_record(null::public.expansion_institutions,v)).district else district end,address=coalesce(v->>'address',address),primary_contact_name=coalesce(v->>'primary_contact_name',primary_contact_name),primary_contact_phone=coalesce(v->>'primary_contact_phone',primary_contact_phone),primary_contact_email=coalesce(v->>'primary_contact_email',primary_contact_email),primary_contact_role=coalesce(v->>'primary_contact_role',primary_contact_role),website=coalesce(v->>'website',website),notes=coalesce(v->>'notes',notes),updated_at=clock_timestamp() where id=(v->>'id')::uuid returning to_jsonb(expansion_institutions) into rec;
  if nullif(btrim(coalesce(rec->>'primary_contact_phone','')),'') is null and nullif(btrim(coalesce(rec->>'primary_contact_email','')),'') is null then raise exception 'Keep a phone or email for the contact point' using errcode='22023';end if;
 when 'create_institution_stage' then
  perform 1 from public.expansion_institutions where id=(v->>'institution_id')::uuid for update;
  insert into public.mission_institution_stages(institution_id,stage_key,position,title,instructions,contact_script) values((v->>'institution_id')::uuid,'custom-'||gen_random_uuid()::text,(select coalesce(max(position),0)+1 from public.mission_institution_stages where institution_id=(v->>'institution_id')::uuid),v->>'title',coalesce(v->>'instructions',''),coalesce(v->>'contact_script','')) returning to_jsonb(mission_institution_stages) into rec;
 when 'update_institution_stage' then update public.mission_institution_stages set title=coalesce(v->>'title',title),instructions=coalesce(v->>'instructions',instructions),contact_script=coalesce(v->>'contact_script',contact_script) where id=(v->>'id')::uuid returning to_jsonb(mission_institution_stages) into rec;
 when 'create_institution_duty' then
  select user_id into other_user from public.staff_profiles where id=(v->>'owner_id')::uuid;
  if not fets_ai_private.member_active(other_user,null) or not fets_ai_private.member_active((v->>'report_to_id')::uuid,null) then raise exception 'Choose verified active owner and reporting person' using errcode='42501';end if;
  insert into public.mission_work_items(institution_id,title,district,instructions,owner_id,institution_stage_id,due_at,due_date,report_to_id,report_instructions,created_by) values((v->>'institution_id')::uuid,v->>'title',(select district::text from public.expansion_institutions where id=(v->>'institution_id')::uuid),v->>'instructions',(v->>'owner_id')::uuid,(v->>'institution_stage_id')::uuid,(v->>'due_at')::timestamptz,((v->>'due_at')::timestamptz at time zone 'Asia/Kolkata')::date,(v->>'report_to_id')::uuid,v->>'report_instructions',actor) returning to_jsonb(mission_work_items) into rec;
 when 'update_institution_duty' then
  if v?'owner_id' then select user_id into other_user from public.staff_profiles where id=(v->>'owner_id')::uuid;if not fets_ai_private.member_active(other_user,null) then raise exception 'Choose verified active owner' using errcode='42501';end if;end if;
  if v?'report_to_id' and not fets_ai_private.member_active((v->>'report_to_id')::uuid,null) then raise exception 'Choose verified active reporting person' using errcode='42501';end if;
  update public.mission_work_items set institution_id=coalesce((v->>'institution_id')::uuid,institution_id),title=coalesce(v->>'title',title),instructions=coalesce(v->>'instructions',instructions),owner_id=coalesce((v->>'owner_id')::uuid,owner_id),institution_stage_id=coalesce((v->>'institution_stage_id')::uuid,institution_stage_id),due_at=coalesce((v->>'due_at')::timestamptz,due_at),report_to_id=coalesce((v->>'report_to_id')::uuid,report_to_id),report_instructions=coalesce(v->>'report_instructions',report_instructions),updated_at=clock_timestamp() where id=(v->>'id')::uuid returning to_jsonb(mission_work_items) into rec;
 when 'record_institution_result' then
  insert into public.mission_task_updates(work_item_id,content,status,follow_up_at,reported,author_id,edited_by) values((v->>'work_item_id')::uuid,v->>'content',v->>'status',(v->>'follow_up_at')::timestamptz,false,pid,pid) returning to_jsonb(mission_task_updates) into rec;
 when 'create_asset' then insert into public.systems(name,system_type,status,serial_number,category_name,it_item_type,branch_location) values(v->>'name',v->>'system_type',coalesce(v->>'status','operational'),v->>'serial_number',coalesce(v->>'category_name','Systems'),v->>'it_item_type',b) returning to_jsonb(systems) into rec;
  insert into public.system_logs(system_id,log_type,description,user_id) values((rec->>'id')::uuid,'creation','System registered at '||b,actor);
 when 'update_asset' then select status into old_asset_status from public.systems where id=(v->>'id')::uuid;update public.systems set name=coalesce(v->>'name',name),system_type=coalesce(v->>'system_type',system_type),status=coalesce(v->>'status',status),serial_number=coalesce(v->>'serial_number',serial_number),category_name=coalesce(v->>'category_name',category_name),it_item_type=coalesce(v->>'it_item_type',it_item_type),updated_at=clock_timestamp() where id=(v->>'id')::uuid returning to_jsonb(systems) into rec;
  insert into public.system_logs(system_id,log_type,description,user_id) values((rec->>'id')::uuid,case when old_asset_status is distinct from rec->>'status' then 'status_change' else 'update' end,case when old_asset_status is distinct from rec->>'status' then 'Status changed to '||(rec->>'status') else 'System details updated' end,actor);
 when 'add_asset_service_note' then insert into public.system_logs(system_id,log_type,description,user_id) values((v->>'system_id')::uuid,'maintenance',v->>'description',actor) returning to_jsonb(system_logs) into rec;
 when 'create_lost_found_item' then insert into public.lost_found_items(description,found_location,category,item_type,locker,perishable,found_by_user_id,found_by_staff_id,branch_location,status) values(v->>'description',v->>'found_location',coalesce(v->>'category','other'),coalesce(v->>'item_type','found'),v->>'locker',coalesce((v->>'perishable')::boolean,false),actor,pid,b,'active') returning to_jsonb(lost_found_items) into rec;
 when 'update_lost_found_item' then update public.lost_found_items set description=coalesce(v->>'description',description),found_location=coalesce(v->>'found_location',found_location),category=coalesce(v->>'category',category),item_type=coalesce(v->>'item_type',item_type),locker=coalesce(v->>'locker',locker),perishable=coalesce((v->>'perishable')::boolean,perishable) where id=(v->>'id')::uuid returning to_jsonb(lost_found_items) into rec;
 when 'send_team_message' then
  rec:=to_jsonb(public.chat_send((v->>'conversation_id')::uuid,v->>'content','text',null,null));
  if jsonb_typeof(rec)='array' then rec:=rec->0;end if;
 when 'create_desk_note' then insert into public.slate_entries(user_id,title,content,category,is_starred,is_pinned) values(actor,v->>'title',v->>'content',coalesce(v->>'category','note'),coalesce((v->>'is_starred')::boolean,false),coalesce((v->>'is_pinned')::boolean,false)) returning to_jsonb(slate_entries) into rec;
 when 'update_desk_note' then update public.slate_entries set title=coalesce(v->>'title',title),content=coalesce(v->>'content',content),category=coalesce(v->>'category',category),is_starred=coalesce((v->>'is_starred')::boolean,is_starred),is_pinned=coalesce((v->>'is_pinned')::boolean,is_pinned),updated_at=clock_timestamp() where id=(v->>'id')::uuid and user_id=actor returning to_jsonb(slate_entries) into rec;
 when 'delete_desk_note' then delete from public.slate_entries where id=(v->>'id')::uuid and user_id=actor returning jsonb_build_object('id',id) into rec;
 when 'save_desk_journal' then rec:=to_jsonb(public.desk_save_journal((v->>'date')::date,v->>'note',coalesce(v->>'mood',''),nullif((v->>'expected_version')::int,0)));
 when 'save_desk_preferences' then rec:=to_jsonb(public.desk_save_preferences(v->>'cover',nullif((v->>'expected_version')::int,0)));
 when 'update_staff_profile' then update public.staff_profiles set full_name=coalesce(v->>'full_name',full_name),department=coalesce(v->>'department',department),position=coalesce(v->>'position',position),bio=coalesce(v->>'bio',bio),updated_at=clock_timestamp() where id=(v->>'id')::uuid returning to_jsonb(staff_profiles) into rec;
 when 'publish_knowledge' then insert into public.ai_external_knowledge(title,content,source_url,category,added_by,branch,is_active) values(v->>'title',v->>'content',v->>'source_url',coalesce(v->>'category','general'),actor,'*',true) returning to_jsonb(ai_external_knowledge) into rec;
 when 'archive_knowledge' then update public.ai_external_knowledge set is_active=false,updated_at=clock_timestamp() where id=(v->>'id')::uuid returning to_jsonb(ai_external_knowledge) into rec;
 else raise exception 'This operation must continue through its dedicated module' using errcode='42501';
 end case;
 if rec is null then raise exception 'Record was not saved; reload and try again' using errcode='42501';end if;
 rid:=rec->>'id';
 -- A fixed returned-field projection avoids future table columns becoming AI data.
 keep:=array['id','title','name','description','content','client_id','client_name','exam_name','date','day','entry_date','shift_code','shift_label','shift_start','shift_end','grace_minutes','version','profile_id','staff_id','check_in','check_out','status','start_time','end_time','ot_hours','notes','institution_id','institution_stage_id','work_item_id','owner_id','report_to_id','due_at','follow_up_at','author_id','edited_by','position','instructions','contact_script','system_type','serial_number','category_name','it_item_type','system_id','log_type','found_location','category','item_type','locker','perishable','is_starred','is_pinned','cover','note','mood','full_name','department','bio','is_active','source_url','branch','updated_at','created_at'];
 select coalesce(jsonb_object_agg(key,value),'{}') into rec from jsonb_each(rec) where key=any(keep);
 return jsonb_build_object('type','action-result','tool',n,'status','succeeded','recordId',rid,'path',(fets_ai_private.operation_definition(n)->>'path'),'record',rec,'title',coalesce(rec->>'title',rec->>'name',fets_ai_private.operation_definition(n)->>'label'),'message','Saved');
end $$;

create function fets_ai_private.operation(p_operation text,p_values jsonb,p_branch text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
<<action_request>>
declare actor uuid:=auth.uid();b text:=lower(btrim(p_branch));def jsonb;hash text;prior fets_ai_private.operation_requests;settings public.ai_settings;state jsonb;review public.fets_ai_reviews;result jsonb;err text;outcome text;
begin
 if actor is null or p_request_id is null then raise exception 'Authenticated identity and request UUID required' using errcode='42501';end if;
 def:=fets_ai_private.operation_definition(p_operation);
 if b='global' and def->>'scope' in ('own','shared') then select p.branch_assigned into b from public.staff_profiles p where p.user_id=actor;if not fets_ai_private.member_active(actor,b) then select m.branch into b from public.centre_duty_members m where m.user_id=actor and m.branch in ('cochin','calicut') and fets_ai_private.member_active(actor,m.branch) order by m.branch limit 1;end if;end if;
 if def is null or b not in ('cochin','calicut') or not coalesce(fets_ai_private.permitted(def->>'permission',b),false) then
  result:=jsonb_build_object('type','action-result','tool',p_operation,'status','blocked','message','Operation is outside your current User Management or centre permission');
  if exists(select 1 from auth.users where id=actor) and b is not null and p_operation is not null then
   insert into public.fets_ai_action_log(user_id,branch,request_id,tool_name,argument_hash,status,is_write,error_message,result) values(actor,b,p_request_id,p_operation,encode(sha256(convert_to(coalesce(p_values::text,'null'),'UTF8')),'hex'),'blocked',true,result->>'message',result) on conflict do nothing;
  end if;
  return result;
 end if;
 hash:=encode(sha256(convert_to(jsonb_build_object('operation',p_operation,'branch',b,'values',p_values)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended('expanded-ai:'||actor::text||':'||p_request_id::text,8187));
 select * into prior from fets_ai_private.operation_requests where user_id=actor and request_id=p_request_id;
 if found then
  if prior.argument_hash<>hash or prior.operation<>p_operation then return jsonb_build_object('type','action-result','tool',p_operation,'status','blocked','message','Request identity is already bound to different exact values');end if;
  if prior.result->>'type'='change-review' then select * into review from public.fets_ai_reviews where id=(prior.result->>'id')::uuid;return fets_ai_private.review_json(review);end if;
  return prior.result||'{"replayed":true}'::jsonb;
 end if;
 insert into fets_ai_private.operation_requests(user_id,request_id,operation,argument_hash) values(actor,p_request_id,p_operation,hash);
 begin
  select * into settings from public.ai_settings where id=1 for share;
  if not found or settings.kill_switch is distinct from false or settings.autonomous_enabled is distinct from true then raise exception 'Operational writes are OFF' using errcode='42501';end if;
  perform fets_ai_private.validate_values(def,p_values);
  state:=fets_ai_private.target_state(p_operation,p_values,b,true);
  if p_operation='change_staff_access' and p_values?'permission_key' and not (p_values->>'permission_key'=any(array['is_roster_active','can_edit_roster','user_management_edit','staff_edit','can_edit_calendar','ws_fets-chat','ws_candidate-tracker','ws_case','ws_attn-admin','ws_business','ws_access-hub','ws_staff-ot','ws_dashboard','ws_news-manager','ws_system-manager','ws_user-management','ws_branch-delegation','ws_client-directory'])) then raise exception 'Unknown User Management permission key' using errcode='22023';end if;
  if p_operation='grant_branch_delegation' and not exists(select 1 from public.staff_profiles p where p.id=(p_values->>'profile_id')::uuid and p.user_id<>actor and (fets_ai_private.actor_role(b)='super_admin' or p.branch_assigned=b)) then raise exception 'Cannot delegate your own account or a staff member outside this centre' using errcode='42501';end if;
  if (def->>'review')::boolean then
   insert into public.fets_ai_reviews(user_id,request_id,operation,label,module,path,branch,apply_mode,record_id,before_values,proposed_values,summary,argument_hash,target_hash)
   values(actor,p_request_id,p_operation,def->>'label',def->>'module',def->>'path',b,def->>'applyMode',state->>'recordId',coalesce(state->'before','{}'),p_values,
    case when def->>'applyMode'='module' then 'Prepared only. Nothing has been applied. Continue in the existing module for its final checks, approvals, credentials or physical evidence.' when p_operation like 'delete_%' or p_operation in ('remove_roster_shift','remove_news') then 'Review irreversible removal and dependent records. There is no universal undo.' else 'Prepared exact values for your deliberate review. Nothing has been applied.' end,hash,state->>'hash') returning * into review;
   result:=fets_ai_private.review_json(review);
  else
   result:=fets_ai_private.perform_operation(p_operation,p_values,b,p_request_id);
   if result->>'status'='succeeded' and p_operation not in ('create_incident','update_incident','create_task','update_task','create_session','update_session') then
    insert into public.fets_ai_action_log(user_id,branch,request_id,tool_name,argument_hash,status,is_write,record_id,before_snapshot,after_snapshot,result) values(actor,b,p_request_id,p_operation,hash,'succeeded',true,result->>'recordId',state->'before',result->'record',result);
   end if;
  end if;
 exception when others then
  get stacked diagnostics err=message_text;outcome:=case when sqlstate in ('42501','22023','22P02','22007','22008','23502','23503','23514','22001','40001','23505','P0001','28000') then 'blocked' else 'failed' end;
  if outcome='failed' then err:='The database could not complete this workflow. Use the existing module.';end if;
  result:=jsonb_build_object('type','action-result','tool',p_operation,'status',outcome,'message',err);
  insert into public.fets_ai_action_log(user_id,branch,request_id,tool_name,argument_hash,status,is_write,error_message,result) values(actor,b,p_request_id,p_operation,hash,outcome,true,err,result) on conflict do nothing;
 end;
 update fets_ai_private.operation_requests set result=action_request.result where user_id=actor and request_id=p_request_id;
 return result;
end $$;
create function public.fets_ai_operation(p_operation text,p_values jsonb,p_branch text,p_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select fets_ai_private.operation(p_operation,p_values,p_branch,p_request_id)$$;

create function fets_ai_private.review(p_id uuid,p_decision text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();r public.fets_ai_reviews;def jsonb;settings public.ai_settings;state jsonb;hash text;res jsonb;err text;
begin
 if actor is null or p_decision not in ('apply','cancel') then raise exception 'Authenticated human apply or cancel decision required' using errcode='42501';end if;
 select * into r from public.fets_ai_reviews where id=p_id and user_id=actor for update;
 if not found then raise exception 'Review not found for this account' using errcode='42501';end if;
 if not fets_ai_private.member_active(actor,r.branch) then raise exception 'Current verified centre access required' using errcode='42501';end if;
 if r.status<>'pending' then return fets_ai_private.review_json(r);end if;
 if p_decision='cancel' then update public.fets_ai_reviews set status='cancelled',decided_at=clock_timestamp() where id=r.id returning * into r;return fets_ai_private.review_json(r);end if;
 if r.expires_at<=clock_timestamp() then update public.fets_ai_reviews set status='expired',decided_at=clock_timestamp() where id=r.id returning * into r;return fets_ai_private.review_json(r);end if;
 def:=fets_ai_private.operation_definition(r.operation);
 select * into settings from public.ai_settings where id=1 for share;
 if def is null or not coalesce(fets_ai_private.permitted(def->>'permission',r.branch),false) or settings.kill_switch is distinct from false or settings.autonomous_enabled is distinct from true then
  res:=jsonb_build_object('type','action-result','tool',r.operation,'status','blocked','path',r.path,'message','Current permission or operational write controls block this review');
  update public.fets_ai_reviews set status='blocked',decided_at=clock_timestamp(),result=res where id=r.id returning * into r;return fets_ai_private.review_json(r);
 end if;
 hash:=encode(sha256(convert_to(jsonb_build_object('operation',r.operation,'branch',r.branch,'values',r.proposed_values)::text,'UTF8')),'hex');
 if hash<>r.argument_hash then raise exception 'Stored review values do not match their exact authorization' using errcode='42501';end if;
 begin
  perform fets_ai_private.validate_values(def,r.proposed_values);
  state:=fets_ai_private.target_state(r.operation,r.proposed_values,r.branch,true);
  if (state->>'hash') is distinct from r.target_hash then raise exception 'Record changed; prepare a fresh review' using errcode='42501';end if;
 exception when others then
  update public.fets_ai_reviews set status='stale',decided_at=clock_timestamp(),result=jsonb_build_object('type','action-result','tool',r.operation,'status','blocked','message','Target changed or is no longer permitted; prepare a fresh review') where id=r.id returning * into r;return fets_ai_private.review_json(r);
 end;
 if r.apply_mode='module' then
  res:=jsonb_build_object('type','action-result','tool',r.operation,'status','blocked','path',r.path,'title','Continue in the existing module','message','Nothing has been applied. Open the module to complete its final workflow checks and confirmation.');
  update public.fets_ai_reviews set status='blocked',decided_at=clock_timestamp(),result=res where id=r.id returning * into r;return fets_ai_private.review_json(r);
 end if;
 begin
  res:=fets_ai_private.perform_operation(r.operation,r.proposed_values,r.branch,r.request_id);
  if res->>'status'<>'succeeded' then raise exception 'Reviewed operation did not save' using errcode='42501';end if;
  insert into public.fets_ai_action_log(user_id,branch,request_id,tool_name,argument_hash,status,is_write,record_id,before_snapshot,after_snapshot,result) values(actor,r.branch,r.request_id,r.operation,r.argument_hash,'succeeded',true,res->>'recordId',r.before_values,res->'record',res);
  update public.fets_ai_reviews set status='applied',decided_at=clock_timestamp(),result=res where id=r.id returning * into r;
 exception when others then
  update public.fets_ai_reviews set status='blocked',decided_at=clock_timestamp(),result=jsonb_build_object('type','action-result','tool',r.operation,'status','blocked','message','The domain workflow could not apply these values; reload or use the existing module') where id=r.id returning * into r;
 end;
 return fets_ai_private.review_json(r);
end $$;
create function public.fets_ai_review(p_id uuid,p_decision text) returns jsonb language sql security invoker set search_path='' as $$select fets_ai_private.review(p_id,p_decision)$$;

create function fets_ai_private.operation_target(p_operation text,p_values jsonb,p_branch text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare d jsonb;k text;s jsonb;b text:=lower(btrim(p_branch));
begin
 d:=fets_ai_private.operation_definition(p_operation);
 if b='global' and d->>'scope' in ('own','shared') then select p.branch_assigned into b from public.staff_profiles p where p.user_id=auth.uid();if not fets_ai_private.member_active(auth.uid(),b) then select m.branch into b from public.centre_duty_members m where m.user_id=auth.uid() and m.branch in ('cochin','calicut') and fets_ai_private.member_active(auth.uid(),m.branch) order by m.branch limit 1;end if;end if;
 if d is null or not coalesce(fets_ai_private.permitted(d->>'permission',b),false) then raise exception 'Operation target is outside your current permission' using errcode='42501';end if;
 if jsonb_typeof(p_values) is distinct from 'object' then raise exception 'One exact target required' using errcode='22023';end if;
 for k in select jsonb_object_keys(p_values) loop if k not in ('id','incident_id','conversation_id','system_id','work_item_id','institution_id','client_id') then raise exception 'Only the named target ID is accepted' using errcode='22023';end if;end loop;
 s:=fets_ai_private.target_state(p_operation,p_values,b,false);
 return jsonb_build_object('operation',p_operation,'recordId',s->>'recordId','before',coalesce(s->'before','{}'),'expected_updated_at',s->'before'->>'updated_at','expected_version',s->'before'->'version','expected_snapshot',s->>'hash');
end $$;
create function public.fets_ai_operation_target(p_operation text,p_values jsonb,p_branch text) returns jsonb language sql security invoker set search_path='' as $$select fets_ai_private.operation_target(p_operation,p_values,p_branch)$$;

-- Preserve the public legacy endpoint but route it through the same new authority.
create or replace function public.fets_ai_execute_action(p_tool text,p_args jsonb,p_branch text,p_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select fets_ai_private.operation(p_tool,p_args,p_branch,p_request_id)$$;
revoke all on function fets_ai_private.execute_action(text,jsonb,text,uuid) from authenticated,service_role,public,anon;
revoke all on function fets_ai_private.target_state(text,jsonb,text,boolean),fets_ai_private.perform_operation(text,jsonb,text,uuid),fets_ai_private.validate_values(jsonb,jsonb),fets_ai_private.review_json(public.fets_ai_reviews),fets_ai_private.operation_catalog(),fets_ai_private.operation_definition(text) from public,anon,authenticated;
revoke all on function fets_ai_private.access(text),fets_ai_private.operation(text,jsonb,text,uuid),fets_ai_private.review(uuid,text),fets_ai_private.operation_target(text,jsonb,text),fets_ai_private.permitted(text,text) from public,anon;
grant execute on function fets_ai_private.access(text),fets_ai_private.operation(text,jsonb,text,uuid),fets_ai_private.review(uuid,text),fets_ai_private.operation_target(text,jsonb,text),fets_ai_private.permitted(text,text) to authenticated;
revoke all on function public.fets_ai_access(text),public.fets_ai_operation(text,jsonb,text,uuid),public.fets_ai_review(uuid,text),public.fets_ai_operation_target(text,jsonb,text) from public,anon;
grant execute on function public.fets_ai_access(text),public.fets_ai_operation(text,jsonb,text,uuid),public.fets_ai_review(uuid,text),public.fets_ai_operation_target(text,jsonb,text) to authenticated;
commit;
