import fs from 'fs';
import path from 'path';

const PROJECT_REF = 'qqewusetilxxfvfkmsed';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxZXd1c2V0aWx4eGZ2Zmttc2VkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTM2MjY1NSwiZXhwIjoyMDcwOTM4NjU1fQ.LJePJfsskt3HvoJvo9cWWDGaE0fOstb0tlmyYm5sWPo';

const sqlPath = path.resolve('scripts/add-handover-assignments.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

async function run() {
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--') && !s.startsWith('/*'));

  for (const statement of statements) {
    if (!statement) continue;
    console.log("Executing statement:", statement.substring(0, 80) + "...");
    try {
      const response = await fetch(`https://${PROJECT_REF}.supabase.co/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: statement })
      });
      
      if (!response.ok) {
        const text = await response.text();
        console.error('❌ Failed:', response.status, text);
      } else {
        console.log('✅ Success');
      }
    } catch (err) {
      console.error('❌ Error:', err.message);
    }
  }
}
run();
