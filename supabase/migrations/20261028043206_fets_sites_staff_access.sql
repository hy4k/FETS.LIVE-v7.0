-- FETS Live only. Honour the same FETS Sites permission as User Management.
-- Every confirmed, active staff account has access by default; an explicit
-- management-set false remains authoritative. No profiles or centre rows change.
create or replace function ascender_private.can_manage()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from auth.users u join public.staff_profiles s on s.user_id=u.id
  where u.id=auth.uid() and u.email_confirmed_at is not null
   and s.is_active is not false
   and case
    when jsonb_typeof(s.permissions->'ws_system-manager')='boolean'
     then s.permissions->'ws_system-manager'='true'::jsonb
    else true
   end
 );
$$;
revoke all on function ascender_private.can_manage() from public,anon;
grant execute on function ascender_private.can_manage() to authenticated;
