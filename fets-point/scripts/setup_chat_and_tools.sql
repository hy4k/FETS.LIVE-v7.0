-- ====================================================================
-- FETS LIVE: COMPLETE CHAT SYSTEM + GEMINI TOOLS MIGRATION
-- ====================================================================
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- This script is IDEMPOTENT — safe to run multiple times.
-- ====================================================================

-- ============================================================
-- PART 1: CHAT TABLES
-- ============================================================

-- 1A. Conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  is_group BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  last_message_preview TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1B. Conversation members (junction table)
CREATE TABLE IF NOT EXISTS public.conversation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin BOOLEAN DEFAULT FALSE,
  last_read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- 1C. Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'voice', 'file', 'image', 'video', 'call_log')),
  file_path TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'seen', 'deleted_for_all')),
  is_edited BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1D. Message read receipts
CREATE TABLE IF NOT EXISTS public.message_read_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- 1E. Typing indicators (ephemeral)
CREATE TABLE IF NOT EXISTS public.typing_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- ============================================================
-- PART 2: INDEXES FOR CHAT PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_members_user_id ON public.conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation_id ON public.conversation_members(conversation_id);
CREATE INDEX IF NOT EXISTS idx_message_read_receipts_message_id ON public.message_read_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON public.conversations(last_message_at DESC);

-- ============================================================
-- PART 3: ROW-LEVEL SECURITY POLICIES FOR CHAT
-- ============================================================

-- Enable RLS on all chat tables
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent re-run safety)
DO $$ BEGIN
  -- conversations
  DROP POLICY IF EXISTS "Users can view conversations they are members of" ON public.conversations;
  DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
  DROP POLICY IF EXISTS "Users can update conversations they belong to" ON public.conversations;
  -- conversation_members
  DROP POLICY IF EXISTS "Users can view members of their conversations" ON public.conversation_members;
  DROP POLICY IF EXISTS "Users can add members to conversations" ON public.conversation_members;
  DROP POLICY IF EXISTS "Users can update their own membership" ON public.conversation_members;
  -- messages
  DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
  DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;
  DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
  DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;
  -- message_read_receipts
  DROP POLICY IF EXISTS "Users can view read receipts in their conversations" ON public.message_read_receipts;
  DROP POLICY IF EXISTS "Users can create their own read receipts" ON public.message_read_receipts;
  -- typing_indicators
  DROP POLICY IF EXISTS "Users can view typing indicators in their conversations" ON public.typing_indicators;
  DROP POLICY IF EXISTS "Users can manage their own typing indicators" ON public.typing_indicators;
  DROP POLICY IF EXISTS "Users can delete their own typing indicators" ON public.typing_indicators;
END $$;

