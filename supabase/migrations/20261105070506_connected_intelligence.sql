-- Additive connected Intelligence persistence. No operational records are seeded.
begin;
create schema if not exists fets_ai_private;
revoke all on schema fets_ai_private from public,anon;
grant usage on schema fets_ai_private to authenticated,service_role;

-- Membership is the role authority. Editable profile roles/JWT user metadata do not elevate.
create function fets_ai_private.member_active(p_user uuid,p_branch text default null)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from public.centre_duty_members m
  join public.staff_profiles s on s.id=m.profile_id and s.user_id=m.user_id
  join auth.users u on u.id=m.user_id
  where m.user_id=p_user and s.is_active is true
  and u.email_confirmed_at is not null and u.deleted_at is null
  and (u.banned_until is null or u.banned_until<statement_timestamp())
  and (p_branch is null or (m.branch=p_branch and p_branch<>'global') or (m.branch='*' and m.role='super_admin'))
 )
$$;
create function fets_ai_private.actor_role(p_branch text default null)
returns text language sql stable security definer set search_path='' as $$
 select case
 when not fets_ai_private.member_active(auth.uid(),p_branch) then null
 when exists(select 1 from public.centre_duty_members where user_id=auth.uid() and branch='*' and role='super_admin') then 'super_admin'
 when exists(select 1 from public.centre_duty_members where user_id=auth.uid() and (p_branch is null or branch=p_branch) and role='planner') then 'manager'
 else 'staff' end
$$;
revoke all on function fets_ai_private.member_active(uuid,text),fets_ai_private.actor_role(text) from public,anon;
grant execute on function fets_ai_private.member_active(uuid,text),fets_ai_private.actor_role(text) to authenticated,service_role;

alter table public.ai_memory add column if not exists is_active boolean not null default true;
alter table public.ai_external_knowledge add column if not exists branch text not null default '*';
alter table public.ai_external_knowledge add column if not exists version integer not null default 1;
-- Leave legacy tasks unclassified. New AI tasks carry an immutable selected centre.
alter table public.user_tasks add column if not exists branch_location text;
alter table public.user_tasks add constraint user_tasks_ai_branch_check check(branch_location is null or branch_location in ('cochin','calicut')) not valid;
alter table public.ai_settings alter column gemini_model set default 'gemini-3.1-pro-preview';
update public.ai_settings set gemini_model='gemini-3.1-pro-preview' where gemini_model='gemini-1.5-flash';

-- Live trigger dependencies verified from pg_trigger/pg_get_functiondef.
-- The existing task timestamp trigger uses transaction-start NOW(); this later
-- task-only trigger gives each mutation a distinct optimistic version.
create function fets_ai_private.task_version() returns trigger language plpgsql security invoker set search_path='' as $$
begin new.updated_at:=greatest(clock_timestamp(),old.updated_at+interval '1 microsecond');return new;end $$;
revoke all on function fets_ai_private.task_version() from public,anon,authenticated;
create trigger zz_intelligence_task_version before update on public.user_tasks for each row execute function fets_ai_private.task_version();

-- incidents.assigned_to references Auth UUIDs; notifications.recipient_id
-- references profile IDs. Preserve assignment notifications with the correct
-- mapping, and qualify dependencies for the RPC's fixed empty search_path.
create or replace function public.notify_incident_assignment()
returns trigger language plpgsql security definer set search_path='' as $$
declare assignee_profile uuid;assignee_branch text;
begin
 if old.assigned_to is not distinct from new.assigned_to or new.assigned_to is null then return new;end if;
 select s.id,s.branch_assigned into assignee_profile,assignee_branch from public.staff_profiles s where s.user_id=new.assigned_to;
 if assignee_profile is null then return new;end if;
 insert into public.notifications(recipient_id,type,title,message,link,priority,metadata,branch_location)
 values(assignee_profile,'incident_assigned','Incident Assigned',
  'Incident #'||new.id||' ('||new.severity||') has been assigned to you','incident-manager',
  case when new.severity='critical' then 'high' else 'medium' end,
  jsonb_build_object('incident_id',new.id,'severity',new.severity,'title',new.title),coalesce(new.branch_location,assignee_branch));
 return new;
end $$;
revoke all on function public.notify_incident_assignment() from public,anon,authenticated;

-- Remove permissive legacy policies, retaining the original stores and all their rows.
do $$ declare p record;begin
 for p in select tablename,policyname from pg_policies where schemaname='public' and tablename in
 ('ai_settings','ai_memory','ai_external_knowledge','fets_ai_documents','ai_conversations','ai_conversation_messages','ai_agent_actions','ai_query_log') loop
  execute format('drop policy %I on public.%I',p.policyname,p.tablename);
 end loop;
