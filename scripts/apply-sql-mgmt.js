/**
 * Execute SQL via Supabase's internal pg_dump endpoint
 * This uses the service role JWT and the /rest/v1/sql endpoint
 */
import https from 'https';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_PROJECT = 'qqewusetilxxfvfkmsed';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxZXd1c2V0aWx4eGZ2Zmttc2VkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTM2MjY1NSwiZXhwIjoyMDcwOTM4NjU1fQ.LJePJfsskt3HvoJvo9cWWDGaE0fOstb0tlmyYm5sWPo';

function makeRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// Supabase has an undocumented SQL endpoint accessible with service role
async function execSQL(sql) {
  const body = JSON.stringify({ query: sql });
  const result = await makeRequest({
    hostname: `${SUPABASE_PROJECT}.supabase.co`,
    path: '/rest/v1/rpc/query',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'apikey': SERVICE_KEY,
      'Content-Length': Buffer.byteLength(body)
    }
  }, body);
  return result;
}

// Try Supabase Management API
async function execViaManagementAPI(sql) {
  const body = JSON.stringify({ query: sql });
  const result = await makeRequest({
    hostname: 'api.supabase.com',
    path: `/v1/projects/${SUPABASE_PROJECT}/database/query`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Length': Buffer.byteLength(body)
    }
  }, body);
  return result;
}

const sqlFile = join(__dirname, '../supabase/migrations/20260705000000_fix_chat_rls_and_rpc.sql');
const fullSQL = readFileSync(sqlFile, 'utf8');

console.log('Trying Supabase Management API...');
const r1 = await execViaManagementAPI(fullSQL);
console.log('Management API result:', r1.status, JSON.stringify(r1.body).slice(0, 300));

console.log('\nTrying direct REST...');
const r2 = await execSQL('SELECT 1 as test');
console.log('REST result:', r2.status, JSON.stringify(r2.body).slice(0, 300));
