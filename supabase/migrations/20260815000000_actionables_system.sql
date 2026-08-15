-- ============================================================
-- FETS ACTIONABLES & STANDARDISATION SYSTEM MIGRATION
-- Consolidated schema, storage, triggers, and seed data for FETS.LIVE
-- ============================================================

-- 1. STAFF TABLE (supports standalone & auth.users linking)
create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  role text not null default 'member' check (role in ('admin','member')),
  email text,
  auth_user_id uuid references auth.users(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Ensure columns exist if table was partially created
alter table public.staff add column if not exists email text;
alter table public.staff add column if not exists auth_user_id uuid references auth.users(id) on delete set null;
alter table public.staff add column if not exists active boolean not null default true;

-- 2. CENTRES TABLE
create table if not exists public.centres (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  status text not null default 'planned' check (status in ('live','launching','planned')),
  sort_order int not null default 100,
  launched_at date,
  created_at timestamptz not null default now()
);

-- 3. ACTIONABLES TABLE
create table if not exists public.actionables (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  status text not null default 'pending' check (status in ('pending','in_progress','submitted','completed')),
  due_date date,
  created_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- 4. ACTIONABLE ASSIGNMENTS
create table if not exists public.actionable_assignments (
  id uuid primary key default gen_random_uuid(),
  actionable_id uuid not null references public.actionables(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('lead','member')),
  assigned_at timestamptz not null default now(),
  unique (actionable_id, staff_id)
);

-- 5. ACTIONABLE UPDATES / WORK LOG & INSTRUCTIONS
create table if not exists public.actionable_updates (
  id uuid primary key default gen_random_uuid(),
  actionable_id uuid not null references public.actionables(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete set null,
  kind text not null default 'update' check (kind in ('update','instruction','status_change','submission')),
  message text not null,
  created_at timestamptz not null default now()
);

-- 6. ACTIONABLE COLLECTED DATA (Cross-centre matrix items)
create table if not exists public.actionable_data (
  id uuid primary key default gen_random_uuid(),
  actionable_id uuid not null references public.actionables(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete set null,
  label text not null,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7. ACTIONABLE FILES / ATTACHMENTS
create table if not exists public.actionable_files (
  id uuid primary key default gen_random_uuid(),
  actionable_id uuid not null references public.actionables(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete set null,
  file_name text not null,
  storage_path text not null,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

-- 8. CENTRE ROLLOUT (FETS OS launch checklist)
create table if not exists public.centre_rollout (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres(id) on delete cascade,
  actionable_id uuid not null references public.actionables(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started','in_progress','done','na')),
  note text,
  updated_by uuid references public.staff(id) on delete set null,
  spawned_actionable_id uuid references public.actionables(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (centre_id, actionable_id)
);

-- 9. COMPLIANCE ITEMS (Certifications, audits, insurance, renewals calendar)
create table if not exists public.compliance_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'other' check (category in ('certification','audit','insurance','contract','bill','other')),
  centre_id uuid references public.centres(id) on delete set null,
  owner_staff_id uuid references public.staff(id) on delete set null,
  frequency text not null default 'yearly' check (frequency in ('once','monthly','quarterly','half_yearly','yearly')),
  next_due date not null,
  lead_days int not null default 30,
  notes text,
  active boolean not null default true,
  last_spawned_due date,
  last_actionable_id uuid references public.actionables(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 10. APP SETTINGS
create table if not exists public.app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

-- ---------- ROW LEVEL SECURITY ----------
alter table public.staff enable row level security;
alter table public.centres enable row level security;
alter table public.actionables enable row level security;
alter table public.actionable_assignments enable row level security;
alter table public.actionable_updates enable row level security;
alter table public.actionable_data enable row level security;
alter table public.actionable_files enable row level security;
alter table public.centre_rollout enable row level security;
alter table public.compliance_items enable row level security;
alter table public.app_settings enable row level security;

-- Permissive policies for team access
drop policy if exists anon_all_staff on public.staff;
drop policy if exists anon_all_centres on public.centres;
drop policy if exists anon_all_actionables on public.actionables;
drop policy if exists anon_all_assignments on public.actionable_assignments;
drop policy if exists anon_all_updates on public.actionable_updates;
drop policy if exists anon_all_data on public.actionable_data;
drop policy if exists anon_all_files on public.actionable_files;
drop policy if exists anon_all_centre_rollout on public.centre_rollout;
drop policy if exists anon_all_compliance on public.compliance_items;
drop policy if exists anon_all_settings on public.app_settings;

create policy anon_all_staff on public.staff for all using (true) with check (true);
create policy anon_all_centres on public.centres for all using (true) with check (true);
create policy anon_all_actionables on public.actionables for all using (true) with check (true);
create policy anon_all_assignments on public.actionable_assignments for all using (true) with check (true);
create policy anon_all_updates on public.actionable_updates for all using (true) with check (true);
create policy anon_all_data on public.actionable_data for all using (true) with check (true);
create policy anon_all_files on public.actionable_files for all using (true) with check (true);
create policy anon_all_centre_rollout on public.centre_rollout for all using (true) with check (true);
create policy anon_all_compliance on public.compliance_items for all using (true) with check (true);
create policy anon_all_settings on public.app_settings for all using (true) with check (true);

-- ---------- STORAGE BUCKET FOR ATTACHMENTS ----------
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do update set public = true;

drop policy if exists anon_upload_attachments on storage.objects;
drop policy if exists anon_read_attachments on storage.objects;
drop policy if exists anon_delete_attachments on storage.objects;

create policy anon_upload_attachments on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'attachments');
create policy anon_read_attachments on storage.objects
  for select to anon, authenticated using (bucket_id = 'attachments');
create policy anon_delete_attachments on storage.objects
  for delete to anon, authenticated using (bucket_id = 'attachments');

-- ---------- GOOGLE CHAT NOTIFICATIONS TRIGGER ----------
create or replace function public.notify_gchat() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  url text;
  act record;
  who text;
  label text;
begin
  select value into url from public.app_settings where key = 'gchat_webhook';
  if url is null or length(trim(url)) = 0 then return new; end if;

  select code, title into act from public.actionables where id = new.actionable_id;
  select name into who from public.staff where id = new.staff_id;

  label := case new.kind
    when 'instruction' then '📌 INSTRUCTION'
    when 'submission' then '📤 SUBMITTED'
    when 'status_change' then '🔄 STATUS'
    else '💬 UPDATE' end;

  -- Call pg_net if extension exists
  begin
    perform net.http_post(
      url := url,
      body := jsonb_build_object('text',
        '*' || coalesce(act.code,'ACT') || ' · ' || coalesce(act.title,'Actionable') || '*' || E'\n' ||
        label || ' — ' || coalesce(who, 'Team member') || E'\n' || new.message),
      headers := '{"Content-Type":"application/json"}'::jsonb
    );
  exception when others then
    -- fail safely without breaking writes
  end;

  return new;
exception when others then
  return new;
end $$;

drop trigger if exists trg_notify_gchat on public.actionable_updates;
create trigger trg_notify_gchat
after insert on public.actionable_updates
for each row execute function public.notify_gchat();

-- ---------- SEED APP SETTINGS ----------
insert into public.app_settings (key, value) values
  ('rollout_unlock_target', '10')
on conflict (key) do nothing;

-- ---------- SEED CENTRES ----------
insert into public.centres (name, status, sort_order) values
  ('Cochin Centre', 'live', 1),
  ('Calicut Centre', 'live', 2),
  ('Mangalore Centre', 'launching', 3),
  ('Kannur Centre', 'planned', 4)
on conflict (name) do nothing;

-- ---------- SEED STAFF MEMBERS ----------
insert into public.staff (name, role, email) values
  ('Midhun',          'admin',  'mithun@fets.in'),
  ('Nimmy M',         'member', 'nimmy@fets.in'),
  ('Shimna K Navas',  'member', 'shimna@fets.in'),
  ('Aysha Satha',     'member', 'aysha@fets.in'),
  ('Lazeem P',        'member', 'lazeem@fets.in'),
  ('Linofer K',       'member', 'linofer@fets.in'),
  ('Niyas Kassim',    'member', 'niyas@fets.in'),
  ('Ramseena Salim',  'member', 'ramseena@fets.in'),
  ('Naeema MM',       'member', 'naeema@fets.in')
on conflict (name) do update set email = excluded.email;

-- Link staff records to auth.users if available
update public.staff s
set auth_user_id = u.id
from auth.users u
where lower(u.email) = lower(s.email) and s.auth_user_id is null;

-- ---------- SEED ACTIONABLES (ACT-01 & ACT-02) ----------
insert into public.actionables (code, title, description, status, created_by)
values
  ('ACT-01', 'Centre Overheads',
   E'Track every recurring bill for all FETS locations — internet, phone, electricity, rent, DG, water, waste removal.\nCovers Cochin centre, Calicut centre and the Calicut office guest house.\nPhase 1: internet & telephone details. Electricity comes in the next phase.',
   'in_progress', (select id from public.staff where name='Midhun' limit 1)),
  ('ACT-02', 'Client Registry',
   E'One master registry for every exam client — Pearson VUE, ACCA, CELPIP, PSI and more.\nPer client: site codes, certified staff, installed software, support desk and contact persons.\nPlus exams delivered, login/technical requirements and client-specific procedures.',
   'in_progress', (select id from public.staff where name='Midhun' limit 1))
on conflict (code) do nothing;

-- Assignments
insert into public.actionable_assignments (actionable_id, staff_id, member_role)
values
  ((select id from public.actionables where code='ACT-01'), (select id from public.staff where name='Nimmy M' limit 1), 'lead'),
  ((select id from public.actionables where code='ACT-02'), (select id from public.staff where name ilike '%Shimna%' limit 1), 'lead')
on conflict do nothing;

-- Instructions
insert into public.actionable_updates (actionable_id, staff_id, kind, message) values
  ((select id from public.actionables where code='ACT-01'), (select id from public.staff where name='Midhun' limit 1), 'instruction',
   'Start with internet and telephone connection details for Cochin centre, Calicut centre and the Calicut office guest house. Electricity and other utilities will be added in the next phase.'),
  ((select id from public.actionables where code='ACT-02'), (select id from public.staff where name='Midhun' limit 1), 'instruction',
   'Build the registry client by client. For each client capture site codes, certified staff, installed software, support desk details, contact persons, exams delivered, login/technical requirements and any client-specific procedures.')
on conflict do nothing;

-- Data entries: ACT-01
insert into public.actionable_data (actionable_id, staff_id, label, content) values
((select id from public.actionables where code='ACT-01'), (select id from public.staff where name='Nimmy M' limit 1),
 'Cochin Centre · Internet — Airtel',
 jsonb_build_object('text', E'Portal: https://www.airtel.in/business/thanksforbusiness/login/\nConnection ID: 20019572185\nPortal user: mithun@fets.in / @Fets2026\nWiFi: Airtel_mith_6000 / air65691\nPlan: 3999 · 1 Gbps · Rent ₹4,832.50\nBill date: 24th of every month')),
((select id from public.actionables where code='ACT-01'), (select id from public.staff where name='Nimmy M' limit 1),
 'Cochin Centre · Internet — Jio',
 jsonb_build_object('text', E'Portal: https://enterprise.jio.com/Enterprise/myjio-ent/login/index.html#/\nPortal user: niyaskizhakootkassim_6 / Admin@123\nNetwork type: STATIC\nWiFi: fetsstatic / @Fets 2026\nPlan: 4001 · 1 Gbps with 4500 GB data · Rent ₹4,001\nBill date: 02-03-2026 (as per sheet)')),
((select id from public.actionables where code='ACT-01'), (select id from public.staff where name='Nimmy M' limit 1),
 'Calicut Centre · Internet — Airtel',
 jsonb_build_object('text', E'Portal: https://www.airtel.in/business/thanksforbusiness/login/\nConnection ID: 20019572185 (same ID listed for both centres in sheet — please verify)\nPortal user: mithun@fets.in / @Fets2026\nWiFi: Airtel_mith_3992 / Air@28810\nPlan: 3999 · 1 Gbps · Rent ₹4,832.50\nBill date: 24th of every month')),
((select id from public.actionables where code='ACT-01'), (select id from public.staff where name='Nimmy M' limit 1),
 'Calicut Centre · Internet — Jio',
 jsonb_build_object('text', E'Portal: https://enterprise.jio.com/Enterprise/myjio-ent/login/index.html#/\nPortal user: niyaskizhakootkassim_6 / @Fets 2026\nWiFi: jioFiber_forun / @Fets2025\nPlan: 1001 · 200 Mbps with 3300 GB data · Rent ₹1,001\nBill date: 05-03-2026 (as per sheet)'))
on conflict do nothing;

-- Data entries: ACT-02
insert into public.actionable_data (actionable_id, staff_id, label, content) values
((select id from public.actionables where code='ACT-02'), (select id from public.staff where name ilike '%Shimna%' limit 1),
 'Calicut Centre · Site Codes',
 jsonb_build_object('text', E'PEARSON VUE: 88419\nCMA: 4960\nCELPIP: 5485\nITTS: IT217\nPSI: 18133')),
((select id from public.actionables where code='ACT-02'), (select id from public.staff where name ilike '%Shimna%' limit 1),
 'Cochin Centre · Site Codes',
 jsonb_build_object('text', E'PEARSON VUE: 91529\nCMA: 5290\nCELPIP: 5486\nITTS: IT215\nPSI: — (not listed for Cochin)'))
on conflict do nothing;
