import pg from 'pg';
const { Client } = pg;

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxZXd1c2V0aWx4eGZ2Zmttc2VkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTM2MjY1NSwiZXhwIjoyMDcwOTM4NjU1fQ.LJePJfsskt3HvoJvo9cWWDGaE0fOstb0tlmyYm5sWPo';

const ddl = `
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
`;

async function run() {
  console.log("Connecting to PostgreSQL...");
  const client = new Client({
    connectionString: `postgresql://postgres.qqewusetilxxfvfkmsed:${SERVICE_KEY}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected successfully! Executing Leave/Delete Chat RPC migrations...");
    await client.query(ddl);
    console.log("✅ Leave and Delete conversation RPCs successfully created in Supabase database!");
  } catch (err) {
    console.error("❌ SQL execution failed:", err);
  } finally {
    await client.end();
  }
}
run();
