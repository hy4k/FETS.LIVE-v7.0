/**
 * FETS AI — migration runner
 * Applies every SQL file in /migrations (in filename order) against the
 * Supabase Postgres database. Each file is idempotent, so re-running is safe.
 *
 * Usage:
 *   SUPABASE_DB_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" \
 *     node scripts/run-ai-migrations.mjs
 *
 * Get the connection string from:
 *   Supabase Dashboard → Project Settings → Database → Connection string (URI)
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'migrations');

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error('❌ Set SUPABASE_DB_URL to your Supabase Postgres connection string.');
  console.error('   Dashboard → Project Settings → Database → Connection string (URI)');
  process.exit(1);
}

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.error('❌ No .sql files found in', migrationsDir);
  process.exit(1);
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

console.log('🔧 FETS AI migration runner');
console.log('='.repeat(60));

try {
  await client.connect();
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    process.stdout.write(`▶ ${file} … `);
    await client.query(sql);
    console.log('✅');
  }
  console.log('='.repeat(60));
  console.log('✨ All migrations applied.');
} catch (err) {
  console.error('\n❌ Migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
