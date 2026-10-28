// Disposable local database. Never writes production staff, attendance or participation.
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const { PGlite } = await import(
  process.env.FETS_PGLITE_MODULE || "@electric-sql/pglite"
);
const db = new PGlite();
let passed = 0;
const uid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const day = "2026-10-29";
const role = async (n = 2, name = "authenticated") => {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    uid(n),
  ]);
  await db.exec(`set role ${name}`);
};
const check = async (name, fn) => {
  await fn();
  console.log("PASS", name);
  passed++;
};
const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
const submit = (
  kind = "leave",
  date = day,
  partner = null,
  swapDate = null,
  period = "first",
) =>
  one("select to_jsonb(desk_request_submit($1,$2,$3,$4,$5,$6)) r", [
    kind,
    date,
    partner,
    swapDate,
    period,
    "A local test request",
  ]).then((x) => x.r);
const resolve = (r, status = "approved") =>
  one("select to_jsonb(desk_request_resolve($1,$2,$3,$4)) r", [
    r.id,
    status,
    r.version,
    "Reviewed",
  ]).then((x) => x.r);
const reply = (r, accept = true) =>
  one("select to_jsonb(desk_swap_reply($1,$2,$3)) r", [
    r.id,
    accept,
    r.version,
  ]).then((x) => x.r);
const roster = async (pid, date = day) =>
  one("select * from roster_schedules where profile_id=$1 and date=$2", [
    uid(pid),
    date,
  ]);
