// Run with PGlite available: node scripts/verification/verify-personal-desk.mjs
// Executes the actual migration against isolated PostgreSQL; never touches live data.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const one = '00000000-0000-4000-8000-000000000001';
const two = '00000000-0000-4000-8000-000000000002';
let checks = 0;
async function denied(sql, code) {
  await assert.rejects(db.query(sql), error => error.code === code); checks++;
}
await db.exec(`create role anon; create role authenticated; create role service_role;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
 grant usage on schema auth to authenticated, anon;
 grant execute on function auth.uid() to authenticated, anon;
 insert into auth.users values ('${one}'), ('${two}');`);
await db.exec(readFileSync(new URL('../../supabase/migrations/20260929081548_personal_desk.sql', import.meta.url), 'utf8'));
await db.exec(`set role authenticated; set request.jwt.claim.sub = '${one}';`);
let result = await db.query("select * from public.desk_save_journal('2026-09-29', 'A personal note', 'steady', null)");
assert.equal(result.rows[0].version, 1); checks++;
await denied("select * from public.desk_save_journal('2026-09-29', 'Overwrite', '', null)", '40001');
result = await db.query("select * from public.desk_save_journal('2026-09-29', 'Edited', 'bright', 1)");
assert.equal(result.rows[0].version, 2); checks++;
await denied("select * from public.desk_save_journal('2026-09-29', 'Stale edit', '', 1)", '40001');
await denied("select * from public.desk_save_journal('2026-09-30', repeat('x', 2001), '', null)", '23514');
await denied("select * from public.desk_save_journal('2026-09-30', '', 'invalid', null)", '23514');
await db.query("select * from public.desk_save_preferences('sage', null)");
await denied("select * from public.desk_save_preferences('blue', 1)", '23514');
await db.query(`insert into public.desk_focus_sessions values ('${one}', '${one}', 25, now(), now())`);
await db.query(`insert into public.desk_focus_sessions values ('${one}', '${one}', 25, now(), now()) on conflict (user_id,id) do nothing`);
assert.equal((await db.query('select count(*)::int as n from public.desk_focus_sessions')).rows[0].n, 1); checks++;
await db.exec(`set request.jwt.claim.sub = '${two}';`);
for (const table of ['desk_journal_entries','desk_preferences','desk_focus_sessions']) {
  assert.equal((await db.query(`select * from public.${table}`)).rows.length, 0); checks++;
  assert.equal((await db.query(`delete from public.${table} returning *`)).rows.length, 0); checks++;
}
assert.equal((await db.query("update public.desk_journal_entries set note='Not mine' returning *")).rows.length, 0); checks++;
assert.equal((await db.query("update public.desk_preferences set cover='lilac' returning *")).rows.length, 0); checks++;
await denied(`insert into public.desk_journal_entries(user_id,entry_date) values ('${one}','2026-09-30')`, '42501');
await denied(`insert into public.desk_preferences(user_id) values ('${one}')`, '42501');
await denied(`insert into public.desk_focus_sessions(user_id,id,duration_minutes,completed_at) values ('${one}','${two}',25,now())`, '42501');
await db.query("select * from public.desk_save_journal('2026-09-29', 'Second person', 'steady', null)");
await denied(`update public.desk_journal_entries set user_id='${one}'`, '42501');
await db.query("select * from public.desk_save_preferences('lilac', null)");
await denied(`update public.desk_preferences set user_id='${one}'`, '42501');
await db.exec('reset role; set role anon;');
for (const table of ['desk_journal_entries','desk_preferences','desk_focus_sessions']) await denied(`select * from public.${table}`, '42501');
await denied("select * from public.desk_save_journal('2026-09-29','','',null)", '42501');
await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub = '${one}';`);
assert.equal((await db.query("select note from public.desk_journal_entries")).rows[0].note, 'Edited'); checks++;
await db.query('delete from public.desk_journal_entries');
assert.equal((await db.query('select * from public.desk_journal_entries')).rows.length, 0); checks++;
await db.close();
console.log(`Passed ${checks} PostgreSQL checks: ownership, role grants, constraints, conflicts, idempotency, deletion.`);
