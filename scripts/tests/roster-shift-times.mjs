// Disposable database only; no production attendance or schedules are created.
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const { PGlite } = await import(
  process.env.FETS_PGLITE_MODULE || "@electric-sql/pglite"
);
const db = new PGlite();
const uid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
let passed = 0;
const day = "2026-10-20";
async function role(name, id = 2) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    uid(id),
  ]);
  await db.exec(`set role ${name}`);
}
async function clock(t) {
  await db.query("select set_config('test.clock',$1,false)", [
    `${day}T${t}:00+05:30`,
  ]);
}
async function check(name, fn) {
  await fn();
  console.log("PASS", name);
  passed++;
}
const shift = {
  shift_code: "D",
  shift_label: "CMA early",
  shift_start: "06:00",
  shift_end: "15:00",
  grace_minutes: 0,
  overtime_hours: 0,
};
const batch = (value = shift, date = day, version = null, pid = uid(2)) =>
  db.query("select roster_save_batch($1) n", [
    JSON.stringify([
      {
        profile_id: pid,
        date,
        branch_location: "calicut",
        expected_version: version,
        value,
      },
    ]),
  ]);
const act = (action, pid = null) =>
  db.query("select * from roster_attendance_action($1,$2)", [action, pid]);
try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated,anon,service_role;
create function public.test_clock() returns timestamptz language sql as $$select current_setting('test.clock')::timestamptz$$;
create table staff_profiles(id uuid primary key,user_id uuid,full_name text,branch_assigned text,role text,email text);
create table roster_schedules(id uuid primary key default gen_random_uuid(),profile_id uuid references staff_profiles(id),date date,shift_code text,overtime_hours integer default 0,status text default 'confirmed',created_at timestamptz default now(),updated_at timestamptz default now(),branch_location text,unique(profile_id,date));
create table staff_attendance(id uuid primary key default gen_random_uuid(),staff_id uuid references staff_profiles(id),date date,check_in time,check_out time,status text default 'present',notes text,branch_location text,created_at timestamptz default now(),updated_at timestamptz default now(),unique(staff_id,date));
create table staff_ot_claims(id uuid primary key default gen_random_uuid(),profile_id uuid,date date,start_time time,end_time time,ot_hours numeric,toil_payout boolean default false,status text default 'pending',notes text);
grant select on staff_profiles to authenticated;grant select,insert,update,delete on roster_schedules,staff_attendance,staff_ot_claims to authenticated;
alter table roster_schedules enable row level security;
create policy read_roster on roster_schedules for select to authenticated using(true);
create policy write_roster on roster_schedules for all to authenticated using(exists(select 1 from staff_profiles where user_id=auth.uid() and role='super_admin' and email='mithun@fets.in')) with check(exists(select 1 from staff_profiles where user_id=auth.uid() and role='super_admin' and email='mithun@fets.in'));`);
  for (let i = 1; i <= 3; i++)
    await db.query("insert into staff_profiles values($1,$1,$2,$3,$4,$5)", [
      uid(i),
      `Staff ${i}`,
      i === 3 ? "cochin" : "calicut",
      i === 1 ? "super_admin" : "staff",
      i === 1 ? "mithun@fets.in" : `staff${i}@example.test`,
    ]);
  await db.query(
    "insert into roster_schedules(profile_id,date,shift_code,branch_location,overtime_hours) values($1,'2026-10-19','D','calicut',2)",
    [uid(2)],
  );
  const migration = await readFile(
    new URL(
      "../../supabase/migrations/20261020144716_roster_shift_times_and_attendance.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.exec(
    migration.replaceAll("clock_timestamp()", "public.test_clock()"),
  );
  await clock("05:59");
  await check(
    "migration preserves legacy schedule and overtime; does not seed hours",
    async () => {
      const r = (await db.query("select * from roster_schedules")).rows[0];
      assert.equal(r.overtime_hours, "2");
      assert.equal(r.shift_start, null);
      assert.equal(r.version, 1);
    },
  );
  await check(
    "anonymous and ordinary staff cannot edit the roster or create shift types",
    async () => {
      await role("anon");
      await assert.rejects(batch(), /permission denied/);
      await assert.rejects(act("in"), /permission denied/);
      await role("authenticated", 2);
      await assert.rejects(batch(), /Only the roster administrator/);
      await assert.rejects(
        db.query(
          "insert into roster_shift_types(branch_location,shift_label,shift_code,shift_start,shift_end) values('calicut','Early','D','06:00','15:00')",
        ),
        /row-level security/,
      );
    },
  );
  await role("authenticated", 1);
  await check(
    "administrator saves timed shifts and fractional approved OT",
    async () => {
      await batch({ ...shift, overtime_hours: 0.5 });
      const r = (
        await db.query("select * from roster_schedules where date=$1", [day])
      ).rows[0];
      assert.equal(r.shift_start, "06:00:00");
      assert.equal(r.overtime_hours, "0.5");
      assert.equal(r.version, 1);
    },
  );
  await check("stale overwrite and absent-row races are rejected", async () => {
    await assert.rejects(batch(shift), /changed elsewhere/);
    await assert.rejects(batch(shift, day, 9), /changed elsewhere/);
  });
  await check("invalid later entry rolls back the whole batch", async () => {
    const items = ["2026-10-21", "2026-10-22"].map((date, i) => ({
      profile_id: uid(2),
      date,
      branch_location: "calicut",
      expected_version: null,
      value: { ...shift, shift_end: i ? "05:00" : "15:00" },
    }));
    await assert.rejects(
      db.query("select roster_save_batch($1)", [JSON.stringify(items)]),
      /constraint/,
    );
    assert.equal(
      (
        await db.query(
          "select count(*) n from roster_schedules where date>'2026-10-20'",
        )
      ).rows[0].n,
      0,
    );
  });
  await check(
    "leave clears timing and existing-day versions increment",
    async () => {
      await batch({ ...shift, shift_code: "L" }, "2026-10-21");
      const r = (
        await db.query("select * from roster_schedules where date='2026-10-21'")
      ).rows[0];
      assert.equal(r.shift_start, null);
      await batch(shift, day, 1);
      assert.equal(
        (
          await db.query("select version from roster_schedules where date=$1", [
            day,
          ])
        ).rows[0].version,
        2,
      );
    },
  );
  await check("evening cannot be selected for new shifts", async () => {
    await assert.rejects(
      batch({ ...shift, shift_code: "E" }, "2026-10-22"),
      /Choose a roster type/,
    );
  });
  await check(
    "staff clock-in uses server IST and actual roster start, not 9:15",
    async () => {
      await role("authenticated", 2);
      await clock("06:01");
      const r = (await act("in")).rows[0];
      assert.equal(r.check_in, "06:01:00");
      assert.equal(new Date(r.date).toISOString().slice(0, 10), day);
      assert.equal(r.status, "late");
    },
  );
  await check("another staff member cannot clock a colleague in", async () => {
    await role("authenticated", 3);
    await assert.rejects(act("in", uid(2)), /only record your own/);
    await role("authenticated", 2);
  });
  await check(
    "duplicate clock-in does not reset original time or breaks",
    async () => {
      await clock("07:00");
      await assert.rejects(act("in"), /Already checked in/);
      assert.equal(
        (
          await db.query(
            "select check_in from staff_attendance where staff_id=$1",
            [uid(2)],
          )
        ).rows[0].check_in,
        "06:01:00",
      );
    },
  );
  await check(
    "breaks are accumulated once and checkout closes an open break",
    async () => {
      await clock("10:00");
      await act("break");
      await assert.rejects(act("break"), /already open/);
      await clock("10:15");
      await act("back");
      await assert.rejects(act("back"), /No open break/);
      await clock("14:45");
      await act("break");
      await clock("15:00");
      const r = (await act("out")).rows[0];
      const meta = JSON.parse(r.notes);
      assert.equal(meta.breakMins, 30);
      assert.equal(meta.steps[1].in, "15:00");
      await assert.rejects(act("out"), /Already checked out/);
    },
  );
  await check(
    "later shift is on time at 11:30 and grace follows each roster",
    async () => {
      await role("authenticated", 1);
      await batch(
        {
          ...shift,
          shift_start: "11:30",
          shift_end: "20:30",
          grace_minutes: 5,
        },
        day,
        null,
        uid(3),
      );
      await role("authenticated", 3);
      await clock("11:35");
      assert.equal((await act("in")).rows[0].status, "present");
    },
  );
  await check(
    "legacy normal day status uses the confirmed 08:00 baseline",
    async () => {
      await db.query(
        "insert into staff_attendance(staff_id,date,check_in,status) values($1,'2026-10-19','08:01','present')",
        [uid(2)],
      );
      assert.equal(
        (
          await db.query(
            "select status from staff_attendance where date='2026-10-19'",
          )
        ).rows[0].status,
        "late",
      );
    },
  );
  await check(
    "OT is only outside the saved hours and remains pending",
    async () => {
      const r = (
        await db.query(
          "insert into staff_ot_claims(profile_id,date,start_time,end_time,ot_hours) values($1,$2,'20:30','21:00',99) returning *",
          [uid(3), day],
        )
      ).rows[0];
      assert.equal(r.ot_hours, "0.50");
      assert.equal(r.status, "pending");
      await assert.rejects(
        db.query(
          "insert into staff_ot_claims(profile_id,date,start_time,end_time,ot_hours) values($1,$2,'17:00','19:00',2)",
          [uid(3), day],
        ),
        /inside the rostered/,
      );
    },
  );
  await check(
    "OT spanning shift end counts only the outside portion",
    async () => {
      const r = (
        await db.query(
          "insert into staff_ot_claims(profile_id,date,start_time,end_time,ot_hours) values($1,$2,'14:00','16:00',2) returning ot_hours",
          [uid(2), day],
        )
      ).rows[0];
      assert.equal(r.ot_hours, "1.00");
    },
  );
  await check(
    "over-approval and timed OT without roster are rejected",
    async () => {
      await assert.rejects(
        db.query(
          "insert into staff_ot_claims(profile_id,date,start_time,end_time,ot_hours,status) values($1,$2,'20:30','21:00',2,'approved')",
          [uid(3), day],
        ),
        /exceeds/,
      );
      await assert.rejects(
        db.query(
          "insert into staff_ot_claims(profile_id,date,start_time,end_time,ot_hours) values($1,'2026-10-30','17:00','19:00',2)",
          [uid(3)],
        ),
        /Set the rostered/,
      );
    },
  );
  await check(
    "zero-hour TOIL rest requests remain compatible; missing hourly end time is rejected",
    async () => {
      await role("authenticated", 1);
      await batch({ shift_code: "RD", overtime_hours: 0 }, "2026-10-28");
      const r = (
        await db.query(
          "insert into staff_ot_claims(profile_id,date,start_time,end_time,ot_hours,toil_payout) values($1,'2026-10-28','17:00',null,0,false) returning status",
          [uid(2)],
        )
      ).rows[0];
      assert.equal(r.status, "pending");
      await assert.rejects(
        db.query(
          "insert into staff_ot_claims(profile_id,date,start_time,end_time,ot_hours) values($1,$2,'15:00',null,1)",
          [uid(2), day],
        ),
        /valid same-day/,
      );
    },
  );
  console.log(`${passed} isolated database checks passed`);
} finally {
  await db.close();
}
