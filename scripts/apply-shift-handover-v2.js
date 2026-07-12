import pg from 'pg';
import fs from 'fs';
const { Client } = pg;

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxZXd1c2V0aWx4eGZ2Zmttc2VkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTM2MjY1NSwiZXhwIjoyMDcwOTM4NjU1fQ.LJePJfsskt3HvoJvo9cWWDGaE0fOstb0tlmyYm5sWPo';
const connectionString = `postgresql://postgres:${SERVICE_KEY}@db.qqewusetilxxfvfkmsed.supabase.co:5432/postgres`;

const sql = fs.readFileSync('C:\\Users\\mithu\\Downloads\\redesign\\SHIFT_HANDOVER_V2.sql', 'utf8');

async function run() {
  console.log("Connecting directly to PostgreSQL via port 5432...");
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected successfully! Executing Shift Handover V2 SQL migration...");
    await client.query(sql);
    console.log("✅ Shift Handover V2 SQL migration executed successfully!");
  } catch (err) {
    console.error("❌ SQL execution failed:", err);
  } finally {
    await client.end();
  }
}
run();
