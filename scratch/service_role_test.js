import https from 'https';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxZXd1c2V0aWx4eGZ2Zmttc2VkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTM2MjY1NSwiZXhwIjoyMDcwOTM4NjU1fQ.LJePJfsskt3HvoJvo9cWWDGaE0fOstb0tlmyYm5sWPo';
const PROJECT = 'qqewusetilxxfvfkmsed';

function post(path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const req = https.request({
      hostname: `${PROJECT}.supabase.co`,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'Prefer': 'return=representation',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

// Create helper RPCs using the service role (SECURITY DEFINER bypasses RLS)
// We create them by using the /rest/v1/rpc endpoint with a DDL-executing function

// First, let's test if we can call existing RPCs with service role 
// to understand what works, then create new ones that bypass RLS

async function main() {
  // 1. Test get_or_create_conversation with service role
  console.log('1. Testing get_or_create_conversation with service role...');
  const r1 = await post('/rest/v1/rpc/get_or_create_conversation', {
    user_id_1: '3e203318-bf19-494b-bcf5-b7e54e8a299b', // Bindu
    user_id_2: '0b732c8e-1dd7-4a3f-9b01-539da05db844'  // Mithun  
  });
  console.log('Result:', r1.status, r1.body);
  const convId = r1.body;
  
  // 2. Test inserting a message with service role (bypasses RLS)
  console.log('\n2. Testing messages INSERT with service role...');
  const r2 = await post('/rest/v1/messages', {
    conversation_id: convId,
    sender_id: '3e203318-bf19-494b-bcf5-b7e54e8a299b',
    content: 'Test message from service role',
    type: 'text'
  });
  console.log('Result:', r2.status, JSON.stringify(r2.body).slice(0, 200));

  // 3. Test reading conversations with service role 
  console.log('\n3. Testing conversations SELECT with service role...');
  const convRes = await new Promise((resolve, reject) => {
    https.get({
      hostname: `${PROJECT}.supabase.co`,
      path: `/rest/v1/conversations?id=eq.${convId}`,
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY
      }
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    }).on('error', reject);
  });
  console.log('Result:', convRes.status, JSON.stringify(convRes.body).slice(0, 200));
  
  // 4. Test reading messages with service role
  console.log('\n4. Testing messages SELECT with service role...');
  const msgRes = await new Promise((resolve, reject) => {
    https.get({
      hostname: `${PROJECT}.supabase.co`,
      path: `/rest/v1/messages?conversation_id=eq.${convId}&order=created_at.asc`,
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY
      }
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    }).on('error', reject);
  });
  console.log('Result:', msgRes.status, JSON.stringify(msgRes.body).slice(0, 300));
}

main().catch(console.error);
