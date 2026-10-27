-- Supabase project defaults may grant service_role broad table/function access.
-- Remove those defaults explicitly: collection cannot publish or acknowledge.
revoke all on public.fets_news_sources,public.fets_news_drafts,public.fets_news_posts,public.fets_news_receipts,public.fets_news_collection_runs from service_role;
grant select,insert on public.fets_news_sources,public.fets_news_drafts,public.fets_news_collection_runs to service_role;
grant select on public.fets_news_posts to service_role;
revoke all on function public.fets_news_publish(uuid,integer),public.fets_news_set_collection(text,boolean),public.fets_news_set_domains(text[]) from service_role;
revoke all on function fets_news_private.set_collection(text,boolean),fets_news_private.set_domains(text[]) from service_role;
grant execute on function public.fets_news_context(),public.fets_news_collect(text,jsonb,text) to service_role;
