-- Centre administration only. Existing rosters, duties, tasks, credentials and equipment remain their own systems.
create schema if not exists ascender_private;
revoke all on schema ascender_private from public, anon;
grant usage on schema ascender_private to authenticated;
create function ascender_private.can_manage() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u join public.staff_profiles s on s.user_id=u.id
 where u.id=auth.uid() and u.email_confirmed_at is not null and s.is_active is not false
 and s.role in ('admin','super_admin')
 and (u.raw_app_meta_data->>'role' in ('admin','super_admin') or lower(u.email) in ('mithun@fets.in','mithun@fets.live','niyas@fets.in')));
$$;
revoke all on function ascender_private.can_manage() from public,anon;
grant execute on function ascender_private.can_manage() to authenticated;
create function public.ascender_capabilities() returns boolean language sql stable security invoker set search_path='' as $$ select ascender_private.can_manage() $$;
revoke all on function public.ascender_capabilities() from public,anon;
grant execute on function public.ascender_capabilities() to authenticated;

-- Reuse the original centre IDs: never rename historical Kannur or Mangalore.
insert into public.centres(name,status,sort_order) values ('Mobile unit','planned',5) on conflict(name) do nothing;
create table public.ascender_centres (
 id uuid primary key references public.centres(id),
 code text not null unique check(code in ('calicut','cochin','mobile')),
 address text not null default '', map_url text not null default '' check(map_url='' or map_url ~ '^https://'),
 contact_phone text not null default '', contact_email text not null default '',
 manager_id uuid references public.staff_profiles(id), backup_id uuid references public.staff_profiles(id),
 operating_hours text not null default '', hours_effective_from date,
 notes text not null default '', version integer not null default 1,
 updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
insert into public.ascender_centres(id,code)
 select id,case name when 'Calicut Centre' then 'calicut' when 'Cochin Centre' then 'cochin' else 'mobile' end
 from public.centres where name in ('Calicut Centre','Cochin Centre','Mobile unit');
do $$ begin if (select count(*) from public.ascender_centres)<>3 then raise exception 'Expected three verified centre records'; end if; end $$;
create table public.ascender_rooms (
 id uuid primary key default gen_random_uuid(), centre_id uuid not null references public.ascender_centres(id),
 name text not null check(length(trim(name)) between 1 and 160), total_seats integer not null check(total_seats between 0 and 10000),
 unavailable_seats integer not null default 0 check(unavailable_seats>=0 and unavailable_seats<=total_seats),
 accessibility text not null default '', notes text not null default '', archived boolean not null default false,
 version integer not null default 1, updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create unique index ascender_rooms_active_name on public.ascender_rooms(centre_id,lower(name)) where not archived;
create table public.ascender_programmes (
 id uuid primary key default gen_random_uuid(), centre_id uuid not null references public.ascender_centres(id),
 client_id uuid not null references public.clients(id), programme text not null check(length(trim(programme)) between 1 and 160),
 site_code text not null default '', approved_capacity integer check(approved_capacity between 0 and 10000),
 approval text not null default 'not_checked' check(approval in ('not_checked','approved','suspended')),
 evidence_url text not null default '' check(evidence_url='' or evidence_url ~ '^https://'),
 notes text not null default '', archived boolean not null default false,
 version integer not null default 1, updated_at timestamptz not null default now(), updated_by uuid references auth.users(id),
 check(approval<>'approved' or (approved_capacity is not null and length(trim(site_code))>0 and length(trim(evidence_url))>0))
);
create table public.ascender_documents (
 id uuid primary key default gen_random_uuid(), centre_id uuid not null references public.ascender_centres(id),
 title text not null check(length(trim(title)) between 1 and 200),
 url text not null check(url ~ '^https://'), owner_id uuid references public.staff_profiles(id),
 compliance_id uuid references public.compliance_items(id), notes text not null default '', archived boolean not null default false,
 version integer not null default 1, updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
-- Reuse renewals rather than introducing a second reminder table.
alter table public.compliance_items add column owner_profile_id uuid references public.staff_profiles(id);
alter table public.compliance_items add constraint compliance_lead_days_range check(lead_days between 0 and 365);
alter table public.compliance_items add column version integer not null default 1;
alter table public.compliance_items add column updated_by uuid references auth.users(id);
drop policy if exists anon_all_compliance on public.compliance_items;
create policy ascender_compliance_read on public.compliance_items for select to authenticated using((select ascender_private.can_manage()));
create policy ascender_compliance_insert on public.compliance_items for insert to authenticated with check((select ascender_private.can_manage()));
create policy ascender_compliance_update on public.compliance_items for update to authenticated using((select ascender_private.can_manage())) with check((select ascender_private.can_manage()));
revoke all on public.compliance_items from anon;
grant select,insert,update on public.compliance_items to authenticated;
revoke delete on public.compliance_items from authenticated;
create table public.ascender_deployments (
 id uuid primary key default gen_random_uuid(), centre_id uuid not null references public.ascender_centres(id),
 venue text not null check(length(trim(venue)) between 1 and 200), address text not null default '',
 contact text not null default '', client_id uuid references public.clients(id), programme text not null default '',
 start_date date not null, end_date date not null check(end_date>=start_date), setup_due date not null check(setup_due<=start_date),
 required_seats integer check(required_seats between 0 and 10000), lead_id uuid references public.staff_profiles(id),
 transport_notes text not null default '', readiness text not null default 'not_checked' check(readiness in ('not_checked','needs_attention','confirmed')),
 readiness_note text not null default '', confirmed_at timestamptz, confirmed_by uuid references auth.users(id),
 status text not null default 'planned' check(status in ('planned','setup','active','closed','cancelled')),
 closeout_notes text not null default '', version integer not null default 1,
 updated_at timestamptz not null default now(), updated_by uuid references auth.users(id),
 check(readiness<>'confirmed' or (length(trim(readiness_note))>0 and lead_id is not null and required_seats is not null)),
 check(status<>'closed' or length(trim(closeout_notes))>0)
);
create table public.ascender_history (
 id bigint generated always as identity primary key, centre_id uuid references public.ascender_centres(id),
 table_name text not null, record_id uuid not null, changed_at timestamptz not null default now(),
 actor_id uuid references auth.users(id), before_data jsonb, after_data jsonb not null
);
create index ascender_history_centre_date on public.ascender_history(centre_id,changed_at desc);
create index ascender_centres_manager on public.ascender_centres(manager_id);
create index ascender_centres_backup on public.ascender_centres(backup_id);
create index ascender_programmes_centre on public.ascender_programmes(centre_id);
create index ascender_programmes_client on public.ascender_programmes(client_id);
create index ascender_documents_centre on public.ascender_documents(centre_id);
create index ascender_documents_owner on public.ascender_documents(owner_id);
create index ascender_documents_compliance on public.ascender_documents(compliance_id);
create index ascender_deployments_centre_date on public.ascender_deployments(centre_id,start_date);
create index ascender_deployments_lead on public.ascender_deployments(lead_id);
create index ascender_deployments_client on public.ascender_deployments(client_id);
create index compliance_owner_profile on public.compliance_items(owner_profile_id);

create function ascender_private.record_change() returns trigger language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
 if not ascender_private.can_manage() then raise exception 'Centre administration requires an active authorised admin' using errcode='42501'; end if;
 if tg_table_name='ascender_centres' then
   cid:=new.id;
   if tg_op='UPDATE' and (new.id<>old.id or new.code<>old.code) then raise exception 'Centre identity cannot change'; end if;
 else
   if tg_op='UPDATE' and new.id<>old.id then raise exception 'Record identity cannot change'; end if;
   cid:=new.centre_id;
   if tg_op='UPDATE' and new.centre_id is distinct from old.centre_id then raise exception 'A record cannot move between centres'; end if;
 end if;
 if tg_table_name='ascender_deployments' then
   if not exists(select 1 from public.ascender_centres where id=cid and code='mobile') then raise exception 'Deployments belong to the Mobile unit'; end if;
   if new.readiness='confirmed' then
     if tg_op='INSERT' then new.confirmed_at:=now(); new.confirmed_by:=auth.uid();
     elsif old.readiness<>'confirmed' or (to_jsonb(new)-array['version','updated_at','updated_by','confirmed_at','confirmed_by']) is distinct from (to_jsonb(old)-array['version','updated_at','updated_by','confirmed_at','confirmed_by']) then
       new.confirmed_at:=now(); new.confirmed_by:=auth.uid();
     else new.confirmed_at:=old.confirmed_at; new.confirmed_by:=old.confirmed_by; end if;
   else new.confirmed_at:=null; new.confirmed_by:=null; end if;
 end if;
 if tg_table_name='ascender_documents' then
   if new.compliance_id is not null and not exists(select 1 from public.compliance_items c where c.id=new.compliance_id and c.centre_id=cid) then raise exception 'Renewal must belong to the same centre'; end if;
 end if;
 new.version:=case when tg_op='UPDATE' then old.version+1 else 1 end;
 new.updated_at:=now(); new.updated_by:=auth.uid();
 insert into public.ascender_history(centre_id,table_name,record_id,actor_id,before_data,after_data)
 values(case when exists(select 1 from public.ascender_centres where id=cid) then cid end,tg_table_name,new.id,auth.uid(),case when tg_op='UPDATE' then to_jsonb(old) end,to_jsonb(new));
 return new;
end $$;
revoke all on function ascender_private.record_change() from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['ascender_centres','ascender_rooms','ascender_programmes','ascender_documents','ascender_deployments'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select,insert,update on public.%I to authenticated',t);
 execute format('create policy manager_read on public.%I for select to authenticated using ((select ascender_private.can_manage()))',t);
 execute format('create policy manager_insert on public.%I for insert to authenticated with check ((select ascender_private.can_manage()))',t);
 execute format('create policy manager_update on public.%I for update to authenticated using ((select ascender_private.can_manage())) with check ((select ascender_private.can_manage()))',t);
 execute format('create trigger centre_change before insert or update on public.%I for each row execute function ascender_private.record_change()',t);
 end loop;
end $$;
-- Only seeded centre identities may be edited; managers cannot add a fourth centre.
revoke insert on public.ascender_centres from authenticated;
create trigger centre_renewal_change before insert or update on public.compliance_items for each row execute function ascender_private.record_change();
alter table public.ascender_history enable row level security;
revoke all on public.ascender_history from anon,authenticated;
grant select on public.ascender_history to authenticated;
create policy manager_history on public.ascender_history for select to authenticated using((select ascender_private.can_manage()));

-- Index administrator references used by foreign-key checks and audit lookups.
do $$ declare t text; begin
 foreach t in array array['ascender_centres','ascender_rooms','ascender_programmes','ascender_documents','ascender_deployments','compliance_items'] loop
 execute format('create index %I on public.%I(updated_by)',t||'_updated_by_idx',t);
 end loop;
end $$;
create index ascender_deployments_confirmed_by on public.ascender_deployments(confirmed_by);
create index ascender_history_actor on public.ascender_history(actor_id);