end $$;
alter table public.ai_settings enable row level security;
alter table public.ai_memory enable row level security;
alter table public.ai_external_knowledge enable row level security;
revoke all on public.ai_settings,public.ai_memory,public.ai_external_knowledge from public,anon,authenticated;
grant select on public.ai_settings,public.ai_memory,public.ai_external_knowledge to authenticated;
grant update(provider,gemini_model,claude_model,kill_switch,autonomous_enabled,max_tool_iterations,updated_by,updated_at) on public.ai_settings to authenticated;
create policy intelligence_settings_read on public.ai_settings for select to authenticated using(fets_ai_private.actor_role() is not null);
create policy intelligence_settings_update on public.ai_settings for update to authenticated using(fets_ai_private.actor_role()='super_admin') with check(fets_ai_private.actor_role()='super_admin');
create policy intelligence_memory_read on public.ai_memory for select to authenticated using(
 fets_ai_private.actor_role() is not null and (
 scope='global' or (scope='branch' and lower(btrim(scope_ref)) in ('cochin','calicut') and fets_ai_private.member_active(auth.uid(),lower(btrim(scope_ref))))
 or (scope='user' and scope_ref=auth.uid()::text))
);
create index if not exists intelligence_memory_scope on public.ai_memory(scope,scope_ref,is_active,importance desc);
create policy intelligence_knowledge_read on public.ai_external_knowledge for select to authenticated using(
 fets_ai_private.actor_role() is not null and (branch='*' or fets_ai_private.member_active(auth.uid(),branch))
);
grant insert(title,content,category,source_url,tags,is_active,added_by,branch),update(title,content,category,source_url,tags,is_active,branch,updated_at,added_by) on public.ai_external_knowledge to authenticated;
create policy intelligence_knowledge_insert on public.ai_external_knowledge for insert to authenticated with check(fets_ai_private.actor_role()='super_admin' and added_by=auth.uid());
create policy intelligence_knowledge_update on public.ai_external_knowledge for update to authenticated using(fets_ai_private.actor_role()='super_admin') with check(fets_ai_private.actor_role()='super_admin');
-- Approved references keep their existing version trigger and stored rows.
do $$ begin
 if to_regclass('public.fets_ai_documents') is not null then
  alter table public.fets_ai_documents enable row level security;
  create policy intelligence_approved_read on public.fets_ai_documents for select to authenticated using(
   fets_ai_private.actor_role() is not null and (
    fets_ai_private.actor_role()='super_admin' or (status='published' and (branch='*' or fets_ai_private.member_active(auth.uid(),branch))))
  );
  create policy intelligence_approved_insert on public.fets_ai_documents for insert to authenticated with check(fets_ai_private.actor_role()='super_admin' and updated_by=auth.uid());
  create policy intelligence_approved_update on public.fets_ai_documents for update to authenticated using(fets_ai_private.actor_role()='super_admin') with check(fets_ai_private.actor_role()='super_admin' and updated_by=auth.uid());
 end if;
end $$;
create function fets_ai_private.knowledge_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.branch not in ('*','cochin','calicut') or length(btrim(new.title)) not between 1 and 200 or length(new.content) not between 1 and 30000 then raise exception 'Invalid knowledge fields';end if;
 if tg_op='UPDATE' then new.version:=old.version+1;else new.version:=1;end if;
 new.added_by:=auth.uid();new.updated_at:=clock_timestamp();return new;
end $$;
revoke all on function fets_ai_private.knowledge_guard() from public,anon,authenticated;
create trigger intelligence_knowledge_guard before insert or update on public.ai_external_knowledge for each row execute function fets_ai_private.knowledge_guard();

