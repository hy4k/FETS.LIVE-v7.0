// Run the exact assistant migration in isolated PostgreSQL; never touches Supabase.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();
const q=(sql,args=[])=>db.query(sql,args);
const users=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004'];
const [admin,cochin,calicut,outsider]=users;
const as=id=>db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${id}';`);
const denied=(sql,args,pattern)=>assert.rejects(q(sql,args),pattern);
try {
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
    create table public.staff_profiles(id uuid primary key,user_id uuid,full_name text,branch_assigned text,role text,is_active boolean,permissions jsonb);
    create table public.roster_schedules(profile_id uuid,date date,shift_code text,branch_location text);
    grant select on public.staff_profiles,public.roster_schedules to authenticated;`);
  for(const [i,id] of users.entries()){
    await q('insert into auth.users values($1)',[id]);
    await q('insert into staff_profiles values($1,$1,$2,$3,$4,true,\'{}\')',[id,`Staff ${i}`,i===0?'global':i===1?'cochin':i===2?'calicut':'',i===0?'super_admin':'staff']);
  }
  await db.exec(readFileSync(new URL('../../supabase/migrations/20260929091547_centre_duty_planning.sql',import.meta.url),'utf8'));
  if(process.env.FETS_AI_LEGACY_SQL){
    await db.exec(readFileSync(process.env.FETS_AI_LEGACY_SQL,'utf8'));
    await as(admin);
    await q("insert into sita_documents(title,content,branch) values('Legacy approved guide','This previously approved document must survive renaming.','cochin')");
    await db.exec('reset role');
  }
  await db.exec(readFileSync(new URL('../../supabase/migrations/20260929171645_fets_ai_knowledge_and_usage.sql',import.meta.url),'utf8'));
  await as(admin);
  const published=(await q("insert into fets_ai_documents(title,content,branch) values('Front office guide','Check the centre opening log and then confirm the roster.','cochin') returning id,version,updated_by")).rows[0];
  assert.equal(published.version,1);assert.equal(published.updated_by,admin);
  await q("insert into fets_ai_documents(title,content,branch) values('All-centre guide','Every report needs a named owner for open follow-ups.','*')");
  const version=(await q("update fets_ai_documents set content='Updated opening log procedure approved by the centre.' where id=$1 returning version",[published.id])).rows[0].version;
  assert.equal(version,2);
  await as(cochin);
  assert.equal((await q('select count(*)::int as n from fets_ai_documents')).rows[0].n,process.env.FETS_AI_LEGACY_SQL?3:2);
  await denied("insert into fets_ai_documents(title,content,branch) values('Forged guide','Staff must not publish unapproved guides.','cochin')",[],/row-level security/);
  assert.equal((await q("select fets_ai_reserve_usage('chat') as id")).rows.length,1);
  await as(calicut);
  assert.equal((await q('select count(*)::int as n from fets_ai_documents')).rows[0].n,1);
  await as(outsider);
  assert.equal((await q('select count(*)::int as n from fets_ai_documents')).rows[0].n,0);
  await denied("select fets_ai_reserve_usage('chat')",[],/trusted staff membership/);
  await db.exec('reset role;set role anon;');
  await denied('select * from fets_ai_documents',[],/permission denied/);
  await denied("select fets_ai_reserve_usage('chat')",[],/permission denied/);
  console.log('Passed assistant PostgreSQL checks: scoped documents, admin publication, versioning, membership, quota RPC and anonymous denial.');
} finally { await db.close(); }
