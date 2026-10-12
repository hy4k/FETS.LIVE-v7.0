-- A daily work contract, explicit work/review transitions, immutable activity,
-- and private, human-authored staff development follow-ups. Existing rows stay intact.
begin;
alter table public.centre_responsibilities
  add column expected_result text not null default '' check(length(expected_result)<=2000),
  add column due_minute integer check(due_minute between 0 and 1439),
  add column priority text not null default 'normal' check(priority in ('normal','important'));
alter table public.centre_day_tasks
  add column instructions text not null default '' check(length(instructions)<=2000),
  add column expected_result text not null default '' check(length(expected_result)<=2000),
  add column due_minute integer check(due_minute between 0 and 1439),
  add column priority text not null default 'normal' check(priority in ('normal','important')),
  add column started_at timestamptz,
  add column completion_note text not null default '' check(length(completion_note)<=2000),
  add column support_category text not null default '' check(support_category in ('','clarity','training','workload','equipment','dependency','other')),
  add column review_note text not null default '' check(length(review_note)<=2000),
  add column rework_count integer not null default 0 check(rework_count>=0),
  add column version integer not null default 1 check(version>0);

create function fets_duty_private.task_contract_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare actor uuid := fets_duty_private.me(); leader boolean; r public.centre_responsibilities; contract_changed boolean;
begin
  if actor is null then raise exception 'Sign in with a duty membership'; end if;
  leader := coalesce(fets_duty_private.leads_day(new.branch,new.day),false);
  if tg_op='INSERT' then
    new.version:=1; new.rework_count:=0; new.review_note:=''; new.started_at:=null;
    if new.responsibility_id is not null then
      select * into r from public.centre_responsibilities where id=new.responsibility_id and branch=new.branch;
      if not found then raise exception 'Responsibility is not in this centre'; end if;
      new.instructions:=r.details; new.expected_result:=coalesce(nullif(r.expected_result,''),r.details);
      new.due_minute:=r.due_minute; new.priority:=r.priority;
      if not leader and new.assigned_to is distinct from
        (case when fets_duty_private.rostered(r.owner_id,new.branch,new.day) then r.owner_id
             when fets_duty_private.rostered(r.backup_id,new.branch,new.day) then r.backup_id else null end)
      then raise exception 'The lead must change the agreed owner'; end if;
    elsif not leader then raise exception 'Only the lead adds a duty'; end if;
  else
    if new.id is distinct from old.id then raise exception 'A duty keeps its identity'; end if;
    new.version:=old.version+1;
    contract_changed := (new.title,new.assigned_to,new.instructions,new.expected_result,new.due_minute,new.priority)
      is distinct from (old.title,old.assigned_to,old.instructions,old.expected_result,old.due_minute,old.priority);
    if contract_changed and not leader then raise exception 'Only the lead changes the work agreement'; end if;
    if new.assigned_to is distinct from old.assigned_to then
      new.status:='open'; new.started_at:=null; new.completion_note:=''; new.support_category:='';
    elsif contract_changed and old.status='done' then
      new.status:='open'; new.completion_note:=''; new.started_at:=null;
    end if;
    if new.review_note is distinct from old.review_note or new.rework_count is distinct from old.rework_count then
      if not leader or actor=old.assigned_to or actor=old.done_by or old.status<>'done' or new.status<>'open' or length(btrim(new.review_note))=0 then
        raise exception 'An independent lead must explain returned work';
      end if;
      new.rework_count:=old.rework_count+1;
    else new.rework_count:=old.rework_count; end if;
    if new.started_at is distinct from old.started_at and new.started_at is not null then
      if actor is distinct from new.assigned_to then raise exception 'Only the owner starts this duty'; end if;
      if new.day>(clock_timestamp() at time zone 'Asia/Kolkata')::date then raise exception 'This duty is for a future day'; end if;
      new.started_at:=coalesce(old.started_at,clock_timestamp());
    end if;
    if new.status='done' and old.status='done' and new.completion_note is distinct from old.completion_note then
      raise exception 'Reopen work before changing completion evidence';
    end if;
  end if;
  if new.status='done' and (tg_op='INSERT' or old.status<>'done') then
    if actor is distinct from new.assigned_to then raise exception 'Only the assigned owner records completion'; end if;
    if new.day>(clock_timestamp() at time zone 'Asia/Kolkata')::date then raise exception 'This duty is for a future day'; end if;
    if length(btrim(new.completion_note))=0 then raise exception 'Describe the result before submitting for review'; end if;
    new.started_at:=coalesce(new.started_at,clock_timestamp());
  end if;
  if new.status='skipped' and (tg_op='INSERT' or old.status<>'skipped') and (not leader or length(btrim(new.note))=0) then
    raise exception 'The lead must explain why a duty is not needed';
  end if;
  return new;