create function fets_ai_private.save_memory(p_key text,p_value text,p_scope text,p_scope_ref text,p_id uuid,p_active boolean,p_importance integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.ai_memory; ref text; role_name text;
begin
 role_name:=fets_ai_private.actor_role();
 if role_name is null then raise exception 'Active verified staff membership required' using errcode='42501';end if;
 if p_scope is null or p_scope not in ('user','branch','global') or p_active is null or p_importance is null or p_importance not between 1 and 5 or p_key is null or length(btrim(p_key)) not between 1 and 200 or p_value is null or length(p_value) not between 1 and 12000 then raise exception 'Invalid memory fields';end if;
 if p_scope='user' then
  if p_scope_ref is not null and p_scope_ref<>auth.uid()::text then raise exception 'Personal memory scope must be your own identity' using errcode='42501';end if;
  ref:=auth.uid()::text;
 elsif p_scope='branch' then
  ref:=lower(btrim(p_scope_ref));
  if ref is null or ref not in ('cochin','calicut') or fets_ai_private.actor_role(ref) is distinct from 'manager' and fets_ai_private.actor_role(ref) is distinct from 'super_admin' then raise exception 'Centre memory requires trusted manager permission' using errcode='42501';end if;
 else
  if role_name<>'super_admin' then raise exception 'Global memory requires trusted admin permission' using errcode='42501';end if;
  if p_scope_ref is not null and p_scope_ref<>'*' then raise exception 'Invalid global scope';end if;
  ref:='*';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_scope||':'||ref||':'||btrim(p_key),92703));
 if p_id is not null then
  select * into r from public.ai_memory where id=p_id for update;
  if not found then raise exception 'Memory not found';end if;
  if r.scope is distinct from p_scope or coalesce(r.scope_ref,'*') is distinct from ref then raise exception 'Memory scope and ownership identity are immutable' using errcode='42501';end if;
 else
  select * into r from public.ai_memory where scope=p_scope and coalesce(scope_ref,'*')=ref and mem_key=btrim(p_key) order by created_at,id limit 1 for update;
 end if;
 if r.id is null then
  insert into public.ai_memory(scope,scope_ref,mem_key,mem_value,importance,is_active,created_by,source)
  values(p_scope,ref,btrim(p_key),p_value,p_importance,p_active,auth.uid(),'user') returning * into r;
 else
  update public.ai_memory set mem_key=btrim(p_key),mem_value=p_value,importance=p_importance,is_active=p_active,updated_at=clock_timestamp() where id=r.id returning * into r;
 end if;
 return jsonb_build_object('id',r.id,'scope',r.scope,'scope_ref',r.scope_ref,'category',r.category,'mem_key',r.mem_key,'mem_value',r.mem_value,'importance',r.importance,'is_active',r.is_active,'updated_at',r.updated_at,'created_by',r.created_by);
end $$;
revoke all on function fets_ai_private.save_memory(text,text,text,text,uuid,boolean,integer) from public,anon;
grant execute on function fets_ai_private.save_memory(text,text,text,text,uuid,boolean,integer) to authenticated;
create function public.fets_ai_save_memory(p_key text,p_value text,p_scope text default 'user',p_scope_ref text default null,p_id uuid default null,p_active boolean default true,p_importance integer default 3)
returns jsonb language sql security invoker set search_path='' as $$select fets_ai_private.save_memory(p_key,p_value,p_scope,p_scope_ref,p_id,p_active,p_importance)$$;
revoke all on function public.fets_ai_save_memory(text,text,text,text,uuid,boolean,integer) from public,anon;
grant execute on function public.fets_ai_save_memory(text,text,text,text,uuid,boolean,integer) to authenticated;

create table public.fets_ai_conversations(
 id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references auth.users(id),
 branch text not null check(branch in ('cochin','calicut','global')),title text not null default 'New conversation' check(length(title) between 1 and 200),
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp()
);
create index intelligence_conversations_owner on public.fets_ai_conversations(user_id,branch,updated_at desc);
alter table public.fets_ai_conversations enable row level security;
revoke all on public.fets_ai_conversations from public,anon,authenticated;
grant select,insert on public.fets_ai_conversations to authenticated;
grant update(title,updated_at) on public.fets_ai_conversations to authenticated;
create policy intelligence_conversation_read on public.fets_ai_conversations for select to authenticated using(user_id=auth.uid() and fets_ai_private.member_active(auth.uid(),branch));
create policy intelligence_conversation_insert on public.fets_ai_conversations for insert to authenticated with check(user_id=auth.uid() and fets_ai_private.member_active(auth.uid(),branch));
create policy intelligence_conversation_update on public.fets_ai_conversations for update to authenticated using(user_id=auth.uid() and fets_ai_private.member_active(auth.uid(),branch)) with check(user_id=auth.uid() and fets_ai_private.member_active(auth.uid(),branch));
create table public.fets_ai_messages(
 id uuid primary key default gen_random_uuid(),conversation_id uuid not null references public.fets_ai_conversations(id),
 user_id uuid not null default auth.uid() references auth.users(id),role text not null check(role in ('user','assistant')),
 content text not null check(length(content) between 1 and 60000),metadata jsonb not null default '{}' check(jsonb_typeof(metadata)='object' and octet_length(metadata::text)<=60000),
 request_id uuid not null,created_at timestamptz not null default clock_timestamp(),unique(conversation_id,request_id,role)
);
create index intelligence_messages_history on public.fets_ai_messages(conversation_id,created_at,id);
create index intelligence_messages_user on public.fets_ai_messages(user_id);
alter table public.fets_ai_messages enable row level security;
revoke all on public.fets_ai_messages from public,anon,authenticated;
grant select,insert on public.fets_ai_messages to authenticated;
create policy intelligence_message_read on public.fets_ai_messages for select to authenticated using(user_id=auth.uid() and exists(select 1 from public.fets_ai_conversations c where c.id=conversation_id and c.user_id=auth.uid() and fets_ai_private.member_active(auth.uid(),c.branch)));
create policy intelligence_message_insert on public.fets_ai_messages for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.fets_ai_conversations c where c.id=conversation_id and c.user_id=auth.uid() and fets_ai_private.member_active(auth.uid(),c.branch)));

