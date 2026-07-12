import pg from 'pg';
import fs from 'fs';
import path from 'path';
const { Client } = pg;

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxZXd1c2V0aWx4eGZ2Zmttc2VkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTM2MjY1NSwiZXhwIjoyMDcwOTM4NjU1fQ.LJePJfsskt3HvoJvo9cWWDGaE0fOstb0tlmyYm5sWPo';
const passwords = ['Suspended00@', SERVICE_KEY];
const host = 'aws-1-ap-south-1.pooler.supabase.com';
const port = 6543;
const username = 'postgres.qqewusetilxxfvfkmsed';

const assignmentsSql = fs.readFileSync(path.resolve('scripts/add-handover-assignments.sql'), 'utf8');
const notesSql = fs.readFileSync(path.resolve('scripts/add-handover-notes.sql'), 'utf8');

async function tryConnect(password) {
  const client = new Client({
    host,
    port,
    database: 'postgres',
    user: username,
    password,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    return client;
  } catch (err) {
    console.warn(`Connection failed with password [${password.substring(0, 5)}...]:`, err.message);
    await client.end().catch(() => {});
    return null;
  }
}

async function run() {
  let client = null;
  for (const pw of passwords) {
    client = await tryConnect(pw);
    if (client) {
      console.log("Connected successfully using password!");
      break;
    }
  }

  if (!client) {
    console.error("❌ Failed to connect to database. Please run the SQL files manually in Supabase SQL Editor.");
    process.exit(1);
  }

  try {
    console.log("Running assignments SQL migration...");
    await client.query(assignmentsSql);
    console.log("✅ Assignments table migration complete!");

    console.log("Running notes SQL migration...");
    await client.query(notesSql);
    console.log("✅ Notes table migration complete!");
  } catch (err) {
    console.error("❌ SQL execution failed:", err);
  } finally {
    await client.end();
  }
}
run();
