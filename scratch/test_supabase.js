import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qqewusetilxxfvfkmsed.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxZXd1c2V0aWx4eGZ2Zmttc2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzNjI2NTUsImV4cCI6MjA3MDkzODY1NX0.-x783XXpilPWC3O-cJqmdSTmhpAvObk_MSElfGdrU8s';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log("Checking tables...");
  const tables = ['conversations', 'messages', 'roster_discussions', 'staff_profiles', 'conversations_users'];
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.log(`Table ${table} failed:`, error.message);
      } else {
        console.log(`Table ${table} exists! Sample count:`, data ? data.length : 0);
      }
    } catch (e) {
      console.log(`Table ${table} threw error:`, e.message);
    }
  }
}

main();
