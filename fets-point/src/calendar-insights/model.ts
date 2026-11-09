import {
  analyseDay,
  formatSeatTime,
  normaliseProvider,
  seatBranch,
  toSeatSecond,
} from "../seats/engine";
import {
  criticalInterval,
  criticalLoad,
  intervalCapacity,
} from "../seats/presentation";
import type {
  SeatBranch,
  SeatCapacityAdjustment,
  SeatContext,
  SeatDay,
  SeatDetail,
  SeatSession,
} from "../seats/types";
import type {
  CalendarInsightsInput,
  CalendarInsightsModel,
  InsightAttention,
  InsightCentre,
  InsightCritical,
  InsightDay,
  InsightProvider,
  InsightRange,
  InsightVolume,
} from "./types";

const DAY = 86400;
const statusKey = (status: string | null | undefined) =>
  status
    ?.trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_") || "";
export const isCancelled = (session: { status?: string | null }) =>
  ["cancelled", "canceled"].includes(statusKey(session.status));
const validCount = (count: number | null): count is number =>
  typeof count === "number" && Number.isSafeInteger(count) && count >= 0;
const validDate = (date: string) => toSeatSecond(date, "00:00") !== null;
const providerName = (session: SeatSession) =>
  normaliseProvider(session.client_name || "") || "Unspecified provider";
const dateAt = (seconds: number) =>
  new Date(seconds * 1000).toISOString().slice(0, 10);
const branchLabel = (branch: SeatBranch) =>
  branch === "cochin" ? "Kochi" : "Calicut";

export function indiaToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((value) => value.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

const monthIndex = (month: string) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    throw new Error("Choose valid calendar months.");
  return Number(month.slice(0, 4)) * 12 + Number(month.slice(5)) - 1;
};
const monthKey = (index: number) =>
  `${String(Math.floor(index / 12)).padStart(4, "0")}-${String(
    (index % 12) + 1
  ).padStart(2, "0")}`;
