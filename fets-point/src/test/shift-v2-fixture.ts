// Fictional people and work: isolated preview/test fixtures, never a production entry.
import {
  DUTIES,
  slots,
  type Block,
  type Duty,
  type Plan,
} from "../shift-v2/model";
export const ids = {
  a: "10000000-0000-4000-8000-000000000001",
  b: "10000000-0000-4000-8000-000000000002",
  c: "10000000-0000-4000-8000-000000000003",
  support: "11111111-1111-4111-8111-111111111111",
};
let serial = 100;
const id = () =>
  `20000000-0000-4000-8000-${String(serial++).padStart(12, "0")}`;
export const fixturePlan: Plan = {
  schema: 2,
  programme: "Example examination · sample timetable",
  template: "cma-us",
  people: [
    { id: ids.a, name: "Alex", start: 360, end: 960 },
    { id: ids.b, name: "Sam", start: 360, end: 960 },
    { id: ids.c, name: "Riya", start: 690, end: 1230 },
    {
      id: ids.support,
      name: "Casey",
      start: 1050,
      end: 1080,
      support: true,
      supportReason: "Example approved temporary break cover",
    },
  ],
  monitoring: [{ start: 450, end: 1230 }],
  openingBy: 390,
  opening: [
    { id: id(), label: "Prepare the front office", owner: ids.a },
    { id: id(), label: "Check recording systems", owner: ids.b },
  ],
  blocks: [],
  notes:
    "Fictional preview data. Every date uses its own roster and exam schedule.",
};
const add = (
  staff: string,
  start: number,
  end: number,
  duties: Duty[],
  note = "",
  cover?: string,
) => {
  const b: Block = {
    id: id(),
    staff,
    start,
    end,
    duties,
    tasks: duties
      .flatMap((d) => [...DUTIES[d].steps])
      .map((label) => ({ id: id(), label })),
    note,
    ...(cover ? { cover } : {}),
  };
  fixturePlan.blocks.push(b);
};
add(ids.a, 360, 390, ["opening"]);
add(ids.a, 390, 405, ["front"]);
add(ids.a, 405, 450, ["security"]);
add(ids.a, 450, 465, ["break"], "", ids.b);
add(ids.a, 465, 480, ["monitor"]);
add(ids.a, 480, 540, ["admin"]);
add(ids.a, 540, 600, ["monitor"]);
add(ids.a, 600, 660, ["training"]);
add(ids.a, 660, 690, ["monitor", "checkout"]);
add(ids.a, 690, 750, ["security", "proadmin"]);
add(ids.a, 750, 795, ["monitor", "checkout"]);
add(ids.a, 795, 810, ["admin"]);
add(ids.a, 810, 870, ["break"], "", ids.b);
add(ids.a, 870, 945, ["security", "proadmin"]);
add(ids.a, 945, 960, ["security", "proadmin", "handover"]);
add(ids.b, 360, 405, ["opening"]);
add(ids.b, 405, 410, ["calling"]);
add(ids.b, 410, 450, ["proadmin"]);
add(ids.b, 450, 465, ["monitor"]);
add(ids.b, 465, 480, ["break"], "", ids.a);
add(ids.b, 480, 540, ["monitor"]);
add(ids.b, 540, 600, ["training"]);
add(ids.b, 600, 660, ["monitor"]);
add(ids.b, 660, 720, ["front"]);
add(ids.b, 720, 750, ["security", "proadmin"]);
add(ids.b, 750, 795, ["break"], "", ids.a);
add(ids.b, 795, 945, ["monitor", "checkout"]);
add(ids.b, 945, 960, ["monitor", "checkout", "handover"]);
add(ids.c, 690, 750, ["monitor", "checkout"]);
add(ids.c, 750, 810, ["admin"]);
add(ids.c, 810, 870, ["training"]);
add(ids.c, 870, 945, ["front"]);
add(ids.c, 945, 960, ["front", "handover"]);
add(ids.c, 960, 1050, ["monitor", "checkout", "admin"]);
add(ids.c, 1050, 1080, ["break"], "", ids.support);
add(ids.c, 1080, 1215, ["monitor", "checkout", "admin"]);
add(ids.c, 1215, 1230, ["monitor", "checkout", "closing"]);
add(ids.support, 1050, 1080, ["monitor", "checkout"]);
export const fixtureDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
export const fixtureRecord = {
  id: "30000000-0000-4000-8000-000000000001",
  branch: "calicut",
  day: fixtureDay,
  lead_id: null,
  status: "published" as const,
  version: 1,
  plan: fixturePlan,
  updated_at: new Date().toISOString(),
  published_at: fixtureDay + "T06:00:00+05:30",
};
export const fixtureChecks = {
  connected: true as const,
  server_now: new Date().toISOString(),
  viewer_id: ids.support,
  viewer_rostered: true,
  plan: {
    id: fixtureRecord.id,
    branch: "calicut",
    day: fixtureDay,
    version: 1,
    closed: false,
    format: 2,
    tracking_from: fixtureRecord.published_at,
  },
  checks: slots(fixturePlan),
};
