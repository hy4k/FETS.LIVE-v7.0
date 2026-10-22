import {
  attendanceMetrics,
  clockParts,
  duration,
  effectiveShift,
  formatTime,
  shiftName,
  timing,
  type Snapshot,
} from "./model";
export function attendanceReport(
  data: Snapshot,
  personId: string,
  month: string,
  branch: string,
  now: Date,
) {
  const today = clockParts(now).day;
  const person = data.people.find((p) => p.id === personId);
  if (!person) throw Error("Choose a staff member.");
  const schedules = data.schedules
    .filter((s) => s.profile_id === personId && s.date.startsWith(month))
    .map(effectiveShift);
  const attendance = data.attendance.filter(
    (a) => a.staff_id === personId && a.date.startsWith(month),
  );
  const days = [
    ...new Set([
      ...schedules.map((s) => s.date),
      ...attendance.map((a) => a.date),
    ]),
  ].sort();
  const rows = days
    .filter((d) => d <= today)
    .flatMap((date) => {
      const s = schedules.find((s) => s.date === date),
        a = attendance.find((a) => a.date === date);
      const centre = (
        s?.branch_location ||
        a?.branch_location ||
        person.branch_assigned
      ).toLowerCase();
      if (branch !== "global" && centre !== branch) return [];
      return [{ date, s, a, centre, m: attendanceMetrics(a, s, date, now) }];
    });
  const comparable = rows.filter((r) => r.m.comparable),
    complete = rows.filter((r) => r.m.complete);
  const late = comparable.filter((r) => (r.m.late || 0) > 0);
  const gaps = rows.filter(
    (r) => r.m.missingIn || r.m.missingOut || r.m.invalid,
  );
  const early = rows.filter((r) => (r.m.early || 0) > 0);
  const unknown = rows.filter((r) => r.m.present && !r.m.timed);
  const title = `Attendance review - ${person.full_name} - ${month}`;
  const summary = [
    `Period: ${month}. Reviewed through ${today < month + "-31" ? today : "month end"} (IST). Centre: ${branch === "global" ? "both centres" : branch}.`,
    `Scheduled workdays in this period: ${rows.filter((r) => r.m.scheduled).length}. Check-ins recorded: ${rows.filter((r) => r.m.present).length}.`,
    `On time: ${comparable.length - late.length} of ${comparable.length} check-ins with assessable shift timings. Late arrivals: ${late.length} (${late.reduce((n, r) => n + (r.m.late || 0), 0)} minutes beyond the saved grace).`,
    `Early departures: ${early.length} (${early.reduce((n, r) => n + (r.m.early || 0), 0)} minutes).`,
    `Completed net work: ${duration(complete.reduce((n, r) => n + (r.m.worked || 0), 0))} across ${complete.length} completed records. Ongoing or incomplete records are excluded from this total.`,
    `Approved overtime on roster: ${Number(rows.reduce((n, r) => n + Number(r.s?.overtime_hours || 0), 0).toFixed(2))} hours. Time outside a shift does not automatically qualify as approved overtime.`,
    `Records needing correction/review: ${gaps.length}. Check-ins without assessable shift timings: ${unknown.length}. Missing check-ins are not automatically treated as absence.`,
    "Punctuality uses each assigned shift and its saved grace. Normal untimed Day entries use the established 8 AM-5 PM default; other unknown timings are not scored.",
  ].join("\n\n");
  const evidence = rows
    .map(
      (r) =>
        `${r.date} | ${r.centre} | ${r.s ? shiftName(r.s) + (r.m.scheduled ? ": " + (timing(r.s) || "Timing unavailable") + `; grace ${r.s.grace_minutes}m` : "") : "No roster"}\nIn ${formatTime(r.a?.check_in)} / Out ${formatTime(r.a?.check_out)} | ${r.m.status} | Late ${r.m.late === null ? "unassessed" : r.m.late + "m"} | Early ${r.m.early === null ? "unassessed" : r.m.early + "m"} | Net ${r.m.complete ? duration(r.m.worked) : r.m.scheduled || r.m.present ? "incomplete" : "not applicable"} | Outside shift ${duration(r.m.outside)} | Approved OT ${r.s?.overtime_hours || 0}h`,
    )
    .join("\n\n");
  return {
    title,
    summary,
    evidence: evidence || "No records in this period and centre.",
    count: rows.length,
    generated: `${today} ${clockParts(now).time} IST`,
  };
}
export async function downloadReport(
  title: string,
  text: string,
  filename: string,
) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF();
  const clean = (s: string) =>
    s
      .replace(/[–—]/g, "-")
      .replace(/·/g, "|")
      .replace(/[“”]/g, '"')
      .replace(/[’]/g, "'");
  let y = 22;
  pdf.setFont("helvetica", "normal");
  for (const [index, block] of [title, text].entries()) {
    pdf.setFontSize(index === 0 ? 15 : 10);
    const lines: string[] = pdf.splitTextToSize(clean(block), 174);
    for (const line of lines) {
      if (y > 276) {
        pdf.addPage();
        y = 22;
      }
      pdf.text(line, 18, y);
      y += index === 0 ? 8 : 5;
    }
    y += 7;
  }
  const total = pdf.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    pdf.setPage(p);
    pdf.setFontSize(8);
    pdf.setTextColor(100);
    pdf.text(`FETS Live | Private attendance review | ${p}/${total}`, 18, 290);
  }
  pdf.save(filename);
}
