-- The Shift: the centre blueprint (who owns every standing job) and each
-- day's task list built from it. Additive: day plans, leads, checks and
-- reports stay as they are; the lead's report now also keeps the day's tasks.
begin;

create table public.centre_responsibilities (
  id uuid primary key default gen_random_uuid(),
  branch text not null check (branch = lower(branch) and branch not in ('global','*','all')),
  area text not null check (area in ('exam','infrastructure','office','candidates','reports','growth')),
  title text not null check (length(btrim(title)) between 1 and 160),
  details text not null default '' check (length(details) <= 2000),
  frequency text not null default 'daily' check (frequency in ('daily','weekly','monthly','as_needed')),
  weekday integer check (weekday between 1 and 7),
  monthday integer check (monthday between 1 and 31),
  owner_id uuid references public.staff_profiles(id) on delete set null,
  backup_id uuid references public.staff_profiles(id) on delete set null,
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.staff_profiles(id) on delete set null,
  check (frequency <> 'weekly' or weekday is not null),
  check (frequency <> 'monthly' or monthday is not null),
  check (owner_id is null or backup_id is null or owner_id <> backup_id)
);
create index centre_responsibilities_branch on public.centre_responsibilities(branch, area, position);

create table public.centre_day_tasks (
  id uuid primary key default gen_random_uuid(),
  branch text not null check (branch = lower(branch) and branch not in ('global','*','all')),
  day date not null,
  responsibility_id uuid references public.centre_responsibilities(id) on delete set null,
  title text not null check (length(btrim(title)) between 1 and 200),
  assigned_to uuid references public.staff_profiles(id) on delete set null,
  status text not null default 'open' check (status in ('open','done','blocked','carried','skipped')),
  note text not null default '' check (length(note) <= 2000),
  carried_from uuid references public.centre_day_tasks(id) on delete set null,
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  done_by uuid references public.staff_profiles(id) on delete set null,
  done_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (branch, day, responsibility_id)
);
create index centre_day_tasks_day on public.centre_day_tasks(branch, day);
create index centre_day_tasks_person on public.centre_day_tasks(assigned_to, day);

-- Who leads a given day: the super admin, a planner, the week's lead, or the
-- resolved (acting) lead on that day's plan.
create function fets_duty_private.leads_day(b text, d date) returns boolean
language sql stable security invoker set search_path = '' as $$
  select fets_duty_private.can_plan(b)
      or fets_duty_private.week_lead(b, d) = fets_duty_private.me()
      or exists (select 1 from public.centre_day_plans p
                  where p.branch = b and p.day = d
                    and fets_duty_private.resolved_lead(p.id) = fets_duty_private.me())
$$;

alter table public.centre_responsibilities enable row level security;
alter table public.centre_day_tasks enable row level security;

create policy blueprint_read on public.centre_responsibilities for select to authenticated
  using (fets_duty_private.can_read(branch));
create policy blueprint_write on public.centre_responsibilities for all to authenticated
  using (fets_duty_private.leads_day(branch, (clock_timestamp() at time zone 'Asia/Kolkata')::date))
  with check (fets_duty_private.leads_day(branch, (clock_timestamp() at time zone 'Asia/Kolkata')::date));

create policy day_tasks_read on public.centre_day_tasks for select to authenticated
  using (fets_duty_private.can_read(branch));
create policy day_tasks_insert on public.centre_day_tasks for insert to authenticated
  with check (fets_duty_private.can_read(branch));
create policy day_tasks_update on public.centre_day_tasks for update to authenticated
  using (fets_duty_private.can_read(branch)) with check (fets_duty_private.can_read(branch));
create policy day_tasks_delete on public.centre_day_tasks for delete to authenticated
  using (fets_duty_private.leads_day(branch, day));

create function fets_duty_private.blueprint_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.branch is distinct from old.branch then
    raise exception 'A responsibility stays with its centre';
  end if;
  new.updated_at := now();
  new.updated_by := fets_duty_private.me();
  return new;
end $$;
create trigger centre_blueprint_guard before insert or update on public.centre_responsibilities
  for each row execute function fets_duty_private.blueprint_guard();

-- Staff tick off their own tasks; the day's lead runs the list.
create function fets_duty_private.day_task_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  me uuid := fets_duty_private.me();
  leader boolean;
