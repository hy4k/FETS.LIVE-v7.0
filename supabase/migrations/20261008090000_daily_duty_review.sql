-- Add an independent review to the existing daily jobs. No rota, duty,
-- membership, completion or check history is replaced.
begin;

alter table public.centre_day_tasks
  add column verified_by uuid references public.staff_profiles(id),
  add column verified_at timestamptz;

create function fets_duty_private.day_task_review_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare actor uuid := fets_duty_private.me();
begin
  if tg_op = 'DELETE' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(old.branch || ':' || old.day::text, 0));
    if exists (select 1 from public.centre_duty_reports where branch = old.branch and day = old.day) then
      raise exception 'The day report is submitted; its tasks are closed';
    end if;
    return old;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.branch || ':' || new.day::text, 0));
  if exists (select 1 from public.centre_duty_reports where branch = new.branch and day = new.day) then
    raise exception 'The day report is submitted; its tasks are closed';
  end if;
  if tg_op = 'INSERT' then
    new.verified_by := null; new.verified_at := null;
    return new;
  end if;
  -- An edited or reassigned completion must be performed again.
  if old.status = 'done' and (new.title, new.assigned_to, new.note) is distinct from (old.title, old.assigned_to, old.note) then
    if new.status = 'done' then new.status := 'open'; end if;
    new.done_by := null; new.done_at := null;
  elsif old.status = 'done' and new.status = 'done' then
    -- Completion evidence cannot be rewritten during a review.
    new.done_by := old.done_by; new.done_at := old.done_at;
  end if;
  if new.status <> 'done' or old.status <> 'done' then
    new.verified_by := null; new.verified_at := null;
    return new;
  end if;
  if (new.verified_by, new.verified_at) is distinct from (old.verified_by, old.verified_at) then
    if actor is null or fets_duty_private.leads_day(new.branch, new.day) is not true then
      raise exception 'Only the lead or a planner can verify work';
    end if;
    if actor = new.assigned_to or actor = new.done_by then
      raise exception 'Someone else must verify your own work';
    end if;
    if new.verified_by is distinct from actor or new.verified_at is null or new.done_at is null then
      raise exception 'Verify a completed job using your own identity';
    end if;
    new.verified_by := actor; new.verified_at := clock_timestamp();
  end if;
  return new;
end $$;

-- Runs after the existing ownership, closure and completion guard.
create trigger centre_day_task_review_guard before insert or update or delete on public.centre_day_tasks
for each row execute function fets_duty_private.day_task_review_guard();

create function public.fets_verify_day_task(task_id uuid, expected_done_at timestamptz)
returns public.centre_day_tasks language plpgsql security invoker set search_path = '' as $$
declare result public.centre_day_tasks;
begin
  select * into result from public.centre_day_tasks where id = task_id for update;
  if result.id is null or result.status <> 'done' or result.done_at is distinct from expected_done_at then
    raise exception 'This job changed. Refresh before reviewing it';
  end if;
  update public.centre_day_tasks set verified_by = fets_duty_private.me(), verified_at = clock_timestamp()
    where id = task_id returning * into result;
  return result;
end $$;

create function fets_duty_private.report_task_reviews() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare tasks jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.branch || ':' || new.day::text, 0));
  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at, t.id), '[]'::jsonb) into tasks
    from public.centre_day_tasks t where t.branch = new.branch and t.day = new.day;
  new.snapshot := jsonb_set(new.snapshot, '{tasks}', tasks);
  return new;
end $$;
-- Existing report guard establishes identity, permissions and snapshot first.
create trigger centre_report_task_reviews before insert on public.centre_duty_reports
for each row execute function fets_duty_private.report_task_reviews();

create or replace function public.fets_workspace_capabilities() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('version', 4, 'desk', auth.uid() is not null,
    'duties', exists(select 1 from public.centre_duty_members where user_id = (select auth.uid())),
    'blueprint', exists(select 1 from public.centre_duty_members where user_id = (select auth.uid())),
    'dutyReview', exists(select 1 from public.centre_duty_members where user_id = (select auth.uid())))
$$;

revoke all on function public.fets_verify_day_task(uuid, timestamptz) from public, anon;
grant execute on function public.fets_verify_day_task(uuid, timestamptz) to authenticated;
revoke all on function fets_duty_private.day_task_review_guard(), fets_duty_private.report_task_reviews() from public, anon;
grant execute on function fets_duty_private.day_task_review_guard(), fets_duty_private.report_task_reviews() to authenticated, service_role;
notify pgrst, 'reload schema';
commit;
