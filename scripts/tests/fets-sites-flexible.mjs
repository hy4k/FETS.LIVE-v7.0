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
    "alter table compliance_items add column category text default 'other',add column frequency text default 'once',add column next_due date,add column notes text",
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
  await db.exec(
    await readFile(
      new URL(
        "../../supabase/migrations/20261028043206_fets_sites_staff_access.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await role(2);
  const cid = (
      await one("select id from ascender_centres where code='calicut'")
    ).id,
    cochin = (await one("select id from ascender_centres where code='cochin'"))
      .id,
    mobile = (await one("select id from ascender_centres where code='mobile'"))
      .id;
  const legacy = await one(
    "insert into ascender_rooms(centre_id,name,total_seats,unavailable_seats)values($1,'Existing room',20,2)returning *",
    [cid],
  );
  await db.exec("reset role");
  await db.exec(
    await readFile(
      new URL(
        "../../supabase/migrations/20261028061819_fets_sites_flexible_forms_inventory.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await check(
    "migration retains existing room values and history and creates no stock/questions",
    async () => {
      const row = await one("select * from ascender_rooms where id=$1", [
        legacy.id,
      ]);
      const { custom_answers, ...old } = row;
      assert.deepEqual(old, legacy);
      assert.deepEqual(custom_answers, {});
      assert.equal(
        (await one("select count(*)::int n from ascender_inventory")).n,
        0,
      );
      assert.equal(
        (await one("select count(*)::int n from ascender_fields")).n,
        0,
      );
      assert.equal(
        (await one("select count(*)::int n from ascender_history")).n,
        1,
      );
    },
  );
  await check(
    "anonymous users cannot view or write form settings or stock",
    async () => {
      await role(0, "anon");
      for (const table of ["ascender_fields", "ascender_inventory"])
        await assert.rejects(
          one(`select * from ${table}`),
          /permission denied/,
        );
    },
  );
  await check(
    "all entry questions can be left unanswered in every section",
    async () => {
      await role(2);
      for (const table of [
        "ascender_rooms",
        "ascender_programmes",
        "ascender_documents",
        "compliance_items",
        "ascender_deployments",
      ]) {
        const row = await one(
          `insert into ${table}(centre_id)values($1)returning id`,
          [table === "ascender_deployments" ? mobile : cid],
        );
        assert.ok(row.id);
      }
    },
  );
  await check(
    "clearing a former required answer writes null and keeps its prior answer in history",
    async () => {
      await db.query(
        "update ascender_rooms set name=null,total_seats=null,unavailable_seats=null where id=$1",
        [legacy.id],
      );
      const r = await one("select * from ascender_rooms where id=$1", [
        legacy.id,
      ]);
      assert.equal(r.name, null);
      assert.equal(r.total_seats, null);
      const h = await one(
        "select before_data from ascender_history where record_id=$1 and before_data is not null order by id desc limit 1",
        [legacy.id],
      );
      assert.equal(h.before_data.name, "Existing room");
    },
  );
  const key = "q_" + uid(20).replaceAll("-", "");
  let question;
  await check(
    "staff create centre-specific custom questions with audit and versions",
    async () => {
      question = await one(
        "insert into ascender_fields(centre_id,section,field_key,label,kind)values($1,'ascender_inventory',$2,'Purchase reference','text')returning *",
        [cid, key],
      );
      assert.equal(question.updated_by, uid(2));
      assert.equal(question.version, 1);
      assert.equal(
        (
          await one(
            "select count(*)::int n from ascender_fields where centre_id=$1",
            [cochin],
          )
        ).n,
        0,
      );
    },
  );
  let item;
  await check(
    "inventory saves real quantities, including explicit zero, without defaulting missing stock to zero",
    async () => {
      item = await one(
        "insert into ascender_inventory(centre_id,name,quantity,custom_answers)values($1,'Computers',5,$2)returning *",
        [cid, { [key]: "REF-A" }],
      );
      assert.equal(item.quantity, 5);
      const empty = await one(
        "insert into ascender_inventory(centre_id,name)values($1,$2)returning quantity",
        [cid, "Chairs"],
      );
      assert.equal(empty.quantity, null);
      const zero = await one(
        "insert into ascender_inventory(centre_id,name,quantity)values($1,$2,0)returning quantity",
        [cid, "Printers"],
      );
      assert.equal(zero.quantity, 0);
    },
  );
  await check(
    "negative quantities and duplicate active items are rejected",
    async () => {
      await assert.rejects(
        db.query(
          "insert into ascender_inventory(centre_id,name,quantity)values($1,'AC',-1)",
          [cid],
        ),
        /check constraint/,
      );
      await assert.rejects(
        db.query(
          "insert into ascender_inventory(centre_id,name,quantity)values($1,' computers ',2)",
          [cid],
        ),
        /unique constraint/,
      );
    },
  );
  await check(
    "removing and restoring a question preserves existing custom answers",
    async () => {
      await db.query("update ascender_fields set removed=true where id=$1", [
        question.id,
      ]);
      assert.equal(
        (
          await one(
            "select custom_answers from ascender_inventory where id=$1",
            [item.id],
          )
        ).custom_answers[key],
        "REF-A",
      );
      await db.query("update ascender_fields set removed=false where id=$1", [
        question.id,
      ]);
      assert.equal(
        (
          await one(
            "select custom_answers from ascender_inventory where id=$1",
            [item.id],
          )
        ).custom_answers[key],
        "REF-A",
      );
    },
  );
  await check(
    "clearing a custom answer removes only that answer and keeps audit evidence",
    async () => {
      await db.query(
        "update ascender_inventory set custom_answers=custom_answers-$1 where id=$2",
        [key, item.id],
      );
      assert.deepEqual(
        (
          await one(
            "select custom_answers from ascender_inventory where id=$1",
            [item.id],
          )
        ).custom_answers,
        {},
      );
      assert.equal(
        (
          await one(
            "select before_data from ascender_history where record_id=$1 and before_data->'custom_answers' ? $2 order by id desc limit 1",
            [item.id, key],
          )
        ).before_data.custom_answers[key],
        "REF-A",
      );
    },
  );
  await check(
    "invalid custom response types and unsafe built-in question keys are rejected",
    async () => {
      await assert.rejects(
        db.query(
          "update ascender_inventory set custom_answers=$1 where id=$2",
          [{ [key]: 22 }, item.id],
        ),
        /answer type/,
      );
      await assert.rejects(
        db.query(
          "insert into ascender_fields(centre_id,section,field_key,label,kind)values($1,'ascender_inventory','id','ID','builtin')",
          [cid],
        ),
        /Unknown built-in/,
      );
      await assert.rejects(
        db.query(
          "insert into ascender_fields(centre_id,section,field_key,label,kind)values($1,'ascender_inventory','quantity','Fake','number')",
          [cid],
        ),
        /Invalid custom/,
      );
    },
  );
  await check(
    "question identity/type and centre identity cannot be rewritten",
    async () => {
      await assert.rejects(
        db.query("update ascender_fields set kind='number' where id=$1", [
          question.id,
        ]),
        /new question/,
      );
      await assert.rejects(
        db.query("update ascender_fields set centre_id=$1 where id=$2", [
          cochin,
          question.id,
        ]),
        /cannot move/,
      );
      await assert.rejects(
        db.query("update ascender_inventory set centre_id=$1 where id=$2", [
          cochin,
          item.id,
        ]),
        /cannot move/,
      );
    },
  );
  const numberKey = "q_" + uid(21).replaceAll("-", ""),
    choiceKey = "q_" + uid(22).replaceAll("-", "");
  await check(
    "new number/choice questions validate optional values and configured choices",
    async () => {
      await db.query(
        "insert into ascender_fields(centre_id,section,field_key,label,kind)values($1,'ascender_inventory',$2,'Age','number')",
        [cid, numberKey],
      );
      await db.query(
        "insert into ascender_fields(centre_id,section,field_key,label,kind,options)values($1,'ascender_inventory',$2,'Condition','choice',$3)",
        [cid, choiceKey, ["New", "Used"]],
      );
      await db.query(
        "update ascender_inventory set custom_answers=$1 where id=$2",
        [{ [numberKey]: 0, [choiceKey]: "Used" }, item.id],
      );
      await assert.rejects(
        db.query(
          "update ascender_inventory set custom_answers=$1 where id=$2",
          [{ [numberKey]: "old" }, item.id],
        ),
        /answer type/,
      );
      await assert.rejects(
        db.query(
          "update ascender_inventory set custom_answers=$1 where id=$2",
          [{ [choiceKey]: "Other" }, item.id],
        ),
        /available answer/,
      );
    },
  );
  await check(
    "custom links, dates, email and yes/no answers validate without making answers mandatory",
    async () => {
      const types = [
        [23, "url"],
        [24, "date"],
        [25, "email"],
        [26, "checkbox"],
      ];
      const keys = {};
      for (const [n, kind] of types) {
        keys[kind] = "q_" + uid(n).replaceAll("-", "");
        await db.query(
          "insert into ascender_fields(centre_id,section,field_key,label,kind)values($1,'ascender_inventory',$2,$3,$3)",
          [cid, keys[kind], kind],
        );
      }
      await db.query(
        "update ascender_inventory set custom_answers=$1 where id=$2",
        [
          {
            [keys.url]: "https://example.test/guide",
            [keys.date]: "2026-10-28",
            [keys.email]: "help@example.test",
            [keys.checkbox]: false,
          },
          item.id,
        ],
      );
      for (const [kind, value] of [
        ["url", "javascript:alert(1)"],
        ["url", "https://user:secret@example.test"],
        ["date", "invalid"],
        ["email", "invalid"],
        ["checkbox", "yes"],
      ])
        await assert.rejects(
          db.query(
            "update ascender_inventory set custom_answers=$1 where id=$2",
            [{ [keys[kind]]: value }, item.id],
          ),
        );
      await db.query(
        "update ascender_inventory set custom_answers='{}' where id=$1",
        [item.id],
      );
    },
  );
  await check(
    "delete/restore is reversible and records the actual signed-in actor",
    async () => {
      await db.query(
        "update ascender_inventory set archived=true where id=$1",
        [item.id],
      );
      const r = await one("select * from ascender_inventory where id=$1", [
        item.id,
      ]);
      assert.equal(r.archived, true);
      assert.equal(r.updated_by, uid(2));
      await db.query(
        "update ascender_inventory set archived=false where id=$1",
        [item.id],
      );
      assert.equal(
        (
          await one("select archived from ascender_inventory where id=$1", [
            item.id,
          ])
        ).archived,
        false,
      );
    },
  );
  await check("stale stock edits cannot overwrite a newer value", async () => {
    const r = await one("select * from ascender_inventory where id=$1", [
      item.id,
    ]);
    await db.query(
      "update ascender_inventory set quantity=6 where id=$1 and version=$2",
      [r.id, r.version],
    );
    assert.equal(
      (
        await db.query(
          "update ascender_inventory set quantity=99 where id=$1 and version=$2 returning id",
          [r.id, r.version],
        )
      ).rows.length,
      0,
    );
  });
  await check(
    "wrong-centre deployments and contradictory dates remain invalid without mandatory fields",
    async () => {
      await assert.rejects(
        db.query("insert into ascender_deployments(centre_id)values($1)", [
          cid,
        ]),
        /Mobile unit/,
      );
      await assert.rejects(
        db.query(
          "insert into ascender_deployments(centre_id,start_date,end_date)values($1,'2026-11-03','2026-11-01')",
          [mobile],
        ),
        /check constraint/,
      );
    },
  );
  await check(
    "blank optional links are accepted while executable links and impossible capacity are rejected",
    async () => {
      await db.query(
        "insert into ascender_documents(centre_id,url)values($1,null)",
        [cid],
      );
      await assert.rejects(
        db.query(
          "insert into ascender_documents(centre_id,url)values($1,'javascript:alert(1)')",
          [cid],
        ),
        /check constraint/,
      );
      await assert.rejects(
        db.query(
          "insert into ascender_rooms(centre_id,total_seats,unavailable_seats)values($1,3,5)",
          [cid],
        ),
        /check constraint/,
      );
    },
  );
  await check(
    "off and inactive users cannot read or alter inventory/question settings",
    async () => {
      for (const user of [4, 5]) {
        await role(user);
        for (const table of ["ascender_fields", "ascender_inventory"])
          assert.equal(
            (await one(`select count(*)::int n from ${table}`)).n,
            0,
          );
        await assert.rejects(
          db.query(
            "insert into ascender_inventory(centre_id,name)values($1,$2)",
            [cid, "Blocked"],
          ),
          /row-level security|active authorised/,
        );
      }
    },
  );
  await check(
    "no ordinary user can destroy stock records or rewrite history",
    async () => {
      await role(2);
      await assert.rejects(
        db.query("delete from ascender_inventory where id=$1", [item.id]),
        /permission denied/,
      );
      await assert.rejects(
        db.query("update ascender_history set after_data='{}'"),
        /permission denied/,
      );
    },
  );
  console.log(`${passed} isolated flexible Sites checks passed`);
} finally {
  await db.close();
}
