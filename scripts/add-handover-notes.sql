-- Create handover_notes table
create table if not exists public.handover_notes (
  id uuid primary key default gen_random_uuid(),
  author text not null, -- 'Mithun' or 'Niyas'
  content text not null,
  tagged_staff text[] not null default '{}',
  centers text[] not null default '{}', -- 'calicut', 'cochin'
  created_at timestamptz not null default now(),
  created_by uuid
);

-- Enable Row Level Security (RLS)
alter table public.handover_notes enable row level security;

-- Grant permissions to authenticated users and service role
grant select, insert, update, delete on public.handover_notes to authenticated;
grant select, insert, update, delete on public.handover_notes to service_role;

-- Policies for RLS
drop policy if exists "Allow read access for handover_notes" on public.handover_notes;
create policy "Allow read access for handover_notes" on public.handover_notes
  for select to authenticated using (true);

drop policy if exists "Allow write access for handover_notes" on public.handover_notes;
create policy "Allow write access for handover_notes" on public.handover_notes
  for all to authenticated using (true) with check (true);
