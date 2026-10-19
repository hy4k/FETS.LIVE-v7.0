// Disposable PostgreSQL only. Never connects to either production project.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.FETS_PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();const uid=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const day='2026-10-20';let passed=0;
async function check(name,fn){await fn();passed++;console.log('PASS',name);}
async function role(name,actor=''){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);await db.exec(`set role ${name}`);}
async function clock(time){await db.query("select set_config('test.clock',$1,false)",[`${day}T${time}:00+05:30`]);}
const migration=new URL('../../supabase/migrations/20261019185443_online_shift_checks.sql',import.meta.url);
try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,banned_until timestamptz,deleted_at timestamptz);
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated,anon,service_role;
 create table staff_profiles(id uuid primary key,user_id uuid,full_name text,branch_assigned text,is_active boolean,role text,permissions jsonb default '{}');
 create table roster_schedules(profile_id uuid,date date,shift_code text,branch_location text);
 grant select on staff_profiles,roster_schedules to authenticated,service_role;
 create function public.test_clock() returns timestamptz language sql as $$select current_setting('test.clock')::timestamptz$$;`);
 await clock('07:50');
 for(let n=1;n<=6;n++){
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[uid(n),`staff${n}@example.test`]);
  await db.query('insert into staff_profiles(id,user_id,full_name,branch_assigned,is_active,role) values($1,$1,$2,$3,true,$4)',[uid(n),`Staff ${n}`,n===4?'calicut':'cochin',n===5?'super_admin':'staff']);
  await db.query("insert into roster_schedules values($1,$2,'D',$3)",[uid(n),day,n===4?'calicut':'cochin']);
 }
 for(const file of ['20260929091547_centre_duty_planning.sql','20260929100511_duty_coverage_and_activation.sql','20261019185443_online_shift_checks.sql']){
  const sql=await readFile(new URL(`../../supabase/migrations/${file}`,import.meta.url),'utf8');
  await db.exec(sql.replaceAll('clock_timestamp()','public.test_clock()'));
 }
 await role('authenticated',uid(5));
 await db.query("insert into centre_lead_weeks(branch,week_start,lead_id) values('cochin','2026-10-19',$1)",[uid(1)]);
 const ids=[uid(1),uid(2),uid(3)];
 const plan={actingLead:'',availability:ids.map(staff=>({staff,start:480,end:1020,confirmed:true})),blocks:Array.from({length:6},(_,i)=>({start:480+i*90,end:570+i*90,owners:{front:ids[i%3],floor:ids[(i+1)%3],control:ids[(i+2)%3]},duties:{front:'',floor:'',control:''}})),breaks:ids.flatMap((staff,i)=>[600+i*30,840+i*30].map(start=>({staff,start,end:start+30,cover:ids[(i+1)%3],note:'Agreed cover'})))};
 // Staff 3 takes the first break, with staff 1 as named cover.
 plan.breaks=ids.flatMap((staff,i)=>[600+(2-i)*30,840+(2-i)*30].map(start=>({staff,start,end:start+30,cover:ids[(i+1)%3],note:'Agreed cover'})));
 const pid=(await db.query("insert into centre_day_plans(branch,day,lead_id,plan,status) values('cochin',$1,$2,$3,'published') returning id",[day,uid(1),plan])).rows[0].id;
 await db.query("insert into centre_duty_changes(plan_id,kind,block,lane,staff_id,starts,ends,shift_start,shift_end,reason) values($1,'coverage',1,'floor',$2,630,640,480,1020,'Agreed temporary cover')",[pid,uid(5)]);
 const snapshot=async(n=2,branch='cochin',date=day)=>(await db.query('select fets_online_check_snapshot($1,$2,$3,$4) as data',[uid(100+n),`staff${n}@example.test`,branch,date])).rows[0].data;
 const record=async(n,block,kind,due,note='',branch='cochin')=>(await db.query('select * from fets_online_record_check($1,$2,$3,$4,$5,$6,$7,$8)',[uid(100+n),`staff${n}@example.test`,branch,pid,block,kind,due,note])).rows[0];
 await check('anonymous and browser roles cannot invoke the server bridge',async()=>{
  for(const r of ['anon','authenticated']){await role(r,uid(2));await assert.rejects(snapshot(),/permission denied/);await assert.rejects(record(2,0,'walk',490),/permission denied/);await assert.rejects(db.query('select fets_duty_private.online_actor($1,$2,$3)',[uid(102),'staff2@example.test','cochin']),/permission denied/);}
 });
 await role('service_role',uid(6));
 await check('published rota provides all 144 exact checks and leaves unknown records empty',async()=>{const s=await snapshot();assert.equal(s.checks.length,144);assert.equal(s.checks[0].due,486);assert.equal(s.checks[1].due,490);assert.equal(s.checks.filter(c=>c.event).length,0);assert.equal(s.viewer_id,uid(2));assert.equal((await db.query('select auth.uid() as id')).rows[0].id,uid(6));});
 await check('missing plan is explicit, never an invented rota',async()=>{assert.equal((await snapshot(2,'cochin','2026-10-21')).plan,null);});
 await check('centre mismatch is denied and does not change caller context',async()=>{await assert.rejects(snapshot(2,'calicut'),/active FETS Live/);assert.equal((await db.query('select auth.uid() as id')).rows[0].id,uid(6));});
 await check('inactive, unverified, banned and deleted identities are rejected',async()=>{
  for(const field of ['email_confirmed_at=null','banned_until=\'2099-01-01\'','deleted_at=now()']){
   await role('postgres');await db.exec(`update auth.users set ${field} where id='${uid(6)}'`);await role('service_role');await assert.rejects(snapshot(6),/active FETS Live/);
   await role('postgres');await db.query('update auth.users set email_confirmed_at=now(),banned_until=null,deleted_at=null where id=$1',[uid(6)]);
  }
  await db.query('update staff_profiles set is_active=false where id=$1',[uid(6)]);await role('service_role');await assert.rejects(snapshot(6),/active FETS Live/);
 });
 await check('early and wrong-owner checks fail without records',async()=>{await clock('08:09');await assert.rejects(record(2,0,'walk',490),/not currently due/);await clock('08:10');await assert.rejects(record(1,0,'walk',490),/assigned owner/);});
 let first;
 await check('Online completion creates exactly one canonical Live event with real actor and provenance',async()=>{first=await record(2,0,'walk',490,'All areas checked');assert.equal(first.actor_id,uid(2));assert.equal(first.kind,'walk');assert.equal((await db.query('select online_user_id from fets_duty_private.online_check_sources where event_id=$1',[first.id])).rows[0].online_user_id,uid(102));assert.equal((await snapshot()).checks.find(c=>c.kind==='walk'&&c.due===490).event.id,first.id);});
 await check('same request retries return the same event; edited or other-actor retries fail',async()=>{await clock('08:25');assert.equal((await record(2,0,'walk',490,'All areas checked')).id,first.id);await assert.rejects(record(2,0,'walk',490,'Changed note'),/already recorded/);await assert.rejects(record(1,0,'walk',490,'All areas checked'),/already recorded/);});
 await check('missed window cannot be backfilled',async()=>{await clock('08:30');await assert.rejects(record(2,0,'walk',500),/not currently due/);});
 await check('6-minute DVR window and cadence are enforced',async()=>{await clock('08:18');await assert.rejects(record(3,0,'dvr',492),/not currently due/);await assert.rejects(record(3,0,'dvr',497),/not currently due/);const e=await record(3,0,'dvr',498);assert.equal(e.lane,'control');});
 await check('rotation boundary check belongs to outgoing owner',async()=>{await clock('09:30');await assert.rejects(record(3,0,'walk',570),/assigned owner/);await record(2,0,'walk',570);await clock('09:40');await record(3,1,'walk',580);});
 await check('break start boundary uses outgoing owner; next check uses named cover',async()=>{await clock('10:00');await record(3,1,'walk',600);await clock('10:10');await assert.rejects(record(3,1,'walk',610),/assigned owner/);await record(1,1,'walk',610);});
 await check('break end boundary stays with cover; effective change uses the preceding minute',async()=>{await clock('10:30');await record(1,1,'walk',630);await clock('10:40');await assert.rejects(record(3,1,'walk',640),/assigned owner/);await record(5,1,'walk',640);await clock('10:50');await record(3,1,'walk',650);});
 await check('removed roster prevents completion despite retained plan ownership',async()=>{await role('postgres');await db.query("update roster_schedules set shift_code='OFF' where profile_id=$1",[uid(3)]);await role('service_role');await clock('11:00');await assert.rejects(record(3,1,'walk',660),/roster no longer/);await role('postgres');await db.query("update roster_schedules set shift_code='D' where profile_id=$1",[uid(3)]);await role('service_role');});
 await check('checks recorded directly in The Shift appear unchanged in Online',async()=>{await clock('11:00');await role('authenticated',uid(3));const e=(await db.query("insert into centre_duty_events(plan_id,block,lane,kind,due,note) values($1,1,'floor','walk',660,'Recorded in The Shift') returning *",[pid])).rows[0];await role('service_role');assert.equal((await snapshot()).checks.find(c=>c.kind==='walk'&&c.due===660).event.id,e.id);});
 await check('report closure blocks new checks; existing record retries remain immutable',async()=>{await clock('17:00');await role('authenticated',uid(1));await db.query("insert into centre_duty_reports(plan_id,branch,day,summary,followups,recognition) values($1,'cochin',$2,'Reviewed the real work','No outstanding follow-ups','Team completed the review')",[pid,day]);await role('service_role');assert.equal((await snapshot()).plan.closed,true);await assert.rejects(record(1,5,'walk',1020),/closed/);assert.equal((await record(2,0,'walk',490,'All areas checked')).id,first.id);});
 await check('no cross-centre plan or arbitrary event kinds accepted',async()=>{await assert.rejects(record(4,0,'walk',490,'','calicut'),/Published plan not found/);await assert.rejects(record(2,0,'verify',490),/Invalid check/);});
 console.log(`${passed} shared check database checks passed.`);
}catch(e){console.error(e.message,e.where??'');process.exitCode=1;}finally{await db.close();}
