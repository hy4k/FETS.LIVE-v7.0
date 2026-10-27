-- Explicit identity links for existing staff with different verified login
-- emails on the two sites. These are administrator-reviewed database records,
-- never a browser-supplied profile, display-name match, or email alias guess.
create table fets_duty_private.online_staff_links (
 online_user_id uuid primary key,
 online_email text not null check(online_email=lower(btrim(online_email)) and length(online_email)>3),
 live_profile_id uuid not null unique references public.staff_profiles(id),
 verified_by uuid not null references auth.users(id),
 reason text not null check(length(btrim(reason))>0),
 created_at timestamptz not null default clock_timestamp()
);
alter table fets_duty_private.online_staff_links enable row level security;
revoke all on fets_duty_private.online_staff_links from public,anon,authenticated,service_role;
comment on table fets_duty_private.online_staff_links is 'Private administrator-verified cross-project identities. No application role may read or edit links directly.';

create or replace function fets_duty_private.online_actor(p_online_user uuid,p_email text,p_branch text)
returns uuid language plpgsql security definer set search_path='' as $$
declare ids uuid[];
begin
 if current_setting('role',true) is distinct from 'service_role' then raise exception 'Server connection required' using errcode='42501';end if;
 if p_online_user is null or p_email is null or length(btrim(p_email))<3 or p_branch not in ('calicut','cochin') or p_branch is null then raise exception 'Invalid staff context' using errcode='22023';end if;
 select array_agg(distinct u.id) into ids from auth.users u join public.staff_profiles s on s.user_id=u.id
 where (
  exists(select 1 from fets_duty_private.online_staff_links l where l.online_user_id=p_online_user and l.online_email=lower(btrim(p_email)) and l.live_profile_id=s.id)
  or (not exists(select 1 from fets_duty_private.online_staff_links l where l.online_user_id=p_online_user) and lower(btrim(u.email))=lower(btrim(p_email)))
 ) and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<clock_timestamp()) and u.deleted_at is null
 and s.is_active is distinct from false
 and exists(select 1 from public.centre_duty_members m where m.user_id=u.id and m.profile_id=s.id and (m.branch=p_branch or (m.branch='*' and m.role='super_admin')));
 if coalesce(cardinality(ids),0)<>1 then raise exception 'Your verified email needs an active FETS Live staff account with access to this centre' using errcode='42501';end if;
 return ids[1];
end $$;
revoke all on function fets_duty_private.online_actor(uuid,text,text) from public,anon,authenticated;
grant execute on function fets_duty_private.online_actor(uuid,text,text) to service_role;
