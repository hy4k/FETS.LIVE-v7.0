// @ts-nocheck
/* eslint-disable */
import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Wrench,
  Shield,
  Clock,
  ArrowLeft,
  CheckCircle,
  Settings,
  Plus,
  Search,
  MessageSquare,
  Filter,
  Activity,
  Users,
  Calendar,
  Building,
  Monitor,
  Wifi,
  ClipboardCheck,
  Package,
  UserCog,
  X,
  Phone,
  ChevronRight,
  TrendingUp,
  MapPin,
  User,
  Lock,
  Power,
  ChevronLeft,
  Send
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import * as DB from "../redesign/write-data";

// Custom Toast Helper to match FETS redesign style
const triggerToast = (msg: string, type: "check" | "alert" | "key" = "check") => {
  // Dispatches to global redesign toast if active
  const ev = new CustomEvent("fets-toast", { detail: { msg, icon: type } });
  window.dispatchEvent(ev);
};

// Types
interface Preset {
  id: string;
  title: string;
  category: string;
  priority: "Low" | "Medium" | "High" | "Urgent";
  tint: "Red" | "Amber" | "Gold" | "Green" | "Blue" | "Purple";
  icon: string;
  promptType: "none" | "numeric" | "text";
  promptLabel?: string;
}

const DEFAULT_PRESETS: Preset[] = [
  { id: "p1", title: "Workstation Offline", category: "Technical", priority: "High", tint: "Red", icon: "power", promptType: "numeric", promptLabel: "Workstation #" },
  { id: "p2", title: "AC Stopped", category: "Facility", priority: "Urgent", tint: "Amber", icon: "alert", promptType: "text", promptLabel: "Which room/area?" },
  { id: "p3", title: "Headphones Broken", category: "Candidate", priority: "Low", tint: "Gold", icon: "headset", promptType: "numeric", promptLabel: "Candidate Seat #" },
  { id: "p4", title: "Candidate Cheating", category: "Security", priority: "Urgent", tint: "Red", icon: "shield", promptType: "text", promptLabel: "Seat / Name" },
  { id: "p5", title: "Exam Launch Failure", category: "Technical", priority: "High", tint: "Purple", icon: "clock", promptType: "numeric", promptLabel: "Workstation #" },
  { id: "p6", title: "Power Fluctuated", category: "Facility", priority: "Low", tint: "Blue", icon: "pulse", promptType: "none", promptLabel: "" }
];

const TINT_GLOWS = {
  Red: "#ef4444",
  Amber: "#f59e0b",
  Gold: "#eab308",
  Green: "#10b981",
  Blue: "#3b82f6",
  Purple: "#8b5cf6"
};

const PRIO_COLORS = {
  Urgent: "#ef4444",
  High: "#f59e0b",
  Medium: "#3b82f6",
  Low: "#6b7280"
};

const STATUS_META = {
  open: { label: "Open", color: "#f59e0b" },
  progress: { label: "In progress", color: "#3b82f6" },
  resolved: { label: "Resolved", color: "#10b981" }
};

const getPresetIcon = (name: string) => {
  switch (name) {
    case "power": return <Power size={16} />;
    case "alert": return <AlertTriangle size={16} />;
    case "headset": return <Users size={16} />; // fallback
    case "shield": return <Shield size={16} />;
    case "clock": return <Clock size={16} />;
    case "pulse": return <Activity size={16} />;
    case "camera": return <Monitor size={16} />;
    case "settings": return <Settings size={16} />;
    case "mapPin": return <MapPin size={16} />;
    case "users": return <Users size={16} />;
    default: return <AlertTriangle size={16} />;
  }
};

