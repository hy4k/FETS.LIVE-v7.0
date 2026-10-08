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
  const resp = (await db.query("insert into centre_responsibilities(branch,area,title,details,owner_id) values('cochin','exam','Prepare lab','All stations ready',$1) returning id", [uid(2)])).rows[0].id;
  await as(2);
  const legacy = (await db.query("insert into centre_day_tasks(branch,day,responsibility_id,title,assigned_to,status) values('cochin',$1,$2,'Prepare lab',$3,'done') returning *",[day,resp,uid(2)])).rows[0];
  await as(null, 'postgres');
  await db.exec(await readFile(new URL('../../supabase/migrations/20261008140311_shift_outcomes_and_development.sql',import.meta.url),'utf8'));
  const action = async(t, op, note='', category='') => (await db.query('select * from fets_shift_task_action($1,$2,$3,$4,$5)',[t.id,t.version,op,note,category])).rows[0];
  await check('migration preserves prior completion identity and timestamp', async()=> { await as(2); const saved=await getTask(legacy.id); for(const key of Object.keys(legacy)) assert.deepEqual(saved[key],legacy[key]); });
  await as(5);
  await db.query('update centre_responsibilities set expected_result=$2,due_minute=600 where id=$1',[resp,'Every station passes a readiness check']);
  const task = async(title='One-off work',person=2) => (await db.query("insert into centre_day_tasks(branch,day,title,assigned_to,expected_result,due_minute) values('cochin',$1,$2,$3,'A checked result',600) returning *",[day,title,uid(person)])).rows[0];
  let t=await task();
  await check('owner starts with server time and incremented version',async()=> {await as(2);t=await action(t,'start');assert.ok(t.started_at);assert.equal(t.version,2);});
  await check('stale version cannot overwrite work',async()=> {await assert.rejects(action({...t,version:1},'complete','Checked'),/changed/);});
  await check('completion needs an actual result',async()=> {await assert.rejects(action(t,'complete'),/Describe the result/);});
  await check('support captures reason and preserves the assigned owner',async()=> {t=await action(t,'help','Need replacement headset','equipment');assert.equal(t.status,'blocked');assert.equal(t.support_category,'equipment');assert.equal(t.assigned_to,uid(2));});
  await check('another person cannot complete or forge the contract',async()=> {await as(1);await assert.rejects(action(t,'complete','Pretend done'),/Only the assigned/);await as(2);await rejected('update centre_day_tasks set due_minute=610 where id=$1',[t.id],/Only the lead/);await rejected('update centre_day_tasks set id=$2 where id=$1',[t.id,uid(99)],/keeps its identity/);});
  await check('completion awaits an independent reviewer',async()=> {t=await action(t,'resume');t=await action(t,'complete','Checked all stations, one headset replaced');assert.equal(t.done_by,uid(2));assert.equal(t.verified_by,null);await assert.rejects(action(t,'verify'),/Only the lead/);});
  await check('returned work requires feedback and keeps evidence',async()=> {await as(1);await assert.rejects(action(t,'return'),/explain returned/);t=await action(t,'return','Please check the spare station too');assert.equal(t.status,'open');assert.equal(t.rework_count,1);assert.equal(t.verified_at,null);});
  await check('the same feedback on a later return still counts as a return',async()=> {await as(2);t=await action(t,'complete','Checked stations again');await as(1);t=await action(t,'return','Please check the spare station too');assert.equal(t.rework_count,2);});
  await check('lead verifies a result without changing its author',async()=> {await as(2);t=await action(t,'complete','Checked the spare station too');await as(1);t=await action(t,'verify');assert.equal(t.verified_by,uid(1));assert.equal(t.done_by,uid(2));});
  await check('completed evidence cannot be edited without reopening',async()=> {await as(2);await rejected('update centre_day_tasks set completion_note=$2 where id=$1',[t.id,'Changed evidence'],/Reopen work/);});
  await check('changing the agreement reopens reviewed work',async()=> {await as(1);t=(await db.query('update centre_day_tasks set due_minute=620 where id=$1 returning *',[t.id])).rows[0];assert.equal(t.status,'open');assert.equal(t.verified_at,null);assert.equal(t.done_at,null);});
  await check('audit trail records real actors and rejects client inserts and deletes',async()=> {const rows=(await db.query('select * from centre_task_activity where task_id=$1',[t.id])).rows;assert.ok(rows.some(r=>r.kind==='completed'&&r.actor_id===uid(2)));assert.ok(rows.some(r=>r.kind==='returned'));await rejected('delete from centre_task_activity where task_id=$1',[t.id],/permission denied/);await rejected("insert into centre_task_activity(task_id,branch,day,actor_id,kind) values($1,'cochin',$2,$3,'verified')",[t.id,day,uid(1)],/permission denied/);});
  await check('other centre cannot see tasks or their history',async()=> {await as(4);assert.equal(await getTask(t.id),undefined);assert.equal((await db.query('select * from centre_task_activity where task_id=$1',[t.id])).rows.length,0);});
  await check('staff cannot take a responsibility from its rostered owner',async()=> {await as(3);await rejected("insert into centre_day_tasks(branch,day,responsibility_id,title,assigned_to) values('cochin',$1,$2,'Stolen',$3)",[day,resp,uid(3)],/agreed owner/);});
  await check('new assignments snapshot the expected result and time',async()=> {await as(5);await db.query('delete from centre_day_tasks where id=$1',[legacy.id]);await as(2);const r=(await db.query("insert into centre_day_tasks(branch,day,responsibility_id,title,assigned_to) values('cochin',$1,$2,'Prepare lab',$3) returning *",[day,resp,uid(2)])).rows[0];assert.equal(r.due_minute,600);assert.equal(r.expected_result,'Every station passes a readiness check');await as(5);await db.query('update centre_responsibilities set expected_result=$2 where id=$1',[resp,'A new agreement']);assert.equal((await getTask(r.id)).expected_result,'Every station passes a readiness check');});
  const decision = async(kind='support',context='',reviewed=false) => (await db.query("insert into centre_staff_development(branch,profile_id,kind,evidence,context,action,review_on,task_ids,context_reviewed) values('cochin',$1,$2,'A specific observed work result',$3,'Agree replacement equipment',$4,$5,$6) returning *",[uid(2),kind,context,day,[t.id],reviewed])).rows[0];
  let note;
  await check('only management records personnel decisions',async()=> {await as(1);await assert.rejects(decision(),/Only management|row-level security/);await as(5);note=await decision();assert.equal(note.created_by,uid(5));assert.equal(note.evidence_snapshot[0].id,t.id);});
  await check('warning requires reviewed context rather than automatic scoring',async()=> {await assert.rejects(decision('warning'),/Review workload/);const n=await decision('warning','Spoke about instructions, workload and support',true);assert.equal(n.kind,'warning');});
  await check('feedback is private to management and the subject',async()=> {await as(3);assert.equal((await db.query('select * from centre_staff_development')).rows.length,0);await as(1);assert.equal((await db.query('select * from centre_staff_development')).rows.length,0);await as(2);assert.ok((await db.query('select * from centre_staff_development')).rows.length>0);});
  await check('staff can respond but cannot rewrite or close a decision',async()=> {await db.query('update centre_staff_development set staff_response=$2 where id=$1',[note.id,'Equipment arrived late; now resolved']);await rejected("update centre_staff_development set status='closed' where id=$1",[note.id],/Only management/);await rejected('update centre_staff_development set evidence=$2 where id=$1',[note.id,'Changed original evidence'],/immutable/);});
  await check('manager cannot fabricate the staff response or evidence snapshot',async()=> {await as(5);await rejected('update centre_staff_development set staff_response=$2 where id=$1',[note.id,'Forged response'],/Only the staff/);await rejected("update centre_staff_development set evidence_snapshot='[]' where id=$1",[note.id],/immutable/);await rejected("update centre_staff_development set status='closed' where id=$1",[note.id],/Describe the follow-up/);const n=(await db.query("update centre_staff_development set status='closed',followup_result='Equipment replaced and staff supported' where id=$1 returning *",[note.id])).rows[0];assert.ok(n.closed_at);assert.equal(n.closed_by,uid(5));await rejected("update centre_staff_development set followup_result='Rewritten outcome' where id=$1",[note.id],/before closing/);});
  await check('anonymous access to workflow and personnel records is denied',async()=> {await as(null,'anon');await assert.rejects(action(t,'start'),/permission denied/);await rejected('select * from centre_staff_development',[],/permission denied/);});
  await check('future-day assignments cannot start or complete early',async()=> {await as(5);const future=(await db.query("insert into centre_day_tasks(branch,day,title,assigned_to,expected_result) values('cochin','2099-01-01','Future duty',$1,'A real result') returning *",[uid(2)])).rows[0];await as(2);await assert.rejects(action(future,'start'),/future day/);await assert.rejects(action(future,'complete','Invented result'),/future day/);});
  await check('a lead cannot verify their own duty through the new action RPC',async()=> {await as(1);let own=await task('Lead regular work',1);own=await action(own,'complete','The agreed result achieved');await assert.rejects(action(own,'verify'),/Someone else/);await as(5);own=await action(own,'verify');assert.equal(own.verified_by,uid(5));});
  await check('personnel evidence rejects another person’s work',async()=> {await as(5);await rejected("insert into centre_staff_development(branch,profile_id,kind,evidence,action,review_on,task_ids) values('cochin',$1,'support','Observed work result','Agree a next step',$2,$3)",[uid(3),day,[t.id]],/Evidence must belong/);});
  await as(1);
  const ids = [uid(1), uid(2), uid(3)];
  const plan = { actingLead: '', availability: ids.map(staff => ({ staff, start: 480, end: 1020, confirmed: true })), blocks: Array.from({length:6}, (_,i) => ({ start:480+i*90, end:570+i*90, owners:{front:ids[i%3],floor:ids[(i+1)%3],control:ids[(i+2)%3]},duties:{front:'',floor:'',control:''} })), breaks:ids.flatMap((staff,i)=>[600+i*30,840+i*30].map(start=>({staff,start,end:start+30,cover:ids[(i+1)%3],note:'Agreed cover'}))) };
  const pid = (await db.query("insert into centre_day_plans(branch,day,lead_id,plan,status) values('cochin',$1,$2,$3,'published') returning id", [day,uid(1),plan])).rows[0].id;
  await db.query("insert into centre_duty_reports(plan_id,branch,day,summary,followups,recognition) values($1,'cochin',$2,'Reviewed work','Follow up open work','')",[pid,day]);
  await check('closed-day workflow rejects completion, changes and removal',async()=> {await as(2);await assert.rejects(action(t,'complete','Attempt after closure'),/closed/);await as(1);await rejected('update centre_day_tasks set due_minute=700 where id=$1',[t.id],/closed/);await rejected('delete from centre_day_tasks where id=$1',[t.id],/closed/);});
  await check('compatibility rollback retains audit and feedback and enables the old owner completion',async()=> {
    await as(null,'postgres');
    const before=(await db.query('select (select count(*) from centre_task_activity) as activity,(select count(*) from centre_staff_development) as feedback')).rows[0];
    await db.exec(await readFile(new URL('../../docs/releases/sql/2026-10-08-shift-compatibility-rollback.sql',import.meta.url),'utf8'));
    const after=(await db.query('select (select count(*) from centre_task_activity) as activity,(select count(*) from centre_staff_development) as feedback')).rows[0];assert.deepEqual(after,before);
    await as(5);const compatibility=(await db.query("insert into centre_day_tasks(branch,day,title,assigned_to) values('cochin','2020-01-07','Legacy browser duty',$1) returning *",[uid(2)])).rows[0];
    await as(2);const done=(await db.query("update centre_day_tasks set status='done' where id=$1 returning *",[compatibility.id])).rows[0];assert.equal(done.done_by,uid(2));assert.equal(done.completion_note,'');
    const caps=(await db.query('select fets_workspace_capabilities() as caps')).rows[0].caps;assert.equal(caps.version,4);assert.notEqual(caps.dutyWorkflow,true);
  });
  await check('restoring the new guards requires evidence again without replaying any data',async()=> {
    await as(null,'postgres');await db.exec(await readFile(new URL('../../docs/releases/sql/2026-10-08-shift-restore-workflow.sql',import.meta.url),'utf8'));await as(5);const fresh=(await db.query("insert into centre_day_tasks(branch,day,title,assigned_to) values('cochin','2020-01-07','Restored duty',$1) returning *",[uid(2)])).rows[0];await as(2);await assert.rejects(action(fresh,'complete'),/Describe the result/);const caps=(await db.query('select fets_workspace_capabilities() as caps')).rows[0].caps;assert.equal(caps.version,5);assert.equal(caps.dutyWorkflow,true);
  });
  console.log(`${checks} shift workflow database checks passed.`);
} finally { await db.close(); }
