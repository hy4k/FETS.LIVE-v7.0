-- Keep the preview trigger compatible with RPCs using an empty search_path.
create or replace function public.update_conversation_last_message()
returns trigger language plpgsql set search_path='' as $$
begin
 update public.conversations set last_message_at=new.created_at,last_message_preview=left(new.content,100),updated_at=now() where id=new.conversation_id;
 return new;
end $$;
