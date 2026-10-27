-- Historical notices are read-only; no legacy server writer may bypass review.
revoke insert,update,delete,truncate on public.news_ticker from service_role;
grant select on public.news_ticker to service_role;
