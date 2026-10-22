// Isolated PostgreSQL-compatible database only. Never creates production reports.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.FETS_PGLITE_MODULE || '@electric-sql/pglite');
const db=new PGlite();const uid=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
let passed=0;
async function check(name,fn){await fn();console.log('PASS',name);passed++}
async function role(name,id=1){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid(id)]);await db.exec(`set role ${name}`)}
const insert=()=>db.query("insert into roster_attendance_reports(recipient_profile_id,month,branch,title,summary,source_evidence,source_generated,source_count) values($1,'2026-10-01','calicut','Attendance review','Summary','Source evidence','2026-10-22 16:00 IST',2) returning *",[uid(2)]);
try {
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;create table public.staff_profiles(id uuid primary key,user_id uuid,full_name text,role text);grant select on staff_profiles to authenticated;`);
 for(let i=1;i<=4;i++){await db.query('insert into auth.users values($1,$2,now())',[uid(i),i===1?'mithun@fets.in':`staff${i}@example.test`]);await db.query('insert into staff_profiles values($1,$1,$2,$3)',[uid(i),`Staff ${i}`,i===1||i===4?'super_admin':'staff'])}
 await db.exec(await readFile(new URL('../../supabase/migrations/20261022105031_roster_private_attendance_reports.sql',import.meta.url),'utf8'));
 let id;
 await check('Mithun creates a private draft; server binds recipient and author',async()=>{await role('authenticated',1);const r=(await insert()).rows[0];id=r.id;assert.equal(r.recipient_user_id,uid(2));assert.equal(r.created_by,uid(1));assert.equal(r.version,1);assert.equal(r.status,'draft')});
 await check('Recipient cannot read draft, even by exact id',async()=>{await role('authenticated',2);assert.equal((await db.query('select * from roster_attendance_reports where id=$1',[id])).rows.length,0)});
 await check('Other staff cannot read drafts',async()=>{await role('authenticated',3);assert.equal((await db.query('select * from roster_attendance_reports')).rows.length,0)});
 await check('Staff cannot create reports',async()=>{await assert.rejects(insert())});
 await check('Forged profile super-admin role is insufficient',async()=>{await role('authenticated',4);await assert.rejects(insert());assert.equal((await db.query('select * from roster_attendance_reports')).rows.length,0)});
 await check('Mithun edits a draft with a version check',async()=>{await role('authenticated',1);const r=await db.query("update roster_attendance_reports set summary='Edited before sharing' where id=$1 and version=1 returning *",[id]);assert.equal(r.rows[0].version,2)});
 await check('Stale version cannot overwrite edits',async()=>{const r=await db.query("update roster_attendance_reports set summary='Stale' where id=$1 and version=1 returning *",[id]);assert.equal(r.rows.length,0)});
 await check('Recipient cannot be reassigned',async()=>{await assert.rejects(db.query('update roster_attendance_reports set recipient_user_id=$1 where id=$2',[uid(3),id]))});
 await check('Source evidence cannot be rewritten',async()=>{await assert.rejects(db.query("update roster_attendance_reports set source_evidence='Fake' where id=$1",[id]))});
 await check('Share transition sets a server timestamp',async()=>{const r=(await db.query("update roster_attendance_reports set status='shared' where id=$1 and version=2 returning *",[id])).rows[0];assert.ok(r.shared_at);assert.equal(r.version,3)});
 await check('Recipient sees the edited shared report',async()=>{await role('authenticated',2);const r=(await db.query('select * from roster_attendance_reports where id=$1',[id])).rows[0];assert.equal(r.summary,'Edited before sharing')});
 await check('Recipient cannot edit shared report',async()=>{assert.equal((await db.query("update roster_attendance_reports set summary='Changed' where id=$1 returning *",[id])).rows.length,0)});
 await check('Other staff cannot read shared report',async()=>{await role('authenticated',3);assert.equal((await db.query('select * from roster_attendance_reports where id=$1',[id])).rows.length,0)});
 await check('Mithun cannot silently edit a shared report',async()=>{await role('authenticated',1);assert.equal((await db.query("update roster_attendance_reports set summary='Changed' where id=$1 returning *",[id])).rows.length,0)});
 await check('Authenticated users cannot delete reports',async()=>{await assert.rejects(db.query('delete from roster_attendance_reports where id=$1',[id]))});
 await check('Anonymous access denied',async()=>{await role('anon',3);await assert.rejects(db.query('select * from roster_attendance_reports'))});
 await check('Direct insert of shared report rejected',async()=>{await role('authenticated',1);await assert.rejects(db.query("insert into roster_attendance_reports(recipient_profile_id,month,branch,title,summary,source_evidence,source_generated,source_count,status) values($1,'2026-10-01','calicut','Title','Summary','Evidence','Now',1,'shared')",[uid(2)]))});
 console.log(`${passed} private report database checks passed`);
}finally{await db.close()}