end $$;
create trigger centre_day_task_contract_guard before insert or update on public.centre_day_tasks
for each row execute function fets_duty_private.task_contract_guard();

create function public.fets_shift_access(centre text, work_day date) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('lead',coalesce(fets_duty_private.leads_day(centre,work_day),false),
 'manager',coalesce(fets_duty_private.can_plan(centre),false))
$$;
create function public.fets_shift_task_action(task_id uuid, expected_version integer, operation text, explanation text default '', support_kind text default '')
returns public.centre_day_tasks language plpgsql security invoker set search_path='' as $$
declare t public.centre_day_tasks; actor uuid:=fets_duty_private.me(); leader boolean;
begin
 select * into t from public.centre_day_tasks where id=task_id for update;
 if t.id is null or t.version is distinct from expected_version then raise exception 'This duty changed. Refresh before continuing'; end if;
 leader:=coalesce(fets_duty_private.leads_day(t.branch,t.day),false);
 if operation in ('start','complete','help','resume','reopen') and actor is distinct from t.assigned_to then raise exception 'Only the assigned owner updates this work'; end if;
 if operation in ('start','help','resume','complete') and t.status not in ('open','blocked') then raise exception 'This duty is not open'; end if;
 if operation='start' or operation='resume' then
   update public.centre_day_tasks set status='open',started_at=clock_timestamp(),support_category='' where id=t.id returning * into t;
 elsif operation='complete' then
   update public.centre_day_tasks set status='done',completion_note=btrim(explanation),support_category='' where id=t.id returning * into t;
 elsif operation='help' then
   if support_kind='' or length(btrim(explanation))=0 then raise exception 'Choose the help needed and explain what is stopping you'; end if;
   update public.centre_day_tasks set status='blocked',note=btrim(explanation),support_category=support_kind where id=t.id returning * into t;
 elsif operation='verify' then
   if not leader then raise exception 'Only the lead reviews work'; end if;
   select * into t from public.fets_verify_day_task(t.id,t.done_at);
 elsif operation='return' then
   if not leader or actor=t.assigned_to or actor=t.done_by or t.status<>'done' or length(btrim(explanation))=0 then raise exception 'An independent lead must explain returned work'; end if;
   update public.centre_day_tasks set status='open',review_note=btrim(explanation),rework_count=rework_count+1,started_at=null where id=t.id returning * into t;
 elsif operation='reopen' then
   if t.status<>'done' then raise exception 'Only completed work can be reopened'; end if;
   update public.centre_day_tasks set status='open',started_at=null where id=t.id returning * into t;
 elsif operation='skip' then
   if not leader or t.status not in ('open','blocked') or length(btrim(explanation))=0 then raise exception 'The lead must explain why open work is not needed'; end if;
   update public.centre_day_tasks set status='skipped',note=btrim(explanation) where id=t.id returning * into t;
 else raise exception 'Unknown duty action'; end if;
 return t;
end $$;

