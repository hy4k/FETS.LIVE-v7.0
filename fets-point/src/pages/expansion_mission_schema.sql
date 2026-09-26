-- ═══════════════════════════════════════════════════════════════════════════
-- MISSION 7: Pearson VUE Center Expansion — Kerala
-- Database Schema Migration
-- Run via: pnpm sql  OR paste into Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Enums (skip if already exist)
do $$ begin
  create type kerala_district as enum ('Kottayam', 'Ernakulam', 'Thrissur', 'Calicut', 'Kannur');
exception when duplicate_object then null; end $$;

do $$ begin
  create type expansion_stage as enum (
    'identified',
    'contacted',
    'audit_in_progress',
    'mou_review',
    'pearson_approved'
  );
exception when duplicate_object then null; end $$;

-- 2. Institutions Table
create table if not exists expansion_institutions (
  id                         uuid primary key default gen_random_uuid(),
  name                       text not null,
  district                   kerala_district not null,
  address                    text,
  primary_contact_name       text,
  primary_contact_phone      text,
  primary_contact_email      text,
  primary_contact_role       text,
  lab_seat_capacity          integer default 0,
  stage                      expansion_stage default 'identified',
  assigned_staff_id          uuid references auth.users(id) on delete set null,
  assigned_staff_name        text,

  -- Pearson VUE & ACCA Technical Audit Criteria
  has_dual_isp               boolean default false,
  has_static_ip              boolean default false,
  has_ups_generator          boolean default false,
  has_cctv_coverage          boolean default false,
  has_air_conditioning       boolean default false,
  has_secure_candidate_storage boolean default false,
  is_acca_ready              boolean default false,

  notes                      text,
  created_at                 timestamptz default now(),
  updated_at                 timestamptz default now()
);

-- 3. Activity Logs & Internal Comments
create table if not exists expansion_activity_logs (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid references expansion_institutions(id) on delete cascade not null,
  staff_id        uuid references auth.users(id) on delete set null,
  staff_name      text not null,
  entry_type      text default 'note',   -- 'note' | 'stage_change' | 'audit_update'
  content         text not null,
  created_at      timestamptz default now()
);

-- 4. Auto-update updated_at trigger
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists expansion_institutions_updated_at on expansion_institutions;
create trigger expansion_institutions_updated_at
  before update on expansion_institutions
  for each row execute function set_updated_at();

-- 5. Row-Level Security
alter table expansion_institutions     enable row level security;
alter table expansion_activity_logs    enable row level security;

-- Drop old policies if re-running
drop policy if exists "Staff full access to expansion_institutions"  on expansion_institutions;
drop policy if exists "Staff full access to expansion_activity_logs" on expansion_activity_logs;

-- All authenticated FETS staff have full read/write access
create policy "Staff full access to expansion_institutions"
  on expansion_institutions for all
  to authenticated
  using (true)
  with check (true);

create policy "Staff full access to expansion_activity_logs"
  on expansion_activity_logs for all
  to authenticated
  using (true)
  with check (true);

-- 6. Indexes for query performance
create index if not exists idx_expansion_institutions_district on expansion_institutions(district);
create index if not exists idx_expansion_institutions_stage    on expansion_institutions(stage);
create index if not exists idx_expansion_logs_institution      on expansion_activity_logs(institution_id);
create index if not exists idx_expansion_logs_created          on expansion_activity_logs(created_at);
