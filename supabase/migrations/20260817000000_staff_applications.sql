-- ============================================================
--  FETS · LIVE — Staff Applications Portal
--  Additive to leave_requests; covers leave, swap,
--  emergency duty change, and reimbursement requests.
-- ============================================================

-- ---------- TABLE ----------
create table if not exists public.staff_applications (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('leave','swap','emergency_duty','reimbursement')),
  status          text not null default 'pending' check (status in ('pending','approved','rejected')),

  -- applicant
  applicant_id    uuid references public.staff_profiles(id) on delete set null,
  applicant_name  text,
  branch          text,

  -- leave / emergency duty shared
  request_date    date,
  leave_type      text,           -- 'Full-day' | 'Half-day' | 'Emergency'

  -- swap only
  swap_with_name  text,
  swap_with_id    uuid references public.staff_profiles(id) on delete set null,
  swap_date       date,           -- swap partner's date

  -- emergency duty only
  new_shift_code  text,           -- e.g. 'D','N','E','RD'

  -- reimbursement only
  amount          numeric(10,2),
  expense_type    text,           -- 'Travel'|'Meal'|'Material'|'Other'
  receipt_note    text,

  -- shared
  reason          text,
  admin_reply     text,
  resolved_by     uuid references public.staff_profiles(id) on delete set null,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- ---------- INDEXES ----------
create index if not exists staff_applications_applicant_idx on public.staff_applications(applicant_id);
create index if not exists staff_applications_status_idx    on public.staff_applications(status);
create index if not exists staff_applications_created_idx   on public.staff_applications(created_at desc);

-- ---------- RLS ----------
alter table public.staff_applications enable row level security;

-- Staff can see their own applications; super_admins/admins see all
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

-- Only the applicant themselves can insert (their own application)
create policy "sa_insert_own"
  on public.staff_applications for insert
  with check (
    applicant_id = (select id from public.staff_profiles where user_id = auth.uid() limit 1)
  );

-- Only admins can update (to approve/reject)
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

-- ---------- REALTIME ----------
alter publication supabase_realtime add table public.staff_applications;

-- ---------- GRANTS ----------
grant select, insert on public.staff_applications to authenticated;
grant update (status, admin_reply, resolved_by, resolved_at) on public.staff_applications to authenticated;
