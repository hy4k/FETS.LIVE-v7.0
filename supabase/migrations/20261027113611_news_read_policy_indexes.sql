-- Keep the common staff-read policy separate from approval-only writes.
create index news_settings_approver on fets_news_private.settings(approver_user_id);
drop policy news_posts_editor on public.fets_news_posts;
create policy news_posts_insert_editor on public.fets_news_posts for insert to authenticated with check(fets_news_private.editor());
create policy news_posts_update_editor on public.fets_news_posts for update to authenticated using(fets_news_private.editor()) with check(fets_news_private.editor());
