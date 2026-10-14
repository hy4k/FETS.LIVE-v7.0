import {
  ArrowUpRight,
  Check,
  ClipboardCheck,
  History,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { PEARSON_REQUIREMENTS_URL } from "./institution-workflow";
import {
  readiness,
  type ActionablesData,
  type Criterion,
  type Institution,
  type Observation,
} from "./actionables-model";
export default function ActionablesReadiness({
  institution,
  data,
  onRecord,
  onFollowup,
}: {
  institution: Institution;
  data: ActionablesData;
  onRecord: (criterion: Criterion, latest?: Observation) => void;
  onFollowup: (o: Observation, title: string) => void;
}) {
  const r = readiness(institution.id, data.observations);
  const names = (id: string) =>
    data.staff.find((s) => s.id === id)?.full_name || "Staff";
  return (
    <section className="aw-readiness">
      <div className="aw-section-heading">
        <div>
          <h2>Lab audit</h2>
          <p>Record findings for each item.</p>
        </div>
        <a
          className="aw-button secondary"
          href={PEARSON_REQUIREMENTS_URL}
          target="_blank"
          rel="noreferrer"
        >
          Provider guidance <ArrowUpRight size={16} />
        </a>
      </div>
      {!data.extensionsReady ? (
        <div className="aw-empty">
          <ClipboardCheck size={30} />
          <h3>Shared readiness checks are being prepared</h3>
          <p>
            Record site findings in the existing assessment-stage duties in the
            meantime.
          </p>
        </div>
      ) : (
        <>
          {institution.actionables_reference && (
            <div className="aw-source-score">
              <strong>
                Recorded readiness: {institution.actionables_reference.score}%
              </strong>
              <span>
                The project brief’s score is retained. Record item-level
                findings and evidence below.
              </span>
            </div>
          )}
          <div className="aw-readiness-summary">
            <div>
              <strong>
                {r.reviewed}
                <small> / 10</small>
              </strong>
              <span>observations recorded</span>
            </div>
            <div>
              <strong>{r.gaps}</strong>
              <span>gaps to resolve</span>
            </div>
            <div>
              <strong>{r.unknown}</strong>
              <span>details to record</span>
            </div>
            <p>
              <ShieldCheck size={20} />
              These are internal observations. Provider approval and final
              handover are separate stages.
            </p>
          </div>
          <div className="aw-readiness-grid">
            {r.entries.map(({ item, latest }) => {
              const history = data.observations
                .filter(
                  (o) =>
                    o.institution_id === institution.id &&
                    o.criterion === item.key,
                )
                .sort(
                  (a, b) =>
                    b.created_at.localeCompare(a.created_at) ||
                    b.id.localeCompare(a.id),
                );
              return (
                <article
                  className={`aw-check-card is-${latest?.state || "unknown"}`}
                  key={item.key}
                >
                  <header>
                    <span
                      className={`aw-check-icon ${latest?.state || "unknown"}`}
                    >
                      {latest?.state === "ready" ? (
                        <Check size={17} />
                      ) : (
                        <ClipboardCheck size={17} />
                      )}
                    </span>
                    <span className="aw-check-state">
                      {latest?.state === "ready"
                        ? "Meets reviewed requirement"
                        : latest?.state === "gap"
                          ? "Gap to resolve"
                          : latest?.state === "not_applicable"
                            ? "Not applicable"
                            : "No observation yet"}
                    </span>
                  </header>
                  <h3>{item.title}</h3>
                  <p className="aw-muted">{item.detail}</p>
                  {latest && (
                    <div className="aw-check-evidence">
                      <p>{latest.evidence}</p>
                      <small>
                        {latest.observed_name || names(latest.observed_by)} ·{" "}
                        {new Date(latest.created_at).toLocaleDateString(
                          "en-IN",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            timeZone: "Asia/Kolkata",
                          },
                        )}
                      </small>
                      {latest.source_url && (
                        <a
                          href={latest.source_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Source / evidence <ArrowUpRight size={13} />
                        </a>
                      )}
                    </div>
                  )}
                  <footer>
                    <button
                      className="aw-button small secondary"
                      onClick={() => onRecord(item.key, latest)}
                    >
                      <Plus size={14} />
                      {latest ? "Record new observation" : "Record observation"}
                    </button>
                    {latest?.state === "gap" && (
                      <button
                        className="aw-text-button"
                        onClick={() => onFollowup(latest, item.title)}
                      >
                        Assign follow-up <ArrowUpRight size={14} />
                      </button>
                    )}
                  </footer>
                  {history.length > 1 && (
                    <details className="aw-check-history">
                      <summary>
                        <History size={14} /> Earlier observations (
                        {history.length - 1})
                      </summary>
                      {history.slice(1).map((o) => (
                        <div key={o.id}>
                          <strong>
                            {o.state === "ready"
                              ? "Meets reviewed requirement"
                              : o.state === "gap"
                                ? "Gap to resolve"
                                : "Not applicable"}
                          </strong>
                          <p>{o.evidence}</p>
                          <small>
                            {o.observed_name || names(o.observed_by)} ·{" "}
                            {new Date(o.created_at).toLocaleString("en-IN", {
                              timeZone: "Asia/Kolkata",
                            })}{" "}
                            IST
                          </small>
                        </div>
                      ))}
                    </details>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
