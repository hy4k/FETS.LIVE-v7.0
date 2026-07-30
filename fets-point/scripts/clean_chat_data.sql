-- ====================================================================
-- FETS LIVE CHAT: DATABASE CLEANUP & RESET SCRIPT
-- ====================================================================
-- Executing this script will remove all historical/dummy chat messages,
-- read receipts, typing indicators, and conversations to provide a 
-- clean slate for real-time instant messaging.
-- ====================================================================

BEGIN;

-- 1. Delete message read receipts if table exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'message_read_receipts') THEN
        DELETE FROM public.message_read_receipts;
    END IF;
END $$;

-- 2. Delete typing indicators if table exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'typing_indicators') THEN
        DELETE FROM public.typing_indicators;
    END IF;
END $$;

-- 3. Delete all chat messages
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages') THEN
        DELETE FROM public.messages;
    END IF;
END $$;

-- 4. Delete conversation membership links
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conversation_members') THEN
        DELETE FROM public.conversation_members;
    END IF;
END $$;

-- 5. Delete all conversations
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conversations') THEN
        DELETE FROM public.conversations;
    END IF;
END $$;

COMMIT;

-- Verification output
SELECT 'Chat data cleared successfully. System ready for clean production messaging.' AS status;
