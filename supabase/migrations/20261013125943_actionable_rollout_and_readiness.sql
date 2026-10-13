-- Shared decisions and evidence; existing institutions, work and results remain intact.
begin;
create schema fets_actionables_private;
revoke all on schema fets_actionables_private from public,anon;
grant usage on schema fets_actionables_private to authenticated,service_role;
create table fets_actionables_private.members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 profile_id uuid not null unique references public.staff_profiles(id) on delete cascade,
 full_name text not null,
 project_role text not null check(project_role in ('manager','staff')),
 enabled boolean not null
);
-- Provision from the reviewed staff roster once. Browser-editable profile roles
-- cannot grant project membership or management authority after installation.
insert into fets_actionables_private.members(user_id,profile_id,full_name,project_role,enabled)
select user_id,id,coalesce(full_name,'Staff'),case when lower(role::text) in ('admin','super_admin') then 'manager' else 'staff' end,coalesce(is_active,false)
from public.staff_profiles where user_id is not null;
alter table fets_actionables_private.members enable row level security;
create policy project_member_self on fets_actionables_private.members for select to authenticated using(user_id=(select auth.uid()));
revoke all on fets_actionables_private.members from public,anon,authenticated;
grant select on fets_actionables_private.members to authenticated;
grant all on fets_actionables_private.members to service_role;
create function fets_actionables_private.access() returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from fets_actionables_private.members where user_id=(select auth.uid()) and enabled)
$$;
create function fets_actionables_private.me() returns uuid language sql stable security invoker set search_path='' as $$
 select profile_id from fets_actionables_private.members where user_id=(select auth.uid()) and enabled
$$;
create function fets_actionables_private.name() returns text language sql stable security invoker set search_path='' as $$
 select full_name from fets_actionables_private.members where user_id=(select auth.uid()) and enabled
$$;
-- The roster is private. This read-only definer checks the authenticated principal
-- against protected membership before returning the project's fixed directory.
create function fets_actionables_private.directory() returns table(id uuid,user_id uuid,full_name text,is_active boolean,role text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from fets_actionables_private.members m where m.user_id=auth.uid() and m.enabled) then return;end if;
 return query select m.profile_id,m.user_id,m.full_name,m.enabled,m.project_role from fets_actionables_private.members m order by m.full_name;
end $$;
create function public.fets_actionables_directory() returns table(id uuid,user_id uuid,full_name text,is_active boolean,role text)
language sql stable security invoker set search_path='' as $$select * from fets_actionables_private.directory()$$;
create function public.fets_actionables_can_manage() returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from fets_actionables_private.members where user_id=(select auth.uid()) and enabled and project_role='manager')
$$;
create function public.fets_actionables_capabilities() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('version',2,'rollout',fets_actionables_private.access(),'manage',public.fets_actionables_can_manage(),
 'profileId',fets_actionables_private.me(),'name',fets_actionables_private.name(),'userId',auth.uid())
$$;
revoke all on function fets_actionables_private.access(),fets_actionables_private.me(),fets_actionables_private.name(),fets_actionables_private.directory(),public.fets_actionables_directory() from public,anon;
grant execute on function fets_actionables_private.access(),fets_actionables_private.me(),fets_actionables_private.name(),fets_actionables_private.directory(),public.fets_actionables_directory() to authenticated,service_role;

