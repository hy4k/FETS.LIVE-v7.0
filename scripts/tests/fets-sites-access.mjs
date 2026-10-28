// Disposable local database only: no staff identities or site records in production.
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const { PGlite } = await import(
  process.env.FETS_PGLITE_MODULE || "@electric-sql/pglite"
);
const db = new PGlite();
let passed = 0;
const uid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
const role = async (n = 2, name = "authenticated") => {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    n ? uid(n) : "",
  ]);
  await db.exec(`set role ${name}`);
};
const check = async (name, fn) => {
  await fn();
  passed++;
  console.log("PASS", name);
};
const caps = async () =>
  (await one("select ascender_capabilities() allowed")).allowed;
try {
  await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 create table staff_profiles(id uuid primary key,user_id uuid references auth.users,role text,is_active boolean,permissions jsonb);
 create table centres(id uuid primary key default gen_random_uuid(),name text unique,status text,sort_order integer);
 create table clients(id uuid primary key default gen_random_uuid(),name text);
 create table compliance_items(id uuid primary key default gen_random_uuid(),title text,centre_id uuid references centres,lead_days integer default 30,active boolean default true,updated_at timestamptz default now());
 alter table compliance_items enable row level security;create policy anon_all_compliance on compliance_items for all using(true) with check(true);
 insert into centres(name,status,sort_order) values('Calicut Centre','live',2),('Cochin Centre','live',1),('Kannur Centre','planned',4),('Mangalore Centre','launching',3);
 insert into clients(name)values('Example client');
 grant select on staff_profiles,clients to authenticated;
 `);
  const profiles = [
    [1, "super_admin", true, { "ws_system-manager": true }, true],
    [2, "fetsian", true, { "ws_system-manager": true }, true],
    [3, "fetsian", true, {}, true],
    [4, "admin", true, { "ws_system-manager": false }, true],
    [5, "fetsian", false, { "ws_system-manager": true }, true],
    [6, "fetsian", true, { "ws_system-manager": true }, false],
    [7, "fetsian", true, { "ws_system-manager": false }, true],
    [8, "fetsian", true, { "ws_system-manager": "false" }, true],
  ];
  for (const [n, staffRole, active, permissions, confirmed] of profiles) {
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at)values($1,$2,$3)",
      [
        uid(n),
        n === 1 ? "mithun@fets.in" : `example${n}@example.test`,
        confirmed ? "2026-01-01" : null,
      ],
    );
    await db.query("insert into staff_profiles values($1,$1,$2,$3,$4)", [
      uid(n),
      staffRole,
      active,
      permissions,
    ]);
  }
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at)values($1,$2,now())",
    [uid(9), "not-staff@example.test"],
  );
  await db.exec(
    await readFile(
      new URL(
        "../../supabase/migrations/20261024203812_ascender_centre_administration.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const before = (
    await one(
      "select md5(jsonb_agg(to_jsonb(s) order by id)::text) checksum from staff_profiles s",
    )
  ).checksum;
  await check(
    "reproduces enabled staff denied by the original admin-only gate",
    async () => {
      await role(2);
      assert.equal(await caps(), false);
      assert.equal(
        (await one("select count(*)::int n from ascender_centres")).n,
        0,
      );
    },
  );
  await db.exec("reset role");
  await db.exec(
    await readFile(
      new URL(
        "../../supabase/migrations/20261028043206_fets_sites_staff_access.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await check(
    "migration preserves profiles, centre records and roles",
    async () => {
      assert.equal(
        (
          await one(
            "select md5(jsonb_agg(to_jsonb(s) order by id)::text) checksum from staff_profiles s",
          )
        ).checksum,
        before,
      );
      assert.equal((await one("select count(*)::int n from centres")).n, 5);
      assert.equal(
        (await one("select count(*)::int n from ascender_centres")).n,
        3,
      );
      assert.equal(
        (await one("select count(*)::int n from ascender_history")).n,
        0,
      );
    },
  );
  await check(
    "anonymous and missing-identity requests remain blocked",
    async () => {
      await role(0, "anon");
      await assert.rejects(
        one("select ascender_capabilities()"),
        /permission denied/,
      );
      await assert.rejects(
        one("select * from ascender_centres"),
        /permission denied/,
      );
      await role(0);
      assert.equal(await caps(), false);
      await role(9);
      assert.equal(await caps(), false);
    },
  );
  await check(
    "ordinary enabled staff open all three sites without administrator JWT claims",
    async () => {
      await role(2);
      assert.equal(await caps(), true);
      assert.equal(
        (await one("select count(*)::int n from ascender_centres")).n,
        3,
      );
    },
  );
  await check(
    "default staff access matches the Home and User Management default",
    async () => {
      await role(3);
      assert.equal(await caps(), true);
      await role(8);
      assert.equal(await caps(), true);
    },
  );
  await check(
    "explicit off switches apply to staff and administrators",
    async () => {
      for (const n of [4, 7]) {
        await role(n);
        assert.equal(await caps(), false);
        assert.equal(
          (await one("select count(*)::int n from ascender_centres")).n,
          0,
        );
      }
    },
  );
  await check(
    "inactive and unconfirmed accounts remain blocked even when enabled",
    async () => {
      for (const n of [5, 6]) {
        await role(n);
        assert.equal(await caps(), false);
      }
    },
  );
  await check(
    "editable user metadata cannot override a management off switch",
    async () => {
      await db.exec("reset role");
      await db.query(
        "update auth.users set raw_user_meta_data=$1 where id=$2",
        [{ role: "super_admin", "ws_system-manager": true }, uid(7)],
      );
      await role(7);
      assert.equal(await caps(), false);
    },
  );
  let centre, room;
  await check(
    "enabled staff save site details and rooms with real actor attribution",
    async () => {
      await role(2);
      centre = (
        await one("select id from ascender_centres where code='calicut'")
      ).id;
      await db.query("update ascender_centres set notes=$1 where id=$2", [
        "Local test note",
        centre,
      ]);
      room = (
        await one(
          "insert into ascender_rooms(centre_id,name,total_seats)values($1,'Example room',12)returning id",
          [centre],
        )
      ).id;
      const history = await one(
        "select actor_id from ascender_history where table_name='ascender_rooms'",
      );
      assert.equal(history.actor_id, uid(2));
    },
  );
  await check(
    "enabled staff can use renewals, and existing evidence constraints remain",
    async () => {
      await db.query(
        "insert into compliance_items(title,centre_id)values('Local renewal',$1)",
        [centre],
      );
      const renewal = (await one("select * from compliance_items")).id;
      await db.query(
        "insert into ascender_documents(centre_id,title,url,compliance_id)values($1,'Example evidence','https://example.test/evidence',$2)",
        [centre, renewal],
      );
      await assert.rejects(
        db.query(
          "insert into ascender_programmes(centre_id,client_id,programme,approval)select $1,id,'Example programme','approved' from clients",
          [centre],
        ),
        /check constraint/,
      );
    },
  );
  await check(
    "concurrent edit protection and history immutability remain",
    async () => {
      await db.query(
        "update ascender_rooms set unavailable_seats=1 where id=$1 and version=1",
        [room],
      );
      assert.equal(
        (
          await db.query(
            "update ascender_rooms set unavailable_seats=2 where id=$1 and version=1 returning id",
            [room],
          )
        ).rows.length,
        0,
      );
      await assert.rejects(
        db.query("delete from ascender_rooms where id=$1", [room]),
        /permission denied/,
      );
      await assert.rejects(
        db.query("update ascender_history set after_data='{}'"),
        /permission denied/,
      );
    },
  );
  await check(
    "revoking Sites access blocks data reads and writes immediately",
    async () => {
      await db.exec("reset role");
      await db.query("update staff_profiles set permissions=$1 where id=$2", [
        { "ws_system-manager": false },
        uid(2),
      ]);
      await role(2);
      assert.equal(await caps(), false);
      for (const table of [
        "ascender_centres",
        "ascender_rooms",
        "ascender_programmes",
        "ascender_documents",
        "ascender_deployments",
        "compliance_items",
        "ascender_history",
      ])
        assert.equal((await one(`select count(*)::int n from ${table}`)).n, 0);
      await assert.rejects(
        db.query(
          "insert into ascender_rooms(centre_id,name,total_seats)values($1,'Blocked',1)",
          [centre],
        ),
        /requires an active authorised admin|row-level security/,
      );
    },
  );
  await check(
    "Sites access does not grant profile or Auth administration",
    async () => {
      await role(3);
      await assert.rejects(
        db.query("update staff_profiles set permissions='{}'"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select * from auth.users"),
        /permission denied/,
      );
    },
  );
  console.log(`${passed} isolated FETS Sites access checks passed`);
} finally {
  await db.close();
}
