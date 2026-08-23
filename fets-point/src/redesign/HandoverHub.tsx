/* ═══════════════════════════════════════════════════════════════════════════
   FETS HANDOVER — flagship page (Atelier theme)
   Shift-day flow: ① Shift Start → ② Duty Timeline (lead-monitored) → ③ Shift End
   + Categorized Daily Operational Checklist, Consecutive 7-Day Lead & Duty Matrix,
     Supervisor Console, Super Admin duty manager & reports.
   ═══════════════════════════════════════════════════════════════════════════ */
import React from "react";
import {
  Calendar, Clock, Users, Crown, Check, X, ChevronRight, ChevronLeft, ChevronDown,
  RefreshCcw, Plus, Trash2, Settings, Download, AlertTriangle, Search, Filter,
  ClipboardCheck, Sunrise, ListChecks, MoonStar, BarChart3, UserCheck, ArrowLeftRight,
  MessageSquare, Database, FileText, Server, Building2, AlertCircle, CheckCircle2,
  SlidersHorizontal, CheckSquare, Square, Eye, Sparkles
} from "lucide-react";
import { toast } from "react-hot-toast";
import { ShiftBeginning, ShiftEnd, HandoverHistory } from "./ShiftHandoverModern";
import * as DD from "./dutyData";
import { sendChatAlert } from "./chatNotify";
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

const STATUS_META: Record<string, { label: string; cls: string; color: string }> = {
  pending: { label: "Pending", cls: "at-pill-pending", color: "var(--at-ink-3)" },
  in_progress: { label: "In Progress", cls: "at-pill-progress", color: "var(--at-steel)" },
  done: { label: "Completed", cls: "at-pill-done", color: "var(--at-aqua-deep)" },
  attention: { label: "Attention Required ⚠", cls: "at-pill-missed", color: "var(--at-blush-deep)" },
  missed: { label: "Missed", cls: "at-pill-missed", color: "var(--at-blush-deep)" },
  off: { label: "Off Day", cls: "at-pill-off", color: "var(--at-slate)" },
  na: { label: "N/A", cls: "at-pill-off", color: "var(--at-slate)" },
};

const CATEGORY_ICONS: Record<string, any> = {
  admin_calendar: Calendar,
  data_systems: Database,
  cases_documentation: FileText,
  it_infrastructure: Server,
  office_facilities: Building2,
  other_followup: AlertCircle,
};

function AtAvatar({ name, size = 26 }: { name: string; size?: number }) {
  return <span className="at-avatar" style={{ width: size, height: size, fontSize: size * 0.42 }}>{initials(name)}</span>;
}

