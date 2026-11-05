import type { CoverageChange, PlanRecord } from "./shift-plan";
/** Shared by The Shift and roster. Changes must be ordered by creation time/id. */
export function dayLead(
  record: PlanRecord | null,
  weekLead: string | null | undefined,
  changes: CoverageChange[],
  now = new Date(),
) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (key: string) => parts.find((p) => p.type === key)!.value;
  const today = `${value("year")}-${value("month")}-${value("day")}`;
  const minute = Number(value("hour")) * 60 + Number(value("minute"));
  const day = record?.day;
  const lead = changes.filter(
    (c) =>
      c.kind === "lead" &&
      day &&
      (day < today || (day === today && c.starts <= minute)),
  );
  return (
    lead[lead.length - 1]?.staff_id ||
    record?.plan.actingLead ||
    record?.lead_id ||
    weekLead ||
    ""
  );
}