const monthEnd = (index: number) => {
  const key = monthKey(index),
    year = Math.floor(index / 12),
    month = (index % 12) + 1;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days =
    month === 2 ? (leap ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;
  return `${key}-${days}`;
};
const periodLabel = (first: string, last: string) => {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const label = (month: string) =>
    formatter.format(new Date(`${month}-01T00:00:00Z`));
  return first === last ? label(first) : `${label(first)} – ${label(last)}`;
};

export function calendarMonthRange(
  startMonth: string,
  endMonth: string = startMonth
): InsightRange {
  const first = monthIndex(startMonth),
    last = monthIndex(endMonth),
    months = last - first + 1;
  if (months < 1 || months > 12 || first - months < 0)
    throw new Error("Choose one to twelve consecutive calendar months.");
  const previousStart = monthKey(first - months),
    previousEnd = monthKey(first - 1);
  return {
    startMonth,
    endMonth,
    from: `${startMonth}-01`,
    through: monthEnd(last),
    previousFrom: `${previousStart}-01`,
    previousThrough: monthEnd(first - 1),
    label: periodLabel(startMonth, endMonth),
    previousLabel: periodLabel(previousStart, previousEnd),
  };
}

/** Metadata changes alone do not change a Calendar reservation. */
const sessionSignature = (session: SeatSession) =>
  JSON.stringify([
    session.date,
    seatBranch(session.branch_location) || session.branch_location || null,
    providerName(session),
    session.exam_name || null,
    session.start_time || null,
    session.end_time || null,
    session.candidate_count,
    statusKey(session.status),
  ]);

function uniqueSessions(sessions: SeatSession[]) {
  const groups = new Map<number, Map<string, SeatSession>>();
  for (const session of sessions) {
    if (!groups.has(session.id)) groups.set(session.id, new Map());
    groups.get(session.id)!.set(sessionSignature(session), session);
  }
  const conflicts = [...groups]
    .filter(([, variants]) => variants.size > 1)
    .map(([id]) => id)
    .sort((a, b) => a - b);
  return {
    rows: [...groups.values()]
      .filter((variants) => variants.size === 1)
      .map((variants) => [...variants.values()][0]),
    variants: [...groups.values()].flatMap((variants) => [
      ...variants.values(),
    ]),
    conflicts,
  };
}

function periodSessions(
  sessions: SeatSession[],
  from: string,
  through: string
) {
  return sessions.filter(
    (session) =>
      !validDate(session.date) ||
      (session.date >= from && session.date <= through)
  );
}

export function volumeForSessions(
  sessions: SeatSession[],
  from: string,
  through: string,
  today: string
): InsightVolume {
  const unique = uniqueSessions(periodSessions(sessions, from, through));
  const result: InsightVolume = {
    candidates: 0,
    sessionCount: 0,
    bookedDays: 0,
    providerCount: 0,
    upcomingCandidates: 0,
    cancelledSessions: 0,
    invalidCounts: 0,
    unassignedCentres: 0,
    invalidDates: 0,
    conflictingIds: unique.conflicts,
    complete: true,
  };
  const days = new Set<string>(),
    providers = new Set<string>();
  for (const session of unique.rows) {
    if (isCancelled(session)) {
      result.cancelledSessions++;
      continue;
    }
    if (!validDate(session.date)) {
      result.invalidDates++;
      continue;
    }
    result.sessionCount++;
    days.add(session.date);
    providers.add(providerName(session));
    if (!seatBranch(session.branch_location)) result.unassignedCentres++;
    if (!validCount(session.candidate_count)) {
      result.invalidCounts++;
      continue;
    }
    result.candidates += session.candidate_count;
    if (session.date >= today)
      result.upcomingCandidates += session.candidate_count;
  }
  result.bookedDays = days.size;
  result.providerCount = providers.size;
  result.complete =
    !result.invalidCounts &&
    !result.invalidDates &&
    !result.unassignedCentres &&
    !result.conflictingIds.length;
  return result;
}

/** Details are grouped by these source columns in the protected snapshot. */
const sourceKey = (detail: SeatDetail) =>
  JSON.stringify([
    detail.session_id,
    detail.branch_location,
    detail.provider,
    detail.date,
    detail.start_time,
    detail.end_time,
    detail.exam_code,
    detail.exam_title,
    detail.status,
  ]);

function cleanContext(context: SeatContext) {
  const groups = new Map<string, SeatDetail[]>(),
    conflictingSources = new Set<number>();
  for (const detail of context.details) {
    const key = sourceKey(detail),
      group = groups.get(key) || [];
    if (!group.some((row) => row.count === detail.count)) group.push(detail);
    groups.set(key, group);
  }
  for (const group of groups.values())
    if (group.length > 1) conflictingSources.add(group[0].session_id);
  const capacity = new Map<string, SeatCapacityAdjustment[]>();
  const capacitySignature = (window: SeatCapacityAdjustment) =>
    JSON.stringify([
      window.branch_location,
      window.date,
      window.extra_systems,
      window.start_time,
      window.end_time,
    ]);
  for (const window of context.capacity_adjustments || []) {
    const key = `${window.branch_location}:${window.date}`,
      group = capacity.get(key) || [];
    if (
      !group.some((row) => capacitySignature(row) === capacitySignature(window))
    )
      group.push(window);
    capacity.set(key, group);
  }
  const conflictingCapacity = new Set(
    [...capacity].filter(([, group]) => group.length > 1).map(([key]) => key)
  );
  return {
    details: [...groups.values()].flat(),
    conflictingSources,
    conflictingCapacity,
    capacity: [...capacity]
      .filter(([key]) => !conflictingCapacity.has(key))
      .map(([, group]) => group[0]),
  };
}

function providerVolumes(
  sessions: SeatSession[],
  from: string,
  through: string
) {
  const result = new Map<
    string,
    { candidates: number; sessionCount: number }
  >();
  for (const session of uniqueSessions(periodSessions(sessions, from, through))
    .rows) {
    if (isCancelled(session) || !validDate(session.date)) continue;
    const name = providerName(session),
      value = result.get(name) || { candidates: 0, sessionCount: 0 };
    value.sessionCount++;
    if (validCount(session.candidate_count))
      value.candidates += session.candidate_count;
    result.set(name, value);
  }
  return result;
}

function criticalForDay(day: SeatDay): InsightCritical | null {
  const interval = criticalInterval(day);
  if (!interval || interval.booked === 0) return null;
  const load = criticalLoad(day);
  return {
    date: day.date,
    start: interval.start,
    end: interval.end,
    booked: load.booked,
    capacity: load.capacity,
  };
}

const criticalSeverity = (critical: InsightCritical) =>
  critical.booked - critical.capacity;
const compareCritical = (a: InsightCritical, b: InsightCritical) =>
  criticalSeverity(b) - criticalSeverity(a) ||
  b.booked / b.capacity - a.booked / a.capacity ||
  a.start - b.start;

export function buildCalendarInsights(
  input: CalendarInsightsInput
): CalendarInsightsModel {
  const { sessions, previousSessions, context, range, today } = input;
  const volume = volumeForSessions(sessions, range.from, range.through, today);
  const previous =
    previousSessions === null
      ? null
      : volumeForSessions(
          previousSessions,
          range.previousFrom,
          range.previousThrough,
          today
        );
  const currentProviders = providerVolumes(sessions, range.from, range.through);
  const priorProviders = providerVolumes(
    previousSessions || [],
    range.previousFrom,
    range.previousThrough
  );
  const comparable = volume.complete && !!previous?.complete;
  const providers: InsightProvider[] = [
    ...new Set([...currentProviders.keys(), ...priorProviders.keys()]),
  ]
    .map((name) => {
      const current = currentProviders.get(name) || {
        candidates: 0,
        sessionCount: 0,
      };
      const prior = comparable
        ? priorProviders.get(name)?.candidates || 0
        : null;
      return {
        name,
        ...current,
        share: volume.candidates ? current.candidates / volume.candidates : 0,
        previousCandidates: prior,
        change: prior === null ? null : current.candidates - prior,
      };
    })
    .sort(
      (a, b) => b.candidates - a.candidates || a.name.localeCompare(b.name)
    );
  const branches: SeatBranch[] =
    input.branch === "global"
      ? ["calicut", "cochin"]
      : seatBranch(input.branch)
      ? [seatBranch(input.branch)!]
      : [];
  const clean = context ? cleanContext(context) : null;
  const allSessions = uniqueSessions([
    ...sessions,
    ...(context?.adjacent_sessions || []),
  ]).variants;
  const byDate = new Map<string, SeatDay[]>(),
    attention: InsightAttention[] = [];
  const qualityNotes: string[] = [];
  const dates: string[] = [];
  const first = toSeatSecond(range.from, "00:00"),
    last = toSeatSecond(range.through, "00:00");
  if (
    first === null ||
    last === null ||
    last < first ||
    (last - first) / DAY > 366
  )
    throw new Error("Choose a valid Calendar insights range.");
  for (let day = first; day <= last; day += DAY) dates.push(dateAt(day));
  const knownCurrent = uniqueSessions(
    periodSessions(sessions, range.from, range.through)
  ).rows;
  const centres: InsightCentre[] = branches.map((branch) => {
    const ownVolume = volumeForSessions(
      knownCurrent.filter(
        (session) => seatBranch(session.branch_location) === branch
      ),
      range.from,
      range.through,
      today
    );
    const centre: InsightCentre = {
      branch,
      label: branchLabel(branch),
      candidates: ownVolume.candidates,
      sessionCount: ownVolume.sessionCount,
      bookedDays: ownVolume.bookedDays,
      overbookedDays: 0,
      fullDays: 0,
      incompleteDays: context ? 0 : dates.length,
      critical: null,
      seatHours: context ? 0 : null,
    };
    if (!context || !clean) return centre;
    const criticals: InsightCritical[] = [];
    for (const date of dates) {
      const day = analyseDay(
        allSessions,
        branch,
        date,
        clean.details,
        clean.capacity
      );
      // A changed duplicate source group can accidentally sum to the Calendar
      // count. Keep the source conflict blocking even in that coincidence.
      const sourceOnDate = clean.details.some(
        (detail) =>
          clean.conflictingSources.has(detail.session_id) &&
          (detail.date === date || !detail.date || !validDate(detail.date)) &&
          (!seatBranch(detail.branch_location) ||
            seatBranch(detail.branch_location) === branch)
      );
      const conflictingCarryIn = day.atoms.some((atom) =>
        clean.conflictingSources.has(atom.session_id)
      );
      const capacityConflict = clean.conflictingCapacity.has(
        `${branch}:${date}`
      );
      if (sourceOnDate || conflictingCarryIn || capacityConflict) {
        day.complete = false;
        day.issues.push({
          session_id: null,
          kind: "conflicting_context",
          blocking: true,
          message: capacityConflict
            ? "Confirmed additional-system snapshots conflict. Refresh before checking this centre-day."
            : "Source group snapshots conflict. Refresh before checking seats.",
        });
        if (capacityConflict) {
          day.overbooked = [];
          day.full = [];
        }
        day.status = day.overbooked.length ? "overbooked" : "incomplete";
      }
      byDate.set(date, [...(byDate.get(date) || []), day]);
      if (day.overbooked.length) centre.overbookedDays++;
      if (day.full.length) centre.fullDays++;
      if (!day.complete) {
        centre.incompleteDays++;
        centre.seatHours = null;
      }
      if (centre.seatHours !== null)
        centre.seatHours += day.segments.reduce(
          (sum, segment) =>
            sum + (segment.booked * (segment.end - segment.start)) / 3600,
          0
        );
      if (!capacityConflict) {
        const critical = criticalForDay(day);
        if (critical) criticals.push(critical);
      }
      for (const [kind, segments] of [
        ["overbooked", day.overbooked],
        ["full", day.full],
      ] as const) {
        for (const segment of segments) {
          const capacity = intervalCapacity(day, segment);
          attention.push({
            id: `${branch}:${date}:${kind}:${segment.start}:${segment.end}`,
            date,
            branch,
            kind,
            title: `${branchLabel(branch)}: ${
              kind === "full" ? "full" : "overbooked"
            } ${formatSeatTime(segment.start)}–${formatSeatTime(segment.end)}`,
            detail: `${
              segment.booked
            } simultaneously booked / ${capacity} confirmed seats${
              kind === "overbooked" ? `; ${segment.excess} over capacity` : ""
            }.`,
            start: segment.start,
            end: segment.end,
            booked: segment.booked,
            capacity,
            excess: segment.excess,
          });
        }
      }
      if (!day.complete)
        attention.push({
          id: `${branch}:${date}:incomplete`,
          date,
          branch,
          kind: "incomplete",
          title: `${branchLabel(branch)}: incomplete scheduling details`,
          detail: [
            ...new Set(
              day.issues
                .filter((issue) => issue.blocking)
                .map((issue) => issue.message)
            ),
          ].join(" "),
          start: null,
          end: null,
          booked: null,
          capacity: null,
          excess: null,
        });
    }
    centre.critical = criticals.sort(compareCritical)[0] || null;
    return centre;
  });
  const dailyVolume = new Map<
    string,
    { candidates: number; sessionCount: number }
  >();
  for (const session of uniqueSessions(
    periodSessions(sessions, range.from, range.through)
  ).rows) {
    if (isCancelled(session) || !validDate(session.date)) continue;
    const day = dailyVolume.get(session.date) || {
      candidates: 0,
      sessionCount: 0,
    };
    day.sessionCount++;
    if (validCount(session.candidate_count))
      day.candidates += session.candidate_count;
    dailyVolume.set(session.date, day);
  }
  const days: InsightDay[] = dates.map((date) => {
    const count = dailyVolume.get(date) || { candidates: 0, sessionCount: 0 },
      seats = byDate.get(date) || [];
    const status: InsightDay["status"] =
      !context || !branches.length
        ? "unavailable"
        : seats.some((day) => day.overbooked.length)
        ? "overbooked"
        : seats.some((day) => !day.complete)
        ? "incomplete"
        : seats.some((day) => day.full.length)
        ? "full"
        : count.sessionCount
        ? "scheduled"
        : "no_bookings";
    return { date, ...count, status };
  });
  if (volume.cancelledSessions)
    qualityNotes.push(
      `${volume.cancelledSessions} cancelled Calendar sessions excluded.`
    );
  if (volume.invalidCounts)
    qualityNotes.push(
      `${volume.invalidCounts} recorded sessions have invalid candidate counts and are excluded from candidate totals.`
    );
  if (volume.invalidDates)
    qualityNotes.push(
      `${volume.invalidDates} records have invalid dates and are excluded from dated volume.`
    );
  if (volume.unassignedCentres)
    qualityNotes.push(
      `${volume.unassignedCentres} sessions have unassigned or unrecognised centres; their bookings are not allocated to either seat pool.`
    );
  if (volume.conflictingIds.length)
    qualityNotes.push(
      `Conflicting Calendar session IDs excluded from known volume: ${volume.conflictingIds.join(
        ", "
      )}.`
    );
  if (clean?.conflictingSources.size)
    qualityNotes.push(
      "Conflicting source group snapshots prevent complete seat conclusions."
    );
  if (clean?.conflictingCapacity.size)
    qualityNotes.push(
      "Conflicting confirmed-capacity snapshots prevent seat conclusions for affected centre-days."
    );
  if (centres.some((centre) => centre.incompleteDays))
    qualityNotes.push(
      "Some centre-days remain unverified; known full and overbooked windows are still shown."
    );
  if (!context)
    qualityNotes.push(
      "Seat context unavailable; booking volume does not establish seat availability."
    );
  if (!previous)
    qualityNotes.push("Previous-period booking volume unavailable.");
  else if (!comparable)
    qualityNotes.push(
      "Incomplete booking volume prevents a complete comparison with the previous period."
    );
  const severity = { overbooked: 0, incomplete: 1, full: 2 };
  attention.sort(
    (a, b) =>
      severity[a.kind] - severity[b.kind] ||
      a.date.localeCompare(b.date) ||
      a.branch.localeCompare(b.branch) ||
      (a.start || 0) - (b.start || 0)
  );
  return {
    volume,
    previous,
    providers,
    centres,
    days,
    attention,
    qualityNotes,
    capacityAvailable: !!context && !!branches.length,
  };
}

export function exportCalendarCsv(
  sessions: SeatSession[],
  range: InsightRange
): string {
  const unique = uniqueSessions(
    periodSessions(sessions, range.from, range.through)
  );
  const quote = (value: unknown) => {
    let text = String(value ?? "");
    if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text))
      text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const rows: unknown[][] = [
    [
      "Session ID",
      "Date",
      "Centre",
      "Provider",
      "Exam",
      "Candidates",
      "Start time",
      "End time",
      "Status",
      "Data quality",
    ],
  ];
  for (const session of unique.variants.filter((row) => !isCancelled(row))) {
    const quality: string[] = [];
    if (!validCount(session.candidate_count)) quality.push("Invalid count");
    if (!validDate(session.date)) quality.push("Invalid date");
    if (!seatBranch(session.branch_location)) quality.push("Unassigned centre");
    if (unique.conflicts.includes(session.id))
      quality.push("Conflicting session ID");
    rows.push([
      session.id,
      session.date || "Invalid date",
      session.branch_location || "Unassigned",
      session.client_name || "Unspecified provider",
      session.exam_name || "Unspecified exam",
      session.candidate_count === null
        ? "Missing (invalid count)"
        : session.candidate_count,
      session.start_time || "Unspecified",
      session.end_time || "Unspecified",
      session.status || "Unspecified",
      quality.join("; "),
    ]);
  }
  return rows.map((row) => row.map(quote).join(",")).join("\r\n");
}
