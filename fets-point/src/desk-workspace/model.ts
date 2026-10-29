export const indiaDay = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
export function tenure(joined?: string, now = new Date()) {
  if (!joined || !/^\d{4}-\d{2}-\d{2}$/.test(joined)) return null;
  const start = Date.parse(joined + "T00:00:00Z");
  if (
    !Number.isFinite(start) ||
    new Date(start).toISOString().slice(0, 10) !== joined
  )
    return null;
  const days =
    Math.floor((Date.parse(indiaDay(now) + "T00:00:00Z") - start) / 86400000) +
    1;
  return days > 0 ? days : null;
}
