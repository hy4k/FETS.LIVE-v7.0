-- ============================================================
--  FETS LIVE — Applications Portal Fix
--  Run this in Supabase Dashboard > SQL Editor
--  Project: qqewusetilxxfvfkmsed (fets.live)
-- ============================================================

-- ----------------------------------------------------------------
-- 1. FIX leave_requests RLS to allow authenticated inserts
-- ----------------------------------------------------------------
-- Drop existing insert policy if any (they may block inserts)
drop policy if exists "lr_insert_own" on public.leave_requests;
drop policy if exists "Users can insert own leave requests" on public.leave_requests;
drop policy if exists "Authenticated users can insert leave requests" on public.leave_requests;

-- Allow authenticated users to insert their own leave requests
create policy "lr_insert_own"
  on public.leave_requests for insert
  with check (user_id = auth.uid());

-- Drop and recreate SELECT policy
drop policy if exists "lr_select_own_or_admin" on public.leave_requests;
drop policy if exists "Users can view own leave requests" on public.leave_requests;
drop policy if exists "Admins can view all leave requests" on public.leave_requests;

create policy "lr_select_own_or_admin"
  on public.leave_requests for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.staff_profiles
      where user_id = auth.uid()
        and role in ('super_admin', 'admin', 'Super Admin', 'Admin')
      limit 1
    )
  );

-- Drop and recreate UPDATE policy
drop policy if exists "lr_update_admin" on public.leave_requests;
create policy "lr_update_admin"
  on public.leave_requests for update
  using (
    exists (
      select 1 from public.staff_profiles
      where user_id = auth.uid()
        and role in ('super_admin', 'admin', 'Super Admin', 'Admin')
      limit 1
    )
  );

-- Add missing columns if not exists
alter table public.leave_requests
  add column if not exists admin_reply text,
  add column if not exists approved_at timestamptz;

-- Make sure approved_by is uuid type (may already exist as bigint)
-- Only run if column doesn't exist:
alter table public.leave_requests
  add column if not exists approved_by uuid;

-- ----------------------------------------------------------------
-- 2. CREATE staff_applications TABLE (full application portal)
-- ----------------------------------------------------------------
create table if not exists public.staff_applications (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('leave','swap','emergency_duty','reimbursement')),
  status          text not null default 'pending' check (status in ('pending','approved','rejected')),
  applicant_id    uuid references public.staff_profiles(id) on delete set null,
  applicant_name  text,
  branch          text,
  request_date    date,
  leave_type      text,
  swap_with_name  text,
  swap_with_id    uuid references public.staff_profiles(id) on delete set null,
  swap_date       date,
  new_shift_code  text,
  amount          numeric(10,2),
  expense_type    text,
  receipt_note    text,
  reason          text,
  admin_reply     text,
  resolved_by     uuid references public.staff_profiles(id) on delete set null,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- Indexes
create index if not exists staff_applications_applicant_idx on public.staff_applications(applicant_id);
create index if not exists staff_applications_status_idx    on public.staff_applications(status);
create index if not exists staff_applications_created_idx   on public.staff_applications(created_at desc);

-- RLS
alter table public.staff_applications enable row level security;

drop policy if exists "sa_select_own_or_admin" on public.staff_applications;
drop policy if exists "sa_insert_own"           on public.staff_applications;
drop policy if exists "sa_update_admin"         on public.staff_applications;

create policy "sa_select_own_or_admin"
  on public.staff_applications for select
  using (
    applicant_id = (select id from public.staff_profiles where user_id = auth.uid() limit 1)
    or exists (
      select 1 from public.staff_profiles
      where user_id = auth.uid()
        and role in ('super_admin', 'admin', 'Super Admin', 'Admin')
      limit 1
    )
  );

create policy "sa_insert_own"
  on public.staff_applications for insert
  with check (
    applicant_id = (select id from public.staff_profiles where user_id = auth.uid() limit 1)
  );

create policy "sa_update_admin"
  on public.staff_applications for update
  using (
    exists (
      select 1 from public.staff_profiles
      where user_id = auth.uid()
        and role in ('super_admin', 'admin', 'Super Admin', 'Admin')
      limit 1
    )
  );

-- Grants
grant select, insert on public.staff_applications to authenticated;
grant update (status, admin_reply, resolved_by, resolved_at) on public.staff_applications to authenticated;

-- Realtime
do $$ begin
  alter publication supabase_realtime add table public.staff_applications;
exception when duplicate_object then null;
end $$;

select 'Applications portal SQL applied successfully!' as result;