-- CONVERSATIONS POLICIES
CREATE POLICY "Users can view conversations they are members of"
  ON public.conversations FOR SELECT
  USING (
    id IN (
      SELECT conversation_id FROM public.conversation_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update conversations they belong to"
  ON public.conversations FOR UPDATE
  USING (
    id IN (
      SELECT conversation_id FROM public.conversation_members
      WHERE user_id = auth.uid()
    )
  );

-- CONVERSATION MEMBERS POLICIES
CREATE POLICY "Users can view members of their conversations"
  ON public.conversation_members FOR SELECT
  USING (
    conversation_id IN (
      SELECT conversation_id FROM public.conversation_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add members to conversations"
  ON public.conversation_members FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own membership"
  ON public.conversation_members FOR UPDATE
  USING (user_id = auth.uid());

-- MESSAGES POLICIES
CREATE POLICY "Users can view messages in their conversations"
  ON public.messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT conversation_id FROM public.conversation_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages to their conversations"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (
      SELECT conversation_id FROM public.conversation_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own messages"
  ON public.messages FOR UPDATE
  USING (sender_id = auth.uid());

CREATE POLICY "Users can delete their own messages"
  ON public.messages FOR DELETE
  USING (sender_id = auth.uid());

-- MESSAGE READ RECEIPTS POLICIES
CREATE POLICY "Users can view read receipts in their conversations"
  ON public.message_read_receipts FOR SELECT
  USING (
    message_id IN (
      SELECT m.id FROM public.messages m
      JOIN public.conversation_members cm ON cm.conversation_id = m.conversation_id
      WHERE cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own read receipts"
  ON public.message_read_receipts FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- TYPING INDICATORS POLICIES
CREATE POLICY "Users can view typing indicators in their conversations"
  ON public.typing_indicators FOR SELECT
  USING (
    conversation_id IN (
      SELECT conversation_id FROM public.conversation_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own typing indicators"
  ON public.typing_indicators FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own typing indicators"
  ON public.typing_indicators FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- PART 4: RPC FUNCTIONS (used by useChat.ts)
-- ============================================================

-- 4A. Send Chat Message (atomic insert + conversation update)
DROP FUNCTION IF EXISTS public.send_chat_message(UUID, UUID, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.send_chat_message(
  p_conversation_id UUID,
  p_sender_id UUID,
  p_content TEXT,
  p_type TEXT DEFAULT 'text',
  p_file_path TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message_id UUID;
  v_preview TEXT;
BEGIN
  -- Verify sender is member of conversation
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = p_conversation_id AND user_id = p_sender_id
  ) THEN
    RAISE EXCEPTION 'User is not a member of this conversation';
  END IF;

  -- Insert message
  INSERT INTO public.messages (conversation_id, sender_id, content, type, file_path, status)
  VALUES (p_conversation_id, p_sender_id, p_content, p_type, p_file_path, 'sent')
  RETURNING id INTO v_message_id;

  -- Update conversation preview
  IF p_type = 'text' THEN
    v_preview := LEFT(p_content, 100);
  ELSE
    v_preview := '[' || UPPER(p_type) || '] Attachment';
  END IF;

  UPDATE public.conversations
  SET last_message_at = now(), last_message_preview = v_preview, updated_at = now()
  WHERE id = p_conversation_id;

  RETURN v_message_id;
END;
$$;

-- 4B. Update Chat Message
DROP FUNCTION IF EXISTS public.update_chat_message(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.update_chat_message(
  p_message_id UUID,
  p_content TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.messages
  SET content = p_content, is_edited = TRUE, updated_at = now()
  WHERE id = p_message_id AND sender_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found or not owned by user';
  END IF;
END;
$$;

-- 4C. Delete Chat Message
DROP FUNCTION IF EXISTS public.delete_chat_message(UUID, BOOLEAN);
CREATE OR REPLACE FUNCTION public.delete_chat_message(
  p_message_id UUID,
  p_for_everyone BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_for_everyone THEN
    UPDATE public.messages
    SET is_deleted = TRUE, status = 'deleted_for_all', content = 'This message was deleted', updated_at = now()
    WHERE id = p_message_id AND sender_id = auth.uid();
  ELSE
    DELETE FROM public.messages
    WHERE id = p_message_id AND sender_id = auth.uid();
  END IF;
END;
$$;

-- 4D. Get or Create DM Conversation
DROP FUNCTION IF EXISTS public.get_or_create_conversation(UUID, UUID);
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
  user_id_1 UUID,
  user_id_2 UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  -- Find existing non-group conversation between these two users
  SELECT cm1.conversation_id INTO v_conversation_id
  FROM public.conversation_members cm1
  JOIN public.conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
  JOIN public.conversations c ON c.id = cm1.conversation_id
  WHERE cm1.user_id = user_id_1
    AND cm2.user_id = user_id_2
    AND c.is_group = FALSE
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;

  -- Create new DM conversation
  INSERT INTO public.conversations (is_group, created_by)
  VALUES (FALSE, user_id_1)
  RETURNING id INTO v_conversation_id;

  -- Add both members
  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES
    (v_conversation_id, user_id_1),
    (v_conversation_id, user_id_2);

  RETURN v_conversation_id;
END;
$$;

-- 4E. Create Group Conversation
DROP FUNCTION IF EXISTS public.create_group_conversation(TEXT, UUID[]);
CREATE OR REPLACE FUNCTION public.create_group_conversation(
  p_name TEXT,
  p_member_ids UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conversation_id UUID;
  v_member_id UUID;
BEGIN
  -- Create group conversation
  INSERT INTO public.conversations (name, is_group, created_by)
  VALUES (p_name, TRUE, auth.uid())
  RETURNING id INTO v_conversation_id;

  -- Add all members
  FOREACH v_member_id IN ARRAY p_member_ids LOOP
    INSERT INTO public.conversation_members (conversation_id, user_id, is_admin)
    VALUES (v_conversation_id, v_member_id, v_member_id = auth.uid())
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END LOOP;

  RETURN v_conversation_id;
END;
$$;

-- ============================================================
-- PART 5: GEMINI TOOLS — OPERATIONAL TABLES
-- (Only creates tables that don't already exist)
-- ============================================================

-- 5A. Candidates table (for query_candidates tool)
CREATE TABLE IF NOT EXISTS public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  exam_name TEXT,
  exam_date DATE,
  branch TEXT,
  status TEXT DEFAULT 'scheduled',
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  id_verified BOOLEAN DEFAULT FALSE,
  notes TEXT,
  session_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidates_exam_date ON public.candidates(exam_date DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_full_name ON public.candidates(full_name);

-- 5B. Duty daily log (for query_duty_log tool)
CREATE TABLE IF NOT EXISTS public.duty_daily_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  branch TEXT,
  shift TEXT,
  officer_id UUID REFERENCES auth.users(id),
  officer_name TEXT,
  summary TEXT,
  checklist_completed BOOLEAN DEFAULT FALSE,
  lab_status TEXT,
  issues TEXT,
  handover_to TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_duty_daily_log_date ON public.duty_daily_log(date DESC);

-- 5C. Handover notes (for query_handover_notes tool)
CREATE TABLE IF NOT EXISTS public.handover_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  branch TEXT,
  from_staff TEXT,
  to_staff TEXT,
  from_shift TEXT,
  to_shift TEXT,
  notes TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',
  acknowledged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_handover_notes_date ON public.handover_notes(date DESC);

-- ============================================================
-- PART 6: RLS POLICIES FOR OPERATIONAL TABLES
-- ============================================================

-- Enable RLS
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duty_daily_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handover_notes ENABLE ROW LEVEL SECURITY;

-- Drop existing (idempotent)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can read candidates" ON public.candidates;
  DROP POLICY IF EXISTS "Authenticated users can insert candidates" ON public.candidates;
  DROP POLICY IF EXISTS "Authenticated users can update candidates" ON public.candidates;
  DROP POLICY IF EXISTS "Authenticated users can read duty_daily_log" ON public.duty_daily_log;
  DROP POLICY IF EXISTS "Authenticated users can insert duty_daily_log" ON public.duty_daily_log;
  DROP POLICY IF EXISTS "Authenticated users can read handover_notes" ON public.handover_notes;
  DROP POLICY IF EXISTS "Authenticated users can insert handover_notes" ON public.handover_notes;
END $$;

-- All authenticated staff can read operational data
CREATE POLICY "Authenticated users can read candidates"
  ON public.candidates FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert candidates"
  ON public.candidates FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update candidates"
  ON public.candidates FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read duty_daily_log"
  ON public.duty_daily_log FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert duty_daily_log"
  ON public.duty_daily_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read handover_notes"
  ON public.handover_notes FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert handover_notes"
  ON public.handover_notes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- PART 7: ENSURE EXISTING TABLES HAVE PROPER RLS
-- (These tables should already exist from live-data.ts usage)
-- ============================================================

-- calendar_sessions — read access for all authenticated users
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'calendar_sessions') THEN
    ALTER TABLE public.calendar_sessions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Authenticated users can read calendar_sessions" ON public.calendar_sessions;
    CREATE POLICY "Authenticated users can read calendar_sessions"
      ON public.calendar_sessions FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- roster_schedules
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'roster_schedules') THEN
    ALTER TABLE public.roster_schedules ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Authenticated users can read roster_schedules" ON public.roster_schedules;
    CREATE POLICY "Authenticated users can read roster_schedules"
      ON public.roster_schedules FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- incidents
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'incidents') THEN
    ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Authenticated users can read incidents" ON public.incidents;
    CREATE POLICY "Authenticated users can read incidents"
      ON public.incidents FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- staff_attendance
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staff_attendance') THEN
    ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Authenticated users can read staff_attendance" ON public.staff_attendance;
    CREATE POLICY "Authenticated users can read staff_attendance"
      ON public.staff_attendance FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- leave_requests
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'leave_requests') THEN
    ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Authenticated users can read leave_requests" ON public.leave_requests;
    CREATE POLICY "Authenticated users can read leave_requests"
      ON public.leave_requests FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- staff_profiles — already has policies typically, but ensure read access
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staff_profiles') THEN
    ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Authenticated users can read staff_profiles" ON public.staff_profiles;
    CREATE POLICY "Authenticated users can read staff_profiles"
      ON public.staff_profiles FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- ============================================================
-- PART 8: ENABLE SUPABASE REALTIME
-- ============================================================

-- Enable realtime for chat tables (required for postgres_changes subscriptions)
DO $$ BEGIN
  -- Check if supabase_realtime publication exists
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Add tables to realtime publication (ignore errors if already added)
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.message_read_receipts; EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
END $$;

-- ============================================================
-- PART 9: STORAGE BUCKET FOR CHAT UPLOADS
-- ============================================================

-- Create chat-uploads bucket (Supabase storage)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-uploads',
  'chat-uploads',
  TRUE,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm',
        'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg',
        'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can upload chat files" ON storage.objects;
  DROP POLICY IF EXISTS "Anyone can view chat uploads" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Authenticated users can upload chat files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chat-uploads' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view chat uploads"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-uploads');

-- ============================================================
-- DONE
-- ============================================================

SELECT 'FETS Chat + Gemini Tools migration complete. All tables, policies, RPCs, and realtime enabled.' AS status;