-- Protect security-sensitive profile edits and synchronize approved lifecycle changes.
-- Existing basic self-profile editing and delegated HR contact edits remain available.
create function fets_actionables_private.profile_security_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); manager boolean; operator boolean; delegated boolean; sensitive boolean;
begin
 operator:=actor is null and current_setting('role',true) in ('none','postgres','service_role');
 if actor is null and not operator then raise exception 'Sign in to change staff profiles' using errcode='42501';end if;
 manager:=operator or exists(select 1 from fets_actionables_private.members m where m.user_id=actor and m.enabled and m.project_role='manager');
 if tg_op='DELETE' then
  if not manager then raise exception 'Management removes staff profiles' using errcode='42501';end if;
  delete from fets_actionables_private.members where profile_id=old.id;
  return old;
 end if;
 if tg_op='INSERT' then
  if not manager and (new.user_id is distinct from actor or lower(coalesce(new.role::text,'')) not in ('fetsian','staff') or coalesce(new.permissions,'{}')<>'{}'::jsonb) then
   raise exception 'Management assigns staff roles and permissions' using errcode='42501';
  end if;
 else
  sensitive:=(new.id,new.user_id,new.role,new.is_active,new.permissions) is distinct from (old.id,old.user_id,old.role,old.is_active,old.permissions);
  if sensitive and not manager then raise exception 'Management changes staff roles, access and permissions' using errcode='42501';end if;
  if new.id is distinct from old.id or (new.user_id is distinct from old.user_id and exists(select 1 from fets_actionables_private.members where profile_id=old.id)) then
   raise exception 'A provisioned staff account keeps its identity';
  end if;
  delegated:=exists(select 1 from fets_actionables_private.members m join public.staff_profiles p on p.id=m.profile_id
   where m.user_id=actor and m.enabled and (p.permissions @> '{"staff_edit":true}'::jsonb or p.permissions @> '{"user_management_edit":true}'::jsonb));
  if not manager and not delegated and actor is distinct from old.user_id then raise exception 'Update your own profile or ask management' using errcode='42501';end if;
 end if;
 if manager and new.user_id is not null then
  if not operator and exists(select 1 from fets_actionables_private.members where user_id=new.user_id and enabled and project_role='manager')
   and (not coalesce(new.is_active,false) or lower(coalesce(new.role::text,'')) not in ('admin','super_admin'))
   and not exists(select 1 from fets_actionables_private.members where user_id<>new.user_id and enabled and project_role='manager') then
   raise exception 'Keep at least one project manager enabled';
  end if;
  insert into fets_actionables_private.members(user_id,profile_id,full_name,project_role,enabled)
  values(new.user_id,new.id,coalesce(new.full_name,'Staff'),case when lower(new.role::text) in ('admin','super_admin') then 'manager' else 'staff' end,coalesce(new.is_active,false))
  on conflict(user_id) do update set full_name=excluded.full_name,project_role=excluded.project_role,enabled=excluded.enabled;
 elsif tg_op='UPDATE' and actor=new.user_id then
  update fets_actionables_private.members set full_name=coalesce(new.full_name,'Staff') where user_id=actor;
 end if;
 return new;
end $$;
create trigger actionables_profile_security_guard after insert or update or delete on public.staff_profiles
for each row execute function fets_actionables_private.profile_security_guard();
revoke all on function fets_actionables_private.profile_security_guard() from public,anon;
grant execute on function fets_actionables_private.profile_security_guard() to authenticated,service_role;

create table public.mission_rollout_selections (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.expansion_institutions(id) on delete cascade,
 selected boolean not null,
 previous_id uuid references public.mission_rollout_selections(id),
 selected_by uuid not null references public.staff_profiles(id), selected_name text not null,
 created_at timestamptz not null default clock_timestamp()
);
create index mission_rollout_latest on public.mission_rollout_selections(institution_id,created_at desc,id desc);
create index mission_rollout_author on public.mission_rollout_selections(selected_by);
create index mission_rollout_previous on public.mission_rollout_selections(previous_id);
alter table public.mission_rollout_selections enable row level security;
create policy rollout_read on public.mission_rollout_selections for select to authenticated using((select fets_actionables_private.access()));
create policy rollout_decide on public.mission_rollout_selections for insert to authenticated with check((select public.fets_actionables_can_manage()));
create function public.mission_rollout_selection_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare last_id uuid; targets integer;
begin
 if not public.fets_actionables_can_manage() then raise exception 'Management chooses the rollout shortlist';end if;
 -- Serialize all shortlist decisions, including removals, before reading the latest state.
 perform pg_advisory_xact_lock(706713,7);
 select id into last_id from public.mission_rollout_selections
 where institution_id=new.institution_id order by created_at desc,id desc limit 1;
 if new.previous_id is distinct from last_id then raise exception 'The shortlist changed. Refresh before deciding';end if;
 select count(*) into targets from (
  select distinct on(institution_id) institution_id,selected from public.mission_rollout_selections
  order by institution_id,created_at desc,id desc
 ) latest where selected and institution_id<>new.institution_id;
 if new.selected and targets>=7 then raise exception 'Seven institutions are already shortlisted. Remove one before adding another';end if;
 new.selected_by:=fets_actionables_private.me();new.selected_name:=fets_actionables_private.name();
 new.created_at:=clock_timestamp();return new;