export function FetsIncidentPremium({ branch, setActive }: { branch: string; setActive: (v: string) => void }) {
  const { profile } = useAuth();
  const [view, setView] = useState<"cases" | "analysis">("cases");
  const [cases, setCases] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Preset configuration
  const [presets, setPresets] = useState<Preset[]>(() => {
    try {
      const stored = localStorage.getItem("fets_case_presets");
      return stored ? JSON.parse(stored) : DEFAULT_PRESETS;
    } catch (e) {
      return DEFAULT_PRESETS;
    }
  });

  const [editPresets, setEditPresets] = useState(false);
  const [editingPreset, setEditingPreset] = useState<Preset | "new" | null>(null);
  const [activePrompt, setActivePrompt] = useState<{ preset: Preset; value: string } | null>(null);

  // Preset Form fields
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState("Technical");
  const [formPriority, setFormPriority] = useState<Preset["priority"]>("Medium");
  const [formTint, setFormTint] = useState<Preset["tint"]>("Red");
  const [formIcon, setFormIcon] = useState("power");
  const [formPromptType, setFormPromptType] = useState<Preset["promptType"]>("none");
  const [formPromptLabel, setFormPromptLabel] = useState("");

  const isSuperAdmin = !!window.FETS?.isAdmin;
  const userProfileBranch = window.FETS?._meBranch || "cochin";
  const isLocked = !isSuperAdmin && branch !== userProfileBranch;

  // Format Relative Age
  const formatAge = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const fetchCases = async () => {
    try {
      const { data, error } = await supabase
        .from("incidents")
        .select("*, incident_comments(*)")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (!error && data) {
        const mapStatus = (s: string) => {
          s = s ? s.toLowerCase() : "";
          if (s.includes("resolv") || s.includes("close") || s.includes("done")) return "resolved";
          if (s.includes("progress")) return "progress";
          return "open";
        };
        const mapPrio = (p: string) => {
          p = p ? p.toLowerCase() : "";
          if (p.includes("urgent") || p.includes("critical")) return "Urgent";
          if (p.includes("high")) return "High";
          if (p.includes("low")) return "Low";
          return "Medium";
        };

        const loadedCases = data.map((c: any, i: number) => ({
          _dbId: c.id,
          id: c.case_id || c.ref || `FC-${c.id ?? i}`,
          subject: c.title || c.subject || c.summary || "Case",
          category: c.category || "Technical",
          priority: mapPrio(c.priority || c.severity),
          branch: c.branch_location === "global" ? "calicut" : (c.branch_location || "calicut"),
          vendor: c.vendor || null,
          status: mapStatus(c.status),
          assignee: c.assigned_to || c.assignee || "",
          opened: c.created_at ? new Date(c.created_at).toLocaleString() : "",
          age: c.created_at ? formatAge(c.created_at) : "",
          detail: c.description || c.details || "",
          contact: c.contact_details ? JSON.parse(c.contact_details) : null,
          thread: (c.incident_comments || [])
            .map((m: any) => ({
              id: m.id,
              kind: m.body.startsWith("[System]") ? "status" : "msg",
              role: m.author_id === (window.FETS?._meUserId || "00000000-0000-0000-0000-000000000000") ? "staff" : "proctor",
              author: m.author_full_name,
              text: m.body,
              when: new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              rawTime: m.created_at
            }))
            .sort((a: any, b: any) => new Date(a.rawTime).getTime() - new Date(b.rawTime).getTime()),
        }));

        setCases(loadedCases);
        if (window.FETS) window.FETS.CASES = loadedCases;
      }
    } catch (e) {
      console.error("fetchCases error:", e);
    }
  };

  useEffect(() => {
    fetchCases();
    const interval = setInterval(fetchCases, 5000);
    return () => clearInterval(interval);
  }, [branch]);

  const inBranch = useMemo(() => {
    return cases.filter((c) => branch === "global" || c.branch === branch);
  }, [cases, branch]);

  const filtered = useMemo(() => {
    return inBranch.filter((c) => {
      const matchesCat = catFilter === "all" || c.category.toLowerCase() === catFilter.toLowerCase();
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      const matchesSearch =
        !searchQuery.trim() ||
        c.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.id.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesStatus && matchesSearch;
    });
  }, [inBranch, catFilter, statusFilter, searchQuery]);

  useEffect(() => {
    if (filtered.length > 0 && !filtered.find((c) => c.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [branch, catFilter, statusFilter, filtered.length]);

  const selected = useMemo(() => {
    return cases.find((c) => c.id === selectedId) || filtered[0] || null;
  }, [cases, selectedId, filtered]);

  const savePresets = (newPresets: Preset[]) => {
    setPresets(newPresets);
    try {
      localStorage.setItem("fets_case_presets", JSON.stringify(newPresets));
    } catch (e) {
      console.error(e);
    }
  };

  const handleStatusChange = async (id: string, s: string) => {
    if (isLocked) return;
    const c0 = cases.find((c) => c.id === id);
    if (!c0 || c0._dbId == null) return;

    // Optimistic Update
    const sysMsg = {
      id: "s" + Date.now(),
      kind: "status",
      role: "system",
      author: window.FETS?.user?.name || "Staff",
      text: `[System] marked the case ${STATUS_META[s].label}`,
      when: new Date().toTimeString().slice(0, 5),
      rawTime: new Date().toISOString()
    };

    setCases((cs) => cs.map((c) => (c.id === id ? { ...c, status: s, thread: [...c.thread, sysMsg] } : c)));

    await DB.dbSetCaseStatus(c0._dbId, s);
    await DB.dbAddCaseComment(c0._dbId, `[System] marked the case ${STATUS_META[s].label}`);
    fetchCases();
  };

  const handleClaimCase = async (id: string) => {
    if (isLocked) return;
    const c0 = cases.find((c) => c.id === id);
    if (!c0 || c0._dbId == null) return;

    const myName = window.FETS?.user?.name || "Staff";

    // Optimistic Update
    const sysMsg = {
      id: "s" + Date.now(),
      kind: "status",
      role: "system",
      author: myName,
      text: `[System] claimed this case`,
      when: new Date().toTimeString().slice(0, 5),
      rawTime: new Date().toISOString()
    };

    setCases((cs) => cs.map((c) => (c.id === id ? { ...c, assignee: myName, status: "progress", thread: [...c.thread, sysMsg] } : c)));

    await DB.dbAssignCase(c0._dbId, myName);
    await DB.dbSetCaseStatus(c0._dbId, "progress");
    await DB.dbAddCaseComment(c0._dbId, `[System] claimed this case`);
    fetchCases();
  };

  const handleEscalateCase = async (id: string) => {
    if (isLocked) return;
    const c0 = cases.find((c) => c.id === id);
    if (!c0 || c0._dbId == null) return;

    // Optimistic Update
    const sysMsg = {
      id: "s" + Date.now(),
      kind: "status",
      role: "system",
      author: window.FETS?.user?.name || "Staff",
      text: `[System] escalated this case to CRITICAL`,
      when: new Date().toTimeString().slice(0, 5),
      rawTime: new Date().toISOString()
    };

    setCases((cs) => cs.map((c) => (c.id === id ? { ...c, priority: "Urgent", thread: [...c.thread, sysMsg] } : c)));

    try {
      await supabase.from("incidents").update({ priority: "critical", severity: "critical" }).eq("id", c0._dbId);
    } catch (e) {
      console.error(e);
    }
    await DB.dbAddCaseComment(c0._dbId, `[System] escalated this case to CRITICAL`);
    fetchCases();
  };

  const postComment = async (id: string, body: string) => {
    if (isLocked) return;
    const c0 = cases.find((c) => c.id === id);
    if (!c0 || c0._dbId == null) return;

    // Optimistic Update
    const newMsg = {
      id: "temp-" + Date.now(),
      kind: "msg",
      role: "staff",
      author: window.FETS?.user?.name || "Staff",
      text: body,
      when: new Date().toTimeString().slice(0, 5),
      rawTime: new Date().toISOString()
    };
    setCases((cs) => cs.map((c) => (c.id === id ? { ...c, thread: [...c.thread, newMsg] } : c)));

    await DB.dbAddCaseComment(c0._dbId, body);
    fetchCases();
  };

  const setContactDetails = async (id: string, ct: any) => {
    if (isLocked) return;
    const c0 = cases.find((c) => c.id === id);
    if (!c0 || c0._dbId == null) return;

    try {
      await supabase.from("incidents").update({ contact_details: JSON.stringify(ct) }).eq("id", c0._dbId);
    } catch (e) {
      console.error(e);
    }

    setCases((cs) => cs.map((c) => (c.id === id ? { ...c, contact: ct } : c)));
    fetchCases();
  };

  const addCase = (c: any) => {
    if (isLocked) return;
    DB.dbAddCase(c).then((row) => {
      if (row && row.id != null) {
        c._dbId = row.id;
        DB.dbAddCaseComment(row.id, `[System] manually raised this case`);
      }
      fetchCases();
    });
    setCases((cs) => [c, ...cs]);
    setSelectedId(c.id);
    setCatFilter("all");
    setStatusFilter("all");
    setView("cases");
    setRaiseOpen(false);
  };

  const handleRaiseFromPreset = async (preset: Preset, promptVal: string) => {
    if (isLocked) return;

    let subject = preset.title;
    let detail = `Incident logged via Preset: ${preset.title}.`;

    if (preset.promptType !== "none" && promptVal.trim()) {
      subject = `${preset.title} (${preset.promptLabel}: ${promptVal})`;
      detail += `\n${preset.promptLabel}: ${promptVal}`;
    }

    const caseId = `FC-${2049 + Math.floor(Math.random() * 200)}`;
    const newCase = {
      id: caseId,
      subject: subject.trim(),
      category: preset.category,
      priority: preset.priority,
      branch: branch === "global" ? "cochin" : branch,
      vendor: null,
      status: "open",
      assignee: "",
      opened: "Just now",
      age: "now",
      detail: detail.trim(),
      contact: null,
      thread: [
        {
          id: "m" + Date.now(),
          kind: "msg",
          author: window.FETS?.user?.name || "Staff",
          role: "staff",
          text: detail,
          when: new Date().toTimeString().slice(0, 5)
        }
      ]
    };

    setCases((cs) => [newCase, ...cs]);
    setSelectedId(caseId);

    const row = await DB.dbAddCase(newCase);
    if (row && row.id != null) {
      newCase._dbId = row.id;
      await DB.dbAddCaseComment(row.id, `[System] raised the case from preset: ${preset.title}`);
    }

    fetchCases();
    triggerToast(`Raised Case ${caseId}`, "check");
  };

  const openEditPreset = (p: Preset | "new") => {
    if (p === "new") {
      setEditingPreset("new");
      setFormTitle("");
      setFormCategory("Technical");
      setFormPriority("Medium");
      setFormTint("Red");
      setFormIcon("power");
      setFormPromptType("none");
      setFormPromptLabel("");
    } else {
      setEditingPreset(p);
      setFormTitle(p.title);
      setFormCategory(p.category);
      setFormPriority(p.priority);
      setFormTint(p.tint);
      setFormIcon(p.icon);
      setFormPromptType(p.promptType);
      setFormPromptLabel(p.promptLabel || "");
    }
  };

  const saveFormPreset = () => {
    if (!formTitle.trim()) {
      triggerToast("Title is required", "alert");
      return;
    }

    if (editingPreset === "new") {
      const newP: Preset = {
        id: "p_" + Date.now(),
        title: formTitle.trim(),
        category: formCategory,
        priority: formPriority,
        tint: formTint,
        icon: formIcon,
        promptType: formPromptType,
        promptLabel: formPromptType !== "none" ? formPromptLabel.trim() : ""
      };
      savePresets([...presets, newP]);
    } else if (editingPreset) {
      const updated = presets.map((p) =>
        p.id === editingPreset.id
          ? {
              ...p,
              title: formTitle.trim(),
              category: formCategory,
              priority: formPriority,
              tint: formTint,
              icon: formIcon,
              promptType: formPromptType,
              promptLabel: formPromptType !== "none" ? formPromptLabel.trim() : ""
            }
          : p
      );
      savePresets(updated);
    }
    setEditingPreset(null);
    triggerToast("Presets list updated", "check");
  };

  const deletePreset = (id: string) => {
    const filteredPresets = presets.filter((p) => p.id !== id);
    savePresets(filteredPresets);
    triggerToast("Preset removed", "check");
  };

  return (
    <div className="fets-incident-root" style={{
      maxWidth: 1240,
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
      gap: 20,
      color: "#e2e8f0",
      fontFamily: "var(--font)"
    }}>
      {/* Scope CSS inside a tag to prevent bleeding but keep styling neat */}
      <style>{`
        .fets-incident-root input, .fets-incident-root select, .fets-incident-root textarea {
          background: #15171e;
          border: 1px solid #232631;
          color: #f8fafc;
          border-radius: 8px;
          outline: none;
          transition: all 0.2s ease;
        }
        .fets-incident-root input:focus, .fets-incident-root select:focus, .fets-incident-root textarea:focus {
          border-color: #ff9f1a;
          box-shadow: 0 0 8px rgba(255, 159, 26, 0.15);
        }
        .incident-card-matte {
          background: #0f1016;
          border: 1px solid #1c1e28;
          border-radius: 16px;
        }
        .preset-deck-btn {
          position: relative;
          background: #111218;
          border: 1px solid #1e212b;
          border-radius: 12px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 100px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          overflow: hidden;
        }
        .preset-deck-btn:hover {
          transform: translateY(-2px);
          background: #161822;
        }
        .preset-deck-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 12px;
          border: 1px solid transparent;
          pointer-events: none;
          transition: all 0.25s ease;
        }
        .preset-deck-btn:hover::after {
          border-color: var(--glow-color);
          box-shadow: inset 0 0 10px rgba(var(--glow-rgb), 0.1);
        }
        .glow-dot {
          width: 6px;
          height: 6px;
          border-radius: 99px;
          box-shadow: 0 0 8px var(--glow-color);
        }
        .pin-btn {
          background: #181922;
          border: 1px solid #282b3d;
          color: #f1f5f9;
          font-family: var(--font-mono);
          font-size: 16px;
          font-weight: 700;
          border-radius: 8px;
          height: 44px;
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .pin-btn:hover {
          background: #20222f;
          border-color: #ff9f1a;
          transform: scale(1.05);
        }
        .pin-btn:active {
          transform: scale(0.95);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1c1e28;
          border-radius: 99px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #282b3a;
        }
        .glass-drawer {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: 440px;
          background: #0a0b0f;
          border-left: 1px solid #1c1e28;
          box-shadow: -10px 0 30px rgba(0,0,0,0.5);
          z-index: 999;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
      `}</style>

      {/* Title Header Section */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <button
            onClick={() => setActive("live")}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#64748b",
              fontSize: 12,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: 0,
              marginBottom: 8
            }}
          >
            <ChevronLeft size={14} /> Back to Hub
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{
              margin: 0,
              fontFamily: '"Archivo Expanded", var(--font)',
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "#ffffff"
            }}>
              INCIDENT <span style={{ color: "#ff9f1a" }}>CONTROL</span>
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#111218", border: "1px solid #1c1e28", padding: "4px 10px", borderRadius: 99 }}>
              <span className="glow-dot" style={{ backgroundColor: "#10b981", ["--glow-color" as any]: "#10b981" }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {branch.toUpperCase()} DECK
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Tab Selection */}
          <div style={{ display: "flex", background: "#0e0f14", border: "1px solid #1c1e28", borderRadius: 10, padding: 3 }}>
            <button
              onClick={() => setView("cases")}
              style={{
                background: view === "cases" ? "#ff9f1a" : "transparent",
                color: view === "cases" ? "#0a0b0f" : "#64748b",
                border: "none",
                borderRadius: 8,
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 750,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.15s ease"
              }}
            >
              <Monitor size={13} /> Dashboard
            </button>
            <button
              onClick={() => setView("analysis")}
              style={{
                background: view === "analysis" ? "#ff9f1a" : "transparent",
                color: view === "analysis" ? "#0a0b0f" : "#64748b",
                border: "none",
                borderRadius: 8,
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 750,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.15s ease"
              }}
            >
              <TrendingUp size={13} /> Analytics
            </button>
          </div>

          {!isLocked && (
            <button
              onClick={() => setRaiseOpen(true)}
              style={{
                background: "#ff9f1a",
                color: "#0a0b0f",
                border: "none",
                borderRadius: 10,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 750,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <Plus size={14} strokeWidth={3} /> Custom Incident
            </button>
          )}
        </div>
      </header>

      {view === "analysis" ? (
        <CaseAnalysis cases={inBranch} />
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "360px 320px 1fr",
          gap: 16,
          alignItems: "stretch"
        }}>
          
          {/* COLUMN 1: STREAM DECK PRESETS */}
          <div className="incident-card-matte" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14, height: "calc(100vh - 180px)", minHeight: 640 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Monitor size={13} style={{ color: "#ff9f1a" }} />
                <span style={{ fontSize: 10, fontWeight: 750, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Tactical Stream Deck
                </span>
              </div>
              {!isLocked && (
                <button
                  onClick={() => setEditPresets(!editPresets)}
                  style={{
                    background: editPresets ? "rgba(255, 159, 26, 0.1)" : "transparent",
                    border: "1px solid #1c1e28",
                    color: editPresets ? "#ff9f1a" : "#64748b",
                    borderRadius: 6,
                    width: 26,
                    height: 26,
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer"
                  }}
                >
                  <Settings size={13} />
                </button>
              )}
            </div>

            {/* Presets Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, position: "relative", flex: 1, contentVisibility: "auto" } as any}>
              {presets.map((p) => {
                const glowColor = TINT_GLOWS[p.tint] || "#ff9f1a";
                // Convert hex to rgb for inline css shadows
                const rgb = p.tint === "Red" ? "239, 68, 68" : p.tint === "Amber" ? "245, 158, 11" : p.tint === "Gold" ? "234, 179, 8" : p.tint === "Green" ? "16, 185, 129" : p.tint === "Blue" ? "59, 130, 246" : "139, 92, 246";
                return (
                  <div
                    key={p.id}
                    className="preset-deck-btn"
                    style={{
                      ["--glow-color" as any]: glowColor,
                      ["--glow-rgb" as any]: rgb,
                      borderLeft: `3px solid ${glowColor}`
                    }}
                    onClick={() => {
                      if (isLocked) return;
                      if (editPresets) {
                        openEditPreset(p);
                      } else {
                        if (p.promptType !== "none") {
                          setActivePrompt({ preset: p, value: "" });
                        } else {
                          handleRaiseFromPreset(p, "");
                        }
                      }
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                      <div style={{
                        width: 26,
                        height: 26,
                        borderRadius: 6,
                        background: `rgba(${rgb}, 0.12)`,
                        color: glowColor,
                        display: "grid",
                        placeItems: "center"
                      }}>
                        {getPresetIcon(p.icon)}
                      </div>
                      <span style={{
                        fontSize: 8,
                        fontWeight: 800,
                        background: "#181922",
                        border: "1px solid #232631",
                        padding: "2px 5px",
                        borderRadius: 4,
                        color: "#94a3b8",
                        textTransform: "uppercase"
                      }}>
                        {p.category}
                      </span>
                    </div>

                    {/* Meta */}
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 12, fontWeight: 750, color: "#f1f5f9", lineHeight: 1.25 }}>{p.title}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                        <span className="glow-dot" style={{ backgroundColor: glowColor, ["--glow-color" as any]: glowColor }} />
                        <span style={{ fontSize: 9, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                          {p.priority}
                        </span>
                      </div>
                    </div>

                    {editPresets && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deletePreset(p.id); }}
                        style={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          background: "#ef4444",
                          border: "none",
                          color: "#fff",
                          width: 16,
                          height: 16,
                          borderRadius: 4,
                          display: "grid",
                          placeItems: "center",
                          cursor: "pointer"
                        }}
                      >
                        <X size={10} strokeWidth={3} />
                      </button>
                    )}
                  </div>
                );
              })}

              {editPresets && (
                <button
                  onClick={() => openEditPreset("new")}
                  style={{
                    background: "transparent",
                    border: "1px dashed #232631",
                    borderRadius: 12,
                    display: "grid",
                    placeItems: "center",
                    height: 100,
                    cursor: "pointer",
                    color: "#64748b"
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    <Plus size={16} style={{ margin: "0 auto 4px" }} />
                    <div style={{ fontSize: 10, fontWeight: 750, textTransform: "uppercase" }}>Add Preset</div>
                  </div>
                </button>
              )}

              {/* Pin-Pad Overlay */}
              <AnimatePresence>
                {activePrompt && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "#0c0d12",
                      borderRadius: 12,
                      padding: 12,
                      zIndex: 10,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      border: "1px solid #1c1e28"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 9, fontWeight: 750, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Input Details
                      </span>
                      <button
                        onClick={() => setActivePrompt(null)}
                        style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer" }}
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div style={{ fontSize: 11, fontWeight: 700, color: "#ff9f1a", textAlign: "center" }}>
                      {activePrompt.preset.promptLabel || "Enter Details"}
                    </div>

                    {activePrompt.preset.promptType === "numeric" ? (
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{
                          background: "#08090c",
                          border: "1px solid #1c1e28",
                          padding: "6px",
                          borderRadius: 6,
                          fontSize: 18,
                          fontWeight: 800,
                          color: "#ff9f1a",
                          textAlign: "center",
                          minHeight: 36
                        }}>
                          {activePrompt.value || "—"}
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, flex: 1 }}>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                            <button
                              key={num}
                              className="pin-btn"
                              onClick={() => setActivePrompt({ ...activePrompt, value: activePrompt.value + num })}
                            >
                              {num}
                            </button>
                          ))}
                          <button
                            className="pin-btn"
                            style={{ color: "#ef4444" }}
                            onClick={() => setActivePrompt({ ...activePrompt, value: "" })}
                          >
                            C
                          </button>
                          <button
                            className="pin-btn"
                            onClick={() => setActivePrompt({ ...activePrompt, value: activePrompt.value + "0" })}
                          >
                            0
                          </button>
                          <button
                            className="pin-btn"
                            onClick={() => setActivePrompt({ ...activePrompt, value: activePrompt.value.slice(0, -1) })}
                          >
                            ⌫
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                        <input
                          autoFocus
                          value={activePrompt.value}
                          onChange={(e) => setActivePrompt({ ...activePrompt, value: e.target.value })}
                          placeholder={`e.g. ${activePrompt.preset.promptLabel || "Details"}`}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            fontSize: 13,
                            background: "#08090c",
                            border: "1px solid #1c1e28"
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleRaiseFromPreset(activePrompt.preset, activePrompt.value);
                              setActivePrompt(null);
                            }
                          }}
                        />
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => {
                          handleRaiseFromPreset(activePrompt.preset, activePrompt.value);
                          setActivePrompt(null);
                        }}
                        style={{
                          flex: 1,
                          padding: "8px",
                          borderRadius: 6,
                          border: "none",
                          background: "#ff9f1a",
                          color: "#0a0b0f",
                          fontWeight: 750,
                          fontSize: 11,
                          cursor: "pointer"
                        }}
                      >
                        Submit
                      </button>
                      <button
                        onClick={() => setActivePrompt(null)}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 6,
                          border: "1px solid #1c1e28",
                          background: "#181922",
                          color: "#94a3b8",
                          fontWeight: 700,
                          fontSize: 11,
                          cursor: "pointer"
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* COLUMN 2: INCIDENT TIMELINE / QUEUE */}
          <div className="incident-card-matte" style={{ display: "flex", flexDirection: "column", overflow: "hidden", height: "calc(100vh - 180px)", minHeight: 640 }}>
            {/* Header / Info */}
            <div style={{ padding: 12, borderBottom: "1px solid #1c1e28", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 750, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Incident Queue
                </span>
                <span style={{ background: "#181922", border: "1px solid #232631", padding: "1px 5px", borderRadius: 4, fontSize: 10, fontWeight: 800, color: "#ff9f1a" }}>
                  {filtered.length}
                </span>
              </div>

              {/* Search */}
              <div style={{ position: "relative", width: 140 }}>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  style={{
                    width: "100%",
                    padding: "4px 22px 4px 8px",
                    borderRadius: 6,
                    fontSize: 11,
                    background: "#08090c",
                    border: "1px solid #1c1e28"
                  }}
                />
                <Search size={10} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
              </div>
            </div>

            {/* Quick Filters */}
            <div style={{ padding: "6px 8px", borderBottom: "1px solid #1c1e28", display: "flex", gap: 6, background: "rgba(0,0,0,0.15)" }}>
              <select
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value)}
                style={{ flex: 1, padding: "4px 6px", fontSize: 10.5, background: "#111218", border: "1px solid #1c1e28" }}
              >
                <option value="all">Categories</option>
                {window.FETS?.CASE_CATEGORIES?.map((c: string) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ flex: 1, padding: "4px 6px", fontSize: 10.5, background: "#111218", border: "1px solid #1c1e28" }}
              >
                <option value="all">Statuses</option>
                <option value="open">Open</option>
                <option value="progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            {/* Timeline List */}
            <div className="custom-scrollbar" style={{ overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              {filtered.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center", color: "#64748b", fontSize: 12 }}>
                  No active incidents.
                </div>
              ) : (
                filtered.map((c) => {
                  const on = c.id === selectedId;
                  const st = STATUS_META[c.status as "open" | "progress" | "resolved"] || { label: c.status, color: "#64748b" };
                  const barColor = PRIO_COLORS[c.priority as "Low" | "Medium" | "High" | "Urgent"] || "#6b7280";
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      style={{
                        textAlign: "left",
                        width: "100%",
                        border: "none",
                        fontFamily: "var(--font)",
                        padding: "10px 12px",
                        borderRadius: 10,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        position: "relative",
                        background: on ? "rgba(255, 159, 26, 0.08)" : "#111218",
                        borderLeft: `3px solid ${barColor}`,
                        boxShadow: on ? "inset 0 0 0 1px rgba(255, 159, 26, 0.25)" : "none",
                        cursor: "pointer"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                        <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700, color: "#64748b" }}>
                          {c.id}
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, fontWeight: 750, color: st.color }}>
                          <span className="glow-dot" style={{ backgroundColor: st.color, ["--glow-color" as any]: st.color }} />
                          {st.label}
                        </span>
                      </div>

                      <div style={{ fontSize: 12, fontWeight: 650, color: on ? "#ffffff" : "#cbd5e1", lineHeight: 1.3 }}>
                        {c.subject}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", fontSize: 9.5, color: "#64748b", fontWeight: 700 }}>
                        <span style={{ color: barColor, textTransform: "uppercase", letterSpacing: "0.02em" }}>
                          {c.priority}
                        </span>
                        <span>{c.age}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* COLUMN 3: WORKSPACE & PLAYGROUND FEED */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {selected ? (
              <CasePlayground
                c={selected}
                onStatus={handleStatusChange}
                onPost={postComment}
                onContact={setContactDetails}
                onClaim={handleClaimCase}
                onEscalate={handleEscalateCase}
                isLocked={isLocked}
              />
            ) : (
              <div className="incident-card-matte" style={{ padding: 48, textAlign: "center", display: "grid", placeItems: "center", height: "calc(100vh - 180px)", minHeight: 640 }}>
                <div style={{ maxWidth: 320 }}>
                  <AlertTriangle size={36} style={{ color: "#ff9f1a", margin: "0 auto 16px", opacity: 0.4 }} />
                  <div style={{ fontSize: 15, fontWeight: 750, color: "#f1f5f9", marginBottom: 6 }}>
                    No Active Workspace
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                    Select an incident ticket from the middle queue, or tap one of the Stream Deck presets to immediately report a new incident.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CUSTOM FORM DRAWER */}
      {raiseOpen && (
        <>
          <div
            onClick={() => setRaiseOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)", zIndex: 998 }}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "just" }}
            className="glass-drawer"
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1c1e28", paddingBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Plus size={16} style={{ color: "#ff9f1a" }} />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>RAISE CUSTOM CASE</h3>
              </div>
              <button
                onClick={() => setRaiseOpen(false)}
                style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>
            <RaiseCaseForm branch={branch} onSubmit={addCase} />
          </motion.div>
        </>
      )}

      {/* PRESET EDITOR DRAWER */}
      {editingPreset && (
        <>
          <div
            onClick={() => setEditingPreset(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)", zIndex: 998 }}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "just" }}
            className="glass-drawer animate-drawer"
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1c1e28", paddingBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Settings size={16} style={{ color: "#ff9f1a" }} />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                  {editingPreset === "new" ? "ADD CUSTOM PRESET" : "EDIT PRESET TILE"}
                </h3>
              </div>
              <button
                onClick={() => setEditingPreset(null)}
                style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="custom-scrollbar" style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1, overflowY: "auto" }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 750, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Preset Title</label>
                <input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Workstation Offline"
                  style={{ width: "100%", padding: "10px", fontSize: 13 }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 750, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    style={{ width: "100%", padding: "10px", fontSize: 13 }}
                  >
                    {window.FETS?.CASE_CATEGORIES?.map((c: string) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 750, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Priority</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as any)}
                    style={{ width: "100%", padding: "10px", fontSize: 13 }}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 750, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Accent Color</label>
                  <select
                    value={formTint}
                    onChange={(e) => setFormTint(e.target.value as any)}
                    style={{ width: "100%", padding: "10px", fontSize: 13 }}
                  >
                    {Object.keys(TINT_GLOWS).map((color) => (
                      <option key={color} value={color}>{color}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 750, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Tile Icon</label>
                  <select
                    value={formIcon}
                    onChange={(e) => setFormIcon(e.target.value)}
                    style={{ width: "100%", padding: "10px", fontSize: 13 }}
                  >
                    {["power", "alert", "headset", "shield", "clock", "pulse", "camera", "settings", "mapPin", "users"].map((icon) => (
                      <option key={icon} value={icon}>{icon}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 10, fontWeight: 750, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Require Rapid Input Prompt?</label>
                <div style={{ display: "flex", gap: 6, background: "#111218", border: "1px solid #1c1e28", padding: 3, borderRadius: 8 }}>
                  {["none", "numeric", "text"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setFormPromptType(t as any)}
                      style={{
                        flex: 1,
                        background: formPromptType === t ? "#ff9f1a" : "transparent",
                        color: formPromptType === t ? "#0a0b0f" : "#64748b",
                        border: "none",
                        borderRadius: 6,
                        padding: "6px",
                        fontSize: 10.5,
                        fontWeight: 750,
                        cursor: "pointer"
                      }}
                    >
                      {t === "none" ? "None" : t === "numeric" ? "PIN pad" : "Text"}
                    </button>
                  ))}
                </div>
              </div>

              {formPromptType !== "none" && (
                <div>
                  <label style={{ fontSize: 10, fontWeight: 750, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Prompt Label Display</label>
                  <input
                    value={formPromptLabel}
                    onChange={(e) => setFormPromptLabel(e.target.value)}
                    placeholder="e.g. Enter Workstation #"
                    style={{ width: "100%", padding: "10px", fontSize: 13 }}
                  />
                </div>
              )}
            </div>

            <div style={{ borderTop: "1px solid #1c1e28", paddingTop: 16, display: "flex", gap: 10 }}>
              <button
                onClick={saveFormPreset}
                style={{
                  flex: 1,
                  padding: "11px",
                  borderRadius: 8,
                  border: "none",
                  background: "#ff9f1a",
                  color: "#0a0b0f",
                  fontWeight: 750,
                  fontSize: 13,
                  cursor: "pointer"
                }}
              >
                Save Preset
              </button>
              <button
                onClick={() => setEditingPreset(null)}
                style={{
                  padding: "11px 16px",
                  borderRadius: 8,
                  border: "1px solid #1c1e28",
                  background: "#181922",
                  color: "#cbd5e1",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}

// ─── ACTIVE CASE FEED & PLAYGROUND ────────────────────────────────────────────
function CasePlayground({
  c,
  onStatus,
  onPost,
  onContact,
  onClaim,
  onEscalate,
  isLocked
}: {
  c: any;
  onStatus: (id: string, status: string) => void;
  onPost: (id: string, body: string) => void;
  onContact: (id: string, ct: any) => void;
  onClaim: (id: string) => void;
  onEscalate: (id: string) => void;
  isLocked: boolean;
}) {
  const [composerMode, setComposerMode] = useState<"staff" | "external">("staff");
  const [draft, setDraft] = useState("");
  const [extName, setExtName] = useState("");
  const [extPhone, setExtPhone] = useState("");
  const threadEndRef = useRef<HTMLDivElement>(null);
  const isAssignedToMe = c.assignee === window.FETS?.user?.name;

  useEffect(() => {
    setComposerMode("staff");
    setDraft("");
    setExtName("");
    setExtPhone("");
  }, [c.id]);

  useEffect(() => {
    if (threadEndRef.current) {
      threadEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [c.thread.length, c.id]);

  const send = () => {
    if (!draft.trim()) return;
    const isStaff = composerMode === "staff";

    let textToSend = draft.trim();
    if (!isStaff) {
      const displayAuthor = extName.trim() || "External contact";
      textToSend = `[Contact: ${displayAuthor}] ${textToSend}`;
    }

    onPost(c.id, textToSend);

    if (!isStaff && !c.contact && (extName.trim() || extPhone.trim())) {
      onContact(c.id, {
        name: extName.trim() || "External contact",
        role: "External",
        phone: extPhone.trim(),
        email: "",
        external: true
      });
    }
    setDraft("");
  };

  return (
    <div className="incident-card-matte" style={{ display: "flex", flexDirection: "column", overflow: "hidden", height: "calc(100vh - 180px)", minHeight: 640 }}>
      {/* Header Info */}
      <div style={{
        padding: "16px 20px",
        borderBottom: "1px solid #1c1e28",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        borderTop: `3px solid ${PRIO_COLORS[c.priority as keyof typeof PRIO_COLORS] || "#ff9f1a"}`
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700, color: "#64748b" }}>
                {c.id}
              </span>
              <span style={{
                fontSize: 9,
                fontWeight: 800,
                textTransform: "uppercase",
                padding: "2px 6px",
                borderRadius: 4,
                color: PRIO_COLORS[c.priority as keyof typeof PRIO_COLORS] || "#cbd5e1",
                background: `rgba(${c.priority === "Urgent" ? "239, 68, 68" : c.priority === "High" ? "245, 158, 11" : "59, 130, 246"}, 0.1)`
              }}>
                {c.priority} PRIORITY
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.01em" }}>
              {c.subject}
            </h2>
          </div>
        </div>

        {/* Badges / Meta row */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 11, color: "#64748b", fontWeight: 700 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Activity size={11} /> {c.category}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><MapPin size={11} /> {c.branch.toUpperCase()}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 14, height: 14, borderRadius: "50%", background: "#ff9f1a", color: "#000", fontSize: 8, display: "grid", placeItems: "center" }}>
              {(c.assignee || "?").charAt(0).toUpperCase()}
            </span>
            {c.assignee ? `Assigned to ${c.assignee}` : "Unassigned"}
          </span>
          <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)" }}>Reported: {c.opened}</span>
        </div>

        {/* Action Panel */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", borderTop: "1px solid #1c1e28", paddingTop: 10, marginTop: 4 }}>
          <span style={{ fontSize: 9, fontWeight: 750, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Quick Actions</span>

          <button
            onClick={() => !isLocked && onClaim(c.id)}
            disabled={isLocked}
            style={{
              padding: "5px 10px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 750,
              border: "1px solid #232631",
              background: isAssignedToMe ? "#181922" : "rgba(255, 159, 26, 0.1)",
              color: isAssignedToMe ? "#64748b" : "#ff9f1a",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4
            }}
          >
            <User size={11} /> {isAssignedToMe ? "Claimed" : "Claim Case"}
          </button>

          <button
            onClick={() => !isLocked && onStatus(c.id, "progress")}
            disabled={isLocked || c.status === "progress"}
            style={{
              padding: "5px 10px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 750,
              border: "1px solid #232631",
              background: c.status === "progress" ? "rgba(59, 130, 246, 0.15)" : "transparent",
              color: c.status === "progress" ? "#3b82f6" : "#94a3b8",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4
            }}
          >
            <span className="glow-dot" style={{ backgroundColor: "#3b82f6", ["--glow-color" as any]: "#3b82f6" }} />
            In Progress
          </button>

          <button
            onClick={() => !isLocked && onStatus(c.id, "resolved")}
            disabled={isLocked || c.status === "resolved"}
            style={{
              padding: "5px 10px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 750,
              border: "1px solid #232631",
              background: c.status === "resolved" ? "rgba(16, 185, 129, 0.15)" : "transparent",
              color: c.status === "resolved" ? "#10b981" : "#94a3b8",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4
            }}
          >
            <CheckCircle size={11} style={{ color: "#10b981" }} />
            Resolve
          </button>

          <button
            onClick={() => !isLocked && onEscalate(c.id)}
            disabled={isLocked || c.priority === "Urgent"}
            style={{
              padding: "5px 10px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 750,
              border: "1px solid rgba(239, 68, 68, 0.2)",
              background: c.priority === "Urgent" ? "rgba(239, 68, 68, 0.15)" : "transparent",
              color: "#ef4444",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              marginLeft: "auto"
            }}
          >
            <AlertTriangle size={11} /> Escalated
          </button>
        </div>
      </div>

      {/* Feed Thread (Scroll) */}
      <div className="custom-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Contact Strip */}
        <ContactStrip c={c} onSave={(ct) => onContact(c.id, ct)} isLocked={isLocked} />

        {/* Case Description */}
        <div style={{
          background: "#111218",
          padding: "12px 14px",
          borderRadius: 8,
          fontSize: 12.5,
          color: "#cbd5e1",
          lineHeight: 1.55,
          fontFamily: "var(--font)",
          borderLeft: "3px solid #ff9f1a"
        }}>
          {c.detail}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0" }}>
          <span style={{ flex: 1, height: 1, background: "#1c1e28" }} />
          <span style={{ fontSize: 9, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Chronological Log</span>
          <span style={{ flex: 1, height: 1, background: "#1c1e28" }} />
        </div>

        {/* Conversation Bubbles */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {c.thread.map((m: any) => {
            if (m.kind === "status") {
              return (
                <div key={m.id} style={{ display: "flex", justifyContent: "center", margin: "4px 0" }}>
                  <div style={{ background: "#181922", color: "#64748b", fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 99, border: "1px solid #232631" }}>
                    {m.text} · <span style={{ fontFamily: "var(--font-mono)" }}>{m.when}</span>
                  </div>
                </div>
              );
            }
            const isStaff = m.role === "staff";
            return (
              <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: isStaff ? "flex-end" : "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, fontSize: 10, fontWeight: 700, color: "#64748b" }}>
                  <span>{m.author}</span>
                  <span>·</span>
                  <span style={{ fontFamily: "var(--font-mono)" }}>{m.when}</span>
                </div>
                <div style={{
                  maxWidth: "80%",
                  padding: "8px 12px",
                  borderRadius: 10,
                  fontSize: 12,
                  lineHeight: 1.45,
                  background: isStaff ? "#ff9f1a" : "#181922",
                  color: isStaff ? "#0a0b0f" : "#cbd5e1",
                  border: isStaff ? "none" : "1px solid #232631",
                  borderTopRightRadius: isStaff ? 2 : 10,
                  borderTopLeftRadius: isStaff ? 10 : 2
                }}>
                  {m.text}
                </div>
              </div>
            );
          })}
          <div ref={threadEndRef} />
        </div>
      </div>

      {/* Message Composer */}
      {isLocked ? (
        <div style={{ borderTop: "1px solid #1c1e28", padding: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#111218", color: "#64748b", fontSize: 12, fontWeight: 700 }}>
          <Lock size={12} /> This incident resides in {c.branch.toUpperCase()} and is currently locked.
        </div>
      ) : (
        <div style={{ borderTop: "1px solid #1c1e28", padding: 12, display: "flex", flexDirection: "column", gap: 8, background: "#111218" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 750, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Log Update As</span>
            <div style={{ display: "flex", background: "#08090c", border: "1px solid #1c1e28", borderRadius: 99, padding: 2 }}>
              <button
                onClick={() => setComposerMode("staff")}
                style={{
                  background: composerMode === "staff" ? "#ff9f1a" : "transparent",
                  color: composerMode === "staff" ? "#0a0b0f" : "#64748b",
                  border: "none",
                  borderRadius: 99,
                  padding: "3px 10px",
                  fontSize: 10,
                  fontWeight: 750,
                  cursor: "pointer"
                }}
              >
                Staff (Internal)
              </button>
              <button
                onClick={() => setComposerMode("external")}
                style={{
                  background: composerMode === "external" ? "#ff9f1a" : "transparent",
                  color: composerMode === "external" ? "#0a0b0f" : "#64748b",
                  border: "none",
                  borderRadius: 99,
                  padding: "3px 10px",
                  fontSize: 10,
                  fontWeight: 750,
                  cursor: "pointer"
                }}
              >
                Proctor Feedback
              </button>
            </div>
          </div>

          {composerMode === "external" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <input
                value={extName}
                onChange={(e) => setExtName(e.target.value)}
                placeholder="Proctor Full Name"
                style={{ padding: "6px 10px", fontSize: 11.5 }}
              />
              <input
                value={extPhone}
                onChange={(e) => setExtPhone(e.target.value)}
                placeholder="Proctor Contact (Phone/Seat)"
                style={{ padding: "6px 10px", fontSize: 11.5 }}
              />
            </div>
          )}

          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={composerMode === "staff" ? "Type update here... (Press Enter to log)" : "Log proctor feedback..."}
              style={{
                flex: 1,
                padding: "8px 12px",
                resize: "none",
                fontSize: 12.5,
                lineHeight: 1.4,
                minHeight: 38,
                background: "#08090c",
                border: "1px solid #1c1e28"
              }}
            />
            <button
              onClick={send}
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                border: "none",
                background: "#ff9f1a",
                color: "#0a0b0f",
                cursor: "pointer",
                display: "grid",
                placeItems: "center"
              }}
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PROCTOR CONTACT STRIP ────────────────────────────────────────────────────
function ContactStrip({ c, onSave, isLocked }: { c: any; onSave: (ct: any) => void; isLocked: boolean }) {
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(c.contact?.name || "");
  const [phone, setPhone] = useState(c.contact?.phone || "");

  const handleSave = () => {
    onSave({ name, phone, role: "External", email: "", external: true });
    setEdit(false);
  };

  if (!edit && !c.contact) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#111218", border: "1px solid #1c1e28", padding: "8px 12px", borderRadius: 8 }}>
        <span style={{ fontSize: 11, color: "#64748b" }}>No proctor contact details attached.</span>
        {!isLocked && (
          <button
            onClick={() => setEdit(true)}
            style={{ background: "transparent", border: "none", color: "#ff9f1a", fontSize: 11, fontWeight: 750, cursor: "pointer" }}
          >
            Attach Details
          </button>
        )}
      </div>
    );
  }

  if (edit) {
    return (
      <div style={{ background: "#111218", border: "1px solid #1c1e28", padding: 12, borderRadius: 8, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Proctor Name"
            style={{ padding: "6px 10px", fontSize: 11.5 }}
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Seat / Phone"
            style={{ padding: "6px 10px", fontSize: 11.5 }}
          />
        </div>
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          <button
            onClick={handleSave}
            style={{ background: "#ff9f1a", color: "#0a0b0f", border: "none", borderRadius: 4, padding: "4px 10px", fontSize: 11, fontWeight: 750, cursor: "pointer" }}
          >
            Save
          </button>
          <button
            onClick={() => setEdit(false)}
            style={{ background: "transparent", border: "1px solid #1c1e28", color: "#64748b", borderRadius: 4, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#111218", border: "1px solid #1c1e28", padding: "10px 14px", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "#f1f5f9" }}>
          <User size={12} style={{ color: "#ff9f1a" }} />
          <span>{c.contact.name}</span>
        </div>
        {c.contact.phone && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "#f1f5f9" }}>
            <Phone size={12} style={{ color: "#ff9f1a" }} />
            <span>{c.contact.phone}</span>
          </div>
        )}
      </div>
      {!isLocked && (
        <button
          onClick={() => { setName(c.contact?.name || ""); setPhone(c.contact?.phone || ""); setEdit(true); }}
          style={{ background: "transparent", border: "none", color: "#ff9f1a", fontSize: 11, fontWeight: 750, cursor: "pointer" }}
        >
          Edit
        </button>
      )}
    </div>
  );
}

// ─── CUSTOM INCIDENT CREATION FORM ────────────────────────────────────────────
function RaiseCaseForm({ branch, onSubmit }: { branch: string; onSubmit: (c: any) => void }) {
  const [cat, setCat] = useState("Technical");
  const [prio, setPrio] = useState<Preset["priority"]>("Medium");

  const isSuperAdmin = !!window.FETS?.isAdmin;
  const hasDelegation = !!window.FETS?._hasTempCrossAccess;
  const userProfileBranch = window.FETS?._meBranch || "cochin";

  const defaultBr = isSuperAdmin || hasDelegation
    ? (branch === "global" ? "cochin" : branch)
    : userProfileBranch;

  const [br, setBr] = useState(defaultBr);
  const [vendor, setVendor] = useState("");
  const [subject, setSubject] = useState("");
  const [desc, setDesc] = useState("");

  useEffect(() => {
    if (isSuperAdmin || hasDelegation) {
      setBr(branch === "global" ? "cochin" : branch);
    } else {
      setBr(userProfileBranch);
    }
  }, [branch]);

  const submit = () => {
    if (!subject.trim()) {
      triggerToast("Add a short subject first", "alert");
      return;
    }
    const id = `FC-${2049 + Math.floor(Math.random() * 200)}`;
    onSubmit({
      id,
      subject: subject.trim(),
      category: cat,
      priority: prio,
      branch: br,
      vendor: vendor || null,
      status: "open",
      assignee: window.FETS?.user?.name || "Staff",
      opened: "Just now",
      age: "now",
      detail: desc.trim() || "No further detail provided yet.",
      contact: null,
      thread: [
        {
          id: "m" + Date.now(),
          kind: "msg",
          author: window.FETS?.user?.name || "Staff",
          role: "staff",
          text: desc.trim() || "Case raised.",
          when: new Date().toTimeString().slice(0, 5)
        }
      ]
    });
    setSubject("");
    setDesc("");
    setVendor("");
    triggerToast("Case raised", "check");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <label style={{ fontSize: 10, fontWeight: 750, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Category</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {window.FETS?.CASE_CATEGORIES?.map((o: string) => (
            <button
              key={o}
              type="button"
              onClick={() => setCat(o)}
              style={{
                padding: "6px 12px",
                borderRadius: 99,
                border: cat === o ? "1px solid #ff9f1a" : "1px solid #232631",
                background: cat === o ? "rgba(255, 159, 26, 0.1)" : "#111218",
                color: cat === o ? "#ff9f1a" : "#94a3b8",
                fontSize: 11.5,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              {o}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={{ fontSize: 10, fontWeight: 750, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Priority</label>
          <select
            value={prio}
            onChange={(e) => setPrio(e.target.value as any)}
            style={{ width: "100%", padding: "8px 10px", fontSize: 12.5 }}
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Urgent">Urgent</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 10, fontWeight: 750, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Centre</label>
          <div style={{ opacity: isSuperAdmin || hasDelegation ? 1 : 0.65, pointerEvents: isSuperAdmin || hasDelegation ? "auto" : "none" }}>
            <select
              value={br}
              onChange={(e) => setBr(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", fontSize: 12.5 }}
            >
              <option value="calicut">Calicut</option>
              <option value="cochin">Cochin</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <label style={{ fontSize: 10, fontWeight: 750, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Vendor Client</label>
        <select
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          style={{ width: "100%", padding: "8px 10px", fontSize: 12.5 }}
        >
          <option value="">None</option>
          {window.FETS?.VENDORS?.map((v: any) => (
            <option key={v.slug} value={v.slug}>{v.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label style={{ fontSize: 10, fontWeight: 750, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Subject Summary</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="One-line summary of the issue"
          style={{ width: "100%", padding: "10px", fontSize: 13 }}
        />
      </div>

      <div>
        <label style={{ fontSize: 10, fontWeight: 750, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 6 }}>What happened?</label>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={4}
          placeholder="Location, workstation, seats, candidate reference numbers, etc."
          style={{ width: "100%", padding: "10px", fontSize: 13, resize: "vertical" }}
        />
      </div>

      <button
        onClick={submit}
        style={{
          width: "100%",
          padding: "11px",
          borderRadius: 8,
          border: "none",
          background: "#ff9f1a",
          color: "#0a0b0f",
          fontWeight: 750,
          fontSize: 13.5,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6
        }}
      >
        <Plus size={15} strokeWidth={3} /> Submit case
      </button>
    </div>
  );
}

// ─── METRICS & ANALYSIS VIEW ──────────────────────────────────────────────────
function CaseAnalysis({ cases }: { cases: any[] }) {
  const total = cases.length;
  const resolved = cases.filter((c) => c.status === "resolved").length;
  const openCount = cases.filter((c) => c.status === "open").length;
  const progressCount = cases.filter((c) => c.status === "progress").length;
  const urgentCount = cases.filter((c) => c.priority === "Urgent" && c.status !== "resolved").length;
  const resPct = total ? Math.round((resolved / total) * 100) : 0;

  // Count by category
  const byCat = useMemo(() => {
    const counts: Record<string, number> = {};
    window.FETS?.CASE_CATEGORIES?.forEach((k: string) => { counts[k] = 0; });
    cases.forEach((c) => {
      const catName = window.FETS?.CASE_CATEGORIES?.find(
        (x: string) => x.toLowerCase() === c.category.toLowerCase()
      ) || c.category;
      counts[catName] = (counts[catName] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [cases]);

  const maxCatVal = Math.max(1, ...byCat.map((r) => r[1]));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Quick Stats Grid */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        {[
          { label: "Total reported", value: total, tone: "#ff9f1a" },
          { label: "Active Open", value: openCount, tone: "#f59e0b" },
          { label: "In Progress", value: progressCount, tone: "#3b82f6" },
          { label: "Urgent (Unresolved)", value: urgentCount, tone: "#ef4444" },
          { label: "Resolution Rate", value: `${resPct}%`, tone: "#10b981" }
        ].map((s) => (
          <div key={s.label} className="incident-card-matte" style={{ padding: 18 }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: s.tone, fontFamily: "var(--font-mono)", lineHeight: 1 }}>
              {s.value}
            </div>
            <div style={{ marginTop: 10, color: "#64748b", fontSize: 10, fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {s.label}
            </div>
          </div>
        ))}
      </section>

      {/* Breakdown Grid */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, contentVisibility: "auto" } as any}>
        {/* Left Card: Categories */}
        <div className="incident-card-matte" style={{ padding: 20 }}>
          <h4 style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 750, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Breakdown by Category
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {byCat.map(([catName, val]) => {
              const pct = Math.round((val / maxCatVal) * 100);
              return (
                <div key={catName}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4, fontWeight: 700 }}>
                    <span style={{ color: "#cbd5e1" }}>{catName}</span>
                    <span style={{ color: "#ff9f1a", fontFamily: "var(--font-mono)" }}>{val} cases</span>
                  </div>
                  <div style={{ height: 6, background: "#111218", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, #ff9f1a, #ffd32a)", borderRadius: 99 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Card: Priority / Center breakdown */}
        <div className="incident-card-matte" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <h4 style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 750, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Center Incident Distribution
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {["calicut", "cochin"].map((ctr) => {
                const count = cases.filter((c) => c.branch === ctr).length;
                const pct = total ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={ctr} style={{ display: "flex", alignItems: "center", justifyItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, width: 80, textTransform: "capitalize", color: "#cbd5e1" }}>{ctr}</span>
                    <div style={{ flex: 1, height: 6, background: "#111218", borderRadius: 99, overflow: "hidden", margin: "0 12px" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: "#3b82f6", borderRadius: 99 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#3b82f6", width: 60, textAlign: "right", fontFamily: "var(--font-mono)" }}>
                      {count} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ borderTop: "1px solid #1c1e28", paddingTop: 16 }}>
            <h4 style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 750, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Incident Priorities
            </h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
              {["Urgent", "High", "Medium", "Low"].map((p) => {
                const count = cases.filter((c) => c.priority === p).length;
                const color = PRIO_COLORS[p as keyof typeof PRIO_COLORS];
                return (
                  <div key={p} style={{ flex: "1 1 100px", background: "#111218", border: "1px solid #1c1e28", padding: "10px", borderRadius: 10, textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color, fontFamily: "var(--font-mono)" }}>{count}</div>
                    <div style={{ fontSize: 9, fontWeight: 750, color: "#64748b", textTransform: "uppercase", marginTop: 4 }}>{p}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default FetsIncidentPremium;
