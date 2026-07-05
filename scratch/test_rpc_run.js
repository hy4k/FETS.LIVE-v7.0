import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qqewusetilxxfvfkmsed.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxZXd1c2V0aWx4eGZ2Zmttc2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzNjI2NTUsImV4cCI6MjA3MDkzODY1NX0.-x783XXpilPWC3O-cJqmdSTmhpAvObk_MSElfGdrU8s';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testRPC() {
  console.log("Testing get_or_create_conversation...");
  const u1 = '3a649363-2396-419b-a010-cb64c5df0043'; // Just some UUIDs or valid format
  const u2 = '3a649363-2396-419b-a010-cb64c5df0044';
  
  try {
    const { data, error } = await supabase.rpc('get_or_create_conversation', {
      user_id_1: u1,
      user_id_2: u2
    });
    console.log("get_or_create_conversation result:", { data, error });
  } catch (e) {
    console.log("get_or_create_conversation exception:", e.message);
  }

  console.log("\nTesting get_direct_conversation...");
  try {
    const { data, error } = await supabase.rpc('get_direct_conversation', {
      user1_id: u1,
      user2_id: u2
    });
    console.log("get_direct_conversation result:", { data, error });
  } catch (e) {
    console.log("get_direct_conversation exception:", e.message);
  }
}

testRPC();
