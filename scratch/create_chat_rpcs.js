import https from 'https';

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxZXd1c2V0aWx4eGZ2Zmttc2VkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTM2MjY1NSwiZXhwIjoyMDcwOTM4NjU1fQ.LJePJfsskt3HvoJvo9cWWDGaE0fOstb0tlmyYm5sWPo';
const PROJECT = 'qqewusetilxxfvfkmsed';

function apiPost(path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const req = https.request({
      hostname: `${PROJECT}.supabase.co`,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'Prefer': 'return=representation',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

// We'll create DDL-executing SECURITY DEFINER functions via the existing RPC endpoint
// Using a trick: create a temporary function that executes DDL, use it, then drop it

const createFunctionsSQL = `
-- Function: get_conversation_messages - get messages for a conversation (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_conversation_messages(p_conversation_id UUID, p_limit INT DEFAULT 100)
RETURNS SETOF public.messages
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  -- Get caller's profile id
  SELECT id INTO v_profile_id FROM public.staff_profiles WHERE user_id = auth.uid() LIMIT 1;
  
  -- Verify caller is a member
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_members 
    WHERE conversation_id = p_conversation_id 
      AND (user_id = auth.uid() OR user_id = v_profile_id)
  ) THEN
    RAISE EXCEPTION 'Access denied: not a member of this conversation';
  END IF;
  
  RETURN QUERY
    SELECT * FROM public.messages
    WHERE conversation_id = p_conversation_id
    ORDER BY created_at ASC
    LIMIT p_limit;
END;
$$;

-- Function: send_chat_message - insert a message (bypasses RLS)
CREATE OR REPLACE FUNCTION public.send_chat_message(
  p_conversation_id UUID,
  p_sender_id UUID,
  p_content TEXT,
  p_type TEXT DEFAULT 'text',
  p_file_path TEXT DEFAULT NULL
)
RETURNS public.messages
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
  v_result public.messages;
BEGIN
  -- Get caller's profile id
  SELECT id INTO v_profile_id FROM public.staff_profiles WHERE user_id = auth.uid() LIMIT 1;
  
  -- Verify sender_id matches caller
  IF p_sender_id != auth.uid() AND p_sender_id != v_profile_id THEN
    RAISE EXCEPTION 'Access denied: sender_id must match authenticated user';
  END IF;
  
  -- Verify caller is a member
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_members 
    WHERE conversation_id = p_conversation_id 
      AND (user_id = auth.uid() OR user_id = v_profile_id)
  ) THEN
    RAISE EXCEPTION 'Access denied: not a member of this conversation';
  END IF;
  
  INSERT INTO public.messages (conversation_id, sender_id, content, type, file_path)
  VALUES (p_conversation_id, p_sender_id, p_content, p_type, p_file_path)
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Function: get_my_conversations - list all conversations for the current user
CREATE OR REPLACE FUNCTION public.get_my_conversations()
RETURNS TABLE(
  id UUID,
  name TEXT,
  is_group BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  member_ids UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  SELECT sp.id INTO v_profile_id FROM public.staff_profiles sp WHERE sp.user_id = auth.uid() LIMIT 1;
  
  RETURN QUERY
    SELECT 
      c.id, c.name, c.is_group, c.created_at, c.updated_at,
      ARRAY_AGG(cm2.user_id) as member_ids
    FROM public.conversations c
    JOIN public.conversation_members cm ON cm.conversation_id = c.id
    JOIN public.conversation_members cm2 ON cm2.conversation_id = c.id
    WHERE cm.user_id = auth.uid() OR cm.user_id = v_profile_id
    GROUP BY c.id, c.name, c.is_group, c.created_at, c.updated_at
    ORDER BY c.updated_at DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_conversation_messages(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_chat_message(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_conversations() TO authenticated;
`;

// Try calling an existing SECURITY DEFINER function to execute our DDL
// by passing it as a parameter - this won't work directly
// Instead, we use the service role to call a create function endpoint

// The correct approach: use the Supabase REST API with service role
// to insert into a special table that has a trigger, or just accept
// that we need to create an API approach

// Alternative: since we have service role, we can use it to run raw queries
// via the pg REST interface if available
console.log('Testing if postgres SQL endpoint exists...');

// Try the undocumented /pg endpoint
async function tryPGEndpoint() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ sql: 'SELECT 1 as test' });
    const req = https.request({
      hostname: `${PROJECT}.supabase.co`,
      path: '/pg/query',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: data.slice(0, 200) }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const pgResult = await tryPGEndpoint();
console.log('/pg/query result:', pgResult.status, pgResult.body);

// Since we can't apply DDL remotely without pg access, 
// let's output the SQL needed for the Supabase Dashboard
console.log('\n\n=== PLEASE APPLY THIS SQL IN SUPABASE DASHBOARD ===');
console.log('URL: https://supabase.com/dashboard/project/qqewusetilxxfvfkmsed/sql/new');
console.log('\n' + createFunctionsSQL);
console.log('=== END SQL ===\n');
