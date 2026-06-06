const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://qqewusetilxxfvfkmsed.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxZXd1c2V0aWx4eGZ2Zmttc2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzNjI2NTUsImV4cCI6MjA3MDkzODY1NX0.-x783XXpilPWC3O-cJqmdSTmhpAvObk_MSElfGdrU8s';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
  console.log("=== LEAVE REQUESTS ===");
  const { data: leaves, error: err1 } = await supabase.from("leave_requests").select("*").limit(2);
  console.log("Leaves Error:", err1);
  if (leaves && leaves.length > 0) {
    console.log("Columns:", Object.keys(leaves[0]));
    console.log("Sample Data:", leaves);
  } else {
    console.log("No data found in leave_requests");
  }

  console.log("\n=== ROSTER SCHEDULES ===");
  const { data: roster, error: err2 } = await supabase.from("roster_schedules").select("*").limit(2);
  console.log("Roster Error:", err2);
  if (roster && roster.length > 0) {
    console.log("Columns:", Object.keys(roster[0]));
    console.log("Sample Data:", roster);
  } else {
    console.log("No data found in roster_schedules");
  }

  console.log("\n=== STAFF PROFILES ===");
  const { data: profiles, error: err3 } = await supabase.from("staff_profiles").select("*").limit(2);
  console.log("Profiles Error:", err3);
  if (profiles && profiles.length > 0) {
    console.log("Columns:", Object.keys(profiles[0]));
    console.log("Sample Data:", profiles);
  } else {
    console.log("No data found in staff_profiles");
  }
}

inspect();
