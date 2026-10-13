import { useState } from "react";
import { ClipboardList, Plus, Search, Users } from "lucide-react";
import { WorkCard } from "./ActionablesPortfolio";
import {
  FILTER_LABELS,
  matchesWork,
  type ActionablesData,
  type ActionablesIdentity,
  type WorkFilter,
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
  identity,
  onAssign,
  onResult,
  onAdd,
  onOpen,
}: {
  data: ActionablesData;
  identity: ActionablesIdentity;
  onAssign: (key: number) => void;
  onResult: (t: WorkItem) => void;
  onAdd: () => void;
  onOpen: (t: WorkItem) => void;
}) {
  const [owner, setOwner] = useState("all"),
    [filter, setFilter] = useState<WorkFilter>("all"),
    [search, setSearch] = useState("");
  const sourceRows = data.referenceTasks.map((source) => ({
    source,
    work: data.tasks.find((w) => w.reference_task_key === source.id),
  }));
  const rows = [
    ...sourceRows,
    ...data.tasks
      .filter((w) => !w.reference_task_key)
      .map((work) => ({ source: undefined, work })),
  ].filter(({ source, work }) => {
    if (owner !== "all" && work?.owner_id !== owner) return false;
    if (work && !matchesWork(work, data.updates, filter)) return false;
    if (
      !work &&
      filter !== "all" &&
      filter !== "unassigned" &&
      !(filter === "active" && source?.status !== "done") &&
      !(filter === "done" && source?.status === "done")
    )
      return false;
    return (
      !search ||
      [
        work?.title,
        source?.title,
        source?.assignee,
        work?.owner?.full_name,
        data.institutions.find((i) => i.id === work?.institution_id)?.name,
      ].some((v) => v?.toLowerCase().includes(search.toLowerCase()))
    );
  });
  return (
    <section className="aw-source-board">
      <div className="aw-section-heading">
        <h2>Team tasks</h2>
        <button className="aw-button" onClick={onAdd}>
          <Plus size={15} />
          Add task
        </button>
      </div>
      <div className="aw-task-filters">
        <label className="aw-search">
          <Search size={17} />
          <input
            aria-label="Search tasks"
            placeholder="Search tasks"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          Status
          <select
            aria-label="Filter work"
            value={filter}
            onChange={(e) => setFilter(e.target.value as WorkFilter)}
          >
            {Object.entries(FILTER_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Owner
          <select
            aria-label="Filter owner"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
          >
            <option value="all">All staff</option>
            <option value={identity.id}>My tasks</option>
            {data.staff
              .filter((s) => s.id !== identity.id)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                  {s.is_active === false ? " (inactive)" : ""}
                </option>
              ))}
          </select>
        </label>
      </div>
      <div className="aw-source-columns">
        {(["todo", "inprogress", "done"] as const).map((status) => {
          const list = rows.filter(
            ({ source, work }) =>
              (work
                ? work.status === "done"
                  ? "done"
                  : work.status === "open"
                    ? "todo"
                    : "inprogress"
                : source?.status) === status,
          );
          return (
            <div className={`aw-source-column is-${status}`} key={status}>
              <h3>
                {status === "todo"
                  ? "To do"
                  : status === "inprogress"
                    ? "In progress"
                    : "Completed"}
                <span>{list.length}</span>
              </h3>
              {list.map(({ source, work }) =>
                work ? (
                  <WorkCard
                    key={work.id}
                    task={work}
                    data={data}
                    onResult={onResult}
                    onOpen={onOpen}
                  />
                ) : (
                  source && (
                    <article key={`source-${source.id}`}>
                      <span className="aw-team-label">
                        <Users size={12} />
                        {source.assignee}
                      </span>
                      <h4>{source.title}</h4>
                      <div className="aw-source-task-meta">
                        <span>{SOURCE_LABELS[source.status]}</span>
                        <span>
                          {source.priority === "high"
                            ? "High priority"
                            : "Medium priority"}
                        </span>
                      </div>
                      {source.status !== "done" ? (
                        <button
                          className="aw-text-button"
                          disabled={
                            !data.extensionsReady ||
                            !data.institutions.some(
                              (i) =>
                                i.actionables_reference?.id ===
                                SOURCE_TASK_INSTITUTIONS[source.id],
                            )
                          }
                          onClick={() => onAssign(source.id)}
                        >
                          <ClipboardList size={14} />
                          Assign owner
                        </button>
                      ) : (
                        <small>
                          Completion noted in the supplied project brief.
                        </small>
                      )}
                    </article>
                  )
                ),
              )}
              {!list.length && <p className="aw-muted">No matching tasks.</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
