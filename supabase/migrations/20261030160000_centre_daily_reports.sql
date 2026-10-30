-- FETS daily opening/closing reports. Separate from the existing lead's final report.
begin;
create table if not exists public.centre_daily_reports (
  id uuid primary key default gen_random_uuid(),
  branch text not null check (branch in ('calicut','cochin')),
  day date not null,
  kind text not null check (kind in ('morning','evening')),
  overall text not null check (overall in ('green','yellow','red')),
  exam_client text not null default '' check(length(btrim(exam_client)) between 1 and 160),
  expected_sessions integer not null check(expected_sessions between 0 and 30),
  expected_candidates integer not null check(expected_candidates between 0 and 5000),
  attended integer check(attended between 0 and 5000),
  no_shows integer check(no_shows between 0 and 5000),
  checks jsonb not null default '{}'::jsonb check(jsonb_typeof(checks)='object'),
  issues text not null default '' check(length(issues)<=2000),
  action_taken text not null default '' check(length(action_taken)<=2000),
  pending text not null default '' check(length(pending)<=2000),
  manager_attention boolean not null default false,
  submitted_by uuid not null default fets_duty_private.me() references public.staff_profiles(id),
  updated_by uuid not null default fets_duty_private.me() references public.staff_profiles(id),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(branch,day,kind),
  check ((kind='morning' and attended is null and no_shows is null) or (kind='evening' and attended is not null and no_shows is not null)),
  check (attended is null or expected_candidates is null or attended <= expected_candidates),
  check (no_shows is null or expected_candidates is null or no_shows <= expected_candidates),
  check (attended is null or no_shows is null or expected_candidates is null or (attended + no_shows) <= expected_candidates)
);
create index if not exists centre_daily_reports_history on public.centre_daily_reports(branch,day desc);
alter table public.centre_daily_reports enable row level security;

drop policy if exists centre_daily_reports_read on public.centre_daily_reports;
create policy centre_daily_reports_read on public.centre_daily_reports for select to authenticated
  using (fets_duty_private.can_read(branch));

drop policy if exists centre_daily_reports_insert on public.centre_daily_reports;
create policy centre_daily_reports_insert on public.centre_daily_reports for insert to authenticated
  with check (
    fets_duty_private.can_read(branch)
    and fets_duty_private.me() is not null
    and day <= (now() at time zone 'Asia/Kolkata')::date
  );

drop policy if exists centre_daily_reports_update on public.centre_daily_reports;
create policy centre_daily_reports_update on public.centre_daily_reports for update to authenticated
  using (
    fets_duty_private.can_read(branch)
    and fets_duty_private.me() is not null
    and day <= (now() at time zone 'Asia/Kolkata')::date
  )
  with check (
    fets_duty_private.can_read(branch)
    and fets_duty_private.me() is not null
    and day <= (now() at time zone 'Asia/Kolkata')::date
  );

create or replace function fets_duty_private.daily_report_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare
  actor uuid := fets_duty_private.me();
  required_keys text[];
  k text;
  val text;
  has_failed boolean := false;
begin
  if actor is null or not fets_duty_private.can_read(new.branch) then
    raise exception 'Active centre staff access required';
  end if;
  if new.day > (now() at time zone 'Asia/Kolkata')::date then
    raise exception 'Cannot submit a report for a future date';
  end if;

  if tg_op='UPDATE' then
    if (new.id,new.branch,new.day,new.kind,new.submitted_by,new.submitted_at)
       is distinct from (old.id,old.branch,old.day,old.kind,old.submitted_by,old.submitted_at) then
      raise exception 'Report identity and original author cannot be changed';
    end if;
    new.updated_by := actor;
  else
    new.submitted_by := actor;
    new.updated_by := actor;
    new.submitted_at := now();
  end if;

  required_keys := case when new.kind = 'morning'
    then array['systems','cctv','rooms','roster','duties']
    else array['monitoring','checkin','cpr','records','duties','signedout','closing']
  end;

  foreach k in array required_keys loop
    val := coalesce(new.checks ->> k, '');
    if val not in ('yes','no') then
      raise exception 'Complete every checklist item before saving (% is not confirmed)', k;
    end if;
    if val = 'no' then
      has_failed := true;
    end if;
  end loop;

  if has_failed and new.overall = 'green' then
    raise exception 'Overall status cannot be Green (All clear) when a required check fails';
  end if;

  if (has_failed or new.overall <> 'green') and length(btrim(coalesce(new.issues,''))) = 0 then
    raise exception 'Describe the issue when any check fails or status is not green';
  end if;

  new.exam_client := btrim(new.exam_client);
  new.issues := btrim(coalesce(new.issues,''));
  new.action_taken := btrim(coalesce(new.action_taken,''));
  new.pending := btrim(coalesce(new.pending,''));
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists centre_daily_reports_guard on public.centre_daily_reports;
create trigger centre_daily_reports_guard before insert or update on public.centre_daily_reports
for each row execute function fets_duty_private.daily_report_guard();

revoke all on public.centre_daily_reports from public,anon;
grant select,insert,update on public.centre_daily_reports to authenticated;
grant all on public.centre_daily_reports to service_role;
revoke all on function fets_duty_private.daily_report_guard() from public,anon;
grant execute on function fets_duty_private.daily_report_guard() to authenticated,service_role;
notify pgrst,'reload schema';
commit;
