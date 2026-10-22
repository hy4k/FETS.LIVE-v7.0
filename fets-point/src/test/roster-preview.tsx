// Fictional isolated UI fixtures. This entry cannot connect to a production database.
import React from "react";
import { createRoot } from "react-dom/client";
import RosterWorkspace from "../roster-workspace/RosterWorkspace";
import {
  plainShift,
  monthDays,
  type Snapshot,
  type ShiftType,
} from "../roster-workspace/model";
import type { RosterRepository } from "../roster-workspace/repository";
const people = ["Maya Joseph", "Arun Menon", "Sara Thomas", "Neha Nair"].map(
  (full_name, i) => ({
    id: `p${i}`,
    full_name,
    branch_assigned: i === 3 ? "cochin" : "calicut",
    is_active: true,
  }),
);
const types: ShiftType[] = [
  {
    ...plainShift(),
    id: "early",
    shift_label: "CMA early",
    shift_start: "06:00",
    shift_end: "15:00",
    branch_location: "calicut",
    archived: false,
  },
  {
    ...plainShift(),
    id: "late",
    shift_label: "CMA late",
    shift_start: "11:30",
    shift_end: "20:30",
    branch_location: "calicut",
    archived: false,
  },
];
const data: Snapshot = { people, types, schedules: [], attendance: [], leadWeeks: [{branch:'calicut',week_start:'2026-10-19',lead_id:'p0'}] };
for (const [i, p] of people.entries())
  for (const date of monthDays("2026-10")) {
    const d = Number(date.slice(-2)),
      rest = d % 7 === 0,
      s = rest
        ? plainShift("RD")
        : i === 0
          ? types[0]
          : i === 1
            ? types[1]
            : plainShift();
    data.schedules.push({
      ...s,
      id: `${p.id}-${date}`,
      profile_id: p.id,
      date,
      branch_location: p.branch_assigned,
      version: 1,
      overtime_hours: d === 19 && i === 0 ? 0.5 : 0,
    });
    if (d <= 20 && !rest) {
      const inTime =
        i === 0 ? (d === 19 ? "06:12" : "06:00") : i === 1 ? "11:30" : "08:00";
      data.attendance.push({
        id: `a${p.id}${date}`,
        staff_id: p.id,
        date,
        check_in: inTime,
        check_out:
          d === 20
            ? null
            : d === 18 && i === 2
              ? null
              : i === 0
                ? "15:30"
                : i === 1
                  ? d === 19
                    ? "20:15"
                    : "20:30"
                  : "17:00",
        status: "present",
        notes: JSON.stringify({
          breakMins: d === 20 ? 0 : 30,
          steps: d === 20 ? [] : [{ out: "12:00", in: "12:30" }],
        }),
        branch_location: p.branch_assigned,
      });
    }
  }
let fail = false;
let failures = 0;
const repo: RosterRepository = {
  async load() {
    if (fail) throw Error("Connection unavailable. Please retry.");
    return structuredClone(data);
  },
  async range(id, from, to) {
    return structuredClone(
      data.schedules.filter(
        (r) => r.profile_id === id && r.date >= from && r.date <= to,
      ),
    );
  },
  async save(changes) {
    if (failures) {
      failures--;
      throw Error(
        "The roster changed elsewhere. Refresh and review the dates again.",
      );
    }
    for (const c of changes) {
      data.schedules = data.schedules.filter(
        (r) => r.profile_id !== c.profile_id || r.date !== c.date,
      );
      if (c.value)
        data.schedules.push({
          ...c.value,
          id: `${c.profile_id}-${c.date}`,
          profile_id: c.profile_id,
          date: c.date,
          branch_location: c.branch_location,
          version: (c.expected_version || 0) + 1,
        });
    }
    return changes.length;
  },
  async createType(v) {
    const type = { ...v, id: `t${data.types.length}`, archived: false };
    data.types.push(type);
    return type;
  },
  async archiveType(id) {
    data.types = data.types.filter((t) => t.id !== id);
  },
  async attendance() {
    throw Error("Attendance writes are disabled in this design preview.");
  },
};
(window as any).rosterPreview = {
  data,
  failLoad: (v: boolean) => {
    fail = v;
  },
  failNextSave: () => {
    failures = 1;
  },
};
const mode = new URLSearchParams(location.search).get("role");
createRoot(document.getElementById("root")!).render(
  <>
    <div
      style={{
        padding: "10px 20px",
        background: "#233e49",
        color: "#fff",
        font: "12px system-ui",
      }}
    >
      Design preview · fictional staff records · changes stay in this preview
    </div>
    <RosterWorkspace
      branch="calicut"
      canEdit={mode !== "staff"}
      meId="p0"
      repo={repo}
      now={new Date("2026-10-20T12:00:00+05:30")}
    />
  </>,
);
