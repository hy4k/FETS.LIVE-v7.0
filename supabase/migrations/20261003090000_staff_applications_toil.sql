-- Staff can apply for a TOIL day off through the same applications as leave.
-- Approval marks the roster day TR (TOIL Redeemed).
begin;
do $$
declare c record;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.staff_applications'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) ilike '%kind%' loop
    execute format('alter table public.staff_applications drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.staff_applications
  add constraint staff_applications_kind_check check (kind in ('leave', 'toil', 'swap', 'emergency_duty', 'reimbursement'));
notify pgrst, 'reload schema';
commit;