create table public.fets_ai_action_log(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),branch text not null,
 request_id uuid not null,tool_name text not null,argument_hash text not null,status text not null check(status in ('succeeded','blocked','failed')),
 is_write boolean not null default true,table_affected text,record_id text,before_snapshot jsonb,after_snapshot jsonb,error_message text,
 result jsonb not null default '{}',created_at timestamptz not null default clock_timestamp(),unique(user_id,request_id,tool_name,argument_hash)
);
create index intelligence_action_scope on public.fets_ai_action_log(user_id,branch,created_at desc);
create index intelligence_action_status on public.fets_ai_action_log(branch,status,created_at desc);
alter table public.fets_ai_action_log enable row level security;
revoke all on public.fets_ai_action_log from public,anon,authenticated;
grant select on public.fets_ai_action_log to authenticated;
create policy intelligence_action_read on public.fets_ai_action_log for select to authenticated using(
 fets_ai_private.member_active(auth.uid(),branch) and (user_id=auth.uid() or fets_ai_private.actor_role(branch)='super_admin')
);

-- Clients cannot forge outcomes. This private definer is the only writer to the audit.
-- Fixed SQL branches implement six tools; no SQL/table/column names come from callers.
create function fets_ai_private.execute_action(p_tool text,p_args jsonb,p_branch text,p_request_id uuid)
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
  if jsonb_typeof(settings.allowed_tools->role_name) is distinct from 'array' or not ((settings.allowed_tools->role_name) ? p_tool or (settings.allowed_tools->role_name) ? '*') then raise exception 'Tool is not in the trusted role allowlist' using errcode='42501';end if;
  if p_tool in ('create_session','update_session') and role_name not in ('manager','super_admin') then raise exception 'Calendar changes require trusted management membership' using errcode='42501';end if;
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
revoke all on function fets_ai_private.execute_action(text,jsonb,text,uuid) from public,anon;
grant execute on function fets_ai_private.execute_action(text,jsonb,text,uuid) to authenticated;
create function public.fets_ai_execute_action(p_tool text,p_args jsonb,p_branch text,p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select fets_ai_private.execute_action(p_tool,p_args,p_branch,p_request_id)$$;
revoke all on function public.fets_ai_execute_action(text,jsonb,text,uuid) from public,anon;
grant execute on function public.fets_ai_execute_action(text,jsonb,text,uuid) to authenticated;

-- Legacy history remains writable only by its verified owner; audit rows are read-only.
do $$ declare t text; p record;begin
 for t in select unnest(array['ai_conversations','ai_conversation_messages','ai_query_log','ai_agent_actions']) loop
  if to_regclass('public.'||t) is null then continue;end if;
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  if t='ai_conversation_messages' then
   execute format('create policy intelligence_legacy_owner on public.%I for select to authenticated using(fets_ai_private.actor_role() is not null and exists(select 1 from public.ai_conversations c where c.id=conversation_id and c.user_id=auth.uid()))',t);
   execute format('grant insert on public.%I to authenticated',t);
   execute format('create policy intelligence_legacy_append on public.%I for insert to authenticated with check(fets_ai_private.actor_role() is not null and exists(select 1 from public.ai_conversations c where c.id=conversation_id and c.user_id=auth.uid()))',t);
  elsif t='ai_agent_actions' then
   execute format('create policy intelligence_legacy_owner on public.%I for select to authenticated using(fets_ai_private.actor_role() is not null and user_id=auth.uid())',t);
  elsif t='ai_query_log' then
   execute format('create policy intelligence_legacy_owner on public.%I for select to authenticated using(fets_ai_private.actor_role() is not null and (user_id=auth.uid() or fets_ai_private.actor_role()=''super_admin''))',t);
  else
   execute format('create policy intelligence_legacy_owner on public.%I for select to authenticated using(fets_ai_private.actor_role() is not null and user_id=auth.uid())',t);
   execute format('grant insert on public.%I to authenticated',t);
   execute format('grant update(title,context,summary,status,updated_at) on public.%I to authenticated',t);
   execute format('create policy intelligence_legacy_insert on public.%I for insert to authenticated with check(fets_ai_private.actor_role() is not null and user_id=auth.uid())',t);
   execute format('create policy intelligence_legacy_update on public.%I for update to authenticated using(fets_ai_private.actor_role() is not null and user_id=auth.uid()) with check(fets_ai_private.actor_role() is not null and user_id=auth.uid())',t);
  end if;
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