const seed = async (date, start = "06:00", end = "15:00") => {
  await db.exec("reset role");
  for (const pid of [2, 3])
    await db.query(
      "insert into roster_schedules(profile_id,date,shift_code,shift_start,shift_end,shift_label,branch_location)values($1,$2,'D',$3,$4,'Custom','calicut')",
      [uid(pid), date, pid === 2 ? start : "11:30", pid === 2 ? end : "20:30"],
    );
};
try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated,service_role;
 create function test_clock() returns timestamptz language sql as $$select current_setting('test.clock')::timestamptz$$;
 create table staff_profiles(id uuid primary key,user_id uuid,full_name text,role text,email text,branch_assigned text,is_active boolean default true);
 create table roster_schedules(id uuid primary key default gen_random_uuid(),profile_id uuid,date date,shift_code text,shift_label text,shift_start time,shift_end time,grace_minutes integer default 0,overtime_hours numeric default 0,status text default 'confirmed',branch_location text,version bigint default 1,updated_at timestamptz default now(),unique(profile_id,date),check((shift_start is null and shift_end is null)or(shift_start is not null and shift_end is not null and shift_end>shift_start)),check(length(coalesce(shift_label,''))<=50));
 create table staff_attendance(staff_id uuid,date date,check_in time);
 create table staff_applications(id uuid primary key default gen_random_uuid(),kind text,status text default 'pending',applicant_id uuid,applicant_name text,branch text,request_date date,leave_type text,swap_with_name text,swap_with_id uuid,swap_date date,reason text,admin_reply text,resolved_by uuid,resolved_at timestamptz);
 grant select on staff_profiles,roster_schedules to authenticated;grant insert,update on roster_schedules to authenticated;grant select,insert,update on staff_applications to authenticated;
 alter table staff_applications enable row level security;
 create policy app_read on staff_applications for select to authenticated using(applicant_id in(select id from staff_profiles where user_id=auth.uid())or exists(select 1 from staff_profiles where user_id=auth.uid() and role='super_admin'));
 create policy app_insert on staff_applications for insert to authenticated with check(applicant_id in(select id from staff_profiles where user_id=auth.uid()));
 create policy app_update on staff_applications for update to authenticated using(exists(select 1 from staff_profiles where user_id=auth.uid() and role='super_admin'));
 alter table roster_schedules enable row level security;create policy roster_read on roster_schedules for select to authenticated using(true);create policy roster_write on roster_schedules for all to authenticated using(exists(select 1 from staff_profiles where user_id=auth.uid() and role='super_admin'));
 `);
  for (let n = 1; n <= 5; n++) {
    await db.query("insert into auth.users values($1)", [uid(n)]);
    await db.query("insert into staff_profiles values($1,$1,$2,$3,$4,$5,$6)", [
      uid(n),
      `Example ${n}`,
      n === 1 ? "super_admin" : n === 5 ? null : "staff",
      n === 1 ? "mithun@fets.in" : null,
      n === 4 ? "cochin" : "calicut",
      n !== 5,
    ]);
  }
  await db.query(
    "select set_config('test.clock','2026-10-28T12:00:00+05:30',false)",
  );
  const original = await readFile(
    new URL(
      "../../supabase/migrations/20261020144716_roster_shift_times_and_attendance.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.exec(
    "create function public.roster_timing_guard()" +
      original
        .split("create function public.roster_timing_guard()")[1]
        .split("revoke all on function public.roster_timing_guard()")[0] +
      "create trigger roster_timing_guard before insert or update on roster_schedules for each row execute function roster_timing_guard();",
  );
  await db.query(
    "insert into staff_applications(kind,status,applicant_id,applicant_name,reason)values('leave','approved',$1,'Legacy staff','Retain history')",
    [uid(2)],
  );
  const migration = await readFile(
    new URL(
      "../../supabase/migrations/20261028022657_personal_desk_requests_and_team_round.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.exec(
    migration.replaceAll("clock_timestamp()", "public.test_clock()"),
  );
  await check(
    "additive migration preserves existing applications and creates no participation",
    async () => {
      assert.equal(
        (
          await one(
            "select count(*)::int n from staff_applications where reason='Retain history' and status='approved' and workflow_version=0",
          )
        ).n,
        1,
      );
      assert.equal(
        (await one("select count(*)::int n from desk_team_rounds")).n,
        0,
      );
    },
  );
  await check(
    "anonymous and inactive accounts cannot read or join",
    async () => {
      await role(2, "anon");
      await assert.rejects(
        one("select desk_team_round()"),
        /permission denied/,
      );
      await role(5);
      await assert.rejects(one("select desk_team_round()"), /active staff/);
    },
  );
  await check(
    "participation is explicit, tied to the real account and idempotent",
    async () => {
      await role();
      assert.deepEqual(
        (await one("select desk_team_round() r")).r.participants,
        [],
      );
      let r = (await one("select desk_team_round_join(1,'2026-10-28') r")).r;
      assert.equal(r.choice, 1);
      r = (await one("select desk_team_round_join(2,'2026-10-28') r")).r;
      assert.equal(r.choice, 1);
      await assert.rejects(
        one("select desk_team_round_join(1,'2026-10-27')"),
        /new round/,
      );
      await assert.rejects(
        one("insert into desk_team_rounds values($1,'2026-10-28',0,now())", [
          uid(3),
        ]),
        /permission denied/,
      );
    },
  );
  await check(
    "other staff can see participation names but never another answer",
    async () => {
      await role(3);
      const r = (await one("select desk_team_round() r")).r;
      assert.equal(r.choice, null);
      assert.deepEqual(r.participants, [{ name: "Example 2" }]);
      assert.equal(
        (await db.query("select * from desk_team_rounds")).rows.length,
        0,
      );
    },
  );
  await check(
    "request submission requires a real working roster and same-centre partner",
    async () => {
      await role();
      await assert.rejects(submit(), /Set the roster/);
      await assert.rejects(submit("swap", day, uid(4), day), /another active/);
    },
  );
  await seed(day);
  let half;
  await check(
    "half-day request records a snapshot without changing the roster",
    async () => {
      await role();
      half = await submit();
      assert.equal(half.half_day_period, "first");
      assert.equal((await roster(2)).shift_start, "06:00:00");
      await assert.rejects(resolve(half), /roster administrator/);
    },
  );
  await check(
    "browser cannot forge or downgrade a protected request",
    async () => {
      await role(1);
      await assert.rejects(
        one(
          "update staff_applications set workflow_version=0,status='approved' where id=$1 returning id",
          [half.id],
        ),
        /current My Desk/,
      );
      await role();
      await assert.rejects(
        one(
          "insert into staff_applications(kind,applicant_id,request_date,workflow_version)values('swap',$1,$2,1)",
          [uid(2), day],
        ),
        /current My Desk/,
      );
    },
  );
  await check(
    "half-day approval retains exactly the remaining half of custom hours",
    async () => {
      await role(1);
      half = await resolve(half);
      const r = await roster(2);
      assert.equal(r.shift_code, "HD");
      assert.equal(r.shift_start, "10:30:00");
      assert.equal(r.shift_end, "15:00:00");
      assert.equal(r.version, 2);
      assert.equal(half.resolved_by, uid(1));
    },
  );
  await seed("2026-10-30", "08:00", "17:00");
  await check(
    "second half off leaves 08:00–12:30 working, with server authorisation",
    async () => {
      await role();
      const app = await submit("leave", "2026-10-30", null, null, "second");
      await role(1);
      await resolve(app);
      assert.equal((await roster(2, "2026-10-30")).shift_end, "12:30:00");
    },
  );
  await seed("2026-10-31");
  await check("stale roster invalidates approval atomically", async () => {
    await role();
    const app = await submit("leave", "2026-10-31");
    await role(1);
    await db.query(
      "update roster_schedules set shift_end='16:00' where profile_id=$1 and date='2026-10-31'",
      [uid(2)],
    );
    await assert.rejects(resolve(app), /roster changed/);
    assert.equal(
      (await one("select status from staff_applications where id=$1", [app.id]))
        .status,
      "pending",
    );
  });
  await seed("2026-11-01");
  await seed("2026-11-02");
  let swap;
  await check(
    "swap needs colleague consent; other accounts cannot reply",
    async () => {
      await role();
      swap = await submit("swap", "2026-11-01", uid(3), "2026-11-02");
      await role(1);
      await assert.rejects(resolve(swap), /colleague must accept/);
      await role(4);
      await assert.rejects(reply(swap), /not addressed/);
      await role(3);
      assert.equal(
        (
          await db.query("select id from staff_applications where id=$1", [
            swap.id,
          ])
        ).rows.length,
        1,
      );
      swap = await reply(swap);
      assert.equal(swap.partner_reply, "accepted");
      await assert.rejects(reply(swap), /request changed/);
    },
  );
  await check(
    "approved swap exchanges both saved dates and hours in one transaction",
    async () => {
      await role(1);
      await resolve(swap);
      for (const date of ["2026-11-01", "2026-11-02"]) {
        assert.equal((await roster(2, date)).shift_start, "11:30:00");
        assert.equal((await roster(3, date)).shift_start, "06:00:00");
      }
      await assert.rejects(resolve(swap), /request changed/);
    },
  );
  await seed("2026-11-03");
  await check(
    "attendance already recorded prevents roster rewrite",
    async () => {
      await role();
      const app = await submit("leave", "2026-11-03");
      await db.exec("reset role");
      await db.query(
        "insert into staff_attendance values($1,'2026-11-03','06:00')",
        [uid(2)],
      );
      await role(1);
      await assert.rejects(resolve(app), /Attendance is already/);
      assert.equal((await roster(2, "2026-11-03")).shift_code, "D");
    },
  );
  await seed("2026-11-04");
  await check("approved overtime is not silently erased", async () => {
    await role(1);
    await db.query(
      "update roster_schedules set overtime_hours=2 where profile_id=$1 and date='2026-11-04'",
      [uid(2)],
    );
    await role();
    await assert.rejects(submit("leave", "2026-11-04"), /overtime/);
  });
  await seed("2026-11-05");
  await check(
    "equal hours with different shift codes survive a validated swap",
    async () => {
      await db.exec("reset role");
      await db.query(
        "update roster_schedules set shift_code='HD',shift_start='06:00',shift_end='15:00',shift_label='Custom' where profile_id=$1 and date='2026-11-05'",
        [uid(3)],
      );
      await role();
      let app = await submit("swap", "2026-11-05", uid(3), "2026-11-05");
      await role(3);
      app = await reply(app);
      await role(1);
      await resolve(app);
      assert.equal((await roster(2, "2026-11-05")).shift_start, "06:00:00");
      assert.equal((await roster(2, "2026-11-05")).shift_code, "HD");
    },
  );
  await seed("2026-11-06");
  await seed("2026-11-07");
  await check(
    "a second swap date that becomes past cannot be approved",
    async () => {
      await role();
      let app = await submit("swap", "2026-11-07", uid(3), "2026-11-06");
      await role(3);
      app = await reply(app);
      await role(1);
      await db.query(
        "select set_config('test.clock','2026-11-07T12:00:00+05:30',false)",
      );
      await assert.rejects(resolve(app), /Past dates/);
      assert.equal((await roster(2, "2026-11-07")).shift_start, "06:00:00");
    },
  );
  await check(
    "legacy browser code-only edits still clear stale hours",
    async () => {
      await role(1);
      await db.query(
        "update roster_schedules set shift_code='HD' where profile_id=$1 and date='2026-11-07'",
        [uid(2)],
      );
      assert.equal((await roster(2, "2026-11-07")).shift_start, null);
    },
  );
  console.log(`${passed} isolated My Desk database checks passed`);
} finally {
  await db.close();
}
