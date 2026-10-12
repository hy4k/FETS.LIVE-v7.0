-- Supabase default table grants can include TRUNCATE, which bypasses RLS.
-- Keep personnel decisions available only through the intended RLS actions.
begin;
revoke all on public.centre_staff_development from public, anon, authenticated;
grant select, insert, update on public.centre_staff_development to authenticated;
notify pgrst, 'reload schema';
commit;
