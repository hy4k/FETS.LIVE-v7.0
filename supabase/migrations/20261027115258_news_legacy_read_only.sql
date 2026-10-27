-- Historical notice access is read-only, including non-DML privileges.
revoke all on public.news_ticker from public,anon,authenticated,service_role;
grant select on public.news_ticker to authenticated,service_role;
