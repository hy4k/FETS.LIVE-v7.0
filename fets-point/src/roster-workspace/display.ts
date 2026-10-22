import {
  CODES,
  WORK_CODES,
  effectiveShift,
  plainShift,
  shiftName,
  timing,
  type Shift,
  type Snapshot,
} from "./model";
import { monday } from "../redesign/shift-plan";
import { dayLead } from "../redesign/shift-lead";
const key = (s: Shift) => {
  const v = effectiveShift(s);
  return WORK_CODES.has(v.shift_code)
    ? [
        v.shift_code,
        v.shift_start?.slice(0, 5),
        v.shift_end?.slice(0, 5),
        v.grace_minutes,
      ].join("/")
    : v.shift_code;
};
export function rosterLegend(shifts: Shift[]) {
  const unique = new Map<string, Shift>();
  for (const s of shifts)
    if (!unique.has(key(s))) unique.set(key(s), effectiveShift(s));
  const entries = [...unique].sort(([a], [b]) => a.localeCompare(b));
  const counters: Record<string, number> = {};
  const legend = entries.map(([id, s]) => {
    const standard =
      !WORK_CODES.has(s.shift_code) || id === key(plainShift(s.shift_code));
    const code = standard
      ? s.shift_code
      : `${s.shift_code}${(counters[s.shift_code] = (counters[s.shift_code] || 0) + 1)}`;
    return {
      id,
      code,
      type: s.shift_code,
      label: `${CODES[s.shift_code as keyof typeof CODES] || shiftName(s)}${WORK_CODES.has(s.shift_code) ? ` · ${timing(s)}${s.grace_minutes ? ` · ${s.grace_minutes}m grace` : ""}` : ""}`,
    };
  });
  return {
    legend,
    code: (s: Shift) =>
      legend.find((l) => l.id === key(s))?.code || s.shift_code,
  };
}
export function rosterLead(
  data: Snapshot,
  branch: string,
  day: string,
  now: Date,
) {
  const plan =
    data.leadPlans?.find((p) => p.branch === branch && p.day === day) || null;
  const weekly = data.leadWeeks?.find(
    (w) => w.branch === branch && w.week_start === monday(day),
  );
  return dayLead(
    plan,
    weekly?.lead_id,
    (data.leadChanges || []).filter((c) => c.plan_id === plan?.id),
    now,
  );
}
