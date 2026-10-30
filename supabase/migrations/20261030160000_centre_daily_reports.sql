-- FETS daily opening/closing reports. Separate from the existing lead's final report.
begin;
create table public.centre_daily_reports (
  id uuid primary key default gen_random_uuid(),
  branch text not null check (branch = lower(branch) and branch not in ('global','*','all')),
  day date not null,
  kind text not null check (kind in ('morning','evening')),
  overall text not null check (overall in ('green','yellow','red')),
  exam_client text not null default '' check(length(exam_client)<=160),
  expected_sessions integer check(expected_sessions between 0 and 30),
  expected_candidates integer check(expected_candidates between 0 and 5000),
  attended integer check(attended between 0 and 5000),
  no_shows integer check(no_shows between 0 and 5000),
  checks jsonb not null default '{}'::jsonb check(jsonb_typeof(checks)='object'),
  issues text not null default '' check(length(issues)<=2000),
  action_taken text not null default '' check(length(action_taken)<=2000),
  pending text not null default '' check(length(pending)<=2000),
  manager_attention boolean not null default false,
  submitted_by uuid not null references public.staff_profiles(id),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(branch,day,kind),
  check (kind='morning' or (attended is not null and no_shows is not null)),
  check (attended is null or expected_candidates is null or attended <= expected_candidates),
  check (no_shows is null or expected_candidates is null or no_shows <= expected_candidates)
);
create index centre_daily_reports_history on public.centre_daily_reports(branch,day desc);
alter table public.centre_daily_reports enable row level security;
create policy centre_daily_reports_read on public.centre_daily_reports for select to authenticated
  using (fets_duty_private.can_read(branch));
create policy centre_daily_reports_insert on public.centre_daily_reports for insert to authenticated
  with check (
    fets_duty_private.can_read(branch)
    and submitted_by=fets_duty_private.me()
    and day <= (now() at time zone 'Asia/Kolkata')::date
  );
create policy centre_daily_reports_update on public.centre_daily_reports for update to authenticated
  using (fets_duty_private.can_read(branch) and
    (submitted_by=fets_duty_private.me() or fets_duty_private.leads_day(branch,day)))
  with check (fets_duty_private.can_read(branch) and
    (submitted_by=fets_duty_private.me() or fets_duty_private.leads_day(branch,day)));
create function fets_duty_private.daily_report_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='UPDATE' then
    if (new.id,new.branch,new.day,new.kind,new.submitted_by,new.submitted_at)
       is distinct from (old.id,old.branch,old.day,old.kind,old.submitted_by,old.submitted_at) then
      raise exception 'Report identity and author cannot be changed';
    end if;
  else
    new.submitted_by:=fets_duty_private.me();
    new.submitted_at:=now();
  end if;
  new.updated_at:=now();
  return new;
end $$;
create trigger centre_daily_reports_guard before insert or update on public.centre_daily_reports
for each row execute function fets_duty_private.daily_report_guard();
revoke all on public.centre_daily_reports from public,anon;
grant select,insert,update on public.centre_daily_reports to authenticated;
grant all on public.centre_daily_reports to service_role;
revoke all on function fets_duty_private.daily_report_guard() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