create table public.centre_task_activity (
 id uuid primary key default gen_random_uuid(), task_id uuid not null, branch text not null, day date not null,
 actor_id uuid not null, kind text not null, before_state jsonb, after_state jsonb,
 created_at timestamptz not null default clock_timestamp()
);
create index centre_task_activity_task on public.centre_task_activity(task_id,created_at);
alter table public.centre_task_activity enable row level security;
create policy activity_read on public.centre_task_activity for select to authenticated using(fets_duty_private.can_read(branch));
-- The private trigger alone writes the audit trail. Client roles cannot insert,
-- update or remove audit entries; it uses the real authenticated duty identity.
create function fets_duty_private.task_activity() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor uuid:=fets_duty_private.me(); kind text:='updated';
begin
 if actor is null then raise exception 'Authenticated duty identity required for the activity trail'; end if;
 if tg_op='DELETE' then
   insert into public.centre_task_activity(task_id,branch,day,actor_id,kind,before_state) values(old.id,old.branch,old.day,actor,'removed',to_jsonb(old)); return old;
 end if;
 if tg_op='INSERT' then kind:='assigned';
 elsif new.assigned_to is distinct from old.assigned_to then kind:='reassigned';
 elsif new.rework_count>old.rework_count then kind:='returned';
 elsif new.verified_at is distinct from old.verified_at and new.verified_at is not null then kind:='verified';
 elsif new.status='done' and old.status<>'done' then kind:='completed';
 elsif new.status='blocked' then kind:='support_requested';
 elsif old.status='blocked' and new.status='open' then kind:='resumed';
 elsif new.status='open' and old.status='done' then kind:='reopened';
 elsif new.started_at is distinct from old.started_at and new.started_at is not null then kind:='started';
 elsif new.status='skipped' then kind:='not_needed'; end if;
 insert into public.centre_task_activity(task_id,branch,day,actor_id,kind,before_state,after_state)
 values(new.id,new.branch,new.day,actor,kind,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end $$;
create trigger centre_task_activity after insert or update or delete on public.centre_day_tasks for each row execute function fets_duty_private.task_activity();
revoke all on public.centre_task_activity from public,anon,authenticated;
grant select on public.centre_task_activity to authenticated;
grant all on public.centre_task_activity to service_role;

create table public.centre_staff_development (
 id uuid primary key default gen_random_uuid(), branch text not null,
 profile_id uuid not null references public.staff_profiles(id),
 kind text not null check(kind in ('recognition','support','training','warning')),
 evidence text not null check(length(btrim(evidence)) between 10 and 3000),
 context text not null default '' check(length(context)<=3000),
 action text not null check(length(btrim(action)) between 5 and 2000),
 review_on date not null, status text not null default 'open' check(status in ('open','closed')),
 task_ids uuid[] not null default '{}', evidence_snapshot jsonb not null default '[]',
 context_reviewed boolean not null default false,
 staff_response text not null default '' check(length(staff_response)<=3000),
 created_by uuid not null references public.staff_profiles(id), created_at timestamptz not null default clock_timestamp(),
 followup_result text not null default '' check(length(followup_result)<=2000),
 closed_by uuid references public.staff_profiles(id), closed_at timestamptz, responded_at timestamptz
);
create index centre_staff_development_branch on public.centre_staff_development(branch,created_at desc);
create index centre_staff_development_person on public.centre_staff_development(profile_id);
create index centre_staff_development_author on public.centre_staff_development(created_by);
create index centre_staff_development_closer on public.centre_staff_development(closed_by);
alter table public.centre_staff_development enable row level security;
create policy development_read on public.centre_staff_development for select to authenticated
 using(fets_duty_private.can_plan(branch) or (fets_duty_private.can_read(branch) and profile_id=fets_duty_private.me()));
create policy development_insert on public.centre_staff_development for insert to authenticated with check(fets_duty_private.can_plan(branch));
create policy development_update on public.centre_staff_development for update to authenticated
 using(fets_duty_private.can_plan(branch) or (fets_duty_private.can_read(branch) and profile_id=fets_duty_private.me()))
 with check(fets_duty_private.can_plan(branch) or (fets_duty_private.can_read(branch) and profile_id=fets_duty_private.me()));
create function fets_duty_private.development_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare actor uuid:=fets_duty_private.me(); manager boolean;
begin
 manager:=coalesce(fets_duty_private.can_plan(new.branch),false);
 if actor is null then raise exception 'Sign in with a duty membership'; end if;
 if tg_op='INSERT' then
   if not manager then raise exception 'Only management records a development decision'; end if;
   if not exists(select 1 from public.staff_profiles where id=new.profile_id and lower(branch_assigned)=new.branch) then raise exception 'Choose a colleague from this centre'; end if;
   if new.kind='warning' and (not new.context_reviewed or length(btrim(new.context))<10) then raise exception 'Review workload, support and the staff explanation before recording a warning'; end if;
   if cardinality(new.task_ids)>50 then raise exception 'Select at most 50 evidence records'; end if;
   if (select count(*) from public.centre_day_tasks where id=any(new.task_ids) and branch=new.branch and assigned_to=new.profile_id)<>cardinality(new.task_ids) then raise exception 'Evidence must belong to this person and centre'; end if;
   select coalesce(jsonb_agg(to_jsonb(t) order by t.day,t.id),'[]') into new.evidence_snapshot from public.centre_day_tasks t where id=any(new.task_ids);
   new.created_by:=actor; new.created_at:=clock_timestamp(); new.status:='open'; new.staff_response:=''; new.followup_result:=''; new.closed_by:=null; new.closed_at:=null; new.responded_at:=null;
 else
   if (new.id,new.branch,new.profile_id,new.kind,new.evidence,new.context,new.action,new.review_on,new.task_ids,new.evidence_snapshot,new.context_reviewed,new.created_by,new.created_at)
     is distinct from (old.id,old.branch,old.profile_id,old.kind,old.evidence,old.context,old.action,old.review_on,old.task_ids,old.evidence_snapshot,old.context_reviewed,old.created_by,old.created_at)
   then raise exception 'Recorded decisions and evidence are immutable; add a new follow-up'; end if;
   if new.staff_response is distinct from old.staff_response and actor<>new.profile_id then raise exception 'Only the staff member can write their response'; end if;
   if new.status is distinct from old.status and not manager then raise exception 'Only management closes a follow-up'; end if;
   if new.followup_result is distinct from old.followup_result and (not manager or old.status='closed') then raise exception 'Management records the follow-up result before closing'; end if;
   if old.status='closed' and new.status<>'closed' then raise exception 'A closed follow-up stays closed; add a new decision'; end if;
   if new.status='closed' and old.status<>'closed' and length(btrim(new.followup_result))<5 then raise exception 'Describe the follow-up outcome before closing'; end if;
   new.closed_by:=case when new.status='closed' then coalesce(old.closed_by,actor) else null end;
   new.responded_at:=case when new.staff_response is distinct from old.staff_response then clock_timestamp() else old.responded_at end;
   new.closed_at:=case when new.status='closed' then coalesce(old.closed_at,clock_timestamp()) else null end;
 end if;
 return new;
end $$;
create trigger centre_development_guard before insert or update on public.centre_staff_development for each row execute function fets_duty_private.development_guard();
revoke all on public.centre_staff_development from public,anon;
grant select,insert,update on public.centre_staff_development to authenticated;
grant all on public.centre_staff_development to service_role;
revoke all on function public.fets_shift_access(text,date),public.fets_shift_task_action(uuid,integer,text,text,text) from public,anon;
grant execute on function public.fets_shift_access(text,date),public.fets_shift_task_action(uuid,integer,text,text,text) to authenticated;
revoke all on function fets_duty_private.task_contract_guard(),fets_duty_private.task_activity(),fets_duty_private.development_guard() from public,anon;
grant execute on function fets_duty_private.task_contract_guard(),fets_duty_private.task_activity(),fets_duty_private.development_guard() to authenticated,service_role;
create or replace function public.fets_workspace_capabilities() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('version',5,'desk',auth.uid() is not null,
 'duties',exists(select 1 from public.centre_duty_members where user_id=(select auth.uid())),
 'blueprint',exists(select 1 from public.centre_duty_members where user_id=(select auth.uid())),
 'dutyReview',exists(select 1 from public.centre_duty_members where user_id=(select auth.uid())),
 'dutyWorkflow',exists(select 1 from public.centre_duty_members where user_id=(select auth.uid())))
$$;
notify pgrst,'reload schema';
commit;
