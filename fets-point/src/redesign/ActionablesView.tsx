// @ts-nocheck
/* eslint-disable */
import React, { useState, useEffect, useMemo, useRef } from "react";
import * as ACT from "./actionables-data";
import { toast } from "react-hot-toast";

const AV_COLORS = ["#ff007f", "#00b8e0", "#e0a000", "#b14bf4", "#ff5100", "#00c050", "#2563EB", "#DC2626"];
const colorFor = (n: string = "") => AV_COLORS[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_COLORS.length];
const initials = (n: string = "") => n.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
const timeAgo = (d: string) => {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return fmtDate(d);
};
const fmtSize = (b?: number) => (!b ? "" : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

const progressOf = (st: string) => ({ pending: 12, in_progress: 58, submitted: 88, completed: 100 }[st] || 0);

function richLines(text: string) {
  if (!text) return null;
  return String(text)
    .split(/\n+/)
    .map((line, idx) => {
      line = line.trim();
      if (!line) return null;
      const m = line.match(/^([^:]{2,42}?):\s+(.+)$/);
      if (m && !/https?$/i.test(m[1])) {
        return (
          <div key={idx} style={{ display: "flex", gap: 10, padding: "3px 0", alignItems: "baseline" }}>
            <span style={{ fontWeight: 700, color: "var(--accent-line)", minWidth: 90, flexShrink: 0, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {m[1]}
            </span>
            <span style={{ fontWeight: 500, color: "var(--ink)", wordBreak: "break-word", fontSize: 13.5 }}>
              {linkify(m[2])}
            </span>
          </div>
        );
      }
      return (
        <div key={idx} style={{ padding: "3px 0", fontSize: 13.5, color: "var(--ink)", fontWeight: 450 }}>
          {linkify(line)}
        </div>
      );
    });
}

function linkify(t: string) {
  const parts = t.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((p, i) =>
    /^https?:\/\//.test(p) ? (
      <a key={i} href={p} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", textDecoration: "underline", fontWeight: 600 }}>
        {p.replace(/^https?:\/\//, "").slice(0, 36)}
        {p.length > 44 ? "…" : ""}
      </a>
    ) : (
      p
    )
  );
}

export function ActionablesView({ branch }: { branch?: string }) {
  const [me, setMe] = useState<ACT.ActionableStaff | null>(null);
  const [staff, setStaff] = useState<ACT.ActionableStaff[]>([]);
  const [acts, setActs] = useState<ACT.Actionable[]>([]);
  const [centres, setCentres] = useState<ACT.Centre[]>([]);
  const [rollout, setRollout] = useState<ACT.CentreRolloutItem[]>([]);
  const [compliance, setCompliance] = useState<ACT.ComplianceItem[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Navigation: 'dash' | 'acts' | 'rollout' | 'compliance' | 'assign' | 'team' | 'settings'
  const [view, setView] = useState<string>("dash");
  const [openActId, setOpenActId] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Sub-forms & states
  const [editingAct, setEditingAct] = useState(false);
  const [actTitle, setActTitle] = useState("");
  const [actDesc, setActDesc] = useState("");
  const [actDue, setActDue] = useState("");

  // Data & files for active actionable
  const [dataRows, setDataRows] = useState<ACT.ActionableDataEntry[]>([]);
  const [fileRows, setFileRows] = useState<ACT.ActionableFileEntry[]>([]);
  const [newDataLabel, setNewDataLabel] = useState("");
  const [newDataText, setNewDataText] = useState("");
  const [editingDataId, setEditingDataId] = useState<string | null>(null);
  const [editDataLabel, setEditDataLabel] = useState("");
  const [editDataText, setEditDataText] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [stepMsg, setStepMsg] = useState("");
  const [logMsg, setLogMsg] = useState("");
  const [addMemberId, setAddMemberId] = useState("");
  const [aiDoc, setAiDoc] = useState<any>(null);
  const [aiWriting, setAiWriting] = useState(false);

  // New Actionable form state
  const [fTitle, setFTitle] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fDue, setFDue] = useState("");
  const [fAssigned, setFAssigned] = useState<string[]>([]);
  const [fLead, setFLead] = useState("");
  const [fStep1, setFStep1] = useState("");

  // Compliance item form state
  const [compForm, setCompForm] = useState<Partial<ACT.ComplianceItem> | null>(null);

  // Webhook settings state
  const [whUrl, setWhUrl] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = !!me && me.role === "admin";

  const refreshAll = async () => {
    try {
      const [curMe, stList, actList, cList, rList, compList, setts] = await Promise.all([
        ACT.getOrCreateCurrentStaff(),
        ACT.fetchStaffList(),
        ACT.fetchActionables(),
        ACT.fetchCentres(),
        ACT.fetchRollout(),
        ACT.fetchCompliance(),
        ACT.fetchAppSettings(),
      ]);

      setMe(curMe);
      setStaff(stList);
      setActs(actList);
      setCentres(cList);
      setRollout(rList);
      setCompliance(compList);
      setSettings(setts);
      setWhUrl(setts.gchat_webhook || "");

      // Run background sync & compliance engine
      if (cList.length && actList.length) {
        await ACT.syncRolloutItems(cList, actList, rList);
      }
      if (compList.length) {
        await ACT.runComplianceEngine(compList, curMe?.id);
      }
    } catch (err) {
      console.error("Actionables fetch error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  // Load details when an actionable is opened
  useEffect(() => {
    if (!openActId) {
      setDataRows([]);
      setFileRows([]);
      setAiDoc(null);
      setEditingAct(false);
      return;
    }
    const loadActDetails = async () => {
      const [d, f] = await Promise.all([ACT.fetchDataEntries(openActId), ACT.fetchFiles(openActId)]);
      setDataRows(d);
      setFileRows(f);
      const ai = d.find((row) => row.label === "__ai_standard");
      if (ai) {
        try {
          const raw = typeof ai.content === "object" ? ai.content.text || JSON.stringify(ai.content) : ai.content;
          setAiDoc(JSON.parse(raw));
        } catch {
          setAiDoc(null);
        }
      } else {
        setAiDoc(null);
      }
    };
    loadActDetails();
  }, [openActId]);

  const activeAct = useMemo(() => acts.find((a) => a.id === openActId), [acts, openActId]);

  const isMine = (a: ACT.Actionable) => !!me && a.actionable_assignments.some((x) => x.staff && x.staff.id === me.id);
  const isLeadOnAct = (a: ACT.Actionable) => !!me && a.actionable_assignments.some((x) => x.staff && x.staff.id === me.id && x.member_role === "lead");
  const canManageAct = (a: ACT.Actionable) => isAdmin || isMine(a);
  const canEditActDef = (a: ACT.Actionable) => isAdmin || isLeadOnAct(a);

  // Counts & filters
  const stds = useMemo(() => acts.filter((a) => a.status === "completed"), [acts]);
  const inProgressActs = useMemo(() => acts.filter((a) => a.status === "in_progress"), [acts]);
  const pendingActs = useMemo(() => acts.filter((a) => a.status === "pending"), [acts]);
  const submittedActs = useMemo(() => acts.filter((a) => a.status === "submitted"), [acts]);

  const rolloutStds = useMemo(() => {
    const spawnedIds = new Set(rollout.map((r) => r.spawned_actionable_id).filter(Boolean));
    return acts.filter((a) => a.status === "completed" && !spawnedIds.has(a.id));
  }, [acts, rollout]);

  const complianceDueCount = useMemo(() => {
    return compliance.filter((i) => {
      if (!i.active) return false;
      const d = Math.ceil((new Date(i.next_due + "T00:00:00").getTime() - new Date(new Date().toDateString()).getTime()) / 864e5);
      return d <= i.lead_days;
    }).length;
  }, [compliance]);

  // Handlers
  const handleStartWork = async (actId: string) => {
    const ok = await ACT.updateActionableStatus(actId, "in_progress", me?.id, me?.name, "started work on this actionable");
    if (ok) {
      toast.success("Work started!");
      refreshAll();
    }
  };

  const handleSubmitReview = async (actId: string) => {
    if (!window.confirm("Submit this actionable as completed? It will be sent for review & Standard publication.")) return;
    const ok = await ACT.updateActionableStatus(actId, "submitted", me?.id, me?.name, "submitted this actionable as finished");
    if (ok) {
      toast.success("Submitted for review!");
      refreshAll();
    }
  };

  const handleApproveStandard = async (actId: string) => {
    const ok = await ACT.updateActionableStatus(actId, "completed", me?.id, me?.name, "approved this actionable — published to the Standards Library");
    if (ok) {
      toast.success("📘 Approved! Standard published.");
      refreshAll();
    }
  };

  const handleSendBack = async (actId: string) => {
    const ok = await ACT.updateActionableStatus(actId, "in_progress", me?.id, me?.name, "sent it back for revisions");
    if (ok) {
      toast("Sent back for more work", { icon: "↩️" });
      refreshAll();
    }
  };

  const handleSaveActEdit = async () => {
    if (!activeAct) return;
    const ok = await ACT.updateActionableDetails(activeAct.id, actTitle || activeAct.title, actDesc || activeAct.description || "", actDue || activeAct.due_date || "", me?.id, me?.name);
    if (ok) {
      toast.success("Actionable updated!");
      setEditingAct(false);
      refreshAll();
    }
  };

  const handleDeleteAct = async (actId: string) => {
    if (!window.confirm("Delete this actionable permanently? This will remove all work logs, collected data, and files.")) return;
    const ok = await ACT.deleteActionable(actId);
    if (ok) {
      toast.success("Actionable deleted");
      setOpenActId(null);
      refreshAll();
    }
  };

  const handlePostUpdate = async (kind: "update" | "instruction", text: string) => {
    if (!openActId || !text.trim()) return;
    const ok = await ACT.postActionableUpdate(openActId, me?.id, kind, text.trim());
    if (ok) {
      toast.success(kind === "instruction" ? "📌 Step added!" : "🔨 Logged!");
      if (kind === "instruction") setStepMsg("");
      else setLogMsg("");
      refreshAll();
    }
  };

  const handleAddData = async () => {
    if (!openActId || !newDataLabel.trim() || !newDataText.trim()) {
      toast.error("Provide both a label and details");
      return;
    }
    const ok = await ACT.addDataEntry(openActId, me?.id, newDataLabel.trim(), newDataText.trim());
    if (ok) {
      toast.success("🗂️ Data entry added!");
      setNewDataLabel("");
      setNewDataText("");
      const d = await ACT.fetchDataEntries(openActId);
      setDataRows(d);
    }
  };

  const handleSaveDataEdit = async (id: string) => {
    if (!editDataLabel.trim() || !editDataText.trim()) return;
    const ok = await ACT.updateDataEntry(id, editDataLabel.trim(), editDataText.trim());
    if (ok) {
      toast.success("Data entry saved");
      setEditingDataId(null);
      if (openActId) {
        const d = await ACT.fetchDataEntries(openActId);
        setDataRows(d);
      }
    }
  };

  const handleDeleteData = async (id: string) => {
    if (!window.confirm("Delete this data entry?")) return;
    const ok = await ACT.deleteDataEntry(id);
    if (ok) {
      toast.success("Data entry deleted");
      if (openActId) {
        const d = await ACT.fetchDataEntries(openActId);
        setDataRows(d);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file || !openActId) return;
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Maximum file size is 50MB");
      return;
    }
    setUploadBusy(true);
    const res = await ACT.uploadAttachment(openActId, me?.id || "", file);
    setUploadBusy(false);
    if (res.success) {
      toast.success("📎 File attached!");
      const f = await ACT.fetchFiles(openActId);
      setFileRows(f);
      refreshAll();
    } else {
      toast.error(res.error || "Upload failed");
    }
  };

  const handleDeleteFile = async (f: ACT.ActionableFileEntry) => {
    if (!window.confirm(`Delete file "${f.file_name}"?`)) return;
    const ok = await ACT.deleteAttachment(f);
    if (ok) {
      toast.success("File deleted");
      if (openActId) {
        const files = await ACT.fetchFiles(openActId);
        setFileRows(files);
      }
    }
  };

  const handleAddMember = async () => {
    if (!openActId || !addMemberId) return;
    const { error } = await ACT.supabase.from("actionable_assignments").insert({
      actionable_id: openActId,
      staff_id: addMemberId,
      member_role: "member",
    });
    if (!error) {
      const addedStaff = staff.find((s) => s.id === addMemberId);
      await ACT.postActionableUpdate(openActId, me?.id, "status_change", `${addedStaff?.name || "Staff"} was added to this actionable.`);
      toast.success(`👥 ${addedStaff?.name || "Member"} added!`);
      setAddMemberId("");
      refreshAll();
    }
  };

  const handleRemoveMember = async (assignId: string, memberName: string) => {
    if (!openActId || !window.confirm(`Remove ${memberName} from this actionable?`)) return;
    const { error } = await ACT.supabase.from("actionable_assignments").delete().eq("id", assignId);
    if (!error) {
      await ACT.postActionableUpdate(openActId, me?.id, "status_change", `${memberName} was removed from this actionable.`);
      toast.success("Member removed");
      refreshAll();
    }
  };

  // Rollout actions
  const handleCycleRollout = async (item: ACT.CentreRolloutItem, actCode?: string, cName?: string) => {
    const ok = await ACT.cycleRolloutStatus(item.id, item.status, me?.id, me?.name, actCode, cName);
    if (ok) {
      refreshAll();
    }
  };

  const handleSpawnRolloutTask = async (item: ACT.CentreRolloutItem, centre: ACT.Centre, standard: ACT.Actionable) => {
    if (!window.confirm(`Create a launch actionable for ${centre.name} from standard ${standard.code} · ${standard.title}?`)) return;
    const res = await ACT.spawnLaunchTaskFromRollout(item.id, centre, standard, me?.id, me?.name, acts);
    if (res.success) {
      toast.success(`🚀 Launch actionable created for ${centre.name}!`);
      await refreshAll();
      if (res.actionableId) {
        setOpenActId(res.actionableId);
      }
    } else {
      toast.error(res.error || "Failed to spawn task");
    }
  };

  const handleAddCentre = async () => {
    const name = window.prompt("New centre name (e.g. 'Trivandrum Centre'):");
    if (!name || !name.trim()) return;
    const { error } = await ACT.supabase.from("centres").insert({
      name: name.trim(),
      status: "planned",
      sort_order: centres.length + 1,
    });
    if (!error) {
      toast.success(`🏗️ ${name.trim()} added to the rollout board!`);
      refreshAll();
    }
  };

  const handleMarkCentreLive = async (c: ACT.Centre) => {
    if (!window.confirm(`Mark ${c.name} as LIVE? All standards have been deployed.`)) return;
    const { error } = await ACT.supabase.from("centres").update({ status: "live", launched_at: new Date().toISOString().slice(0, 10) }).eq("id", c.id);
    if (!error) {
      toast.success(`🎉 ${c.name} is now LIVE!`);
      refreshAll();
    }
  };

  // Compliance handlers
  const handleSaveCompliance = async () => {
    if (!compForm || !compForm.title || !compForm.next_due) {
      toast.error("Title and due date are required");
      return;
    }
    const payload = {
      title: compForm.title.trim(),
      category: compForm.category || "other",
      centre_id: compForm.centre_id || null,
      owner_staff_id: compForm.owner_staff_id || null,
      frequency: compForm.frequency || "yearly",
      next_due: compForm.next_due,
      lead_days: Number(compForm.lead_days) || 30,
      notes: compForm.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (compForm.id) {
      const { error } = await ACT.supabase.from("compliance_items").update(payload).eq("id", compForm.id);
      if (!error) toast.success("📅 Compliance item updated");
    } else {
      const { error } = await ACT.supabase.from("compliance_items").insert({ ...payload, active: true });
      if (!error) toast.success("📅 Compliance item created");
    }
    setCompForm(null);
    refreshAll();
  };

  const handleToggleCompActive = async (item: ACT.ComplianceItem) => {
    const { error } = await ACT.supabase.from("compliance_items").update({ active: !item.active, updated_at: new Date().toISOString() }).eq("id", item.id);
    if (!error) {
      toast.success(item.active ? "⏸️ Item paused" : "▶️ Item resumed");
      refreshAll();
    }
  };

  const handleDeleteComp = async (id: string) => {
    if (!window.confirm("Delete this compliance item?")) return;
    const { error } = await ACT.supabase.from("compliance_items").delete().eq("id", id);
    if (!error) {
      toast.success("Compliance item deleted");
      refreshAll();
    }
  };

  // Create Actionable Form
  const handleCreateAct = async () => {
    if (!fTitle.trim()) {
      toast.error("Please give the actionable a title");
      return;
    }
    const res = await ACT.createNewActionable({
      title: fTitle,
      description: fDesc,
      dueDate: fDue,
      createdByStaffId: me?.id,
      assignedStaffIds: fAssigned,
      leadStaffId: fLead || fAssigned[0],
      step1: fStep1,
      acts,
    });
    if (res.success && res.actionable) {
      toast.success(`🎉 ${res.actionable.code} created!`);
      setFTitle("");
      setFDesc("");
      setFDue("");
      setFAssigned([]);
      setFLead("");
      setFStep1("");
      setView("dash");
      await refreshAll();
      setOpenActId(res.actionable.id);
    } else {
      toast.error(res.error || "Failed to create actionable");
    }
  };

  // Webhook
  const handleSaveWebhook = async () => {
    const ok = await ACT.saveAppSetting("gchat_webhook", whUrl.trim());
    if (ok) toast.success(whUrl.trim() ? "🔔 Chat alerts ON!" : "🔕 Chat alerts turned off");
  };

  const handleTestWebhook = async () => {
    if (!acts.length) {
      toast.error("Create at least one actionable first");
      return;
    }
    await ACT.postActionableUpdate(acts[0].id, me?.id, "status_change", "Test ping from FETS Actionables — Google Chat notifications connected! 🎉");
    toast.success("🔔 Test ping sent to Google Chat space!");
  };

  // Next code computation
  const nextActCode = useMemo(() => {
    const codes = acts.map((a) => parseInt((a.code || "").replace(/\D/g, ""), 10)).filter((x) => !isNaN(x));
    const nextNum = (codes.length ? Math.max(...codes) : 0) + 1;
    return `ACT-${String(nextNum).padStart(2, "0")}`;
  }, [acts]);

  // Side-by-Side Matrix compilation for Standards
  const matrixData = useMemo(() => {
    if (!activeAct || activeAct.status !== "completed" || !dataRows.length) return null;
    const cleanRows = dataRows.filter((d) => !d.label.startsWith("__"));
    if (!cleanRows.length) return null;

    const cols: string[] = [];
    const itemsMap: Record<string, Record<string, string>> = {};
    const itemOrder: string[] = [];

    cleanRows.forEach((d) => {
      const parts = d.label.split("·").map((s) => s.trim()).filter(Boolean);
      const col = parts.length > 1 ? parts[0] : "Standard";
      const rowItem = parts.length > 1 ? parts.slice(1).join(" · ") : parts[0];

      if (!cols.includes(col)) cols.push(col);
      if (!itemsMap[rowItem]) {
        itemsMap[rowItem] = {};
        itemOrder.push(rowItem);
      }
      const valText = typeof d.content === "object" ? d.content.text || JSON.stringify(d.content) : d.content;
      itemsMap[rowItem][col] = (itemsMap[rowItem][col] ? itemsMap[rowItem][col] + "\n" : "") + valText;
    });

    return { cols, itemsMap, itemOrder };
  }, [activeAct, dataRows]);

  if (loading) {
    return (
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>
        <div className="eyebrow" style={{ color: "var(--accent)" }}>FETS · Actionables</div>
        <h2 style={{ fontSize: 28, fontWeight: 800, marginTop: 8, color: "var(--ink)" }}>Loading Actionables…</h2>
      </div>
    );
  }

  // ==========================================
  // RENDER: DETAIL VIEW (Single Actionable)
  // ==========================================
  if (openActId && activeAct) {
    const isCompleted = activeAct.status === "completed";
    const people = activeAct.actionable_assignments.filter((x) => x.staff);
    const steps = activeAct.actionable_updates.filter((u) => u.kind === "instruction");
    const logs = activeAct.actionable_updates.filter((u) => u.kind !== "instruction");
    const progress = progressOf(activeAct.status);

    const points = (activeAct.description || "")
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);

    return (
      <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Back Button */}
        <button
          onClick={() => {
            setOpenActId(null);
            setEditingAct(false);
          }}
          className="tap glass-2"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 12,
            alignSelf: "flex-start",
            fontWeight: 700,
            fontSize: 13,
            color: "var(--accent)",
            border: "1px solid var(--accent-line)",
          }}
        >
          ← Back to Actionables
        </button>

        {/* Head Card */}
        <div
          className="glass"
          style={{
            borderRadius: "var(--radius)",
            padding: "24px 28px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
            boxShadow: "var(--shadow-lift)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span
              style={{
                fontFamily: '"Archivo Expanded", var(--font)',
                fontSize: 16,
                fontWeight: 900,
                letterSpacing: "0.06em",
                background: "var(--accent)",
                color: "var(--accent-ink)",
                padding: "6px 14px",
                borderRadius: 10,
              }}
            >
              {activeAct.code}
            </span>
            <h1 style={{ margin: 0, fontSize: "clamp(22px, 3vw, 32px)", fontWeight: 850, letterSpacing: "-0.02em", color: "var(--ink)", flex: 1, minWidth: 240 }}>
              {activeAct.title}
            </h1>
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.06em",
                padding: "6px 14px",
                borderRadius: 999,
                color: isCompleted ? "#00e05c" : activeAct.status === "submitted" ? "#b14bf4" : activeAct.status === "in_progress" ? "var(--accent)" : "var(--ink-3)",
                background: "var(--inset)",
                border: "1px solid var(--hairline)",
              }}
            >
              {ACT.STATUS_LABELS[activeAct.status]}
            </span>

            {/* Action buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {canManageAct(activeAct) && activeAct.status === "pending" && (
                <button onClick={() => handleStartWork(activeAct.id)} className="tap" style={{ padding: "8px 18px", borderRadius: 10, background: "var(--accent)", color: "var(--accent-ink)", fontWeight: 800, fontSize: 13, border: "none" }}>
                  ▶ START WORK
                </button>
              )}
              {canManageAct(activeAct) && activeAct.status === "in_progress" && (
                <button onClick={() => handleSubmitReview(activeAct.id)} className="tap" style={{ padding: "8px 18px", borderRadius: 10, background: "var(--accent)", color: "var(--accent-ink)", fontWeight: 800, fontSize: 13, border: "none" }}>
                  📤 SUBMIT FOR REVIEW
                </button>
              )}
              {isAdmin && activeAct.status === "submitted" && (
                <React.Fragment>
                  <button onClick={() => handleApproveStandard(activeAct.id)} className="tap" style={{ padding: "8px 18px", borderRadius: 10, background: "#00e05c", color: "#053d1a", fontWeight: 800, fontSize: 13, border: "none" }}>
                    ✔ APPROVE → LIBRARY
                  </button>
                  <button onClick={() => handleSendBack(activeAct.id)} className="tap glass-2" style={{ padding: "8px 14px", borderRadius: 10, color: "var(--ink)", fontWeight: 700, fontSize: 13, border: "1px solid var(--hairline)" }}>
                    ↩ SEND BACK
                  </button>
                </React.Fragment>
              )}
              {isCompleted && (
                <button onClick={() => window.print()} className="tap glass-2" style={{ padding: "8px 14px", borderRadius: 10, color: "var(--ink)", fontWeight: 700, fontSize: 13, border: "1px solid var(--hairline)" }}>
                  🖨️ PRINT / PDF
                </button>
              )}
              {canEditActDef(activeAct) && !editingAct && (
                <button
                  onClick={() => {
                    setEditingAct(true);
                    setActTitle(activeAct.title);
                    setActDesc(activeAct.description || "");
                    setActDue(activeAct.due_date || "");
                  }}
                  className="tap glass-2"
                  style={{ padding: "8px 12px", borderRadius: 10, color: "var(--ink-2)", fontWeight: 650, fontSize: 12.5, border: "1px solid var(--hairline)" }}
                >
                  ✏️ Edit
                </button>
              )}
              {canEditActDef(activeAct) && (
                <button onClick={() => handleDeleteAct(activeAct.id)} className="tap glass-2" style={{ padding: "8px 12px", borderRadius: 10, color: "#ff4d4d", fontWeight: 650, fontSize: 12.5, border: "1px solid var(--hairline)" }}>
                  🗑️ Delete
                </button>
              )}
            </div>
          </div>

          {/* Edit form inline */}
          {editingAct ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px 0", borderTop: "1px solid var(--hairline)" }}>
              <div>
                <label className="eyebrow" style={{ fontSize: 10, color: "var(--accent)" }}>Title</label>
                <input value={actTitle} onChange={(e) => setActTitle(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "var(--inset)", border: "1px solid var(--hairline)", color: "var(--ink)", fontSize: 14 }} />
              </div>
              <div>
                <label className="eyebrow" style={{ fontSize: 10, color: "var(--accent)" }}>Purpose / Brief (point-wise, 1 per line)</label>
                <textarea value={actDesc} onChange={(e) => setActDesc(e.target.value)} rows={3} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "var(--inset)", border: "1px solid var(--hairline)", color: "var(--ink)", fontSize: 13.5, resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div>
                  <label className="eyebrow" style={{ fontSize: 10, color: "var(--accent)" }}>Due Date</label>
                  <input type="date" value={actDue} onChange={(e) => setActDue(e.target.value)} style={{ padding: "8px 12px", borderRadius: 10, background: "var(--inset)", border: "1px solid var(--hairline)", color: "var(--ink)", fontSize: 13 }} />
                </div>
                <div style={{ flex: 1 }} />
                <button onClick={handleSaveActEdit} className="tap" style={{ padding: "9px 20px", borderRadius: 10, background: "var(--accent)", color: "var(--accent-ink)", fontWeight: 800, fontSize: 13, border: "none" }}>
                  💾 Save Changes
                </button>
                <button onClick={() => setEditingAct(false)} className="tap glass-2" style={{ padding: "9px 14px", borderRadius: 10, color: "var(--ink)", fontWeight: 700, fontSize: 13, border: "1px solid var(--hairline)" }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
              {/* Purpose points */}
              <div>
                <div className="eyebrow" style={{ fontSize: 10.5, color: "var(--accent)", marginBottom: 8 }}>🎯 What's this for?</div>
                <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6, color: "var(--ink)", fontSize: 13.5, lineHeight: 1.5 }}>
                  {points.length ? points.map((p, idx) => <li key={idx}>{p}</li>) : <li style={{ color: "var(--ink-4)" }}>No detailed brief entered.</li>}
                </ul>
              </div>

              {/* Team on it */}
              <div>
                <div className="eyebrow" style={{ fontSize: 10.5, color: "var(--accent)", marginBottom: 8 }}>👥 Team on it</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  {people.map((p) => (
                    <span key={p.id} className="glass-2" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>
                      <span style={{ width: 22, height: 22, borderRadius: "50%", background: colorFor(p.staff.name), color: "#fff", display: "grid", placeItems: "center", fontSize: 10 }}>
                        {initials(p.staff.name)}
                      </span>
                      {p.staff.name}
                      {p.member_role === "lead" && (
                        <span style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 6px", borderRadius: 4, background: "var(--accent)", color: "var(--accent-ink)" }}>
                          LEAD
                        </span>
                      )}
                      {canEditActDef(activeAct) && (
                        <button onClick={() => handleRemoveMember(p.id, p.staff.name)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--ink-4)", padding: 0, fontSize: 13 }}>
                          ✕
                        </button>
                      )}
                    </span>
                  ))}
                  {canEditActDef(activeAct) && (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <select
                        value={addMemberId}
                        onChange={(e) => setAddMemberId(e.target.value)}
                        style={{ padding: "5px 10px", borderRadius: 8, background: "var(--inset)", border: "1px solid var(--hairline)", color: "var(--ink)", fontSize: 12 }}
                      >
                        <option value="">＋ Add staff…</option>
                        {staff
                          .filter((s) => !people.some((p) => p.staff.id === s.id))
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                      </select>
                      {addMemberId && (
                        <button onClick={handleAddMember} className="tap" style={{ padding: "5px 10px", borderRadius: 8, background: "var(--accent)", color: "var(--accent-ink)", fontWeight: 750, fontSize: 11.5, border: "none" }}>
                          Add
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 14, marginTop: 14, flexWrap: "wrap", fontSize: 11.5, color: "var(--ink-3)", fontWeight: 600 }}>
                  <span>📅 Created {fmtDate(activeAct.created_at)}</span>
                  {activeAct.due_date && <span>⏰ Due {fmtDate(activeAct.due_date)}</span>}
                  {activeAct.completed_at && <span style={{ color: "#00e05c" }}>✔ Approved {fmtDate(activeAct.completed_at)}</span>}
                </div>
              </div>
            </div>
          )}

          {/* Stepper Progress bar */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, paddingTop: 10, borderTop: "1px solid var(--hairline)" }}>
            {["1 · Brief Ready", "2 · In Progress", "3 · Under Review", "4 · Standard Library"].map((stage, idx) => {
              const currentIdx = { pending: 0, in_progress: 1, submitted: 2, completed: 3 }[activeAct.status] || 0;
              const isPast = idx < currentIdx;
              const isCurrent = idx === currentIdx;
              return (
                <div
                  key={idx}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    fontSize: 11.5,
                    fontWeight: 750,
                    textAlign: "center",
                    background: isCurrent ? "var(--accent-soft)" : isPast ? "var(--inset)" : "transparent",
                    color: isCurrent ? "var(--accent)" : isPast ? "var(--ink-2)" : "var(--ink-4)",
                    border: `1px solid ${isCurrent ? "var(--accent-line)" : isPast ? "var(--hairline)" : "transparent"}`,
                  }}
                >
                  {stage}
                </div>
              );
            })}
          </div>
        </div>

        {/* STANDARDS DOCUMENT VIEW (If Completed) */}
        {isCompleted && matrixData && (
          <div className="glass" style={{ borderRadius: "var(--radius)", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 22 }}>📘</span>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>Cross-Centre Comparison Matrix</h3>
                <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Compiled operating data side by side across centres</span>
              </div>
            </div>

            <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid var(--hairline)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>
                    <th style={{ padding: "12px 16px", fontWeight: 850, letterSpacing: "0.04em", minWidth: 160 }}>OPERATING ITEM</th>
                    {matrixData.cols.map((col) => (
                      <th key={col} style={{ padding: "12px 16px", fontWeight: 850, letterSpacing: "0.04em", minWidth: 220 }}>
                        {col.toUpperCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrixData.itemOrder.map((it, idx) => (
                    <tr key={it} style={{ background: idx % 2 === 0 ? "transparent" : "var(--glass-2)", borderBottom: "1px solid var(--hairline)" }}>
                      <td style={{ padding: "12px 16px", fontWeight: 750, color: "var(--accent)", verticalAlign: "top" }}>{it}</td>
                      {matrixData.cols.map((col) => (
                        <td key={col} style={{ padding: "12px 16px", verticalAlign: "top", lineHeight: 1.5 }}>
                          {matrixData.itemsMap[it][col] ? richLines(matrixData.itemsMap[it][col]) : <span style={{ color: "var(--ink-4)" }}>—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Step-by-Step Procedure Instructions */}
        <div className="glass" style={{ borderRadius: "var(--radius)", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>📌</span>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>Standard Operating Procedure — Steps</h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {steps.length ? (
              steps.map((st, i) => (
                <div key={st.id} className="inset" style={{ padding: "12px 16px", borderRadius: 12, display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, background: "var(--accent)", color: "var(--accent-ink)", fontWeight: 900, fontSize: 14, display: "grid", placeItems: "center", flexShrink: 0 }}>
                    {i + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 550, color: "var(--ink)", lineHeight: 1.5 }}>{st.message}</div>
                    <div style={{ fontSize: 10.5, color: "var(--ink-4)", marginTop: 4 }}>
                      {st.staff?.name || "Admin"} · {timeAgo(st.created_at)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p style={{ color: "var(--ink-4)", fontSize: 13.5, fontStyle: "italic", margin: 0 }}>No procedure steps added yet.</p>
            )}
          </div>

          {isAdmin && !isCompleted && (
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <input
                value={stepMsg}
                onChange={(e) => setStepMsg(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePostUpdate("instruction", stepMsg)}
                placeholder="Write step instruction for the team…"
                style={{ flex: 1, padding: "10px 14px", borderRadius: 10, background: "var(--inset)", border: "1px solid var(--hairline)", color: "var(--ink)", fontSize: 13.5 }}
              />
              <button onClick={() => handlePostUpdate("instruction", stepMsg)} className="tap" style={{ padding: "0 18px", borderRadius: 10, background: "var(--accent)", color: "var(--accent-ink)", fontWeight: 800, fontSize: 13, border: "none" }}>
                ＋ Add Step
              </button>
            </div>
          )}
        </div>

        {/* Two-Column Grid: Collected Data & Files */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
          {/* Collected Data Panel */}
          <div className="glass" style={{ borderRadius: "var(--radius)", padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>🗂️</span>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--ink)" }}>Collected Data</h3>
              </div>
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{dataRows.filter((d) => !d.label.startsWith("__")).length} entries</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 420, overflowY: "auto" }}>
              {dataRows
                .filter((d) => !d.label.startsWith("__"))
                .map((d) => {
                  const valText = typeof d.content === "object" ? d.content.text || JSON.stringify(d.content) : d.content;
                  if (editingDataId === d.id) {
                    return (
                      <div key={d.id} className="inset" style={{ padding: 12, borderRadius: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                        <input value={editDataLabel} onChange={(e) => setEditDataLabel(e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, background: "var(--glass-2)", border: "1px solid var(--hairline)", color: "var(--ink)", fontSize: 12.5 }} />
                        <textarea value={editDataText} onChange={(e) => setEditDataText(e.target.value)} rows={3} style={{ padding: "6px 10px", borderRadius: 8, background: "var(--glass-2)", border: "1px solid var(--hairline)", color: "var(--ink)", fontSize: 12.5 }} />
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => handleSaveDataEdit(d.id)} className="tap" style={{ padding: "4px 12px", borderRadius: 6, background: "var(--accent)", color: "var(--accent-ink)", fontWeight: 700, fontSize: 12, border: "none" }}>
                            Save
                          </button>
                          <button onClick={() => setEditingDataId(null)} className="tap glass-2" style={{ padding: "4px 10px", borderRadius: 6, fontSize: 12 }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={d.id} className="inset" style={{ padding: "12px 14px", borderRadius: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 800, fontSize: 13, color: "var(--accent)" }}>{d.label}</span>
                        {canManageAct(activeAct) && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={() => {
                                setEditingDataId(d.id);
                                setEditDataLabel(d.label);
                                setEditDataText(valText);
                              }}
                              className="tap"
                              style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 12 }}
                            >
                              ✏️
                            </button>
                            <button onClick={() => handleDeleteData(d.id)} className="tap" style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 12 }}>
                              🗑️
                            </button>
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--ink)", lineHeight: 1.45 }}>{richLines(valText)}</div>
                      <div style={{ fontSize: 10, color: "var(--ink-4)", marginTop: 2 }}>
                        {d.staff?.name || "Staff"} · {fmtDate(d.created_at)}
                      </div>
                    </div>
                  );
                })}
              {!dataRows.filter((d) => !d.label.startsWith("__")).length && (
                <p style={{ color: "var(--ink-4)", fontSize: 13, fontStyle: "italic", margin: 0 }}>No data entries collected yet.</p>
              )}
            </div>

            {canManageAct(activeAct) && !isCompleted && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 8, borderTop: "1px solid var(--hairline)" }}>
                <input
                  value={newDataLabel}
                  onChange={(e) => setNewDataLabel(e.target.value)}
                  placeholder="Label e.g. Cochin Centre · Internet — Airtel"
                  style={{ padding: "8px 12px", borderRadius: 8, background: "var(--inset)", border: "1px solid var(--hairline)", color: "var(--ink)", fontSize: 12.5 }}
                />
                <textarea
                  value={newDataText}
                  onChange={(e) => setNewDataText(e.target.value)}
                  placeholder="Details — IDs, credentials, plans, amounts, renewal dates…"
                  rows={2}
                  style={{ padding: "8px 12px", borderRadius: 8, background: "var(--inset)", border: "1px solid var(--hairline)", color: "var(--ink)", fontSize: 12.5 }}
                />
                <button onClick={handleAddData} className="tap" style={{ padding: "8px 16px", borderRadius: 8, background: "var(--accent)", color: "var(--accent-ink)", fontWeight: 750, fontSize: 12.5, border: "none", alignSelf: "flex-start" }}>
                  ＋ Add Data Row
                </button>
              </div>
            )}
          </div>

          {/* Files / Attachments Panel */}
          <div className="glass" style={{ borderRadius: "var(--radius)", padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>📎</span>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--ink)" }}>Attached Files &amp; Sheets</h3>
              </div>
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{fileRows.length} files</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 420, overflowY: "auto" }}>
              {fileRows.map((f) => {
                const url = ACT.getAttachmentPublicUrl(f.storage_path);
                const isImg = /\.(png|jpe?g|gif|webp)$/i.test(f.file_name);
                const isSheet = /\.(xlsx?|csv)$/i.test(f.file_name);
                const isPdf = /\.pdf$/i.test(f.file_name);
                const icon = isImg ? "🖼️" : isSheet ? "📊" : isPdf ? "📕" : "📄";

                return (
                  <div key={f.id} className="inset" style={{ padding: "10px 14px", borderRadius: 10, display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {f.file_name}
                      </div>
                      <div style={{ fontSize: 10.5, color: "var(--ink-4)" }}>
                        {f.staff?.name || "Staff"} · {fmtDate(f.created_at)} · {fmtSize(f.size_bytes)}
                      </div>
                    </div>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="tap" style={{ fontSize: 12, fontWeight: 750, color: "var(--accent)", textDecoration: "none", padding: "4px 8px" }}>
                      OPEN ↗
                    </a>
                    {canManageAct(activeAct) && (
                      <button onClick={() => handleDeleteFile(f)} className="tap" style={{ border: "none", background: "transparent", color: "var(--bad)", cursor: "pointer", fontSize: 13 }}>
                        🗑️
                      </button>
                    )}
                  </div>
                );
              })}
              {!fileRows.length && (
                <p style={{ color: "var(--ink-4)", fontSize: 13, fontStyle: "italic", margin: 0 }}>No documents or bills uploaded yet.</p>
              )}
            </div>

            {canManageAct(activeAct) && !isCompleted && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 8, borderTop: "1px solid var(--hairline)" }}>
                <input ref={fileInputRef} type="file" onChange={handleFileUpload} style={{ display: "none" }} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadBusy}
                  className="tap glass-2"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "10px",
                    borderRadius: 10,
                    color: "var(--ink)",
                    fontWeight: 700,
                    fontSize: 13,
                    border: "1px solid var(--hairline)",
                    cursor: uploadBusy ? "wait" : "pointer",
                  }}
                >
                  {uploadBusy ? "Uploading…" : "⬆ Choose & Upload Document / Photo"}
                </button>
                <span style={{ fontSize: 11, color: "var(--ink-4)", textAlign: "center" }}>Excel sheets, PDFs, photos of bills up to 50 MB</span>
              </div>
            )}
          </div>
        </div>

        {/* Work Log Feed */}
        <div className="glass" style={{ borderRadius: "var(--radius)", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🔨</span>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>Team Work Log &amp; Activity</h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 360, overflowY: "auto" }}>
            {logs.length ? (
              logs.map((u) => (
                <div key={u.id} className="inset" style={{ padding: "10px 14px", borderRadius: 12, display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ width: 28, height: 28, borderRadius: "50%", background: colorFor(u.staff?.name || "Staff"), color: "#fff", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                    {initials(u.staff?.name || "Staff")}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 750, color: "var(--ink)" }}>{u.staff?.name || "Team Member"}</span>
                      {u.kind === "submission" && <span style={{ fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 4, background: "#b14bf4", color: "#fff" }}>SUBMISSION</span>}
                      {u.kind === "status_change" && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)" }}>STATUS</span>}
                      <span style={{ fontSize: 10.5, color: "var(--ink-4)", marginLeft: "auto" }}>{timeAgo(u.created_at)}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 3, lineHeight: 1.45 }}>{u.message}</div>
                  </div>
                </div>
              ))
            ) : (
              <p style={{ color: "var(--ink-4)", fontSize: 13, fontStyle: "italic", margin: 0 }}>No updates posted yet.</p>
            )}
          </div>

          {!isCompleted && (
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <input
                value={logMsg}
                onChange={(e) => setLogMsg(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePostUpdate("update", logMsg)}
                placeholder="What did you work on? Any blockers or questions?"
                style={{ flex: 1, padding: "10px 14px", borderRadius: 10, background: "var(--inset)", border: "1px solid var(--hairline)", color: "var(--ink)", fontSize: 13.5 }}
              />
              <button onClick={() => handlePostUpdate("update", logMsg)} className="tap" style={{ padding: "0 20px", borderRadius: 10, background: "var(--accent)", color: "var(--accent-ink)", fontWeight: 800, fontSize: 13, border: "none" }}>
                Post
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: MAIN DASHBOARD & SUB-VIEWS
  // ==========================================
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Top Banner / Masthead */}
      <div
        className="glass rise"
        style={{
          borderRadius: "var(--radius)",
          padding: "24px 28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap",
          boxShadow: "var(--shadow-lift)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 28, height: 3, background: "var(--accent)", borderRadius: 99 }} />
            <span className="eyebrow" style={{ color: "var(--accent)" }}>FETS · Standardisation &amp; Tasks</span>
          </div>
          <h1 style={{ margin: 0, fontFamily: '"Archivo Expanded", var(--font)', fontSize: "clamp(26px, 3.4vw, 42px)", fontWeight: 900, color: "var(--ink)", letterSpacing: "-0.03em" }}>
            Actionables
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-3)", fontWeight: 500 }}>
            Standardise Cochin &amp; Calicut test centres and replicate approved standards for new centres.
          </p>
        </div>

        {/* User Identity Chip */}
        <div className="glass-2" style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 16px", borderRadius: 999, border: "1px solid var(--hairline)" }}>
          <span style={{ width: 34, height: 34, borderRadius: "50%", background: colorFor(me?.name || "Staff"), color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 13 }}>
            {initials(me?.name || "Staff")}
          </span>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 750, color: "var(--ink)" }}>{me?.name || "Staff"}</div>
            <div style={{ fontSize: 10.5, color: "var(--accent)", fontWeight: 700 }}>{isAdmin ? "⚡ Admin" : "Team Member"}</div>
          </div>
        </div>
      </div>

      {/* Sub-view Navigation Bar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {[
          { id: "dash", label: "🎯 Dashboard Hub" },
          { id: "acts", label: `📋 All Tasks (${acts.length})` },
          { id: "rollout", label: `🚀 Centre Rollout (${centres.filter((c) => c.status !== "live").length})` },
          { id: "compliance", label: `📅 Compliance (${compliance.length})`, badge: complianceDueCount },
          ...(isAdmin
            ? [
                { id: "assign", label: "✨ Assign Task" },
                { id: "team", label: "👥 Team" },
                { id: "settings", label: "🔔 Chat Alerts" },
              ]
            : []),
        ].map((tab) => {
          const active = view === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className="tap"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 18px",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: active ? 800 : 600,
                color: active ? "var(--accent-ink)" : "var(--ink-2)",
                background: active ? "var(--accent)" : "var(--glass-2)",
                border: `1px solid ${active ? "var(--accent)" : "var(--hairline)"}`,
                cursor: "pointer",
              }}
            >
              {tab.label}
              {tab.badge ? (
                <span style={{ background: "#ff4d4d", color: "#fff", padding: "1px 6px", borderRadius: 999, fontSize: 10, fontWeight: 850 }}>
                  {tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* ==========================================
          VIEW: DASHBOARD HUB
          ========================================== */}
      {view === "dash" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Actionable Hub Metric Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            <div
              onClick={() => {
                setView("acts");
                setFilterStatus("in_progress");
              }}
              className="glass tap"
              style={{ borderRadius: "var(--radius)", padding: "20px 22px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 8, borderLeft: "4px solid var(--accent)" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span className="eyebrow" style={{ fontSize: 11, color: "var(--accent)" }}>In Progress</span>
                <span className="mono" style={{ fontSize: 28, fontWeight: 900, color: "var(--ink)" }}>{inProgressActs.length}</span>
              </div>
              <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Active standardisation tasks</span>
            </div>

            <div
              onClick={() => {
                setView("acts");
                setFilterStatus("completed");
              }}
              className="glass tap"
              style={{ borderRadius: "var(--radius)", padding: "20px 22px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 8, borderLeft: "4px solid #00e05c" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span className="eyebrow" style={{ fontSize: 11, color: "#00e05c" }}>Approved Standards</span>
                <span className="mono" style={{ fontSize: 28, fontWeight: 900, color: "var(--ink)" }}>{stds.length}</span>
              </div>
              <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>SOP documents ready in library</span>
            </div>

            <div
              onClick={() => setView("rollout")}
              className="glass tap"
              style={{ borderRadius: "var(--radius)", padding: "20px 22px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 8, borderLeft: "4px solid #00d4ff" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span className="eyebrow" style={{ fontSize: 11, color: "#00d4ff" }}>Centre Rollout</span>
                <span className="mono" style={{ fontSize: 28, fontWeight: 900, color: "var(--ink)" }}>
                  {centres.filter((c) => c.status === "launching").length ? "ACTIVE" : "READY"}
                </span>
              </div>
              <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Deploying standards to new locations</span>
            </div>

            <div
              onClick={() => setView("compliance")}
              className="glass tap"
              style={{ borderRadius: "var(--radius)", padding: "20px 22px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 8, borderLeft: "4px solid #b14bf4" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span className="eyebrow" style={{ fontSize: 11, color: "#b14bf4" }}>Compliance Radar</span>
                <span className="mono" style={{ fontSize: 28, fontWeight: 900, color: complianceDueCount ? "#ff4d4d" : "var(--ink)" }}>
                  {complianceDueCount ? `${complianceDueCount} DUE` : "ALL OK"}
                </span>
              </div>
              <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Renewals, certs, bills &amp; audits</span>
            </div>
          </div>

          {/* Quick Actionables List (Recent / Active) */}
          <div className="glass" style={{ borderRadius: "var(--radius)", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "var(--ink)" }}>Actionables Pipeline</h3>
                <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Click any actionable to view work log, instructions and data</span>
              </div>
              {isAdmin && (
                <button onClick={() => setView("assign")} className="tap" style={{ padding: "8px 16px", borderRadius: 10, background: "var(--accent)", color: "var(--accent-ink)", fontWeight: 800, fontSize: 12.5, border: "none" }}>
                  ＋ Assign New Task
                </button>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {acts.map((a) => {
                const people = a.actionable_assignments.filter((x) => x.staff);
                const progress = progressOf(a.status);
                const last = a.actionable_updates[a.actionable_updates.length - 1];

                return (
                  <div
                    key={a.id}
                    onClick={() => setOpenActId(a.id)}
                    className="inset tap"
                    style={{
                      padding: "16px 20px",
                      borderRadius: 14,
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      cursor: "pointer",
                      border: "1px solid var(--hairline)",
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontFamily: '"Archivo Expanded", var(--font)', fontSize: 13.5, fontWeight: 900, background: "var(--accent)", color: "var(--accent-ink)", padding: "5px 10px", borderRadius: 8 }}>
                      {a.code}
                    </span>

                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div style={{ fontSize: 15, fontWeight: 750, color: "var(--ink)" }}>{a.title}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 540 }}>
                        {last ? `${last.staff?.name || "Staff"}: ${last.message}` : a.description || "No description"}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ display: "flex" }}>
                        {people.map((p, i) => (
                          <span
                            key={p.id}
                            title={p.staff.name}
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: "50%",
                              background: colorFor(p.staff.name),
                              color: "#fff",
                              display: "grid",
                              placeItems: "center",
                              fontSize: 10,
                              fontWeight: 800,
                              marginLeft: i > 0 ? -6 : 0,
                              border: "2px solid var(--surface)",
                            }}
                          >
                            {initials(p.staff.name)}
                          </span>
                        ))}
                      </div>

                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          padding: "4px 10px",
                          borderRadius: 999,
                          color: a.status === "completed" ? "#00e05c" : a.status === "submitted" ? "#b14bf4" : a.status === "in_progress" ? "var(--accent)" : "var(--ink-3)",
                          background: "var(--glass-2)",
                          border: "1px solid var(--hairline)",
                        }}
                      >
                        {ACT.STATUS_LABELS[a.status]}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          VIEW: ALL TASKS (Filterable)
          ========================================== */}
      {view === "acts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="glass" style={{ borderRadius: "var(--radius)", padding: "18px 22px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search code, title or team member…"
              style={{ flex: 1, minWidth: 200, padding: "9px 14px", borderRadius: 10, background: "var(--inset)", border: "1px solid var(--hairline)", color: "var(--ink)", fontSize: 13.5 }}
            />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["all", "in_progress", "pending", "submitted", "completed"].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className="tap"
                  style={{
                    padding: "6px 14px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: filterStatus === st ? 800 : 600,
                    background: filterStatus === st ? "var(--accent)" : "var(--inset)",
                    color: filterStatus === st ? "var(--accent-ink)" : "var(--ink-2)",
                    border: "none",
                  }}
                >
                  {st === "all" ? "All Statuses" : ACT.STATUS_LABELS[st]}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {acts
              .filter((a) => {
                const matchStatus = filterStatus === "all" || a.status === filterStatus;
                const matchSearch =
                  !searchQ.trim() ||
                  `${a.code} ${a.title} ${a.actionable_assignments.map((x) => x.staff?.name).join(" ")}`.toLowerCase().includes(searchQ.toLowerCase());
                return matchStatus && matchSearch;
              })
              .map((a) => (
                <div
                  key={a.id}
                  onClick={() => setOpenActId(a.id)}
                  className="glass tap"
                  style={{ borderRadius: "var(--radius)", padding: "18px 22px", cursor: "pointer", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}
                >
                  <span style={{ fontFamily: '"Archivo Expanded", var(--font)', fontSize: 14, fontWeight: 900, background: "var(--accent)", color: "var(--accent-ink)", padding: "5px 12px", borderRadius: 8 }}>
                    {a.code}
                  </span>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontSize: 16, fontWeight: 750, color: "var(--ink)" }}>{a.title}</div>
                    <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 2 }}>{a.description || "No description"}</div>
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 800, padding: "5px 12px", borderRadius: 999, background: "var(--inset)", color: a.status === "completed" ? "#00e05c" : "var(--accent)" }}>
                    {ACT.STATUS_LABELS[a.status]}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ==========================================
          VIEW: CENTRE ROLLOUT (FETS OS)
          ========================================== */}
      {view === "rollout" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Live Centres Strip */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            {centres
              .filter((c) => c.status === "live")
              .map((c) => (
                <span key={c.id} className="glass-2" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 12, fontWeight: 750, color: "var(--ink)", fontSize: 13 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#00e05c" }} />
                  {c.name} <span style={{ fontSize: 10, color: "var(--ink-4)", fontWeight: 800 }}>LIVE</span>
                </span>
              ))}
            {isAdmin && (
              <button onClick={handleAddCentre} className="tap" style={{ padding: "8px 16px", borderRadius: 12, background: "var(--accent)", color: "var(--accent-ink)", fontWeight: 800, fontSize: 12.5, border: "none" }}>
                ＋ Add New Centre
              </button>
            )}
          </div>

          {/* Rollout Checklist cards */}
          {centres
            .filter((c) => c.status !== "live")
            .map((c) => {
              const items = rolloutStds.map((a) => ({ a, r: rollout.find((x) => x.centre_id === c.id && x.actionable_id === a.id) }));
              const cleared = items.filter((x) => x.r && (x.r.status === "done" || x.r.status === "na")).length;
              const pct = items.length ? Math.round((cleared / items.length) * 100) : 0;

              return (
                <div key={c.id} className="glass" style={{ borderRadius: "var(--radius)", padding: "26px 30px", display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 24, fontWeight: 850, color: "var(--ink)" }}>🚀 {c.name} Rollout</h2>
                      <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
                        {cleared} of {items.length} standards deployed · {pct}% ready
                      </span>
                    </div>
                    {isAdmin && pct === 100 && (
                      <button onClick={() => handleMarkCentreLive(c)} className="tap" style={{ padding: "9px 20px", borderRadius: 10, background: "#00e05c", color: "#053d1a", fontWeight: 850, fontSize: 13, border: "none" }}>
                        🎉 MARK CENTRE LIVE!
                      </button>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div style={{ height: 10, borderRadius: 99, background: "var(--inset)", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, var(--accent), #00e05c)", transition: "width 0.5s ease" }} />
                  </div>

                  {/* Checklist items */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                    {items.map(({ a, r }) => {
                      const st = r ? r.status : "not_started";
                      const launchTask = r && r.spawned_actionable_id ? acts.find((x) => x.id === r.spawned_actionable_id) : null;

                      return (
                        <div key={a.id} className="inset" style={{ padding: "12px 16px", borderRadius: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                          <span onClick={() => setOpenActId(a.id)} style={{ fontFamily: '"Archivo Expanded", var(--font)', fontSize: 12.5, fontWeight: 900, background: "var(--accent)", color: "var(--accent-ink)", padding: "3px 8px", borderRadius: 6, cursor: "pointer" }}>
                            {a.code}
                          </span>
                          <span onClick={() => setOpenActId(a.id)} style={{ flex: 1, minWidth: 180, fontWeight: 700, fontSize: 14, color: "var(--ink)", cursor: "pointer" }}>
                            {a.title}
                          </span>

                          {launchTask ? (
                            <button onClick={() => setOpenActId(launchTask.id)} className="tap glass-2" style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11.5, fontWeight: 700, color: "var(--accent)" }}>
                              ↗ Task {launchTask.code}
                            </button>
                          ) : (
                            isAdmin &&
                            r && (
                              <button onClick={() => handleSpawnRolloutTask(r, c, a)} className="tap glass-2" style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11.5, fontWeight: 700, color: "var(--accent)" }}>
                                🚀 Spawn Task
                              </button>
                            )
                          )}

                          {r && (
                            <span
                              onClick={() => handleCycleRollout(r, a.code, c.name)}
                              className="tap"
                              style={{
                                fontSize: 11.5,
                                fontWeight: 800,
                                padding: "4px 12px",
                                borderRadius: 999,
                                cursor: "pointer",
                                background: st === "done" ? "#00e05c" : st === "in_progress" ? "var(--accent)" : "var(--glass-2)",
                                color: st === "done" ? "#053d1a" : st === "in_progress" ? "var(--accent-ink)" : "var(--ink-3)",
                              }}
                            >
                              {ACT.RO_LABEL[st]}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* ==========================================
          VIEW: COMPLIANCE CALENDAR
          ========================================== */}
      {view === "compliance" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div className="glass" style={{ borderRadius: "var(--radius)", padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 850, color: "var(--ink)" }}>📅 Compliance &amp; Renewal Calendar</h2>
              <span style={{ fontSize: 13, color: "var(--ink-3)" }}>
                Recurring certifications, site audits, insurance, and bills auto-spawn tasks into the team queue.
              </span>
            </div>
            {isAdmin && (
              <button
                onClick={() =>
                  setCompForm({
                    title: "",
                    category: "certification",
                    frequency: "yearly",
                    next_due: "",
                    lead_days: 30,
                    notes: "",
                  })
                }
                className="tap"
                style={{ padding: "9px 18px", borderRadius: 10, background: "var(--accent)", color: "var(--accent-ink)", fontWeight: 800, fontSize: 13, border: "none" }}
              >
                ＋ Add Compliance Item
              </button>
            )}
          </div>

          {/* Form Modal/Card */}
          {compForm && (
            <div className="glass" style={{ borderRadius: "var(--radius)", padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>{compForm.id ? "Edit Compliance Item" : "New Compliance Item"}</h3>
              <div>
                <label className="eyebrow" style={{ fontSize: 10, color: "var(--accent)" }}>Title / Obligation</label>
                <input
                  value={compForm.title || ""}
                  onChange={(e) => setCompForm({ ...compForm, title: e.target.value })}
                  placeholder="e.g. Renew PVTC Centre Certification / Pay Airtel Internet"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, background: "var(--inset)", border: "1px solid var(--hairline)", color: "var(--ink)", fontSize: 13.5 }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                <div>
                  <label className="eyebrow" style={{ fontSize: 10, color: "var(--accent)" }}>Category</label>
                  <select
                    value={compForm.category || "other"}
                    onChange={(e: any) => setCompForm({ ...compForm, category: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, background: "var(--inset)", border: "1px solid var(--hairline)", color: "var(--ink)", fontSize: 13 }}
                  >
                    {Object.keys(ACT.CAT_ICONS).map((k) => (
                      <option key={k} value={k}>
                        {ACT.CAT_ICONS[k]} {k}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="eyebrow" style={{ fontSize: 10, color: "var(--accent)" }}>Centre</label>
                  <select
                    value={compForm.centre_id || ""}
                    onChange={(e) => setCompForm({ ...compForm, centre_id: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, background: "var(--inset)", border: "1px solid var(--hairline)", color: "var(--ink)", fontSize: 13 }}
                  >
                    <option value="">— All Company —</option>
                    {centres.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="eyebrow" style={{ fontSize: 10, color: "var(--accent)" }}>Frequency</label>
                  <select
                    value={compForm.frequency || "yearly"}
                    onChange={(e: any) => setCompForm({ ...compForm, frequency: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, background: "var(--inset)", border: "1px solid var(--hairline)", color: "var(--ink)", fontSize: 13 }}
                  >
                    {Object.entries(ACT.FREQ_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="eyebrow" style={{ fontSize: 10, color: "var(--accent)" }}>Next Due Date</label>
                  <input
                    type="date"
                    value={compForm.next_due || ""}
                    onChange={(e) => setCompForm({ ...compForm, next_due: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, background: "var(--inset)", border: "1px solid var(--hairline)", color: "var(--ink)", fontSize: 13 }}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={handleSaveCompliance} className="tap" style={{ padding: "9px 20px", borderRadius: 10, background: "var(--accent)", color: "var(--accent-ink)", fontWeight: 800, fontSize: 13, border: "none" }}>
                  💾 Save Item
                </button>
                <button onClick={() => setCompForm(null)} className="tap glass-2" style={{ padding: "9px 14px", borderRadius: 10, color: "var(--ink)", fontSize: 13 }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* List of Compliance items */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {compliance.map((item) => {
              const d = Math.ceil((new Date(item.next_due + "T00:00:00").getTime() - new Date(new Date().toDateString()).getTime()) / 864e5);
              const isOverdue = d < 0;
              const isSoon = d >= 0 && d <= item.lead_days;

              return (
                <div key={item.id} className="glass" style={{ borderRadius: "var(--radius)", padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 22 }}>{ACT.CAT_ICONS[item.category] || "📌"}</span>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 15, fontWeight: 750, color: "var(--ink)" }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
                      {item.centres?.name ? `${item.centres.name} · ` : ""}
                      {ACT.FREQ_LABELS[item.frequency] || item.frequency} · Due {fmtDate(item.next_due)}
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 800,
                      padding: "4px 12px",
                      borderRadius: 999,
                      background: isOverdue ? "#ff4d4d" : isSoon ? "var(--accent)" : "var(--inset)",
                      color: isOverdue ? "#fff" : isSoon ? "var(--accent-ink)" : "var(--ink-2)",
                    }}
                  >
                    {isOverdue ? `${-d}D OVERDUE` : isSoon ? `DUE IN ${d}D` : fmtDate(item.next_due)}
                  </span>

                  {isAdmin && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => setCompForm(item)} className="tap" style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 14 }}>
                        ✏️
                      </button>
                      <button onClick={() => handleToggleCompActive(item)} className="tap" style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 14 }}>
                        {item.active ? "⏸️" : "▶️"}
                      </button>
                      <button onClick={() => handleDeleteComp(item.id)} className="tap" style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 14 }}>
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==========================================
          VIEW: ASSIGN NEW ACTIONABLE (Admin)
          ========================================== */}
      {view === "assign" && (
        <div className="glass" style={{ borderRadius: "var(--radius)", padding: "28px 32px", display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="eyebrow" style={{ color: "var(--accent)" }}>New Task</div>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 850, color: "var(--ink)" }}>Assign a New Actionable</h2>
            </div>
            <span style={{ fontFamily: '"Archivo Expanded", var(--font)', fontSize: 16, fontWeight: 900, background: "var(--accent)", color: "var(--accent-ink)", padding: "6px 14px", borderRadius: 10 }}>
              {nextActCode}
            </span>
          </div>

          <div>
            <label className="eyebrow" style={{ fontSize: 10.5, color: "var(--accent)" }}>Task Title</label>
            <input value={fTitle} onChange={(e) => setFTitle(e.target.value)} placeholder="e.g. Vendor Contracts Registry / IT Infrastructure Audit" style={{ width: "100%", padding: "11px 14px", borderRadius: 10, background: "var(--inset)", border: "1px solid var(--hairline)", color: "var(--ink)", fontSize: 14 }} />
          </div>

          <div>
            <label className="eyebrow" style={{ fontSize: 10.5, color: "var(--accent)" }}>What's this for? (Point-wise brief)</label>
            <textarea value={fDesc} onChange={(e) => setFDesc(e.target.value)} rows={3} placeholder="2-3 short points, one per line e.g.:&#10;Audit all switch & server configurations.&#10;Compare Cochin vs Calicut setup.&#10;Document port mappings and passwords." style={{ width: "100%", padding: "11px 14px", borderRadius: 10, background: "var(--inset)", border: "1px solid var(--hairline)", color: "var(--ink)", fontSize: 13.5 }} />
          </div>

          <div>
            <label className="eyebrow" style={{ fontSize: 10.5, color: "var(--accent)" }}>Due Date (Optional)</label>
            <input type="date" value={fDue} onChange={(e) => setFDue(e.target.value)} style={{ padding: "9px 12px", borderRadius: 10, background: "var(--inset)", border: "1px solid var(--hairline)", color: "var(--ink)", fontSize: 13 }} />
          </div>

          <div>
            <label className="eyebrow" style={{ fontSize: 10.5, color: "var(--accent)", marginBottom: 8 }}>Assign Team Members</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
              {staff.map((s) => {
                const isSelected = fAssigned.includes(s.id);
                const isLead = fLead === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      if (isSelected) {
                        setFAssigned(fAssigned.filter((id) => id !== s.id));
                        if (isLead) setFLead("");
                      } else {
                        setFAssigned([...fAssigned, s.id]);
                        if (!fLead) setFLead(s.id);
                      }
                    }}
                    className="inset tap"
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      cursor: "pointer",
                      border: `1px solid ${isSelected ? "var(--accent-line)" : "var(--hairline)"}`,
                      background: isSelected ? "var(--accent-soft)" : "var(--inset)",
                    }}
                  >
                    <span style={{ width: 26, height: 26, borderRadius: "50%", background: colorFor(s.name), color: "#fff", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 800 }}>
                      {initials(s.name)}
                    </span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{s.name}</span>
                    {isSelected && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFLead(s.id);
                        }}
                        style={{
                          fontSize: 9.5,
                          fontWeight: 800,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: isLead ? "var(--accent)" : "transparent",
                          color: isLead ? "var(--accent-ink)" : "var(--ink-3)",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        {isLead ? "LEAD" : "set lead"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="eyebrow" style={{ fontSize: 10.5, color: "var(--accent)" }}>Step 1 Instruction (Optional)</label>
            <input value={fStep1} onChange={(e) => setFStep1(e.target.value)} placeholder="Initial instruction for the team to start…" style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "var(--inset)", border: "1px solid var(--hairline)", color: "var(--ink)", fontSize: 13.5 }} />
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
            <button onClick={handleCreateAct} className="tap" style={{ padding: "11px 24px", borderRadius: 10, background: "var(--accent)", color: "var(--accent-ink)", fontWeight: 850, fontSize: 14, border: "none" }}>
              ✨ Create &amp; Assign Actionable!
            </button>
            <button onClick={() => setView("dash")} className="tap glass-2" style={{ padding: "11px 18px", borderRadius: 10, color: "var(--ink)", fontSize: 13.5 }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ==========================================
          VIEW: GOOGLE CHAT ALERTS (Settings)
          ========================================== */}
      {view === "settings" && (
        <div className="glass" style={{ borderRadius: "var(--radius)", padding: "28px 32px", display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div className="eyebrow" style={{ color: "var(--accent)" }}>Integration</div>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 850, color: "var(--ink)" }}>Google Chat Alerts 🔔</h2>
            <p style={{ fontSize: 13.5, color: "var(--ink-3)", marginTop: 4 }}>
              Connect your FETS Google Workspace Chat space so all task updates, instructions, and submissions ping the team in real time.
            </p>
          </div>

          <div>
            <label className="eyebrow" style={{ fontSize: 10.5, color: "var(--accent)" }}>Incoming Webhook URL</label>
            <input
              value={whUrl}
              onChange={(e) => setWhUrl(e.target.value)}
              placeholder="https://chat.googleapis.com/v1/spaces/…/messages?key=…"
              style={{ width: "100%", padding: "11px 14px", borderRadius: 10, background: "var(--inset)", border: "1px solid var(--hairline)", color: "var(--ink)", fontSize: 13.5 }}
            />
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={handleSaveWebhook} className="tap" style={{ padding: "10px 22px", borderRadius: 10, background: "var(--accent)", color: "var(--accent-ink)", fontWeight: 850, fontSize: 13.5, border: "none" }}>
              💾 Save Webhook
            </button>
            <button onClick={handleTestWebhook} className="tap glass-2" style={{ padding: "10px 18px", borderRadius: 10, color: "var(--ink)", fontSize: 13.5, fontWeight: 700 }}>
              🔔 Send Test Ping
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ActionablesView;