/* ═══ TODAY'S DUTY TIMELINE + CATEGORIZED CHECKLIST + LEAD CONSOLE ════════ */
function DutyTimeline({ hub }: { hub: any }) {
  const { duties, logs, lead, presentStaff, me, isAdmin, branch, reload } = hub;
  const isLead = me === lead;
  const canVerify = isAdmin || isLead;

  // Filter and search states
  const [activeTab, setActiveTab] = React.useState<"all" | "mine" | "pending" | "done" | "attention">("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");
  const [collapsedCats, setCollapsedCats] = React.useState<Record<string, boolean>>({});
  const [openSteps, setOpenSteps] = React.useState<Record<string, boolean>>({});
  const [selectedStaffFilter, setSelectedStaffFilter] = React.useState<string | null>(null);

  const act = async (fn: () => Promise<any>, ok: string) => {
    try { await fn(); toast.success(ok); reload(); }
    catch (e: any) { toast.error(e?.message || "Action failed"); }
  };

  const toggleCategoryCollapse = (catId: string) => {
    setCollapsedCats((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  const toggleSteps = (dutyId: string) => {
    setOpenSteps((prev) => ({ ...prev, [dutyId]: !prev[dutyId] }));
  };

  // Compute metrics
  const totalTasks = duties.length;
  const completedLogs = logs.filter((l: any) => l.status === "done");
  const completedCount = completedLogs.length;
  const attentionLogs = logs.filter((l: any) => l.status === "attention" || l.status === "missed");
  const attentionCount = attentionLogs.length;
  const inProgressCount = logs.filter((l: any) => l.status === "in_progress").length;
  const pendingCount = totalTasks - completedCount;
  const completionPct = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  // Employee-wise breakdown for supervisor view
  const staffBreakdown: Record<string, { total: number; completed: number; pending: number; attention: number }> = {};
  duties.forEach((d: any) => {
    const log = logs.find((l: any) => l.duty_id === d.id);
    const owner = log?.staff_name || "Unassigned";
    staffBreakdown[owner] = staffBreakdown[owner] || { total: 0, completed: 0, pending: 0, attention: 0 };
    staffBreakdown[owner].total++;
    if (log?.status === "done") staffBreakdown[owner].completed++;
    else if (log?.status === "attention" || log?.status === "missed") staffBreakdown[owner].attention++;
    else staffBreakdown[owner].pending++;
  });

  // Filter tasks
  const filteredDuties = React.useMemo(() => {
    return duties.filter((d: any) => {
      const log = logs.find((l: any) => l.duty_id === d.id);
      const owner = log?.staff_name || "";
      const status = log?.status || "pending";

      // Tab filter
      if (activeTab === "mine" && owner.toLowerCase().trim() !== me.toLowerCase().trim()) return false;
      if (activeTab === "pending" && status === "done") return false;
      if (activeTab === "done" && status !== "done") return false;
      if (activeTab === "attention" && status !== "attention" && status !== "missed" && d.priority !== "attention") return false;

      // Staff filter
      if (selectedStaffFilter && owner !== selectedStaffFilter) return false;

      // Category filter
      if (selectedCategory !== "all" && d.category !== selectedCategory) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (d.title || "").toLowerCase().includes(q);
        const matchDesc = (d.description || "").toLowerCase().includes(q);
        const matchOwner = owner.toLowerCase().includes(q);
        const matchSteps = (d.steps || []).some((s: any) => (s.title || "").toLowerCase().includes(q));
        if (!matchTitle && !matchDesc && !matchOwner && !matchSteps) return false;
      }

      return true;
    });
  }, [duties, logs, activeTab, selectedStaffFilter, selectedCategory, searchQuery, me]);

  // Group by category
  const categoriesWithDuties = React.useMemo(() => {
    return DD.DUTY_CATEGORIES.map((cat) => {
      const items = filteredDuties.filter((d) => d.category === cat.id);
      const allCatDuties = duties.filter((d) => d.category === cat.id);
      const catDone = allCatDuties.filter((d) => {
        const log = logs.find((l: any) => l.duty_id === d.id);
        return log?.status === "done";
      }).length;
      return {
        ...cat,
        items,
        totalInCat: allCatDuties.length,
        doneInCat: catDone,
      };
    }).filter((cat) => selectedCategory === "all" || cat.id === selectedCategory);
  }, [filteredDuties, duties, logs, selectedCategory]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* ── TOP SUMMARY CARD ── */}
      <div className="at-card at-card-pad" style={{ background: "linear-gradient(145deg, #ffffff 0%, #f6f9fc 100%)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 850, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--at-steel)" }}>
                Daily Operational Checklist · {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
              {lead ? (
                <span className="at-lead-badge" style={{ padding: "6px 14px", fontSize: 12 }}>
                  <Crown size={14} /> Today's Lead: <strong>{lead}</strong>{isLead && " (You)"}
                </span>
              ) : (
                <span className="at-pill at-pill-pending">Lead: Unassigned</span>
              )}
              {isAdmin && (
                <select
                  className="at-select"
                  style={{ padding: "4px 10px", fontSize: 11.5 }}
                  value={lead || ""}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    DD.setDayLead(DD.ymd(new Date()), branch, e.target.value)
                      .then(() => { toast.success(`Lead set to ${e.target.value}`); reload(); })
                      .catch((err) => toast.error(err?.message || "Failed"));
                  }}
                >
                  {!lead && <option value="">Change Lead…</option>}
                  {presentStaff.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              )}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              className="at-btn at-btn-sm"
              title="Post today's duty briefing to Google Chat"
              onClick={async () => {
                const lines = [...duties]
                  .sort((a: any, b: any) => (a.scheduled_time || "99:99").localeCompare(b.scheduled_time || "99:99"))
                  .map((d: any) => {
                    const log = logs.find((l: any) => l.duty_id === d.id);
                    return `${fmtTime(d.scheduled_time)} — ${d.title} → ${log?.staff_name || "Unassigned"}`;
                  });
                const ok = await sendChatAlert({
                  kind: "briefing", branch,
                  dateLabel: new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }),
                  lead, lines,
                });
                if (ok) toast.success("Briefing posted to Google Chat");
                else toast.error("Chat not configured yet — webhook missing");
              }}
            >
              <MessageSquare size={13} /> Briefing → Chat
            </button>
            <button className="at-btn at-btn-sm" onClick={reload} title="Refresh Live Data"><RefreshCcw size={13} /></button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="at-dash-summary" style={{ marginTop: 14 }}>
          <div className="at-summary-stat-card">
            <div className="at-summary-stat-val" style={{ color: "var(--at-ink)" }}>{totalTasks}</div>
            <div className="at-summary-stat-label">Total Tasks</div>
          </div>
          <div className="at-summary-stat-card" style={{ borderLeft: "3px solid var(--at-aqua-deep)" }}>
            <div className="at-summary-stat-val" style={{ color: "var(--at-aqua-deep)" }}>{completedCount}</div>
            <div className="at-summary-stat-label">Completed</div>
          </div>
          <div className="at-summary-stat-card" style={{ borderLeft: "3px solid var(--at-steel)" }}>
            <div className="at-summary-stat-val" style={{ color: "var(--at-steel)" }}>{pendingCount}</div>
            <div className="at-summary-stat-label">Pending / Open</div>
          </div>
          <div className="at-summary-stat-card" style={{ borderLeft: `3px solid ${attentionCount > 0 ? "var(--at-blush-deep)" : "var(--at-line)"}` }}>
            <div className="at-summary-stat-val" style={{ color: attentionCount > 0 ? "var(--at-blush-deep)" : "var(--at-ink-3)" }}>
              {attentionCount}
            </div>
            <div className="at-summary-stat-label">Attention Required</div>
          </div>
          <div className="at-summary-stat-card" style={{ background: "linear-gradient(135deg, rgba(153, 206, 211, 0.15) 0%, rgba(134, 179, 209, 0.15) 100%)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div className="at-summary-stat-val" style={{ color: "var(--at-steel-deep)" }}>{completionPct}%</div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--at-steel)" }}>{completedCount}/{totalTasks}</span>
            </div>
            <div className="at-summary-stat-label">Daily Completion</div>
            <div style={{ width: "100%", height: 6, background: "rgba(0,0,0,0.08)", borderRadius: 99, marginTop: 6, overflow: "hidden" }}>
              <div style={{ width: `${completionPct}%`, height: "100%", background: "linear-gradient(90deg, var(--at-aqua-deep), var(--at-steel))", borderRadius: 99, transition: "width 0.4s ease" }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── SUPERVISOR TEAM PROGRESS VIEW ── */}
      <div className="at-card at-card-pad" style={{ background: "#ffffff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--at-ink-3)" }}>
            Team Progress // Employee Breakdown
          </div>
          {selectedStaffFilter && (
            <button className="at-btn at-btn-sm at-btn-blush" onClick={() => setSelectedStaffFilter(null)}>
              Clear Staff Filter ({selectedStaffFilter})
            </button>
          )}
        </div>
        <div className="at-team-progress-grid">
          {Object.entries(staffBreakdown).map(([name, s]) => {
            const pct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
            const isSelected = selectedStaffFilter === name;
            const isMe = name.toLowerCase().trim() === me.toLowerCase().trim();
            const isCenterLead = name === lead;
            return (
              <div
                key={name}
                className="at-team-progress-card"
                style={{
                  cursor: "pointer",
                  borderColor: isSelected ? "var(--at-steel)" : isMe ? "var(--at-aqua-deep)" : "var(--at-line)",
                  background: isSelected ? "rgba(134, 179, 209, 0.12)" : "#fff",
                }}
                onClick={() => setSelectedStaffFilter(isSelected ? null : name)}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <AtAvatar name={name} size={22} />
                    <span style={{ fontSize: 12.5, fontWeight: 750, color: "var(--at-ink)" }}>
                      {name}{isMe && " (You)"}
                    </span>
                    {isCenterLead && <span title="Today's Lead"><Crown size={12} style={{ color: "var(--at-blush-deep)" }} /></span>}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 850, color: pct === 100 ? "var(--at-aqua-deep)" : "var(--at-steel)" }}>{pct}%</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--at-ink-3)", fontWeight: 600 }}>
                  <span>{s.completed}/{s.total} completed</span>
                  {s.attention > 0 && <span style={{ color: "var(--at-blush-deep)", fontWeight: 800 }}>{s.attention} attention ⚠</span>}
                </div>
                <div style={{ width: "100%", height: 4, background: "var(--at-recessed)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "var(--at-aqua-deep)" : "var(--at-steel)", borderRadius: 99 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── FILTER & SEARCH BAR ── */}
      <div className="at-filter-bar">
        <div className="at-filter-tabs">
          <button className={`at-filter-tab ${activeTab === "all" ? "active" : ""}`} onClick={() => setActiveTab("all")}>
            All Tasks <span className="at-filter-tab-count">{totalTasks}</span>
          </button>
          <button className={`at-filter-tab ${activeTab === "mine" ? "active" : ""}`} onClick={() => setActiveTab("mine")}>
            <AtAvatar name={me} size={15} /> My Tasks <span className="at-filter-tab-count">{staffBreakdown[me]?.total || 0}</span>
          </button>
          <button className={`at-filter-tab ${activeTab === "pending" ? "active" : ""}`} onClick={() => setActiveTab("pending")}>
            ⏳ Pending <span className="at-filter-tab-count">{pendingCount}</span>
          </button>
          <button className={`at-filter-tab ${activeTab === "done" ? "active" : ""}`} onClick={() => setActiveTab("done")}>
            ✓ Completed <span className="at-filter-tab-count">{completedCount}</span>
          </button>
          <button className={`at-filter-tab ${activeTab === "attention" ? "active" : ""}`} onClick={() => setActiveTab("attention")}>
            ⚠ Attention Required <span className="at-filter-tab-count">{attentionCount}</span>
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", flex: 1, justifyContent: "flex-end" }}>
          <div style={{ position: "relative", minWidth: 200 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: 11, color: "var(--at-ink-3)" }} />
            <input
              type="text"
              className="at-input"
              placeholder="Search duties, staff or steps…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 30, fontSize: 12, height: 36 }}
            />
          </div>

          <select
            className="at-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ fontSize: 12, height: 36 }}
          >
            <option value="all">All Categories</option>
            {DD.DUTY_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── CATEGORIZED COMPACT TASK ACCORDIONS ── */}
      <div className="at-categories-container">
        {categoriesWithDuties.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.id] || ListChecks;
          const isCollapsed = !!collapsedCats[cat.id];
          const hasItems = cat.items.length > 0;

          return (
            <div key={cat.id} className="at-cat-card">
              {/* Category Header */}
              <div className="at-cat-head" onClick={() => toggleCategoryCollapse(cat.id)}>
                <div className="at-cat-title-group">
                  <div className="at-cat-icon">
                    <Icon size={16} />
                  </div>
                  <div>
                    <div className="at-cat-title">{cat.name}</div>
                    <div className="at-cat-desc">{cat.description}</div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="at-cat-badge">
                    {cat.doneInCat} / {cat.totalInCat} completed · {cat.totalInCat > 0 ? Math.round((cat.doneInCat / cat.totalInCat) * 100) : 0}%
                  </span>
                  <ChevronDown
                    size={16}
                    style={{
                      transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                      transition: "transform 0.2s ease",
                      color: "var(--at-ink-3)",
                    }}
                  />
                </div>
              </div>

              {/* Category Task Rows */}
              {!isCollapsed && (
                <div className="at-task-rows">
                  {!hasItems ? (
                    <div style={{ padding: "16px 20px", fontSize: 12.5, color: "var(--at-ink-3)", fontStyle: "italic" }}>
                      No tasks matching current filter in this category.
                    </div>
                  ) : (
                    cat.items.map((duty: any) => {
                      const log = logs.find((l: any) => l.duty_id === duty.id);
                      const status = log?.status || "pending";
                      const isDone = status === "done";
                      const isAttention = status === "attention" || status === "missed" || duty.priority === "attention";
                      const owner = log?.staff_name || "Unassigned";
                      const isOwnerMe = owner.toLowerCase().trim() === me.toLowerCase().trim();
                      const isOwnerLead = owner === lead;
                      const ownerOff = !presentStaff.includes(owner);
                      const steps = normSteps(duty.steps);
                      const areStepsOpen = !!openSteps[duty.id];
                      const stepsState: boolean[] = log
                        ? steps.map((_: any, i: number) => !!(log.steps_state || [])[i])
                        : steps.map(() => false);
                      const stepsDoneCount = stepsState.filter(Boolean).length;
                      const canTick = canVerify || isOwnerMe;

                      return (
                        <div
                          key={duty.id}
                          className={`at-task-row ${isDone ? "is-done" : isAttention ? "is-attention" : ""}`}
                        >
                          {/* 1. Instant Checkbox */}
                          <button
                            type="button"
                            className={`at-task-chk ${isDone ? "checked" : ""}`}
                            title={isDone ? "Mark pending" : "Mark completed"}
                            disabled={!canTick}
                            onClick={() => {
                              if (!log) return;
                              const newStatus = isDone ? "pending" : "done";
                              act(() => DD.setLogStatus(log.id, newStatus, me), isDone ? "Marked pending" : "Marked done");
                            }}
                          >
                            <Check size={14} strokeWidth={3.5} />
                          </button>

                          {/* 2. Scheduled Time */}
                          <div className="at-task-time">
                            <Clock size={11} style={{ verticalAlign: "-1px", marginRight: 3 }} />
                            {fmtTime(duty.scheduled_time)}
                          </div>

                          {/* 3. Task Title & Details */}
                          <div className="at-task-content">
                            <div className="at-task-name">
                              <span style={{ textDecoration: isDone ? "line-through" : "none", opacity: isDone ? 0.75 : 1 }}>
                                {duty.title}
                              </span>
                              {isAttention && (
                                <span className="at-attention-tag">
                                  <AlertTriangle size={10} /> Attention Required
                                </span>
                              )}
                              {log?.original_staff_name && (
                                <span className="at-pill at-pill-progress" style={{ fontSize: 9 }} title={`Originally ${log.original_staff_name}`}>
                                  <ArrowLeftRight size={9} /> covered
                                </span>
                              )}
                            </div>

                            {duty.description && (
                              <div className="at-task-desc-sub" title={duty.description}>
                                {duty.description}
                              </div>
                            )}

                            {/* Micro-steps trigger & checklist */}
                            {steps.length > 0 && (
                              <div style={{ marginTop: 4 }}>
                                <button
                                  type="button"
                                  className="at-btn at-btn-sm"
                                  style={{ padding: "2px 7px", fontSize: 10.5, height: "auto" }}
                                  onClick={() => toggleSteps(duty.id)}
                                >
                                  {areStepsOpen ? "▲ Hide steps" : `▼ Steps (${stepsDoneCount}/${steps.length})`}
                                </button>

                                {areStepsOpen && (
                                  <div className="at-steps" style={{ marginTop: 6, paddingLeft: 4 }}>
                                    {steps.map((st: any, i: number) => (
                                      <button
                                        key={i}
                                        type="button"
                                        className={`at-step ${stepsState[i] ? "done" : ""}`}
                                        disabled={!canTick}
                                        onClick={() => {
                                          if (!log) return;
                                          const next = stepsState.map((v, j) => (j === i ? !v : v));
                                          act(() => DD.updateLogSteps(log.id, next, me), stepsState[i] ? "Step unchecked" : "Step done");
                                        }}
                                      >
                                        <span className="at-step-box">
                                          {stepsState[i] && <Check size={11} strokeWidth={3} />}
                                        </span>
                                        {st.title}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* 4. Assigned Staff */}
                          <div className="at-task-staff">
                            <AtAvatar name={owner} size={22} />
                            <span>{owner}{isOwnerMe && " (You)"}</span>
                            {isOwnerLead && <span title="Today's Lead"><Crown size={12} style={{ color: "var(--at-blush-deep)" }} /></span>}
                            {ownerOff && <span className="at-pill at-pill-off" style={{ fontSize: 9 }}>Off</span>}
                          </div>

                          {/* 5. Status Badge & Quick Controls */}
                          <div className="at-task-actions">
                            <select
                              className="at-select"
                              style={{
                                fontSize: 11, padding: "4px 8px",
                                fontWeight: 750,
                                borderColor: STATUS_META[status]?.color || "var(--at-line)",
                              }}
                              value={status}
                              disabled={!canTick}
                              onChange={(e) => {
                                if (!log) return;
                                const s = e.target.value as any;
                                act(async () => {
                                  await DD.setLogStatus(log.id, s, me);
                                  if (s === "attention" || s === "missed") {
                                    sendChatAlert({ kind: "missed", branch, duty: duty.title, owner, by: me });
                                  }
                                }, `Status updated to ${s}`);
                              }}
                            >
                              <option value="pending">Pending</option>
                              <option value="in_progress">In Progress</option>
                              <option value="done">Completed</option>
                              <option value="attention">Attention ⚠</option>
                              <option value="missed">Missed</option>
                              <option value="off">Off Day</option>
                              <option value="na">N/A</option>
                            </select>

                            {/* Reassign dropdown for Admin / Lead */}
                            {canVerify && (
                              <select
                                className="at-select"
                                style={{ fontSize: 11, padding: "4px 8px" }}
                                value=""
                                title="Reassign duty to present staff"
                                onChange={(e) => {
                                  if (!e.target.value || !log) return;
                                  const to = e.target.value;
                                  act(async () => {
                                    await DD.reassignLog(log.id, to, me);
                                    sendChatAlert({ kind: "reassigned", branch, duty: duty.title, from: owner, to, by: me });
                                  }, `Reassigned to ${to}`);
                                }}
                              >
                                <option value="">Reassign…</option>
                                {presentStaff.filter((n: string) => n !== owner).map((n: string) => (
                                  <option key={n} value={n}>{n}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══ CONSECUTIVE 7-DAY DUTY & LEAD ROTATION MATRIX ═════════════════════════ */
function WeekDuties({ hub }: { hub: any }) {
  const { duties, assignments, staff, weekLogs, weekStart, branch, isAdmin, reload } = hub;

  const act = async (fn: () => Promise<any>, ok: string) => {
    try { await fn(); toast.success(ok); reload(); }
    catch (e: any) { toast.error(e?.message || "Action failed"); }
  };

  // Generate the 7 consecutive days
  const days = React.useMemo(() => {
    const start = new Date(weekStart + "T00:00:00");
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateKey = DD.ymd(d);
      const dayName = d.toLocaleDateString("en-GB", { weekday: "short" });
      const dayNum = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      const isToday = dateKey === DD.ymd(new Date());
      return { date: d, dateKey, dayName, dayNum, isToday, dayIndex: i };
    });
  }, [weekStart]);

  // Lead for each of the 7 days (round-robin + stored)
  const dayLeads = React.useMemo(() => {
    const leads: Record<string, string> = {};
    days.forEach((day) => {
      if (!staff.length) return;
      const dayIdx = Math.floor(new Date(day.dateKey + "T00:00:00").getTime() / 86400000);
      leads[day.dateKey] = staff[dayIdx % staff.length];
    });
    return leads;
  }, [days, staff]);

  return (
    <React.Fragment>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div className="at-section-label" style={{ margin: 0 }}>
          Consecutive 7-Day Duty & Lead Schedule Matrix · {days[0]?.dayNum} – {days[6]?.dayNum}
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--at-steel)" }}>
          👑 Crown indicates Lead of the Day
        </span>
      </div>

      <div className="at-matrix-wrap">
        <table className="at-matrix-table">
          <thead>
            <tr>
              <th style={{ minWidth: 200, position: "sticky", left: 0, zIndex: 2, background: "var(--at-recessed)" }}>
                Operational Duty & Time
              </th>
              {days.map((day) => {
                const dayLead = dayLeads[day.dateKey];
                return (
                  <th
                    key={day.dateKey}
                    style={{
                      minWidth: 140,
                      background: day.isToday ? "rgba(134, 179, 209, 0.25)" : "var(--at-recessed)",
                      borderLeft: "1px solid var(--at-line)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 850 }}>{day.dayName} {day.dayNum}</span>
                      {day.isToday && (
                        <span className="at-pill at-pill-progress" style={{ fontSize: 8.5, padding: "2px 5px" }}>Today</span>
                      )}
                    </div>
                    {/* Day Lead row in header */}
                    <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "var(--at-ink-2)" }}>
                      <Crown size={11} style={{ color: "var(--at-blush-deep)" }} />
                      <span style={{ fontWeight: 800 }}>{dayLead || "Lead"}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {[...duties].sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)).map((duty: any) => {
              const a = assignments.find((x: any) => x.duty_id === duty.id);
              const baseStaff = a?.staff_name || "Unassigned";

              return (
                <tr key={duty.id}>
                  {/* Duty Name and Scheduled Time */}
                  <td style={{ position: "sticky", left: 0, zIndex: 1, background: "#fff", fontWeight: 750, fontSize: 12.5 }}>
                    <div style={{ color: "var(--at-ink)" }}>{duty.title}</div>
                    <div style={{ fontSize: 10, color: "var(--at-steel)", fontWeight: 650, marginTop: 2 }}>
                      <Clock size={9} style={{ verticalAlign: "-1px", marginRight: 3 }} /> {fmtTime(duty.scheduled_time)}
                    </div>
                  </td>

                  {/* 7 Day Columns */}
                  {days.map((day) => {
                    // Calculate assigned staff for this day
                    const dutyIdx = duties.findIndex((x: any) => x.id === duty.id);
                    const offset = DD.weeksSinceEpoch(weekStart);
                    const staffIdx = (((dutyIdx + offset + day.dayIndex) % staff.length) + staff.length) % staff.length;
                    const assignedStaff = a?.is_override ? baseStaff : (staff[staffIdx] || baseStaff);
                    const log = weekLogs.find((l: any) => l.duty_id === duty.id && l.date === day.dateKey);
                    const status = log?.status || (day.dateKey > DD.ymd(new Date()) ? "future" : "pending");
                    const isDayLead = assignedStaff === dayLeads[day.dateKey];

                    return (
                      <td
                        key={day.dateKey}
                        style={{
                          borderLeft: "1px solid var(--at-line)",
                          background: day.isToday ? "rgba(134, 179, 209, 0.04)" : "#fff",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <AtAvatar name={assignedStaff} size={20} />
                            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--at-ink)" }}>
                              {assignedStaff}
                            </span>
                            {isDayLead && <span title="Day Lead"><Crown size={10} style={{ color: "var(--at-blush-deep)" }} /></span>}
                          </div>

                          {/* Status dot */}
                          <span
                            title={`Status: ${status}`}
                            style={{
                              width: 8, height: 8, borderRadius: "50%",
                              background: status === "done" ? "var(--at-aqua-deep)"
                                : status === "missed" || status === "attention" ? "var(--at-blush-deep)"
                                : status === "future" ? "var(--at-line)"
                                : "var(--at-sky)",
                            }}
                          />
                        </div>

                        {/* Admin Reassign for the week */}
                        {isAdmin && (
                          <div style={{ marginTop: 5 }}>
                            <select
                              className="at-select"
                              style={{ width: "100%", fontSize: 10, padding: "2px 4px", height: 22 }}
                              value={assignedStaff}
                              onChange={(e) => act(() => DD.setAssignment(weekStart, branch, duty.id, e.target.value), "Assignment updated")}
                            >
                              {staff.map((n: string) => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
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
                Category: <strong>{d.category || "General"}</strong> · {fmtTime(d.scheduled_time)} · {normSteps(d.steps).length} steps · order {d.sort_order}
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
        <button
          className="at-btn at-btn-primary"
          style={{ alignSelf: "flex-start" }}
          onClick={() => setEditing({ title: "", category: "admin_calendar", description: "", scheduled_time: "09:00", sort_order: duties.length + 1, steps: [], branch: "both", is_active: true })}
        >
          <Plus size={14} /> New Duty
        </button>
      </div>

      {/* editor */}
      {editing && (
        <div className="at-card at-card-pad" style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--at-steel)" }}>{editing.id ? "Edit duty" : "New duty"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12 }}>
            <Field label="Title"><input className="at-input" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
            <Field label="Category">
              <select className="at-select" value={editing.category || "admin_calendar"} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                {DD.DUTY_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
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
  const missed = dated.filter((l: any) => l.status === "missed" || l.status === "attention").length;
  const pending = dated.filter((l: any) => l.status === "pending" || l.status === "in_progress").length;
  const covered = dated.filter((l: any) => l.original_staff_name).length;
  const total = Math.max(1, done + missed + pending);
  const pct = Math.round((done / total) * 100);

  const byStaff: Record<string, { done: number; missed: number; pending: number }> = {};
  dated.forEach((l: any) => {
    byStaff[l.staff_name] = byStaff[l.staff_name] || { done: 0, missed: 0, pending: 0 };
    if (l.status === "done") byStaff[l.staff_name].done++;
    else if (l.status === "missed" || l.status === "attention") byStaff[l.staff_name].missed++;
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
    `${done} of ${total} duty-checks completed (${pct}%), ${missed} attention/missed, ${pending} still open, ${covered} covered by reassignment. ` +
    (missed > 0 ? `Attention needed: ${missed} task(s) flagged this week.` : `All tracked duties are on track.`);

  const download = () => {
    const rows = Object.entries(byStaff)
      .map(([name, s]) => `<tr><td>${name}</td><td style="color:#5fa8af;font-weight:700">${s.done}</td><td style="color:#d4899a;font-weight:700">${s.missed}</td><td>${s.pending}</td></tr>`)
      .join("");
    const dutyRows = duties.map((d: any) => {
      const logs = dated.filter((l: any) => l.duty_id === d.id);
      const dDone = logs.filter((l: any) => l.status === "done").length;
      const dMiss = logs.filter((l: any) => l.status === "missed" || l.status === "attention").length;
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
<h3>By staff</h3><table><tr><th>Staff</th><th>Done</th><th>Attention / Missed</th><th>Open</th></tr>${rows}</table>
<h3>By duty</h3><table><tr><th>Duty</th><th>Latest owner</th><th>Done</th><th>Attention / Missed</th></tr>${dutyRows}</table>
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
          { label: "Attention / Missed", value: missed, color: "var(--at-blush-deep)" },
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
          <button
            className="at-btn"
            title="Send this summary to the Google Chat space"
            onClick={async () => {
              const ok = await sendChatAlert({ kind: "summary", branch, weekLabel: weekLabel(), text: summaryText });
              if (ok) toast.success("Summary sent to Google Chat");
              else toast.error("Chat not configured yet — webhook missing");
            }}
          >
            <MessageSquare size={14} /> Send summary → Chat
          </button>
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
              <span style={{ fontSize: 12, fontWeight: 800, color: "var(--at-blush-deep)" }}>{s.missed} attention</span>
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
  const rawBranch = branchProp === "global" ? (W.FETS?._meBranch || "calicut") : branchProp;
  const branch = rawBranch === "global" ? "calicut" : rawBranch;
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
    { id: "start", label: "Shift Start", sub: "Incoming handover takeover", icon: Sunrise },
    { id: "duties", label: "Duty Timeline", sub: "Operational checklist & 7-day matrix", icon: ListChecks },
    { id: "end", label: "Shift End", sub: "Close & hand over to next shift", icon: MoonStar },
    { id: "reports", label: "Reports & Admin", sub: "Weekly summary & duty manager", icon: BarChart3 },
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
            <span className="at-chip"><Users size={13} /> {presentStaff.length} <span className="at-chip-label">on duty</span></span>
            {lead && (
              <span className="at-lead-badge" style={{ padding: "8px 14px", fontSize: 11 }}>
                <Crown size={13} /> Today's Lead · {lead}{isLead && " (You)"}
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
                <DutyTimeline hub={hub} />

                <hr className="at-divider" style={{ margin: "28px 0" }} />
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
