import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const { PGlite } = await import(
  process.env.PGLITE_MODULE || "@electric-sql/pglite"
);
const db = new PGlite();
let count = 0;
await db.exec(`create role anon;create role authenticated;create schema auth;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_app_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
create table public.staff_profiles(id uuid primary key,user_id uuid references auth.users,role text,is_active boolean);
create table public.centres(id uuid primary key default gen_random_uuid(),name text unique,status text,sort_order integer);
create table public.clients(id uuid primary key default gen_random_uuid(),name text);
create table public.compliance_items(id uuid primary key default gen_random_uuid(),title text,centre_id uuid references centres,lead_days integer default 30,active boolean default true,updated_at timestamptz default now());
alter table public.compliance_items enable row level security;create policy anon_all_compliance on public.compliance_items for all using(true) with check(true);
insert into centres(name,status,sort_order) values('Calicut Centre','live',2),('Cochin Centre','live',1),('Kannur Centre','planned',4),('Mangalore Centre','launching',3);
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values('11111111-1111-4111-8111-111111111111','mithun@fets.in',now(),'{}'),('22222222-2222-4222-8222-222222222222','fake@example.test',now(),'{}'),('33333333-3333-4333-8333-333333333333','admin@example.test',now(),'{"role":"admin"}');
insert into staff_profiles select id,id,case when email like 'admin%' then 'admin' else 'super_admin' end,true from auth.users;
insert into clients(name) values('Fixture partner');`);
await db.exec(
  await readFile(
    "supabase/migrations/20261024203812_ascender_centre_administration.sql",
    "utf8",
  ),
);
const scalar = async (sql, args = []) =>
  Object.values((await db.query(sql, args)).rows[0])[0];
const check = (v, msg) => {
  assert.ok(v, msg);
  count++;
};
const reject = async (sql, msg) => {
  await assert.rejects(db.exec(sql), undefined, msg);
  count++;
};
check(
  (await scalar("select count(*)::int from centres")) === 5,
  "historical centres retained",
);
check(
  (await scalar("select count(*)::int from ascender_centres")) === 3,
  "exact three current centres",
);
const c = await scalar("select id from ascender_centres where code='calicut'"),
  m = await scalar("select id from ascender_centres where code='mobile'"),
  client = await scalar("select id from clients limit 1");
await db.exec("set role anon");
await reject("select * from ascender_centres", "anon no access");
await reject("select public.ascender_capabilities()", "anon cannot inspect");
await db.exec(
  "reset role;set role authenticated;select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false)",
);
check(
  (await scalar("select public.ascender_capabilities()")) === false,
  "profile role alone cannot elevate",
);
check(
  (await scalar("select count(*)::int from ascender_centres")) === 0,
  "unauthorised reads denied",
);
await reject(
  `insert into ascender_rooms(centre_id,name,total_seats) values('${c}','Intrusion',4)`,
  "unauthorised write denied",
);
await db.exec(
  "select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false)",
);
check(
  (await scalar("select public.ascender_capabilities()")) === true,
  "legacy verified admin allowed",
);
await db.exec(
  `insert into ascender_rooms(centre_id,name,total_seats,unavailable_seats) values('${c}','Room A',20,2)`,
);
const room = await scalar("select id from ascender_rooms limit 1");
check(
  (await scalar("select count(*)::int from ascender_history")) === 1,
  "insert audited",
);
await reject(
  `update ascender_rooms set unavailable_seats=21 where id='${room}'`,
  "invalid capacity rejected",
);
await db.exec(
  `update ascender_rooms set unavailable_seats=3 where id='${room}' and version=1`,
);
check(
  (await scalar("select version from ascender_rooms")) === 2,
  "version increments",
);
check(
  (
    await db.query(
      `update ascender_rooms set unavailable_seats=4 where id='${room}' and version=1 returning id`,
    )
  ).rows.length === 0,
  "stale edit cannot overwrite",
);
await reject(
  `update ascender_rooms set centre_id='${m}' where id='${room}'`,
  "cannot move records",
);
await reject(
  `update ascender_rooms set id=gen_random_uuid() where id='${room}'`,
  "cannot change identity",
);
await reject(
  `delete from ascender_rooms where id='${room}'`,
  "no destructive delete",
);
await db.exec(`update ascender_rooms set archived=true where id='${room}'`);
check(
  (await scalar("select count(*)::int from ascender_history")) === 3,
  "archive audited",
);
await reject(
  `insert into ascender_programmes(centre_id,client_id,programme,approval) values('${c}','${client}','Exam','approved')`,
  "approval needs evidence",
);
await db.exec(
  `insert into ascender_programmes(centre_id,client_id,programme,approval,site_code,approved_capacity,evidence_url) values('${c}','${client}','Exam','approved','CODE',20,'https://example.test/document')`,
);
await db.exec(
  `insert into compliance_items(title,centre_id) values('Renewal','${c}')`,
);
const renewal = await scalar("select id from compliance_items limit 1");
await reject(
  `insert into ascender_documents(centre_id,title,url,compliance_id) values('${m}','Mismatch','https://example.test/file','${renewal}')`,
  "document renewal cannot cross centres",
);
await reject(
  `insert into ascender_documents(centre_id,title,url) values('${c}','Unsafe','javascript:alert(1)')`,
  "unsafe document URL rejected",
);
await reject(
  `insert into ascender_deployments(centre_id,venue,start_date,end_date,setup_due) values('${c}','Venue','2026-11-01','2026-11-03','2026-10-31')`,
  "only mobile deployments",
);
await reject(
  `insert into ascender_deployments(centre_id,venue,start_date,end_date,setup_due,readiness) values('${m}','Venue','2026-11-01','2026-11-03','2026-10-31','confirmed')`,
  "readiness requires accountable evidence",
);
await db.exec(
  `insert into ascender_deployments(centre_id,venue,start_date,end_date,setup_due,readiness,lead_id,required_seats,readiness_note) values('${m}','Venue','2026-11-01','2026-11-03','2026-10-31','confirmed','11111111-1111-4111-8111-111111111111',20,'Reviewed actual venue evidence')`,
);
check(
  (await scalar("select confirmed_by::text from ascender_deployments")) ===
    "11111111-1111-4111-8111-111111111111",
  "confirmation attributed by server",
);
await reject(
  "update ascender_deployments set status='closed'",
  "close requires handover",
);
await reject(
  "update ascender_deployments set end_date='2026-10-01'",
  "invalid dates rejected",
);
await reject(
  "update ascender_history set after_data='{}'",
  "audit cannot be edited",
);
await db.exec(
  "select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false)",
);
check(
  (await scalar("select public.ascender_capabilities()")) === true,
  "trusted admin allowed",
);
await db.exec(
  "reset role;update staff_profiles set is_active=false where user_id='33333333-3333-4333-8333-333333333333';set role authenticated",
);
check(
  (await scalar("select public.ascender_capabilities()")) === false,
  "inactive admin denied",
);
console.log(
  `PASS: ${count} isolated centre administration checks; no production fixtures.`,
);
await db.close();
