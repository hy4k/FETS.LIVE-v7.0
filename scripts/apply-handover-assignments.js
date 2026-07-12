import pg from 'pg';
import fs from 'fs';
import path from 'path';
const { Client } = pg;

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxZXd1c2V0aWx4eGZ2Zmttc2VkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTM2MjY1NSwiZXhwIjoyMDcwOTM4NjU1fQ.LJePJfsskt3HvoJvo9cWWDGaE0fOstb0tlmyYm5sWPo';
const connectionString = `postgresql://postgres.qqewusetilxxfvfkmsed:${SERVICE_KEY}@aws-1-ap-south-1.pooler.supabase.com:6543/postgres`;

const sqlPath = path.resolve('scripts/add-handover-assignments.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

async function run() {
  console.log("Connecting directly to PostgreSQL via connection pooler...");
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected successfully! Executing handover_assignments migration...");
    await client.query(sql);
    console.log("✅ Handover assignments table created successfully!");
  } catch (err) {
    console.error("❌ SQL execution failed:", err);
  } finally {
    await client.end();
  }
}
run();
