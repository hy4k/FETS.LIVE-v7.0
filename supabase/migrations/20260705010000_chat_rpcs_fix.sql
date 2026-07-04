-- =======================================================
-- FETS Chat RLS Fix + New RPCs
-- Apply this in: https://supabase.com/dashboard/project/qqewusetilxxfvfkmsed/sql/new
-- =======================================================

-- 1. Helper: get profile ID for current auth user
CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM public.staff_profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 2. Get messages for a conversation (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_conversation_messages(p_conversation_id UUID, p_limit INT DEFAULT 200)
RETURNS SETOF public.messages LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_profile_id UUID;
BEGIN
  SELECT id INTO v_profile_id FROM public.staff_profiles WHERE user_id = auth.uid() LIMIT 1;
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = p_conversation_id
      AND (user_id = auth.uid() OR user_id = v_profile_id)
  ) THEN RAISE EXCEPTION 'Access denied'; END IF;
  RETURN QUERY SELECT * FROM public.messages
    WHERE conversation_id = p_conversation_id ORDER BY created_at ASC LIMIT p_limit;
END;
$$;

-- 3. Send a message (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.send_chat_message(
  p_conversation_id UUID, p_sender_id UUID,
  p_content TEXT, p_type TEXT DEFAULT 'text', p_file_path TEXT DEFAULT NULL
)
RETURNS public.messages LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_profile_id UUID;
  v_result public.messages;
BEGIN
  SELECT id INTO v_profile_id FROM public.staff_profiles WHERE user_id = auth.uid() LIMIT 1;
  IF p_sender_id != auth.uid() AND p_sender_id != v_profile_id THEN
    RAISE EXCEPTION 'Sender mismatch'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = p_conversation_id
      AND (user_id = auth.uid() OR user_id = v_profile_id)
  ) THEN RAISE EXCEPTION 'Not a member'; END IF;
  INSERT INTO public.messages (conversation_id, sender_id, content, type, file_path)
  VALUES (p_conversation_id, p_sender_id, p_content, p_type, p_file_path)
  RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;

-- 4. Update a message (own messages only)
CREATE OR REPLACE FUNCTION public.update_chat_message(
  p_message_id UUID, p_content TEXT
)
RETURNS public.messages LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_profile_id UUID;
  v_result public.messages;
BEGIN
  SELECT id INTO v_profile_id FROM public.staff_profiles WHERE user_id = auth.uid() LIMIT 1;
  IF NOT EXISTS (
    SELECT 1 FROM public.messages
    WHERE id = p_message_id
      AND (sender_id = auth.uid() OR sender_id = v_profile_id)
  ) THEN RAISE EXCEPTION 'Access denied'; END IF;
  UPDATE public.messages SET content = p_content, is_edited = true
  WHERE id = p_message_id RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;

