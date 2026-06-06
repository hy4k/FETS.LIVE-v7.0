const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://qqewusetilxxfvfkmsed.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxZXd1c2V0aWx4eGZ2Zmttc2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzNjI2NTUsImV4cCI6MjA3MDkzODY1NX0.-x783XXpilPWC3O-cJqmdSTmhpAvObk_MSElfGdrU8s';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInsert() {
  console.log("Attempting insert without leave_type...");
  const { data: profiles } = await supabase.from("staff_profiles").select("id").limit(1);
  if (!profiles || !profiles.length) {
    console.error("No staff profiles found.");
    return;
  }
  const profileId = profiles[0].id;
  console.log("Using profile ID:", profileId);

  const row = {
    user_id: profileId,
    request_type: 'leave',
    requested_date: '2026-06-20',
    reason: 'Testing from scratch script without leave_type',
    status: 'pending'
  };

  const { data, error } = await supabase.from("leave_requests").insert([row]).select();
  if (error) {
    console.error("Insert failed with error:", error);
  } else {
    console.log("Insert succeeded!", data);
    // Cleanup
    await supabase.from("leave_requests").delete().eq("id", data[0].id);
    console.log("Cleanup complete.");
  }
}

testInsert();
