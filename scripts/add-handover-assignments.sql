-- Create handover_assignments table
create table if not exists public.handover_assignments (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  branch text not null,
  staff_names text[] not null default '{}',
  created_at timestamptz not null default now(),
  created_by uuid,
  unique(date, branch)
);

-- Enable Row Level Security (RLS)
alter table public.handover_assignments enable row level security;

-- Grant permissions to authenticated users
grant select, insert, update, delete on public.handover_assignments to authenticated;
grant select, insert, update, delete on public.handover_assignments to service_role;

-- Policies for RLS
drop policy if exists "Allow read access for handover_assignments" on public.handover_assignments;
create policy "Allow read access for handover_assignments" on public.handover_assignments
  for select to authenticated using (true);

drop policy if exists "Allow write access for handover_assignments" on public.handover_assignments;
create policy "Allow write access for handover_assignments" on public.handover_assignments
  for all to authenticated using (true) with check (true);