end $$;
create trigger mission_rollout_selection_guard before insert on public.mission_rollout_selections
for each row execute function public.mission_rollout_selection_guard();

create table public.mission_readiness_observations (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.expansion_institutions(id) on delete cascade,
 criterion text not null check(criterion in ('c1','c2','c3','c4','c5','c6','c7','c8','c9','c10')),
 state text not null check(state in ('ready','gap','not_applicable')),
 evidence text not null check(length(btrim(evidence)) between 10 and 4000),
 source_url text not null default '' check(length(source_url)<=2000 and (source_url='' or source_url~'^https?://[^[:space:]]+$')),
 previous_id uuid references public.mission_readiness_observations(id),
 observed_by uuid not null references public.staff_profiles(id), observed_name text not null,
 created_at timestamptz not null default clock_timestamp()
);
create index mission_readiness_latest on public.mission_readiness_observations(institution_id,criterion,created_at desc,id desc);
create index mission_readiness_author on public.mission_readiness_observations(observed_by);
create index mission_readiness_previous on public.mission_readiness_observations(previous_id);
alter table public.mission_readiness_observations enable row level security;
create policy readiness_read on public.mission_readiness_observations for select to authenticated using((select fets_actionables_private.access()));
create policy readiness_record on public.mission_readiness_observations for insert to authenticated with check((select fets_actionables_private.access()));
create function public.mission_readiness_observation_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare last_id uuid;
begin
 if not fets_actionables_private.access() then raise exception 'Active staff access required';end if;
 perform pg_advisory_xact_lock(hashtext(new.institution_id::text),hashtext(new.criterion));
 select id into last_id from public.mission_readiness_observations
 where institution_id=new.institution_id and criterion=new.criterion order by created_at desc,id desc limit 1;
 if new.previous_id is distinct from last_id then raise exception 'This check changed. Refresh before recording another observation';end if;
 new.observed_by:=fets_actionables_private.me();new.observed_name:=fets_actionables_private.name();
 new.created_at:=clock_timestamp();return new;
end $$;
create trigger mission_readiness_observation_guard before insert on public.mission_readiness_observations
for each row execute function public.mission_readiness_observation_guard();

-- Explicitly reset broad Supabase defaults: history has no client UPDATE, DELETE or TRUNCATE.
revoke all on public.mission_rollout_selections,public.mission_readiness_observations from public,anon,authenticated;
grant select,insert on public.mission_rollout_selections,public.mission_readiness_observations to authenticated;
grant all on public.mission_rollout_selections,public.mission_readiness_observations to service_role;
revoke all on function public.fets_actionables_can_manage(),public.fets_actionables_capabilities(),public.mission_rollout_selection_guard(),public.mission_readiness_observation_guard() from public,anon;
grant execute on function public.fets_actionables_can_manage(),public.fets_actionables_capabilities(),public.mission_rollout_selection_guard(),public.mission_readiness_observation_guard() to authenticated,service_role;
notify pgrst,'reload schema';
commit;