begin
  if exists (select 1 from public.centre_duty_reports r where r.branch = new.branch and r.day = new.day) then
    raise exception 'The lead''s report for this day is submitted; its tasks are closed';
  end if;
  leader := fets_duty_private.leads_day(new.branch, new.day);
  if tg_op = 'INSERT' then
    if not leader and (new.responsibility_id is null or new.assigned_to is distinct from me or new.carried_from is not null) then
      raise exception 'Only the lead adds or assigns tasks; you can update your own';
    end if;
    if new.responsibility_id is not null then
      select r.title into new.title from public.centre_responsibilities r
       where r.id = new.responsibility_id and r.branch = new.branch;
      if not found then raise exception 'That responsibility belongs to another centre'; end if;
    end if;
    new.created_by := me;
    new.created_at := now();
  else
    if (new.branch, new.day, new.responsibility_id, new.created_by, new.created_at, new.carried_from)
       is distinct from (old.branch, old.day, old.responsibility_id, old.created_by, old.created_at, old.carried_from) then
      raise exception 'A task keeps its day and origin';
    end if;
    if not leader then
      if old.assigned_to is distinct from me then raise exception 'Only the person on this task or the lead can update it'; end if;
      if (new.title, new.assigned_to) is distinct from (old.title, old.assigned_to) or new.status = 'carried' then
        raise exception 'Ask the lead to reassign or move this task';
      end if;
    end if;
  end if;
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.done_by := me;
    new.done_at := now();
  elsif new.status <> 'done' then
    new.done_by := null;
    new.done_at := null;
  end if;
  if new.status = 'blocked' and length(btrim(new.note)) = 0 then
    raise exception 'Say what is blocking the task so the lead can help';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger centre_day_task_guard before insert or update on public.centre_day_tasks
  for each row execute function fets_duty_private.day_task_guard();

-- The lead's report keeps the day's tasks as they stood at submission.
create or replace function fets_duty_private.report_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.centre_day_plans; entries jsonb; changes jsonb; tasks jsonb;
begin
 if tg_op='UPDATE' then
  if not fets_duty_private.is_admin() then raise exception 'Only super admin can acknowledge'; end if;
  new.acknowledged_at:=now();new.acknowledged_by:=fets_duty_private.me();return new;
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.plan_id::text,0));
 select * into p from public.centre_day_plans where id=new.plan_id;
 if p.id is null or p.status<>'published' or not(fets_duty_private.is_admin() or fets_duty_private.resolved_lead(p.id)=fets_duty_private.me()) then raise exception 'Only the lead or super admin can submit a published shift report'; end if;
 if (clock_timestamp() at time zone 'Asia/Kolkata')::date<p.day or ((clock_timestamp() at time zone 'Asia/Kolkata')::date=p.day and (clock_timestamp() at time zone 'Asia/Kolkata')::time<time '17:00') then raise exception 'Final report is available after 17:00 India time'; end if;
 select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at,e.id),'[]'::jsonb) into entries from public.centre_duty_events e where e.plan_id=p.id;
 new.branch:=p.branch;new.day:=p.day;new.submitted_by:=fets_duty_private.me();new.created_at:=now();new.acknowledged_at:=null;new.acknowledged_by:=null;
 select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at,c.id),'[]'::jsonb) into changes from public.centre_duty_changes c where c.plan_id=p.id;
 select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'assigned_to',t.assigned_to,'status',t.status,'note',t.note,'done_at',t.done_at,'responsibility_id',t.responsibility_id) order by t.created_at,t.id),'[]'::jsonb)
   into tasks from public.centre_day_tasks t where t.branch=p.branch and t.day=p.day;
 new.snapshot:=jsonb_build_object('plan',p.plan,'lead_id',fets_duty_private.resolved_lead(p.id),'events',entries,'changes',changes,'tasks',tasks);return new;
end $$;

create or replace function public.fets_workspace_capabilities() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('version',3,'desk',auth.uid() is not null,
   'duties',exists(select 1 from public.centre_duty_members where user_id=(select auth.uid())),
   'blueprint',exists(select 1 from public.centre_duty_members where user_id=(select auth.uid())))
$$;

revoke all on public.centre_responsibilities, public.centre_day_tasks from public, anon;
grant select, insert, update, delete on public.centre_responsibilities, public.centre_day_tasks to authenticated;
grant all on public.centre_responsibilities, public.centre_day_tasks to service_role;
revoke all on all functions in schema fets_duty_private from public, anon;
grant execute on all functions in schema fets_duty_private to authenticated, service_role;
notify pgrst, 'reload schema';
commit;
