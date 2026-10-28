import React, { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Building2,
  Plus,
  RefreshCw,
  Settings2,
  Search,
} from "lucide-react";
import {
  repository as liveRepository,
  type Repository,
  type CentreData,
  type Row,
} from "./repository";
import { CENTRE_NAMES } from "./model";
import { answerValue, configuredFields } from "./forms";
import { AnswerList, Questions, sectionNames, SiteEditor } from "./SiteForms";
import "./ascender.css";
const sectionData: Record<string, keyof CentreData> = {
  ascender_centres: "centres",
  ascender_rooms: "rooms",
  ascender_programmes: "programmes",
  ascender_documents: "documents",
  compliance_items: "renewals",
  ascender_deployments: "deployments",
  ascender_inventory: "inventory",
};
const primary: Record<string, string> = {
  ascender_rooms: "name",
  ascender_programmes: "programme",
  ascender_documents: "title",
  compliance_items: "title",
  ascender_deployments: "venue",
  ascender_inventory: "name",
};
const singular: Record<string, string> = {
  ascender_centres: "centre details",
  ascender_rooms: "room / lab",
  ascender_programmes: "programme",
  ascender_documents: "document",
  compliance_items: "renewal",
  ascender_deployments: "deployment",
  ascender_inventory: "item",
};
export default function AscenderManager({
  repository = liveRepository,
  onNavigate,
}: {
  repository?: Repository;
  onNavigate?: (page: string, branch?: string) => void;
}) {
  const [data, setData] = useState<CentreData | null>(null),
    [selected, setSelected] = useState("calicut"),
    [section, setSection] = useState("ascender_centres"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [edit, setEdit] = useState<{ table: string; row?: Row } | null>(null),
    [questions, setQuestions] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [deleted, setDeleted] = useState(false);
  const mounted = useRef(true),
    request = useRef(0);
  const load = async () => {
    const id = ++request.current;
    setLoading(true);
    setError("");
    try {
      const rows = await repository.load();
      if (mounted.current && id === request.current) setData(rows);
    } catch (e: any) {
      if (mounted.current && id === request.current)
        setError(e.message || "Could not load Sites.");
    } finally {
      if (mounted.current && id === request.current) setLoading(false);
    }
  };
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
      request.current++;
    };
  }, [repository]);
  const centre = data?.centres.find((c) => c.code === selected),
    defs = centre && data ? configuredFields(section, data, centre.id) : [];
  const rows = (data?.[sectionData[section]] || [])
    .filter(
      (r) =>
        (section === "ascender_centres" ? r.id : r.centre_id) === centre?.id,
    )
    .filter((r) =>
      section === "ascender_inventory"
        ? Boolean(r.archived) === deleted
        : !r.archived && r.active !== false,
    )
    .filter(
      (r) =>
        !query ||
        defs
          .map((f) => answerValue(r, f))
          .filter((v) => v != null)
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
  const title = (row: Row) =>
    defs.some((f) => f.key === primary[section]) && row[primary[section]]
      ? String(row[primary[section]])
      : singular[section];
  const remove = async (row: Row) => {
    const restoring = Boolean(row.archived);
    if (
      !restoring &&
      !confirm(
        `Delete “${title(row)}” from current inventory? Its history is kept and the item can be restored.`,
      )
    )
      return;
    setBusy(true);
    try {
      await repository.save(
        "ascender_inventory",
        { archived: !restoring },
        row,
      );
      setNotice(
        restoring ? "Item restored." : "Item deleted from current inventory.",
      );
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const archive = async (row: Row) => {
    if (!confirm(`Archive this ${singular[section]}? Its history is kept.`))
      return;
    setBusy(true);
    try {
      await repository.save(
        section,
        section === "compliance_items" ? { active: false } : { archived: true },
        row,
      );
      setNotice("Entry archived.");
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const go = (page: string) =>
    onNavigate
      ? onNavigate(page, selected === "mobile" ? "global" : selected)
      : window.dispatchEvent(new CustomEvent("fets-go", { detail: { page } }));
  const sections = Object.keys(sectionNames).filter(
    (k) => selected === "mobile" || k !== "ascender_deployments",
  );
  return (
    <main className="am-page am-flex-sites">
      <header className="am-page-head">
        <div>
          <span className="am-eyebrow">TEST CENTRES</span>
          <h1>FETS SITES</h1>
        </div>
        <button disabled={loading} onClick={() => void load()}>
          <RefreshCw size={15} />
          {loading ? "Loading…" : "Refresh"}
        </button>
      </header>
      {notice && (
        <p role="status" className="am-notice">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="am-error">
          {error}
          <button onClick={() => void load()}>Retry</button>
        </p>
      )}
      {!data && !error && <p>Loading centre records…</p>}
      {data && (
        <>
          <nav className="am-centres" aria-label="Test centres">
            {["calicut", "cochin", "mobile"].map((code) => (
              <button
                key={code}
                aria-pressed={selected === code}
                onClick={() => {
                  setSelected(code);
                  setSection("ascender_centres");
                  setQuery("");
                  setDeleted(false);
                }}
              >
                <Building2 size={18} />
                <strong>{CENTRE_NAMES[code]}</strong>
              </button>
            ))}
          </nav>
          <nav className="am-section-nav" aria-label="Site sections">
            {sections.map((key) => (
              <button
                key={key}
                aria-pressed={section === key}
                onClick={() => {
                  setSection(key);
                  setQuery("");
                  setDeleted(false);
                }}
              >
                {sectionNames[key]}
              </button>
            ))}
            <button
              aria-pressed={section === "history"}
              onClick={() => setSection("history")}
            >
              History
            </button>
          </nav>
          {centre && (
            <>
              <div className="am-section-head">
                <div>
                  <span className="am-eyebrow">{CENTRE_NAMES[selected]}</span>
                  <h2>{sectionNames[section] || "History"}</h2>
                </div>
                {section !== "history" && (
                  <div className="am-row-actions">
                    <button onClick={() => setQuestions(section)}>
                      <Settings2 size={15} />
                      Edit questions
                    </button>
                    <button
                      className="am-primary"
                      onClick={() =>
                        setEdit({
                          table: section,
                          row:
                            section === "ascender_centres" ? centre : undefined,
                        })
                      }
                    >
                      {section === "ascender_centres" ? (
                        "Edit details"
                      ) : (
                        <>
                          <Plus size={15} />
                          Add {singular[section]}
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
              {section === "ascender_inventory" && (
                <div className="am-inventory-controls">
                  <div>
                    <Search size={16} />
                    <input
                      type="search"
                      aria-label="Search inventory"
                      placeholder="Find an item, category or location…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  <label>
                    <input
                      type="checkbox"
                      checked={deleted}
                      onChange={(e) => setDeleted(e.target.checked)}
                    />
                    Show deleted items
                  </label>
                </div>
              )}
              {section === "history" ? (
                <section className="am-history">
                  {data.history
                    .filter((r) => r.centre_id === centre.id)
                    .map((r) => {
                      const before = r.before_data || {},
                        after = r.after_data || {},
                        fieldDefs = configuredFields(
                          r.table_name,
                          data,
                          centre.id,
                          true,
                        );
                      const changes =
                        r.table_name === "ascender_fields"
                          ? [
                              ["Question", after.label],
                              ["Removed", after.removed ? "Yes" : "No"],
                            ]
                          : fieldDefs
                              .filter(
                                (f) =>
                                  JSON.stringify(answerValue(before, f)) !==
                                  JSON.stringify(answerValue(after, f)),
                              )
                              .map((f) => [
                                f.label,
                                String(answerValue(after, f) ?? "Cleared"),
                              ]);
                      return (
                        <details key={r.id}>
                          <summary>
                            {sectionNames[r.table_name] || "Questions"} ·{" "}
                            {new Date(r.changed_at).toLocaleString("en-IN", {
                              timeZone: "Asia/Kolkata",
                            })}
                          </summary>
                          <p>
                            {data.staff.find((s) => s.user_id === r.actor_id)
                              ?.full_name || "Staff member"}
                          </p>
                          <dl className="am-answers">
                            {changes.map(([label, value], i) => (
                              <div key={i}>
                                <dt>{label}</dt>
                                <dd>{value}</dd>
                              </div>
                            ))}
                            {r.before_data?.archived !==
                              r.after_data?.archived && (
                              <div>
                                <dt>Deleted / archived</dt>
                                <dd>{r.after_data?.archived ? "Yes" : "No"}</dd>
                              </div>
                            )}
                            {r.before_data?.active !== r.after_data?.active &&
                              r.table_name === "compliance_items" && (
                                <div>
                                  <dt>Entry active</dt>
                                  <dd>{r.after_data?.active ? "Yes" : "No"}</dd>
                                </div>
                              )}
                          </dl>
                        </details>
                      );
                    })}
                  {!data.history.some((r) => r.centre_id === centre.id) && (
                    <p className="am-empty">No changes recorded.</p>
                  )}
                </section>
              ) : section === "ascender_centres" ? (
                <>
                  <article className="am-record-card">
                    <AnswerList defs={defs} row={centre} />
                  </article>
                  <div className="am-related-tools">
                    {[
                      ["calendar", "Open Calendar"],
                      ["roster", "Open Roster"],
                      ["handover", "Open The Shift"],
                    ].map(([id, label]) => (
                      <button key={id} onClick={() => go(id)}>
                        {label}
                        <ArrowUpRight size={14} />
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <section
                  className={
                    section === "ascender_inventory"
                      ? "am-inventory-list"
                      : "am-record-grid"
                  }
                  aria-label={sectionNames[section]}
                >
                  {rows.map((row) => (
                    <article key={row.id} className="am-record-card">
                      <header>
                        <div>
                          <h3>{title(row)}</h3>
                          {section === "ascender_inventory" &&
                            defs.some((f) => f.key === "quantity") && (
                              <div className="am-stock-quantity">
                                {row.quantity != null ? (
                                  <>
                                    <strong>
                                      {row.quantity.toLocaleString("en-IN")}
                                    </strong>
                                    {defs.some((f) => f.key === "unit") &&
                                      row.unit && <small>{row.unit}</small>}
                                  </>
                                ) : (
                                  <small>Quantity not recorded</small>
                                )}
                              </div>
                            )}
                        </div>
                        <div className="am-row-actions">
                          <button
                            onClick={() => setEdit({ table: section, row })}
                          >
                            Edit
                          </button>
                          {section === "ascender_inventory" ? (
                            <button
                              disabled={busy}
                              onClick={() => void remove(row)}
                            >
                              {row.archived ? "Restore" : "Delete"}
                            </button>
                          ) : (
                            <button
                              disabled={busy}
                              onClick={() => void archive(row)}
                            >
                              Archive
                            </button>
                          )}
                        </div>
                      </header>
                      {defs.some(
                        (f) =>
                          f.key !== primary[section] &&
                          !(
                            section === "ascender_inventory" &&
                            ["quantity", "unit"].includes(f.key)
                          ) &&
                          answerValue(row, f) != null &&
                          answerValue(row, f) !== "",
                      ) && (
                        <AnswerList
                          defs={defs.filter(
                            (f) =>
                              f.key !== primary[section] &&
                              !(
                                section === "ascender_inventory" &&
                                ["quantity", "unit"].includes(f.key)
                              ),
                          )}
                          row={row}
                        />
                      )}
                    </article>
                  ))}
                  {!rows.length && (
                    <p className="am-empty">
                      {section === "ascender_inventory"
                        ? deleted
                          ? "No deleted items."
                          : "No inventory items yet. Add computers, AC, printers, chairs or any item you need."
                        : "No entries in this section yet."}
                    </p>
                  )}
                </section>
              )}
            </>
          )}
        </>
      )}
      {edit && data && centre && (
        <SiteEditor
          key={edit.table + String(edit.row?.id || "new")}
          table={edit.table}
          row={edit.row}
          centre={centre}
          data={data}
          repository={repository}
          saved={load}
          close={() => setEdit(null)}
          configure={() => setQuestions(edit.table)}
        />
      )}{" "}
      {questions && data && centre && (
        <Questions
          key={questions + centre.id}
          table={questions}
          centre={centre}
          data={data}
          repository={repository}
          saved={load}
          close={() => setQuestions(null)}
        />
      )}
    </main>
  );
}
