/* ═══════════════════════════════════════════════════════════════════════════
   FETS HANDOVER — flagship page (Atelier theme)
   Shift-day flow: ① Shift Start → ② Duty Timeline (lead-monitored) → ③ Shift End
   + Weekly duty rotation, lead console, Super Admin duty manager & reports.
   ═══════════════════════════════════════════════════════════════════════════ */
import React from "react";
import {
  Calendar, Clock, Users, Crown, Check, X, ChevronRight, ChevronLeft,
  RefreshCcw, Plus, Trash2, Settings, Download, AlertTriangle,
  ClipboardCheck, Sunrise, ListChecks, MoonStar, BarChart3, UserCheck, ArrowLeftRight,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { ShiftBeginning, ShiftEnd, HandoverHistory } from "./ShiftHandoverModern";
import * as DD from "./dutyData";
import "./handover-atelier.css";

/* ── helpers ─────────────────────────────────────────────────────────────── */
const capBranch = (b: string) => (b === "global" ? "Global" : b.charAt(0).toUpperCase() + b.slice(1));
const initials = (name: string) =>
  (name || "?").split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const normSteps = (s: any): { title: string }[] => {
  try {
    const arr = typeof s === "string" ? JSON.parse(s) : s;
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
};
const fmtTime = (t: string | null) => {
  if (!t) return "Anytime";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${String(hh).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
};
const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "at-pill-pending" },
  in_progress: { label: "In progress", cls: "at-pill-progress" },
  done: { label: "Done", cls: "at-pill-done" },
  missed: { label: "Missed", cls: "at-pill-missed" },
  off: { label: "Off day", cls: "at-pill-off" },
};

function AtAvatar({ name, size = 26 }: { name: string; size?: number }) {
  return <span className="at-avatar" style={{ width: size, height: size, fontSize: size * 0.42 }}>{initials(name)}</span>;
}

/* ═══ TODAY'S DUTY TIMELINE + LEAD CONSOLE ═══════════════════════════════ */
function DutyTimeline({ hub }: { hub: any }) {
  const { duties, logs, lead, presentStaff, me, isAdmin, reload } = hub;
  const isLead = me === lead;
  const canVerify = isAdmin || isLead;

  const sorted = [...duties].sort((a: any, b: any) =>
    (a.scheduled_time || "99:99").localeCompare(b.scheduled_time || "99:99"));

  const act = async (fn: () => Promise<any>, ok: string) => {
    try { await fn(); toast.success(ok); reload(); }
    catch (e: any) { toast.error(e?.message || "Action failed"); }
  };

  if (!duties.length) {
    return (
      <div className="at-card at-card-pad at-muted" style={{ textAlign: "center", padding: 40 }}>
        No active duties for this centre yet. {isAdmin && "Add duties in the Reports & Admin section."}
      </div>
    );
  }

  return (
    <div className="at-timeline">
      {sorted.map((duty: any) => {
        const log = logs.find((l: any) => l.duty_id === duty.id);
        const steps = normSteps(duty.steps);
        const stepsState: boolean[] = log
          ? steps.map((_: any, i: number) => !!(log.steps_state || [])[i])
          : steps.map(() => false);
        const status = log?.status || "pending";
        const meta = STATUS_META[status] || STATUS_META.pending;
        const owner = log?.staff_name || "Unassigned";
        const reassigned = !!log?.original_staff_name;
        const ownerOff = !presentStaff.includes(owner);
        const canTick = canVerify || me === owner;

        return (
          <div key={duty.id} className={`at-duty ${status === "done" ? "is-done" : status === "missed" ? "is-missed" : ""}`}>
            {/* time column */}
            <div className="at-duty-time">
              <strong>{fmtTime(duty.scheduled_time).split(" ")[0]}</strong>
              <span>{fmtTime(duty.scheduled_time).split(" ")[1] || ""}</span>
            </div>

            {/* main column */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span className="at-duty-title">{duty.title}</span>
                <span className={`at-pill ${meta.cls}`}>{meta.label}</span>
                {reassigned && (
                  <span className="at-pill at-pill-progress" title={`Originally ${log.original_staff_name}`}>
                    <ArrowLeftRight size={10} /> covered
                  </span>
                )}
              </div>
              <div className="at-duty-owner">
                <AtAvatar name={owner} size={22} />
                <span>{owner}{me === owner && " · you"}</span>
                {log?.verified_by && status === "done" && (
                  <span className="at-muted" style={{ fontSize: 11 }}>· verified by {log.verified_by}</span>
                )}
              </div>
              {duty.description && <p className="at-duty-desc">{duty.description}</p>}

              {/* step checklist */}
              {steps.length > 0 && (
                <div className="at-steps">
                  {steps.map((st: any, i: number) => (
                    <button
                      key={i}
                      type="button"
                      className={`at-step ${stepsState[i] ? "done" : ""}`}
                      disabled={!canTick || status === "off"}
                      onClick={() => {
                        if (!log) return;
                        const next = stepsState.map((v, j) => (j === i ? !v : v));
                        act(() => DD.updateLogSteps(log.id, next, me), stepsState[i] ? "Step unchecked" : "Step done");
                      }}
                    >
                      <span className="at-step-box">{stepsState[i] && <Check size={11} strokeWidth={3} />}</span>
                      {st.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* action column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 7, alignItems: "flex-end" }}>
              {canVerify && status !== "done" && (
                <button className="at-btn at-btn-aqua at-btn-sm" onClick={() => log && act(() => DD.setLogStatus(log.id, "done", me), "Marked done")}>
                  <Check size={13} /> Verify done
                </button>
              )}
              {canVerify && status !== "missed" && status !== "done" && (
                <button className="at-btn at-btn-blush at-btn-sm" onClick={() => log && act(() => DD.setLogStatus(log.id, "missed", me), "Marked missed")}>
                  <X size={13} /> Missed
                </button>
              )}
              {canVerify && (
                <select
                  className="at-select"
                  value=""
                  title={ownerOff ? `${owner} is off today — reassign` : "Reassign for today"}
                  onChange={(e) => {
                    if (!e.target.value || !log) return;
                    act(() => DD.reassignLog(log.id, e.target.value, me), `Reassigned to ${e.target.value}`);
                  }}
                >
                  <option value="">Reassign…</option>
                  {presentStaff.filter((n: string) => n !== owner).map((n: string) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              )}
              {ownerOff && status !== "done" && !canVerify && (
                <span className="at-pill at-pill-off">owner off today</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══ THIS WEEK'S DUTIES — rotation grid ═══════════════════════════════════ */
function WeekDuties({ hub }: { hub: any }) {
  const { duties, assignments, staff, weekLogs, weekStart, isAdmin, reload } = hub;
  const act = async (fn: () => Promise<any>, ok: string) => {
    try { await fn(); toast.success(ok); reload(); }
    catch (e: any) { toast.error(e?.message || "Action failed"); }
  };

  // 7-day dot strip per duty from the week's logs
  const dotsFor = (dutyId: string) => {
    const start = new Date(weekStart + "T00:00:00");
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const key = DD.ymd(d);
      const log = weekLogs.find((l: any) => l.duty_id === dutyId && l.date === key);
      const status = log?.status || (key > DD.ymd(new Date()) ? "future" : "pending");
      const color = status === "done" ? "var(--at-aqua-deep)"
        : status === "missed" ? "var(--at-blush-deep)"
        : status === "future" ? "var(--at-line)"
        : status === "off" ? "var(--at-slate)"
        : "var(--at-sky)";
      return { key, status, color, isToday: key === DD.ymd(new Date()) };
    });
  };

  const weekLabel = () => {
    const start = new Date(weekStart + "T00:00:00");
    const end = new Date(start); end.setDate(start.getDate() + 6);
    const f = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return `${f(start)} – ${f(end)}`;
  };

  return (
    <React.Fragment>
      <div className="at-section-label">This week's rotation · {weekLabel()}</div>
      <div className="at-week-grid">
        {[...duties].sort((a: any, b: any) => a.sort_order - b.sort_order).map((duty: any) => {
          const a = assignments.find((x: any) => x.duty_id === duty.id);
          return (
            <div key={duty.id} className={`at-week-duty ${a?.is_override ? "is-override" : ""}`}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 750, color: "var(--at-ink)" }}>{duty.title}</div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--at-steel)", marginTop: 2 }}>
                    <Clock size={10} style={{ verticalAlign: "-1px" }} /> {fmtTime(duty.scheduled_time)}
                  </div>
                </div>
                {a?.is_override && <span className="at-pill at-pill-missed" title="Manually adjusted by Super Admin">adjusted</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                <AtAvatar name={a?.staff_name || "?"} size={24} />
                {isAdmin ? (
                  <select
                    className="at-select"
                    style={{ flex: 1 }}
                    value={a?.staff_name || ""}
                    onChange={(e) => act(() => DD.setAssignment(weekStart, hub.branch, duty.id, e.target.value), "Assignment updated")}
                  >
                    {!a && <option value="">Assign…</option>}
                    {staff.map((n: string) => <option key={n} value={n}>{n}</option>)}
                  </select>
                ) : (
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--at-ink-2)" }}>{a?.staff_name || "Unassigned"}</span>
                )}
              </div>
              <div style={{ display: "flex", gap: 4, marginTop: 11 }}>
                {dotsFor(duty.id).map((d) => (
                  <span
                    key={d.key}
                    title={`${d.key}: ${d.status}`}
                    style={{
                      width: 9, height: 9, borderRadius: "50%", background: d.color,
                      outline: d.isToday ? "2px solid var(--at-steel)" : "none", outlineOffset: 1,
                    }}
                  />
                ))}
                <span style={{ fontSize: 9, color: "var(--at-ink-4)", marginLeft: 4, fontWeight: 700 }}>MON–SUN</span>
              </div>
            </div>
          );
        })}
      </div>
    </React.Fragment>
  );
}

/* ═══ SUPER ADMIN — duty manager (CRUD) ════════════════════════════════════ */
function DutyManager({ hub }: { hub: any }) {
  const { duties, reload } = hub;
  const [editing, setEditing] = React.useState<any>(null); // {} for new

  const act = async (fn: () => Promise<any>, ok: string) => {
    try { await fn(); toast.success(ok); setEditing(null); reload(); }
    catch (e: any) { toast.error(e?.message || "Action failed"); }
  };

  const Field = ({ label, children }: any) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--at-ink-3)" }}>{label}</span>
      {children}
    </label>
  );

  return (
    <React.Fragment>
      <div className="at-section-label">Duty list · Super Admin</div>
      <div className="at-card at-card-pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {duties.map((d: any) => (
          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, background: "var(--at-recessed)" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 750 }}>{d.title}</div>
              <div style={{ fontSize: 11, color: "var(--at-ink-3)", fontWeight: 600 }}>
                {fmtTime(d.scheduled_time)} · {normSteps(d.steps).length} steps · order {d.sort_order}
              </div>
            </div>
            <button className="at-btn at-btn-sm" onClick={() => setEditing({ ...d, steps: normSteps(d.steps) })}><Settings size={13} /> Edit</button>
            <button
              className="at-btn at-btn-blush at-btn-sm"
              onClick={() => {
                if (window.confirm(`Delete duty "${d.title}"? This also removes its assignments and logs.`))
                  act(() => DD.deleteDuty(d.id), "Duty deleted");
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        <button className="at-btn at-btn-primary" style={{ alignSelf: "flex-start" }} onClick={() => setEditing({ title: "", description: "", scheduled_time: "09:00", sort_order: duties.length + 1, steps: [], branch: "both", is_active: true })}>
          <Plus size={14} /> New duty
        </button>
      </div>

      {/* editor */}
      {editing && (
        <div className="at-card at-card-pad" style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--at-steel)" }}>{editing.id ? "Edit duty" : "New duty"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
            <Field label="Title"><input className="at-input" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
            <Field label="Scheduled time"><input className="at-input" type="time" value={editing.scheduled_time || ""} onChange={(e) => setEditing({ ...editing, scheduled_time: e.target.value })} /></Field>
            <Field label="Sort order"><input className="at-input" type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></Field>
          </div>
          <Field label="Description"><input className="at-input" value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
          <Field label="Steps — one per line (optional)">
            <textarea
              className="at-input" rows={4}
              value={(editing.steps || []).map((s: any) => s.title).join("\n")}
              onChange={(e) => setEditing({ ...editing, steps: e.target.value.split("\n").map((t) => t.trim()).filter(Boolean).map((t) => ({ title: t })) })}
            />
          </Field>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="at-btn at-btn-primary" onClick={() => act(() => DD.saveDuty(editing), "Duty saved")}><Check size={14} /> Save duty</button>
            <button className="at-btn" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}
    </React.Fragment>
  );
}

/* ═══ REPORTS — auto-generated summary ═════════════════════════════════════ */
function ReportPanel({ hub }: { hub: any }) {
  const { weekLogs, duties, weekStart, branch, lead } = hub;
  const dated = weekLogs.filter((l: any) => l.date <= DD.ymd(new Date()));
  const done = dated.filter((l: any) => l.status === "done").length;
  const missed = dated.filter((l: any) => l.status === "missed").length;
  const pending = dated.filter((l: any) => l.status === "pending" || l.status === "in_progress").length;
  const covered = dated.filter((l: any) => l.original_staff_name).length;
  const total = Math.max(1, done + missed + pending);
  const pct = Math.round((done / total) * 100);

  const byStaff: Record<string, { done: number; missed: number; pending: number }> = {};
  dated.forEach((l: any) => {
    byStaff[l.staff_name] = byStaff[l.staff_name] || { done: 0, missed: 0, pending: 0 };
    if (l.status === "done") byStaff[l.staff_name].done++;
    else if (l.status === "missed") byStaff[l.staff_name].missed++;
    else byStaff[l.staff_name].pending++;
  });

  const weekLabel = () => {
    const start = new Date(weekStart + "T00:00:00");
    const end = new Date(start); end.setDate(start.getDate() + 6);
    const f = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return `${f(start)} – ${f(end)}`;
  };

  const summaryText =
    `FETS HANDOVER · Weekly Duty Report — ${capBranch(branch)} centre (${weekLabel()}). ` +
    `${done} of ${total} duty-checks completed (${pct}%), ${missed} missed, ${pending} still open, ${covered} covered by reassignment. ` +
    (missed > 0 ? `Attention needed: ${missed} missed dut${missed === 1 ? "y" : "ies"} this week.` : `All tracked duties are on track.`);

  const download = () => {
    const rows = Object.entries(byStaff)
      .map(([name, s]) => `<tr><td>${name}</td><td style="color:#5fa8af;font-weight:700">${s.done}</td><td style="color:#d4899a;font-weight:700">${s.missed}</td><td>${s.pending}</td></tr>`)
      .join("");
    const dutyRows = duties.map((d: any) => {
      const logs = dated.filter((l: any) => l.duty_id === d.id);
      const dDone = logs.filter((l: any) => l.status === "done").length;
      const dMiss = logs.filter((l: any) => l.status === "missed").length;
      return `<tr><td>${d.title}</td><td>${logs[0]?.staff_name || "—"}</td><td style="color:#5fa8af;font-weight:700">${dDone}</td><td style="color:#d4899a;font-weight:700">${dMiss}</td></tr>`;
    }).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>FETS Duty Report — ${capBranch(branch)} ${weekLabel()}</title>
<style>body{font-family:Inter,Segoe UI,sans-serif;max-width:800px;margin:40px auto;color:#2e3235;padding:0 20px}
h1{color:#4D6D9A;font-size:26px;letter-spacing:-0.02em} .meta{color:#7d858c;font-size:12px;text-transform:uppercase;letter-spacing:.12em}
.summary{background:#eef2f7;border-left:4px solid #4D6D9A;padding:14px 18px;border-radius:8px;margin:20px 0;line-height:1.6}
table{width:100%;border-collapse:collapse;margin:16px 0} th{background:#4D6D9A;color:#fff;text-align:left;padding:8px 12px;font-size:12px;text-transform:uppercase;letter-spacing:.06em}
td{padding:8px 12px;border-bottom:1px solid #e5e9ef;font-size:13px}</style></head><body>
<div class="meta">FETS.LIVE · ${capBranch(branch)} centre · generated ${new Date().toLocaleString("en-GB")}</div>
<h1>Weekly Duty Report</h1><div class="meta">${weekLabel()}</div>
<div class="summary">${summaryText}</div>
<h3>By staff</h3><table><tr><th>Staff</th><th>Done</th><th>Missed</th><th>Open</th></tr>${rows}</table>
<h3>By duty</h3><table><tr><th>Duty</th><th>Latest owner</th><th>Done</th><th>Missed</th></tr>${dutyRows}</table>
</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `fets-duty-report-${branch}-${weekStart}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Report downloaded — drop it into the Google Shared Drive folder");
  };

  return (
    <React.Fragment>
      <div className="at-section-label">Auto-generated weekly report · {weekLabel()}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        {[
          { label: "Completed", value: done, color: "var(--at-aqua-deep)" },
          { label: "Missed", value: missed, color: "var(--at-blush-deep)" },
          { label: "Open", value: pending, color: "var(--at-steel)" },
          { label: "Covered", value: covered, color: "var(--at-slate)" },
          { label: "Completion", value: `${pct}%`, color: "var(--at-steel)" },
        ].map((s) => (
          <div key={s.label} className="at-report-stat">
            <div style={{ fontSize: 26, fontWeight: 850, color: s.color, letterSpacing: "-0.02em" }}>{s.value}</div>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--at-ink-3)", marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="at-card at-card-pad" style={{ marginTop: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--at-ink-3)", marginBottom: 8 }}>Summary for Super Admin</div>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: "var(--at-ink-2)" }}>{summaryText}</p>
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <button className="at-btn at-btn-primary" onClick={download}><Download size={14} /> Download report</button>
        </div>
      </div>

      {Object.keys(byStaff).length > 0 && (
        <div className="at-card at-card-pad" style={{ marginTop: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--at-ink-3)", marginBottom: 10 }}>By staff</div>
          {Object.entries(byStaff).map(([name, s]) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--at-line)" }}>
              <AtAvatar name={name} size={24} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{name}{name === lead && <Crown size={12} style={{ marginLeft: 6, color: "var(--at-blush-deep)", verticalAlign: "-1px" }} />}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: "var(--at-aqua-deep)" }}>{s.done} done</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: "var(--at-blush-deep)" }}>{s.missed} missed</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--at-ink-3)" }}>{s.pending} open</span>
            </div>
          ))}
        </div>
      )}
    </React.Fragment>
  );
}

/* ═══ MAIN PAGE ════════════════════════════════════════════════════════════ */
export default function HandoverHub({ branch: branchProp, setActive }: any) {
  const W: any = window as any;
  const branch = branchProp === "global" ? (W.FETS?._meBranch || "calicut") : branchProp;
  const me = W.FETS?._meName || W.FETS?.user?.name || "Staff";
  const isAdmin = !!W.FETS?.isAdmin;

  const [stage, setStage] = React.useState<"start" | "duties" | "end" | "reports">("duties");
  const [loading, setLoading] = React.useState(true);
  const [tick, setTick] = React.useState(0);
  const reload = () => setTick((t) => t + 1);

  const today = DD.ymd(new Date());
  const weekStart = DD.weekStartOf(new Date());

  const [duties, setDuties] = React.useState<any[]>([]);
  const [staff, setStaff] = React.useState<string[]>([]);
  const [presentStaff, setPresentStaff] = React.useState<string[]>([]);
  const [assignments, setAssignments] = React.useState<any[]>([]);
  const [logs, setLogs] = React.useState<any[]>([]);
  const [weekLogs, setWeekLogs] = React.useState<any[]>([]);
  const [lead, setLead] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const present = await DD.loadPresentStaff(today, branch);
        const leadRes = await DD.ensureDayLead(today, branch, present);
        const week = await DD.ensureWeekAssignments(weekStart, branch);
        const dayLogs = await DD.ensureDailyLog(today, branch, weekStart);
        const weekEndDate = new Date(weekStart + "T00:00:00");
        weekEndDate.setDate(weekEndDate.getDate() + 6);
        const range = await DD.loadLogRange(weekStart, DD.ymd(weekEndDate), branch);
        if (!alive) return;
        setPresentStaff(present);
        setLead(leadRes.lead);
        setDuties(week.duties);
        setStaff(week.staff);
        setAssignments(week.assignments);
        setLogs(dayLogs);
        setWeekLogs(range);
      } catch (e: any) {
        console.error("HandoverHub load error:", e);
        toast.error(e?.message || "Failed to load duty data");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [branch, tick]);

  const hub = { branch, me, isAdmin, duties, staff, presentStaff, assignments, logs, weekLogs, lead, weekStart, reload };
  const isLead = me === lead;

  const stages = [
    { id: "start", label: "Shift Start", sub: "Accept the handover", icon: Sunrise },
    { id: "duties", label: "Duty Timeline", sub: "Today's duties & lead console", icon: ListChecks },
    { id: "end", label: "Shift End", sub: "Close & hand over", icon: MoonStar },
    { id: "reports", label: "Reports & Admin", sub: "Summary, duties & history", icon: BarChart3 },
  ] as const;

  return (
    <div className="handover-atelier">
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "clamp(20px,3vw,36px) clamp(16px,3vw,32px) 90px" }}>

        {/* ── HERO ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 20, marginTop: 8 }}>
          <div>
            <div className="at-eyebrow">
              <span className="at-eyebrow-line" />
              <span className="at-eyebrow-text">Shift Operations // {capBranch(branch)}</span>
            </div>
            <h1 className="at-hero-title">FETS <span className="at-blush-word">HANDOVER</span></h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", paddingBottom: 8 }}>
            <span className="at-chip"><Calendar size={13} /> {new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</span>
            <span className="at-chip"><Users size={13} /> {presentStaff.length} <span className="at-chip-label">present</span></span>
            {lead && (
              <span className="at-lead-badge" style={{ padding: "8px 14px", fontSize: 11 }}>
                <Crown size={13} /> Lead · {lead}{isLead && " (you)"}
              </span>
            )}
          </div>
        </div>

        {/* ── STAGE FLOW ── */}
        <div className="at-flow">
          {stages.map((s, i) => (
            <button key={s.id} className={`at-flow-btn ${stage === s.id ? "active" : ""}`} onClick={() => setStage(s.id as any)}>
              <span className="at-flow-num">{i + 1}</span>
              <span className="at-flow-label">{s.label}</span>
              <span className="at-flow-sub">{s.sub}</span>
              <ChevronRight size={15} className="at-flow-arrow" />
            </button>
          ))}
        </div>

        {loading ? (
          <div className="at-card at-card-pad at-muted" style={{ textAlign: "center", padding: 48 }}>
            <RefreshCcw size={18} className="spin" style={{ marginBottom: 10 }} /> Loading shift operations…
          </div>
        ) : (
          <React.Fragment>
            {/* ① SHIFT START */}
            {stage === "start" && <ShiftBeginning branch={branch} trimmed refreshKey={tick} onAccepted={reload} />}

            {/* ② DUTY TIMELINE */}
            {stage === "duties" && (
              <React.Fragment>
                <div className="at-lead-banner" style={{ marginBottom: 18 }}>
                  <span className="at-lead-badge"><Crown size={11} /> Today's lead</span>
                  <span style={{ fontSize: 13.5, fontWeight: 750, color: "var(--at-ink)" }}>{lead || "Not assigned"}</span>
                  <span style={{ fontSize: 11.5, color: "var(--at-ink-3)", fontWeight: 600 }}>
                    verifies every duty before close
                  </span>
                  <div style={{ flex: 1 }} />
                  {isAdmin && (
                    <select
                      className="at-select"
                      value={lead || ""}
                      onChange={(e) => {
                        if (!e.target.value) return;
                        DD.setDayLead(today, branch, e.target.value)
                          .then(() => { toast.success(`Lead set to ${e.target.value}`); reload(); })
                          .catch((err) => toast.error(err?.message || "Failed"));
                      }}
                    >
                      {!lead && <option value="">Set lead…</option>}
                      {presentStaff.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  )}
                  <button className="at-btn at-btn-sm" onClick={reload} title="Refresh"><RefreshCcw size={13} /></button>
                </div>

                <div className="at-section-label">Today's duties · in scheduled order</div>
                <DutyTimeline hub={hub} />

                <hr className="at-divider" />
                <WeekDuties hub={hub} />
              </React.Fragment>
            )}

            {/* ③ SHIFT END */}
            {stage === "end" && <ShiftEnd branch={branch} trimmed onSubmitted={reload} />}

            {/* ④ REPORTS & ADMIN */}
            {stage === "reports" && (
              <React.Fragment>
                <ReportPanel hub={hub} />
                {isAdmin && (
                  <React.Fragment>
                    <hr className="at-divider" />
                    <DutyManager hub={hub} />
                  </React.Fragment>
                )}
                <hr className="at-divider" />
                <div className="at-section-label">Handover history</div>
                <HandoverHistory branch={branch} />
              </React.Fragment>
            )}
          </React.Fragment>
        )}
      </div>
    </div>
  );
}
