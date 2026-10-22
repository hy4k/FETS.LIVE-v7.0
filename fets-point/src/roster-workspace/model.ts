import type { CoverageChange, PlanRecord } from "../redesign/shift-plan";
export const CODES = {
  D: "Day shift",
  E: "Legacy evening",
  HD: "Half day",
  RD: "Rest day",
  L: "Leave",
  TOIL: "TOIL earned",
  TR: "TOIL leave",
  TP: "Paid TOIL",
  TRD: "TOIL rest day",
  PH: "Public holiday",
};
export const WORK_CODES = new Set(["D", "E", "HD", "OT"]);
export type Shift = {
  shift_code: string;
  shift_label: string | null;
  shift_start: string | null;
  shift_end: string | null;
  grace_minutes: number;
};
export type Schedule = Shift & {
  id: string;
  profile_id: string;
  date: string;
  branch_location: string;
  version: number;
  overtime_hours: number;
  status?: string;
};
export type Person = {
  id: string;
  user_id?: string;
  full_name: string;
  branch_assigned: string;
  is_active?: boolean;
  permissions?: unknown;
};
export type Attendance = {
  id: string;
  staff_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  notes: string | null;
  branch_location: string | null;
};
export type ShiftType = Shift & {
  id: string;
  branch_location: string;
  archived: boolean;
};
export type Snapshot = {
  people: Person[];
  schedules: Schedule[];
  attendance: Attendance[];
  types: ShiftType[];
  leadWeeks?: { branch: string; week_start: string; lead_id: string }[];
  leadPlans?: PlanRecord[];
  leadChanges?: CoverageChange[];
  leadError?: string;
};
export type Change = {
  profile_id: string;
  date: string;
  branch_location: string;
  expected_version: number | null;
  value: (Shift & { overtime_hours: number }) | null;
};
export const plainShift = (code = "D"): Shift => ({
  shift_code: code,
  shift_label: null,
  shift_start: WORK_CODES.has(code) && code !== "E" ? "08:00" : null,
  shift_end:
    code === "HD"
      ? "12:30"
      : WORK_CODES.has(code) && code !== "E"
        ? "17:00"
        : null,
  grace_minutes: 0,
});
export function effectiveShift<T extends Shift>(s: T): T {
  return !s.shift_start && !s.shift_end && ["D", "OT"].includes(s.shift_code)
    ? { ...s, shift_start: "08:00", shift_end: "17:00" }
    : s;
}
export function halfShift(full: Shift, part: "first" | "second"): Shift {
  const a = minutes(full.shift_start),
    b = minutes(full.shift_end);
  if (a === null || b === null || b <= a)
    throw Error("Set full-shift hours first.");
  if ((b - a) % 2) throw Error("The full shift must split into whole minutes.");
  const mid = (a + b) / 2;
  const t = (n: number) =>
    `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
  return {
    ...full,
    shift_code: "HD",
    shift_label: `${full.shift_label || "Normal"} · ${part} half`.slice(0, 50),
    shift_start: t(part === "first" ? a : mid),
    shift_end: t(part === "first" ? mid : b),
  };
}
export function overtimeMinutes(start: string, end: string, s: Shift): number {
  const a = minutes(start),
    b = minutes(end);
  const shift = effectiveShift(s);
  const x = minutes(shift.shift_start),
    y = minutes(shift.shift_end);
  if (a === null || b === null || b <= a || x === null || y === null)
    throw Error("Choose valid same-day hours and a timed roster entry.");
  return b - a - Math.max(0, Math.min(b, y) - Math.max(a, x));
}

export const clockParts = (now = new Date()) => {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const v = (k: string) => p.find((x) => x.type === k)!.value;
  return {
    day: `${v("year")}-${v("month")}-${v("day")}`,
    time: `${v("hour")}:${v("minute")}`,
  };
};
export function minutes(time?: string | null): number | null {
  if (!time || !/^\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(time)) return null;
  const [h, m] = time.split(":").map(Number);
  return h < 24 && m < 60 ? h * 60 + m : null;
}
export function formatTime(time?: string | null) {
  const m = minutes(time);
  return m === null
    ? "—"
    : `${Math.floor(m / 60) % 12 || 12}:${String(m % 60).padStart(2, "0")} ${m < 720 ? "AM" : "PM"}`;
}
export function duration(m: number | null) {
  return m === null ? "—" : `${Math.floor(m / 60)}h ${Math.floor(m % 60)}m`;
}
export function datesBetween(from: string, to: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
    throw Error("Choose a valid date range.");
  const a = new Date(from + "T00:00:00Z"),
    b = new Date(to + "T00:00:00Z");
  const n = (+b - +a) / 86400000 + 1;
  if (
    !Number.isInteger(n) ||
    n < 1 ||
    n > 366 ||
    a.toISOString().slice(0, 10) !== from ||
    b.toISOString().slice(0, 10) !== to
  )
    throw Error("Choose a range of 1–366 days.");
  return Array.from({ length: n }, (_, i) =>
    new Date(+a + i * 86400000).toISOString().slice(0, 10),
  );
}
export const addDays = (day: string, n: number) =>
  new Date(new Date(day + "T12:00:00Z").getTime() + n * 86400000)
    .toISOString()
    .slice(0, 10);
export function monthDays(month: string) {
  const d = new Date(month + "-01T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return datesBetween(month + "-01", d.toISOString().slice(0, 10));
}
export function shiftName(s: Shift) {
  return (
    s.shift_label || CODES[s.shift_code as keyof typeof CODES] || s.shift_code
  );
}
export function timing(s?: Shift | null) {
  if (s) s = effectiveShift(s);
  return s?.shift_start && s.shift_end
    ? `${formatTime(s.shift_start)} – ${formatTime(s.shift_end)}`
    : s && WORK_CODES.has(s.shift_code)
      ? "Timing not set"
      : "";
}
export function validateShift(s: Shift) {
  if (!(s.shift_code in CODES)) throw Error("Choose a roster type.");
  if (!WORK_CODES.has(s.shift_code)) return;
  const a = minutes(s.shift_start),
    b = minutes(s.shift_end);
  if (a === null || b === null || b <= a)
    throw Error("Enter a start and end time on the same day.");
  if (
    !Number.isInteger(s.grace_minutes) ||
    s.grace_minutes < 0 ||
    s.grace_minutes > 60
  )
    throw Error("Grace period must be 0–60 minutes.");
  if ((s.shift_label || "").length > 50)
    throw Error("Use a shift name of 50 characters or fewer.");
}
export type Segment = { days: number; shift: Shift };
export function patternDates(
  from: string,
  to: string,
  mode: "continuous" | "cycle" | "weekdays",
  shift: Shift,
  segments: Segment[],
  weekdays: number[],
) {
  const dates = datesBetween(from, to);
  if (
    mode === "cycle" &&
    (!segments.length ||
      segments.some(
        (x) => !Number.isInteger(x.days) || x.days < 1 || x.days > 366,
      ))
  )
    throw Error("Each part of the pattern needs 1–366 days.");
  if (mode === "weekdays" && !weekdays.length)
    throw Error("Select at least one weekday.");
  const cycle = segments.flatMap((x) =>
    Array.from({ length: x.days }, () => x.shift),
  );
  return dates
    .filter(
      (d) =>
        mode !== "weekdays" ||
        weekdays.includes(new Date(d + "T12:00:00Z").getUTCDay()),
    )
    .map((date, i) => ({
      date,
      shift: mode === "cycle" ? cycle[i % cycle.length] : shift,
    }));
}
function noteObject(notes: unknown) {
  try {
    const v = typeof notes === "string" ? JSON.parse(notes) : notes;
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}
export function attendanceMetrics(
  row: Attendance | undefined,
  schedule: Schedule | undefined,
  day: string,
  now = new Date(),
) {
  if (schedule) schedule = effectiveShift(schedule);
  const today = clockParts(now),
    current = minutes(today.time)!;
  const start =
    schedule && WORK_CODES.has(schedule.shift_code)
      ? minutes(schedule.shift_start)
      : null;
  const end =
    schedule && WORK_CODES.has(schedule.shift_code)
      ? minutes(schedule.shift_end)
      : null;
  const timed = start !== null && end !== null && end > start;
  const inAt = minutes(row?.check_in),
    outAt = minutes(row?.check_out);
  const scheduled = !!schedule && WORK_CODES.has(schedule.shift_code);
  const future = day > today.day;
  const active = inAt !== null && outAt === null && day === today.day;
  const missingOut = inAt !== null && outAt === null && day < today.day;
  const invalid =
    (outAt !== null && (inAt === null || outAt < inAt)) ||
    (day === today.day &&
      ((inAt !== null && inAt > current) ||
        (outAt !== null && outAt > current)));
  const meta = noteObject(row?.notes);
  const steps = Array.isArray(meta.steps) ? meta.steps : [];
  let breaks = Math.max(0, Number(meta.breakMins) || 0);
  // Completed breaks are already included in breakMins. Count only the open step.
  const last = steps[steps.length - 1];
  const step = minutes(last?.out);
  if (last && !last.in && step !== null) {
    const stop = outAt ?? (active ? current : null);
    if (stop !== null) breaks += Math.max(0, stop - step);
  }
  const worked =
    inAt === null || missingOut || invalid || future
      ? null
      : Math.max(0, (outAt ?? current) - inAt - breaks);
  const late =
    timed && inAt !== null && !invalid && !future
      ? Math.max(0, inAt - start! - (schedule?.grace_minutes || 0))
      : null;
  const early =
    timed && outAt !== null && !invalid && !future
      ? Math.max(0, end! - outAt)
      : null;
  const missingIn =
    scheduled &&
    inAt === null &&
    !future &&
    (day < today.day ||
      (timed && current >= start! + (schedule?.grace_minutes || 0)));
  let outside: number | null = null;
  if (timed && inAt !== null && outAt !== null && !invalid && !future) {
    outside =
      outAt -
      inAt -
      Math.max(0, Math.min(outAt, end!) - Math.max(inAt, start!));
    let knownBreaks = 0;
    for (const b of steps) {
      const x = minutes(b.out),
        y = minutes(b.in);
      if (x === null || y === null || y < x) continue;
      const left = Math.max(inAt, x),
        right = Math.min(outAt, y);
      const length = Math.max(0, right - left);
      knownBreaks += length;
      outside -=
        length - Math.max(0, Math.min(right, end!) - Math.max(left, start!));
    }
    // Without intervals, historical aggregate break minutes cannot be allocated to OT.
    outside = breaks > knownBreaks && outside > 0 ? null : Math.max(0, outside);
  }
  const status = invalid
    ? "Check times"
    : future
      ? "Upcoming"
      : inAt !== null
        ? invalid
          ? "Check times"
          : missingOut
            ? "Missing check-out"
            : active
              ? "In progress"
              : "Completed"
        : row?.status === "absent"
          ? "Marked absent"
          : missingIn
            ? "No check-in"
            : scheduled
              ? "Not started"
              : schedule
                ? shiftName(schedule)
                : "Not scheduled";
  return {
    scheduled,
    timed,
    late,
    early,
    worked,
    breaks,
    outside,
    active,
    missingOut,
    missingIn,
    invalid,
    status,
    present: inAt !== null && !future,
    complete: inAt !== null && outAt !== null && !invalid && !future,
    comparable: timed && inAt !== null && !invalid && !future,
  };
}
export const csvCell = (v: unknown) =>
  '"' +
  String(v ?? "")
    .replace(/^[=+@\-]/, "'$&")
    .replace(/"/g, '""') +
  '"';
