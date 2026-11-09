// Disposable PostgreSQL only. No live credentials, external writes or package installation.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
const { PGlite } = await import(process.env.PGLITE_MODULE || '/tmp/fets-ai-db-test/node_modules/@electric-sql/pglite/dist/index.js');
const db = new PGlite();
const q = async (sql, args = []) => {try{return (await db.query(sql,args)).rows;}catch(e){e.message += ` [${sql}]`;throw e;}};
const one = async (sql,args=[]) => (await q(sql,args))[0];
const ids = Object.fromEntries(['owner','other','manager','projectManager','super','denied','disabled','unverified','outsider','mismatch'].map((n,i)=>[n,`33333333-3333-4333-8333-${String(i+1).padStart(12,'0')}`]));
const admin=()=>db.exec("reset role;set request.jwt.claim.sub='';set request.jwt.claims='{}'");
const as=async n=>db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${n?ids[n]:''}';set request.jwt.claims='{}'`);
const rpc=async(name,p)=> (await one(`select public.${name}(${p===undefined?'':'$1::jsonb'}) value`,p===undefined?[]:[p])).value;
const context=()=>rpc('outreach_context');
const detail=async(id,at=null,cursorId=null)=>(await one('select public.outreach_detail($1,$2,$3) value',[id,at,cursorId])).value;
const institute=(o={})=>({id:null,expected_updated_at:null,name:'Synthetic CMA Academy',city:'Cochin',state:'Kerala',contact_name:'Business Contact',contact_role:'Coordinator',phone:'0000000011',email:'',website:'https://example.invalid',preferred_centre:'cochin',owner_user_id:ids.owner,stage:'new',contact_permission:'not_asked',notes:'Synthetic business contact only',change_reason:'',...o});
const saveI=p=>rpc('outreach_save_institute',p);
const batch=(id,o={})=>({id:null,expected_updated_at:null,institute_id:id,name:'Synthetic November Cohort',delivery:'fets_centre',centre:'cochin',planned_date:'2027-01-12',status:'potential',estimated:20,confirmed:0,attended:0,notes:'',...o});
const saveB=p=>rpc('outreach_save_batch',p);
const answers={annual_students:100,exam_cycle:'June',booking_influence:'Institute advises',main_worries:'Environment',student_queries:'Readiness',current_mock_format:'Classroom',environment_gap:'Quiet setting',readiness_needs:'Practice',expectations:'Discussion',improvements:'Feedback'};
const call=(i,o={})=>({institute_id:i.id,request_id:crypto.randomUUID(),expected_updated_at:i.updated_at,occurred_at:'2026-11-07T10:00:00+05:30',channel:'phone',outcome:'feedback_received',contact_name:'Business Contact',contact_role:'Coordinator',summary:'Synthetic consultative conversation',answers,concerns:['environment','availability'],interest:'centre_mock',follow_up_permission:'allowed',advisory_interest:'yes',stage:'understanding_needs',next_step:{kind:'requested_callback',title:'Agreed callback',due_at:'2026-11-09T10:00:00+05:30'},close_reason:'',...o});
const saveC=p=>rpc('outreach_record_call',p);
const updateF=(f,o={})=>rpc('outreach_update_followup',{id:f.id,expected_updated_at:f.updated_at,status:'done',due_at:f.due_at,note:'Synthetic task complete',...o});
const denied=fn=>assert.rejects(fn,/permission denied|authori[sz]|access|verified|owner/i);
const stale=fn=>assert.rejects(fn,/changed|stale|reload/i);
const business=async()=> (await one(`select jsonb_build_object(
'candidates',(select jsonb_agg(to_jsonb(t) order by id) from candidates t),
'calendar',(select jsonb_agg(to_jsonb(t) order by id) from calendar_sessions t),
'pearson',(select jsonb_agg(to_jsonb(t) order by id) from fets_pearson_private.imports t),
'pearson_memberships',(select jsonb_agg(to_jsonb(t) order by candidate_id) from fets_pearson_private.memberships t),
'pearson_reviews',(select jsonb_agg(to_jsonb(t) order by id) from fets_pearson_private.cancellation_reviews t),
'pearson_audit',(select jsonb_agg(to_jsonb(t) order by id) from fets_pearson_private.audit t),
'mission',(select jsonb_agg(to_jsonb(t) order by id) from public.institution_missions t),
'functions',(select jsonb_agg(jsonb_build_array(n.nspname,p.proname,pg_get_functiondef(p.oid)) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname like 'fets_%' and n.nspname<>'fets_outreach_private' or n.nspname='public') and p.prokind='f' and p.proname not like 'outreach_%'),
 'triggers',(select jsonb_agg(pg_get_triggerdef(oid) order by oid) from pg_trigger where not tgisinternal)) value`)).value;
