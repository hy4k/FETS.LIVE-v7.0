import {
  calendarTimeMinutes,
  hasUsableSessionTiming,
} from "./calendar-analysis-time";
export interface PlanningSession {
  id: number;
  date: string;
  client_name: string;
  exam_name: string;
  candidate_count: number;
  start_time: string | null;
  end_time: string | null;
  branch_location?: string | null;
  status?: string | null;
}
export function analyseCalendar(source: PlanningSession[]) {
  const sessions = source.filter(
    (s) => !["cancelled", "canceled"].includes((s.status || "").toLowerCase()),
  );
  const groups = new Map<string, PlanningSession[]>();
  for (const s of sessions) {
    const key = `${s.date}|${s.branch_location || "calicut"}`;
    groups.set(key, [...(groups.get(key) || []), s]);
  }
  const days = [...groups]
    .map(([key, rows]) => {
      const [date, centre] = key.split("|");
      let peak = 0,
        peakTime: number | null = null,
        active = 0;
      const events: { time: number; delta: number }[] = [];
      for (const s of rows.filter(hasUsableSessionTiming)) {
        events.push(
          {
            time: calendarTimeMinutes(s.start_time)!,
            delta: Number(s.candidate_count) || 0,
          },
          {
            time: calendarTimeMinutes(s.end_time)!,
            delta: -(Number(s.candidate_count) || 0),
          },
        );
      }
      // Endings free seats before arrivals at the same minute.
      events.sort((a, b) => a.time - b.time || a.delta - b.delta);
      for (const e of events) {
        active += e.delta;
        if (active > peak) {
          peak = active;
          peakTime = e.time;
        }
      }
      const capacity =
        centre === "calicut" ? 40 : centre === "cochin" ? 31 : null;
      return {
        date,
        centre,
        rows,
        candidates: rows.reduce(
          (n, s) => n + (Number(s.candidate_count) || 0),
          0,
        ),
        missing: rows.filter((s) => !hasUsableSessionTiming(s)),
        peak,
        peakTime,
        capacity,
        overCapacity: capacity !== null && peak > capacity,
      };
    })
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.centre.localeCompare(b.centre),
    );
  const mix = new Map<
    string,
    { client: string; exam: string; sessions: number; candidates: number }
  >();
  for (const s of sessions) {
    const client = s.client_name?.trim() || "Client not specified",
      exam = s.exam_name?.trim() || "Programme not specified",
      key = `${client.toUpperCase()}|${exam.toUpperCase()}`;
    const v = mix.get(key) || { client, exam, sessions: 0, candidates: 0 };
    v.sessions++;
    v.candidates += Number(s.candidate_count) || 0;
    mix.set(key, v);
  }
  return {
    sessions,
    days,
    mix: [...mix.values()].sort((a, b) => b.candidates - a.candidates),
    candidates: sessions.reduce(
      (n, s) => n + (Number(s.candidate_count) || 0),
      0,
    ),
    missing: sessions.filter((s) => !hasUsableSessionTiming(s)),
    cancelled: source.length - sessions.length,
  };
}
export function csvCell(v: unknown) {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
