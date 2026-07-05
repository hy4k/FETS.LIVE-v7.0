import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import https from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://qqewusetilxxfvfkmsed.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxZXd1c2V0aWx4eGZ2Zmttc2VkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTM2MjY1NSwiZXhwIjoyMDcwOTM4NjU1fQ.LJePJfsskt3HvoJvo9cWWDGaE0fOstb0tlmyYm5sWPo';

// Use service role client - bypasses ALL RLS
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false }
});

async function runSQL(sql, label) {
  console.log(`\n▶ ${label}...`);
  try {
    const { data, error } = await supabase.rpc('pg_execute_ddl', { ddl: sql });
    if (error) {
      // Try using the sql-executor edge function if available
      throw error;
    }
    console.log(`✅ ${label} done.`);
    return true;
  } catch (e) {
    console.log(`⚠ Direct RPC failed, trying alternative...`);
    return false;
  }
}

// Break the SQL into individual statements and use the Supabase admin API
const statements = [
  // 1. Helper function
  `CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM public.staff_profiles WHERE user_id = auth.uid() LIMIT 1;
$$`,

  // 2. Enable RLS
  `ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY`,

  // 3. Drop old conversation policies
  `DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations`,
  `DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations`,
  `DROP POLICY IF EXISTS "conversations_select_policy" ON public.conversations`,
  `DROP POLICY IF EXISTS "conversations_insert_policy" ON public.conversations`,
  `DROP POLICY IF EXISTS "conversations_update_policy" ON public.conversations`,

  // 4. New conversation policies
  `CREATE POLICY "conversations_select_policy" ON public.conversations FOR SELECT TO authenticated
   USING (id IN (SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid() OR user_id = public.get_my_profile_id()))`,
  `CREATE POLICY "conversations_insert_policy" ON public.conversations FOR INSERT TO authenticated WITH CHECK (true)`,
  `CREATE POLICY "conversations_update_policy" ON public.conversations FOR UPDATE TO authenticated
   USING (id IN (SELECT conversation_id FROM public.conversation_members WHERE (user_id = auth.uid() OR user_id = public.get_my_profile_id()) AND is_admin = true))`,

  // 5. Drop old conversation_members policies
  `DROP POLICY IF EXISTS "Users can view conversation members" ON public.conversation_members`,
  `DROP POLICY IF EXISTS "Users can join conversations" ON public.conversation_members`,
  `DROP POLICY IF EXISTS "conv_members_select_policy" ON public.conversation_members`,
  `DROP POLICY IF EXISTS "conv_members_insert_policy" ON public.conversation_members`,
  `DROP POLICY IF EXISTS "conv_members_delete_policy" ON public.conversation_members`,

  // 6. New conversation_members policies
  `CREATE POLICY "conv_members_select_policy" ON public.conversation_members FOR SELECT TO authenticated
   USING (conversation_id IN (SELECT conversation_id FROM public.conversation_members cm WHERE cm.user_id = auth.uid() OR cm.user_id = public.get_my_profile_id()))`,
  `CREATE POLICY "conv_members_insert_policy" ON public.conversation_members FOR INSERT TO authenticated WITH CHECK (true)`,

  // 7. Drop old messages policies  
  `DROP POLICY IF EXISTS "Users can view messages" ON public.messages`,
  `DROP POLICY IF EXISTS "Users can send messages" ON public.messages`,
  `DROP POLICY IF EXISTS "Users can edit own messages" ON public.messages`,
  `DROP POLICY IF EXISTS "messages_select_policy" ON public.messages`,
  `DROP POLICY IF EXISTS "messages_insert_policy" ON public.messages`,
  `DROP POLICY IF EXISTS "messages_update_policy" ON public.messages`,
  `DROP POLICY IF EXISTS "messages_delete_policy" ON public.messages`,

  // 8. New messages policies
  `CREATE POLICY "messages_select_policy" ON public.messages FOR SELECT TO authenticated
   USING (conversation_id IN (SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid() OR user_id = public.get_my_profile_id()))`,
  `CREATE POLICY "messages_insert_policy" ON public.messages FOR INSERT TO authenticated
   WITH CHECK (conversation_id IN (SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid() OR user_id = public.get_my_profile_id()) AND (sender_id = auth.uid() OR sender_id = public.get_my_profile_id()))`,
  `CREATE POLICY "messages_update_policy" ON public.messages FOR UPDATE TO authenticated
   USING (sender_id = auth.uid() OR sender_id = public.get_my_profile_id())`,
  `CREATE POLICY "messages_delete_policy" ON public.messages FOR DELETE TO authenticated
   USING (sender_id = auth.uid() OR sender_id = public.get_my_profile_id())`,

  // 9. Fix get_or_create_conversation RPC
  `CREATE OR REPLACE FUNCTION public.get_or_create_conversation(user_id_1 UUID, user_id_2 UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  conv_id UUID;
BEGIN
  SELECT cm1.conversation_id INTO conv_id
  FROM public.conversation_members cm1
  JOIN public.conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
  JOIN public.conversations c ON c.id = cm1.conversation_id
  WHERE cm1.user_id = user_id_1 AND cm2.user_id = user_id_2 AND c.is_group = false
  LIMIT 1;

  IF conv_id IS NULL THEN
    INSERT INTO public.conversations (is_group, created_by) VALUES (false, user_id_1) RETURNING id INTO conv_id;
    INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (conv_id, user_id_1), (conv_id, user_id_2);
  END IF;

  RETURN conv_id;
END;
$$`,
  `GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(UUID, UUID) TO authenticated`,
  `GRANT EXECUTE ON FUNCTION public.get_my_profile_id() TO authenticated`,
];

// Use the Supabase REST API with service key to execute admin DDL
async function executeSQLViaREST(sql) {
  return new Promise((resolve, reject) => {
    const url = new URL('/rest/v1/rpc/execute_admin_sql', SUPABASE_URL);
    // This won't work either - need raw pg access
    // Instead, let's use the pg_stat_activity trick via supabase
    resolve({ error: 'No REST SQL endpoint' });
  });
}

// The real approach: use the service role client to bypass RLS 
// and test if we can write to conversations/messages tables
async function testServiceAccess() {
  console.log('\n=== Testing service role access ===\n');
  
  // Try inserting with service role (bypasses RLS)
  const { data: testConv, error: testErr } = await supabase
    .from('conversations')
    .insert({ is_group: false })
    .select()
    .single();
  
  if (testErr) {
    console.log('Service role conversations insert:', testErr.message);
  } else {
    console.log('Service role created test conv:', testConv.id);
    // Clean up
    await supabase.from('conversations').delete().eq('id', testConv.id);
    console.log('(cleaned up test conv)');
  }
  
  // Check current policies via pg_policies
  const { data: policies } = await supabase
    .from('pg_policies')
    .select('policyname, tablename, cmd')
    .in('tablename', ['conversations', 'conversation_members', 'messages']);
  
  console.log('\nCurrent policies:', policies);
}

// Since direct SQL doesn't work, generate a SQL file to paste into Supabase SQL Editor
async function generateSQL() {
  const sqlFile = join(__dirname, '../supabase/migrations/20260705000000_fix_chat_rls_and_rpc.sql');
  const sql = readFileSync(sqlFile, 'utf8');
  
  console.log('\n=== PASTE THIS IN SUPABASE SQL EDITOR ===\n');
  console.log('URL: https://supabase.com/dashboard/project/qqewusetilxxfvfkmsed/sql/new\n');
  console.log(sql);
  console.log('\n=== END OF SQL ===');
}

testServiceAccess().then(generateSQL).catch(console.error);
