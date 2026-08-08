/**
 * Applies every SQL file in /migrations to the Supabase project via the
 * Management API (pure HTTPS — no direct Postgres port needed).
 *
 * Env:
 *   SUPABASE_ACCESS_TOKEN  personal access token (sbp_...)
 *   SUPABASE_PROJECT_REF   project ref (defaults to qqewusetilxxfvfkmsed)
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'migrations');
const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF || 'qqewusetilxxfvfkmsed';

if (!token) { console.error('❌ SUPABASE_ACCESS_TOKEN not set'); process.exit(1); }

const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

async function runSql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

for (const file of files) {
  const sql = readFileSync(join(migrationsDir, file), 'utf8');
  process.stdout.write(`▶ ${file} … `);
  const r = await runSql(sql);
  console.log(r.ok ? '✅' : `❌ HTTP ${r.status}\n${r.text}`);
  if (!r.ok) process.exitCode = 1;
}
