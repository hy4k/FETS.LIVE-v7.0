// Run with FETS_PGLITE_MODULE pointing to an installed @electric-sql/pglite entry.
// Uses a disposable PostgreSQL instance. Never connects to production.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.env.FETS_PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite({ parsers: { 1184: value => value } });
const uid = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const day = '2020-01-06';
let checks = 0;
async function check(label, fn) { await fn(); checks++; console.log(`PASS ${label}`); }
async function as(n, role = 'authenticated') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [n ? uid(n) : '']);
  await db.exec(`set role ${role}`);
}
async function rejected(sql, args, pattern) { await assert.rejects(db.query(sql, args), pattern); }
async function getTask(id) { return (await db.query('select * from centre_day_tasks where id=$1', [id])).rows[0]; }
const verify = t => db.query('select * from fets_verify_day_task($1,$2)', [t.id, t.done_at]);
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid$$;
    grant usage on schema auth to authenticated, anon, service_role;
    grant execute on function auth.uid() to authenticated, anon, service_role;
    create table public.staff_profiles(id uuid primary key, user_id uuid, full_name text, branch_assigned text, is_active boolean, role text, permissions jsonb default '{}');
    create table public.roster_schedules(profile_id uuid, date date, shift_code text, branch_location text);
    grant select on staff_profiles, roster_schedules to authenticated;
  `);
  for (let n = 1; n <= 5; n++) {
    await db.query('insert into auth.users values($1)', [uid(n)]);
    await db.query('insert into staff_profiles(id,user_id,full_name,branch_assigned,is_active,role) values($1,$1,$2,$3,true,$4)', [uid(n), `Staff ${n}`, n === 4 ? 'calicut' : 'cochin', n === 5 ? 'super_admin' : 'staff']);
    await db.query('insert into roster_schedules values($1,$2,$3,$4)', [uid(n), day, 'D', n === 4 ? 'calicut' : 'cochin']);
  }
  for (const file of ['20260929091547_centre_duty_planning.sql', '20260929100511_duty_coverage_and_activation.sql', '20261002090000_the_shift_blueprint.sql', '20261008090000_daily_duty_review.sql']) {
    await db.exec(await readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8'));
  }
  await as(5);
  await db.query('insert into centre_lead_weeks(branch,week_start,lead_id) values($1,$2,$3)', ['cochin', day, uid(1)]);
  await as(5);
  const resp = (await db.query("insert into centre_responsibilities(branch,area,title,owner_id) values('cochin','exam','Call candidates',$1) returning id", [uid(2)])).rows[0].id;
  await as(2);
  let t = (await db.query("insert into centre_day_tasks(branch,day,responsibility_id,title,assigned_to,status) values('cochin',$1,$2,'Call candidates',$3,'done') returning *", [day, resp, uid(2)])).rows[0];
  await check('owner completes own task without self-verifying', async () => {
    assert.equal(t.done_by, uid(2)); assert.equal(t.verified_by, null);
    await assert.rejects(verify(t), /Only the lead/);
  });
  await check('ordinary colleague cannot verify', async () => { await as(3); await assert.rejects(verify(t), /Only the person|Only the lead/); });
  await check('other centre cannot read or verify the task', async () => { await as(4); assert.equal(await getTask(t.id), undefined); await assert.rejects(verify(t), /changed/); });
  await check('lead verifies another person’s completion', async () => { await as(1); t = (await verify(t)).rows[0]; assert.equal(t.verified_by, uid(1)); assert.ok(t.verified_at); assert.equal(t.done_by, uid(2)); });
  await check('reopening clears review and completion evidence', async () => { await as(2); t = (await db.query("update centre_day_tasks set status='open' where id=$1 returning *", [t.id])).rows[0]; assert.equal(t.verified_at, null); assert.equal(t.done_at, null); });
  await check('pending work cannot be verified', async () => { await as(1); await assert.rejects(verify(t), /changed/); });
  await as(2); t = (await db.query("update centre_day_tasks set status='done' where id=$1 returning *", [t.id])).rows[0];
  await check('stale completion cannot be reviewed', async () => { await as(1); await assert.rejects(verify({ ...t, done_at: '2000-01-01T00:00:00Z' }), /changed/); });
  await check('reassignment clears completed and verified status', async () => { t = (await verify(t)).rows[0]; t = (await db.query('update centre_day_tasks set assigned_to=$2 where id=$1 returning *', [t.id, uid(3)])).rows[0]; assert.equal(t.status, 'open'); assert.equal(t.verified_by, null); assert.equal(t.done_at, null); });
  await check('lead cannot review their own work, admin can', async () => {
    const own = (await db.query("insert into centre_day_tasks(branch,day,title,assigned_to,status) values('cochin',$1,'Lead job',$2,'done') returning *", [day, uid(1)])).rows[0];
    await assert.rejects(verify(own), /Someone else/);
    await as(5); const reviewed = (await verify(own)).rows[0]; assert.equal(reviewed.verified_by, uid(5));
  });
  await check('reviewer cannot forge completion identity or timestamp', async () => {
    await as(3); t = (await db.query("update centre_day_tasks set status='done' where id=$1 returning *", [t.id])).rows[0];
    await as(1);
    t = (await db.query('update centre_day_tasks set done_by=$2,done_at=$3,verified_by=$4,verified_at=now() where id=$1 returning *', [t.id, uid(2), '2000-01-01T00:00:00Z', uid(1)])).rows[0];
    assert.equal(t.done_by, uid(3)); assert.notEqual(t.done_at, '2000-01-01T00:00:00Z');
  });
  await check('anonymous users cannot call verification', async () => { await as(null, 'anon'); await assert.rejects(verify(t), /permission denied/); });
  await as(1);
  const ids = [uid(1), uid(2), uid(3)];
  const plan = { actingLead: '', availability: ids.map(staff => ({ staff, start: 480, end: 1020, confirmed: true })), blocks: Array.from({length:6}, (_,i) => ({ start:480+i*90, end:570+i*90, owners:{front:ids[i%3],floor:ids[(i+1)%3],control:ids[(i+2)%3]},duties:{front:'',floor:'',control:''} })), breaks:ids.flatMap((staff,i)=>[600+i*30,840+i*30].map(start=>({staff,start,end:start+30,cover:ids[(i+1)%3],note:'Agreed cover'}))) };
  const pid = (await db.query("insert into centre_day_plans(branch,day,lead_id,plan,status) values('cochin',$1,$2,$3,'published') returning id", [day,uid(1),plan])).rows[0].id;
  await check('daily report preserves verification evidence', async () => {
    const report = (await db.query("insert into centre_duty_reports(plan_id,branch,day,summary,followups,recognition) values($1,'cochin',$2,'Completed work','None','') returning snapshot", [pid,day])).rows[0];
    const snap = report.snapshot.tasks.find(x => x.id === t.id); assert.equal(snap.verified_by,uid(1)); assert.ok(snap.verified_at);
  });
  await check('closed day rejects verification and reopening', async () => {
    await assert.rejects(verify(t), /closed/);
    await rejected("update centre_day_tasks set status='open' where id=$1", [t.id], /closed/);
    await rejected('delete from centre_day_tasks where id=$1', [t.id], /closed/);
  });
  await check('capability enables reviews for authenticated members', async () => { const caps=(await db.query('select fets_workspace_capabilities() as c')).rows[0].c; assert.equal(caps.dutyReview,true); });
  console.log(`${checks} database checks passed`);
} catch (e) { console.error(e.message); process.exitCode = 1; } finally { await db.close(); }
