-- 9. Leave a conversation (removes membership; deletes conversation if last member)
CREATE OR REPLACE FUNCTION public.leave_conversation(p_conversation_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  SELECT id INTO v_profile_id FROM public.staff_profiles WHERE user_id = auth.uid() LIMIT 1;
  
  DELETE FROM public.conversation_members
  WHERE conversation_id = p_conversation_id
    AND (user_id = auth.uid() OR user_id = v_profile_id);
    
  -- If conversation now has 0 members, delete it and its messages
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_members WHERE conversation_id = p_conversation_id
  ) THEN
    DELETE FROM public.messages WHERE conversation_id = p_conversation_id;
    DELETE FROM public.conversations WHERE id = p_conversation_id;
  END IF;
  
  RETURN true;
END;
$$;

-- 10. Delete a conversation (removes messages, members, and conversation metadata)
CREATE OR REPLACE FUNCTION public.delete_conversation(p_conversation_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  SELECT id INTO v_profile_id FROM public.staff_profiles WHERE user_id = auth.uid() LIMIT 1;
  
  -- Verify the user was indeed a member of this conversation
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = p_conversation_id
      AND (user_id = auth.uid() OR user_id = v_profile_id)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  DELETE FROM public.messages WHERE conversation_id = p_conversation_id;
  DELETE FROM public.conversation_members WHERE conversation_id = p_conversation_id;
  DELETE FROM public.conversations WHERE id = p_conversation_id;
  
  RETURN true;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.leave_conversation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_conversation(UUID) TO authenticated;
