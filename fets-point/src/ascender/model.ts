export const CENTRE_NAMES: Record<string, string> = {
  calicut: "Calicut",
  cochin: "Cochin",
  mobile: "Mobile unit",
};
export function istDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function monday(day: string) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export function safeLink(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function renewalState(row: any, day = istDay()) {
  if (!row.next_due)
    return { days: null, label: "Date not recorded", attention: false };
  const days = Math.round(
    (Date.parse(row.next_due + "T12:00:00Z") - Date.parse(day + "T12:00:00Z")) /
      86400000,
  );
  return {
    days,
    label:
      days < 0
        ? "Overdue"
        : days === 0
          ? "Due today"
          : days <= row.lead_days
            ? "Due soon"
            : "Upcoming",
    attention: days <= row.lead_days,
  };
}
export function capacity(rooms: any[]) {
  const current = rooms.filter((r) => !r.archived);
  return current.length
    ? {
        total: current.every((r) => typeof r.total_seats === "number")
          ? current.reduce((n, r) => n + r.total_seats, 0)
          : null,
        usable: current.every(
          (r) =>
            typeof r.total_seats === "number" &&
            typeof r.unavailable_seats === "number",
        )
          ? current.reduce((n, r) => n + r.total_seats - r.unavailable_seats, 0)
          : null,
      }
    : null;
}
export function validateRecord(table: string, row: any) {
  if (
    table === "ascender_inventory" &&
    row.quantity != null &&
    (!Number.isInteger(row.quantity) ||
      row.quantity < 0 ||
      row.quantity > 1000000)
  )
    throw Error("Quantity must be a whole number from 0 to 1,000,000.");
  if (
    table === "ascender_rooms" &&
    row.unavailable_seats != null &&
    row.total_seats != null &&
    row.unavailable_seats > row.total_seats
  )
    throw Error("Unavailable seats cannot exceed total seats.");
  for (const key of ["url", "map_url", "evidence_url"])
    if (row[key] && !safeLink(row[key]))
      throw Error("Use a complete HTTPS link without embedded login details.");
  if (table === "ascender_deployments") {
    if (row.end_date && row.start_date && row.end_date < row.start_date)
      throw Error("End date must be on or after the start date.");
    if (row.setup_due && row.start_date && row.setup_due > row.start_date)
      throw Error("Setup must be due before or on the first exam date.");
  }
}
