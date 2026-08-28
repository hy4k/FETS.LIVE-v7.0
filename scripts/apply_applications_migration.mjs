/**
 * Apply staff_applications table migration + fix leave_requests RLS
 * Usage: SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/apply_applications_migration.mjs
 */

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = 'qqewusetilxxfvfkmsed';

if (!token) {
  console.error('❌  SUPABASE_ACCESS_TOKEN env var not set');
  console.error('   Get it from https://supabase.com/dashboard/account/tokens');
  process.exit(1);
}

async function runSql(query, label) {
  process.stdout.write(`▶ ${label} … `);
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (res.ok) {
    console.log('✅');
  } else {
    console.log(`❌ HTTP ${res.status}\n${text}`);
  }
  return res.ok;
}

// 1. Create staff_applications table with correct schema
await runSql(`
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
`, 'Create staff_applications table');

await runSql(`
  create index if not exists staff_applications_applicant_idx on public.staff_applications(applicant_id);
  create index if not exists staff_applications_status_idx    on public.staff_applications(status);
  create index if not exists staff_applications_created_idx   on public.staff_applications(created_at desc);
`, 'Create indexes');

await runSql(`
  alter table public.staff_applications enable row level security;
`, 'Enable RLS on staff_applications');

// Drop and recreate policies to ensure they're fresh
await runSql(`
  drop policy if exists "sa_select_own_or_admin" on public.staff_applications;
  drop policy if exists "sa_insert_own"           on public.staff_applications;
  drop policy if exists "sa_update_admin"         on public.staff_applications;
`, 'Drop old policies');

await runSql(`
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
`, 'Select policy');

await runSql(`
  create policy "sa_insert_own"
    on public.staff_applications for insert
    with check (
      applicant_id = (select id from public.staff_profiles where user_id = auth.uid() limit 1)
    );
`, 'Insert policy');

await runSql(`
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
`, 'Update policy (admin only)');

await runSql(`
  grant select, insert on public.staff_applications to authenticated;
  grant update (status, admin_reply, resolved_by, resolved_at) on public.staff_applications to authenticated;
`, 'Grant permissions');

// 2. Fix leave_requests RLS — add insert policy if missing
await runSql(`
  drop policy if exists "lr_insert_own" on public.leave_requests;
  create policy "lr_insert_own"
    on public.leave_requests for insert
    with check (user_id = auth.uid());
`, 'Fix leave_requests INSERT RLS');

await runSql(`
  drop policy if exists "lr_select_own_or_admin" on public.leave_requests;
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
`, 'Fix leave_requests SELECT RLS');

await runSql(`
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
`, 'Fix leave_requests UPDATE RLS (admin)');

// 3. Add missing columns to leave_requests if not present
await runSql(`
  alter table public.leave_requests 
    add column if not exists admin_reply text,
    add column if not exists approved_by uuid,
    add column if not exists approved_at timestamptz;
`, 'Add missing columns to leave_requests');

// 4. Enable realtime on staff_applications
await runSql(`
  do $$ begin
    perform 1;
    alter publication supabase_realtime add table public.staff_applications;
  exception when duplicate_object then null;
  end $$;
`, 'Enable realtime on staff_applications');

console.log('\n✅ All migrations complete!');
