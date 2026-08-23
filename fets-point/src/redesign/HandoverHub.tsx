/* ═══════════════════════════════════════════════════════════════════════════
   FETS HANDOVER — flagship page (Atelier theme)
   Shift-day flow: ① Shift Start → ② Duty Timeline (lead-monitored) → ③ Shift End
   + 6-Day Consecutive Category & Lead Rotation, Dynamic Roster Connection,
     Characteristic-based Staff Inputs, Lead Verification Console,
     Executive Operations & Reports Dashboard (Duty Master Editor, Workload Analytics,
     Security Audit Trail, and Handover Archives).
   ═══════════════════════════════════════════════════════════════════════════ */
import React from "react";
import {
  Calendar, Clock, Users, Crown, Check, X, ChevronRight, ChevronLeft, ChevronDown,
  RefreshCcw, Plus, Trash2, Settings, Download, AlertTriangle, Search, Filter,
  ClipboardCheck, Sunrise, ListChecks, MoonStar, BarChart3, UserCheck, ArrowLeftRight,
  MessageSquare, Database, FileText, Server, Building2, AlertCircle, CheckCircle2,
  ShieldCheck, ShieldAlert, Laptop, Lock, Send, Sparkles, CheckSquare, Edit3,
  PieChart, TrendingUp, Layers, Activity, Eye, Printer, SlidersHorizontal
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
  submitted: { label: "Submitted for Review", cls: "at-pill-progress", color: "var(--at-steel)" },
  in_progress: { label: "In Progress", cls: "at-pill-progress", color: "var(--at-steel)" },
  done: { label: "Verified Done ✓", cls: "at-pill-done", color: "var(--at-aqua-deep)" },
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

/* ═══ MODAL POPUP: DUTY EDITOR (All staff create/edit, Super Admin delete) ══ */
function DutyEditorModal({
  duty,
  isAdmin,
  onClose,
  onSaved,
  onDeleted,
}: {
  duty: any;
  isAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [form, setForm] = React.useState<any>({
    id: duty?.id || "",
    title: duty?.title || "",
    category: duty?.category || "admin_calendar",
    description: duty?.description || "",
    scheduled_time: duty?.scheduled_time || "09:00",
    sort_order: duty?.sort_order || 10,
    priority: duty?.priority || "normal",
    characteristic_type: duty?.characteristic_type || "general",
    characteristic_label: duty?.characteristic_label || "",
    characteristic_placeholder: duty?.characteristic_placeholder || "",
    steps: Array.isArray(duty?.steps) ? duty.steps : normSteps(duty?.steps),
    branch: duty?.branch || "both",
    is_active: duty?.is_active !== false,
  });
  const [saving, setSaving] = React.useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Please enter a duty title");
      return;
    }
    setSaving(true);
    try {
      await DD.saveDuty(form);
      toast.success(form.id ? "Duty updated successfully" : "New duty created");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save duty");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!form.id) return;
    if (!window.confirm(`Are you sure you want to delete duty "${form.title}"?`)) return;
    try {
      await DD.deleteDuty(form.id);
      toast.success("Duty deleted");
      onDeleted();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete duty");
    }
  };

  return (
    <div className="at-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="at-modal-dialog">
        <div className="at-modal-head">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="at-cat-icon" style={{ width: 34, height: 34 }}>
              <Edit3 size={16} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "var(--at-ink)" }}>
                {form.id ? "Edit Operational Duty" : "Create New Operational Duty"}
              </div>
              <div style={{ fontSize: 11, color: "var(--at-ink-3)" }}>
                Accessible to all staff · Super Admin protected delete
              </div>
            </div>
          </div>
          <button type="button" className="at-btn at-btn-sm" onClick={onClose} style={{ padding: "4px 8px" }}>
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="at-modal-body">
            {/* Title & Category */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "var(--at-ink-3)" }}>Duty Title *</span>
                <input
                  className="at-input"
                  required
                  placeholder="e.g. RMA Running / Testing Server Sync"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "var(--at-ink-3)" }}>Category *</span>
                <select
                  className="at-select"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {DD.DUTY_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* Time & Sort Order & Characteristic Type */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "var(--at-ink-3)" }}>Scheduled Time</span>
                <input
                  className="at-input"
                  type="time"
                  value={form.scheduled_time || ""}
                  onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "var(--at-ink-3)" }}>Sort Order</span>
                <input
                  className="at-input"
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "var(--at-ink-3)" }}>Branch</span>
                <select
                  className="at-select"
                  value={form.branch}
                  onChange={(e) => setForm({ ...form, branch: e.target.value })}
                >
                  <option value="both">Both Centres</option>
                  <option value="calicut">Calicut Only</option>
                  <option value="cochin">Cochin Only</option>
                </select>
              </label>
            </div>

            {/* Characteristic Input Config */}
            <div style={{ background: "var(--at-recessed)", padding: "10px 12px", borderRadius: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", color: "var(--at-steel)" }}>
                Staff Recording Type (Input Field for Staff View)
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <select
                  className="at-select"
                  value={form.characteristic_type}
                  onChange={(e) => setForm({ ...form, characteristic_type: e.target.value })}
                >
                  <option value="general">General (Time & Observation Note)</option>
                  <option value="rma_time">RMA Run (Time Picker & Status)</option>
                  <option value="temperature">Infrastructure (Room Temp in °C & UPS)</option>
                  <option value="dvr_check">DVR Check (Camera Live Feeds & Storage)</option>
                  <option value="workstation_count">Workstations (Terminal & Headset Counts)</option>
                  <option value="ticket_refs">Cases (CPR / Ticket Reference Numbers)</option>
                  <option value="supplies">Office Supplies (Restock & Inventory)</option>
                </select>

                <input
                  className="at-input"
                  placeholder="Input Label (e.g. Temperature °C)"
                  value={form.characteristic_label || ""}
                  onChange={(e) => setForm({ ...form, characteristic_label: e.target.value })}
                />
              </div>
            </div>

            {/* Description */}
            <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "var(--at-ink-3)" }}>Operational Description</span>
              <input
                className="at-input"
                placeholder="Brief guidelines on how this task should be performed..."
                value={form.description || ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </label>

            {/* Steps */}
            <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "var(--at-ink-3)" }}>
                Sub-steps (One step per line)
              </span>
              <textarea
                className="at-input"
                rows={3}
                placeholder={"Verify candidate IDs\nConfirm examination slots\nSubmit daily sign-off"}
                value={(form.steps || []).map((s: any) => s.title).join("\n")}
                onChange={(e) =>
                  setForm({
                    ...form,
                    steps: e.target.value
                      .split("\n")
                      .map((t) => t.trim())
                      .filter(Boolean)
                      .map((t) => ({ title: t })),
                  })
                }
              />
            </label>
          </div>

          <div className="at-modal-foot">
            {isAdmin && form.id ? (
              <button type="button" className="at-btn at-btn-blush" onClick={handleDelete}>
                <Trash2 size={13} /> Delete Duty
              </button>
            ) : <div />}

            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="at-btn" onClick={onClose}>Cancel</button>
              <button type="submit" className="at-btn at-btn-primary" disabled={saving}>
                <Check size={14} /> {saving ? "Saving…" : "Save Duty"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══ STAFF PROMINENT VIEW: MY ASSIGNED TASKS (Recording characteristic values) ══ */
function MyAssignedTasksSection({
  hub,
  onDataSaved,
}: {
  hub: any;
  onDataSaved: () => void;
}) {
  const { duties, logs, me, branch } = hub;

  const myDutiesWithLogs = duties
    .map((d: any) => {
      const log = logs.find((l: any) => l.duty_id === d.id);
      return { duty: d, log };
    })
    .filter(({ log }: any) => log && log.staff_name?.toLowerCase().trim() === me.toLowerCase().trim());

  const [inputs, setInputs] = React.useState<Record<string, { recorded_time: string; recorded_val: string; note: string }>>({});

  React.useEffect(() => {
    const map: any = {};
    myDutiesWithLogs.forEach(({ duty, log }: any) => {
      if (log) {
        map[duty.id] = {
          recorded_time: log.recorded_time || (duty.scheduled_time || "09:00"),
          recorded_val: log.recorded_val || "",
          note: log.note || "",
        };
      }
    });
    setInputs(map);
  }, [logs]);

  if (!myDutiesWithLogs.length) return null;

  const handleFieldChange = (dutyId: string, field: string, val: string) => {
    setInputs((prev) => ({
      ...prev,
      [dutyId]: {
        ...(prev[dutyId] || { recorded_time: "09:00", recorded_val: "", note: "" }),
        [field]: val,
      },
    }));
  };

  const handleSaveStaffData = async (duty: any, log: any) => {
    const current = inputs[duty.id] || { recorded_time: duty.scheduled_time, recorded_val: "", note: "" };
    try {
      await DD.submitStaffDutyData(log.id, current, me);
      toast.success(`Submitted data for "${duty.title}"`);
      onDataSaved();
    } catch (e: any) {
      toast.error(e?.message || "Failed to submit task data");
    }
  };

  return (
    <div className="at-my-tasks-section">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={16} style={{ color: "var(--at-steel)" }} />
            <span style={{ fontSize: 13, fontWeight: 850, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--at-steel-deep)" }}>
              My Assigned Operational Tasks Today ({myDutiesWithLogs.length})
            </span>
          </div>
          <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--at-ink-2)" }}>
            Please record the required times, measurements, and notes for your 6-day cycle tasks. The Lead will review and verify your submissions.
          </p>
        </div>
        <span className="at-pill at-pill-progress">6-Day Assignment Cycle Active</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 10 }}>
        {myDutiesWithLogs.map(({ duty, log }: any) => {
          const state = inputs[duty.id] || { recorded_time: duty.scheduled_time || "09:00", recorded_val: "", note: "" };
          const status = log?.status || "pending";
          const isDone = status === "done";
          const isSubmitted = status === "submitted";
          const Icon = CATEGORY_ICONS[duty.category] || ListChecks;

          return (
            <div key={duty.id} className="at-my-task-card" style={{ borderLeft: `4px solid ${isDone ? "var(--at-aqua-deep)" : isSubmitted ? "var(--at-steel)" : "var(--at-sky)"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="at-cat-icon" style={{ width: 30, height: 30 }}>
                    <Icon size={14} />
                  </div>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "var(--at-ink)" }}>{duty.title}</span>
                    <span style={{ fontSize: 11, color: "var(--at-ink-3)", marginLeft: 8 }}>
                      Scheduled: <strong>{fmtTime(duty.scheduled_time)}</strong>
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={`at-pill ${STATUS_META[status]?.cls || "at-pill-pending"}`}>
                    {STATUS_META[status]?.label || "Pending"}
                  </span>
                  {log?.verified_by && (
                    <span style={{ fontSize: 10.5, color: "var(--at-aqua-deep)", fontWeight: 700 }}>
                      Verified by {log.verified_by}
                    </span>
                  )}
                </div>
              </div>

              {duty.description && (
                <div style={{ fontSize: 11.5, color: "var(--at-ink-3)" }}>{duty.description}</div>
              )}

              {/* Specialized Characteristic Input Form */}
              <div className="at-char-input-grid">
                {/* 1. Time Input */}
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "var(--at-ink-3)" }}>
                    <Clock size={10} style={{ verticalAlign: "-1px", marginRight: 3 }} />
                    Execution / Check Time
                  </span>
                  <input
                    type="time"
                    className="at-input"
                    value={state.recorded_time}
                    disabled={isDone}
                    onChange={(e) => handleFieldChange(duty.id, "recorded_time", e.target.value)}
                    style={{ background: "#fff", height: 34, fontSize: 12 }}
                  />
                </label>

                {/* 2. Characteristic Value / Measurement */}
                <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "span 2" }}>
                  <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "var(--at-ink-3)" }}>
                    {duty.characteristic_label || "Recorded Measurement / Value / Reference"}
                  </span>
                  <input
                    type="text"
                    className="at-input"
                    placeholder={duty.characteristic_placeholder || "e.g. 21.8°C room temp / 08:45 AM executed / SD-88410"}
                    value={state.recorded_val}
                    disabled={isDone}
                    onChange={(e) => handleFieldChange(duty.id, "recorded_val", e.target.value)}
                    style={{ background: "#fff", height: 34, fontSize: 12 }}
                  />
                </label>

                {/* 3. Notes */}
                <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
                  <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "var(--at-ink-3)" }}>
                    Staff Observation Notes & Details
                  </span>
                  <input
                    type="text"
                    className="at-input"
                    placeholder="Enter any issues encountered, equipment status, or operational observations…"
                    value={state.note}
                    disabled={isDone}
                    onChange={(e) => handleFieldChange(duty.id, "note", e.target.value)}
                    style={{ background: "#fff", height: 34, fontSize: 12 }}
                  />
                </label>
              </div>

              {/* Action Button */}
              {!isDone && (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    className="at-btn at-btn-primary at-btn-sm"
                    onClick={() => handleSaveStaffData(duty, log)}
                  >
                    <Send size={12} /> Save & Submit Task Data
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══ TODAY'S DUTY TIMELINE + LEAD CONSOLE (Execution only, no edit buttons) ═ */
function DutyTimeline({ hub }: { hub: any }) {
  const { duties, logs, lead, presentStaff, me, isAdmin, branch, reload } = hub;
  const isLead = me.toLowerCase().trim() === (lead || "").toLowerCase().trim();
  const canVerify = isAdmin || isLead;

  const [activeTab, setActiveTab] = React.useState<"all" | "mine" | "pending" | "done" | "attention">("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");
  const [collapsedCats, setCollapsedCats] = React.useState<Record<string, boolean>>({});
  const [openSteps, setOpenSteps] = React.useState<Record<string, boolean>>({});
  const [selectedStaffFilter, setSelectedStaffFilter] = React.useState<string | null>(null);

  const act = async (fn: () => Promise<any>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
      reload();
    } catch (e: any) {
      toast.error(e?.message || "Action failed");
    }
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

      if (activeTab === "mine" && owner.toLowerCase().trim() !== me.toLowerCase().trim()) return false;
      if (activeTab === "pending" && status === "done") return false;
      if (activeTab === "done" && status !== "done") return false;
      if (activeTab === "attention" && status !== "attention" && status !== "missed" && d.priority !== "attention") return false;

      if (selectedStaffFilter && owner !== selectedStaffFilter) return false;
      if (selectedCategory !== "all" && d.category !== selectedCategory) return false;

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

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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

      {/* ── PROMINENT MY ASSIGNED TASKS SECTION ── */}
      <MyAssignedTasksSection hub={hub} onDataSaved={reload} />

      {/* ── SUPERVISOR TEAM PROGRESS VIEW ── */}
      <div className="at-card at-card-pad" style={{ background: "#ffffff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--at-ink-3)" }}>
            Team Progress // 6-Day Consecutive Cycle Breakdown
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
            const isCenterLead = name.toLowerCase().trim() === (lead || "").toLowerCase().trim();
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
                  <span>{s.completed}/{s.total} verified done</span>
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
            ✓ Verified Completed <span className="at-filter-tab-count">{completedCount}</span>
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
                    {cat.doneInCat} / {cat.totalInCat} verified done · {cat.totalInCat > 0 ? Math.round((cat.doneInCat / cat.totalInCat) * 100) : 0}%
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
                      const isOwnerLead = owner.toLowerCase().trim() === (lead || "").toLowerCase().trim();
                      const ownerOff = !presentStaff.includes(owner);
                      const steps = normSteps(duty.steps);
                      const areStepsOpen = !!openSteps[duty.id];
                      const stepsState: boolean[] = log
                        ? steps.map((_: any, i: number) => !!(log.steps_state || [])[i])
                        : steps.map(() => false);
                      const stepsDoneCount = stepsState.filter(Boolean).length;

                      return (
                        <div
                          key={duty.id}
                          className={`at-task-row ${isDone ? "is-done" : isAttention ? "is-attention" : ""}`}
                        >
                          {/* 1. Lead Verification Checkbox */}
                          <button
                            type="button"
                            className={`at-task-chk ${isDone ? "checked" : ""}`}
                            title={canVerify ? (isDone ? "Unverify task" : "Lead verify completed") : "Verification restricted to Lead of the day"}
                            disabled={!canVerify}
                            onClick={() => {
                              if (!log) return;
                              const newStatus = isDone ? "pending" : "done";
                              act(async () => {
                                await DD.verifyDutyByLead(log.id, me, newStatus);
                                await DD.logSecurityAudit(
                                  newStatus === "done" ? "VERIFY_DUTY_DONE" : "UNVERIFY_DUTY",
                                  branch, me, duty.title
                                );
                              }, isDone ? "Marked pending" : "Lead verified task as Done ✓");
                            }}
                          >
                            <Check size={14} strokeWidth={3.5} />
                          </button>

                          {/* 2. Scheduled Time */}
                          <div className="at-task-time">
                            <Clock size={11} style={{ verticalAlign: "-1px", marginRight: 3 }} />
                            {fmtTime(duty.scheduled_time)}
                          </div>

                          {/* 3. Task Title & Submitted Data */}
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

                            {/* Staff Submitted Characteristic Values Display */}
                            {(log?.recorded_val || log?.recorded_time || log?.note) && (
                              <div style={{ background: "rgba(134, 179, 209, 0.12)", padding: "4px 8px", borderRadius: 8, marginTop: 4, fontSize: 11, color: "var(--at-ink)" }}>
                                {log.recorded_time && <span><strong>Time:</strong> {log.recorded_time} · </span>}
                                {log.recorded_val && <span><strong>Recorded:</strong> {log.recorded_val} · </span>}
                                {log.note && <span><strong>Note:</strong> {log.note}</span>}
                              </div>
                            )}

                            {duty.description && !log?.recorded_val && (
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
                                        disabled={!canVerify && !isOwnerMe}
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

                          {/* 5. Lead Verification Controls */}
                          <div className="at-task-actions">
                            <select
                              className="at-select"
                              style={{
                                fontSize: 11, padding: "4px 8px",
                                fontWeight: 750,
                                borderColor: STATUS_META[status]?.color || "var(--at-line)",
                              }}
                              value={status}
                              disabled={!canVerify}
                              onChange={(e) => {
                                if (!log) return;
                                const s = e.target.value as any;
                                act(async () => {
                                  await DD.setLogStatus(log.id, s, me);
                                  await DD.logSecurityAudit(`SET_STATUS_${s.toUpperCase()}`, branch, me, duty.title);
                                  if (s === "attention" || s === "missed") {
                                    sendChatAlert({ kind: "missed", branch, duty: duty.title, owner, by: me });
                                  }
                                }, `Status updated to ${s}`);
                              }}
                            >
                              <option value="pending">Pending</option>
                              <option value="submitted">Submitted</option>
                              <option value="in_progress">In Progress</option>
                              <option value="done">Verified Done ✓</option>
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
                                title="Reassign duty for today"
                                onChange={(e) => {
                                  if (!e.target.value || !log) return;
                                  const to = e.target.value;
                                  act(async () => {
                                    await DD.reassignLog(log.id, to, me);
                                    await DD.logSecurityAudit("REASSIGN_DUTY", branch, me, `${duty.title} to ${to}`);
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

      {/* Lead Final Shift Sign-off */}
      {isLead && (
        <div className="at-card at-card-pad" style={{ background: "linear-gradient(135deg, #ffffff 0%, rgba(153, 206, 211, 0.15) 100%)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--at-ink)" }}>Lead Shift Sign-off & Verification Confirmation</div>
            <div style={{ fontSize: 11.5, color: "var(--at-ink-3)" }}>
              As today's Lead ({lead}), confirm that all staff have communicated and completed their assigned checklist duties.
            </div>
          </div>
          <button
            type="button"
            className="at-btn at-btn-aqua"
            onClick={() => {
              act(async () => {
                await DD.logSecurityAudit("LEAD_FINAL_SIGN_OFF", branch, me, `All ${completedCount}/${totalTasks} verified`);
              }, "Lead daily sign-off recorded successfully");
            }}
          >
            <ShieldCheck size={15} /> Complete & Submit Shift Day Verification
          </button>
        </div>
      )}
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

  const [stretchDayMap, setStretchDayMap] = React.useState<Record<string, { lead: string | null; catMap: any }>>({});

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const map: Record<string, { lead: string | null; catMap: any }> = {};
      for (const day of days) {
        const res = await DD.getStretchAssignmentsForDate(day.dateKey, branch);
        map[day.dateKey] = res;
      }
      if (alive) setStretchDayMap(map);
    })();
    return () => { alive = false; };
  }, [days, branch]);

  return (
    <React.Fragment>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div className="at-section-label" style={{ margin: 0 }}>
          Consecutive 7-Day Duty & Lead Schedule Matrix · {days[0]?.dayNum} – {days[6]?.dayNum}
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--at-steel)" }}>
          👑 Crown indicates Lead of the Day (6-Day Working Block)
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
                const dayLead = stretchDayMap[day.dateKey]?.lead || staff[0];
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
                    const stretchStaff = stretchDayMap[day.dateKey]?.catMap?.[duty.category];
                    const assignedStaff = a?.is_override ? baseStaff : (stretchStaff || baseStaff);
                    const log = weekLogs.find((l: any) => l.duty_id === duty.id && l.date === day.dateKey);
                    const status = log?.status || (day.dateKey > DD.ymd(new Date()) ? "future" : "pending");
                    const isDayLead = assignedStaff === stretchDayMap[day.dateKey]?.lead;

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

/* ═══ REPORTS & ADMIN: EXECUTIVE OPERATIONS & AUDIT DASHBOARD ═══════════════ */
function ExecutiveOperationsDashboard({
  hub,
  onOpenDutyEditor,
}: {
  hub: any;
  onOpenDutyEditor: (d?: any) => void;
}) {
  const { weekLogs, duties, weekStart, branch, isAdmin, reload } = hub;

  const [selectedBranchFilter, setSelectedBranchFilter] = React.useState<string>(branch || "global");
  const [activeDashboardTab, setActiveDashboardTab] = React.useState<"analytics" | "duties_mgmt" | "logs" | "security" | "history">("analytics");
  const [dutySearch, setDutySearch] = React.useState("");
  const [selectedDutyCategory, setSelectedDutyCategory] = React.useState<string>("all");

  const [auditLogs, setAuditLogs] = React.useState<DD.SecurityAuditEntry[]>([]);

  React.useEffect(() => {
    setAuditLogs(DD.getSecurityAuditLogs(selectedBranchFilter));
  }, [selectedBranchFilter]);

  const dated = weekLogs.filter((l: any) => l.date <= DD.ymd(new Date()));
  const done = dated.filter((l: any) => l.status === "done").length;
  const missed = dated.filter((l: any) => l.status === "missed" || l.status === "attention").length;
  const pending = dated.filter((l: any) => l.status === "pending" || l.status === "submitted" || l.status === "in_progress").length;
  const covered = dated.filter((l: any) => l.original_staff_name).length;
  const total = Math.max(1, done + missed + pending);
  const pct = Math.round((done / total) * 100);

  // Equal Workload distribution calculation
  const byStaff: Record<string, { total: number; done: number; missed: number; pending: number }> = {};
  dated.forEach((l: any) => {
    const sName = l.staff_name || "Unassigned";
    byStaff[sName] = byStaff[sName] || { total: 0, done: 0, missed: 0, pending: 0 };
    byStaff[sName].total++;
    if (l.status === "done") byStaff[sName].done++;
    else if (l.status === "missed" || l.status === "attention") byStaff[sName].missed++;
    else byStaff[sName].pending++;
  });

  const weekLabel = () => {
    const start = new Date(weekStart + "T00:00:00");
    const end = new Date(start); end.setDate(start.getDate() + 6);
    const f = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return `${f(start)} – ${f(end)}`;
  };

  const filteredDutiesList = duties.filter((d: any) => {
    if (selectedDutyCategory !== "all" && d.category !== selectedDutyCategory) return false;
    if (dutySearch.trim()) {
      const q = dutySearch.toLowerCase();
      const matchT = (d.title || "").toLowerCase().includes(q);
      const matchD = (d.description || "").toLowerCase().includes(q);
      if (!matchT && !matchD) return false;
    }
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── TOP CONTROL BAR ── */}
      <div className="at-card at-card-pad" style={{ background: "linear-gradient(145deg, #ffffff 0%, var(--at-recessed) 100%)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div>
            <div className="at-eyebrow" style={{ marginBottom: 2 }}>
              <span className="at-eyebrow-line" />
              <span className="at-eyebrow-text">Executive Operations Console // Multi-Centre</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 850, color: "var(--at-ink)", letterSpacing: "-0.01em" }}>
              Reports & Operational Administration
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <select
              className="at-select"
              value={selectedBranchFilter}
              onChange={(e) => setSelectedBranchFilter(e.target.value)}
              style={{ fontWeight: 700 }}
            >
              <option value="global">All Centres (Global)</option>
              <option value="calicut">Calicut Centre</option>
              <option value="cochin">Cochin Centre</option>
            </select>

            <button
              type="button"
              className="at-btn at-btn-primary at-btn-sm"
              onClick={() => onOpenDutyEditor()}
            >
              <Plus size={13} /> Add Operational Duty
            </button>

            <button
              type="button"
              className="at-btn at-btn-sm"
              onClick={() => window.print()}
              title="Print / Save PDF"
            >
              <Printer size={13} /> Print Report
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 16 }}>
          <div className="at-report-stat" style={{ borderLeft: "3px solid var(--at-aqua-deep)" }}>
            <div style={{ fontSize: 24, fontWeight: 850, color: "var(--at-aqua-deep)" }}>{done}</div>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "var(--at-ink-3)", marginTop: 4 }}>Verified Completed</div>
          </div>
          <div className="at-report-stat" style={{ borderLeft: "3px solid var(--at-steel)" }}>
            <div style={{ fontSize: 24, fontWeight: 850, color: "var(--at-steel)" }}>{pct}%</div>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "var(--at-ink-3)", marginTop: 4 }}>Completion Rate</div>
          </div>
          <div className="at-report-stat" style={{ borderLeft: "3px solid var(--at-blush-deep)" }}>
            <div style={{ fontSize: 24, fontWeight: 850, color: "var(--at-blush-deep)" }}>{missed}</div>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "var(--at-ink-3)", marginTop: 4 }}>Attention / Issues</div>
          </div>
          <div className="at-report-stat" style={{ borderLeft: "3px solid var(--at-sky)" }}>
            <div style={{ fontSize: 24, fontWeight: 850, color: "var(--at-sky)" }}>{covered}</div>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "var(--at-ink-3)", marginTop: 4 }}>Roster Covered Days</div>
          </div>
          <div className="at-report-stat" style={{ background: "rgba(153, 206, 211, 0.15)" }}>
            <div style={{ fontSize: 24, fontWeight: 850, color: "var(--at-steel-deep)" }}>100%</div>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "var(--at-ink-3)", marginTop: 4 }}>Workload Equality</div>
          </div>
        </div>
      </div>

      {/* ── DASHBOARD SUB-TABS ── */}
      <div className="at-filter-bar" style={{ padding: "6px 10px" }}>
        <div className="at-filter-tabs">
          <button
            className={`at-filter-tab ${activeDashboardTab === "analytics" ? "active" : ""}`}
            onClick={() => setActiveDashboardTab("analytics")}
          >
            <BarChart3 size={13} /> Workload Analytics & Equal Distribution
          </button>
          <button
            className={`at-filter-tab ${activeDashboardTab === "duties_mgmt" ? "active" : ""}`}
            onClick={() => setActiveDashboardTab("duties_mgmt")}
          >
            <Settings size={13} /> Operational Duties Master List ({duties.length})
          </button>
          <button
            className={`at-filter-tab ${activeDashboardTab === "logs" ? "active" : ""}`}
            onClick={() => setActiveDashboardTab("logs")}
          >
            <FileText size={13} /> Live Execution Logs & Measurements
          </button>
          <button
            className={`at-filter-tab ${activeDashboardTab === "security" ? "active" : ""}`}
            onClick={() => setActiveDashboardTab("security")}
          >
            <ShieldCheck size={13} /> Lead Security & Anti-Impersonation ({auditLogs.length})
          </button>
          <button
            className={`at-filter-tab ${activeDashboardTab === "history" ? "active" : ""}`}
            onClick={() => setActiveDashboardTab("history")}
          >
            <Clock size={13} /> Handover History
          </button>
        </div>
      </div>

      {/* ── TAB 1: WORKLOAD ANALYTICS & EQUAL LOAD DISTRIBUTION ── */}
      {activeDashboardTab === "analytics" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Staff Equal Load Cards */}
          <div className="at-card at-card-pad">
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--at-ink-3)", marginBottom: 12 }}>
              Staff Workload Distribution & Completion Index
            </div>
            <div className="at-team-progress-grid">
              {Object.entries(byStaff).map(([name, s]) => {
                const staffPct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
                return (
                  <div key={name} className="at-team-progress-card">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <AtAvatar name={name} size={24} />
                        <span style={{ fontSize: 13, fontWeight: 800, color: "var(--at-ink)" }}>{name}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 850, color: "var(--at-aqua-deep)" }}>{staffPct}%</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--at-ink-3)", fontWeight: 650, marginTop: 4 }}>
                      <span>{s.done} of {s.total} checks verified</span>
                      {s.missed > 0 && <span style={{ color: "var(--at-blush-deep)" }}>{s.missed} issues ⚠</span>}
                    </div>
                    <div style={{ width: "100%", height: 5, background: "var(--at-recessed)", borderRadius: 99, overflow: "hidden", marginTop: 4 }}>
                      <div style={{ width: `${staffPct}%`, height: "100%", background: "var(--at-aqua-deep)", borderRadius: 99 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Category Cyclic Distribution Ring Details */}
          <div className="at-card at-card-pad">
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--at-steel)", marginBottom: 10 }}>
              Continuous Cyclic Category Handoff Model (Equal Duty Sharing)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
              {DD.DUTY_CATEGORIES.map((cat) => {
                const Icon = CATEGORY_ICONS[cat.id] || ListChecks;
                const catDuties = duties.filter((d) => d.category === cat.id);
                return (
                  <div key={cat.id} style={{ background: "var(--at-recessed)", padding: 14, borderRadius: 12, border: "1px solid var(--at-line)", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div className="at-cat-icon" style={{ width: 28, height: 28 }}>
                        <Icon size={14} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "var(--at-ink)" }}>{cat.name}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--at-ink-3)" }}>{cat.description}</div>
                    <div style={{ fontSize: 11, color: "var(--at-steel)", fontWeight: 700, marginTop: 4 }}>
                      {catDuties.length} operational tasks · Assigned for 6-day individual working stretches
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: OPERATIONAL DUTIES MASTER LIST (All Staff Create & Edit, Admin Delete) ── */}
      {activeDashboardTab === "duties_mgmt" && (
        <div className="at-card at-card-pad">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--at-ink)" }}>
                Operational Duties Master Library ({filteredDutiesList.length})
              </div>
              <div style={{ fontSize: 11, color: "var(--at-ink-3)" }}>
                All staff can create and edit duties · Deletion is strictly reserved for Super Admins.
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ position: "relative", minWidth: 200 }}>
                <Search size={13} style={{ position: "absolute", left: 10, top: 11, color: "var(--at-ink-3)" }} />
                <input
                  type="text"
                  className="at-input"
                  placeholder="Search duty library…"
                  value={dutySearch}
                  onChange={(e) => setDutySearch(e.target.value)}
                  style={{ paddingLeft: 28, fontSize: 11.5, height: 34 }}
                />
              </div>

              <select
                className="at-select"
                value={selectedDutyCategory}
                onChange={(e) => setSelectedDutyCategory(e.target.value)}
                style={{ fontSize: 11.5, height: 34 }}
              >
                <option value="all">All Categories</option>
                {DD.DUTY_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <button
                type="button"
                className="at-btn at-btn-primary at-btn-sm"
                onClick={() => onOpenDutyEditor()}
              >
                <Plus size={13} /> Add New Duty
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filteredDutiesList.map((d: any) => {
              const Icon = CATEGORY_ICONS[d.category] || ListChecks;
              return (
                <div
                  key={d.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderRadius: 12,
                    background: "var(--at-recessed)",
                    border: "1px solid var(--at-line)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                    <div className="at-cat-icon" style={{ width: 32, height: 32 }}>
                      <Icon size={15} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 750, color: "var(--at-ink)" }}>{d.title}</div>
                      <div style={{ fontSize: 11, color: "var(--at-ink-3)", display: "flex", gap: 10, flexWrap: "wrap", marginTop: 2 }}>
                        <span>Category: <strong>{d.category || "General"}</strong></span>
                        <span>Scheduled: <strong>{fmtTime(d.scheduled_time)}</strong></span>
                        <span>Input: <strong>{d.characteristic_type || "general"}</strong></span>
                        <span>Steps: <strong>{normSteps(d.steps).length}</strong></span>
                        <span>Branch: <strong>{d.branch}</strong></span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="at-btn at-btn-sm"
                    onClick={() => onOpenDutyEditor(d)}
                    style={{ marginLeft: 12 }}
                  >
                    <Settings size={13} /> Edit Duty
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 3: LIVE OPERATIONAL EXECUTION LOGS & MEASUREMENTS ── */}
      {activeDashboardTab === "logs" && (
        <div className="at-card at-card-pad">
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--at-ink-3)", marginBottom: 10 }}>
            Detailed Duty Execution Logs & Staff Characteristic Measurements
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="at-matrix-table">
              <thead>
                <tr>
                  <th>Duty Title</th>
                  <th>Category</th>
                  <th>Staff Assigned</th>
                  <th>Recorded Time / Measurement / Note</th>
                  <th>Status</th>
                  <th>Verified By</th>
                </tr>
              </thead>
              <tbody>
                {duties.map((d: any) => {
                  const log = dated.find((l: any) => l.duty_id === d.id);
                  return (
                    <tr key={d.id}>
                      <td><strong>{d.title}</strong></td>
                      <td><span className="at-pill at-pill-pending" style={{ fontSize: 9 }}>{d.category}</span></td>
                      <td>{log?.staff_name || "—"}</td>
                      <td>
                        {log?.recorded_val || log?.recorded_time || log?.note ? (
                          <span style={{ fontSize: 11.5 }}>
                            {log.recorded_time && `[${log.recorded_time}] `}
                            <strong>{log.recorded_val || ""}</strong>
                            {log.note && ` — ${log.note}`}
                          </span>
                        ) : <span style={{ color: "var(--at-ink-4)" }}>—</span>}
                      </td>
                      <td>
                        <span className={`at-pill ${STATUS_META[log?.status || "pending"]?.cls || "at-pill-pending"}`}>
                          {STATUS_META[log?.status || "pending"]?.label}
                        </span>
                      </td>
                      <td style={{ fontSize: 11.5 }}>
                        {log?.verified_by ? `${log.verified_by} (${new Date(log.verified_at || "").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 4: LEAD SECURITY & ANTI-IMPERSONATION AUDIT ── */}
      {activeDashboardTab === "security" && (
        <div className="at-card at-card-pad">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--at-ink)" }}>
                Lead Security & Anti-Impersonation Audit Log
              </div>
              <div style={{ fontSize: 11, color: "var(--at-ink-3)" }}>
                Tracks device fingerprints, browser session IDs, timestamps and terminals used to verify duties.
              </div>
            </div>
            <span className="at-pill at-pill-done"><ShieldCheck size={12} /> Audit Active</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 420, overflowY: "auto" }}>
            {!auditLogs.length ? (
              <div style={{ textAlign: "center", padding: 30, color: "var(--at-ink-3)", fontStyle: "italic" }}>
                No security audit logs recorded for this center yet.
              </div>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="at-audit-card">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(134, 179, 209, 0.2)", display: "grid", placeItems: "center" }}>
                      <Laptop size={14} style={{ color: "var(--at-steel)" }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 750, color: "var(--at-ink)" }}>
                        {log.actor_name} — <span style={{ color: "var(--at-steel)" }}>{log.action}</span>
                      </div>
                      <div style={{ fontSize: 10.5, color: "var(--at-ink-3)" }}>
                        {log.duty_title ? `Target: ${log.duty_title} · ` : ""}Device: {log.device_type} · Session: {log.session_id.slice(0, 8)}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--at-ink-3)", fontWeight: 650 }}>
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── TAB 5: SHIFT HANDOVER HISTORY ── */}
      {activeDashboardTab === "history" && (
        <div className="at-card at-card-pad">
          <div className="at-section-label" style={{ margin: "0 0 10px 0" }}>Historical Shift Handovers Archive</div>
          <HandoverHistory branch={branch} />
        </div>
      )}

    </div>
  );
}

/* ═══ MAIN HUB PAGE ════════════════════════════════════════════════════════ */
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

  // Modal duty editor state
  const [modalDuty, setModalDuty] = React.useState<any>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const openDutyEditor = (d?: any) => {
    setModalDuty(d || null);
    setIsModalOpen(true);
  };

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
  const isLead = me.toLowerCase().trim() === (lead || "").toLowerCase().trim();

  const stages = [
    { id: "start", label: "Shift Start", sub: "Incoming lead takeover", icon: Sunrise },
    { id: "duties", label: "Duty Timeline", sub: "Checklist, staff inputs & lead verification", icon: ListChecks },
    { id: "end", label: "Shift End", sub: "Shift close & sign-off", icon: MoonStar },
    { id: "reports", label: "Reports & Admin", sub: "Operations dashboard, duty master & audit", icon: BarChart3 },
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

            {/* ② DUTY TIMELINE (Clean execution without edit buttons) */}
            {stage === "duties" && (
              <React.Fragment>
                <DutyTimeline hub={hub} />

                <hr className="at-divider" style={{ margin: "28px 0" }} />
                <WeekDuties hub={hub} />
              </React.Fragment>
            )}

            {/* ③ SHIFT END */}
            {stage === "end" && <ShiftEnd branch={branch} trimmed onSubmitted={reload} />}

            {/* ④ REPORTS & ADMIN (Executive Dashboard) */}
            {stage === "reports" && (
              <ExecutiveOperationsDashboard hub={hub} onOpenDutyEditor={openDutyEditor} />
            )}
          </React.Fragment>
        )}

        {/* ── MODAL POPUP DIALOG FOR DUTY CREATION & EDITING ── */}
        {isModalOpen && (
          <DutyEditorModal
            duty={modalDuty}
            isAdmin={isAdmin}
            onClose={() => setIsModalOpen(false)}
            onSaved={reload}
            onDeleted={reload}
          />
        )}
      </div>
    </div>
  );
}
