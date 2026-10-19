-- FETS LIVE ONLY. Explicit server policies document the provenance access model.
-- Browser roles retain no privileges or policies; events and provenance are append-only.
begin;
create policy online_source_server_read on fets_duty_private.online_check_sources for select to service_role using (true);
create policy online_source_server_insert on fets_duty_private.online_check_sources for insert to service_role with check (true);
commit;
