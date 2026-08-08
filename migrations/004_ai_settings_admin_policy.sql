-- =====================================================================
-- FETS AI — Phase 4: allow admins to manage agent settings from the UI
-- =====================================================================
-- The Settings panel needs to update ai_settings (provider, kill-switch,
-- model) from the browser. We restrict that to admins via a SECURITY DEFINER
-- helper (bypasses RLS on staff_profiles cleanly, no recursion).
-- =====================================================================

create or replace function public.is_ai_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.staff_profiles sp
    where (sp.user_id = auth.uid() or sp.id = auth.uid())
      and lower(coalesce(sp.role, '')) in ('admin', 'super_admin')
  );
$$;

-- Admins may update the single settings row.
drop policy if exists ai_settings_admin_update on public.ai_settings;
create policy ai_settings_admin_update on public.ai_settings
  for update to authenticated
  using (public.is_ai_admin())
  with check (public.is_ai_admin());
