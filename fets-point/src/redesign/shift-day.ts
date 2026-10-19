import {
  LANES,
  resolvedOwner,
  type CoverageChange,
  type DayPlan,
  type Lane,
} from "./shift-plan";

export type PersonalSlot = {
  start: number;
  end: number;
  lanes: Lane[];
  kind: "post" | "break";
  cover: string[];
};

/** Display the published agreement minute by minute, including named cover and amendments.
 * A post ends at the next actual change, which may be a break inside a rotation. */
export function personalSchedule(
  plan: DayPlan,
  changes: CoverageChange[],
  person: string,
): PersonalSlot[] {
  const slots: PersonalSlot[] = [];
  plan.blocks.forEach((block, index) => {
    for (let minute = block.start; minute < block.end; minute++) {
      const lanes = LANES.filter(
        (lane) => resolvedOwner(plan, index, lane, minute, changes) === person,
      );
      const pause = plan.breaks.find(
        (b) => b.staff === person && b.start <= minute && minute < b.end,
      );
      if (!lanes.length && !pause) continue;
      const kind = lanes.length ? "post" : "break";
      const cover =
        kind === "break"
          ? [
              ...new Set(
                LANES.filter((lane) => block.owners[lane] === person)
                  .map((lane) =>
                    resolvedOwner(plan, index, lane, minute, changes),
                  )
                  .filter(Boolean),
              ),
            ]
          : [];
      const last = slots[slots.length - 1];
      if (
        last &&
        last.end === minute &&
        last.kind === kind &&
        last.lanes.join() === lanes.join() &&
        last.cover.join() === cover.join()
      ) {
        last.end = minute + 1;
      } else slots.push({ start: minute, end: minute + 1, lanes, kind, cover });
    }
  });
  return slots;
}
