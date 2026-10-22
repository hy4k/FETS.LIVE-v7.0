-- FETS Live only. Private report drafts; no existing attendance is changed.
begin;
create schema if not exists roster_report_private;
revoke all on schema roster_report_private from public, anon;
grant usage on schema roster_report_private to authenticated;
-- The profile table has legacy broad write policies. Do not trust a profile's
-- editable email/role alone: require Mithun's verified Supabase Auth identity.
create function roster_report_private.is_author() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists (
  select 1 from auth.users u where u.id=auth.uid()
   and lower(u.email)='mithun@fets.in' and u.email_confirmed_at is not null
   and exists(select 1 from public.staff_profiles s where s.user_id=u.id and s.role='super_admin')
 );
$$;
revoke all on function roster_report_private.is_author() from public,anon;
grant execute on function roster_report_private.is_author() to authenticated;
create table public.roster_attendance_reports (
 id uuid primary key default gen_random_uuid(),
 recipient_profile_id uuid not null references public.staff_profiles(id),
 recipient_user_id uuid not null references auth.users(id),
 recipient_name text not null,
 month date not null check(extract(day from month)=1),
 branch text not null check(branch in ('calicut','cochin','global')),
 title text not null check(char_length(btrim(title)) between 1 and 200),
 summary text not null check(char_length(btrim(summary)) between 1 and 20000),
 manager_notes text not null default '' check(char_length(manager_notes)<=20000),
 source_evidence text not null check(char_length(source_evidence) between 1 and 100000),
 source_generated text not null check(char_length(source_generated) between 1 and 100),
 source_count integer not null check(source_count between 0 and 366),
 status text not null default 'draft' check(status in ('draft','shared')),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 shared_at timestamptz,
 version bigint not null default 1,
 check((status='draft' and shared_at is null) or (status='shared' and shared_at is not null))
);
create index roster_attendance_reports_recipient on public.roster_attendance_reports(recipient_user_id,status,created_at desc);
create index roster_attendance_reports_profile on public.roster_attendance_reports(recipient_profile_id);
create index roster_attendance_reports_author on public.roster_attendance_reports(created_by);
alter table public.roster_attendance_reports enable row level security;
revoke all on public.roster_attendance_reports from public,anon,authenticated;
grant select,insert,update on public.roster_attendance_reports to authenticated;
create policy report_read on public.roster_attendance_reports for select to authenticated
 using ((select roster_report_private.is_author()) or (status='shared' and recipient_user_id=(select auth.uid())));
create policy report_create on public.roster_attendance_reports for insert to authenticated
 with check((select roster_report_private.is_author()) and created_by=(select auth.uid()) and status='draft');
create policy report_edit on public.roster_attendance_reports for update to authenticated
 using((select roster_report_private.is_author()) and status='draft')
 with check((select roster_report_private.is_author()));
create function roster_report_private.guard_report() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if not roster_report_private.is_author() then raise exception 'Only Mithun can manage attendance reports' using errcode='42501'; end if;
 if tg_op='INSERT' then
  if new.status<>'draft' then raise exception 'Save a draft before sharing'; end if;
  select s.user_id,s.full_name into new.recipient_user_id,new.recipient_name from public.staff_profiles s where s.id=new.recipient_profile_id;
  if new.recipient_user_id is null then raise exception 'This staff member has no linked login account'; end if;
  new.created_by:=auth.uid();new.created_at:=clock_timestamp();new.shared_at:=null;new.version:=1;
 else
  if old.status<>'draft' then raise exception 'Shared reports cannot be changed'; end if;
  if row(new.id,new.recipient_profile_id,new.recipient_user_id,new.recipient_name,new.month,new.branch,new.created_by,new.created_at,new.source_evidence,new.source_generated,new.source_count)
    is distinct from row(old.id,old.recipient_profile_id,old.recipient_user_id,old.recipient_name,old.month,old.branch,old.created_by,old.created_at,old.source_evidence,old.source_generated,old.source_count)
    then raise exception 'The recipient and source snapshot cannot be changed'; end if;
  new.version:=old.version+1;
  new.shared_at:=case when new.status='shared' then clock_timestamp() else null end;
 end if;
 new.updated_at:=clock_timestamp();return new;
end $$;
revoke all on function roster_report_private.guard_report() from public,anon,authenticated;
create trigger guard_attendance_report before insert or update on public.roster_attendance_reports for each row execute function roster_report_private.guard_report();
commit;
