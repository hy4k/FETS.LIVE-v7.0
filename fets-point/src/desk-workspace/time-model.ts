import {
  attendanceMetrics,
  clockParts,
  datesBetween,
  effectiveShift,
  minutes,
  WORK_CODES,
  type Attendance,
  type Schedule,
} from "../roster-workspace/model";
export type TimeData = { schedules: Schedule[]; attendance: Attendance[] };
const offCodes = new Set(["RD", "L", "TR", "TRD", "PH"]);
export function timeInsights(
  data: TimeData,
  profileId: string,
  from: string,
  to: string,
  now = new Date(),
) {
  const today = clockParts(now).day;
  const days = datesBetween(from, to).map((date) => {
    const schedules = data.schedules.filter(
      (s) => s.profile_id === profileId && s.date === date,
    );
    const records = data.attendance.filter(
      (a) => a.staff_id === profileId && a.date === date,
    );
    const duplicate = schedules.length > 1 || records.length > 1;
    const s = duplicate
      ? undefined
      : schedules[0] && effectiveShift(schedules[0]);
    const a = duplicate ? undefined : records[0];
    const m = attendanceMetrics(a, s, date, now);
    const span =
      a && minutes(a.check_in) !== null && minutes(a.check_out) !== null
        ? minutes(a.check_out)! - minutes(a.check_in)!
        : null;
    const invalidBreaks = span !== null && span >= 0 && m.breaks > span;
    const complete = !duplicate && !invalidBreaks && m.complete;
    const start = s && minutes(s.shift_start),
      end = s && minutes(s.shift_end);
    const assigned =
      s &&
      WORK_CODES.has(s.shift_code) &&
      start != null &&
      end != null &&
      end > start
        ? end - start
        : null;
    const off = !!s && offCodes.has(s.shift_code);
    const issue = duplicate
      ? "Conflicting records"
      : invalidBreaks
        ? "Check recorded breaks"
        : m.missingIn || m.missingOut || m.invalid
          ? m.status
          : null;
    const state = issue
      ? "review"
      : date > today
        ? "future"
        : complete
          ? "work"
          : m.active
            ? "active"
            : off
              ? "off"
              : "unknown";
    return {
      date,
      s,
      a,
      m,
      assigned,
      complete,
      off,
      issue,
      state,
      future: date > today,
    };
  });
  const elapsed = days.filter((d) => !d.future),
    complete = elapsed.filter((d) => d.complete);
  const outsideKnown = complete.filter((d) => d.m.outside !== null);
  const weeks = new Map<
    string,
    {
      from: string;
      to: string;
      assigned: number;
      worked: number;
      recordedDays: number;
      assignedKnownDays: number;
      missingDays: number;
    }
  >();
  for (const d of days) {
    const day = new Date(d.date + "T12:00:00Z");
    day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
    const key = day.toISOString().slice(0, 10);
    const w = weeks.get(key) || {
      from: d.date,
      to: d.date,
      assigned: 0,
      worked: 0,
      recordedDays: 0,
      assignedKnownDays: 0,
      missingDays: 0,
    };
    w.to = d.date;
    if (!d.future) {
      w.assigned += d.assigned || 0;
      if (d.s && (!d.m.scheduled || d.m.timed)) w.assignedKnownDays++;
      if (d.complete) {
        w.worked += d.m.worked || 0;
        w.recordedDays++;
      }
      if (d.issue) w.missingDays++;
    }
    weeks.set(key, w);
  }
  let streak = 0,
    longestStreak = 0;
  for (const d of elapsed) {
    streak = d.complete ? streak + 1 : 0;
    longestStreak = Math.max(streak, longestStreak);
  }
  const gaps = complete
    .slice(1)
    .map((d, i) => {
      const previous = complete[i];
      // A gap is assessable only when every intervening date has a known off
      // assignment and no attendance; missing/unfinished records must not inflate it.
      const between = days.filter(
        (x) => x.date > previous.date && x.date < d.date,
      );
      if (between.some((x) => !x.off || x.a || x.issue)) return null;
      const span =
        (Date.parse(d.date + "T00:00:00Z") -
          Date.parse(previous.date + "T00:00:00Z")) /
        60000;
      return span + minutes(d.a!.check_in)! - minutes(previous.a!.check_out)!;
    })
    .filter((v): v is number => v !== null && v >= 0);
  const typicalEnd = complete
    .map((d) => minutes(d.a!.check_out)!)
    .sort((a, b) => a - b);
  const medianEnd = typicalEnd.length
    ? Math.round(
        (typicalEnd[Math.floor((typicalEnd.length - 1) / 2)] +
          typicalEnd[Math.floor(typicalEnd.length / 2)]) /
          2,
      )
    : null;
  return {
    days,
    weeks: [...weeks.values()],
    today,
    completeDays: complete.length,
    worked: complete.length
      ? complete.reduce((n, d) => n + (d.m.worked || 0), 0)
      : null,
    assigned: elapsed.reduce((n, d) => n + (d.assigned || 0), 0),
    outside: outsideKnown.length
      ? outsideKnown.reduce((n, d) => n + d.m.outside!, 0)
      : null,
    outsideUnknown: complete.length - outsideKnown.length,
    offDays: elapsed.filter((d) => d.off && !d.m.present && !d.issue).length,
    review: elapsed.filter((d) => d.issue).length,
    active: elapsed.filter((d) => d.m.active).length,
    unassigned: elapsed.filter((d) => !d.s && !d.a).length,
    untimed: elapsed.filter((d) => d.m.scheduled && !d.m.timed).length,
    longestStreak: complete.length ? longestStreak : null,
    shortestGap: gaps.length ? Math.min(...gaps) : null,
    medianEnd,
    nextOff:
      days.find((d) => d.date >= today && d.off && !d.m.present && !d.issue)
        ?.date || null,
  };
}
