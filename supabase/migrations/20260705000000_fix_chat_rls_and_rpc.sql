-- Migration: Fix Chat RLS policies to work with staff_profiles.id (profile UUID)
-- The issue: conversation_members.user_id stores staff_profiles.id,
-- but auth.uid() returns the Supabase Auth UUID.
-- Some staff have profile.id != user_id (separate auth UUID).
-- Fix: RLS policies must check BOTH auth.uid() AND the profile id linked to auth.uid()

-- Helper function to get staff_profiles.id from auth.uid()
CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM public.staff_profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- ============================================================
-- CONVERSATIONS table RLS
-- ============================================================
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Drop old policies if any
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "conversations_select_policy" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert_policy" ON public.conversations;
DROP POLICY IF EXISTS "conversations_update_policy" ON public.conversations;

-- SELECT: user must be a member (check both auth.uid() and their profile id)
CREATE POLICY "conversations_select_policy"
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT conversation_id FROM public.conversation_members
      WHERE user_id = auth.uid()
         OR user_id = public.get_my_profile_id()
    )
  );

-- INSERT: any authenticated user can create a conversation
CREATE POLICY "conversations_insert_policy"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: only if you are an admin member
CREATE POLICY "conversations_update_policy"
  ON public.conversations
  FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT conversation_id FROM public.conversation_members
      WHERE (user_id = auth.uid() OR user_id = public.get_my_profile_id())
        AND is_admin = true
    )
  );

-- ============================================================
-- CONVERSATION_MEMBERS table RLS
-- ============================================================
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view conversation members" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can join conversations" ON public.conversation_members;
DROP POLICY IF EXISTS "conv_members_select_policy" ON public.conversation_members;
DROP POLICY IF EXISTS "conv_members_insert_policy" ON public.conversation_members;
DROP POLICY IF EXISTS "conv_members_delete_policy" ON public.conversation_members;

-- SELECT: see members of conversations you belong to
CREATE POLICY "conv_members_select_policy"
  ON public.conversation_members
  FOR SELECT
  TO authenticated
  USING (
    conversation_id IN (
      SELECT conversation_id FROM public.conversation_members cm
      WHERE cm.user_id = auth.uid()
         OR cm.user_id = public.get_my_profile_id()
    )
  );

-- INSERT: any authenticated user can add members (for group creation)
CREATE POLICY "conv_members_insert_policy"
  ON public.conversation_members
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- DELETE: admins can remove members
CREATE POLICY "conv_members_delete_policy"
  ON public.conversation_members
  FOR DELETE
  TO authenticated
  USING (
    conversation_id IN (
      SELECT conversation_id FROM public.conversation_members cm
      WHERE (cm.user_id = auth.uid() OR cm.user_id = public.get_my_profile_id())
        AND cm.is_admin = true
    )
  );

-- ============================================================
-- MESSAGES table RLS
-- ============================================================
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can edit own messages" ON public.messages;
DROP POLICY IF EXISTS "messages_select_policy" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_policy" ON public.messages;
DROP POLICY IF EXISTS "messages_update_policy" ON public.messages;
DROP POLICY IF EXISTS "messages_delete_policy" ON public.messages;

-- SELECT: members of the conversation can see messages
CREATE POLICY "messages_select_policy"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    conversation_id IN (
      SELECT conversation_id FROM public.conversation_members
      WHERE user_id = auth.uid()
         OR user_id = public.get_my_profile_id()
    )
  );

-- INSERT: members can send messages
CREATE POLICY "messages_insert_policy"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    conversation_id IN (
      SELECT conversation_id FROM public.conversation_members
      WHERE user_id = auth.uid()
         OR user_id = public.get_my_profile_id()
    )
    AND (
      sender_id = auth.uid()
      OR sender_id = public.get_my_profile_id()
    )
  );

-- UPDATE: own messages only
CREATE POLICY "messages_update_policy"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (
    sender_id = auth.uid()
    OR sender_id = public.get_my_profile_id()
  );

-- DELETE: own messages only
CREATE POLICY "messages_delete_policy"
  ON public.messages
  FOR DELETE
  TO authenticated
  USING (
    sender_id = auth.uid()
    OR sender_id = public.get_my_profile_id()
  );

-- ============================================================
-- Fix get_or_create_conversation RPC to use profile.id correctly
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
  user_id_1 UUID,
  user_id_2 UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  conv_id UUID;
BEGIN
  -- Find existing 1:1 conversation between these two users
  SELECT cm1.conversation_id INTO conv_id
  FROM public.conversation_members cm1
  JOIN public.conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
  JOIN public.conversations c ON c.id = cm1.conversation_id
  WHERE cm1.user_id = user_id_1
    AND cm2.user_id = user_id_2
    AND c.is_group = false
  LIMIT 1;

  -- If not found, create new conversation
  IF conv_id IS NULL THEN
    INSERT INTO public.conversations (is_group, created_by)
    VALUES (false, user_id_1)
    RETURNING id INTO conv_id;

    INSERT INTO public.conversation_members (conversation_id, user_id)
    VALUES
      (conv_id, user_id_1),
      (conv_id, user_id_2);
  END IF;

  RETURN conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile_id() TO authenticated;
