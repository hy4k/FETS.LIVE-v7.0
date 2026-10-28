import React, { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Building2,
  ChevronRight,
  MapPin,
  Plus,
  RefreshCw,
  Truck,
  X,
} from "lucide-react";
import {
  repository as liveRepository,
  type Repository,
  type CentreData,
  type Row,
} from "./repository";
import {
  CENTRE_NAMES,
  capacity,
  istDay,
  renewalState,
  safeLink,
} from "./model";
import { defaults, fields, payload } from "./forms";
import "./ascender.css";
const titles: Record<string, string> = {
  ascender_centres: "Centre details",
  ascender_rooms: "Room / lab",
  ascender_programmes: "Exam programme",
  ascender_documents: "Document link",
  compliance_items: "Renewal",
  ascender_deployments: "Mobile deployment",
};
const shown = (v: any) =>
  v === null || v === undefined || v === "" ? "Not recorded" : String(v);
const date = (v: string) =>
  v
    ? new Date(v + "T12:00:00Z").toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      })
    : "Not recorded";
function Link({ url, children }: { url: string; children: React.ReactNode }) {
  const safe = safeLink(url);
  return safe ? (
    <a href={safe} target="_blank" rel="noopener noreferrer">
      {children}
      <ArrowUpRight size={14} />
    </a>
  ) : (
    <span>Not linked</span>
  );
}
function Editor({
  table,
  row,
  centre,
  data,
  close,
  saved,
  repository,
}: {
  table: string;
  row?: Row;
  centre: Row;
  data: CentreData;
  close: () => void;
  saved: () => Promise<void>;
  repository: Repository;
}) {
  const defs = fields(
    table,
    data.staff,
    data.clients,
    data.renewals.filter((r) => r.centre_id === centre.id && r.active),
  );
  const [value, setValue] = useState<Row>({ ...defaults[table], ...row }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const next = payload(defs, value);
      if (table !== "ascender_centres") next.centre_id = centre.id;
      await repository.save(table, next, row);
      await saved();
      close();
    } catch (e: any) {
      setError(e.message || "Could not save. Your details are still here.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={ref}
      className="am-dialog"
      aria-labelledby="am-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
    >
      <form onSubmit={save}>
        <header>
          <div>
            <small>{CENTRE_NAMES[centre.code]}</small>
            <h2 id="am-dialog-title">
              {row ? "Edit" : "Add"} {titles[table].toLowerCase()}
            </h2>
          </div>
          <button
            type="button"
            className="am-icon"
            aria-label="Close form"
            disabled={busy}
            onClick={close}
          >
            <X size={20} />
          </button>
        </header>
        <div className="am-fields">
          {defs.map((f) => (
            <label
              key={f.key}
              className={f.type === "textarea" ? "am-wide" : ""}
            >
              {f.label}
              {f.required ? " *" : ""}
              {f.type === "select" ? (
                <select
                  aria-label={f.label}
                  required={f.required}
                  value={value[f.key] ?? ""}
                  onChange={(e) =>
                    setValue({ ...value, [f.key]: e.target.value })
                  }
                >
                  <option value="">Select…</option>
                  {value[f.key] &&
                    !f.options?.some(([id]) => id === value[f.key]) && (
                      <option value={value[f.key]}>
                        Previous selection (inactive)
                      </option>
                    )}
                  {f.options?.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  aria-label={f.label}
                  maxLength={10000}
                  value={value[f.key] ?? ""}
                  onChange={(e) =>
                    setValue({ ...value, [f.key]: e.target.value })
                  }
                />
              ) : (
                <input
                  aria-label={f.label}
                  type={f.type || "text"}
                  required={f.required}
                  min={f.min}
                  max={f.max}
                  step={f.type === "number" ? 1 : undefined}
                  maxLength={f.type === "url" ? 2000 : 500}
                  value={value[f.key] ?? ""}
                  onChange={(e) =>
                    setValue({ ...value, [f.key]: e.target.value })
                  }
                />
              )}
              {f.hint && <small>{f.hint}</small>}
            </label>
          ))}
        </div>
        {error && (
          <p role="alert" className="am-error">
            {error}
          </p>
        )}
        <footer>
          <button type="button" disabled={busy} onClick={close}>
            Cancel
          </button>
          <button className="am-primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
export default function AscenderManager({
  repository = liveRepository,
  onNavigate,
}: {
  repository?: Repository;
  onNavigate?: (page: string, branch?: string) => void;
}) {
  const [data, setData] = useState<CentreData | null>(null),
    [selected, setSelected] = useState("calicut"),
    [tab, setTab] = useState("overview"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [edit, setEdit] = useState<{ table: string; row?: Row } | null>(null),
    [archiving, setArchiving] = useState(false);
  const mounted = useRef(true);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const d = await repository.load();
      if (mounted.current) setData(d);
    } catch (e: any) {
      if (mounted.current)
        setError(e.message || "Could not load centre records.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [repository]);
  const go = (page: string) =>
    onNavigate
      ? onNavigate(page, selected === "mobile" ? "global" : selected)
      : window.dispatchEvent(new CustomEvent("fets-go", { detail: { page } }));
  const person = (id: string) =>
    data?.staff.find((s) => s.id === id || s.user_id === id)?.full_name ||
    "Not assigned";
  const client = (id: string) =>
    data?.clients.find((c) => c.id === id)?.name || "Not recorded";
  const centre = data?.centres.find((c) => c.code === selected);
  const records = (key: keyof CentreData) =>
    data?.[key].filter((r) => r.centre_id === centre?.id && !r.archived) || [];
  const renewals = records("renewals")
    .filter((r) => r.active)
    .sort((a, b) => a.next_due.localeCompare(b.next_due));
  const roomCapacity = capacity(records("rooms"));
  async function archive(table: string, row: Row) {
    if (
      !confirm(
        `Archive “${row.name || row.title || row.programme}”? Its history will be kept.`,
      )
    )
      return;
    setArchiving(true);
    try {
      await repository.save(
        table,
        table === "compliance_items" ? { active: false } : { archived: true },
        row,
      );
      setNotice("Archived. History retained.");
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setArchiving(false);
    }
  }
  const add = (table: string) => (
    <button onClick={() => setEdit({ table })}>
      <Plus size={15} />
      Add {titles[table].toLowerCase()}
    </button>
  );
  const actions = (table: string, row: Row) => (
    <div className="am-row-actions">
      <button onClick={() => setEdit({ table, row })}>Edit</button>
      {table !== "ascender_deployments" && (
        <button disabled={archiving} onClick={() => archive(table, row)}>
          Archive
        </button>
      )}
    </div>
  );
  const empty = (text: string) => <p className="am-empty">{text}</p>;
  return (
    <main className="am-page">
      <header className="am-page-head">
        <div>
          <span className="am-eyebrow">FETS / TEST CENTRES</span>
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
        <div role="alert" className="am-error">
          {error} <button onClick={() => void load()}>Retry</button>
        </div>
      )}
      {!data && !error && <p className="am-empty">Loading centre records…</p>}
      {data && (
        <>
          <nav className="am-centres" aria-label="Test centres">
            {["calicut", "cochin", "mobile"].map((code) => {
              const c = data.centres.find((c) => c.code === code),
                cap = capacity(data.rooms.filter((r) => r.centre_id === c?.id)),
                due = data.renewals.filter(
                  (r) =>
                    r.centre_id === c?.id &&
                    r.active &&
                    renewalState(r).attention,
                ).length;
              return (
                <button
                  key={code}
                  aria-pressed={selected === code}
                  className={`am-centre am-${code}`}
                  onClick={() => {
                    setSelected(code);
                    setTab("overview");
                    setNotice("");
                  }}
                >
                  <div className="am-centre-title">
                    {code === "mobile" ? (
                      <Truck size={20} />
                    ) : (
                      <Building2 size={20} />
                    )}
                    <strong>{CENTRE_NAMES[code]}</strong>
                    <ChevronRight size={17} />
                  </div>
                  <span>{person(c?.manager_id)}</span>
                  <div className="am-centre-foot">
                    <span>
                      {cap
                        ? `${cap.usable} usable seats`
                        : "Capacity not recorded"}
                    </span>
                    {due > 0 && <b>{due} due</b>}
                  </div>
                </button>
              );
            })}
          </nav>
          {centre && (
            <>
              <div className="am-section-head">
                <div>
                  <h2>{CENTRE_NAMES[selected]}</h2>
                  <p>
                    {selected === "mobile"
                      ? "Deployment records and centre administration"
                      : "Centre administration"}
                  </p>
                </div>
                <span className="am-updated">
                  Updated{" "}
                  {new Date(centre.updated_at).toLocaleDateString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  })}
                </span>
              </div>
              <nav className="am-tabs" aria-label="Centre sections">
                {[
                  ["overview", "Overview"],
                  ["capacity", "Rooms & programmes"],
                  ["documents", "Documents & renewals"],
                  ...(selected === "mobile"
                    ? [["deployments", "Deployments"]]
                    : []),
                  ["history", "History"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    aria-current={tab === id ? "page" : undefined}
                    onClick={() => setTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </nav>
              {tab === "overview" && (
                <div className="am-overview">
                  <section className="am-panel">
                    <div className="am-panel-head">
                      <h3>Centre details</h3>
                      <button
                        onClick={() =>
                          setEdit({ table: "ascender_centres", row: centre })
                        }
                      >
                        Edit details
                      </button>
                    </div>
                    <dl className="am-details">
                      {[
                        ["Address", centre.address],
                        ["Centre phone", centre.contact_phone],
                        ["Centre email", centre.contact_email],
                        ["Responsible manager", person(centre.manager_id)],
                        ["Backup contact", person(centre.backup_id)],
                        ["Opening hours", centre.operating_hours],
                        [
                          "Hours effective from",
                          centre.hours_effective_from
                            ? date(centre.hours_effective_from)
                            : "",
                        ],
                        ["Notes", centre.notes],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{shown(value)}</dd>
                        </div>
                      ))}
                    </dl>
                    {centre.map_url && (
                      <Link url={centre.map_url}>View location</Link>
                    )}
                    <p className="am-caption">
                      Staff timings and attendance calculations remain in
                      Roster.
                    </p>
                  </section>
                  <div className="am-side">
                    <section className="am-panel">
                      <h3>Needs attention</h3>
                      {renewals.filter((r) => renewalState(r).attention).length
                        ? renewals
                            .filter((r) => renewalState(r).attention)
                            .slice(0, 5)
                            .map((r) => (
                              <button
                                key={r.id}
                                className="am-attention"
                                onClick={() => setTab("documents")}
                              >
                                <span>
                                  {r.title}
                                  <small>
                                    {person(r.owner_profile_id)} ·{" "}
                                    {date(r.next_due)}
                                  </small>
                                </span>
                                <b>{renewalState(r).label}</b>
                              </button>
                            ))
                        : empty(
                            "No renewal reminders due. Unrecorded renewals are not assessed.",
                          )}
                      {!centre.manager_id && (
                        <p className="am-caption">
                          Assign a responsible manager in centre details.
                        </p>
                      )}
                    </section>
                    <section className="am-panel">
                      <h3>
                        {selected === "mobile"
                          ? "Next deployment"
                          : "Next scheduled exam"}
                      </h3>
                      {selected === "mobile"
                        ? (() => {
                            const r = records("deployments")
                              .filter(
                                (r) =>
                                  r.end_date >= istDay() &&
                                  !["cancelled", "closed"].includes(r.status),
                              )
                              .sort((a, b) =>
                                a.start_date.localeCompare(b.start_date),
                              )[0];
                            return r ? (
                              <>
                                <strong>{r.venue}</strong>
                                <p>
                                  {date(r.start_date)} – {date(r.end_date)}
                                </p>
                                <button onClick={() => setTab("deployments")}>
                                  Open deployment
                                  <ChevronRight size={14} />
                                </button>
                              </>
                            ) : (
                              empty("No upcoming deployment recorded.")
                            );
                          })()
                        : (() => {
                            const s = data.sessions.find(
                              (s) => s.branch_location === selected,
                            );
                            return s ? (
                              <>
                                <strong>{s.exam_name || s.client_name}</strong>
                                <p>
                                  {date(s.date)} · {s.start_time?.slice(0, 5)}{" "}
                                  IST
                                </p>
                                <button onClick={() => go("calendar")}>
                                  Open Calendar
                                  <ArrowUpRight size={14} />
                                </button>
                              </>
                            ) : (
                              empty("No upcoming exam recorded in Calendar.")
                            );
                          })()}
                    </section>
                  </div>
                  <section className="am-panel am-wide">
                    <div className="am-panel-head">
                      <h3>People & work</h3>
                      <button onClick={() => go("user-management")}>
                        User Management
                        <ArrowUpRight size={14} />
                      </button>
                    </div>
                    {selected !== "mobile" && (
                      <p>
                        Weekly lead:{" "}
                        <strong>
                          {person(
                            data.leads.find((l) => l.branch === selected)
                              ?.lead_id,
                          )}
                        </strong>{" "}
                        <span className="am-caption">from The Shift</span>
                      </p>
                    )}
                    <div className="am-people">
                      {data.staff
                        .filter(
                          (s) =>
                            s.is_active !== false &&
                            s.branch_assigned === selected,
                        )
                        .map((s) => (
                          <span key={s.id}>{s.full_name}</span>
                        ))}
                    </div>
                    <div className="am-links">
                      <button onClick={() => go("roster")}>
                        Open Roster
                        <ArrowUpRight size={14} />
                      </button>
                      <button onClick={() => go("handover")}>
                        Open The Shift
                        <ArrowUpRight size={14} />
                      </button>
                      <button onClick={() => go("actionables")}>
                        Open Actionables
                        <ArrowUpRight size={14} />
                      </button>
                    </div>
                    {selected === "mobile" && (
                      <p className="am-caption">
                        Deployment leads are assigned per event. Staff retain
                        their home centre; Roster opens all centres. Select the staff’s home centre in The Shift.
                      </p>
                    )}
                  </section>
                </div>
              )}
              {tab === "capacity" && (
                <>
                  <section className="am-panel">
                    <div className="am-panel-head">
                      <div>
                        <h3>Rooms & capacity</h3>
                        <p>
                          {roomCapacity
                            ? `${roomCapacity.usable} usable / ${roomCapacity.total} total seats`
                            : "Record rooms to calculate usable capacity."}
                        </p>
                      </div>
                      {add("ascender_rooms")}
                    </div>
                    {records("rooms").map((r) => (
                      <article className="am-record" key={r.id}>
                        <div>
                          <h4>{r.name}</h4>
                          <p>
                            <strong>
                              {r.total_seats - r.unavailable_seats} usable
                            </strong>{" "}
                            · {r.total_seats} total · {r.unavailable_seats}{" "}
                            unavailable
                          </p>
                          <p>
                            {r.accessibility || "Accessibility not recorded"}
                          </p>
                          {r.notes && <p>{r.notes}</p>}
                        </div>
                        {actions("ascender_rooms", r)}
                      </article>
                    ))}
                    {!records("rooms").length &&
                      empty(
                        "No rooms recorded. Equipment counts are not assumed to be exam capacity.",
                      )}
                  </section>
                  <section className="am-panel">
                    <div className="am-panel-head">
                      <h3>Exam programmes</h3>
                      {add("ascender_programmes")}
                    </div>
                    {records("programmes").map((r) => (
                      <article className="am-record" key={r.id}>
                        <div>
                          <h4>
                            {client(r.client_id)} · {r.programme}
                          </h4>
                          <p>
                            Centre code: {shown(r.site_code)} · Approved seats:{" "}
                            {shown(r.approved_capacity)}
                          </p>
                          <span
                            className={`am-badge ${r.approval === "approved" ? "am-ok" : ""}`}
                          >
                            {r.approval === "not_checked"
                              ? "Not checked"
                              : r.approval}
                          </span>
                          {r.evidence_url && (
                            <Link url={r.evidence_url}>Approval document</Link>
                          )}
                          {r.notes && <p>{r.notes}</p>}
                        </div>
                        {actions("ascender_programmes", r)}
                      </article>
                    ))}
                    {!records("programmes").length &&
                      empty(
                        "No programme approvals recorded. Add each exam partner’s centre code and approval separately.",
                      )}
                  </section>
                </>
              )}
              {tab === "documents" && (
                <>
                  <section className="am-panel">
                    <div className="am-panel-head">
                      <div>
                        <h3>Document links</h3>
                        <p>Open the existing file in its secure location.</p>
                      </div>
                      {add("ascender_documents")}
                    </div>
                    {records("documents").map((r) => (
                      <article className="am-record" key={r.id}>
                        <div>
                          <h4>
                            <Link url={r.url}>{r.title}</Link>
                          </h4>
                          <p>{person(r.owner_id)}</p>
                          {r.compliance_id && (
                            <p>
                              Renewal:{" "}
                              {data.renewals.find(
                                (x) => x.id === r.compliance_id,
                              )?.title || "Not available"}
                            </p>
                          )}
                          {r.notes && <p>{r.notes}</p>}
                        </div>
                        {actions("ascender_documents", r)}
                      </article>
                    ))}
                    {!records("documents").length &&
                      empty(
                        "No document links recorded. Link existing approvals, agreements or centre documents.",
                      )}
                  </section>
                  <section className="am-panel">
                    <div className="am-panel-head">
                      <div>
                        <h3>Renewals & deadlines</h3>
                        <p>
                          Existing compliance register · reminders appear here
                        </p>
                      </div>
                      {add("compliance_items")}
                    </div>
                    {renewals.map((r) => (
                      <article className="am-record" key={r.id}>
                        <div>
                          <h4>{r.title}</h4>
                          <p>
                            {date(r.next_due)} · {person(r.owner_profile_id)} ·{" "}
                            {r.frequency.replace(/_/g, " ")}
                          </p>
                          <span
                            className={`am-badge ${renewalState(r).attention ? "am-warn" : ""}`}
                          >
                            {renewalState(r).label}
                          </span>
                          {r.notes && <p>{r.notes}</p>}
                        </div>
                        {actions("compliance_items", r)}
                      </article>
                    ))}
                    {!renewals.length &&
                      empty(
                        "No renewals recorded. Add confirmed deadlines and their responsible person.",
                      )}
                  </section>
                </>
              )}
              {tab === "deployments" && selected === "mobile" && (
                <section className="am-panel">
                  <div className="am-panel-head">
                    <div>
                      <h3>Mobile deployments</h3>
                      <p>
                        Keep a separate record for each venue and exam period.
                      </p>
                    </div>
                    {add("ascender_deployments")}
                  </div>
                  {records("deployments")
                    .sort((a, b) => b.start_date.localeCompare(a.start_date))
                    .map((r) => (
                      <article className="am-record" key={r.id}>
                        <div>
                          <h4>{r.venue}</h4>
                          <p>
                            {date(r.start_date)} – {date(r.end_date)} ·{" "}
                            {r.status}
                          </p>
                          <p>
                            {r.address} {r.contact && `· ${r.contact}`}
                          </p>
                          <p>
                            {client(r.client_id)} ·{" "}
                            {r.programme || "Programme not recorded"} ·{" "}
                            {shown(r.required_seats)} seats
                          </p>
                          <p>
                            Lead: {person(r.lead_id)} · Setup due{" "}
                            {date(r.setup_due)}
                          </p>
                          <span
                            className={`am-badge ${r.readiness === "confirmed" ? "am-ok" : ""}`}
                          >
                            {r.readiness.replace(/_/g, " ")}
                          </span>
                          {r.confirmed_at && (
                            <p className="am-caption">
                              Confirmed by {person(r.confirmed_by)} ·{" "}
                              {new Date(r.confirmed_at).toLocaleString(
                                "en-IN",
                                { timeZone: "Asia/Kolkata" },
                              )}{" "}
                              IST
                            </p>
                          )}
                          {r.readiness_note && <p>{r.readiness_note}</p>}
                          {r.transport_notes && (
                            <p>Transport / setup: {r.transport_notes}</p>
                          )}
                          {r.closeout_notes && (
                            <p>Return / handover: {r.closeout_notes}</p>
                          )}
                        </div>
                        {actions("ascender_deployments", r)}
                      </article>
                    ))}
                  {!records("deployments").length &&
                    empty(
                      "No deployments recorded. Add the venue, dates and responsible lead to begin.",
                    )}
                </section>
              )}
              {tab === "history" && (
                <section className="am-panel">
                  <h3>Change history</h3>
                  <p className="am-caption">
                    From the latest 200 centre administration changes. Archived
                    records remain in history.
                  </p>
                  {records("history").map((r) => (
                    <details key={r.id} className="am-history">
                      <summary>
                        <span>
                          {titles[r.table_name] || r.table_name} ·{" "}
                          {r.after_data?.title ||
                            r.after_data?.name ||
                            r.after_data?.venue ||
                            r.after_data?.programme ||
                            CENTRE_NAMES[selected]}
                        </span>
                        <small>
                          {person(r.actor_id)} ·{" "}
                          {new Date(r.changed_at).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                          })}{" "}
                          IST
                        </small>
                      </summary>
                      <dl>
                        {Object.entries(r.after_data)
                          .filter(
                            ([k, v]) =>
                              ![
                                "id",
                                "centre_id",
                                "version",
                                "updated_at",
                                "updated_by",
                                "confirmed_by",
                                "confirmed_at",
                              ].includes(k) &&
                              JSON.stringify(v) !==
                                JSON.stringify(r.before_data?.[k]),
                          )
                          .map(([k, v]) => (
                            <div key={k}>
                              <dt>{k.replace(/_/g, " ")}</dt>
                              <dd>
                                {r.before_data
                                  ? `${shown(r.before_data[k])} → `
                                  : ""}
                                {shown(v)}
                              </dd>
                            </div>
                          ))}
                      </dl>
                    </details>
                  ))}
                  {!records("history").length &&
                    empty("No recorded changes yet.")}
                </section>
              )}
            </>
          )}
        </>
      )}
      {edit && centre && data && (
        <Editor
          table={edit.table}
          row={edit.row}
          centre={centre}
          data={data}
          repository={repository}
          close={() => setEdit(null)}
          saved={async () => {
            setNotice("Saved.");
            await load();
          }}
        />
      )}
    </main>
  );
}
