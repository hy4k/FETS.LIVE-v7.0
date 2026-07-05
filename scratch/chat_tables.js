import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qqewusetilxxfvfkmsed.supabase.co';
// Use service role key to bypass RLS for testing
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxZXd1c2V0aWx4eGZ2Zmttc2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzNjI2NTUsImV4cCI6MjA3MDkzODY1NX0.-x783XXpilPWC3O-cJqmdSTmhpAvObk_MSElfGdrU8s';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkAll() {
  // Check what tables exist related to chat
  for (const tbl of ['conversations', 'conversation_members', 'messages', 'chat_messages', 'discussion_messages']) {
    const { data, error } = await supabase.from(tbl).select('*').limit(1);
    if (!error) {
      console.log(`✅ Table '${tbl}' exists. Sample:`, JSON.stringify(data));
    } else {
      console.log(`❌ Table '${tbl}': ${error.message}`);
    }
  }
  
  // Check how many conversations exist from the members table perspective
  const { data: distinctConvs } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .limit(100);
  
  const convIds = [...new Set((distinctConvs||[]).map(m => m.conversation_id))];
  console.log('\nAll conversation IDs from members:', convIds);

  // Try fetching each
  for (const id of convIds.slice(0, 3)) {
    const { data: conv } = await supabase.from('conversations').select('*').eq('id', id).single();
    console.log(`Conv ${id}:`, conv ? 'accessible' : 'NOT accessible (RLS blocks)');
    
    const { data: msgs } = await supabase.from('messages').select('id, content, type').eq('conversation_id', id).limit(3);
    console.log(`  Messages:`, msgs);
  }
}

checkAll().catch(console.error);