-- 5. Delete a message (own messages: mark deleted; admin: hard delete)
CREATE OR REPLACE FUNCTION public.delete_chat_message(
  p_message_id UUID, p_for_everyone BOOLEAN DEFAULT false
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  SELECT id INTO v_profile_id FROM public.staff_profiles WHERE user_id = auth.uid() LIMIT 1;
  IF NOT EXISTS (
    SELECT 1 FROM public.messages
    WHERE id = p_message_id
      AND (sender_id = auth.uid() OR sender_id = v_profile_id)
  ) THEN RAISE EXCEPTION 'Access denied'; END IF;
  IF p_for_everyone THEN
    UPDATE public.messages SET content = '🚫 Message deleted', status = 'deleted_for_all', is_deleted = true
    WHERE id = p_message_id;
  ELSE
    DELETE FROM public.messages WHERE id = p_message_id;
  END IF;
  RETURN true;
END;
$$;

-- 6. Get conversation info with members (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_conversation_info(p_conversation_id UUID)
RETURNS TABLE(
  id UUID, name TEXT, is_group BOOLEAN, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  member_ids UUID[], member_names TEXT[], member_avatars TEXT[]
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_profile_id UUID;
BEGIN
  SELECT sp.id INTO v_profile_id FROM public.staff_profiles sp WHERE sp.user_id = auth.uid() LIMIT 1;
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = p_conversation_id
      AND (user_id = auth.uid() OR user_id = v_profile_id)
  ) THEN RAISE EXCEPTION 'Access denied'; END IF;
  RETURN QUERY
    SELECT c.id, c.name, c.is_group, c.created_at, c.updated_at,
      ARRAY_AGG(sp.id) as member_ids,
      ARRAY_AGG(sp.full_name) as member_names,
      ARRAY_AGG(sp.avatar_url) as member_avatars
    FROM public.conversations c
    JOIN public.conversation_members cm ON cm.conversation_id = c.id
    JOIN public.staff_profiles sp ON sp.id = cm.user_id
    WHERE c.id = p_conversation_id
    GROUP BY c.id, c.name, c.is_group, c.created_at, c.updated_at;
END;
$$;

-- 7. Add member to group conversation
CREATE OR REPLACE FUNCTION public.add_conversation_member(
  p_conversation_id UUID, p_user_id UUID
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_profile_id UUID;
BEGIN
  SELECT id INTO v_profile_id FROM public.staff_profiles WHERE user_id = auth.uid() LIMIT 1;
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = p_conversation_id
      AND (user_id = auth.uid() OR user_id = v_profile_id)
  ) THEN RAISE EXCEPTION 'Access denied'; END IF;
  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (p_conversation_id, p_user_id)
  ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;

-- 8. Create group conversation
CREATE OR REPLACE FUNCTION public.create_group_conversation(
  p_name TEXT, p_member_ids UUID[]
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_profile_id UUID;
  v_conv_id UUID;
  v_member UUID;
BEGIN
  SELECT id INTO v_profile_id FROM public.staff_profiles WHERE user_id = auth.uid() LIMIT 1;
  INSERT INTO public.conversations (name, is_group, created_by)
  VALUES (p_name, true, COALESCE(v_profile_id, auth.uid()))
  RETURNING id INTO v_conv_id;
  -- Add all members
  FOREACH v_member IN ARRAY p_member_ids LOOP
    INSERT INTO public.conversation_members (conversation_id, user_id, is_admin)
    VALUES (v_conv_id, v_member, v_member = COALESCE(v_profile_id, auth.uid()))
    ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN v_conv_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_my_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversation_messages(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_chat_message(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_chat_message(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_chat_message(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversation_info(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_conversation_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_group_conversation(TEXT, UUID[]) TO authenticated;

-- Also fix the conversations SELECT RLS so logged-in members can read their convs
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conversations_select_policy" ON public.conversations;
CREATE POLICY "conversations_select_policy" ON public.conversations FOR SELECT TO authenticated
  USING (id IN (
    SELECT conversation_id FROM public.conversation_members
    WHERE user_id = auth.uid() OR user_id = public.get_my_profile_id()
  ));
DROP POLICY IF EXISTS "conversations_insert_policy" ON public.conversations;
CREATE POLICY "conversations_insert_policy" ON public.conversations FOR INSERT TO authenticated WITH CHECK (true);

-- Fix messages RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_select_policy" ON public.messages;
CREATE POLICY "messages_select_policy" ON public.messages FOR SELECT TO authenticated
  USING (conversation_id IN (
    SELECT conversation_id FROM public.conversation_members
    WHERE user_id = auth.uid() OR user_id = public.get_my_profile_id()
  ));
DROP POLICY IF EXISTS "messages_insert_policy" ON public.messages;
CREATE POLICY "messages_insert_policy" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    conversation_id IN (SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid() OR user_id = public.get_my_profile_id())
    AND (sender_id = auth.uid() OR sender_id = public.get_my_profile_id())
  );
DROP POLICY IF EXISTS "messages_update_policy" ON public.messages;
CREATE POLICY "messages_update_policy" ON public.messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid() OR sender_id = public.get_my_profile_id());
DROP POLICY IF EXISTS "messages_delete_policy" ON public.messages;
CREATE POLICY "messages_delete_policy" ON public.messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR sender_id = public.get_my_profile_id());
