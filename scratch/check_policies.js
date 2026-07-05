import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qqewusetilxxfvfkmsed.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxZXd1c2V0aWx4eGZ2Zmttc2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzNjI2NTUsImV4cCI6MjA3MDkzODY1NX0.-x783XXpilPWC3O-cJqmdSTmhpAvObk_MSElfGdrU8s';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Login with Mithun's credentials (who has user_id different from id)
// Mithun: id = '0b732c8e-1dd7-4a3f-9b01-539da05db844', user_id = '0bb8d8f5-cfdc-4289-9486-f5ec1b60b768'
async function testWithAuth() {
  console.log('\n=== Testing what policies currently exist ===');
  
  // Check existing policies via information schema
  const { data: policies } = await supabase
    .from('information_schema.table_privileges')
    .select('*')
    .limit(1);
  console.log('policies check:', policies);
  
  // Find the current conversations policies via a known safe method
  const { data: convPolicies, error: pErr } = await supabase
    .from('pg_policies')
    .select('policyname, cmd, qual')
    .in('tablename', ['conversations', 'conversation_members', 'messages']);
  console.log('pg_policies:', JSON.stringify({ data: convPolicies, error: pErr }, null, 2));
  
  // Test: can we read conversations with service role-like access?
  const knownConvId = 'ad6e62f7-e3b1-4091-8749-b29d3e352ca9'; // from get_or_create_conversation result
  
  console.log('\n=== Testing conversation_members access ===');
  const { data: members, error: mErr } = await supabase
    .from('conversation_members')
    .select('*')
    .eq('conversation_id', knownConvId);
  console.log('members for known conv:', JSON.stringify({ data: members, error: mErr }, null, 2));
}

testWithAuth().catch(console.error);
