import { ArrowRight, ClipboardList, Users } from "lucide-react";
import {
  WORK_STATUS,
  type ActionablesData,
  type WorkItem,
} from "./actionables-model";
const SOURCE_LABELS: Record<string, string> = {
  todo: "To do",
  inprogress: "In progress",
  done: "Completed in project brief",
};
export const SOURCE_TASK_INSTITUTIONS: Record<number, string> = {
  1: "cochin-rajagiri",
  2: "thrissur-vidya",
  3: "kottayam-saintgits",
  4: "calicut-gec",
  5: "thrissur-sahrdaya",
};
export default function ActionablesSourceBoard({
  data,
  onAssign,
  onResult,
}: {
  data: ActionablesData;
  onAssign: (key: number) => void;
  onResult: (t: WorkItem) => void;
}) {
  return (
    <section className="aw-source-board">
      <div className="aw-section-heading">
        <div>
          <span className="aw-eyebrow">THE PROJECT BRIEF, IN ONE PLACE</span>
          <h2>Who is moving what forward?</h2>
          <p>
            The recorded team tasks. Add a named owner and reporting plan when
            bringing a task into daily follow-up.
          </p>
        </div>
        <span className="aw-count-pill">
          {data.referenceTasks.length} team tasks
        </span>
      </div>
      <div className="aw-source-columns">
        {(["todo", "inprogress", "done"] as const).map((status) => {
          const rows = data.referenceTasks.filter((t) => {
            const work = data.tasks.find((w) => w.reference_task_key === t.id);
            return (
              (work
                ? work.status === "done"
                  ? "done"
                  : work.status === "open"
                    ? "todo"
                    : "inprogress"
                : t.status) === status
            );
          });
          return (
            <div className={`aw-source-column is-${status}`} key={status}>
              <h3>
                {status === "todo"
                  ? "Ready to act"
                  : status === "inprogress"
                    ? "Moving forward"
                    : "Result recorded"}{" "}
                <span>{rows.length}</span>
              </h3>
              {rows.map((t) => {
                const work = data.tasks.find(
                  (w) => w.reference_task_key === t.id,
                );
                const available = data.institutions.some(
                  (i) =>
                    i.actionables_reference?.id ===
                    SOURCE_TASK_INSTITUTIONS[t.id],
                );
                return (
                  <article key={t.id}>
                    <span className="aw-team-label">
                      <Users size={12} />
                      {t.assignee}
                    </span>
                    <h4>{t.title}</h4>
                    <div className="aw-source-task-meta">
                      <span>
                        {work
                          ? WORK_STATUS[work.status]
                          : SOURCE_LABELS[t.status]}
                      </span>
                      <span>
                        {t.priority === "high"
                          ? "High priority"
                          : "Medium priority"}
                      </span>
                    </div>
                    {work ? (
                      <>
                        <small>
                          Named owner:{" "}
                          {work.owner?.full_name ||
                            data.staff.find((s) => s.id === work.owner_id)
                              ?.full_name ||
                            "Not assigned"}
                        </small>
                        <button
                          className="aw-text-button"
                          onClick={() => onResult(work)}
                        >
                          Update result <ArrowRight size={14} />
                        </button>
                      </>
                    ) : t.status !== "done" ? (
                      <button
                        className="aw-text-button"
                        disabled={!available || !data.extensionsReady}
                        onClick={() => onAssign(t.id)}
                      >
                        <ClipboardList size={14} /> Assign named owner
                      </button>
                    ) : (
                      <small>
                        Completion noted in the supplied project brief.
                      </small>
                    )}
                  </article>
                );
              })}
              {!rows.length && (
                <p className="aw-muted">No tasks in this column.</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
