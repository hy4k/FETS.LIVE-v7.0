import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qqewusetilxxfvfkmsed.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxZXd1c2V0aWx4eGZ2Zmttc2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzNjI2NTUsImV4cCI6MjA3MDkzODY1NX0.-x783XXpilPWC3O-cJqmdSTmhpAvObk_MSElfGdrU8s';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function diagnose() {
  // 1. Check conversations table
  console.log('\n--- conversations table ---');
  const { data: convs, error: convErr } = await supabase
    .from('conversations')
    .select('*')
    .limit(5);
  console.log('conversations:', JSON.stringify(convs, null, 2));
  if (convErr) console.error('conv error:', convErr);

  // 2. Check conversation_members table
  console.log('\n--- conversation_members table ---');
  const { data: members, error: membErr } = await supabase
    .from('conversation_members')
    .select('*')
    .limit(5);
  console.log('conversation_members:', JSON.stringify(members, null, 2));
  if (membErr) console.error('members error:', membErr);

  // 3. Check messages table  
  console.log('\n--- messages table ---');
  const { data: msgs, error: msgsErr } = await supabase
    .from('messages')
    .select('*')
    .limit(3);
  console.log('messages:', JSON.stringify(msgs, null, 2));
  if (msgsErr) console.error('messages error:', msgsErr);

  // 4. Test direct INSERT into conversations
  console.log('\n--- Test direct conversations INSERT ---');
  const { data: newConv, error: insertErr } = await supabase
    .from('conversations')
    .insert({ name: 'Test Chat', is_group: false })
    .select()
    .single();
  console.log('insert result:', JSON.stringify({ data: newConv, error: insertErr }, null, 2));

  // 5. Check if get_or_create_conversation exists with correct signature
  console.log('\n--- Test get_or_create_conversation with real staff IDs ---');
  const realId1 = '3e203318-bf19-494b-bcf5-b7e54e8a299b'; // Bindu
  const realId2 = '0b732c8e-1dd7-4a3f-9b01-539da05db844'; // Mithun
  const { data: rpcData, error: rpcErr } = await supabase.rpc('get_or_create_conversation', {
    user_id_1: realId1,
    user_id_2: realId2
  });
  console.log('get_or_create_conversation (real IDs):', JSON.stringify({ data: rpcData, error: rpcErr }, null, 2));
}

diagnose().catch(console.error);
