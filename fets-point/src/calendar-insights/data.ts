import { fetchCalendarRange } from "../seats/calendar-data";
import { toSeatSecond } from "../seats/engine";
import { fetchSeatPlanningRange } from "../seats/planning-range";
import { calendarMonthRange } from "./model";
import type { InsightData, InsightRange } from "./types";

const message = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export async function fetchInsightData(
  range: InsightRange,
  branch: string
): Promise<InsightData> {
  if (!["calicut", "cochin", "global"].includes(branch))
    throw new Error("Choose a valid Calendar centre.");
  const checked = calendarMonthRange(range.startMonth, range.endMonth);
  if (
    ["from", "through", "previousFrom", "previousThrough"].some(
      (key) => range[key] !== checked[key]
    )
  ) {
    throw new Error("Choose a valid Calendar insights range.");
  }
  const carryFrom = new Date(
    (toSeatSecond(range.from, "00:00")! - 86400) * 1000
  )
    .toISOString()
    .slice(0, 10);
  // Each optional read handles its own error. Current bookings remain the
  // report's required input; neither optional failure turns into zero data.
  const current = fetchCalendarRange(range.from, range.through, branch);
  const previous = fetchCalendarRange(
    range.previousFrom,
    range.previousThrough,
    branch
  ).then(
    (sessions) => ({ sessions, error: null }),
    (error) => ({
      sessions: null,
      error: message(error, "Previous-period bookings could not be loaded."),
    })
  );
  const seats = fetchSeatPlanningRange(branch, carryFrom, range.through).then(
    (context) => ({ context, error: null }),
    (error) => ({
      context: null,
      error: message(error, "Seat context could not be loaded."),
    })
  );
  const [sessions, prior, seat] = await Promise.all([current, previous, seats]);
  return {
    sessions,
    previousSessions: prior.sessions,
    context: seat.context,
    previousError: prior.error,
    seatError: seat.error,
  };
}
