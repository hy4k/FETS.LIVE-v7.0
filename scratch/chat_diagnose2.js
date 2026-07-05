import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qqewusetilxxfvfkmsed.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxZXd1c2V0aWx4eGZ2Zmttc2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzNjI2NTUsImV4cCI6MjA3MDkzODY1NX0.-x783XXpilPWC3O-cJqmdSTmhpAvObk_MSElfGdrU8s';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function diagnose() {
  // 1. Check auth session
  const { data: session } = await supabase.auth.getSession();
  console.log('\n--- auth session ---');
  console.log('session user:', session?.session?.user?.id || 'NOT AUTHENTICATED');
  
  // 2. Check RLS policies on conversations
  console.log('\n--- conversations RLS (via system catalog) ---');
  const { data: policies, error: policyErr } = await supabase.rpc('exec_sql', {
    sql: "SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'conversations'"
  });
  console.log('policies:', JSON.stringify({ data: policies, error: policyErr }, null, 2));

  // 3. Use the known working conv ID from members query
  const knownConvId = '8484f6ac-7f8d-412e-a788-f44af1cbb259';
  console.log('\n--- Try fetch conversation by known ID ---');
  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', knownConvId)
    .maybeSingle();
  console.log('conversation by ID:', JSON.stringify({ data: conv, error: convErr }, null, 2));

  // 4. Try fetching messages for that conversation
  console.log('\n--- Try fetch messages for known conv ---');
  const { data: msgs, error: msgsErr } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', knownConvId)
    .order('created_at', { ascending: true });
  console.log('messages:', JSON.stringify({ data: msgs, error: msgsErr }, null, 2));

  // 5. Insert test message
  console.log('\n--- Try insert message ---');
  const { data: newMsg, error: insertErr } = await supabase
    .from('messages')
    .insert({
      conversation_id: knownConvId,
      sender_id: '0b732c8e-1dd7-4a3f-9b01-539da05db844',
      content: 'Test message',
      type: 'text'
    })
    .select()
    .single();
  console.log('insert message:', JSON.stringify({ data: newMsg, error: insertErr }, null, 2));
}

diagnose().catch(console.error);
