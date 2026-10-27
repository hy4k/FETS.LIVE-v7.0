-- Explicitly deny application access to reviewed identity links. The owner-run
-- identity resolver reads them without exposing them through either website.
create policy online_staff_links_no_application_access on fets_duty_private.online_staff_links
 for all to public using(false) with check(false);