try {
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 create table auth.users(id uuid primary key,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
 create table public.staff_profiles(id uuid primary key,user_id uuid unique,full_name text,role text,is_active boolean,status text,permissions jsonb);
 create table public.centre_duty_members(user_id uuid,profile_id uuid,branch text,role text);
 create schema fets_ai_private;create schema fets_actionables_private;
 create table fets_actionables_private.members(user_id uuid primary key,profile_id uuid,full_name text,project_role text,enabled boolean);
 create table public.candidates(id uuid primary key default gen_random_uuid(),full_name text not null,phone text,exam_date timestamptz,status text default 'registered',confirmation_number text unique,user_id uuid not null default auth.uid(),created_at timestamptz default now(),updated_at timestamptz default now(),exam_name text,branch_location text,client_name text,check_in_time timestamptz,locker_key text,notes text);
 create table public.calendar_sessions(id bigint generated by default as identity primary key,client_name text,exam_name text,date date,candidate_count integer default 0,start_time time,end_time time,user_id uuid,created_at timestamptz default now(),updated_at timestamptz default now(),branch_location text,status text,assigned_staff text[]);
 create table public.institution_missions(id uuid primary key default gen_random_uuid(),title text);insert into public.institution_missions(title) values('Existing Pearson mission');
 alter table candidates enable row level security;alter table calendar_sessions enable row level security;revoke all on candidates,calendar_sessions from public,anon,authenticated;`);
 const expanded=readFileSync('supabase/migrations/20261105113411_expanded_ai_operations.sql','utf8');
 await db.exec(expanded.slice(expanded.indexOf('create or replace function fets_ai_private.member_active'),expanded.indexOf('create table public.fets_ai_reviews')));
 await db.exec('revoke all on all functions in schema fets_ai_private from public');
 for(const file of ['20260929195737_calendar_candidate_roster.sql','20260930024000_reconcile_calendar_roster_validation.sql','20261001074500_roster_exam_provider_guard.sql','20261105175410_pearson_monthly_registration_import.sql','20261106181305_calendar_seat_management.sql','20261107091417_calendar_seat_capacity.sql']) await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));
 for(const [n,id] of Object.entries(ids)){
  await q('insert into auth.users values($1,case when $2 then now() else null end,null,null)',[id,n!=='unverified']);
  await q('insert into staff_profiles values($1,$1,$2,$3,$4,$5,$6)',[id,`Staff ${n}`,n==='super'?'super_admin':n==='manager'?'manager':'staff',n!=='disabled','active',n==='denied'?{'ws_actionables':false}:{}]);
  if(n!=='outsider')await q("insert into centre_duty_members values($1,$1,$2,'staff')",[id,n==='other'?'calicut':'cochin']);
  await q('insert into fets_actionables_private.members values($1,$2,$3,$4,true)',[id,n==='mismatch'?ids.owner:id,`Staff ${n}`,n==='projectManager'?'manager':'staff']);
 }
 await q("delete from fets_actionables_private.members where user_id=$1",[ids.super]);await q("update staff_profiles set permissions='{\"ws_actionables\":false,\"actionables\":false}' where user_id=$1",[ids.super]);
 await db.exec("insert into calendar_sessions(client_name,exam_name,date,candidate_count,start_time,end_time,branch_location,status) values('PSI','Synthetic existing session','2027-01-12',20,'09:00','11:00','cochin','scheduled')");
 await q(`insert into candidates(full_name,phone,email,user_id,exam_date,exam_start_time,exam_end_time,client_name,exam_name,exam_code,exam_title,branch_location,status,pearson_registration_id,pearson_calendar_session_id) values('Synthetic existing candidate','00012000000','existing@example.invalid',$1,'2027-01-12 09:00+05:30','09:00','11:00','PEARSON VUE','Existing source group','EX-OLD','Synthetic assessment','cochin','registered',gen_random_uuid(),1)`,[ids.owner]);
 await db.exec(`insert into fets_pearson_private.imports(id,branch,from_date,through_date,complete,source_as_of,file_hash,content_hash,filename,source_rows) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','cochin','2027-01-01','2027-01-31',true,'2026-11-01','synthetic','synthetic','synthetic.xlsx','[]');insert into fets_pearson_private.cancellation_reviews(candidate_id,branch,import_id,candidate_snapshot) select id,'cochin','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',to_jsonb(c) from candidates c;`);
 const before=await business();
 const path=process.env.OUTREACH_TEST_MIGRATION || 'supabase/migrations/'+readdirSync('supabase/migrations').find(f=>f.endsWith('_prometric_institute_outreach.sql'));
 await db.exec(readFileSync(path,'utf8'));
 await as('owner');assert.deepEqual(await context(),{viewer:{user_id:ids.owner,can_manage:false},staff:[{user_id:ids.owner,full_name:'Staff owner'}],institutes:[],followups:[],batches:[]});
 for(const name of [null,'denied','disabled','unverified','outsider','mismatch']){await as(name);await denied(context);await denied(()=>saveI(institute()));}
 await db.exec("reset role;set role anon;set request.jwt.claim.sub=''");await denied(context);
 await as('owner');await db.exec(`set request.jwt.claims='{"user_metadata":{"role":"super_admin","permissions":{"actionables":true}},"app_metadata":{"role":"super_admin"}}'`);
 await denied(()=>saveI(institute({owner_user_id:ids.other})));
 let i=await saveI(institute());assert.equal(i.owner_user_id,ids.owner);assert.equal(i.interest,'not_discussed');
 const firstVersion=i.updated_at;await stale(()=>saveI(institute({id:i.id,expected_updated_at:null})));
 i=await saveI(institute({id:i.id,expected_updated_at:i.updated_at,notes:'Updated synthetic notes'}));assert.notEqual(i.updated_at,firstVersion);
 await stale(()=>saveI(institute({id:i.id,expected_updated_at:firstVersion})));
 await assert.rejects(()=>saveI(institute({name:'  SYNTHETIC  CMA academy ',city:' COCHIN '})),/duplicate|already/i);
 for(const change of [{student_phone:'0001'},{website:'javascript:alert(1)'},{website:'ftp://example.invalid'},{phone:'',email:''},{name:'x'.repeat(201)},{preferred_centre:'kochi'},{stage:'closed',change_reason:''},{contact_permission:'do_not_contact',change_reason:''}])await assert.rejects(()=>saveI(institute({name:crypto.randomUUID(),...change})));
 await as('other');assert.equal((await context()).institutes.length,0);await denied(()=>detail(i.id));await denied(()=>saveB(batch(i.id)));await denied(()=>saveC(call(i)));
 await as('manager');let c=await context();assert.equal(c.viewer.can_manage,true);assert.equal(c.institutes.length,1);assert.ok(c.staff.some(s=>s.user_id===ids.other));assert.ok(!c.staff.some(s=>['denied','disabled','unverified','outsider','mismatch'].map(n=>ids[n]).includes(s.user_id)));assert.deepEqual(Object.keys(c.staff[0]).sort(),['full_name','user_id']);
 for(const n of ['projectManager','super']){await as(n);assert.equal((await context()).viewer.can_manage,true);await detail(i.id);}
 await admin();await q("update centre_duty_members set role='planner' where user_id=$1",[ids.owner]);await as('owner');assert.equal((await context()).viewer.can_manage,false,'centre planner does not become global outreach manager');
 await admin();await q("update staff_profiles set role='admin' where user_id=$1",[ids.manager]);await as('manager');assert.equal((await context()).viewer.can_manage,true);
 await admin();await q("update staff_profiles set role='manager' where user_id=$1",[ids.manager]);await q('update staff_profiles set is_active=false where user_id=$1',[ids.super]);await as('super');await denied(context);await admin();await q('update staff_profiles set is_active=true where user_id=$1',[ids.super]);
 await as('owner');
 const p=call(i);let receipt=await saveC(p);i=receipt.institute;assert.equal(i.stage,'understanding_needs');assert.equal(i.last_contact_at,'2026-11-07T04:30:00+00:00');
 assert.deepEqual(await saveC(p),receipt,'idempotent authorised exact replay');await assert.rejects(()=>saveC({...p,summary:'Changed'}),/request|reuse|payload/i);
 let d=await detail(i.id);assert.equal(d.calls.length,1);assert.deepEqual(d.calls[0].answers,answers);assert.deepEqual(d.calls[0].concerns,['environment','availability']);assert.equal(d.followups.filter(f=>f.status==='open').length,1);
 const oldF=d.followups[0];receipt=await saveC(call(i,{next_step:{kind:'arrange_mock',title:'Review possible capacity',due_at:'2026-11-12T10:00:00+05:30'}}));i=receipt.institute;d=await detail(i.id);assert.equal(d.followups.find(f=>f.id===oldF.id).status,'cancelled');assert.match(d.followups.find(f=>f.id===oldF.id).completion_note,/supersed/i);
 let f=d.followups.find(f=>f.status==='open');let nf=await updateF(f,{status:'open',due_at:'2026-11-14T10:00:00+05:30',note:'Institute requested later callback'});await stale(()=>updateF(f));assert.notEqual(nf.updated_at,f.updated_at);f=nf;
 await assert.rejects(()=>updateF(f,{note:''}));await updateF(f);assert.equal((await detail(i.id)).followups.filter(f=>f.status==='open').length,0);
 for(const change of [{next_step:null,close_reason:''},{close_reason:'Closed',next_step:p.next_step},{actor_user_id:ids.other},{answers:{...answers,student_names:'Unknown'}},{answers:{...answers,annual_students:1.5}},{concerns:['x'.repeat(81)]},{concerns:['unknown_tag']},{concerns:['environment','environment']},{occurred_at:'infinity'}])await assert.rejects(()=>saveC(call(i,change)));
 await assert.rejects(()=>saveC(call(i,{next_step:{...p.next_step,student_phone:'0001'}})));
 let b=await saveB(batch(i.id));assert.equal(b.estimated,20);await stale(()=>saveB({...batch(i.id),id:b.id,expected_updated_at:null}));
 await assert.rejects(()=>saveB(batch(i.id,{name:' SYNTHETIC   november cohort '})),/duplicate|already/i);
 for(const change of [{confirmed:1},{attended:1},{estimated:1.5},{estimated:10001},{confirmed:-1},{delivery:'institute_platform',centre:'cochin'},{centre:null},{status:'confirmed',planned_date:null},{status:'completed',confirmed:5,attended:6},{status:'confirmed',confirmed:5,attended:1},{student_email:'x'}])await assert.rejects(()=>saveB(batch(i.id,{name:crypto.randomUUID(),...change})));
 b=await saveB({...batch(i.id),id:b.id,expected_updated_at:b.updated_at,status:'completed',confirmed:18,attended:17});assert.equal(b.attended,17);
 let platform=await saveB(batch(i.id,{delivery:'institute_platform',centre:null,status:'confirmed',confirmed:15}));assert.equal(platform.delivery,'institute_platform');
 await denied(()=>q('select * from fets_outreach_private.calls'));await denied(()=>q('delete from fets_outreach_private.institutes'));
 console.log('PASS canonical owner/manager access, unknown-key validation, exact versions, append-only calls, replay, follow-ups and distinct cohort counts');
 // DNC cancels existing outbound steps and suppresses subsequent outbound work.
 receipt=await saveC(call(i));i=receipt.institute;
 receipt=await saveC(call(i,{outcome:'do_not_contact',follow_up_permission:'do_not_contact',next_step:null,close_reason:'Institute asked to stop contacting',stage:'closed'}));i=receipt.institute;
 d=await detail(i.id);assert.equal(d.followups.filter(f=>f.status==='open').length,0);
 await assert.rejects(()=>saveC(call(i)),/contact|permission/i);await assert.rejects(()=>saveC(call(i,{channel:'inbound',outcome:'permission_update',summary:'',next_step:null,close_reason:'Update'})));
 await assert.rejects(()=>saveI({...institute(),id:i.id,expected_updated_at:i.updated_at,contact_permission:'allowed',change_reason:'Owner wants restore'}),/manager|permission/i);
 receipt=await saveC(call(i,{channel:'inbound',outcome:'permission_update',summary:'Institute contacted us and explicitly restored permission',follow_up_permission:'allowed'}));i=receipt.institute;
 i=await saveI({...institute(),id:i.id,expected_updated_at:i.updated_at,contact_permission:'do_not_contact',change_reason:'Do not contact request'});
 await as('manager');i=await saveI({...institute(),id:i.id,expected_updated_at:i.updated_at,contact_permission:'allowed',change_reason:'Institute confirmed consent directly to manager'});
 await as('owner');
 // Reassignment and revocation remain authoritative even for an old successful request replay.
 await admin();await q('update fets_outreach_private.institutes set owner_user_id=$1 where id=$2',[ids.other,i.id]);await as('owner');await denied(()=>saveC(p));await denied(()=>saveI({...institute(),id:i.id,expected_updated_at:i.updated_at}));await denied(()=>saveB({...batch(i.id),id:b.id,expected_updated_at:b.updated_at}));
 await as('manager');await denied(()=>saveI(institute({name:'Assign invalid owner',owner_user_id:ids.unverified})));
 i=await saveI({...institute(),id:i.id,expected_updated_at:i.updated_at,change_reason:'Manager reassigns back'});
 const revocations=["update staff_profiles set is_active=false where user_id=$1","update staff_profiles set status='inactive' where user_id=$1","update staff_profiles set permissions='{\"ws_actionables\":false}' where user_id=$1","update staff_profiles set permissions='{\"actionables\":false}' where user_id=$1",'update auth.users set email_confirmed_at=null where id=$1',"update auth.users set banned_until=now()+interval '1 day' where id=$1",'update auth.users set deleted_at=now() where id=$1','update fets_actionables_private.members set enabled=false where user_id=$1','delete from centre_duty_members where user_id=$1'];
 for(const sql of revocations){await admin();await q(sql,[ids.owner]);await as('owner');await denied(context);await denied(()=>saveC(p));await admin();await q("update staff_profiles set is_active=true,status='active',permissions='{}' where user_id=$1",[ids.owner]);await q('update auth.users set email_confirmed_at=now(),banned_until=null,deleted_at=null where id=$1',[ids.owner]);await q('update fets_actionables_private.members set enabled=true where user_id=$1',[ids.owner]);await q("insert into centre_duty_members select $1,$1,'cochin','staff' where not exists(select 1 from centre_duty_members where user_id=$1)",[ids.owner]);}
 await as('owner');
 // PGlite serializes connection work. These controlled injections exercise the
 // state observed after a possible lock wait; they do not claim a multi-session
 // PostgreSQL scheduling proof. A denied RPC rolls back its injected mutation.
 await admin();
 const lockDefinition=(await one("select pg_get_functiondef('fets_outreach_private.lock_authority(uuid)'::regprocedure) definition")).definition;
 for(const mutation of [
  `update public.staff_profiles set is_active=false where user_id=auth.uid();`,
  `update fets_outreach_private.institutes set owner_user_id='${ids.other}' where id='${i.id}';`,
 ]){
  await db.exec(lockDefinition.replace('return fets_outreach_private.authority();',`perform fets_outreach_private.authority();${mutation}return false;`));
  await as('owner');
  await denied(()=>saveC(call(i)));
  await denied(()=>saveI({...institute(),id:i.id,expected_updated_at:i.updated_at}));
  await denied(()=>saveB(batch(i.id,{name:'Injected denied cohort'})));
  await admin();await db.exec(lockDefinition);
 }
 assert.equal((await one("select pg_get_functiondef('fets_outreach_private.lock_authority(uuid)'::regprocedure) definition")).definition,lockDefinition);
 await as('owner');
 const contenders=await Promise.allSettled([
  saveC(call(i,{summary:'Concurrent version A'})),
  saveC(call(i,{summary:'Concurrent version B'})),
 ]);
 assert.equal(contenders.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(contenders.filter(r=>r.status==='rejected').length,1);
 i=contenders.find(r=>r.status==='fulfilled').value.institute;
 let concurrentFollowup=(await detail(i.id)).followups.find(f=>f.status==='open');
 const followupContenders=await Promise.allSettled([updateF(concurrentFollowup),updateF(concurrentFollowup,{status:'cancelled',note:'Duplicate completion contender'})]);
 assert.equal(followupContenders.filter(r=>r.status==='fulfilled').length,1);
 const replayInput=call(i,{summary:'Two exact retries'});
 const replays=await Promise.all([saveC(replayInput),saveC(replayInput)]);
 assert.deepEqual(replays[0],replays[1]);i=replays[0].institute;
 const cohortContenders=await Promise.allSettled([saveB(batch(i.id,{name:'Concurrent cohort'})),saveB(batch(i.id,{name:' Concurrent   COHORT '}))]);
 assert.equal(cohortContenders.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(cohortContenders.filter(r=>r.status==='rejected').length,1);
 console.log('PASS authority/reassignment rechecks after injected wait boundary, competing CAS saves, exact request replay and duplicate cohort creates');
 // Equal occurred_at values exercise tuple ordering; no duplicates or skips across pages.
 for(let n=0;n<55;n++){receipt=await saveC(call(i,{channel:'note',summary:`Pagination synthetic note ${n}`,next_step:null,close_reason:'History note only'}));i=receipt.institute;}
 const first=await detail(i.id);assert.equal(first.calls.length,50);assert.equal(first.has_more,true);assert.ok(first.next_cursor);
 const second=await detail(i.id,first.next_cursor.at,first.next_cursor.id);assert.equal(second.has_more,false);assert.equal(new Set([...first.calls,...second.calls].map(c=>c.id)).size,first.calls.length+second.calls.length);
 assert.equal(second.next_cursor,null);await assert.rejects(()=>detail(i.id,first.next_cursor.at,null));
 await admin();
 assert.deepEqual(await business(),before,'all legacy business rows, helper definitions and triggers unchanged');
 const funcs=await q("select n.nspname,p.proname,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='fets_outreach_private' or n.nspname='public' and p.proname like 'outreach_%'");
 for(const fn of funcs){assert.ok(fn.proconfig?.includes('search_path=""'));if(fn.nspname==='public')assert.equal(fn.prosecdef,false);}
 for(const table of ['institutes','calls','followups','batches','institute_changes']){assert.equal((await one('select relrowsecurity from pg_class where oid=$1::regclass',[`fets_outreach_private.${table}`])).relrowsecurity,true);for(const role of ['anon','authenticated','service_role'])assert.equal((await one("select has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE') allowed",[role,`fets_outreach_private.${table}`])).allowed,false);}
 const privateFunctions=await q("select p.oid::regprocedure::text signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='fets_outreach_private'");
 for(const fn of privateFunctions)for(const role of ['anon','authenticated','service_role'])assert.equal((await one("select has_function_privilege($1,$2,'EXECUTE') allowed",[role,fn.signature])).allowed,role==='authenticated'&&['context','detail','save_institute','record_call','save_batch','update_followup'].includes(fn.proname));
 for(const name of ['outreach_context()','outreach_detail(uuid,timestamp with time zone,uuid)','outreach_save_institute(jsonb)','outreach_record_call(jsonb)','outreach_save_batch(jsonb)','outreach_update_followup(jsonb)'])for(const role of ['anon','authenticated','service_role'])assert.equal((await one("select has_function_privilege($1,$2,'EXECUTE') allowed",[role,'public.'+name])).allowed,role==='authenticated');
 console.log('PASS DNC restoration, revocation, reassignment, stable pagination, fixed paths, RLS, minimal grants and unchanged legacy fingerprints');
 console.log('PASS all Prometric outreach database checks');
}catch(error){console.error(error.stack);process.exitCode=1;}finally{await db.close();}
