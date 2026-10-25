-- Applied to FETS Live (qqewusetilxxfvfkmsed) only, 2026-10-25.
-- Catalogue correction; existing candidate/calendar names remain intact.
begin;
insert into public.clients(name,color)
select 'PARAGON','teal'
where not exists(select 1 from public.clients where upper(trim(name))='PARAGON')
on conflict(name) do nothing;
update public.client_exams
set client_id=(select id from public.clients where upper(trim(name))='PARAGON' limit 1)
where id='cf51f23d-0412-4687-a8b6-3e80893fbd4a'
  and upper(trim(name))='CELPIP'
  and client_id='79f2abfc-dffa-4ac6-8cfa-1e8c9f0691e1';
insert into public.client_exams(client_id,name,locations)
select c.id,'CELPIP',array['calicut','cochin']::text[] from public.clients c
where upper(trim(c.name))='PARAGON'
  and not exists(select 1 from public.client_exams e where e.client_id=c.id and upper(trim(e.name))='CELPIP');
commit;
