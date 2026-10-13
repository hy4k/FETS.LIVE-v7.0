// Disposable PostgreSQL checks. Never connects to production.
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const { PGlite } = await import(
  process.env.FETS_PGLITE_MODULE || "@electric-sql/pglite"
);
const db = new PGlite();
const uid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const pid = (n) => uid(100 + n);
let passed = 0;
const check = async (label, fn) => {
  await fn();
  passed++;
  console.log("PASS " + label);
};
async function as(n, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    n ? uid(n) : "",
  ]);
  await db.exec("set role " + role);
}
const denied = async (sql, args = []) =>
  assert.rejects(
    db.query(sql, args),
    /permission denied|Active staff|Management|management|Sign in|row-level security/,
  );
const migration = (f) =>
  readFile(new URL("../../supabase/migrations/" + f, import.meta.url), "utf8");
try {
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table auth.users(id uuid primary key);grant usage on schema auth to anon,authenticated,service_role;
 create table staff_profiles(id uuid primary key,user_id uuid,full_name text,is_active boolean,role text,permissions jsonb not null default '{}');
 create function public.fets_is_active_staff() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.staff_profiles where user_id=auth.uid() and is_active)$$;
 grant select on staff_profiles to authenticated;
 create type test_district as enum('Kottayam','Ernakulam','Thrissur','Calicut','Kannur');
 create type test_stage as enum('identified','contacted','audit_in_progress','mou_review','pearson_approved');
 create table expansion_institutions(id uuid primary key default gen_random_uuid(),name text not null,district test_district not null,address text,primary_contact_name text,primary_contact_role text,primary_contact_phone text,primary_contact_email text,lab_seat_capacity integer,stage test_stage not null default 'identified',notes text,created_at timestamptz default now());
 create table expansion_activity_logs(id uuid primary key default gen_random_uuid());
 create publication supabase_realtime;
 create table mission_work_items(id uuid primary key default gen_random_uuid(),institution_id uuid references expansion_institutions(id) on delete set null,title text not null,district text,owner_id uuid references staff_profiles(id),due_date date,status text not null default 'open',blocker text,created_by uuid not null default auth.uid(),created_at timestamptz default now(),impact text);
 alter table expansion_institutions enable row level security;create policy old_institutions on expansion_institutions for all to authenticated using(fets_is_active_staff()) with check(fets_is_active_staff());
 alter table mission_work_items enable row level security;create policy old_work on mission_work_items for all to authenticated using(fets_is_active_staff()) with check(fets_is_active_staff());
 grant select,insert,update,delete on expansion_institutions,mission_work_items to authenticated;
 alter default privileges in schema public grant all on tables to authenticated,anon;`);
  for (let n = 1; n <= 3; n++) {
    await db.query("insert into auth.users values($1)", [uid(n)]);
    await db.query(
      "insert into staff_profiles(id,user_id,full_name,is_active,role) values($1,$2,$3,$4,$5)",
      [pid(n), uid(n), "Account " + n, n !== 3, n === 2 ? "fetsian" : "admin"],
    );
  }
  await db.exec(
    await migration("20261001220000_simple_institution_actionables.sql"),
  );
  await as(2);
  const legacy = (
    await db.query(
      "insert into expansion_institutions(name,district,notes) values('RIT KOTTAYAM','Kottayam','Existing legitimate work') returning *",
    )
  ).rows[0];
  const existing = (
    await db.query(
      "insert into mission_work_items(institution_id,title,owner_id,due_date) values($1,'Preserved assignment',$2,'2026-10-13') returning *",
      [legacy.id, pid(2)],
    )
  ).rows[0];
  await db.query(
    "insert into mission_task_updates(work_item_id,content,status) values($1,'Existing result remains intact','in_progress')",
    [existing.id],
  );
  const baseline = (
    await db.query(
      "select to_jsonb(t) as row from mission_work_items t where id=$1",
      [existing.id],
    )
  ).rows[0].row;
  await as(null, "postgres");
  await db.exec(
    await migration("20261013211421_actionable_rollout_and_readiness.sql"),
  );
  await db.exec(
    await migration("20261013211431_import_supplied_actionables_catalogue.sql"),
  );
  const source = JSON.parse(
    await readFile(
      new URL(
        "../../fets-point/src/test/actionables-reference.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await check(
    "existing institution, assignment and result are preserved",
    async () => {
      const kept = (
        await db.query(
          "select to_jsonb(t)-array['source_team','reference_task_key'] as row from mission_work_items t where id=$1",
          [existing.id],
        )
      ).rows[0].row;
      assert.deepEqual(kept, baseline);
      assert.equal(
        (
          await db.query(
            "select notes from expansion_institutions where id=$1",
            [legacy.id],
          )
        ).rows[0].notes,
        legacy.notes,
      );
      assert.equal(
        (await db.query("select count(*)::int as n from mission_task_updates"))
          .rows[0].n,
        1,
      );
    },
  );
  const catalogue = (
    await db.query(
      "select * from expansion_institutions where actionables_reference is not null",
    )
  ).rows;
  await check(
    "all 25 supplied institutions import with exact source snapshots",
    async () => {
      assert.equal(catalogue.length, 25);
      for (const row of catalogue) {
        const actual = source.institutions.find(
          (i) => i.id === row.actionables_reference.id,
        );
        assert.deepEqual(row.actionables_reference, actual);
        assert.equal(row.primary_contact_phone, actual.phone);
        assert.equal(row.lab_seat_capacity, parseInt(actual.capacity, 10));
        if (actual.status === "Certified")
          assert.equal(row.stage, "pearson_approved");
      }
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from expansion_institutions",
          )
        ).rows[0].n,
        26,
      );
    },
  );
  await check(
    "source percentages and completed team tasks do not fabricate operational checks or authors",
    async () => {
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from mission_readiness_observations",
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from mission_institution_stages where completed_at is not null",
          )
        ).rows[0].n,
        0,
      );
      assert.deepEqual(
        (await db.query("select tasks from mission_project_brief")).rows[0]
          .tasks,
        source.tasks,
      );
      assert.equal(
        (await db.query("select count(*)::int as n from mission_work_items"))
          .rows[0].n,
        1,
      );
    },
  );
  await check(
    "client grants cannot truncate, update or delete the new histories or project brief",
    async () => {
      await as(2);
      for (const table of [
        "mission_rollout_selections",
        "mission_readiness_observations",
        "mission_project_brief",
      ]) {
        for (const op of [
          "UPDATE",
          "DELETE",
          "TRUNCATE",
          "TRIGGER",
          "REFERENCES",
        ])
          assert.equal(
            (
              await db.query(
                "select has_table_privilege('authenticated',$1,$2) as allowed",
                ["public." + table, op],
              )
            ).rows[0].allowed,
            false,
          );
        await denied("truncate public." + table);
      }
    },
  );
  const institution = catalogue[0].id;
  let observation;
  await check(
    "active staff record observations with their actual identity and server time",
    async () => {
      observation = (
        await db.query(
          "insert into mission_readiness_observations(institution_id,criterion,state,evidence,observed_by,created_at) values($1,'c1','gap','The current installation needs a licensed clean image',$2,'2099-01-01') returning *",
          [institution, pid(1)],
        )
      ).rows[0];
      assert.equal(observation.observed_by, pid(2));
      assert.notEqual(new Date(observation.created_at).getUTCFullYear(), 2099);
    },
  );
  await check(
    "readiness requires evidence and does not silently replace newer observations",
    async () => {
      await assert.rejects(
        db.query(
          "insert into mission_readiness_observations(institution_id,criterion,state,evidence) values($1,'c1','ready','Ready now')",
          [institution],
        ),
        /changed|check constraint/,
      );
      await assert.rejects(
        db.query(
          "insert into mission_readiness_observations(institution_id,criterion,state,evidence,previous_id) values($1,'c1','ready','No',$2)",
          [institution, observation.id],
        ),
        /check constraint/,
      );
      const next = (
        await db.query(
          "insert into mission_readiness_observations(institution_id,criterion,state,evidence,previous_id) values($1,'c1','ready','Licensed clean image installed and checked',$2) returning *",
          [institution, observation.id],
        )
      ).rows[0];
      assert.equal(next.previous_id, observation.id);
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from mission_readiness_observations",
          )
        ).rows[0].n,
        2,
      );
    },
  );
  await check(
    "staff cannot choose the shortlist or forge a management actor",
    async () => {
      await denied(
        "insert into mission_rollout_selections(institution_id,selected,selected_by) values($1,true,$2)",
        [institution, pid(1)],
      );
    },
  );
  let first;
  await check(
    "management can shortlist seven institutions and an eighth is rejected",
    async () => {
      await as(1);
      for (const [n, i] of catalogue.slice(0, 7).entries()) {
        const row = (
          await db.query(
            "insert into mission_rollout_selections(institution_id,selected,selected_by) values($1,true,$2) returning *",
            [i.id, pid(2)],
          )
        ).rows[0];
        assert.equal(row.selected_by, pid(1));
        if (n === 0) first = row;
      }
      await assert.rejects(
        db.query(
          "insert into mission_rollout_selections(institution_id,selected) values($1,true)",
          [catalogue[7].id],
        ),
        /Seven institutions/,
      );
    },
  );
  await check(
    "shortlist changes retain decisions and reject a stale previous decision",
    async () => {
      await assert.rejects(
        db.query(
          "insert into mission_rollout_selections(institution_id,selected) values($1,false)",
          [institution],
        ),
        /shortlist changed/,
      );
      await db.query(
        "insert into mission_rollout_selections(institution_id,selected,previous_id) values($1,false,$2)",
        [institution, first.id],
      );
      await db.query(
        "insert into mission_rollout_selections(institution_id,selected) values($1,true)",
        [catalogue[7].id],
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from mission_rollout_selections",
          )
        ).rows[0].n,
        9,
      );
    },
  );
  await check(
    "inactive and anonymous accounts cannot access shared project records",
    async () => {
      await as(3);
      assert.equal(
        (await db.query("select fets_actionables_capabilities() as caps"))
          .rows[0].caps.manage,
        false,
      );
      assert.equal(
        (await db.query("select * from mission_rollout_selections")).rows
          .length,
        0,
      );
      assert.equal(
        (await db.query("select * from mission_readiness_observations")).rows
          .length,
        0,
      );
      assert.equal(
        (await db.query("select * from mission_project_brief")).rows.length,
        0,
      );
      await denied(
        "insert into mission_readiness_observations(institution_id,criterion,state,evidence) values($1,'c2','gap','A gap observed in the equipment')",
        [institution],
      );
      await as(null, "anon");
      await denied("select * from mission_project_brief");
      await denied("select fets_actionables_capabilities()");
    },
  );
  await check(
    "supplied snapshots stay immutable while ordinary contact edits work",
    async () => {
      await as(2);
      await assert.rejects(
        db.query(
          "update expansion_institutions set actionables_reference='{}' where id=$1",
          [institution],
        ),
        /reference intact/,
      );
      await db.query("update expansion_institutions set notes=$2 where id=$1", [
        institution,
        "Call the published office number after 10am",
      ]);
      await assert.rejects(
        db.query("delete from expansion_institutions where id=$1", [
          institution,
        ]),
        /Management removes/,
      );
    },
  );
  await check(
    "linking a source task preserves its team and institution identity",
    async () => {
      const rajagiri = catalogue.find(
        (i) => i.actionables_reference.id === "cochin-rajagiri",
      );
      const linked = (
        await db.query(
          "insert into mission_work_items(institution_id,title,owner_id,reference_task_key,source_team) values($1,$2,$3,1,'Forged team') returning *",
          [rajagiri.id, source.tasks[0].title, pid(2)],
        )
      ).rows[0];
      assert.equal(linked.source_team, "Scout Squad");
      await assert.rejects(
        db.query(
          "update mission_work_items set reference_task_key=2 where id=$1",
          [linked.id],
        ),
        /source identity/,
      );
      await assert.rejects(
        db.query(
          "insert into mission_work_items(institution_id,title,reference_task_key) values($1,'Wrong institution',2)",
          [rajagiri.id],
        ),
        /recorded institution/,
      );
    },
  );
  await check(
    "assigning named ownership keeps the supplied in-progress state",
    async () => {
      const vidya = catalogue.find(
        (i) => i.actionables_reference.id === "thrissur-vidya",
      );
      const linked = (
        await db.query(
          "insert into mission_work_items(institution_id,title,owner_id,reference_task_key,status) values($1,$2,$3,2,'open') returning *",
          [vidya.id, source.tasks[1].title, pid(2)],
        )
      ).rows[0];
      assert.equal(linked.status, "in_progress");
      assert.equal(linked.source_team, "Tech Audit Squad");
    },
  );
  await check(
    "browser profile edits cannot grant management or change another staff identity",
    async () => {
      await as(null, "postgres");
      await db.exec(
        "grant insert,update,delete on staff_profiles to authenticated;grant select,update on staff_profiles to anon",
      );
      await as(2);
      await denied("update staff_profiles set role='admin' where id=$1", [
        pid(2),
      ]);
      await denied(
        `update staff_profiles set permissions='{"staff_edit":true}' where id=$1`,
        [pid(2)],
      );
      await denied(
        "update staff_profiles set full_name='Forged manager' where id=$1",
        [pid(1)],
      );
      await db.query(
        "update staff_profiles set full_name='Updated own name' where id=$1",
        [pid(2)],
      );
      assert.equal(
        (await db.query("select fets_actionables_can_manage() as manager"))
          .rows[0].manager,
        false,
      );
      assert.equal(
        (await db.query("select fets_actionables_capabilities() as caps"))
          .rows[0].caps.name,
        "Updated own name",
      );
      await as(null, "anon");
      await denied("update staff_profiles set role='admin' where id=$1", [
        pid(2),
      ]);
    },
  );
  await check(
    "unapproved signups cannot read the imported project or its work",
    async () => {
      await as(null, "postgres");
      await db.query("insert into auth.users values($1)", [uid(4)]);
      await as(4);
      await db.query(
        "insert into staff_profiles(id,user_id,full_name,is_active,role) values($1,$2,'Pending account',true,'fetsian')",
        [pid(4), uid(4)],
      );
      assert.equal(
        (await db.query("select fets_is_active_staff() as legacy_active"))
          .rows[0].legacy_active,
        true,
      );
      assert.equal(
        (await db.query("select fets_actionables_capabilities() as caps"))
          .rows[0].caps.rollout,
        false,
      );
      assert.equal(
        (
          await db.query(
            "select * from expansion_institutions where actionables_reference is not null",
          )
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await db.query(
            "select * from mission_work_items where institution_id=$1",
            [institution],
          )
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await db.query(
            "select * from mission_institution_stages where institution_id=$1",
            [institution],
          )
        ).rows.length,
        0,
      );
      await denied("update staff_profiles set role='admin' where id=$1", [
        pid(4),
      ]);
    },
  );
  await check(
    "approved lifecycle changes provision and revoke project access",
    async () => {
      await as(1);
      await db.query(
        "update staff_profiles set role='fetsian',is_active=true where id=$1",
        [pid(4)],
      );
      await as(4);
      assert.equal(
        (await db.query("select fets_actionables_capabilities() as caps"))
          .rows[0].caps.rollout,
        true,
      );
      await as(1);
      await db.query("update staff_profiles set is_active=false where id=$1", [
        pid(4),
      ]);
      await as(4);
      assert.equal(
        (await db.query("select fets_actionables_capabilities() as caps"))
          .rows[0].caps.rollout,
        false,
      );
      await denied("update staff_profiles set is_active=true where id=$1", [
        pid(4),
      ]);
    },
  );
  await check(
    "management can remove a catalogue institution through the existing deletion workflow",
    async () => {
      await as(1);
      await db.query("select mission_delete_institution($1)", [institution]);
      assert.equal(
        (
          await db.query("select * from expansion_institutions where id=$1", [
            institution,
          ])
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from expansion_institutions where id=$1",
            [legacy.id],
          )
        ).rows[0].n,
        1,
      );
    },
  );
  console.log(`${passed} Actionables database checks passed.`);
} catch (error) {
  console.error("FAIL " + error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
