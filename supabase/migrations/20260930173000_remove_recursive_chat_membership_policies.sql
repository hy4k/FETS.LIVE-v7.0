-- Remove legacy self-referencing membership policies. The existing chat_* policies use the non-recursive security-definer membership helper.
begin;
drop policy if exists "Users can view members of their conversations" on public.conversation_members;
drop policy if exists "Users can add members to conversations" on public.conversation_members;
drop policy if exists "Users can update their own membership" on public.conversation_members;
notify pgrst,'reload schema';
commit;
