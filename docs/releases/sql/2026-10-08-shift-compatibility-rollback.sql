-- Use only when restoring the ad7d353 website after the outcomes migration.
-- Retains all duties, audit history and private development notes. Older clients
-- can submit owner completions without the new result field; no evidence is invented.
-- Other ownership, review, day-closure and identity guards remain active.
begin;
create or replace function fets_duty_private.task_contract_guard() returns trigger
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
  -- Clear prior results on reopen so an old client cannot reuse another completion.
  if tg_op='UPDATE' and old.status='done' and new.status<>'done' then new.completion_note:=''; end if;
  if new.status='done' and (tg_op='INSERT' or old.status<>'done') then
    if actor is distinct from new.assigned_to then raise exception 'Only the assigned owner records completion'; end if;
    if new.day>(clock_timestamp() at time zone 'Asia/Kolkata')::date then raise exception 'This duty is for a future day'; end if;
    new.started_at:=coalesce(new.started_at,clock_timestamp());
  end if;
  if new.status='skipped' and (tg_op='INSERT' or old.status<>'skipped') and (not leader or length(btrim(new.note))=0) then
    raise exception 'The lead must explain why a duty is not needed';
  end if;
  return new;
end $$;
create or replace function public.fets_workspace_capabilities() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('version', 4, 'desk', auth.uid() is not null,
    'duties', exists(select 1 from public.centre_duty_members where user_id = (select auth.uid())),
    'blueprint', exists(select 1 from public.centre_duty_members where user_id = (select auth.uid())),
    'dutyReview', exists(select 1 from public.centre_duty_members where user_id = (select auth.uid())))
$$;
notify pgrst,'reload schema';
commit;
