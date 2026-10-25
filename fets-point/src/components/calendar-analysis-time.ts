/** Incomplete session timings must not be guessed or treated as midnight. */
export function calendarTimeMinutes(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]),
    minutes = Number(match[2]),
    seconds = Number(match[3] || 0);
  return hours < 24 && minutes < 60 && seconds < 60
    ? hours * 60 + minutes + seconds / 60
    : null;
}
export function hasUsableSessionTiming(session: {
  start_time?: unknown;
  end_time?: unknown;
}): boolean {
  const start = calendarTimeMinutes(session.start_time),
    end = calendarTimeMinutes(session.end_time);
  return start !== null && end !== null && end > start;
}
