// @ts-nocheck
/* eslint-disable */
/*
  FETS · LIVE redesign — ported from the Claude Design handoff bundle
  (fets-redesign/FETS Command Centre.html). Concatenated in the bundle's
  original <script> load order into one self-contained module so the
  prototype's global cross-references resolve exactly as they did in the
  browser. Theme + CSS are scoped to .fets-redesign-root so nothing leaks
  into the legacy app. Exports <RedesignShell bridge={fn} />.
*/
import React from "react";
import "./liquid-glass.css";
import { loadLiveData, ensureMonth, loadLeaveRequests, loadOtClaims } from "./live-data";
import { supabase } from "../lib/supabase";
import * as DB from "./write-data";
import * as LAB from "./lab-data";
import * as ATT from "./attendance-data";
import html2canvas from "html2canvas";
import { FetsChatPopup } from "../components/FetsChatPopup";

/* ============================================================
   SOURCE: data.js
   ============================================================ */
/* ============================================================
   FETS · sample operations data (realistic, not real creds)
   ============================================================ */
(function () {
  const ISO = (offset) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return d;
  };

  // ---- vendors / exam clients ----
  const VENDORS = [
    { slug: "prometric", name: "Prometric",   short: "PRO", color: "var(--v-prometric)", support: "https://www.prometric.com" },
    { slug: "pearson",   name: "Pearson VUE", short: "VUE", color: "var(--v-pearson)",   support: "https://home.pearsonvue.com" },
    { slug: "psi",       name: "PSI",         short: "PSI", color: "var(--v-psi)",       support: "https://www.psiexams.com" },
    { slug: "celpip",    name: "CELPIP",      short: "CEL", color: "var(--v-celpip)",    support: "https://www.celpip.ca" },
    { slug: "cma",       name: "CMA US",      short: "CMA", color: "var(--v-cma)",       support: "https://www.imanet.org" },
    { slug: "ielts",     name: "IELTS",       short: "IEL", color: "var(--v-ielts)",     support: "https://www.ielts.org" },
  ];

  // ---- staff roster pool ----
  const STAFF = {
    calicut: ["Anshitha K", "Aysha", "Bindu Rajan", "Lazeem", "Nilufer"],
    cochin:  ["Naima MM", "NIMMY M", "Shimna"],
  };

  // helper to make a session
  const S = (vendor, exam, count, start, end, branch) => ({
    vendor, exam, count, start, end, branch,
  });

  // ---- 7 days of exam sessions, keyed by day offset (0 = today) ----
  // each branch gets its own list; "global" = both
  const SCHEDULE = {};

  // roster staff per day (subset rostered)
  const ROSTER = {};

  // ---- pending requests (manager view) ----
  const REQUESTS = [];

  /* =====================================================================
     PROCEDURAL DAY GENERATOR — deterministic data for ANY date so the
     10-day windows and full-month views always have something to show.
     Curated SCHEDULE/ROSTER (offsets 0–6) take priority; everything else
     is generated from a date-seeded RNG (stable across renders).
     ===================================================================== */
  const EXAM_POOL = {
    prometric: ["CMA Part 1 · Financial Planning", "ABIM Internal Medicine", "NBCOT · Occupational Therapy", "USMLE Step 1", "NABP Pharmacy"],
    pearson:   ["NCLEX-RN", "AWS Solutions Architect", "Microsoft AZ-900", "CompTIA Security+", "NCLEX-PN"],
    psi:       ["GRE General", "Real Estate License", "PMP Certification", "Cisco CCNA"],
    celpip:    ["CELPIP General", "CELPIP General LS"],
    cma:       ["CMA US Part 1", "CMA US Part 2"],
    ielts:     ["IELTS Academic", "IELTS General Training"],
  };
  const VSLUGS = VENDORS.map((v) => v.slug);
  const START_TIMES = ["08:00", "08:30", "09:00", "09:30", "10:00", "11:00", "13:00", "14:00"];

  const stripT = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const dkey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const offsetOf = (d) => Math.round((stripT(d) - ISO(0)) / 86400000);
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rngFor = (d, salt = 0) => mulberry32(d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate() + salt * 131);
  const addH = (t, h) => { let [hh, mm] = t.split(":").map(Number); hh = Math.min(20, hh + h); return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`; };

  function genSessions(d) {
    return [];
  }
  function pickK(arr, k, r) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, k);
  }
  function genRoster(d) {
    return { calicut: [], cochin: [] };
  }

  const _sCache = {}, _rCache = {};
  function rawSessions(d) {
    const off = offsetOf(d);
    if (off >= 0 && off <= 6 && SCHEDULE[off]) return SCHEDULE[off];
    const key = dkey(d);
    return (_sCache[key] ||= genSessions(d));
  }
  function rawRoster(d) {
    const off = offsetOf(d);
    if (off >= 0 && off <= 6 && ROSTER[off]) return ROSTER[off];
    const key = dkey(d);
    return (_rCache[key] ||= genRoster(d));
  }
  function sessionsOn(d, branch) {
    const list = rawSessions(d);
    return branch === "global" ? list : list.filter((s) => s.branch === branch);
  }
  function rosterOn(d, branch) {
    const r = rawRoster(d);
    return branch === "global" ? [...(r.calicut || []), ...(r.cochin || [])] : (r[branch] || []);
  }

  /* =====================================================================
     CASES — support / incident tickets (Raise a Case + My Desk)
     ===================================================================== */
  const CASES = [];
  const CASE_CATEGORIES = ["Technical", "Candidate", "Facility", "Vendor", "Security", "Lost & Found"];
  const CASE_PRIORITIES = ["Low", "Medium", "High", "Urgent"];
  const CASE_CAT_ICON = { Technical: "settings", Candidate: "user", Facility: "package", Vendor: "briefcase", Security: "shield", "Lost & Found": "package" };

  /* ---- activity feed (My Desk) ---- */
  const ACTIVITY = [];

  // ---- quick-access vault (masked secrets, with last-updated dates) ----
  const VAULT = {
    prometric: [
      { label: "Admin Portal", type: "url", value: "https://rpc.prometric.com/admin", secret: false, updated: "14 May 2026" },
      { label: "Site Login ID", type: "login", value: "FETS-CLT-0192", secret: false, updated: "02 Apr 2026" },
      { label: "Portal Password", type: "password", value: "Pr0m3tric@2025", secret: true, updated: "21 May 2026" },
      { label: "Site Code", type: "code", value: "IN-KL-44120", secret: false, updated: "11 Jan 2026" },
      { label: "Support PIN", type: "pin", value: "880412", secret: true, updated: "21 May 2026" },
    ],
    pearson: [
      { label: "VUE Connect", type: "url", value: "https://connect.pearsonvue.com", secret: false, updated: "09 May 2026" },
      { label: "Test Admin ID", type: "login", value: "tc-fets-cochin", secret: false, updated: "18 Mar 2026" },
      { label: "Password", type: "password", value: "Vue!Cochin#88", secret: true, updated: "28 May 2026" },
      { label: "Help Desk", type: "phone", value: "1800-209-0469", secret: false, updated: "12 Dec 2025" },
    ],
    psi: [
      { label: "PSI Bridge", type: "url", value: "https://bridge.psiexams.com", secret: false, updated: "03 May 2026" },
      { label: "Proctor Login", type: "login", value: "fets.psi.clt", secret: false, updated: "03 May 2026" },
      { label: "Access Code", type: "code", value: "PSI-KL-7741", secret: false, updated: "19 Feb 2026" },
      { label: "Password", type: "password", value: "Ps1@Bridge77", secret: true, updated: "26 May 2026" },
    ],
    celpip: [
      { label: "CELPIP Admin", type: "url", value: "https://secure.celpip.ca/admin", secret: false, updated: "07 May 2026" },
      { label: "Centre ID", type: "login", value: "IN-CELPIP-KER", secret: false, updated: "01 Mar 2026" },
      { label: "Password", type: "password", value: "Celpip$Kerala9", secret: true, updated: "24 May 2026" },
    ],
    cma: [
      { label: "IMA Test Centre", type: "url", value: "https://www.imanet.org/cma", secret: false, updated: "16 Apr 2026" },
      { label: "Proctor Email", type: "email", value: "ops.cma@fets.live", secret: false, updated: "16 Apr 2026" },
      { label: "Password", type: "password", value: "Cma#Imanet2025", secret: true, updated: "20 May 2026" },
    ],
    ielts: [
      { label: "IELTS Portal", type: "url", value: "https://results.ielts.org/centre", secret: false, updated: "10 May 2026" },
      { label: "Venue Code", type: "code", value: "IN-IELTS-0231", secret: false, updated: "22 Jan 2026" },
      { label: "Password", type: "password", value: "Ielts@Venue23", secret: true, updated: "27 May 2026" },
    ],
  };

  /* =====================================================================
     MY DESK — staff cockpit datasets
     ===================================================================== */
  const DESK_TASKS = [];
  const TASK_PRIORITIES = ["Low", "Medium", "High", "Critical"];
  const TASK_STATUSES = ["Pending", "In Progress", "Completed", "Blocked"];

  const CHECKLIST = {
    before: ["Lab cleaned", "Systems switched on", "CCTV checked", "Internet verified", "Power backup checked", "Candidate register ready", "Lockers checked", "Signage placed"],
    during: ["Candidate check-in completed", "No unauthorized items", "Lab silence maintained", "Break tracking done", "Incident monitoring active"],
    after: ["Candidate checkout completed", "Scratch papers collected", "Workstations reset", "Reports submitted", "Lab locked"],
  };

  const CERTS = [
    { name: "Prometric", status: "taken", taken: "12 May 2026", expiry: "12 May 2027", note: "Valid" },
    { name: "Pearson VUE", status: "not", taken: null, expiry: null, required: true },
    { name: "PSI", status: "pending", taken: null, expiry: null },
    { name: "CELPIP", status: "taken", taken: "02 Mar 2026", expiry: "02 Mar 2027", note: "Valid" },
    { name: "CMA US", status: "expiring", taken: "20 Jun 2025", expiry: "20 Jun 2026", note: "Expires in 19 days" },
    { name: "IELTS", status: "not", taken: null, expiry: null },
  ];

  const LEAVE_BALANCE = [ { label: "Casual", n: 8 }, { label: "Sick", n: 5 }, { label: "Earned", n: 12 } ];
  const LEAVE_TYPES = ["Full-day leave", "Half day", "Late arrival", "Early exit", "Emergency leave"];
  const MY_LEAVE = [];

  const PERFORMANCE = {
    readiness: 91,
    metrics: [
      { label: "Attendance score", value: "96%", pct: 96 },
      { label: "Checklist completion", value: "88%", pct: 88 },
      { label: "Tasks completed", value: "14/16", pct: 88 },
      { label: "Incidents reported", value: "3", pct: 100, plain: true },
      { label: "Certifications", value: "4/6", pct: 67 },
      { label: "Supervisor rating", value: "4.6/5", pct: 92 },
    ],
  };

  /* =====================================================================
     WORKED-HOURS LOG — daily attendance totals across dates.
     The My Desk check-in/out console writes here on check-out; the
     Attendance tab reads it back as a dated history.
     ===================================================================== */
  const WLKEY = "fets-worklog-1";
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const HM = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const wlKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const wlLabel = (d) => `${DOW[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`;
  const wlKeyTime = (k) => { const [y, m, dd] = k.split("-").map(Number); return new Date(y, m, dd).getTime(); };

  function workLogSeed() {
    // realistic punches for the recent working days (skip Sundays)
    const samples = [
      { in: "08:03", out: "17:08", brk: 38, status: "present" },
      { in: "07:58", out: "17:02", brk: 30, status: "present" },
      { in: "08:21", out: "17:15", brk: 45, status: "late" },
      { in: "08:00", out: "13:04", brk: 0,  status: "half" },
      { in: "08:05", out: "17:20", brk: 35, status: "present" },
      { in: "07:55", out: "16:58", brk: 40, status: "present" },
      { in: "08:09", out: "17:11", brk: 32, status: "present" },
    ];
    const out = [];
    let si = 0;
    for (let off = -1; off >= -12 && si < samples.length; off--) {
      const d = ISO(off);
      if (d.getDay() === 0) continue; // skip Sundays
      const s = samples[si++];
      const worked = Math.max(0, (HM(s.out) - HM(s.in)) - s.brk);
      out.push({ key: wlKey(d), label: wlLabel(d), inT: s.in, outT: s.out, breakMins: s.brk, workedMins: worked, status: s.status });
    }
    return out;
  }
  function workLogList() {
    try { const s = localStorage.getItem(WLKEY); if (s) return JSON.parse(s); } catch (e) {}
    const seed = workLogSeed();
    try { localStorage.setItem(WLKEY, JSON.stringify(seed)); } catch (e) {}
    return seed;
  }
  function workLogUpsert(entry) {
    let list = workLogList().filter((e) => e.key !== entry.key);
    list = [entry, ...list];
    list.sort((a, b) => wlKeyTime(b.key) - wlKeyTime(a.key));
    try { localStorage.setItem(WLKEY, JSON.stringify(list)); } catch (e) {}
    return list;
  }
  function workLogTotals(list) {
    list = list || workLogList();
    const now = new Date();
    const day = now.getDay(), diff = (day === 0 ? 6 : day - 1);
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff).getTime();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    let week = 0, month = 0, days = 0;
    list.forEach((e) => { const t = wlKeyTime(e.key); if (t >= monthStart) { month += e.workedMins; days++; } if (t >= weekStart) week += e.workedMins; });
    return { week, month, days };
  }

  /* =====================================================================
     SHARED, PERSISTED STORES (roster cells + staff requests)
     Both the Roster page and My Desk read/write these so OT / TOIL and
     leave / swap requests stay in sync across pages.
     ===================================================================== */
  const RKEY = "fets-roster-ov-2";      // roster cell overrides:  { name: { off: {code,ot} } }
  const QKEY = "fets-staffreq-2";       // staff requests to admin: [ {id,kind,who,branch,date,status,...} ]
  const CKEY = "fets-checklog-1";       // submitted checklists log: [ {id,who,branch,group,when,n,total} ]

  function rosterAll() { try { return JSON.parse(localStorage.getItem(RKEY)) || {}; } catch (e) { return {}; } }
  function rosterGet(name) { return rosterAll()[name] || {}; }
  function rosterSet(name, off, cell) {
    const a = rosterAll(); a[name] = a[name] || {};
    if (cell) a[name][off] = cell; else delete a[name][off];
    localStorage.setItem(RKEY, JSON.stringify(a));
  }
  function rosterTotals(name) {
    const ov = rosterGet(name); let ot = 0, toil = 0, leave = 0;
    Object.values(ov).forEach((c) => { if (!c) return; ot += (+c.ot || 0); if (c.code === "TOIL") toil++; if (c.code === "L") leave++; });
    return { ot, toil, leave };
  }

  function staffReqAll() { try { return JSON.parse(localStorage.getItem(QKEY)) || null; } catch (e) { return null; } }
  function staffReqList() { const a = staffReqAll(); return a || STAFF_REQ_SEED; }
  function staffReqAdd(req) { const a = staffReqList(); const next = [req, ...a]; localStorage.setItem(QKEY, JSON.stringify(next)); return next; }
  function staffReqResolve(id, status) { const next = staffReqList().map((r) => r.id === id ? { ...r, status } : r); localStorage.setItem(QKEY, JSON.stringify(next)); return next; }

  // seed staff requests (leave + swap) awaiting super-admin action
  const STAFF_REQ_SEED = [];

  // one-time seed of roster overrides for the signed-in user so OT / TOIL show
  if (localStorage.getItem(RKEY) === null) {
    localStorage.setItem(RKEY, JSON.stringify({}));
  }

  window.FETS = {
    ISO, VENDORS, STAFF, SCHEDULE, ROSTER, REQUESTS, VAULT,
    sessionsOn, rosterOn, offsetOf, stripT,
    CASES, CASE_CATEGORIES, CASE_PRIORITIES, CASE_CAT_ICON, ACTIVITY,
    DESK_TASKS, TASK_PRIORITIES, TASK_STATUSES, CHECKLIST, CERTS,
    LEAVE_BALANCE, LEAVE_TYPES, MY_LEAVE, PERFORMANCE,
    rosterGet, rosterSet, rosterTotals, staffReqList, staffReqAdd, staffReqResolve,
    workLogList, workLogUpsert, workLogTotals, wlKey, wlLabel,
    user: { name: "Mithun", role: "Super Admin", day: 412,
      shift: { start: "08:00", end: "17:00", branch: "calicut" } },
  };
})();

/* ============================================================
   SOURCE: tweaks-panel.jsx
   ============================================================ */

/* BEGIN USAGE */
// tweaks-panel.jsx
// Reusable Tweaks shell + form-control helpers.
// Exports (to window): useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider,
//   TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton.
//
// Owns the host protocol (listens for __activate_edit_mode / __deactivate_edit_mode,
// posts __edit_mode_available / __edit_mode_set_keys / __edit_mode_dismissed) so
// individual prototypes don't re-roll it. Ships a consistent set of controls so you
// don't hand-draw <input type="range">, segmented radios, steppers, etc.
//
// Usage (in an HTML file that loads React + Babel):
//
//   const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
//     "primaryColor": "#D97757",
//     "palette": ["#D97757", "#29261b", "#f6f4ef"],
//     "fontSize": 16,
//     "density": "regular",
//     "dark": false
//   }/*EDITMODE-END*/;
//
//   function App() {
//     const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
//     return (
//       <div style={{ fontSize: t.fontSize, color: t.primaryColor }}>
//         Hello
//         <TweaksPanel>
//           <TweakSection label="Typography" />
//           <TweakSlider label="Font size" value={t.fontSize} min={10} max={32} unit="px"
//                        onChange={(v) => setTweak('fontSize', v)} />
//           <TweakRadio  label="Density" value={t.density}
//                        options={['compact', 'regular', 'comfy']}
//                        onChange={(v) => setTweak('density', v)} />
//           <TweakSection label="Theme" />
//           <TweakColor  label="Primary" value={t.primaryColor}
//                        options={['#D97757', '#2A6FDB', '#1F8A5B', '#7A5AE0']}
//                        onChange={(v) => setTweak('primaryColor', v)} />
//           <TweakColor  label="Palette" value={t.palette}
//                        options={[['#D97757', '#29261b', '#f6f4ef'],
//                                  ['#475569', '#0f172a', '#f1f5f9']]}
//                        onChange={(v) => setTweak('palette', v)} />
//           <TweakToggle label="Dark mode" value={t.dark}
//                        onChange={(v) => setTweak('dark', v)} />
//         </TweaksPanel>
//       </div>
//     );
//   }
//
// TweakRadio is the segmented control for 2–3 short options (auto-falls-back to
// TweakSelect past ~16/~10 chars per label); reach for TweakSelect directly when
// options are many or long. For color tweaks always curate 3-4 options rather than
// a free picker; an option can also be a whole 2–5 color palette (the stored value
// is the array). The Tweak* controls are a floor, not a ceiling — build custom
// controls inside the panel if a tweak calls for UI they don't cover.
/* END USAGE */
// ─────────────────────────────────────────────────────────────────────────────

const __TWEAKS_STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    transform:scale(var(--dc-inv-zoom,1));transform-origin:bottom right;
    background:rgba(250,249,247,.78);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}
  .twk-body::-webkit-scrollbar{width:8px}
  .twk-body::-webkit-scrollbar-track{background:transparent;margin:2px}
  .twk-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:4px;
    border:2px solid transparent;background-clip:content-box}
  .twk-body::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.25);
    border:2px solid transparent;background-clip:content-box}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:rgba(41,38,27,.5);font-variant-numeric:tabular-nums}

  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}

  .twk-field{appearance:none;box-sizing:border-box;width:100%;min-width:0;height:26px;padding:0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;
    background:rgba(255,255,255,.6);color:inherit;font:inherit;outline:none}
  .twk-field:focus{border-color:rgba(0,0,0,.25);background:rgba(255,255,255,.85)}
  select.twk-field{padding-right:22px;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(0,0,0,.5)' d='M0 0h10L5 6z'/></svg>");
    background-repeat:no-repeat;background-position:right 8px center}

  .twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:6px 0;
    border-radius:999px;background:rgba(0,0,0,.12);outline:none}
  .twk-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:14px;height:14px;border-radius:50%;background:#fff;
    border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}
  .twk-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;
    background:#fff;border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}

  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2;
    overflow-wrap:anywhere}

  .twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
    background:rgba(0,0,0,.15);transition:background .15s;cursor:default;padding:0}
  .twk-toggle[data-on="1"]{background:#34c759}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
  .twk-toggle[data-on="1"] i{transform:translateX(14px)}

  .twk-num{display:flex;align-items:center;box-sizing:border-box;min-width:0;height:26px;padding:0 0 0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;background:rgba(255,255,255,.6)}
  .twk-num-lbl{font-weight:500;color:rgba(41,38,27,.6);cursor:ew-resize;
    user-select:none;padding-right:8px}
  .twk-num input{flex:1;min-width:0;height:100%;border:0;background:transparent;
    font:inherit;font-variant-numeric:tabular-nums;text-align:right;padding:0 8px 0 0;
    outline:none;color:inherit;-moz-appearance:textfield}
  .twk-num input::-webkit-inner-spin-button,.twk-num input::-webkit-outer-spin-button{
    -webkit-appearance:none;margin:0}
  .twk-num-unit{padding-right:8px;color:rgba(41,38,27,.45)}

  .twk-btn{appearance:none;height:26px;padding:0 12px;border:0;border-radius:7px;
    background:rgba(0,0,0,.78);color:#fff;font:inherit;font-weight:500;cursor:default}
  .twk-btn:hover{background:rgba(0,0,0,.88)}
  .twk-btn.secondary{background:rgba(0,0,0,.06);color:inherit}
  .twk-btn.secondary:hover{background:rgba(0,0,0,.1)}

  .twk-swatch{appearance:none;-webkit-appearance:none;width:56px;height:22px;
    border:.5px solid rgba(0,0,0,.1);border-radius:6px;padding:0;cursor:default;
    background:transparent;flex-shrink:0}
  .twk-swatch::-webkit-color-swatch-wrapper{padding:0}
  .twk-swatch::-webkit-color-swatch{border:0;border-radius:5.5px}
  .twk-swatch::-moz-color-swatch{border:0;border-radius:5.5px}

  .twk-chips{display:flex;gap:6px}
  .twk-chip{position:relative;appearance:none;flex:1;min-width:0;height:46px;
    padding:0;border:0;border-radius:6px;overflow:hidden;cursor:default;
    box-shadow:0 0 0 .5px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.06);
    transition:transform .12s cubic-bezier(.3,.7,.4,1),box-shadow .12s}
  .twk-chip:hover{transform:translateY(-1px);
    box-shadow:0 0 0 .5px rgba(0,0,0,.18),0 4px 10px rgba(0,0,0,.12)}
  .twk-chip[data-on="1"]{box-shadow:0 0 0 1.5px rgba(0,0,0,.85),
    0 2px 6px rgba(0,0,0,.15)}
  .twk-chip>span{position:absolute;top:0;bottom:0;right:0;width:34%;
    display:flex;flex-direction:column;box-shadow:-1px 0 0 rgba(0,0,0,.1)}
  .twk-chip>span>i{flex:1;box-shadow:0 -1px 0 rgba(0,0,0,.1)}
  .twk-chip>span>i:first-child{box-shadow:none}
  .twk-chip svg{position:absolute;top:6px;left:6px;width:13px;height:13px;
    filter:drop-shadow(0 1px 1px rgba(0,0,0,.3))}
`;

// ── useTweaks ───────────────────────────────────────────────────────────────
// Single source of truth for tweak values. setTweak persists via the host
// (__edit_mode_set_keys → host rewrites the EDITMODE block on disk).
function useTweaks(defaults) {
  const [values, setValues] = React.useState(defaults);
  // Accepts either setTweak('key', value) or setTweak({ key: value, ... }) so a
  // useState-style call doesn't write a "[object Object]" key into the persisted
  // JSON block.
  const setTweak = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null
      ? keyOrEdits : { [keyOrEdits]: val };
    setValues((prev) => ({ ...prev, ...edits }));
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits }, '*');
    // Same-window signal so in-page listeners (deck-stage rail thumbnails)
    // can react — the parent message only reaches the host, not peers.
    window.dispatchEvent(new CustomEvent('tweakchange', { detail: edits }));
  }, []);
  return [values, setTweak];
}

// ── TweaksPanel ─────────────────────────────────────────────────────────────
// Floating shell. Registers the protocol listener BEFORE announcing
// availability — if the announce ran first, the host's activate could land
// before our handler exists and the toolbar toggle would silently no-op.
// The close button posts __edit_mode_dismissed so the host's toolbar toggle
// flips off in lockstep; the host echoes __deactivate_edit_mode back which
// is what actually hides the panel.
function TweaksPanel({ title = 'Tweaks', children }) {
  const [open, setOpen] = React.useState(false);
  const dragRef = React.useRef(null);
  const offsetRef = React.useRef({ x: 16, y: 16 });
  const PAD = 16;

  const clampToViewport = React.useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth, h = panel.offsetHeight;
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y)),
    };
    panel.style.right = offsetRef.current.x + 'px';
    panel.style.bottom = offsetRef.current.y + 'px';
  }, []);

  React.useEffect(() => {
    if (!open) return;
    clampToViewport();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', clampToViewport);
      return () => window.removeEventListener('resize', clampToViewport);
    }
    const ro = new ResizeObserver(clampToViewport);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [open, clampToViewport]);

  React.useEffect(() => {
    const onMsg = (e) => {
      const t = e?.data?.type;
      if (t === '__activate_edit_mode') setOpen(true);
      else if (t === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const dismiss = () => {
    setOpen(false);
    window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*');
  };

  const onDragStart = (e) => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = (ev) => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy),
      };
      clampToViewport();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  if (!open) return null;
  return (
    <>
      <style>{__TWEAKS_STYLE}</style>
      <div ref={dragRef} className="twk-panel" data-omelette-chrome=""
           style={{ right: offsetRef.current.x, bottom: offsetRef.current.y }}>
        <div className="twk-hd" onMouseDown={onDragStart}>
          <b>{title}</b>
          <button className="twk-x" aria-label="Close tweaks"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={dismiss}>✕</button>
        </div>
        <div className="twk-body">
          {children}
        </div>
      </div>
    </>
  );
}

// ── Layout helpers ──────────────────────────────────────────────────────────

function TweakSection({ label, children }) {
  return (
    <>
      <div className="twk-sect">{label}</div>
      {children}
    </>
  );
}

function TweakRow({ label, value, children, inline = false }) {
  return (
    <div className={inline ? 'twk-row twk-row-h' : 'twk-row'}>
      <div className="twk-lbl">
        <span>{label}</span>
        {value != null && <span className="twk-val">{value}</span>}
      </div>
      {children}
    </div>
  );
}

// ── Controls ────────────────────────────────────────────────────────────────

function TweakSlider({ label, value, min = 0, max = 100, step = 1, unit = '', onChange }) {
  return (
    <TweakRow label={label} value={`${value}${unit}`}>
      <input type="range" className="twk-slider" min={min} max={max} step={step}
             value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </TweakRow>
  );
}

function TweakToggle({ label, value, onChange }) {
  return (
    <div className="twk-row twk-row-h">
      <div className="twk-lbl"><span>{label}</span></div>
      <button type="button" className="twk-toggle" data-on={value ? '1' : '0'}
              role="switch" aria-checked={!!value}
              onClick={() => onChange(!value)}><i /></button>
    </div>
  );
}

function TweakRadio({ label, value, options, onChange }) {
  const trackRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);
  // The active value is read by pointer-move handlers attached for the lifetime
  // of a drag — ref it so a stale closure doesn't fire onChange for every move.
  const valueRef = React.useRef(value);
  valueRef.current = value;

  // Segments wrap mid-word once per-segment width runs out. The track is
  // ~248px (280 panel − 28 body pad − 4 seg pad), each button loses 12px
  // to its own padding, and 11.5px system-ui averages ~6.3px/char — so 2
  // options fit ~16 chars each, 3 fit ~10. Past that (or >3 options), fall
  // back to a dropdown rather than wrap.
  const labelLen = (o) => String(typeof o === 'object' ? o.label : o).length;
  const maxLen = options.reduce((m, o) => Math.max(m, labelLen(o)), 0);
  const fitsAsSegments = maxLen <= ({ 2: 16, 3: 10 }[options.length] ?? 0);
  if (!fitsAsSegments) {
    // <select> emits strings — map back to the original option value so the
    // fallback stays type-preserving (numbers, booleans) like the segment path.
    const resolve = (s) => {
      const m = options.find((o) => String(typeof o === 'object' ? o.value : o) === s);
      return m === undefined ? s : typeof m === 'object' ? m.value : m;
    };
    return <TweakSelect label={label} value={value} options={options}
                        onChange={(s) => onChange(resolve(s))} />;
  }
  const opts = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }));
  const idx = Math.max(0, opts.findIndex((o) => o.value === value));
  const n = opts.length;

  const segAt = (clientX) => {
    const r = trackRef.current.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor(((clientX - r.left - 2) / inner) * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };

  const onPointerDown = (e) => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = (ev) => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <TweakRow label={label}>
      <div ref={trackRef} role="radiogroup" onPointerDown={onPointerDown}
           className={dragging ? 'twk-seg dragging' : 'twk-seg'}>
        <div className="twk-seg-thumb"
             style={{ left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
                      width: `calc((100% - 4px) / ${n})` }} />
        {opts.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={o.value === value}>
            {o.label}
          </button>
        ))}
      </div>
    </TweakRow>
  );
}

function TweakSelect({ label, value, options, onChange }) {
  return (
    <TweakRow label={label}>
      <select className="twk-field" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => {
          const v = typeof o === 'object' ? o.value : o;
          const l = typeof o === 'object' ? o.label : o;
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    </TweakRow>
  );
}

function TweakText({ label, value, placeholder, onChange }) {
  return (
    <TweakRow label={label}>
      <input className="twk-field" type="text" value={value} placeholder={placeholder}
             onChange={(e) => onChange(e.target.value)} />
    </TweakRow>
  );
}

function TweakNumber({ label, value, min, max, step = 1, unit = '', onChange }) {
  const clamp = (n) => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };
  const startRef = React.useRef({ x: 0, val: 0 });
  const onScrubStart = (e) => {
    e.preventDefault();
    startRef.current = { x: e.clientX, val: value };
    const decimals = (String(step).split('.')[1] || '').length;
    const move = (ev) => {
      const dx = ev.clientX - startRef.current.x;
      const raw = startRef.current.val + dx * step;
      const snapped = Math.round(raw / step) * step;
      onChange(clamp(Number(snapped.toFixed(decimals))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <div className="twk-num">
      <span className="twk-num-lbl" onPointerDown={onScrubStart}>{label}</span>
      <input type="number" value={value} min={min} max={max} step={step}
             onChange={(e) => onChange(clamp(Number(e.target.value)))} />
      {unit && <span className="twk-num-unit">{unit}</span>}
    </div>
  );
}

// Relative-luminance contrast pick — checkmarks drawn over a swatch need to
// read on both #111 and #fafafa without per-option configuration. Hex input
// only (#rgb / #rrggbb); named or rgb()/hsl() colors fall through to "light".
function __twkIsLight(hex) {
  const h = String(hex).replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.padEnd(6, '0');
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return true;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return r * 299 + g * 587 + b * 114 > 148000;
}

const __TwkCheck = ({ light }) => (
  <svg viewBox="0 0 14 14" aria-hidden="true">
    <path d="M3 7.2 5.8 10 11 4.2" fill="none" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round"
          stroke={light ? 'rgba(0,0,0,.78)' : '#fff'} />
  </svg>
);

// TweakColor — curated color/palette picker. Each option is either a single
// hex string or an array of 1-5 hex strings; the card adapts — a lone color
// renders solid, a palette renders colors[0] as the hero (left ~2/3) with the
// rest stacked in a sharp column on the right. onChange emits the
// option in the shape it was passed (string stays string, array stays array).
// Without options it falls back to the native color input for back-compat.
function TweakColor({ label, value, options, onChange }) {
  if (!options || !options.length) {
    return (
      <div className="twk-row twk-row-h">
        <div className="twk-lbl"><span>{label}</span></div>
        <input type="color" className="twk-swatch" value={value}
               onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }
  // Native <input type=color> emits lowercase hex per the HTML spec, so
  // compare case-insensitively. String() guards JSON.stringify(undefined),
  // which returns the primitive undefined (no .toLowerCase).
  const key = (o) => String(JSON.stringify(o)).toLowerCase();
  const cur = key(value);
  return (
    <TweakRow label={label}>
      <div className="twk-chips" role="radiogroup">
        {options.map((o, i) => {
          const colors = Array.isArray(o) ? o : [o];
          const [hero, ...rest] = colors;
          const sup = rest.slice(0, 4);
          const on = key(o) === cur;
          return (
            <button key={i} type="button" className="twk-chip" role="radio"
                    aria-checked={on} data-on={on ? '1' : '0'}
                    aria-label={colors.join(', ')} title={colors.join(' · ')}
                    style={{ background: hero }}
                    onClick={() => onChange(o)}>
              {sup.length > 0 && (
                <span>
                  {sup.map((c, j) => <i key={j} style={{ background: c }} />)}
                </span>
              )}
              {on && <__TwkCheck light={__twkIsLight(hero)} />}
            </button>
          );
        })}
      </div>
    </TweakRow>
  );
}

function TweakButton({ label, onClick, secondary = false }) {
  return (
    <button type="button" className={secondary ? 'twk-btn secondary' : 'twk-btn'}
            onClick={onClick}>{label}</button>
  );
}

Object.assign(window, {
  useTweaks, TweaksPanel, TweakSection, TweakRow,
  TweakSlider, TweakToggle, TweakRadio, TweakSelect,
  TweakText, TweakNumber, TweakColor, TweakButton,
});

/* ============================================================
   SOURCE: components.jsx
   ============================================================ */
/* ============================================================
   FETS · shared UI primitives  (exports to window)
   ============================================================ */

/* ---- minimal line-icon set (lucide-style geometry) ---- */
const ICON_PATHS = {
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
  pulse: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68M6.6 6.6A13.3 13.3 0 0 0 2 11s3.5 7 10 7a9 9 0 0 0 5.4-1.6M1 1l22 22M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  chevronR: '<path d="m9 18 6-6-6-6"/>',
  chevronD: '<path d="m6 9 6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  headset: '<path d="M3 14v-3a9 9 0 0 1 18 0v3"/><path d="M21 16a2 2 0 0 1-2 2h-1a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h3zM3 16a2 2 0 0 0 2 2h1a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1H3z"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  ext: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
  arrowR: '<path d="M5 12h14M13 5l7 7-7 7"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  layers: '<path d="m12 2 9 5-9 5-9-5 9-5z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 8.3-8.3M16 5l3 3M14 7l3 3"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.4 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.9 7.9"/>',
  hash: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
  pin: '<path d="M12 21s7-5.5 7-11a7 7 0 0 0-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>',
  clipboard: '<rect x="8" y="3" width="8" height="4" rx="1.5"/><path d="M9 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  package: '<path d="M16.5 9.4 7.5 4.2M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.3 7 12 12l8.7-5M12 22V12"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  mapPin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  trend: '<path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/>',
  coffee: '<path d="M17 8h1a4 4 0 0 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/>',
  sun2: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  power: '<path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10"/>',
};

function Icon({ name, size = 18, stroke = 2, className = "", style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"
      strokeLinejoin="round" className={className} style={style} aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] || "" }} />
  );
}

/* ---- segmented control (glass pill) ---- */
function Segmented({ options, value, onChange, size = "md", activeColor, disabled }) {
  const pad = size === "sm" ? "6px 14px" : "8px 18px";
  const fs = size === "sm" ? 11.5 : 13;
  const br = 9;
  return (
    <div className="inset" style={{ 
      display: "inline-flex", 
      padding: 3, 
      gap: 3, 
      borderRadius: br + 2, 
      border: "1px solid var(--hairline)",
      opacity: disabled ? 0.65 : 1,
      pointerEvents: disabled ? "none" : "auto",
      cursor: disabled ? "not-allowed" : "default"
    }}>
      {options.map((o) => {
        const active = o.value === value;
        const oColor = o.color || activeColor;
        const bgGradient = oColor 
          ? `linear-gradient(150deg, ${oColor}, color-mix(in oklch, ${oColor} 70%, black))` 
          : "linear-gradient(150deg, var(--accent), var(--accent-2))";
        return (
          <button key={o.value} onClick={() => !disabled && onChange(o.value)} className="tap"
            disabled={disabled}
            style={{
              border: "none", cursor: disabled ? "not-allowed" : "pointer", padding: pad, fontSize: fs,
              fontWeight: active ? 900 : 550, letterSpacing: active ? "-0.03em" : "-0.01em", borderRadius: br,
              fontFamily: active ? '"Archivo Expanded", var(--font)' : "var(--font)",
              display: "inline-flex", alignItems: "center", gap: 6,
              color: active ? "var(--accent-ink)" : "var(--ink-3)",
              background: active ? bgGradient : "transparent",
              boxShadow: active ? "inset 0 1.5px 0 oklch(1 0 0 / 0.45), 0 6px 16px oklch(0 0 0 / 0.35)" : "none",
              textTransform: active ? "uppercase" : "none",
            }}>
            {o.icon && <Icon name={o.icon} size={fs + 2} stroke={2.1} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---- circular icon button ---- */
function IconButton({ name, onClick, title, size = 38, active = false, className = "" }) {
  return (
    <button onClick={onClick} title={title} className={`tap glass-2 ${className}`}
      style={{
        width: size, height: size, borderRadius: 999, cursor: "pointer",
        display: "grid", placeItems: "center", color: active ? "var(--accent)" : "var(--ink-2)",
        flexShrink: 0, background: active ? "var(--accent-soft)" : "var(--glass-2)",
        borderColor: active ? "var(--accent-line)" : "var(--hairline)",
      }}>
      <Icon name={name} size={size * 0.46} stroke={2} />
    </button>
  );
}

/* ---- avatar (monogram, no external img) ---- */
function Avatar({ name, size = 52 }) {
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("");
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.34, flexShrink: 0,
      display: "grid", placeItems: "center", fontWeight: 700, color: "var(--accent-ink)",
      fontSize: size * 0.36, letterSpacing: "-0.02em",
      background: "linear-gradient(150deg, var(--accent), var(--accent-2))",
      boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.4), 0 6px 16px oklch(0 0 0 / 0.3)",
    }}>{initials}</div>
  );
}

/* ---- toast host (listens for window 'fets-toast') ---- */
function ToastHost() {
  const [toasts, setToasts] = React.useState([]);
  React.useEffect(() => {
    const handler = (e) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((t) => [...t, { id, ...e.detail }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2200);
    };
    window.addEventListener("fets-toast", handler);
    return () => window.removeEventListener("fets-toast", handler);
  }, []);
  return (
    <div style={{ position: "fixed", top: 18, left: "50%", transform: "translateX(-50%)", zIndex: 200, display: "flex", flexDirection: "column", gap: 8, alignItems: "center", pointerEvents: "none" }}>
      {toasts.map((t) => (
        <div key={t.id} className="glass rise" style={{
          display: "flex", alignItems: "center", gap: 9, padding: "10px 16px",
          borderRadius: 999, fontSize: 13, fontWeight: 600, color: "var(--ink)",
          boxShadow: "var(--shadow-lift)",
        }}>
          <span style={{ display: "grid", placeItems: "center", width: 18, height: 18, borderRadius: 999, background: "var(--ok)", color: "#fff" }}>
            <Icon name={t.icon || "check"} size={12} stroke={3} />
          </span>
          {t.msg}
        </div>
      ))}
    </div>
  );
}
function toast(msg, icon) {
  window.dispatchEvent(new CustomEvent("fets-toast", { detail: { msg, icon } }));
}

/* ---- right-side drawer (slides in from the right) ---- */
function Drawer({ open, onClose, title, sub, icon, accentColor, children }) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <React.Fragment>
      <div className={`drawer-backdrop ${open ? "open" : ""}`} onClick={onClose} />
      <aside className={`drawer frost ${open ? "open" : ""}`} aria-hidden={!open}>
        <div className="drawer-grip" />
        <header style={{ display: "flex", alignItems: "center", gap: 13, padding: "20px 22px", borderBottom: "1px solid var(--hairline)", flexShrink: 0 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, display: "grid", placeItems: "center", color: accentColor || "var(--accent)", background: "var(--accent-soft)", border: "1px solid var(--accent-line)" }}>
            <Icon name={icon} size={21} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 680, letterSpacing: "-0.02em", color: "var(--ink)" }}>{title}</h2>
            {sub && <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--ink-3)", fontWeight: 500 }}>{sub}</p>}
          </div>
          <button onClick={onClose} title="Close" className="tap glass-2" style={{ width: 38, height: 38, borderRadius: 999, display: "grid", placeItems: "center", cursor: "pointer", color: "var(--ink-2)" }}>
            <Icon name="x" size={18} />
          </button>
        </header>
        <div className="scroll-soft" style={{ flex: 1, overflowY: "auto", padding: "18px", minHeight: 0 }}>
          {open && children}
        </div>
      </aside>
    </React.Fragment>
  );
}

Object.assign(window, { Icon, Segmented, IconButton, Avatar, ToastHost, toast, Drawer });

/* ============================================================
   SOURCE: widgets.jsx
   ============================================================ */
/* ============================================================
   FETS · Command Centre widgets (shelf + drawer model)
   ============================================================ */

const VENDOR_BY_SLUG = Object.fromEntries(window.FETS.VENDORS.map((v) => [v.slug, v]));
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WDL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmt12(t) {
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ap}`;
}
function branchSessions(offset, branch) {
  return window.FETS.sessionsOn(window.FETS.ISO(offset), branch);
}
function branchRoster(offset, branch) {
  return window.FETS.rosterOn(window.FETS.ISO(offset), branch);
}
const OPEN = { calicut: 2, cochin: 1, global: 3 };

/* totals across the next 7 days for a branch */
function weekTotals(branch) {
  let cand = 0, sess = 0;
  for (let o = 0; o < 7; o++) {
    const s = branchSessions(o, branch);
    sess += s.length;
    cand += s.reduce((a, x) => a + x.count, 0);
  }
  return { cand, sess };
}

/* ---------- stat cards (no centre health) ---------- */
function StatCard({ icon, label, value, unit, foot, tone, delay }) {
  const c = tone || "var(--accent)";
  return (
    <div className="glass rise" style={{
      padding: "calc(22px * var(--density))", borderRadius: "var(--radius)", display: "flex",
      flexDirection: "column", gap: 14, minHeight: 132, animationDelay: `${delay}ms`,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="eyebrow" style={{ color: "var(--ink-3)" }}>{label}</span>
        <span style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", color: c, background: `color-mix(in oklch, ${c} 16%, transparent)` }}>
          <Icon name={icon} size={16} />
        </span>
      </div>
      <div style={{ marginTop: "auto", display: "flex", alignItems: "baseline", gap: 8 }}>
        <span className="tabnum mono" style={{ fontSize: 46, fontWeight: 700, letterSpacing: "-0.05em", lineHeight: 0.85, color: "var(--ink)" }}>{value}</span>
        {unit && <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-3)" }}>{unit}</span>}
      </div>
      <span style={{ fontSize: 12.5, color: "var(--ink-3)", fontWeight: 500 }}>{foot}</span>
    </div>
  );
}

function StatusRow({ branch }) {
  const sessions = branchSessions(0, branch);
  const candidates = sessions.reduce((s, x) => s + x.count, 0);
  const onDuty = branchRoster(0, branch).length;
  const open = OPEN[branch] ?? 0;
  const first = sessions.length ? fmt12(sessions.map((s) => s.start).sort()[0]) : "—";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "calc(16px * var(--density))" }}>
      <StatCard icon="users" label="Candidates today" value={candidates} foot={`across ${sessions.length} session${sessions.length === 1 ? "" : "s"}`} tone="var(--v-prometric)" delay={0} />
      <StatCard icon="calendar" label="Sessions today" value={sessions.length} foot={sessions.length ? `first at ${first}` : "no exams today"} tone="var(--accent)" delay={60} />
      <StatCard icon="user" label="On duty today" value={onDuty} foot={`${onDuty === 1 ? "person" : "people"} rostered`} tone="var(--v-cma)" delay={120} />
      <StatCard icon="alert" label="Open cases" value={open} foot={open ? "need attention" : "all clear"} tone={open ? "var(--warn)" : "var(--ok)"} delay={180} />
    </div>
  );
}

/* ---------- shelf (drawer front trigger) ---------- */
function Shelf({ icon, title, sub, accent, spines, onClick, delay }) {
  return (
    <button className="shelf rise" onClick={onClick} style={{
      animationDelay: `${delay}ms`, position: "relative", overflow: "hidden", gap: 18,
      padding: "calc(24px * var(--density)) 24px",
      background: `linear-gradient(135deg, color-mix(in oklch, ${accent} 11%, var(--glass)) 0%, var(--glass) 58%)`,
      borderColor: `color-mix(in oklch, ${accent} 26%, var(--glass-edge))`,
    }}>
      {/* soft corner glow */}
      <span aria-hidden style={{ position: "absolute", top: -50, right: -36, width: 168, height: 168, borderRadius: "50%",
        background: `radial-gradient(circle, color-mix(in oklch, ${accent} 34%, transparent) 0%, transparent 70%)`,
        pointerEvents: "none", opacity: 0.65 }} />
      {/* top accent tab */}
      <span aria-hidden style={{ position: "absolute", left: 24, top: 0, width: 48, height: 3, borderRadius: "0 0 99px 99px",
        background: accent, boxShadow: `0 0 14px ${accent}` }} />
      {/* icon medallion */}
      <span style={{ width: 56, height: 56, borderRadius: 17, display: "grid", placeItems: "center", flexShrink: 0, position: "relative",
        color: "var(--accent-ink)",
        background: `linear-gradient(150deg, ${accent}, color-mix(in oklch, ${accent} 68%, black))`,
        boxShadow: `inset 0 1px 0 oklch(1 0 0 / .45), 0 8px 22px color-mix(in oklch, ${accent} 42%, transparent)` }}>
        <Icon name={icon} size={26} />
      </span>
      <span style={{ flex: 1, minWidth: 0, position: "relative" }}>
        <span style={{ display: "block", fontSize: 19, fontWeight: 760, letterSpacing: "-0.02em", color: "var(--ink)" }}>{title}</span>
        <span style={{ display: "block", fontSize: 13, color: "var(--ink-3)", fontWeight: 500, marginTop: 4, lineHeight: 1.4 }}>{sub}</span>
      </span>
      <span className="shelf-handle" style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0,
        color: "var(--accent-ink)", background: accent, border: "none",
        boxShadow: `0 6px 16px color-mix(in oklch, ${accent} 45%, transparent)` }}>
        <Icon name="arrowR" size={18} />
      </span>
    </button>
  );
}

/* ---------- vendor group (shared) ---------- */
function VendorGroup({ slug, sessions }) {
  const v = VENDOR_BY_SLUG[slug];
  return (
    <div className="inset" style={{ padding: "10px 12px", borderRadius: 12, borderLeft: `3px solid ${v.color}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: v.color, boxShadow: `0 0 8px ${v.color}` }} />
        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.02em", color: v.color }}>{v.name}</span>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 9 }}>
        {sessions.map((s, i) => (
          <li key={i} style={{ borderTop: i ? "1px solid var(--hairline)" : "none", paddingTop: i ? 9 : 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", lineHeight: 1.3 }}>{s.exam}</div>
            <div style={{ display: "flex", gap: 14, marginTop: 5, fontSize: 11.5, color: "var(--ink-3)", fontWeight: 500 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="users" size={12} /> {s.count} candidates</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="clock" size={12} /> {fmt12(s.start)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- 7-day outlook drawer panel (vertical) ---------- */
function DayRow({ offset, branch }) {
  const d = window.FETS.ISO(offset);
  const isToday = offset === 0;
  const sessions = branchSessions(offset, branch);
  const roster = branchRoster(offset, branch);
  const total = sessions.reduce((s, x) => s + x.count, 0);
  const groups = {};
  sessions.forEach((s) => { (groups[s.vendor] ||= []).push(s); });

  return (
    <div className="glass-2" style={{
      borderRadius: "var(--radius-sm)", padding: 16, display: "flex", flexDirection: "column", gap: 13,
      borderColor: isToday ? "var(--accent-line)" : "var(--hairline)",
      background: isToday ? "var(--accent-soft)" : "var(--glass-2)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
          <span className="tabnum" style={{ fontSize: 24, fontWeight: 720, letterSpacing: "-0.03em", color: "var(--ink)" }}>{d.getDate()}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: isToday ? "var(--accent)" : "var(--ink-3)" }}>{WDL[d.getDay()]} {MO[d.getMonth()]}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          {isToday && <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 999, color: "var(--accent-ink)", background: "var(--accent)" }}>Today</span>}
          {total > 0 && <span className="tabnum" style={{ fontSize: 11.5, fontWeight: 650, padding: "4px 9px", borderRadius: 999, color: "var(--ink-2)", background: "var(--inset)" }}>{total} cand.</span>}
        </div>
      </div>
      {sessions.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--ink-4)", fontWeight: 500, padding: "6px 0" }}>No exams scheduled</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {Object.entries(groups).map(([slug, ss]) => <VendorGroup key={slug} slug={slug} sessions={ss} />)}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", paddingTop: 11, borderTop: "1px solid var(--hairline)" }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-4)" }}>On roster</span>
        {roster.length === 0
          ? <span style={{ fontSize: 11.5, color: "var(--ink-4)", fontStyle: "italic" }}>None</span>
          : roster.map((n) => <span key={n} className="inset" style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, color: "var(--ink-2)" }}>{n}</span>)}
      </div>
    </div>
  );
}

function ExamOutlookPanel({ branch }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {[0, 1, 2, 3, 4, 5, 6].map((o) => <DayRow key={o} offset={o} branch={branch} />)}
    </div>
  );
}

/* ---------- vault drawer panel ---------- */
const TYPE_ICON = { url: "link", login: "users", password: "key", code: "hash", pin: "pin", phone: "phone", email: "at" };

function VaultRow({ row }) {
  const [reveal, setReveal] = React.useState(false);
  const shown = row.secret && !reveal ? "•".repeat(10) : row.value;
  return (
    <div className="glass-2" style={{ padding: "12px 14px", borderRadius: 12, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--ink-4)" }}>{row.label}</div>
        <div className="mono" style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{shown}</div>
      </div>
      {row.secret && (
        <button onClick={() => setReveal((r) => !r)} title={reveal ? "Hide" : "Reveal"} className="tap"
          style={{ width: 34, height: 34, borderRadius: 9, border: "none", cursor: "pointer", background: "transparent", color: "var(--ink-3)", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Icon name={reveal ? "eyeOff" : "eye"} size={16} />
        </button>
      )}
      <button onClick={() => toast(`${row.label} copied`, "copy")} title="Copy" className="tap" style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 34, padding: "0 13px", borderRadius: 9, border: "none", cursor: "pointer", color: "var(--accent-ink)", background: "var(--accent)", fontFamily: "var(--font)", fontSize: 12, fontWeight: 750, flexShrink: 0 }}>
        <Icon name="copy" size={14} /> Copy
      </button>
    </div>
  );
}

function VaultEditForm({ initial, onSave, onCancel }) {
  const [f, setF] = React.useState({ title: initial.title || "", category: initial.category || "General", username: initial.username || "", password: initial.password || "", url: initial.url || "", notes: initial.notes || "" });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const inp = { background: "var(--inset)", border: "1px solid var(--hairline)", borderRadius: 9, color: "var(--ink)", fontFamily: "var(--font)", fontSize: 13, padding: "9px 11px", width: "100%" };
  return (
    <div className="glass-2" style={{ padding: 14, borderRadius: 14, display: "flex", flexDirection: "column", gap: 9 }}>
      <input autoFocus value={f.title} onChange={set("title")} placeholder="Title (e.g. Prometric Admin Portal)" style={{ ...inp, fontWeight: 650 }} />
      <div style={{ display: "flex", gap: 9 }}>
        <input value={f.category} onChange={set("category")} placeholder="Category" style={inp} />
        <input value={f.url} onChange={set("url")} placeholder="URL" style={inp} />
      </div>
      <div style={{ display: "flex", gap: 9 }}>
        <input value={f.username} onChange={set("username")} placeholder="Username / ID" style={inp} />
        <input value={f.password} onChange={set("password")} placeholder="Password" style={inp} />
      </div>
      <input value={f.notes} onChange={set("notes")} placeholder="Notes (optional)" style={inp} />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel} className="tap glass-2" style={{ padding: "8px 14px", borderRadius: 9, cursor: "pointer", border: "1px solid var(--hairline)", color: "var(--ink-2)", fontSize: 12.5, fontWeight: 650 }}>Cancel</button>
        <button onClick={() => f.title.trim() && onSave(f)} className="tap" style={{ padding: "8px 16px", borderRadius: 9, cursor: "pointer", border: "none", color: "var(--accent-ink)", background: "var(--accent)", fontSize: 12.5, fontWeight: 750 }}>Save</button>
      </div>
    </div>
  );
}

function VaultCard({ it, onEdit, onDelete }) {
  const [reveal, setReveal] = React.useState(false);
  const Field = ({ label, value, secret }) => value ? (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--ink-4)" }}>{label}</div>
        <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{secret && !reveal ? "•".repeat(10) : value}</div>
      </div>
      {secret && <button onClick={() => setReveal((r) => !r)} className="tap" title={reveal ? "Hide" : "Reveal"} style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", color: "var(--ink-3)", cursor: "pointer", display: "grid", placeItems: "center" }}><Icon name={reveal ? "eyeOff" : "eye"} size={15} /></button>}
      <button onClick={() => toast(`${label} copied`, "copy")} className="tap" title="Copy" style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", color: "var(--ink-3)", cursor: "pointer", display: "grid", placeItems: "center" }}><Icon name="copy" size={15} /></button>
    </div>
  ) : null;
  return (
    <div className="glass-2" style={{ padding: "14px 16px", borderRadius: 14, display: "flex", flexDirection: "column", gap: 11 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ink)" }}>{it.title}</div>
          <div className="eyebrow" style={{ fontSize: 9, color: "var(--ink-4)", marginTop: 2 }}>{it.category}</div>
        </div>
        <button onClick={onEdit} title="Edit" className="tap glass-2" style={{ width: 32, height: 32, borderRadius: 8, display: "grid", placeItems: "center", cursor: "pointer", color: "var(--ink-2)", border: "1px solid var(--hairline)" }}><Icon name="settings" size={14} /></button>
        <button onClick={onDelete} title="Delete" className="tap glass-2" style={{ width: 32, height: 32, borderRadius: 8, display: "grid", placeItems: "center", cursor: "pointer", color: "var(--bad)", border: "1px solid var(--hairline)" }}><Icon name="trash" size={14} /></button>
      </div>
      {it.url ? <a href={it.url} target="_blank" rel="noopener noreferrer" className="tap" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 9, textDecoration: "none", color: "var(--accent-ink)", background: "var(--accent)", fontWeight: 700, fontSize: 12.5, alignSelf: "flex-start" }}><Icon name="ext" size={14} /> Open portal</a> : null}
      <Field label="Username" value={it.username} />
      <Field label="Password" value={it.password} secret />
      {it.notes ? <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{it.notes}</div> : null}
    </div>
  );
}

function VaultPanel() {
  const [items, setItems] = React.useState(() => (window.FETS._vault ? [...window.FETS._vault] : []));
  const [editing, setEditing] = React.useState(null); // id | "__new" | null
  const save = (entry) => {
    if (editing === "__new") {
      const tmp = { ...entry, id: "tmp" + Date.now() };
      setItems((xs) => [tmp, ...xs]);
      DB.dbAddVault(entry).then((row) => { if (row && row.id != null) setItems((xs) => xs.map((x) => x === tmp ? { ...x, id: row.id } : x)); });
    } else {
      DB.dbUpdateVault(editing, entry);
      setItems((xs) => xs.map((x) => x.id === editing ? { ...x, ...entry } : x));
    }
    setEditing(null);
  };
  const del = (it) => { if (!window.confirm("Delete this credential?")) return; if (it.id != null && String(it.id).indexOf("tmp") !== 0) DB.dbDeleteVault(it.id); setItems((xs) => xs.filter((x) => x !== it)); };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {editing !== "__new" && <button onClick={() => setEditing("__new")} className="tap" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", borderRadius: 12, cursor: "pointer", border: "none", color: "var(--accent-ink)", background: "var(--accent)", fontFamily: "var(--font)", fontSize: 13, fontWeight: 750 }}><Icon name="plus" size={16} /> Add credential</button>}
      {editing === "__new" && <VaultEditForm initial={{}} onSave={save} onCancel={() => setEditing(null)} />}
      {items.length === 0 && editing !== "__new" && <div className="inset" style={{ padding: 22, borderRadius: 14, textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}>No credentials saved yet. Add your portals & logins here.</div>}
      {items.map((it) => editing === it.id
        ? <VaultEditForm key={it.id} initial={it} onSave={save} onCancel={() => setEditing(null)} />
        : <VaultCard key={it.id} it={it} onEdit={() => setEditing(it.id)} onDelete={() => del(it)} />)}
    </div>
  );
}

/* ---------- help desk drawer panel ---------- */
function HelpDeskPanel() {
  const vendors = window.FETS.VENDORS;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 11 }}>
      {vendors.map((v) => (
        <a key={v.slug} href={v.support} target="_blank" rel="noopener noreferrer" className="tap glass-2"
          style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px 15px", borderRadius: 16, textDecoration: "none", minHeight: 96 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ width: 36, height: 36, borderRadius: 11, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800, color: "#fff", background: v.color }}>{v.short}</span>
            <span style={{ color: "var(--ink-4)" }}><Icon name="ext" size={15} /></span>
          </div>
          <div>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{v.name}</span>
            <span style={{ display: "block", fontSize: 11, color: "var(--ink-4)", marginTop: 2 }}>Live support portal</span>
          </div>
        </a>
      ))}
    </div>
  );
}

const LOST_FOUND = [];
const LF_STATUS = { stored: { label: "In locker", color: "var(--v-ielts)" }, claimed: { label: "Claimed", color: "var(--ok)" } };

function LostFoundPanel({ branch }) {
  const [items, setItems] = React.useState(() => (window.FETS._lostFound && window.FETS._lostFound.length) ? [...window.FETS._lostFound] : []);
  const [adding, setAdding] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState(branch === "global" ? "all" : branch);
  const [search, setSearch] = React.useState("");

  // Detailed Log Form States
  const [fItem, setFItem] = React.useState("");
  const [fDate, setFDate] = React.useState(() => new Date().toISOString().split("T")[0]);
  const [fWhere, setFWhere] = React.useState("");
  const [fLocker, setFLocker] = React.useState("");
  const [fStaffName, setFStaffName] = React.useState(window.FETS._meName || "");
  const [fPerishable, setFPerishable] = React.useState(false);
  const [fRefNo, setFRefNo] = React.useState("");
  const [fCctv, setFCctv] = React.useState("");
  const [fCandidate, setFCandidate] = React.useState("");
  const [fContact, setFContact] = React.useState("");
  const [fExam, setFExam] = React.useState("");
  const isSuperAdmin = window.FETS?.user?.role === 'Super Admin';
  const hasDelegation = !!window.FETS?._hasTempCrossAccess;
  const userProfileBranch = window.FETS?._meBranch || 'cochin';
  const isLocked = !isSuperAdmin && branch !== userProfileBranch;
  
  const defaultFBranch = (isSuperAdmin || hasDelegation)
    ? (branch === "global" ? "cochin" : branch)
    : userProfileBranch;

  const [fBranch, setFBranch] = React.useState(defaultFBranch);

  React.useEffect(() => {
    if (isSuperAdmin || hasDelegation) {
      setFBranch(branch === "global" ? "cochin" : branch);
    } else {
      setFBranch(userProfileBranch);
    }
  }, [branch]);

  // Claim Modal States
  const [claimingItem, setClaimingItem] = React.useState(null);
  const [cName, setCName] = React.useState("");
  const [cContact, setCContact] = React.useState("");
  const [cIdProof, setCIdProof] = React.useState("");
  const [cDate, setCDate] = React.useState(() => new Date().toISOString().split("T")[0]);

  // Details Dialog State (to view full logged details of any item)
  const [viewingItem, setViewingItem] = React.useState(null);

  // Filter list
  const list = items.filter((i) => {
    // Branch filter
    const matchesBranch = activeTab === "all" || i.branch === activeTab;
    if (!matchesBranch) return false;
    
    // Search query filter
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        i.item.toLowerCase().includes(q) ||
        i.where.toLowerCase().includes(q) ||
        (i.locker && i.locker.toLowerCase().includes(q)) ||
        (i.reference_no && String(i.reference_no).includes(q)) ||
        (i.candidate_details && i.candidate_details.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const stored = list.filter((i) => i.status === "stored").length;

  const staffList = window.FETS.PEOPLE || [];

  const handleClaimSubmit = (e) => {
    e.preventDefault();
    if (!cName.trim() || !cContact.trim() || !cIdProof.trim()) {
      toast("Please fill in all claiming fields", "alert");
      return;
    }
    const it = claimingItem;
    if (it && it.id != null) {
      DB.dbClaimLostFound(it.id, { name: cName.trim(), contact: cContact.trim(), idProof: cIdProof.trim(), date: cDate });
    }
    setItems((arr) =>
      arr.map((x) =>
        x === it
          ? {
              ...x,
              status: "claimed",
              returned_date: cDate,
              returned_to_name: cName.trim(),
              returned_to_contact: cContact.trim(),
              returned_to_id_proof: cIdProof.trim()
            }
          : x
      )
    );
    toast("Marked as claimed successfully", "check");
    setClaimingItem(null);
    setCName("");
    setCContact("");
    setCIdProof("");
  };

  const del = (it) => {
    if (!window.confirm("Remove this item?")) return;
    if (it && it.id != null) DB.dbDeleteLostFound(it.id);
    setItems((arr) => arr.filter((x) => x !== it));
  };

  const add = () => {
    if (!fItem.trim()) {
      toast("Item description is required", "alert");
      return;
    }
    
    // Resolve selected staff to their profile ID
    const staffId = window.FETS._staffIdByName[fStaffName] || null;
    
    const entry = {
      item: fItem.trim(),
      where: fWhere.trim() || "—",
      when: fDate,
      branch: fBranch,
      locker: fLocker.trim(),
      status: "stored",
      by: staffId || window.FETS.user.name,
      perishable: fPerishable,
      reference_no: fRefNo ? parseInt(fRefNo, 10) : null,
      cctv_dvr_no: fCctv.trim(),
      candidate_details: fCandidate.trim(),
      contact_info: fContact.trim(),
      exam_details: fExam.trim()
    };

    // Optimistic UI update
    setItems((arr) => [entry, ...arr]);

    DB.dbAddLostFound(entry).then((row) => {
      if (row && row.id != null) {
        setItems((arr) => arr.map((x) => x === entry ? { ...x, id: row.id } : x));
      }
    });

    // Reset Form
    setFItem("");
    setFWhere("");
    setFLocker("");
    setFStaffName(window.FETS._meName || "");
    setFPerishable(false);
    setFRefNo("");
    setFCctv("");
    setFCandidate("");
    setFContact("");
    setFExam("");
    setAdding(false);
  };

  const getStaffName = (by) => {
    if (!by) return "—";
    const staffMaps = window.FETS._staffIdByName || {};
    const foundName = Object.keys(staffMaps).find(name => staffMaps[name] === by);
    if (foundName) return foundName;
    return by;
  };

  const getAgeInfo = (item) => {
    if (!item.when) return { text: "Unknown", color: "var(--ink-4)" };
    const foundDate = new Date(item.when);
    const now = new Date();
    foundDate.setHours(0,0,0,0);
    now.setHours(0,0,0,0);
    const diffTime = now.getTime() - foundDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (item.status === "claimed") {
      return { text: `Claimed`, color: "var(--ok)", days: diffDays };
    }
    
    if (item.perishable) {
      if (diffDays >= 2) {
        return { text: `Expired (${diffDays}d) - Dispose`, color: "var(--bad)", alert: true, days: diffDays };
      }
      if (diffDays === 1) {
        return { text: `1 day old (Expiring)`, color: "var(--v-ielts)", warning: true, days: diffDays };
      }
      return { text: `Recent (<24h)`, color: "var(--ok)", days: diffDays };
    }
    
    if (diffDays >= 30) {
      return { text: `Aged (${diffDays} days)`, color: "var(--v-ielts)", alert: true, days: diffDays };
    }
    if (diffDays >= 7) {
      return { text: `${diffDays} days old`, color: "var(--accent)", days: diffDays };
    }
    return { text: `${diffDays === 0 ? "Today" : `${diffDays}d ago`}`, color: "var(--ok)", days: diffDays };
  };

  const inp = {
    background: "var(--inset)",
    border: "1px solid var(--hairline)",
    borderRadius: 10,
    color: "var(--ink)",
    fontFamily: "var(--font)",
    fontSize: 13,
    padding: "9px 12px",
    width: "100%"
  };

  const formGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 10
  };

  const labelStyle = {
    fontSize: 11.5,
    fontWeight: 650,
    color: "var(--ink-3)",
    display: "flex",
    flexDirection: "column",
    gap: 4
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Branch Tabs Filter */}
      <div style={{ display: "flex", background: "var(--inset)", padding: 3, borderRadius: 12, border: "1px solid var(--hairline)" }}>
        {["all", "cochin", "calicut"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: "7px 10px",
              borderRadius: 9,
              border: "none",
              fontSize: 12,
              fontWeight: activeTab === tab ? 750 : 600,
              cursor: "pointer",
              background: activeTab === tab ? "var(--glass-thick)" : "transparent",
              color: activeTab === tab ? "var(--ink)" : "var(--ink-3)",
              boxShadow: activeTab === tab ? "0 2px 8px var(--shadow)" : "none",
              transition: "all 0.15s ease",
              textTransform: "capitalize"
            }}
          >
            {tab === "all" ? "All Centers" : tab}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <StatPill value={stored} label="Awaiting claim" tone={stored ? "var(--v-ielts)" : "var(--ok)"} />
        <StatPill value={list.length} label="Items logged" />
      </div>

      {/* Search Filter */}
      <div style={{ position: "relative" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items by keyword..."
          style={{ ...inp, paddingLeft: 36 }}
        />
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ink-4)", pointerEvents: "none" }}>
          <Icon name="search" size={15} />
        </span>
      </div>

      {adding ? (
        <div className="glass-2" style={{ padding: 14, borderRadius: 16, display: "flex", flexDirection: "column", gap: 12, border: "1px solid var(--hairline)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 750, color: "var(--ink)" }}>Log Found Item</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "var(--accent-ink)",
                background: "var(--accent)",
                padding: "3px 8px",
                borderRadius: 8,
                textTransform: "uppercase"
              }}
            >
              {fBranch}
            </span>
          </div>

          <label style={labelStyle}>
            Item Description *
            <input autoFocus value={fItem} onChange={(e) => setFItem(e.target.value)} placeholder="e.g. Black iPhone 15 with brown leather case" style={inp} required />
          </label>

          <div style={formGridStyle}>
            <label style={labelStyle}>
              Date Found
              <input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} style={inp} />
            </label>
            <label style={labelStyle}>
              Founded Location
              <input value={fWhere} onChange={(e) => setFWhere(e.target.value)} placeholder="e.g. Waiting Lounge" style={inp} />
            </label>
          </div>

          <div style={formGridStyle}>
            <label style={labelStyle}>
              Locker / Shelf
              <input value={fLocker} onChange={(e) => setFLocker(e.target.value)} placeholder="e.g. Locker B-2" style={inp} />
            </label>
            <label style={labelStyle}>
              Found By Staff
              <select value={fStaffName} onChange={(e) => setFStaffName(e.target.value)} style={inp}>
                <option value="">Choose Staff...</option>
                {staffList.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
          </div>

          <div style={formGridStyle}>
            <label style={labelStyle}>
              Reference Tag No
              <input type="number" value={fRefNo} onChange={(e) => setFRefNo(e.target.value)} placeholder="e.g. 104" style={inp} />
            </label>
            <label style={labelStyle}>
              CCTV Camera/DVR
              <input value={fCctv} onChange={(e) => setFCctv(e.target.value)} placeholder="e.g. Cam 4 reception" style={inp} />
            </label>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4, background: "var(--inset)", padding: 10, borderRadius: 10, border: "1px solid var(--hairline)" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase" }}>Candidate Details (Optional)</span>
            <div style={formGridStyle}>
              <label style={labelStyle}>
                Name
                <input value={fCandidate} onChange={(e) => setFCandidate(e.target.value)} placeholder="Candidate name" style={inp} />
              </label>
              <label style={labelStyle}>
                Contact Number
                <input value={fContact} onChange={(e) => setFContact(e.target.value)} placeholder="Candidate phone" style={inp} />
              </label>
            </div>
            <label style={{ ...labelStyle, marginTop: 4 }}>
              Exam Details
              <input value={fExam} onChange={(e) => setFExam(e.target.value)} placeholder="e.g. Pearson Vue - IELTS Academic" style={inp} />
            </label>
          </div>

          <label style={labelStyle}>
            Select Target Center
            <select 
              value={fBranch} 
              onChange={(e) => setFBranch(e.target.value)} 
              disabled={!isSuperAdmin && !hasDelegation}
              style={{
                ...inp,
                opacity: (!isSuperAdmin && !hasDelegation) ? 0.65 : 1,
                cursor: (!isSuperAdmin && !hasDelegation) ? "not-allowed" : "default",
                background: (!isSuperAdmin && !hasDelegation) ? "var(--inset)" : "var(--glass-2)",
              }}
            >
              <option value="calicut">Calicut</option>
              <option value="cochin">Cochin</option>
            </select>
          </label>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--inset)", padding: "8px 12px", borderRadius: 10, border: "1px solid var(--hairline)" }}>
            <span style={{ fontSize: 12, fontWeight: 650, color: "var(--ink)" }}>Is Perishable Item?</span>
            <label style={{ position: "relative", display: "inline-block", width: 44, height: 24 }}>
              <input type="checkbox" checked={fPerishable} onChange={(e) => setFPerishable(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
              <span style={{
                position: "absolute",
                cursor: "pointer",
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: fPerishable ? "var(--bad)" : "var(--hairline)",
                transition: "0.2s",
                borderRadius: 24
              }}>
                <span style={{
                  position: "absolute",
                  content: '""',
                  height: 18, width: 18,
                  left: fPerishable ? 22 : 3,
                  bottom: 3,
                  backgroundColor: "white",
                  transition: "0.2s",
                  borderRadius: "50%",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
                }} />
              </span>
            </label>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button onClick={() => setAdding(false)} className="tap glass-2" style={{ padding: "9px 14px", borderRadius: 10, cursor: "pointer", border: "1px solid var(--hairline)", color: "var(--ink-2)", fontSize: 12.5, fontWeight: 650 }}>Cancel</button>
            <button onClick={add} className="tap" style={{ padding: "9px 18px", borderRadius: 10, cursor: "pointer", border: "none", color: "var(--accent-ink)", background: "var(--accent)", fontSize: 12.5, fontWeight: 750 }}>Log item</button>
          </div>
        </div>
      ) : (
        !isLocked ? (
          <button onClick={() => setAdding(true)} className="tap inset" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", borderRadius: 14, cursor: "pointer", color: "var(--ink-2)", fontFamily: "var(--font)", fontSize: 13, fontWeight: 650, borderStyle: "dashed" }}>
            <Icon name="plus" size={16} /> Log a found item
          </button>
        ) : (
          <div className="inset" style={{ padding: "12px", borderRadius: 14, textAlign: "center", color: "var(--ink-4)", fontSize: 13, fontWeight: 650, border: "1px dashed var(--hairline)" }}>
            🔒 Log found item restricted (Locked to {capBranch(userProfileBranch)})
          </div>
        )
      )}

      {/* Claimant Input Form Modal */}
      {claimingItem && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(4px)",
          display: "grid",
          placeItems: "center",
          zIndex: 99999,
          padding: 16
        }}>
          <form onSubmit={handleClaimSubmit} className="glass-thick" style={{
            width: "100%",
            maxWidth: 380,
            padding: 18,
            borderRadius: 18,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            boxShadow: "0 20px 40px var(--shadow-heavy)",
            border: "1px solid var(--hairline)",
            animation: "rise 0.25s ease"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 14, fontWeight: 750, color: "var(--ink)" }}>Complete Claim Handover</span>
              <button type="button" onClick={() => setClaimingItem(null)} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--ink-4)" }}><Icon name="x" size={18} /></button>
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-3)", background: "var(--inset)", padding: 8, borderRadius: 8 }}>
              Item: <strong>{claimingItem.item}</strong>
            </div>
            
            <label style={labelStyle}>
              Claimant Full Name *
              <input autoFocus value={cName} onChange={(e) => setCName(e.target.value)} placeholder="e.g. John Doe" style={inp} required />
            </label>
            <label style={labelStyle}>
              Contact Number *
              <input value={cContact} onChange={(e) => setCContact(e.target.value)} placeholder="e.g. +91 9876543210" style={inp} required />
            </label>
            <label style={labelStyle}>
              ID Proof Details *
              <input value={cIdProof} onChange={(e) => setCIdProof(e.target.value)} placeholder="e.g. Driving License (DL-XXXXXX)" style={inp} required />
            </label>
            <label style={labelStyle}>
              Handover Date
              <input type="date" value={cDate} onChange={(e) => setCDate(e.target.value)} style={inp} required />
            </label>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
              <button type="button" onClick={() => setClaimingItem(null)} className="tap glass-2" style={{ padding: "8px 14px", borderRadius: 10, cursor: "pointer", border: "1px solid var(--hairline)", color: "var(--ink-2)", fontSize: 12 }}>Cancel</button>
              <button type="submit" className="tap" style={{ padding: "8px 16px", borderRadius: 10, cursor: "pointer", border: "none", color: "var(--accent-ink)", background: "var(--accent)", fontSize: 12, fontWeight: 700 }}>Confirm handover</button>
            </div>
          </form>
        </div>
      )}

      {/* View Details Modal */}
      {viewingItem && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(4px)",
          display: "grid",
          placeItems: "center",
          zIndex: 99998,
          padding: 16
        }}>
          <div className="glass-thick" style={{
            width: "100%",
            maxWidth: 420,
            padding: 18,
            borderRadius: 18,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            boxShadow: "0 20px 40px var(--shadow-heavy)",
            border: "1px solid var(--hairline)",
            animation: "rise 0.25s ease"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 14, fontWeight: 750, color: "var(--ink)" }}>Lost & Found Details</span>
              <button onClick={() => setViewingItem(null)} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--ink-4)" }}><Icon name="x" size={18} /></button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "var(--ink)" }}>
              <div style={{ background: "var(--inset)", padding: 12, borderRadius: 10, border: "1px solid var(--hairline)" }}>
                <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", marginBottom: 2 }}>Item Description</span>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{viewingItem.item}</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <span style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase" }}>Center Location</span>
                  <strong style={{ textTransform: "capitalize" }}>{viewingItem.branch}</strong>
                </div>
                <div>
                  <span style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase" }}>Date Found</span>
                  <strong>{viewingItem.when}</strong>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <span style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase" }}>Found Location</span>
                  <strong>{viewingItem.where || "—"}</strong>
                </div>
                <div>
                  <span style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase" }}>Locker Location</span>
                  <strong>{viewingItem.locker || "—"}</strong>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <span style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase" }}>Found By Staff</span>
                  <strong>{getStaffName(viewingItem.by)}</strong>
                </div>
                <div>
                  <span style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase" }}>Reference No</span>
                  <strong>{viewingItem.reference_no ? `#${viewingItem.reference_no}` : "—"}</strong>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <span style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase" }}>Item Class</span>
                  <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, color: viewingItem.perishable ? "var(--bad)" : "var(--accent)" }}>
                    {viewingItem.perishable ? "⚠️ Perishable" : "Standard"}
                  </span>
                </div>
                <div>
                  <span style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase" }}>CCTV Reference</span>
                  <strong>{viewingItem.cctv_dvr_no || "—"}</strong>
                </div>
              </div>

              {/* Candidate Info */}
              {(viewingItem.candidate_details || viewingItem.contact_info || viewingItem.exam_details) && (
                <div style={{ background: "var(--inset)", padding: 10, borderRadius: 10, border: "1px solid var(--hairline)" }}>
                  <span style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", marginBottom: 4 }}>Linked Candidate / Exam</span>
                  <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
                    {viewingItem.candidate_details && <div>Candidate: <strong>{viewingItem.candidate_details}</strong></div>}
                    {viewingItem.contact_info && <div>Phone: <strong>{viewingItem.contact_info}</strong></div>}
                    {viewingItem.exam_details && <div>Exam: <strong>{viewingItem.exam_details}</strong></div>}
                  </div>
                </div>
              )}

              {/* Handover Details */}
              {viewingItem.status === "claimed" && (
                <div style={{ background: "color-mix(in oklch, var(--ok) 8%, transparent)", padding: 10, borderRadius: 10, border: "1px solid color-mix(in oklch, var(--ok) 25%, transparent)", borderLeft: "4px solid var(--ok)" }}>
                  <span style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--ok)", textTransform: "uppercase", marginBottom: 4 }}>Claim Handover Details</span>
                  <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
                    <div>Claimant: <strong>{viewingItem.returned_to_name || "—"}</strong></div>
                    <div>Phone: <strong>{viewingItem.returned_to_contact || "—"}</strong></div>
                    <div>ID Verified: <strong>{viewingItem.returned_to_id_proof || "—"}</strong></div>
                    {viewingItem.returned_date && <div>Date Claimed: <strong>{new Date(viewingItem.returned_date).toLocaleDateString()}</strong></div>}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
              <button onClick={() => setViewingItem(null)} className="tap" style={{ padding: "8px 16px", borderRadius: 10, cursor: "pointer", border: "none", color: "var(--accent-ink)", background: "var(--accent)", fontSize: 12, fontWeight: 700 }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Item List Container */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {list.length === 0 ? (
          <div className="inset" style={{ padding: 22, borderRadius: 14, textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}>
            No items match your selected filter.
          </div>
        ) : (
          list.map((it, i) => {
            const sm = LF_STATUS[it.status] || LF_STATUS.stored;
            const age = getAgeInfo(it);
            
            return (
              <div
                key={i}
                className="glass-2"
                style={{
                  padding: 12,
                  borderRadius: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  border: it.perishable && it.status !== "claimed" ? "1px dashed var(--bad)" : "1px solid var(--hairline)"
                }}
              >
                {/* Status Indicator Icon */}
                <span
                  onClick={() => setViewingItem(it)}
                  title="Click to view details"
                  className="tap"
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    cursor: "pointer",
                    color: sm.color,
                    background: `color-mix(in oklch, ${sm.color} 12%, transparent)`,
                    border: `1px solid color-mix(in oklch, ${sm.color} 24%, transparent)`
                  }}
                >
                  <Icon name="package" size={18} />
                </span>

                {/* Body Details */}
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  <div
                    onClick={() => setViewingItem(it)}
                    className="tap"
                    style={{
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: "var(--ink)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      cursor: "pointer"
                    }}
                  >
                    {it.item}
                  </div>
                  
                  {/* Badges / Sub-meta */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span className="mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>
                      {it.where} · {it.when}
                    </span>
                    {it.locker && (
                      <span style={{ fontSize: 9.5, padding: "1px 5px", borderRadius: 5, background: "var(--inset)", color: "var(--ink-3)", border: "1px solid var(--hairline)" }}>
                        {it.locker}
                      </span>
                    )}
                    {it.reference_no && (
                      <span style={{ fontSize: 9.5, padding: "1px 5px", borderRadius: 5, background: "var(--inset)", color: "var(--accent)", fontWeight: 700, border: "1px solid var(--hairline)" }}>
                        #{it.reference_no}
                      </span>
                    )}
                  </div>
                  
                  {/* Aging & Perishable trackers */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                    <span style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      color: age.color,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: age.color }} />
                      {age.text}
                    </span>
                    
                    {it.perishable && it.status !== "claimed" && (
                      <span style={{
                        fontSize: 9,
                        fontWeight: 800,
                        color: "var(--bad)",
                        background: "color-mix(in oklch, var(--bad) 12%, transparent)",
                        padding: "1px 5px",
                        borderRadius: 4,
                        textTransform: "uppercase"
                      }}>
                        Perishable
                      </span>
                    )}

                    {activeTab === "all" && (
                      <span style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: "var(--ink-3)",
                        background: "var(--inset)",
                        padding: "1px 5px",
                        borderRadius: 4,
                        textTransform: "capitalize"
                      }}>
                        {it.branch}
                      </span>
                    )}
                  </div>
                </div>

                {/* Handover & Actions */}
                {it.status === "stored" ? (
                  !isLocked ? (
                    <button
                      onClick={() => setClaimingItem(it)}
                      className="tap"
                      style={{
                        flexShrink: 0,
                        padding: "8px 12px",
                        borderRadius: 10,
                        border: "none",
                        cursor: "pointer",
                        fontFamily: "var(--font)",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--accent-ink)",
                        background: "var(--accent)"
                      }}
                    >
                      Claim
                    </button>
                  ) : (
                    <span
                      onClick={() => setViewingItem(it)}
                      className="tap"
                      style={{
                        flexShrink: 0,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 9.5,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.03em",
                        padding: "5px 9px",
                        borderRadius: 99,
                        color: sm.color,
                        cursor: "pointer",
                        background: `color-mix(in oklch, ${sm.color} 12%, transparent)`
                      }}
                    >
                      {sm.label}
                    </span>
                  )
                ) : (
                  <span
                    onClick={() => setViewingItem(it)}
                    className="tap"
                    style={{
                      flexShrink: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 9.5,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                      padding: "5px 9px",
                      borderRadius: 99,
                      color: sm.color,
                      cursor: "pointer",
                      background: `color-mix(in oklch, ${sm.color} 12%, transparent)`
                    }}
                  >
                    <Icon name="check" size={11} stroke={3} /> {sm.label}
                  </span>
                )}
                
                {!isLocked && (
                  <button
                    onClick={() => del(it)}
                    title="Delete log"
                    className="tap glass-2"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      display: "grid",
                      placeItems: "center",
                      cursor: "pointer",
                      color: "var(--bad)",
                      border: "1px solid var(--hairline)",
                      flexShrink: 0
                    }}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

Object.assign(window, { StatusRow, Shelf, ExamOutlookPanel, VaultPanel, HelpDeskPanel, LostFoundPanel, weekTotals, branchSessions, branchRoster, VENDOR_BY_SLUG });

/* ============================================================
   SOURCE: pages.jsx
   ============================================================ */
/* ============================================================
   FETS · LIVE — full pages: Calendar, Roster, Google Business
   (exports to window for command-centre.jsx)
   ============================================================ */

const P_WD  = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const P_WDL = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const P_MO  = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function pfmt12(t) {
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ap}`;
}
function capBranch(b) { return b === "global" ? "All Centres" : b.charAt(0).toUpperCase() + b.slice(1); }

/* ---------- shared small bits ---------- */
function SectionLabel({ children, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ width: 22, height: 2, background: "var(--accent)", borderRadius: 99 }} />
      <span className="eyebrow">{children}</span>
      <span style={{ flex: 1, height: 1, background: "var(--hairline)" }} />
      {right}
    </div>
  );
}

function PageHeader({ eyebrow, title, accentWord, sub }) {
  return (
    <header className="rise" style={{ paddingTop: 2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <span style={{ width: 34, height: 2, background: "var(--accent)", borderRadius: 99 }} />
        <span className="eyebrow" style={{ color: "var(--accent)" }}>{eyebrow}</span>
      </div>
      <h1 style={{ margin: 0, fontFamily: '"Archivo Expanded", var(--font)', fontWeight: 800,
        fontSize: "clamp(40px,6.5vw,76px)", lineHeight: 0.9, letterSpacing: "-0.03em", color: "var(--accent)" }}>
        {title} {accentWord && <span style={{ color: "var(--accent)" }}>{accentWord}</span>}
      </h1>
      {sub && <p style={{ margin: "16px 0 0", fontSize: 15, color: "var(--ink-3)", fontWeight: 500, maxWidth: 620 }}>{sub}</p>}
    </header>
  );
}

function StatPill({ value, unit, label, tone }) {
  return (
    <div className="glass" style={{ padding: "18px 20px", borderRadius: "var(--radius)", flex: "1 1 160px", minWidth: 150 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span className="tabnum mono" style={{ fontSize: 38, fontWeight: 700, letterSpacing: "-0.04em", color: tone || "var(--accent)", lineHeight: 1 }}>{value}</span>
        {unit && <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-3)" }}>{unit}</span>}
      </div>
      <div className="eyebrow" style={{ marginTop: 12, color: "var(--ink-3)" }}>{label}</div>
    </div>
  );
}

/* ---- shared chart atoms (bars + donut) ---- */
function BarRow({ label, n, max, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ width: 120, fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", flexShrink: 0, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      <div style={{ flex: 1, height: 26, borderRadius: 7, background: "var(--inset)", overflow: "hidden", position: "relative" }}>
        <div style={{ height: "100%", width: `${max ? (n / max) * 100 : 0}%`, minWidth: n ? 26 : 0, borderRadius: 7, background: color,
          display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8, transition: "width .5s ease" }}>
          {n > 0 && <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{n}</span>}
        </div>
      </div>
    </div>
  );
}

function Donut({ segments, total, centerLabel, centerSub }) {
  let acc = 0;
  const stops = segments.map((s) => { const from = acc / total * 360; acc += s.n; const to = acc / total * 360; return `${s.color} ${from}deg ${to}deg`; }).join(", ");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      <div style={{ position: "relative", width: 132, height: 132, borderRadius: "50%", flexShrink: 0,
        background: total ? `conic-gradient(${stops})` : "var(--inset)", display: "grid", placeItems: "center" }}>
        <div style={{ width: 88, height: 88, borderRadius: "50%", background: "var(--glass)", display: "grid", placeItems: "center", textAlign: "center" }}>
          <div>
            <div className="tabnum" style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--ink)", lineHeight: 1 }}>{centerLabel}</div>
            <div className="eyebrow" style={{ fontSize: 8, color: "var(--ink-4)", marginTop: 3 }}>{centerSub}</div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9, flex: 1, minWidth: 130 }}>
        {segments.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ flex: 1, color: "var(--ink-2)", fontWeight: 600 }}>{s.label}</span>
            <span className="mono" style={{ color: "var(--ink-3)", fontWeight: 700 }}>{s.n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =====================================================================
   CALENDAR PAGE — week board + agenda
   ===================================================================== */
function CalSessionCard({ s, showBranch }) {
  const v = window.VENDOR_BY_SLUG[s.vendor];
  return (
    <div className="glass-2 tap" style={{
      padding: "11px 12px", borderRadius: 11, borderLeft: `3px solid ${v.color}`,
      display: "flex", flexDirection: "column", gap: 7, cursor: "pointer",
    }}
      onClick={() => toast(`${s.exam} · ${s.count} candidates`, "calendar")}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ width: 18, height: 18, borderRadius: 5, background: v.color, color: "#fff", fontSize: 7.5, fontWeight: 800,
          display: "grid", placeItems: "center", flexShrink: 0, fontFamily: "var(--font)" }}>{v.short}</span>
        <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink-2)", letterSpacing: "0.02em" }}>{pfmt12(s.start)}</span>
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 650, color: "var(--ink)", lineHeight: 1.25 }}>{s.exam}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--ink-3)", fontWeight: 600 }}>
          <Icon name="users" size={12} /> {s.count}
        </span>
        {showBranch && <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
          color: "var(--ink-4)", padding: "2px 6px", borderRadius: 99, background: "var(--inset)" }}>{s.branch}</span>}
      </div>
    </div>
  );
}

/* =====================================================================
   ROSTER — request card (shared with Leave Approvals drawer)
   ===================================================================== */
function RequestCard({ req, onResolve, resolved }) {
  const isSwap = req.type === "swap";
  const d = req.date;
  return (
    <div className="glass-2" style={{ padding: 16, borderRadius: 14, display: "flex", flexDirection: "column", gap: 13,
      opacity: resolved ? 0.55 : 1, transition: "opacity .3s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <Avatar name={req.who} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{req.who}</div>
          <div style={{ fontSize: 11.5, color: "var(--ink-3)", fontWeight: 500, textTransform: "capitalize" }}>{req.branch} centre</div>
        </div>
        <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", padding: "4px 9px", borderRadius: 99,
          color: isSwap ? "var(--v-prometric)" : "var(--warn)",
          background: isSwap ? "color-mix(in oklch, var(--v-prometric) 16%, transparent)" : "color-mix(in oklch, var(--warn) 16%, transparent)" }}>
          {req.type}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--ink-2)", fontWeight: 600 }}>
        <Icon name="calendar" size={14} style={{ color: "var(--ink-4)" }} />
        {P_WDL[d.getDay()]}, {P_MO[d.getMonth()]} {d.getDate()}
        {isSwap && <span style={{ color: "var(--ink-3)", fontWeight: 500 }}>· swap with <b style={{ color: "var(--ink)" }}>{req.with}</b></span>}
      </div>
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.5, fontStyle: "italic", fontFamily: "var(--font-serif)" }}>“{req.reason}”</p>
      {resolved ? (
        <div style={{ fontSize: 12, fontWeight: 700, color: resolved === "approve" ? "var(--ok)" : "var(--bad)", display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name={resolved === "approve" ? "check" : "x"} size={14} stroke={2.6} /> {resolved === "approve" ? "Approved" : "Declined"}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 9 }}>
          <button onClick={() => onResolve(req.id, "approve")} className="tap" style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none",
            cursor: "pointer", fontFamily: "var(--font)", fontSize: 13, fontWeight: 700, color: "var(--accent-ink)", background: "var(--accent)",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Icon name="check" size={15} stroke={2.6} /> Approve
          </button>
          <button onClick={() => onResolve(req.id, "decline")} className="tap glass-2" style={{ flex: 1, padding: "10px", borderRadius: 10,
            cursor: "pointer", fontFamily: "var(--font)", fontSize: 13, fontWeight: 700, color: "var(--ink-2)", border: "1px solid var(--hairline)",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Icon name="x" size={15} stroke={2.4} /> Decline
          </button>
        </div>
      )}
    </div>
  );
}

/* =====================================================================
   GOOGLE BUSINESS PAGE
   ===================================================================== */
const GB_REVIEWS = [
  { who: "Aiswarya Nair", when: "2 days ago", stars: 5, text: "Smooth check-in for my IELTS exam. Staff were calm and well organised, lockers were clean. Highly recommend this centre." },
  { who: "Mohammed Rashid", when: "5 days ago", stars: 5, text: "Took my CMA Part 1 here. Quiet hall, good systems, no technical issues at all. Reached early and parking was easy." },
  { who: "Liya George", when: "1 week ago", stars: 4, text: "Professional and punctual. Only feedback is the waiting area could use a few more chairs during peak slots." },
  { who: "Akhil Menon", when: "2 weeks ago", stars: 5, text: "Best test centre in Calicut. Booked my Pearson VUE exam and everything ran exactly on time." },
];
const GB_DIST = [ { s: 5, n: 182 }, { s: 4, n: 41 }, { s: 3, n: 9 }, { s: 2, n: 3 }, { s: 1, n: 2 } ];

function Stars({ n, size = 14 }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {[1,2,3,4,5].map((i) => (
        <Icon key={i} name="star" size={size} stroke={1.5}
          style={{ color: i <= n ? "var(--accent)" : "var(--ink-4)", fill: i <= n ? "var(--accent)" : "transparent" }} />
      ))}
    </span>
  );
}

function BusinessAnalysis({ total, avg, perf }) {
  const starColor = { 5: "var(--ok)", 4: "var(--v-celpip)", 3: "var(--warn)", 2: "var(--v-psi)", 1: "var(--bad)" };
  const distMax = Math.max(1, ...GB_DIST.map((r) => r.n));
  const months = [ { label: "Jan", n: 28 }, { label: "Feb", n: 33 }, { label: "Mar", n: 41 }, { label: "Apr", n: 37 }, { label: "May", n: 49 } ];
  const mMax = Math.max(...months.map((m) => m.n));
  const pos = GB_DIST.filter((r) => r.s >= 4).reduce((a, r) => a + r.n, 0);
  const neu = GB_DIST.filter((r) => r.s === 3).reduce((a, r) => a + r.n, 0);
  const neg = GB_DIST.filter((r) => r.s <= 2).reduce((a, r) => a + r.n, 0);
  const sentiment = [ { label: "Positive (4–5★)", color: "var(--ok)", n: pos }, { label: "Neutral (3★)", color: "var(--warn)", n: neu }, { label: "Negative (1–2★)", color: "var(--bad)", n: neg } ];
  const reach = perf.map((p) => ({ label: p.l.replace(" · 30d", ""), n: parseFloat(String(p.v).replace("k", "")) * (String(p.v).includes("k") ? 1000 : 1), color: p.t }));
  const reachMax = Math.max(...reach.map((r) => r.n));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "calc(20px * var(--density))", alignItems: "start" }} className="case-cols">
      <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <SectionLabel>Rating distribution</SectionLabel>
        <div className="glass" style={{ padding: "20px 22px", borderRadius: "var(--radius)", display: "flex", flexDirection: "column", gap: 13 }}>
          {GB_DIST.map((r) => <BarRow key={r.s} label={`${r.s} star`} n={r.n} max={distMax} color={starColor[r.s]} />)}
        </div>
        <SectionLabel>Monthly reviews</SectionLabel>
        <div className="glass" style={{ padding: "20px 22px", borderRadius: "var(--radius)", display: "flex", flexDirection: "column", gap: 13 }}>
          {months.map((m) => <BarRow key={m.label} label={m.label} n={m.n} max={mMax} color="var(--accent)" />)}
        </div>
        <SectionLabel>Reach · last 30 days</SectionLabel>
        <div className="glass" style={{ padding: "20px 22px", borderRadius: "var(--radius)", display: "flex", flexDirection: "column", gap: 13 }}>
          {reach.map((r) => <BarRow key={r.label} label={r.label} n={r.n} max={reachMax} color={r.color} />)}
        </div>
      </section>
      <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <SectionLabel>Sentiment</SectionLabel>
        <div className="glass" style={{ padding: 22, borderRadius: "var(--radius)" }}>
          <Donut segments={sentiment} total={total} centerLabel={avg} centerSub="avg rating" />
        </div>
        <SectionLabel>Reply rate</SectionLabel>
        <div className="glass" style={{ padding: 22, borderRadius: "var(--radius)" }}>
          <Donut segments={[ { label: "Replied", color: "var(--ok)", n: 86 }, { label: "Awaiting reply", color: "var(--ink-4)", n: 14 } ]} total={100} centerLabel="86%" centerSub="replied" />
        </div>
      </section>
    </div>
  );
}

function BusinessPage({ branch }) {
  const total = GB_DIST.reduce((a, x) => a + x.n, 0);
  const avg = (GB_DIST.reduce((a, x) => a + x.s * x.n, 0) / total).toFixed(1);
  const gap = "calc(30px * var(--density))";
  const info = [
    { icon: "mapPin", label: "Address", value: "2nd Floor, Cyber Tower, Calicut, Kerala 673016" },
    { icon: "phone", label: "Phone", value: "+91 495 248 0192" },
    { icon: "globe", label: "Website", value: "fets.live" },
    { icon: "clock", label: "Hours", value: "Open now · 8:00 AM – 7:00 PM" },
  ];
  const perf = [ { v: "4.2k", l: "Profile views · 30d", t: "var(--v-prometric)" }, { v: "318", l: "Calls · 30d", t: "var(--v-cma)" }, { v: "540", l: "Direction requests", t: "var(--v-ielts)" } ];
  const [view, setView] = React.useState("overview");

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", flexDirection: "column", gap }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <PageHeader eyebrow={`Business Profile // ${capBranch(branch)}`} title="Google" accentWord="Business" />
        <Segmented value={view} onChange={setView} options={[
          { value: "overview", label: "Overview", icon: "star" }, { value: "analysis", label: "Analysis", icon: "trend" },
        ]} />
      </div>

      {view === "analysis" && <BusinessAnalysis total={total} avg={avg} perf={perf} />}

      {view === "overview" && <React.Fragment>
      {/* rating + profile */}
      <section style={{ display: "grid", gridTemplateColumns: "minmax(260px,1fr) minmax(0,1.4fr)", gap: 16 }} className="gb-top">
        <div className="glass" style={{ padding: 24, borderRadius: "var(--radius)", display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="eyebrow" style={{ color: "var(--accent)" }}>Overall rating</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
            <span className="tabnum" style={{ fontSize: 64, fontWeight: 900, fontFamily: '"Archivo Expanded", var(--font)', letterSpacing: "-0.04em", color: "var(--ink)", lineHeight: 0.85 }}>{avg}</span>
            <div style={{ paddingBottom: 6 }}>
              <Stars n={Math.round(avg)} size={18} />
              <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 5 }}>{total} reviews</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {GB_DIST.map((r) => (
              <div key={r.s} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)", width: 10 }}>{r.s}</span>
                <Icon name="star" size={11} style={{ color: "var(--accent)", fill: "var(--accent)" }} />
                <span style={{ flex: 1, height: 7, borderRadius: 99, background: "var(--inset)", overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", width: `${(r.n/total)*100}%`, background: "var(--accent)", borderRadius: 99 }} />
                </span>
                <span className="tabnum mono" style={{ fontSize: 11, color: "var(--ink-4)", width: 28, textAlign: "right" }}>{r.n}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass" style={{ padding: 24, borderRadius: "var(--radius)", display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <span style={{ width: 48, height: 48, borderRadius: 13, display: "grid", placeItems: "center", background: "var(--accent)", color: "var(--accent-ink)",
              fontWeight: 900, fontSize: 26, fontFamily: '"Archivo Expanded", var(--font)' }}>F</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.02em" }}>FETS — {capBranch(branch === "global" ? "calicut" : branch)} Test Centre</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-3)", fontWeight: 600 }}>Exam centre · Educational testing service</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {info.map((r) => (
              <div key={r.label} className="inset" style={{ padding: "12px 13px", borderRadius: 11, display: "flex", gap: 11, alignItems: "flex-start" }}>
                <Icon name={r.icon} size={16} style={{ color: "var(--accent)", marginTop: 1, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div className="eyebrow" style={{ fontSize: 9, color: "var(--ink-4)" }}>{r.label}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", marginTop: 3, lineHeight: 1.35 }}>{r.value}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => toast("Post update composer", "message")} className="tap" style={{ display: "inline-flex", alignItems: "center", gap: 8,
              padding: "11px 18px", borderRadius: 11, border: "none", cursor: "pointer", fontFamily: "var(--font)", fontSize: 13, fontWeight: 700,
              color: "var(--accent-ink)", background: "var(--accent)" }}>
              <Icon name="plus" size={16} stroke={2.4} /> Post an update
            </button>
            <button onClick={() => toast("Opening profile on Google", "ext")} className="tap glass-2" style={{ display: "inline-flex", alignItems: "center", gap: 8,
              padding: "11px 18px", borderRadius: 11, cursor: "pointer", fontFamily: "var(--font)", fontSize: 13, fontWeight: 700, color: "var(--ink-2)", border: "1px solid var(--hairline)" }}>
              <Icon name="ext" size={15} /> View on Google
            </button>
          </div>
        </div>
      </section>

      {/* performance */}
      <section style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {perf.map((p) => <StatPill key={p.l} value={p.v} label={p.l} tone={p.t} />)}
      </section>

      {/* reviews */}
      <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <SectionLabel right={<span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>{GB_REVIEWS.length} recent</span>}>Latest reviews</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px,1fr))", gap: 12 }}>
          {GB_REVIEWS.map((rv, i) => (
            <div key={i} className="glass" style={{ padding: 18, borderRadius: "var(--radius)", display: "flex", flexDirection: "column", gap: 11 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <Avatar name={rv.who} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>{rv.who}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-4)", marginTop: 1 }}>{rv.when}</div>
                </div>
                <Stars n={rv.stars} />
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55, fontFamily: "var(--font-serif)" }}>“{rv.text}”</p>
              <button onClick={() => toast(`Replying to ${rv.who}`, "message")} className="tap" style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 7,
                background: "transparent", border: "none", cursor: "pointer", fontFamily: "var(--font)", fontSize: 12, fontWeight: 700, color: "var(--accent)", padding: 0 }}>
                <Icon name="message" size={14} /> Reply
              </button>
            </div>
          ))}
        </div>
      </section>
      </React.Fragment>}
    </div>
  );
}

Object.assign(window, { SectionLabel, PageHeader, StatPill, BarRow, Donut, Stars, CalSessionCard, RequestCard, BusinessPage, capBranch, pfmt12, P_WD, P_WDL, P_MO });

/* ============================================================
   SOURCE: pages-schedule.jsx
   ============================================================ */
/* ============================================================
   FETS · LIVE — Calendar + Roster
   10-day windows · paging · month at-a-glance · day drawers
   ============================================================ */

const F = () => window.FETS;
const MOA = ["January","February","March","April","May","June","July","August","September","October","November","December"];

/* ---------- month context (from today to end of this month) ---------- */
function monthCtx() {
  const today = F().ISO(0);
  const y = today.getFullYear(), m = today.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const totalDays = daysInMonth - today.getDate() + 1;          // remaining incl. today
  const firstWeekday = new Date(y, m, 1).getDay();
  return { today, y, m, daysInMonth, totalDays, firstWeekday, monthName: MOA[m] };
}

/* ---------- 10-day sliding window over the rest of the month ---------- */
/* ---------- month context for an arbitrary month (offset from current) ---------- */
function monthInfo(monthOffset) {
  const today = F().ISO(0);
  const base = new Date(today.getFullYear(), today.getMonth() + (monthOffset || 0), 1);
  const y = base.getFullYear(), m = base.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const firstWeekday = new Date(y, m, 1).getDay();
  return { today, y, m, daysInMonth, firstWeekday, monthName: MOA[m] };
}

/* ---------- sliding window: starts at the 1st of the current month, pages freely (past & future) ---------- */
function useWindow(size) {
  const today = F().ISO(0);
  const firstOffset = F().offsetOf(new Date(today.getFullYear(), today.getMonth(), 1));
  const [start, setStart] = React.useState(firstOffset);
  const offsets = [];
  for (let o = start; o < start + size; o++) offsets.push(o);
  return {
    offsets, start,
    canPrev: true, canNext: true,
    prev: () => setStart((v) => v - size),
    next: () => setStart((v) => v + size),
    reset: () => setStart(firstOffset),
  };
}

function useMonthWindow() {
  const today = F().ISO(0);
  const [monthOffset, setMonthOffset] = React.useState(0);

  const targetDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const y = targetDate.getFullYear();
  const m = targetDate.getMonth();

  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const offsets = [];
  for (let d = 1; d <= daysInMonth; d++) {
    offsets.push(F().offsetOf(new Date(y, m, d)));
  }

  return {
    offsets,
    monthOffset,
    monthName: MOA[m],
    year: y,
    canPrev: true,
    canNext: true,
    prev: () => setMonthOffset((v) => v - 1),
    next: () => setMonthOffset((v) => v + 1),
    reset: () => setMonthOffset(0),
  };
}

function rangeLabel(offsets) {
  if (!offsets.length) return "";
  const a = F().ISO(offsets[0]);
  const mo = window.P_MO;
  if (offsets.length === 1) {
    return `${a.getDate()} ${mo[a.getMonth()]} ${a.getFullYear()}`;
  }
  const b = F().ISO(offsets[offsets.length - 1]);
  return a.getMonth() === b.getMonth()
    ? `${mo[a.getMonth()]} ${a.getDate()} – ${b.getDate()}`
    : `${mo[a.getMonth()]} ${a.getDate()} – ${mo[b.getMonth()]} ${b.getDate()}`;
}

/* ---------- prev / next pager ---------- */
function RangeNav({ win, unit = "days" }) {
  const isMonth = unit === "month";
  const isWeek = win.offsets.length === 7;
  const isDay = win.offsets.length === 1;
  const navLabel = isMonth ? "Next Month" : isWeek ? "Next Week" : isDay ? "Next Day" : `Next ${win.offsets.length}`;
  const prevTitle = isMonth ? "Previous Month" : isWeek ? "Previous Week" : isDay ? "Previous Day" : "Earlier";
  const nextTitle = isMonth ? "Next Month" : isWeek ? "Next Week" : isDay ? "Next Day" : `Next ${win.offsets.length}`;

  const Btn = ({ dir, on, can }) => (
    <button onClick={on} disabled={!can} title={dir === "prev" ? prevTitle : nextTitle} className="tap glass-2"
      style={{ width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", flexShrink: 0,
        cursor: can ? "pointer" : "not-allowed", opacity: can ? 1 : 0.34,
        color: can ? "var(--ink)" : "var(--ink-4)", border: "1px solid var(--hairline)" }}>
      <Icon name="chevronR" size={18} stroke={2.4} style={{ transform: dir === "prev" ? "rotate(180deg)" : "none" }} />
    </button>
  );
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <Btn dir="prev" on={win.prev} can={win.canPrev} />
      {isMonth ? (
        <button onClick={win.reset} className="tap glass-2" title="Reset to current month"
          style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 38, padding: "0 14px", borderRadius: 11,
            cursor: "pointer", border: "1px solid var(--hairline)",
            fontFamily: "var(--font)", fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)", background: "transparent" }}>
          Today
        </button>
      ) : (
        <button onClick={win.next} disabled={!win.canNext} className="tap" title={nextTitle}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 38, padding: "0 14px", borderRadius: 11,
            cursor: win.canNext ? "pointer" : "not-allowed", opacity: win.canNext ? 1 : 0.34, border: "none",
            fontFamily: "var(--font)", fontSize: 12.5, fontWeight: 700, color: "var(--accent-ink)", background: "var(--accent)" }}>
          {navLabel} <Icon name="arrowR" size={15} stroke={2.4} />
        </button>
      )}
      <Btn dir="next" on={win.next} can={win.canNext} />
    </div>
  );
}


/* ---------- analysis over a set of day-offsets ---------- */
function windowStats(offsets, branch) {
  let sess = 0, cand = 0; const vendors = new Set(); let busiest = { label: "—", n: 0 };
  offsets.forEach((o) => {
    const ss = window.branchSessions(o, branch);
    sess += ss.length;
    const dc = ss.reduce((a, x) => a + x.count, 0);
    cand += dc; ss.forEach((s) => vendors.add(s.vendor));
    if (dc > busiest.n) { const d = F().ISO(o); busiest = { label: `${window.P_WD[d.getDay()]} ${d.getDate()}`, n: dc }; }
  });
  return { sess, cand, vendors: vendors.size, busiest };
}

/* =====================================================================
   MONTH AT-A-GLANCE GRID (shared) — renderCell(date, isToday, isPast)
   ===================================================================== */
function MonthGrid({ onPick, renderCell, monthOffset }) {
  const { y, m, daysInMonth, firstWeekday, today } = monthInfo(monthOffset);
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  return (
    <div className="glass month-grid-container" style={{ padding: "20px 20px 24px", borderRadius: "var(--radius)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 10, marginBottom: 14 }}>
        {window.P_WD.map((w, i) => (
          <div key={i} className="eyebrow" style={{ textAlign: "center", fontSize: 10,
            color: i === 0 || i === 6 ? "var(--ink-4)" : "var(--ink-3)", fontWeight: 800 }}>{w}</div>
        ))}
      </div>
      <div className="month-grid" style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 10 }}>
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const isToday = sameDay(date, today);
          const isPast = date < today && !isToday;
          return (
            <button key={i} onClick={() => onPick(date)} className={`tap month-day-cell ${isToday ? "today" : ""} ${isPast ? "past" : ""}`}
              style={{ opacity: isPast ? 0.66 : 1 }}>
              <span className="month-day-number">{date.getDate()}</span>
              {renderCell(date, isToday, isPast)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- day-detail drawer body (sessions + roster) ---------- */
/* ---- session overrides: add / edit / delete exam sessions on a day ---- */
const SESS_OVR_KEY = "fets-sess-ovr-1";
const sessKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const sessSig = (s) => `${s.vendor}|${s.exam}|${s.start}`;
function sessOvrAll() { try { return JSON.parse(localStorage.getItem(SESS_OVR_KEY)) || {}; } catch (e) { return {}; } }
function sessOvrDay(d) { return sessOvrAll()[sessKey(d)] || { del: [], edit: {}, add: [] }; }
function sessOvrSet(d, day) {
  const all = sessOvrAll(); all[sessKey(d)] = day;
  localStorage.setItem(SESS_OVR_KEY, JSON.stringify(all));
  window.dispatchEvent(new Event("fets-sess-changed"));
}
(function patchSessions() {
  const f = window.FETS; if (!f || f._sessPatched) return;
  f.sessionsOn = function (d, branch) {
    let list;
    const live = f._liveSessions && f._liveSessions[sessKey(d)];
    if (live) list = branch === "global" ? live : live.filter((s) => s.branch === branch);
    else list = [];
    const day = sessOvrAll()[sessKey(d)];
    if (!day) return list;
    list = list.filter((s) => !(day.del || []).includes(sessSig(s)))
               .map((s) => { const e = (day.edit || {})[sessSig(s)]; return e ? { ...s, ...e } : s; });
    (day.add || []).forEach((s) => { if (branch === "global" || s.branch === branch) list = list.concat(s); });
    return list;
  };
  f._sessPatched = true;
})();

function SessionEditRow({ s, vendors, onSave, onCancel }) {
  const isNew = !s;
  const [vendor, setVendor] = React.useState(s ? s.vendor : (vendors[0] && vendors[0].slug));
  const [exam, setExam] = React.useState(s ? s.exam : "");
  const [count, setCount] = React.useState(s ? s.count : 8);
  const [start, setStart] = React.useState(s ? s.start : "09:00");
  const inp = { background: "var(--inset)", border: "1px solid var(--hairline)", borderRadius: 8, color: "var(--ink)", fontFamily: "var(--font)", fontSize: 13, padding: "7px 9px", width: "100%" };
  return (
    <div className="inset" style={{ padding: 12, borderRadius: 12, display: "flex", flexDirection: "column", gap: 9 }}>
      {isNew && (
        <select value={vendor} onChange={(e) => setVendor(e.target.value)} style={inp}>
          {vendors.map((v) => <option key={v.slug} value={v.slug}>{v.name}</option>)}
        </select>
      )}
      {isNew && <input placeholder="Exam name" value={exam} onChange={(e) => setExam(e.target.value)} style={inp} />}
      <div style={{ display: "flex", gap: 9 }}>
        <label style={{ flex: 1, fontSize: 11, color: "var(--ink-3)" }}>Start<input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={{ ...inp, marginTop: 3 }} /></label>
        <label style={{ flex: 1, fontSize: 11, color: "var(--ink-3)" }}>Candidates<input type="number" min="0" value={count} onChange={(e) => setCount(+e.target.value)} style={{ ...inp, marginTop: 3 }} /></label>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel} className="tap glass-2" style={{ padding: "7px 13px", borderRadius: 9, cursor: "pointer", fontSize: 12.5, fontWeight: 650, color: "var(--ink-2)", border: "1px solid var(--hairline)" }}>Cancel</button>
        <button onClick={() => onSave(isNew ? { vendor, exam: exam || "New session", count: +count || 0, start, end: start } : { count: +count || 0, start })}
          className="tap" style={{ padding: "7px 14px", borderRadius: 9, cursor: "pointer", fontSize: 12.5, fontWeight: 750, color: "var(--accent-ink)", background: "var(--accent)", border: "none" }}>
          {isNew ? "Add" : "Save"}
        </button>
      </div>
    </div>
  );
}

function DayDetailPanel({ date, branch }) {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    const h = () => force();
    window.addEventListener("fets-sess-changed", h);
    return () => window.removeEventListener("fets-sess-changed", h);
  }, []);
  const sessions = F().sessionsOn(date, branch).slice().sort((a, b) => a.start.localeCompare(b.start));
  const roster = F().rosterOn(date, branch);
  const total = sessions.reduce((a, x) => a + x.count, 0);
  const showBranch = branch === "global";
  const dayBranch = branch === "global" ? "calicut" : branch;
  const [editing, setEditing] = React.useState(null); // sig string | "__new" | null

  const isSuperAdmin = !!window.FETS?.isAdmin;
  const userProfileBranch = window.FETS?._meBranch || 'cochin';
  const isLocked = !isSuperAdmin && branch !== userProfileBranch;

  const liveKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const delSession = (s) => {
    if (isLocked) return;
    if (!window.confirm("Delete this exam session?")) return;
    if (window.FETS._liveSessions && window.FETS._liveSessions[liveKey] && s.id != null) {
      window.FETS._liveSessions[liveKey] = window.FETS._liveSessions[liveKey].filter((x) => x !== s && x.id !== s.id);
      DB.dbDeleteSession(s.id);
      window.dispatchEvent(new Event("fets-sess-changed"));
      return;
    }
    const day = sessOvrDay(date);
    if ((day.add || []).some((a) => sessSig(a) === sessSig(s))) day.add = day.add.filter((a) => sessSig(a) !== sessSig(s));
    else day.del = [...(day.del || []), sessSig(s)];
    if (day.edit) delete day.edit[sessSig(s)];
    sessOvrSet(date, day);
  };
  const saveEdit = (s, patch) => {
    if (isLocked) return;
    if (window.FETS._liveSessions && s.id != null) {
      Object.assign(s, patch);
      DB.dbUpdateSession(s.id, patch);
      window.dispatchEvent(new Event("fets-sess-changed")); setEditing(null);
      return;
    }
    const day = sessOvrDay(date);
    const added = (day.add || []).find((a) => sessSig(a) === sessSig(s));
    if (added) Object.assign(added, patch);
    else day.edit = { ...(day.edit || {}), [sessSig(s)]: { ...((day.edit || {})[sessSig(s)]), ...patch } };
    sessOvrSet(date, day); setEditing(null);
  };
  const addSession = (s) => {
    if (isLocked) return;
    if (window.FETS._liveSessions) {
      const entry = { id: undefined, vendor: s.vendor, exam: s.exam, count: s.count, start: s.start, end: s.end || s.start, branch: dayBranch };
      (window.FETS._liveSessions[liveKey] ||= []).push(entry);
      window.dispatchEvent(new Event("fets-sess-changed")); setEditing(null);
      DB.dbAddSession(date, s, dayBranch).then((row) => { if (row && row.id != null) entry.id = row.id; });
      return;
    }
    const day = sessOvrDay(date);
    day.add = [...(day.add || []), { ...s, branch: dayBranch }];
    sessOvrSet(date, day); setEditing(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10 }}>
        <StatPill value={sessions.length} label="Exam sessions" />
        <StatPill value={total} label="Candidates" tone="var(--v-prometric)" />
        <StatPill value={roster.length} label="Staff rostered" tone="var(--v-cma)" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SectionLabel right={
          !isLocked ? (
            <button onClick={() => setEditing("__new")} className="tap" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 8, cursor: "pointer", fontSize: 11.5, fontWeight: 700, color: "var(--accent-ink)", background: "var(--accent)", border: "none" }}>
              <Icon name="plus" size={13} /> Add session
            </button>
          ) : (
            <span style={{ fontSize: 11, color: "var(--ink-4)", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Icon name="lock" size={11} /> Read-only
            </span>
          )
        }>Sessions</SectionLabel>
        {editing === "__new" && <SessionEditRow vendors={F().VENDORS} onSave={addSession} onCancel={() => setEditing(null)} />}
        {sessions.length === 0 && editing !== "__new"
          ? <div className="inset" style={{ padding: 18, borderRadius: 12, textAlign: "center", fontSize: 12.5, color: "var(--ink-4)", fontStyle: "italic" }}>No exams scheduled this day.</div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sessions.map((s, i) => (
                editing === sessSig(s)
                  ? <SessionEditRow key={i} s={s} vendors={F().VENDORS} onSave={(patch) => saveEdit(s, patch)} onCancel={() => setEditing(null)} />
                  : <div key={i} style={{ display: "flex", alignItems: "stretch", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}><CalSessionCard s={s} showBranch={showBranch} /></div>
                      {!isLocked && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <button onClick={() => setEditing(sessSig(s))} title="Edit" className="tap glass-2" style={{ width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center", cursor: "pointer", color: "var(--ink-2)", border: "1px solid var(--hairline)" }}><Icon name="settings" size={15} /></button>
                          <button onClick={() => delSession(s)} title="Delete" className="tap glass-2" style={{ width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center", cursor: "pointer", color: "var(--bad)", border: "1px solid var(--hairline)" }}><Icon name="trash" size={15} /></button>
                        </div>
                      )}
                    </div>
              ))}
            </div>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SectionLabel>On roster</SectionLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {roster.length === 0
            ? <span style={{ fontSize: 12.5, color: "var(--ink-4)", fontStyle: "italic" }}>No staff rostered.</span>
            : roster.map((n) => (
              <span key={n} className="glass-2" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 11px 6px 6px", borderRadius: 999 }}>
                <Avatar name={n} size={24} /><span style={{ fontSize: 12.5, fontWeight: 650, color: "var(--ink)" }}>{n}</span>
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
   CALENDAR PAGE
   ===================================================================== */
function CalendarStrip({ offsets, branch, onPick }) {
  const showBranch = branch === "global";
  const isSuperAdmin = !!window.FETS?.isAdmin;
  const userProfileBranch = window.FETS?._meBranch || 'cochin';
  const isLocked = !isSuperAdmin && branch !== userProfileBranch;

  return (
    <div className="scroll-soft" style={{ overflowX: "auto", paddingBottom: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${offsets.length}, minmax(172px,1fr))`, gap: 12, minWidth: offsets.length * 176 }}>
        {offsets.map((o, idx) => {
          const d = F().ISO(o), isToday = o === 0;
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          const sessions = window.branchSessions(o, branch).slice().sort((a, b) => a.start.localeCompare(b.start));
          const total = sessions.reduce((s, x) => s + x.count, 0);
          return (
            <div key={o} onClick={() => onPick && onPick(d)} className="cal-col rise" style={{ display: "flex", flexDirection: "column", gap: 10, padding: 10, borderRadius: 16, minHeight: 180,
              cursor: onPick ? "pointer" : "default", animationDelay: `${idx * 35}ms`,
              background: isToday ? "color-mix(in oklch, var(--branch) 12%, var(--glass))" : "var(--glass)",
              border: "1px solid " + (isToday ? "color-mix(in oklch, var(--branch) 45%, transparent)" : "var(--glass-edge)"),
              boxShadow: isToday ? "0 10px 28px color-mix(in oklch, var(--branch) 16%, transparent), var(--shadow)" : "var(--shadow)" }}>
              {/* day header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingBottom: 9, borderBottom: "1px solid var(--hairline)" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span className="tabnum" style={{ fontSize: 27, fontWeight: 800, fontFamily: '"Archivo Expanded", var(--font)', letterSpacing: "-0.03em", lineHeight: 1, color: isToday ? "var(--branch)" : "var(--ink)" }}>{d.getDate()}</span>
                  <span className="eyebrow" style={{ fontSize: 9.5, color: isToday ? "var(--branch)" : (isWeekend ? "var(--ink-4)" : "var(--ink-3)"), letterSpacing: "0.12em" }}>{window.P_WD[d.getDay()]}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {isToday
                    ? <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 999, color: "var(--accent-ink)", background: "var(--branch)" }}>Today</span>
                    : total > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 999, flexShrink: 0, background: "var(--inset)", color: "var(--ink-3)" }} title={`${total} candidates`}>
                        <Icon name="users" size={12} stroke={2.2} /><span className="tabnum mono" style={{ fontSize: 11.5, fontWeight: 700 }}>{total}</span>
                      </span>}
                  {onPick && !isLocked && <button onClick={() => onPick(d)} title="Add / edit sessions" className="tap" style={{ width: 24, height: 24, borderRadius: 7, display: "grid", placeItems: "center", border: "1px solid var(--hairline)", background: "var(--inset)", color: "var(--ink-3)", cursor: "pointer", flexShrink: 0 }}><Icon name="plus" size={13} /></button>}
                </div>
              </div>
              {isToday && total > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: -3, fontSize: 11, fontWeight: 600, color: "var(--branch)" }}>
                  <Icon name="users" size={12} stroke={2.2} /><span className="tabnum mono" style={{ fontWeight: 700 }}>{total}</span> candidates booked
                </div>
              )}
              {/* sessions */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sessions.length === 0
                  ? <div style={{ padding: "18px 12px", borderRadius: 11, textAlign: "center", fontSize: 11, color: "var(--ink-4)", fontWeight: 500, border: "1px dashed var(--hairline)" }}>No exams</div>
                  : sessions.map((s, i) => <CalSessionCard key={i} s={s} showBranch={showBranch} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarAgenda({ offsets, branch }) {
  const showBranch = branch === "global";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {offsets.map((o, idx) => {
        const d = F().ISO(o), isToday = o === 0;
        const sessions = window.branchSessions(o, branch).slice().sort((a, b) => a.start.localeCompare(b.start));
        const total = sessions.reduce((s, x) => s + x.count, 0);
        return (
          <div key={o} className="glass rise" style={{ padding: 16, borderRadius: "var(--radius)", display: "grid",
            gridTemplateColumns: "120px 1fr", gap: 18, animationDelay: `${idx * 30}ms`,
            borderColor: isToday ? "var(--accent-line)" : "var(--glass-edge)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, borderRight: "1px solid var(--hairline)", paddingRight: 12 }}>
              <div className="eyebrow" style={{ color: isToday ? "var(--accent)" : "var(--ink-4)" }}>{isToday ? "Today" : window.P_WDL[d.getDay()]}</div>
              <div className="tabnum" style={{ fontSize: 30, fontWeight: 800, fontFamily: '"Archivo Expanded", var(--font)', letterSpacing: "-0.03em", color: "var(--ink)", lineHeight: 1 }}>{d.getDate()}</div>
              <div style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600 }}>{window.P_MO[d.getMonth()]} {d.getFullYear()}</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 4 }}>{total} candidates</div>
            </div>
            <div style={{ display: sessions.length ? "grid" : "block", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: 9 }}>
              {sessions.length === 0
                ? <div style={{ fontSize: 13, color: "var(--ink-4)", fontStyle: "italic", paddingTop: 6 }}>No exams scheduled</div>
                : sessions.map((s, i) => <CalSessionCard key={i} s={s} showBranch={showBranch} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- calendar analysis ---------- */
function CalendarAnalysis({ offsets, branch }) {
  const vend = {}; const centre = { calicut: 0, cochin: 0 }; const days = [];
  offsets.forEach((o) => {
    const ss = window.branchSessions(o, branch); const d = F().ISO(o); let dc = 0;
    ss.forEach((s) => {
      vend[s.vendor] = vend[s.vendor] || { sess: 0, cand: 0 };
      vend[s.vendor].sess++; vend[s.vendor].cand += s.count; dc += s.count;
      if (s.branch in centre) centre[s.branch] += s.count;
    });
    days.push({ label: `${window.P_WD[d.getDay()]} ${d.getDate()}`, n: dc });
  });
  const vendRows = Object.entries(vend).sort((a, b) => b[1].cand - a[1].cand);
  const candMax = Math.max(1, ...vendRows.map((r) => r[1].cand));
  const sessSeg = vendRows.map(([slug, x]) => ({ label: window.VENDOR_BY_SLUG[slug].name, color: window.VENDOR_BY_SLUG[slug].color, n: x.sess }));
  const totalSess = sessSeg.reduce((a, s) => a + s.n, 0);
  const topDays = days.filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 6);
  const dayMax = Math.max(1, ...topDays.map((x) => x.n));
  const branchMax = Math.max(1, centre.calicut, centre.cochin);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "calc(20px * var(--density))", alignItems: "start" }} className="case-cols">
      <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <SectionLabel>Candidates by vendor</SectionLabel>
        <div className="glass" style={{ padding: "20px 22px", borderRadius: "var(--radius)", display: "flex", flexDirection: "column", gap: 13 }}>
          {vendRows.length ? vendRows.map(([slug, x]) => <BarRow key={slug} label={window.VENDOR_BY_SLUG[slug].name} n={x.cand} max={candMax} color={window.VENDOR_BY_SLUG[slug].color} />)
            : <div style={{ fontSize: 13, color: "var(--ink-4)", fontStyle: "italic" }}>No sessions in range.</div>}
        </div>
        {branch === "global" && <React.Fragment>
          <SectionLabel>Candidates by centre</SectionLabel>
          <div className="glass" style={{ padding: "20px 22px", borderRadius: "var(--radius)", display: "flex", flexDirection: "column", gap: 13 }}>
            <BarRow label="Calicut" n={centre.calicut} max={branchMax} color="var(--accent)" />
            <BarRow label="Cochin" n={centre.cochin} max={branchMax} color="var(--v-prometric)" />
          </div>
        </React.Fragment>}
        <SectionLabel>Busiest days</SectionLabel>
        <div className="glass" style={{ padding: "20px 22px", borderRadius: "var(--radius)", display: "flex", flexDirection: "column", gap: 13 }}>
          {topDays.length ? topDays.map((x) => <BarRow key={x.label} label={x.label} n={x.n} max={dayMax} color="var(--v-ielts)" />)
            : <div style={{ fontSize: 13, color: "var(--ink-4)", fontStyle: "italic" }}>No candidates booked.</div>}
        </div>
      </section>
      <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <SectionLabel>Sessions by vendor</SectionLabel>
        <div className="glass" style={{ padding: 22, borderRadius: "var(--radius)" }}>
          <Donut segments={sessSeg} total={totalSess} centerLabel={totalSess} centerSub="sessions" />
        </div>
      </section>
    </div>
  );
}

/* loads the live data for whatever months are on screen, and re-renders when it arrives */
function useLiveSync(dates) {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    const h = () => force();
    window.addEventListener("fets-data-loaded", h);
    return () => window.removeEventListener("fets-data-loaded", h);
  }, []);
  const key = dates.map((d) => `${d.getFullYear()}-${d.getMonth()}`).join("|");
  React.useEffect(() => {
    const seen = {};
    dates.forEach((d) => { const k = `${d.getFullYear()}-${d.getMonth()}`; if (!seen[k]) { seen[k] = 1; ensureMonth(d); } });
  }, [key]);
}

/* centered day editor (sessions add/edit/delete + roster) */
function DayModal({ date, branch, onClose }) {
  React.useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  return (
    <React.Fragment>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "oklch(0.12 0.02 182 / 0.62)", backdropFilter: "blur(4px)", zIndex: 130 }} />
      <div role="dialog" className="glass rise" style={{ position: "fixed", zIndex: 131, top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "min(680px, 94vw)", maxHeight: "86vh", overflowY: "auto", borderRadius: "var(--radius)", padding: 22, boxShadow: "var(--shadow-lift)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, display: "grid", placeItems: "center", color: "var(--accent)", background: "var(--accent-soft)", border: "1px solid var(--accent-line)", flexShrink: 0 }}><Icon name="calendar" size={21} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 720, color: "var(--ink)" }}>{window.P_WDL[date.getDay()]}, {window.P_MO[date.getMonth()]} {date.getDate()}</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--ink-3)" }}>{capBranch(branch)} · day detail</p>
          </div>
          <button onClick={onClose} className="tap glass-2" style={{ width: 38, height: 38, borderRadius: 999, display: "grid", placeItems: "center", cursor: "pointer", color: "var(--ink-2)", border: "1px solid var(--hairline)", flexShrink: 0 }}><Icon name="x" size={18} /></button>
        </div>
        <DayDetailPanel date={date} branch={branch} />
      </div>
    </React.Fragment>
  );
}

function CalendarPage({ branch }) {
  const [view, setView] = React.useState("month");   // Default to Month (30 days) view
  const winSize = view === "days" ? 7 : (view === "agenda" ? 1 : 7);
  const win = useWindow(winSize);
  const [dayDrawer, setDayDrawer] = React.useState(null);
  const [monthOff, setMonthOff] = React.useState(0);
  const mi = monthInfo(monthOff);
  const mc = monthCtx();
  const monthOffsets = Array.from({ length: mc.totalDays }, (_, i) => i);
  const winS = windowStats(view === "analysis" ? monthOffsets : win.offsets, branch);
  const gap = "calc(28px * var(--density))";
  useLiveSync(view === "month" ? [new Date(mi.y, mi.m, 1)] : win.offsets.map((o) => F().ISO(o)));

  return (
    <div className="fets-calendar-mint" style={{ maxWidth: 1180, margin: "0 auto", display: "flex", flexDirection: "column", gap }}>
      <PageHeader eyebrow={`Exam Schedule // ${capBranch(branch)}`} title="Calendar" />

      <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* control bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span style={{ width: 22, height: 2, background: "var(--accent)", borderRadius: 99 }} />
            {view === "month" ? (
              <React.Fragment>
                <button onClick={() => setMonthOff((v) => v - 1)} className="tap glass-2" title="Previous month" style={{ width: 32, height: 32, borderRadius: 9, display: "grid", placeItems: "center", cursor: "pointer", color: "var(--ink-2)", border: "1px solid var(--hairline)" }}><Icon name="chevronR" size={16} style={{ transform: "rotate(180deg)" }} /></button>
                <span className="eyebrow" style={{ minWidth: 116, textAlign: "center" }}>{mi.monthName} {mi.y}</span>
                <button onClick={() => setMonthOff((v) => v + 1)} className="tap glass-2" title="Next month" style={{ width: 32, height: 32, borderRadius: 9, display: "grid", placeItems: "center", cursor: "pointer", color: "var(--ink-2)", border: "1px solid var(--hairline)" }}><Icon name="chevronR" size={16} /></button>
                {monthOff !== 0 && <button onClick={() => setMonthOff(0)} className="tap" style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "transparent", border: "none", cursor: "pointer" }}>This month</button>}
              </React.Fragment>
            ) : <span className="eyebrow">{view === "analysis" ? `${mc.monthName} ${mc.y}` : rangeLabel(win.offsets)}</span>}
          </div>
          <div style={{ flex: 1 }} />
          <Segmented value={view} onChange={setView} size="sm" options={[
            { value: "month", label: "Month" }, { value: "agenda", label: "Day" }, { value: "days", label: "Week" }, { value: "analysis", label: "Overview" },
          ]} />
          {(view === "days" || view === "agenda") && <RangeNav win={win} />}
        </div>

        {/* vendor legend */}
        {view !== "analysis" && (
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {F().VENDORS.map((v) => (
              <span key={v.slug} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: "var(--ink-3)" }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: v.color }} /> {v.name}
              </span>
            ))}
          </div>
        )}

        {view === "days" && <CalendarStrip offsets={win.offsets} branch={branch} onPick={(dd) => setDayDrawer(dd)} />}
        {view === "agenda" && <CalendarAgenda offsets={win.offsets} branch={branch} />}
        {view === "analysis" && (
          <React.Fragment>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <StatPill value={winS.sess} label="Sessions this month" />
              <StatPill value={winS.cand} label="Candidates booked" tone="var(--v-prometric)" />
              <StatPill value={winS.vendors} label="Active vendors" tone="var(--v-cma)" />
              <StatPill value={winS.busiest.n} unit={`· ${winS.busiest.label}`} label="Busiest day" tone="var(--v-ielts)" />
            </div>
            <CalendarAnalysis offsets={monthOffsets} branch={branch} />
          </React.Fragment>
        )}
        {view === "month" && (
          <MonthGrid monthOffset={monthOff} onPick={(d) => setDayDrawer(d)} renderCell={(date) => {
            const ss = F().sessionsOn(date, branch);
            if (!ss.length) return null;
            const total = ss.reduce((a, x) => a + x.count, 0);
            return (
              <React.Fragment>
                <div className="month-day-cell-sessions" style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4, minWidth: 0, width: "100%" }}>
                  {ss.slice(0, 4).map((s, i) => (
                    <div key={i} className="month-day-session-badge" style={{ display: "flex", alignItems: "center", fontSize: 9.5, color: "var(--ink-2)", minWidth: 0, padding: "2px 6px", borderRadius: "5px", background: "var(--panel-2)", border: "1px solid var(--hairline)" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: window.VENDOR_BY_SLUG[s.vendor].color, flexShrink: 0 }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>{window.VENDOR_BY_SLUG[s.vendor].short}</span>
                      </span>
                      <span className="tabnum mono" style={{ marginLeft: "auto", fontWeight: 800, color: "var(--ink)" }}>{s.count}</span>
                    </div>
                  ))}
                  {ss.length > 4 && <span style={{ fontSize: 9, color: "var(--ink-4)", fontWeight: 700, paddingLeft: 4 }}>+{ss.length - 4} more</span>}
                </div>
                <div className="month-day-cell-footer" style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 4, paddingTop: 6, borderTop: "1px solid var(--hairline)", width: "100%" }}>
                  <Icon name="users" size={10} style={{ color: "var(--accent)" }} />
                  <span className="mono" style={{ fontSize: 10, fontWeight: 800, color: "var(--ink-3)" }}>{total} Candidates</span>
                  <span style={{ fontSize: 8.5, color: "var(--ink-4)", marginLeft: "auto", fontWeight: 700 }}>{ss.length} sess</span>
                </div>
              </React.Fragment>
            );
          }} />
        )}
      </section>

      {dayDrawer && <DayModal date={dayDrawer} branch={branch} onClose={() => setDayDrawer(null)} />}
    </div>
  );
}

/* =====================================================================
   ROSTER PAGE — 10-day coverage grid, month view, leave drawer
   ===================================================================== */
/* shift codes shown in every roster cell (OT is an add-on, not a base code) */
const ROSTER_CODES = {
  D:    { label: "Day shift",        color: "color-mix(in oklch, var(--accent) 38%, var(--panel-3))",       ink: "var(--accent)",      solid: true },
  E:    { label: "Evening shift",    color: "color-mix(in oklch, var(--v-prometric) 40%, var(--panel-3))",  ink: "var(--v-prometric)", solid: true },
  HD:   { label: "Half day",         color: "color-mix(in oklch, var(--warn) 40%, var(--panel-3))",         ink: "var(--warn)",        solid: true },
  RD:   { label: "Rest day",         color: "var(--panel-3)",                                               ink: "var(--ink-4)",       solid: false },
  PH:   { label: "Public holiday",   color: "color-mix(in oklch, var(--bad) 30%, var(--panel-3))",          ink: "var(--bad)",         solid: true },
  L:    { label: "Leave",            color: "color-mix(in oklch, var(--bad) 38%, var(--panel-3))",          ink: "var(--bad)",         solid: true },
  TOIL: { label: "TOIL Earned",      color: "color-mix(in oklch, var(--v-cma) 42%, var(--panel-3))",        ink: "var(--v-cma)",       solid: true },
  TR:   { label: "TOIL Redeemed",    color: "color-mix(in oklch, var(--v-ielts) 40%, var(--panel-3))",      ink: "var(--v-ielts)",     solid: true },
  TP:   { label: "Monthly TOIL Approved",    color: "color-mix(in oklch, var(--v-pearson) 40%, var(--panel-3))",    ink: "var(--v-pearson)",   solid: true },
  SW:   { label: "Shift swapped",    color: "color-mix(in oklch, var(--v-prometric) 50%, var(--panel-3))",  ink: "var(--v-prometric)", solid: true },
  TRD:  { label: "TOIL Rest Day",    color: "color-mix(in oklch, var(--v-cma) 20%, var(--panel-3))",        ink: "var(--v-cma)",       solid: true },
};
const RC_LIST = ["D", "E", "HD", "RD", "PH", "L", "TOIL", "TR", "TP", "SW", "TRD"];
const WORK_CODES = ["D", "E", "HD"];
const OT_COLOR = "var(--v-ielts)";

/* reflect an approved staff request onto the shared roster store */
function reflectOnRoster(r) {
  if (!r || r.status !== "Approved") return;
  let off;
  try { off = F().offsetOf(new Date(r.date)); } catch (e) { return; }
  if (off == null || isNaN(off)) return;
  if (r.kind === "leave") {
    F().rosterSet(r.who, off, { code: "L", ot: 0 });
  } else if (r.kind === "toil") {
    F().rosterSet(r.who, off, { code: "TR", ot: 0 });
  } else if (r.kind === "swap") {
    let swapOff;
    try { swapOff = F().offsetOf(new Date(r.swapDate || r.date)); } catch(e) {}
    if (swapOff != null && !isNaN(swapOff)) {
      const cellA = F().rosterGet(r.who)[off] || { code: "D", ot: 0 };
      const cellB = F().rosterGet(r.with)[swapOff] || { code: "D", ot: 0 };
      F().rosterSet(r.who, off, { code: cellB.code || "D", ot: cellB.ot || 0 });
      F().rosterSet(r.with, swapOff, { code: cellA.code || "D", ot: cellA.ot || 0 });
    }
  }
  window.dispatchEvent(new Event("fets-roster-changed"));
}
function initRosterCode(name, offset, onDuty) {
  if (onDuty) return ((name.charCodeAt(0) + name.length * 3 + offset) % 4) === 0 ? "E" : "D";
  return ((name.charCodeAt(0) + offset * 7) % 11) === 0 ? "L" : "RD";
}
const cellCode = (c) => (typeof c === "string" ? c : (c && c.code) || "RD");
const cellOT = (c) => (c && typeof c === "object" ? (+c.ot || 0) : 0);

function RosterLegend() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
      <span className="eyebrow" style={{ fontSize: 9.5, color: "var(--ink-4)" }}>Shift key</span>
      {RC_LIST.map((k) => {
        const m = ROSTER_CODES[k];
        return (
          <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--ink-3)", fontWeight: 600 }}>
            <span style={{ minWidth: 26, height: 20, padding: "0 6px", borderRadius: 6, display: "grid", placeItems: "center", fontSize: 10, fontWeight: 800, fontFamily: "var(--font)",
              color: m.ink, background: m.color, border: "1px solid var(--hairline)" }}>{k}</span>
            {m.label}
          </span>
        );
      })}
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--ink-3)", fontWeight: 600 }}>
        <span style={{ minWidth: 26, height: 20, padding: "0 6px", borderRadius: 6, display: "grid", placeItems: "center", fontSize: 10, fontWeight: 800, color: "#fff", background: OT_COLOR }}>+OT</span>
        Overtime (add-on)
      </span>
    </div>
  );
}

/* ---------- shift-picker popup (one cell) ---------- */
function RosterCellDialog({ ctx, onApply, onClose }) {
  const isRest = ctx.defaultCode === "RD";
  const [code, setCode] = React.useState(cellCode(ctx.cell));
  const [otOn, setOtOn] = React.useState(cellOT(ctx.cell) > 0);
  const [hours, setHours] = React.useState(cellOT(ctx.cell) || 2);
  React.useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, []);
  // any cell (including a rest day) can be set to any shift directly
  const effective = code;
  const otAllowed = WORK_CODES.includes(code);
  const save = () => onApply({ code: effective, ot: (otOn && otAllowed) ? (+hours || 1) : 0 });
  const d = ctx.date;

  return (
    <React.Fragment>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "color-mix(in oklch, var(--shadow-base, #000) 55%, transparent)", backdropFilter: "blur(3px)", zIndex: 120 }} />
      <div role="dialog" className="glass rise" style={{ position: "fixed", zIndex: 121, top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        width: "min(390px, 92vw)", maxHeight: "88vh", overflowY: "auto", borderRadius: "var(--radius)", padding: 20, boxShadow: "var(--shadow-lift)", display: "flex", flexDirection: "column", gap: 15 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar name={ctx.name} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 720, color: "var(--ink)", letterSpacing: "-0.01em" }}>{ctx.name}</div>
            <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>{window.P_WDL[d.getDay()]}, {window.P_MO[d.getMonth()]} {d.getDate()}{isRest ? " · rest day" : ""}</div>
          </div>
          <button onClick={onClose} className="tap glass-2" style={{ width: 34, height: 34, borderRadius: 999, display: "grid", placeItems: "center", cursor: "pointer", color: "var(--ink-2)", border: "1px solid var(--hairline)" }}><Icon name="x" size={16} /></button>
        </div>

        <div className="eyebrow" style={{ fontSize: 9, color: "var(--ink-4)" }}>Shift</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {RC_LIST.map((k) => {
            const m = ROSTER_CODES[k]; const on = code === k;
            return (
              <button key={k} onClick={() => setCode(k)} className="tap" style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 11px", borderRadius: 11, cursor: "pointer",
                textAlign: "left", fontFamily: "var(--font)", border: "1px solid " + (on ? "var(--accent-line)" : "var(--hairline)"), background: on ? "var(--accent-soft)" : "var(--inset)" }}>
                <span style={{ minWidth: 34, height: 28, padding: "0 7px", borderRadius: 8, display: "grid", placeItems: "center", flexShrink: 0, fontSize: 12, fontWeight: 800,
                  color: m.ink, background: m.color, border: "1px solid var(--hairline)" }}>{k}</span>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: on ? 700 : 600, color: on ? "var(--ink)" : "var(--ink-2)" }}>{m.label}</span>
                {on && <Icon name="check" size={16} stroke={2.6} style={{ color: "var(--accent)" }} />}
              </button>
            );
          })}
        </div>


        {/* OT add-on, clubbed with the shift */}
        <div className="inset" style={{ padding: "12px 14px", borderRadius: 12, display: "flex", flexDirection: "column", gap: otOn ? 11 : 0, opacity: otAllowed ? 1 : 0.45, pointerEvents: otAllowed ? "auto" : "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <span style={{ minWidth: 30, height: 22, padding: "0 6px", borderRadius: 6, display: "grid", placeItems: "center", fontSize: 10, fontWeight: 800, color: "#fff", background: OT_COLOR, flexShrink: 0 }}>OT</span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 650, color: "var(--ink-2)" }}>Add overtime <span style={{ color: "var(--ink-4)", fontWeight: 500 }}>(beyond 8+1h)</span></span>
            <button onClick={() => setOtOn((v) => !v)} className="tap" style={{ width: 44, height: 26, borderRadius: 999, border: "none", cursor: "pointer", flexShrink: 0, position: "relative", background: otOn ? OT_COLOR : "var(--panel-3)", transition: "background .2s" }}>
              <span style={{ position: "absolute", top: 3, left: otOn ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: "#fff", transition: "left .2s" }} />
            </button>
          </div>
          {otOn && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setHours((h) => Math.max(0.5, +(h - 0.5).toFixed(1)))} className="tap glass-2" style={{ width: 30, height: 30, borderRadius: 8, cursor: "pointer", border: "1px solid var(--hairline)", color: "var(--ink-2)", fontSize: 18, lineHeight: 1 }}>−</button>
              <span className="tabnum mono" style={{ minWidth: 46, textAlign: "center", fontSize: 16, fontWeight: 700, color: OT_COLOR }}>{hours}h</span>
              <button onClick={() => setHours((h) => +(h + 0.5).toFixed(1))} className="tap glass-2" style={{ width: 30, height: 30, borderRadius: 8, cursor: "pointer", border: "1px solid var(--hairline)", color: "var(--ink-2)", fontSize: 18, lineHeight: 1 }}>+</button>
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: "var(--ink-3)", fontWeight: 600 }}>
          <span>This cell:</span>
          <span style={{ minWidth: 34, height: 26, padding: "0 9px", borderRadius: 7, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 800,
            color: ROSTER_CODES[effective].ink, background: ROSTER_CODES[effective].color,
            boxShadow: (otOn && otAllowed) ? `inset 0 -3px 0 ${OT_COLOR}` : "none" }}>
            {(otOn && otAllowed) ? `${effective}+OT` : effective}{(otOn && otAllowed) ? <span style={{ fontSize: 9, opacity: 0.9 }}>{hours}h</span> : null}
          </span>
        </div>

        <div style={{ display: "flex", gap: 9 }}>
          <button onClick={save} className="tap" style={{ flex: 1, padding: "11px", borderRadius: 11, border: "none", cursor: "pointer", fontFamily: "var(--font)", fontSize: 13.5, fontWeight: 700, color: "var(--accent-ink)", background: "var(--accent)" }}>Save shift</button>
          <button onClick={() => onApply(null)} className="tap glass-2" title="Clear / delete this shift" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 15px", borderRadius: 11, cursor: "pointer", border: "1px solid var(--hairline)", fontFamily: "var(--font)", fontSize: 13.5, fontWeight: 650, color: "var(--bad)" }}><Icon name="trash" size={15} /> Clear</button>
        </div>
      </div>
    </React.Fragment>
  );
}

/* ---------- OT & TOIL Claim Dialog ---------- */
function OtToilClaimDialog({ ctx, onClose }) {
  const F = () => window.FETS;
  const d = ctx.date;
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  
  const staffName = ctx.name || F()._meName || (F().user && F().user.name);
  const profileId = F()._staffIdByName?.[staffName] || F()._meId;
  const rates = F()._staffRatesByProfileId?.[profileId] || { hourly_rate: 0, daily_rate: 0 };
  
  const existingClaim = F()._otClaims?.find(c => c.profile_id === profileId && c.date === dateStr);
  
  const cleanTime = (t) => {
    if (!t) return "";
    const parts = t.split(":");
    if (parts.length >= 2) {
      return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
    }
    return t;
  };
  
  const getNotesValue = () => {
    if (!existingClaim) return "";
    const nVal = existingClaim.notes || "";
    if (existingClaim.toil_payout && nVal.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(nVal);
        return parsed.user_notes || "";
      } catch (e) {
        return nVal;
      }
    }
    return nVal;
  };

  const initToilDates = () => {
    if (!existingClaim) return [];
    let list = existingClaim.toil_dates || [];
    if (typeof list === 'string') {
      try { list = JSON.parse(list); } catch (e) { list = []; }
    }
    if (list.length === 0 && existingClaim.notes && existingClaim.notes.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(existingClaim.notes);
        list = parsed.toil_dates || [];
      } catch (e) {}
    }
    return list;
  };

  const cellCodeVal = ctx.cell ? (typeof ctx.cell === "string" ? ctx.cell : ctx.cell.code) : "RD";
  const isToilClaim = ["PH", "RD", "TP", "TR"].includes(cellCodeVal) || (existingClaim && (existingClaim.toil_payout || initToilDates().length > 0));

  const [toilOption, setToilOption] = React.useState<"cash" | "rest">(() => {
    if (existingClaim) {
      if (existingClaim.toil_payout) return "cash";
      const dates = initToilDates();
      if (dates.length > 0) return "rest";
    }
    return "cash";
  });

  const [targetRestDate, setTargetRestDate] = React.useState(() => {
    const dates = initToilDates();
    return dates[0] || "";
  });

  const [startTime, setStartTime] = React.useState(existingClaim ? cleanTime(existingClaim.start_time) : "17:00");
  const [endTime, setEndTime] = React.useState(existingClaim ? cleanTime(existingClaim.end_time) : "");
  const [otHours, setOtHours] = React.useState(existingClaim ? existingClaim.ot_hours : 0);
  const [notes, setNotes] = React.useState(getNotesValue);
  const [status, setStatus] = React.useState(existingClaim ? existingClaim.status : "pending");
  const [loading, setLoading] = React.useState(false);
  
  React.useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, []);
  
  React.useEffect(() => {
    if (isToilClaim) {
      setOtHours(0);
      return;
    }
    if (!startTime || !endTime) {
      setOtHours(0);
      return;
    }
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff < 0) diff += 24 * 60;
    const hrs = Math.max(0, +(diff / 60).toFixed(2));
    setOtHours(hrs);
  }, [startTime, endTime, isToilClaim]);
  
  const handleSave = async () => {
    if (!profileId) {
      alert("Error: Profile not found. Cannot submit claim.");
      return;
    }
    if (isToilClaim) {
      if (toilOption === "rest" && !targetRestDate) {
        alert("Please select another day to take your rest day.");
        return;
      }
    } else {
      if (otHours <= 0) {
        alert("Please enter a valid duty finish time to calculate OT hours.");
        return;
      }
    }
    
    setLoading(true);
    
    const formatTimeForDb = (t) => {
      if (!t) return null;
      const parts = t.split(":");
      if (parts.length >= 2) {
        const hh = parts[0].padStart(2, "0");
        const mm = parts[1].padStart(2, "0");
        const ss = parts[2] ? parts[2].padStart(2, "0") : "00";
        return `${hh}:${mm}:${ss}`;
      }
      return t;
    };

    const payload = {
      profile_id: profileId,
      date: dateStr,
      start_time: isToilClaim ? "17:00:00" : formatTimeForDb(startTime),
      end_time: isToilClaim ? null : formatTimeForDb(endTime),
      ot_hours: isToilClaim ? 0 : otHours,
      toil_payout: isToilClaim ? (toilOption === "cash") : false,
      toil_dates: isToilClaim && toilOption === "rest" ? [targetRestDate] : [],
      notes: notes || null,
      status: F().isAdmin ? status : (existingClaim ? existingClaim.status : "pending")
    };
    
    const result = existingClaim 
      ? await DB.dbUpdateOtClaim(existingClaim.id, payload)
      : await DB.dbAddOtClaim(payload);
    setLoading(false);
    if (result) {
      onClose();
    }
  };
  
  const handleDelete = async () => {
    if (!existingClaim) return;
    if (existingClaim.status !== 'pending' && !F().isAdmin) {
      alert("Only pending claims can be cancelled.");
      return;
    }
    
    if (confirm("Are you sure you want to cancel this claim?")) {
      setLoading(true);
      const ok = await DB.dbDeleteOtClaim(existingClaim.id);
      setLoading(false);
      if (ok) {
        onClose();
      }
    }
  };
  
  const showAdminOverride = () => {
    onClose();
    ctx.openAdminOverride();
  };
  
  const displayStatus = existingClaim?.status || null;
  const statusColors = { pending: "var(--warn)", approved: "var(--ok)", rejected: "var(--bad)" };
  
  return (
    <React.Fragment>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "color-mix(in oklch, var(--shadow-base, #000) 55%, transparent)", backdropFilter: "blur(3px)", zIndex: 120 }} />
      <div role="dialog" className="glass rise" style={{ position: "fixed", zIndex: 121, top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        width: "min(420px, 92vw)", maxHeight: "90vh", overflowY: "auto", borderRadius: "var(--radius)", padding: 24, boxShadow: "var(--shadow-lift)", display: "flex", flexDirection: "column", gap: 18 }}>
        
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar name={staffName} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 750, color: "var(--ink)", letterSpacing: "-0.01em" }}>Log OT & TOIL</div>
            <div className="mono" style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
              {window.P_WDL[d.getDay()]}, {window.P_MO[d.getMonth()]} {d.getDate()}
            </div>
          </div>
          <button onClick={onClose} className="tap glass-2" style={{ width: 34, height: 34, borderRadius: 999, display: "grid", placeItems: "center", cursor: "pointer", color: "var(--ink-2)", border: "1px solid var(--hairline)" }}>
            <Icon name="x" size={16} />
          </button>
        </div>
        
        {displayStatus && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 10, background: "var(--inset)", border: "1px solid var(--hairline)" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>Claim Status:</span>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: statusColors[displayStatus] || "var(--ink)" }}>
              {displayStatus}
            </span>
          </div>
        )}
        
        {(!displayStatus || displayStatus === 'pending' || displayStatus === 'rejected' || F().isAdmin) ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            
            {isToilClaim ? (
              <div className="inset" style={{ padding: 14, borderRadius: 12, display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ minWidth: 32, height: 22, padding: "0 6px", borderRadius: 6, display: "grid", placeItems: "center", fontSize: 10, fontWeight: 800, color: "#fff", background: "var(--v-pearson)" }}>TOIL</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Choose TOIL Option:</span>
                </div>
                
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "var(--ink)", fontWeight: 600, cursor: "pointer" }}>
                    <input 
                      type="radio" 
                      name="toil_option" 
                      value="cash"
                      checked={toilOption === "cash"} 
                      onChange={() => setToilOption("cash")}
                      style={{ width: 16, height: 16, accentColor: "var(--accent)" }}
                    />
                    <span>1. Cash out (Paid TOIL)</span>
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13.5, color: "var(--ink)", fontWeight: 600, cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input 
                        type="radio" 
                        name="toil_option" 
                        value="rest"
                        checked={toilOption === "rest"} 
                        onChange={() => setToilOption("rest")}
                        style={{ width: 16, height: 16, accentColor: "var(--accent)" }}
                      />
                      <span>2. Take rest day on another day</span>
                    </div>
                    {toilOption === "rest" && (
                      <div style={{ marginLeft: 26, marginTop: 4 }}>
                        <span style={{ fontSize: 11, color: "var(--ink-4)", display: "block", marginBottom: 4 }}>Choose Target Rest Date:</span>
                        <input 
                          type="date" 
                          value={targetRestDate}
                          onChange={(e) => setTargetRestDate(e.target.value)}
                          className="glass-2"
                          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--hairline)", color: "var(--ink)", background: "transparent", fontSize: 13, outline: "none" }}
                          required={toilOption === "rest"}
                        />
                      </div>
                    )}
                  </label>
                </div>
              </div>
            ) : (
              <div className="inset" style={{ padding: 14, borderRadius: 12, display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ minWidth: 32, height: 22, padding: "0 6px", borderRadius: 6, display: "grid", placeItems: "center", fontSize: 10, fontWeight: 800, color: "#fff", background: "var(--v-ielts)" }}>OT</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Overtime Hours Calculation</span>
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 600, display: "block", marginBottom: 5 }}>Duty Start Time</label>
                    <input 
                      type="time" 
                      value={startTime} 
                      onChange={(e) => setStartTime(e.target.value)}
                      className="glass-2"
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--hairline)", color: "var(--ink)", background: "transparent", fontSize: 13, outline: "none" }}
                    />
                  </div>
                  
                  <div>
                    <label style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 600, display: "block", marginBottom: 5 }}>Duty Finish Time</label>
                    <input 
                      type="time" 
                      value={endTime} 
                      onChange={(e) => setEndTime(e.target.value)}
                      className="glass-2"
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--hairline)", color: "var(--ink)", background: "transparent", fontSize: 13, outline: "none" }}
                      required
                    />
                  </div>
                </div>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid var(--hairline)" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>Calculated Overtime:</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "var(--v-ielts)" }}>{otHours.toFixed(2)} hours</span>
                </div>
              </div>
            )}
            
            {F().isAdmin && (
              <div>
                <label style={{ fontSize: 11.5, color: "var(--ink-3)", fontWeight: 650, display: "block", marginBottom: 6 }}>Claim Status (Admin Override)</label>
                <select 
                  value={status} 
                  onChange={(e) => setStatus(e.target.value)}
                  className="glass-2"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--hairline)", color: "var(--ink)", background: "var(--inset)", fontSize: 13.5, outline: "none", cursor: "pointer" }}
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            )}

            <div>
              <label style={{ fontSize: 11.5, color: "var(--ink-3)", fontWeight: 600, display: "block", marginBottom: 6 }}>Notes / Remarks</label>
              <textarea 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional explanation for the claim..."
                className="glass-2"
                style={{ width: "100%", minHeight: 60, padding: 10, borderRadius: 10, border: "1px solid var(--hairline)", color: "var(--ink)", background: "transparent", fontSize: 13, outline: "none", resize: "none" }}
              />
            </div>
            
            <button 
              onClick={handleSave} 
              disabled={loading}
              className="tap btn-accent"
              style={{ padding: "11px 0", borderRadius: 12, border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer", background: "var(--accent)", color: "#fff", transition: "opacity .2s", opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "Submitting..." : existingClaim ? "Save Changes" : "Submit Claim"}
            </button>
            
            {existingClaim && (
              <button 
                onClick={handleDelete} 
                disabled={loading}
                className="tap"
                style={{ padding: "10px 0", borderRadius: 12, border: "1px solid var(--bad)", fontWeight: 700, fontSize: 13, cursor: "pointer", background: "transparent", color: "var(--bad)", transition: "opacity .2s", opacity: loading ? 0.6 : 1 }}
              >
                Delete / Cancel Claim
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 13.5, color: "var(--ink-2)", fontWeight: 500, lineHeight: 1.5 }}>
              This claim has already been <strong>{displayStatus}</strong> by management. Approved claims cannot be edited.
            </div>
            
            <div className="inset" style={{ padding: 12, borderRadius: 10, display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
              <div><strong>Type:</strong> {isToilClaim ? (existingClaim.toil_payout ? "TOIL Cash Payout" : `TOIL Rest Day (Rest Day on ${initToilDates()[0]})`) : "Overtime Hours"}</div>
              {!isToilClaim && (
                <div><strong>Hours:</strong> {existingClaim.ot_hours} hrs ({existingClaim.start_time} - {existingClaim.end_time})</div>
              )}
              {existingClaim.notes && <div><strong>Notes:</strong> {existingClaim.notes}</div>}
            </div>
          </div>
        )}
        
        {window.FETS.isAdmin && (
          <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 14, display: "flex", justifyContent: "center" }}>
            <button onClick={showAdminOverride} className="tap" style={{ fontSize: 11.5, fontWeight: 700, color: "var(--accent)", background: "transparent", border: "none", cursor: "pointer" }}>
              Admin: Shift Override Panel
            </button>
          </div>
        )}
      </div>
    </React.Fragment>
  );
}

function RosterGrid({ offsets, branch }) {
  const pool = branch === "global"
    ? [...F().STAFF.calicut.map((n) => ({ n, b: "calicut" })), ...F().STAFF.cochin.map((n) => ({ n, b: "cochin" }))]
    : F().STAFF[branch].map((n) => ({ n, b: branch }));

  const build = () => {
    const g = {};
    pool.forEach(({ n }) => {
      g[n] = {};
      const ov = F().rosterGet(n);
      offsets.forEach((o) => {
        const dflt = initRosterCode(n, o, new Set(window.branchRoster(o, branch)).has(n));
        g[n][o] = { code: dflt, ot: 0, dflt, override: !!ov[o] };
        if (ov[o]) g[n][o] = { ...g[n][o], code: cellCode(ov[o]), ot: cellOT(ov[o]), override: true };
      });
    });
    return g;
  };
  const [grid, setGrid] = React.useState(build);
  React.useEffect(() => { setGrid(build()); }, [branch, offsets[0]]);
  React.useEffect(() => {
    const h = () => setGrid(build());
    window.addEventListener("fets-roster-changed", h);
    return () => window.removeEventListener("fets-roster-changed", h);
  }, [branch, offsets[0]]);
  const [dialog, setDialog] = React.useState(null);   // { name, off, date, cell, defaultCode }
  const [otDialog, setOtDialog] = React.useState(null); // { name, off, date, cell }

  const apply = (name, off, cell) => {
    F().rosterSet(name, off, cell);
    const _d = F().ISO(off);
    if (cell) DB.dbSetRoster(name, _d, cell.code, branch); else DB.dbClearRoster(name, _d);
    setGrid((g) => {
      const dflt = g[name][off].dflt;
      const nc = cell ? { code: cell.code, ot: +cell.ot || 0, dflt, override: true } : { code: dflt, ot: 0, dflt, override: false };
      return { ...g, [name]: { ...g[name], [off]: nc } };
    });
    setDialog(null);
  };
  const cols = `190px repeat(${offsets.length}, minmax(46px,1fr))`;

  const ymdFormat = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const reqMarkOf = (name, off) => {
    if (!F()._staffRequests) return false;
    const dstr = ymdFormat(F().ISO(off));
    return F()._staffRequests.some(r => r.who === name && r.date === dstr && r.status === "Submitted");
  };
  const unseenResolutionOf = (name, off) => {
    if (!F()._staffRequests) return null;
    const dstr = ymdFormat(F().ISO(off));
    return F()._staffRequests.find(r => 
      r.who === name && 
      r.date === dstr && 
      (r.status === "Approved" || r.status === "Rejected") && 
      !localStorage.getItem(`fets-seen-req-${r.id}`)
    );
  };

  return (
    <React.Fragment>
    <div className="glass scroll-soft" style={{ borderRadius: "var(--radius)", overflow: "auto", padding: 4 }}>
      <div style={{ minWidth: 190 + offsets.length * 50 }}>
        <div style={{ display: "grid", gridTemplateColumns: cols, gap: 4, padding: "8px 8px 6px" }}>
          <div className="eyebrow" style={{ alignSelf: "center", color: "var(--ink-4)", paddingLeft: 6 }}>Staff</div>
          {offsets.map((o) => {
            const d = F().ISO(o), isToday = o === 0;
            const daySessions = window.branchSessions(o, branch) || [];
            const totalCandidates = daySessions.reduce((sum, s) => sum + s.count, 0);
            const activeVendors = Array.from(new Set(daySessions.map(s => s.vendor)));
            return (
              <div key={o} style={{
                textAlign: "center",
                padding: "6px 2px",
                borderRadius: 10,
                background: isToday ? "var(--accent-soft)" : "var(--panel-3)",
                border: isToday ? "1px solid var(--accent)" : "1px solid var(--hairline)",
                boxShadow: isToday ? "0 0 10px color-mix(in oklch, var(--accent) 30%, transparent)" : "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "space-between",
                minHeight: 68,
              }}>
                <div className="eyebrow" style={{
                  color: isToday ? "var(--accent)" : "var(--ink-3)",
                  fontSize: 8,
                  fontWeight: 800,
                  letterSpacing: "0.02em",
                }}>
                  {window.P_WD[d.getDay()]}
                </div>
                <div className="tabnum" style={{
                  fontSize: 14,
                  fontWeight: 900,
                  color: isToday ? "var(--accent)" : "var(--ink)",
                  lineHeight: 1.1,
                  margin: "1px 0"
                }}>
                  {d.getDate()}
                </div>
                
                {/* Candidate & Vendor indicators */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", marginTop: "auto" }}>
                  {totalCandidates > 0 ? (
                    <span className="mono" style={{
                      fontSize: 8,
                      fontWeight: 800,
                      color: isToday ? "var(--accent)" : "var(--ink-2)",
                      background: isToday ? "rgba(255,255,255,0.08)" : "var(--panel-2)",
                      padding: "1px 3px",
                      borderRadius: 4,
                      lineHeight: 1,
                      border: "1px solid var(--hairline)"
                    }}>
                      {totalCandidates}c
                    </span>
                  ) : (
                    <span style={{ fontSize: 8, color: "var(--ink-4)" }}>—</span>
                  )}
                  
                  {activeVendors.length > 0 && (
                    <div style={{ display: "flex", gap: 2, justifyContent: "center", marginTop: 2 }}>
                      {activeVendors.map(vSlug => {
                        const vMeta = F().VENDORS.find(v => v.slug === vSlug);
                        const vColor = vMeta ? vMeta.color : "var(--ink-4)";
                        return (
                          <span key={vSlug} title={vMeta ? vMeta.name : vSlug} style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            background: vColor,
                            display: "inline-block"
                          }} />
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {pool.map(({ n, b }, ri) => (
          <div key={n} style={{ display: "grid", gridTemplateColumns: cols, gap: 4, padding: "4px 8px",
            background: ri % 2 ? "var(--inset)" : "transparent", borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
              <Avatar name={n} size={28} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 650, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", marginTop: 1 }}>
                  {branch === "global" ? (
                    <span className="eyebrow" style={{ fontSize: 8.5, color: "var(--ink-4)" }}>{b}</span>
                  ) : (
                    n === F().user.name && <span className="eyebrow" style={{ fontSize: 8.5, color: "var(--accent)" }}>you</span>
                  )}
                  {((branch === "global") || (n === F().user.name)) && (
                    <span style={{ fontSize: 8.5, color: "var(--ink-4)", opacity: 0.6 }}>·</span>
                  )}
                  <span className="mono" style={{ fontSize: 8.5, color: "var(--ink-4)", fontWeight: 500 }}>
                    Day {F()._staffDays?.[n] || 1}
                  </span>
                </div>
              </div>
            </div>
            {offsets.map((o) => {
              const cell = grid[n]?.[o] || { code: "RD", ot: 0 };
              const code = cell.code; const m = ROSTER_CODES[code] || ROSTER_CODES.RD;
              const ot = +cell.ot || 0;
              const d = F().ISO(o);
              const pending = reqMarkOf(n, o);
              const unseenRes = unseenResolutionOf(n, o);
              const isSelf = n === F().user.name;

              // Premium styles matching the code tint
              const baseColor = m.ink;
              let bg = "var(--panel-3)";
              let border = "1px solid var(--glass-edge-lo)";
              let shadow = "none";
              let color = m.ink;
              
              if (code === "RD") {
                bg = "var(--panel-3)";
                border = "1px solid var(--glass-edge-lo)";
                color = "var(--ink-4)";
              } else {
                bg = `linear-gradient(135deg, color-mix(in oklch, ${baseColor} 24%, var(--panel)) 0%, color-mix(in oklch, ${baseColor} 10%, var(--panel-3)) 100%)`;
                border = `1px solid color-mix(in oklch, ${baseColor} 40%, transparent)`;
                shadow = `0 3px 8px color-mix(in oklch, ${baseColor} 12%, transparent)`;
                
                if (code === "L") {
                  bg = `linear-gradient(135deg, color-mix(in oklch, var(--bad) 26%, var(--panel)) 0%, color-mix(in oklch, var(--bad) 10%, var(--panel-3)) 100%)`;
                  border = `1px solid color-mix(in oklch, var(--bad) 45%, transparent)`;
                  shadow = `0 3px 8px color-mix(in oklch, var(--bad) 12%, transparent)`;
                }
              }
              
              if (ot > 0) {
                shadow = `0 0 10px color-mix(in oklch, ${OT_COLOR} 30%, transparent)${shadow !== "none" ? `, ${shadow}` : ""}`;
                border = `1px solid ${OT_COLOR}`;
              }

              const cellStyle = {
                position: "relative",
                height: 42,
                borderRadius: 10,
                cursor: (window.FETS.isAdmin || isSelf) ? "pointer" : "default",
                background: bg,
                border: border,
                boxShadow: shadow,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 0,
                color: color,
                fontFamily: "var(--font)",
                fontWeight: 800,
                letterSpacing: "0.02em",
              };

              return (
                <button key={o} onClick={() => {
                  if (unseenRes) {
                    localStorage.setItem(`fets-seen-req-${unseenRes.id}`, "true");
                    window.dispatchEvent(new Event("fets-roster-changed"));
                  }

                  const dstr = ymdFormat(F().ISO(o));
                  const pid = F()._staffIdByName?.[n];
                  const hasClaim = F()._otClaims?.some(c => c.profile_id === pid && c.date === dstr);

                  if (isSelf || (window.FETS.isAdmin && hasClaim)) {
                    setOtDialog({
                      name: n,
                      off: o,
                      date: d,
                      cell,
                      openAdminOverride: () => {
                        setDialog({ name: n, off: o, date: d, cell, defaultCode: cell.dflt || "RD" });
                      }
                    });
                  } else if (window.FETS.isAdmin) {
                    setDialog({ name: n, off: o, date: d, cell, defaultCode: cell.dflt || "RD" });
                  }
                }} className="tap roster-cell-btn" title={(window.FETS.isAdmin || isSelf) ? `${m.label}${ot > 0 ? ` + OT ${ot}h` : ""} — tap to change` : m.label}
                  style={cellStyle}>
                  <span style={{ fontSize: code.length > 2 ? 9 : 13.5, fontWeight: 900, lineHeight: 1 }}>{code}</span>
                  {ot > 0 && (
                    <span className="mono" style={{
                      position: "absolute",
                      bottom: 2,
                      right: 3,
                      fontSize: 7.5,
                      fontWeight: 800,
                      background: OT_COLOR,
                      color: "#fff",
                      padding: "1px 3px",
                      borderRadius: 4,
                      lineHeight: 1,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.3)"
                    }}>
                      +{ot}h
                    </span>
                  )}
                  {pending && <span title="Request pending — Mithun to action" style={{ position: "absolute", top: 3, right: 3, width: 7, height: 7, borderRadius: 999, background: "var(--warn)", boxShadow: "0 0 6px var(--warn)" }} />}
                  {unseenRes && (
                    <span 
                      className={unseenRes.status === "Approved" ? "blink-blue" : "blink-red"} 
                      title={`Request ${unseenRes.status} for ${unseenRes.date}`}
                      style={{ position: "absolute", top: 3, right: 3, width: 7, height: 7, borderRadius: 999, zIndex: 5 }} 
                    />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
    {dialog && <RosterCellDialog ctx={dialog} onClose={() => setDialog(null)} onApply={(cell) => apply(dialog.name, dialog.off, cell)} />}
    {otDialog && <OtToilClaimDialog ctx={otDialog} onClose={() => setOtDialog(null)} />}
    </React.Fragment>
  );
}

/* leave + swap approvals drawer body (super-admin) */
const SREQ_STATUS = { Submitted: "var(--warn)", Approved: "var(--ok)", Rejected: "var(--bad)" };
function StaffReqCard({ r, onResolve }) {
  const isSwap = r.kind === "swap";
  const isToil = r.kind === "toil";
  const kindMeta = isSwap ? { label: "Shift swap", color: "var(--v-prometric)" }
    : isToil ? { label: "TOIL", color: "var(--v-cma)" }
    : { label: "Leave", color: "var(--v-ielts)" };
  return (
    <div className="glass-2" style={{ padding: 16, borderRadius: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <Avatar name={r.who} size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{r.who}</div>
          <div style={{ fontSize: 11.5, color: "var(--ink-3)", fontWeight: 500, textTransform: "capitalize" }}>{r.branch} centre · {r.date}</div>
        </div>
        <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", padding: "4px 9px", borderRadius: 99,
          color: kindMeta.color, background: `color-mix(in oklch, ${kindMeta.color} 16%, transparent)` }}>
          {kindMeta.label}
        </span>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--ink-2)", fontWeight: 600 }}>
        {isSwap ? <span>Swap with <b style={{ color: "var(--ink)" }}>{r.with}</b></span>
          : isToil ? <span>Use <b style={{ color: "var(--ink)" }}>{r.days || 1} TOIL day{(r.days || 1) > 1 ? "s" : ""}</b></span>
          : <span>{r.leaveType}</span>}
      </div>
      {r.reason && <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.5, fontStyle: "italic", fontFamily: "var(--font-serif)" }}>“{r.reason}”</p>}
      {r.status === "Submitted" ? (
        <div style={{ display: "flex", gap: 9 }}>
          <button onClick={() => onResolve(r.id, "Approved")} className="tap" style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "var(--font)", fontSize: 13, fontWeight: 700, color: "var(--accent-ink)", background: "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Icon name="check" size={15} stroke={2.6} /> Approve
          </button>
          <button onClick={() => onResolve(r.id, "Rejected")} className="tap glass-2" style={{ flex: 1, padding: "10px", borderRadius: 10, cursor: "pointer", fontFamily: "var(--font)", fontSize: 13, fontWeight: 700, color: "var(--ink-2)", border: "1px solid var(--hairline)", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Icon name="x" size={15} stroke={2.6} /> Reject
          </button>
        </div>
      ) : (
        <div style={{ fontSize: 12, fontWeight: 700, color: SREQ_STATUS[r.status], display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name={r.status === "Approved" ? "check" : "x"} size={14} stroke={2.6} /> {r.status}
        </div>
      )}
    </div>
  );
}
function LeaveApprovalsPanel({ branch }) {
  const [reqs, setReqs] = React.useState(() => F().staffReqList());
  React.useEffect(() => {
    const h = () => setReqs(F().staffReqList());
    window.addEventListener("fets-roster-changed", h);
    return () => window.removeEventListener("fets-roster-changed", h);
  }, []);
  const inBranch = reqs.filter((r) => branch === "global" || r.branch === branch);
  const resolve = (id, status) => {
    const next = F().staffReqResolve(id, status);
    setReqs(next);
    if (status === "Approved") { const r = next.find((x) => x.id === id); reflectOnRoster(r); }
    toast(status === "Approved" ? "Approved — roster updated" : "Request rejected", status === "Approved" ? "check" : "x");
  };
  const pending = inBranch.filter((r) => r.status === "Submitted").length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <StatPill value={pending} label="Awaiting you" tone={pending ? "var(--warn)" : "var(--ok)"} />
        <StatPill value={inBranch.filter((r) => r.kind === "leave").length} label="Leave requests" />
        <StatPill value={inBranch.filter((r) => r.kind === "swap").length} label="Swap requests" tone="var(--v-prometric)" />
        <StatPill value={inBranch.filter((r) => r.kind === "toil").length} label="TOIL requests" tone="var(--v-cma)" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {inBranch.length === 0
          ? <div className="inset" style={{ padding: 22, borderRadius: 14, textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}>No requests for this centre.</div>
          : inBranch.map((r) => <StaffReqCard key={r.id} r={r} onResolve={resolve} />)}
      </div>
    </div>
  );
}

/* ---------- roster analysis ---------- */
function RosterAnalysis({ offsets, branch }) {
  const pool = branch === "global"
    ? [...F().STAFF.calicut, ...F().STAFF.cochin]
    : F().STAFF[branch];
  const perStaff = {}; const codeCount = { D: 0, E: 0, HD: 0, RD: 0, L: 0, TOIL: 0, TR: 0 };
  let otHours = 0;
  const workSet = ["D", "E", "HD", "TOIL"];
  pool.forEach((n) => {
    const ov = F().rosterGet(n);
    offsets.forEach((o) => {
      const c = ov[o] || null;
      const code = c ? cellCode(c) : initRosterCode(n, o, new Set(window.branchRoster(o, branch)).has(n));
      const ot = c ? cellOT(c) : 0;
      if (codeCount[code] != null) codeCount[code]++;
      otHours += ot;
      if (workSet.includes(code)) perStaff[n] = (perStaff[n] || 0) + 1;
    });
  });
  const staffRows = pool.map((n) => [n, perStaff[n] || 0]).sort((a, b) => b[1] - a[1]);
  const staffMax = Math.max(1, ...staffRows.map((r) => r[1]));
  const working = codeCount.D + codeCount.E + codeCount.HD + codeCount.TOIL;
  const mixSeg = ["D", "E", "HD", "RD", "L", "TOIL", "TR"].map((k) => ({ label: ROSTER_CODES[k].label, color: k === "RD" ? "var(--ink-4)" : ROSTER_CODES[k].color, n: codeCount[k] || 0 }));
  const mixTotal = mixSeg.reduce((a, s) => a + s.n, 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "calc(20px * var(--density))", alignItems: "start" }} className="case-cols">
      <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <SectionLabel right={<span className="mono" style={{ fontSize: 11, color: OT_COLOR }}>+{otHours}h OT</span>}>Shifts per staff (this month)</SectionLabel>
        <div className="glass" style={{ padding: "20px 22px", borderRadius: "var(--radius)", display: "flex", flexDirection: "column", gap: 13 }}>
          {staffRows.map(([n, c]) => <BarRow key={n} label={n} n={c} max={staffMax} color="var(--v-prometric)" />)}
        </div>
      </section>
      <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <SectionLabel>Shift mix</SectionLabel>
        <div className="glass" style={{ padding: 22, borderRadius: "var(--radius)" }}>
          <Donut segments={mixSeg} total={mixTotal} centerLabel={working} centerSub="worked" />
        </div>
      </section>
    </div>
  );
}

/* ---------- attendance: check in / step out / back / check out (DB-persisted) ---------- */
function AttendanceConsole({ branch }) {
  const [row, setRow] = React.useState(undefined);   // undefined=loading, null=none
  const [, force] = React.useReducer((x) => x + 1, 0);
  const load = () => ATT.attToday().then((r) => setRow(r || null));
  React.useEffect(() => { load(); const t = setInterval(() => force(), 60000); return () => clearInterval(t); }, []);
  const act = async (fn, ok) => { const r = await fn(); if (r && r.error) toast(r.error, "alert"); else { toast(ok, "check"); load(); } };
  const onBreak = row && ATT.attOnBreak(row);
  const checkedIn = row && row.check_in && !row.check_out;
  const done = !!(row && row.check_out);
  const worked = row ? ATT.attWorked(row) : 0;
  const hasNfc = typeof window !== "undefined" && "NDEFReader" in window;
  const tapCard = async () => {
    try { const r = new window.NDEFReader(); await r.scan(); toast("Tap your ID card to the phone…", "key"); r.onreading = () => act(() => ATT.attCheckIn(branch), "Checked in via card"); }
    catch (e) { toast("NFC not available on this device", "alert"); }
  };
  const Btn = ({ on, label, icon, primary }) => (
    <button onClick={on} className="tap" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 17px", borderRadius: 12, border: primary ? "none" : "1px solid var(--hairline)", cursor: "pointer", fontFamily: "var(--font)", fontSize: 13.5, fontWeight: 750, color: primary ? "var(--accent-ink)" : "var(--ink)", background: primary ? "var(--accent)" : "var(--glass-2)" }}><Icon name={icon} size={16} /> {label}</button>
  );
  const txt = row === undefined ? "Loading…" : done ? "Checked out" : onBreak ? "On break" : checkedIn ? "On shift" : "Not checked in";
  const col = done ? "var(--ink-3)" : onBreak ? "var(--warn)" : checkedIn ? "var(--ok)" : "var(--ink-4)";
  
  const isSuperAdmin = !!window.FETS?.isAdmin;
  const userProfileBranch = window.FETS?._meBranch || 'cochin';
  const isLocked = !isSuperAdmin && branch !== userProfileBranch;

  return (
    <div className="glass" style={{ borderRadius: "var(--radius)", padding: "18px 20px", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 13, flex: "1 1 240px", minWidth: 0 }}>
        <span style={{ width: 12, height: 12, borderRadius: 999, background: col, boxShadow: `0 0 10px ${col}`, flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 750, color: "var(--ink)" }}>{txt}</div>
          <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>
            {row && row.check_in ? `In ${row.check_in}` : "—"}{row && row.check_out ? ` · Out ${row.check_out}` : ""}{row && row.check_in ? ` · ${ATT.attFmtMins(worked)} worked` : ""}{row && ATT.attBreakMins(row) ? ` · ${ATT.attBreakMins(row)}m break` : ""}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 9, flexWrap: "wrap", alignItems: "center" }}>
        {isLocked ? (
          <div style={{ fontSize: 12.5, color: "var(--ink-3)", fontWeight: 650, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="lock" size={14} /> Read-only (Locked to {userProfileBranch.toUpperCase()})
          </div>
        ) : (
          <React.Fragment>
            {row !== undefined && !row && <Btn on={() => act(() => ATT.attCheckIn(branch), "Checked in")} label="Check in" icon="power" primary />}
            {checkedIn && !onBreak && <React.Fragment><Btn on={() => act(ATT.attStepOut, "Stepped out")} label="Step out" icon="coffee" /><Btn on={() => act(ATT.attCheckOut, "Checked out")} label="Check out" icon="power" primary /></React.Fragment>}
            {onBreak && <Btn on={() => act(ATT.attBack, "Back on shift")} label="I'm back" icon="arrowR" primary />}
            {done && <span className="mono" style={{ fontSize: 13, color: "var(--ok)", fontWeight: 700 }}>✓ {ATT.attFmtMins(worked)} today</span>}
            {hasNfc && row !== undefined && !done && <button onClick={tapCard} title="Check in by tapping your NFC ID card" className="tap glass-2" style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 42, padding: "0 13px", borderRadius: 12, cursor: "pointer", color: "var(--ink-2)", border: "1px solid var(--hairline)", fontSize: 12.5, fontWeight: 650 }}><Icon name="key" size={15} /> Tap card</button>}
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

function ShiftHistory() {
  const [rows, setRows] = React.useState<any[] | null>(null);
  React.useEffect(() => { ATT.attHistory(45).then(setRows); }, []);

  const totalShifts = rows ? rows.length : 0;
  const totalWorkedMins = rows ? rows.reduce((sum, r) => sum + (r.worked || 0), 0) : 0;
  const latesCount = rows ? rows.filter(r => String(r.status).toLowerCase() === "late").length : 0;
  const punctuality = totalShifts > 0 ? Math.round(((totalShifts - latesCount) / totalShifts) * 100) : 100;

  return (
    <div className="glass rise" style={{ borderRadius: "var(--radius)", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SectionLabel style={{ margin: 0 }} right={<span className="mono" style={{ fontSize: 11, color: "var(--accent)" }}>individual timesheet</span>}>My Shift Hours</SectionLabel>
        <span style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "var(--glass-2)", border: "1px solid var(--hairline)" }}>Last 45 Days</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div className="inset" style={{ padding: "10px 12px", borderRadius: 10, textAlign: "center" }}>
          <div style={{ fontSize: 9, color: "var(--ink-4)", fontWeight: 700, textTransform: "uppercase" }}>Shifts</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)", marginTop: 4 }}>{totalShifts}</div>
        </div>
        <div className="inset" style={{ padding: "10px 12px", borderRadius: 10, textAlign: "center" }}>
          <div style={{ fontSize: 9, color: "var(--ink-4)", fontWeight: 700, textTransform: "uppercase" }}>Total Hours</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--accent)", marginTop: 4 }}>{Math.floor(totalWorkedMins / 60)}h</div>
        </div>
        <div className="inset" style={{ padding: "10px 12px", borderRadius: 10, textAlign: "center" }}>
          <div style={{ fontSize: 9, color: "var(--ink-4)", fontWeight: 700, textTransform: "uppercase" }}>Punctuality</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: punctuality >= 90 ? "var(--ok)" : "var(--warn)", marginTop: 4 }}>{punctuality}%</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 380, overflowY: "auto", paddingRight: 4 }}>
        {!rows ? (
          <div style={{ textAlign: "center", padding: 24, color: "var(--ink-4)", fontSize: 13 }}>Loading shifts...</div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: "center", padding: 24, color: "var(--ink-4)", fontSize: 13 }}>No shifts recorded.</div>
        ) : (
          rows.map((r, i) => {
            const isLate = String(r.status).toLowerCase() === "late";
            const dateObj = new Date(r.date);
            const dateStr = dateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
            const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dateObj.getDay()];
            return (
              <div key={i} className="glass-2 hover-lift" style={{ 
                borderRadius: 12, 
                padding: "10px 14px", 
                border: "1px solid var(--hairline)", 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                gap: 12,
                transition: "all 0.2s"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ textAlign: "center", minWidth: 42, padding: "4px 6px", borderRadius: 8, background: "var(--inset)" }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "var(--ink)" }}>{dateStr.split(" ")[0]}</div>
                    <div style={{ fontSize: 9, color: "var(--ink-3)", fontWeight: 700, textTransform: "uppercase", marginTop: 1 }}>{dayName}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 650, color: "var(--ink-2)", display: "flex", alignItems: "center", gap: 6 }}>
                      <span>{r.check_in || "—"}</span>
                      <span style={{ color: "var(--ink-4)" }}>→</span>
                      <span>{r.check_out || "—"}</span>
                    </div>
                    {r.breakMins > 0 && (
                      <div style={{ fontSize: 10.5, color: "var(--ink-4)", marginTop: 2 }}>
                        Break: {r.breakMins}m
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {isLate && (
                    <span style={{ fontSize: 9.5, fontWeight: 750, textTransform: "uppercase", padding: "2px 7px", borderRadius: 99, background: "rgba(253,203,110,0.12)", color: "#C2860F", border: "1px solid rgba(253,203,110,0.25)" }}>
                      Late
                    </span>
                  )}
                  <div className="mono" style={{ fontSize: 13, color: "var(--accent)", fontWeight: 750 }}>
                    {r.worked ? ATT.attFmtMins(r.worked) : "—"}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ---------- roster request markers (staff request → Mithun acts) ---------- */
function reqMarksAll() { try { return JSON.parse(localStorage.getItem("fets-reqmarks") || "{}"); } catch (e) { return {}; } }
function reqMarkOf(name, off) { return reqMarksAll()[`${name}|${off}`]; }
function setReqMark(name, off, val) { const a = reqMarksAll(); if (val) a[`${name}|${off}`] = val; else delete a[`${name}|${off}`]; localStorage.setItem("fets-reqmarks", JSON.stringify(a)); window.dispatchEvent(new Event("fets-roster-changed")); }

/* ---------- personalized stats card for roster ---------- */
function PersonalizedRosterOverview({ branch }) {
  const F = window.FETS;
  const meName = F.user.name;
  
  // Calculate this month's stats for current user
  const monthlyOffsets = Array.from({ length: 30 }, (_, i) => i - 5); // scan nearby 30 days
  let workedDays = 0;
  let restDays = 0;
  let leaveDays = 0;
  
  const ov = F.rosterGet(meName) || {};
  monthlyOffsets.forEach((o) => {
    const c = ov[o];
    const code = c ? (typeof c === "string" ? c : c.code) : F.rosterOn(F.ISO(o), branch).includes(meName) ? "D" : "RD";
    if (["D", "E", "HD"].includes(code)) workedDays++;
    if (code === "RD") restDays++;
    if (code === "L") leaveDays++;
  });
  
  const toilBalance = F._meToilBalance || 0;
  const toilEarned = F._meToilEarned || 0;
  const toilRedeemed = F._meToilRedeemed || 0;
  const totalMonthOt = F._meTotalMonthOt || 0;

  return (
    <div className="glass rise" style={{ borderRadius: "var(--radius)", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Avatar name={meName} size={42} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 750, color: "var(--accent)" }}>Hello, {meName.split(" ")[0]}!</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 1 }}>Here is your personalized roster summary for this month:</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
        <div className="inset" style={{ padding: "12px 14px", borderRadius: 12 }}>
          <div className="eyebrow" style={{ fontSize: 9.5, color: "var(--ink-4)" }}>Days Worked</div>
          <div className="tabnum" style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", marginTop: 4 }}>{workedDays}</div>
        </div>
        <div className="inset" style={{ padding: "12px 14px", borderRadius: 12 }}>
          <div className="eyebrow" style={{ fontSize: 9.5, color: "var(--ink-4)" }}>Rest Days</div>
          <div className="tabnum" style={{ fontSize: 22, fontWeight: 800, color: "var(--ink-2)", marginTop: 4 }}>{restDays}</div>
        </div>
        <div className="inset" style={{ padding: "12px 14px", borderRadius: 12 }}>
          <div className="eyebrow" style={{ fontSize: 9.5, color: "var(--ink-4)" }}>Leave Days</div>
          <div className="tabnum" style={{ fontSize: 22, fontWeight: 800, color: "var(--bad)", marginTop: 4 }}>{leaveDays}</div>
        </div>
        <div className="inset" style={{ padding: "12px 14px", borderRadius: 12, border: "1px dashed var(--accent)" }}>
          <div className="eyebrow" style={{ fontSize: 9.5, color: "var(--accent)" }}>TOIL Balance</div>
          <div className="tabnum" style={{ fontSize: 22, fontWeight: 800, color: "var(--accent)", marginTop: 4 }}>
            {toilBalance} <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-3)" }}>days</span>
          </div>
          <div className="mono" style={{ fontSize: 9, color: "var(--ink-4)", marginTop: 2 }}>
            {toilEarned} earned · {toilRedeemed} redeemed
          </div>
        </div>
        <div className="inset" style={{ padding: "12px 14px", borderRadius: 12 }}>
          <div className="eyebrow" style={{ fontSize: 9.5, color: "var(--ink-4)" }}>Approved OT</div>
          <div className="tabnum" style={{ fontSize: 22, fontWeight: 800, color: "var(--v-ielts)", marginTop: 4 }}>
            {totalMonthOt.toFixed(1)} <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-3)" }}>hrs</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- roster request tabbed form ---------- */
function RosterRequestForm({ branch }) {
  const [kind, setKind] = React.useState("leave");
  const [leaveType, setLeaveType] = React.useState("Full-day leave");
  const [reqDate, setReqDate] = React.useState("");
  const [swapDate, setSwapDate] = React.useState("");
  const [withWho, setWithWho] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const F = window.FETS;
  const meName = F.user.name;

  const isSuperAdmin = !!window.FETS?.isAdmin;
  const userProfileBranch = window.FETS?._meBranch || 'cochin';
  const isLocked = !isSuperAdmin && branch !== userProfileBranch;

  if (isLocked) {
    return (
      <div className="glass" style={{ borderRadius: "var(--radius)", padding: 24, display: "flex", flexDirection: "column", gap: 14, alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "color-mix(in oklch, var(--bad) 12%, transparent)", display: "grid", placeItems: "center", color: "var(--bad)" }}>
          <Icon name="lock" size={20} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 15, fontWeight: 750, color: "var(--ink)" }}>Request Form Locked</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-3)", maxWidth: 300, lineHeight: 1.4 }}>
            You are viewing the <strong>{branch.toUpperCase()}</strong> branch. To submit a leave, swap, or TOIL request, please switch back to your home branch: <strong>{userProfileBranch.toUpperCase()}</strong>.
          </div>
        </div>
      </div>
    );
  }

  const pool = branch === "global"
    ? [...F.STAFF.calicut, ...F.STAFF.cochin]
    : F.STAFF[branch] || [];
  const colleagues = pool.filter((n) => n !== meName);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reqDate) {
      toast("Please select a date", "alert");
      return;
    }
    if (kind === "swap" && !withWho) {
      toast("Please select a staff member to swap with", "alert");
      return;
    }
    if (kind === "swap" && !swapDate) {
      toast("Please select the target swap date", "alert");
      return;
    }

    setSubmitting(true);
    const req = {
      who: meName,
      branch: branch === "global" ? (F._meBranch || "calicut") : branch,
      kind,
      date: reqDate,
      reason,
      ...(kind === "leave" && { leaveType }),
      ...(kind === "swap" && { with: withWho, swapDate }),
      ...(kind === "toil" && { days: 1 })
    };

    const res = await DB.dbAddStaffRequest(req);
    setSubmitting(false);

    if (res) {
      setReqDate("");
      setSwapDate("");
      setWithWho("");
      setReason("");
    }
  };

  const inpStyle = {
    background: "var(--inset)",
    border: "1px solid var(--hairline)",
    borderRadius: 10,
    color: "var(--ink)",
    fontFamily: "var(--font)",
    fontSize: 13.5,
    padding: "10px 12px",
    width: "100%",
    outline: "none",
    boxSizing: "border-box" as const
  };

  const KIND_META = {
    leave: { icon: "calendar", label: "Leave", desc: "Apply for a scheduled day off", color: "var(--bad)" },
    swap:  { icon: "refresh",  label: "Shift Swap", desc: "Exchange shifts with a colleague", color: "var(--v-prometric)" },
    toil:  { icon: "clock",    label: "Redeem TOIL", desc: "Use accrued time-off-in-lieu balance", color: "var(--v-cma)" },
  };

  return (
    <div className="glass rise" style={{ borderRadius: "var(--radius)", padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--hairline)", paddingBottom: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: "rgba(255, 255, 255, 0.05)", display: "grid", placeItems: "center", border: "1px solid var(--hairline)" }}>
          <Icon name="edit" size={18} style={{ color: "var(--accent)" }} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 750, color: "var(--ink)", letterSpacing: "-0.01em" }}>Staff Request Portal</div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 1 }}>Submit requests directly to Super Admins. Real-time status shows below.</div>
        </div>
      </div>

      {/* Main dual-pane layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 24 }} className="request-portal-grid">
        {/* Left selector pane */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(Object.entries(KIND_META) as [string, any][]).map(([k, m]) => {
            const on = kind === k;
            return (
              <button 
                type="button" 
                key={k} 
                onClick={() => setKind(k)} 
                className="tap hover-lift" 
                style={{
                  display: "flex", 
                  alignItems: "center", 
                  gap: 12,
                  padding: "16px 18px", 
                  borderRadius: 14,
                  border: `1px solid ${on ? m.color : "var(--hairline)"}`,
                  background: on ? `color-mix(in oklch, ${m.color} 8%, var(--inset))` : "var(--inset)",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                  transition: "all 0.2s"
                }}
              >
                <div style={{ 
                  width: 32, 
                  height: 32, 
                  borderRadius: 8, 
                  background: on ? `color-mix(in oklch, ${m.color} 20%, transparent)` : "rgba(255,255,255,0.04)", 
                  display: "grid", 
                  placeItems: "center",
                  color: on ? m.color : "var(--ink-3)",
                  border: `1px solid ${on ? m.color : "var(--hairline)"}`
                }}>
                  <Icon name={m.icon} size={15} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 750, color: on ? m.color : "var(--ink)" }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2 }}>{m.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right input pane */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {kind === "leave" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="case-2col">
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 650, color: "var(--ink-2)" }}>
                Leave Date
                <input type="date" value={reqDate} onChange={(e) => setReqDate(e.target.value)} style={inpStyle} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 650, color: "var(--ink-2)" }}>
                Leave Type
                <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} style={inpStyle}>
                  <option value="Full-day leave">Full-day leave</option>
                  <option value="Half day">Half day</option>
                </select>
              </label>
            </div>
          )}

          {kind === "swap" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="case-cols">
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 650, color: "var(--ink-2)", gridColumn: "1 / -1" }}>
                Swap With
                <select value={withWho} onChange={(e) => setWithWho(e.target.value)} style={inpStyle}>
                  <option value="">Select colleague…</option>
                  {colleagues.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 650, color: "var(--ink-2)" }}>
                Your Shift Date
                <input type="date" value={reqDate} onChange={(e) => setReqDate(e.target.value)} style={inpStyle} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 650, color: "var(--ink-2)" }}>
                Their Shift Date
                <input type="date" value={swapDate} onChange={(e) => setSwapDate(e.target.value)} style={inpStyle} />
              </label>
            </div>
          )}

          {kind === "toil" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 14 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 650, color: "var(--ink-2)" }}>
                Date to Redeem TOIL
                <input type="date" value={reqDate} onChange={(e) => setReqDate(e.target.value)} style={inpStyle} />
              </label>
              <div className="inset" style={{ borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: 999, background: "rgba(0, 184, 148, 0.1)", display: "grid", placeItems: "center", color: "var(--ok)" }}>
                  <Icon name="clock" size={14} />
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 650, color: "var(--ink-4)", textTransform: "uppercase" }}>TOIL Balance</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "var(--v-cma)", marginTop: 2 }}>
                    {(window.FETS._meToilBalance || 0)} <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)" }}>days left</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 650, color: "var(--ink-2)" }}>
            Reason / Comments
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
              placeholder="Briefly explain your request (optional)…"
              style={{ ...inpStyle, resize: "vertical", lineHeight: 1.55 }} />
          </label>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" disabled={submitting} className="tap" style={{
              height: 42, borderRadius: 11, border: "none", cursor: submitting ? "not-allowed" : "pointer",
              fontFamily: "var(--font)", fontSize: 13, fontWeight: 780,
              color: "var(--accent-ink)", background: submitting ? "var(--ink-4)" : "var(--accent)",
              padding: "0 28px", display: "inline-flex", alignItems: "center", gap: 9,
              transition: "background .2s", opacity: submitting ? 0.7 : 1
            }}>
              <Icon name={submitting ? "loader" : "check"} size={14} stroke={2.5} />
              {submitting ? "Submitting…" : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- admin: everyone's attendance for a day (Mithun only) ---------- */
function AttendanceAdminPage({ branch }) {
  const [date, setDate] = React.useState(ATT.attDateStr());
  const [rows, setRows] = React.useState(null);
  React.useEffect(() => { setRows(null); ATT.attAllForDate(date).then(setRows); }, [date]);
  const totalWorked = (rows || []).reduce((a, r) => a + (r.worked || 0), 0);
  const SCOL = { present: "var(--ok)", late: "var(--warn)", half_day: "var(--v-ielts)", absent: "var(--bad)" };
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", flexDirection: "column", gap: "calc(24px * var(--density))" }}>
      <PageHeader eyebrow="Admin // attendance" title="Daily Attendance" />
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ background: "var(--inset)", border: "1px solid var(--hairline)", borderRadius: 10, color: "var(--ink)", fontFamily: "var(--font)", fontSize: 14, padding: "10px 12px" }} />
        <div style={{ flex: 1 }} />
        <StatPill value={(rows || []).length} label="Records" />
        <StatPill value={ATT.attFmtMins(totalWorked)} label="Total worked" tone="var(--accent)" />
      </div>
      <div className="glass" style={{ borderRadius: "var(--radius)", padding: "8px 4px", overflow: "auto" }}>
        <div style={{ minWidth: 640 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 0.9fr 0.9fr 0.8fr 1fr", gap: 8, padding: "8px 14px" }}>
            {["Staff", "Branch", "In", "Out", "Break", "Worked"].map((h) => <div key={h} className="eyebrow" style={{ fontSize: 9, color: "var(--ink-4)" }}>{h}</div>)}
          </div>
          {!rows ? <div style={{ padding: 20, color: "var(--ink-4)" }}>Loading…</div>
            : rows.length === 0 ? <div style={{ padding: 20, color: "var(--ink-4)" }}>No attendance recorded for this day.</div>
            : rows.map((r, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 0.9fr 0.9fr 0.8fr 1fr", gap: 8, padding: "11px 14px", borderTop: "1px solid var(--hairline)", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}><Avatar name={r.name} size={26} /><span style={{ fontSize: 13, fontWeight: 650, color: "var(--ink)" }}>{r.name}</span></div>
                <div style={{ fontSize: 12, color: "var(--ink-3)", textTransform: "capitalize" }}>{r.branch || "—"}</div>
                <div className="mono" style={{ fontSize: 12.5 }}>{r.check_in || "—"}</div>
                <div className="mono" style={{ fontSize: 12.5 }}>{r.check_out || "—"}</div>
                <div className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>{r.breakMins ? r.breakMins + "m" : "—"}</div>
                <div className="mono" style={{ fontSize: 12.5, color: "var(--accent)", fontWeight: 700 }}>{r.worked ? ATT.attFmtMins(r.worked) : "—"}</div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Roster Approvals Hub page (recreation of staff management) ---------- */
function RosterApprovalsHub({ branch }) {
  const [reqs, setReqs] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState("pending");

  const F = window.FETS;

  const load = () => {
    setLoading(true);
    loadLiveData(F).then(() => {
      setReqs(F.staffReqList() || []);
      setLoading(false);
    });
  };

  React.useEffect(() => {
    load();
    window.addEventListener("fets-roster-changed", load);
    return () => window.removeEventListener("fets-roster-changed", load);
  }, []);

  const resolve = async (id, status) => {
    const adminId = F._meId || "00000000-0000-0000-0000-000000000000";
    await DB.dbResolveStaffRequest(id, status, adminId);
    load();
  };

  const filtered = reqs.filter((r) => {
    const matchesBranch = branch === "global" || r.branch === branch;
    if (tab === "pending") return matchesBranch && r.status === "Submitted";
    return matchesBranch && r.status !== "Submitted";
  });

  const SCOL = { Submitted: "var(--warn)", Approved: "var(--ok)", Rejected: "var(--bad)" };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHeader eyebrow="Modules // Admin" title="Roster Approvals Hub" />

      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <Segmented value={tab} onChange={setTab} size="sm" options={[
          { value: "pending", label: "Pending Requests" },
          { value: "history", label: "History" },
          { value: "discussions", label: "Staff Discussions" }
        ]} />
        <div style={{ flex: 1 }} />
        <button onClick={load} className="tap glass-2" style={{ width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center", border: "1px solid var(--hairline)", cursor: "pointer", color: "var(--ink-2)" }}>
          <Icon name="refresh" size={15} />
        </button>
      </div>

      {loading ? (
        <div className="glass" style={{ padding: 40, borderRadius: "var(--radius)", textAlign: "center", color: "var(--ink-4)" }}>
          Loading requests…
        </div>
      ) : tab === "discussions" ? (
        <RosterDiscussionsAdmin />
      ) : filtered.length === 0 ? (
        <div className="glass" style={{ padding: 40, borderRadius: "var(--radius)", textAlign: "center", color: "var(--ink-4)" }}>
          No {tab === "pending" ? "pending" : "resolved"} requests found.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
          {filtered.map((r) => {
            const isSwap = r.kind === "swap";
            const isToil = r.kind === "toil";
            const kindMeta = isSwap ? { label: "Shift Swap", color: "var(--v-prometric)" }
              : isToil ? { label: "TOIL", color: "var(--v-cma)" }
              : { label: "Leave", color: "var(--v-ielts)" };
              
            return (
              <div key={r.id} className="glass rise" style={{ padding: 20, borderRadius: "var(--radius)", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar name={r.who} size={36} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ink)" }}>{r.who}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 1 }}>
                      {r.branch} center
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", padding: "4px 10px", borderRadius: 99,
                    color: kindMeta.color, background: `color-mix(in oklch, ${kindMeta.color} 15%, transparent)` }}>
                    {kindMeta.label}
                  </span>
                </div>

                <div style={{ fontSize: 13.5, color: "var(--ink-2)", fontWeight: 600 }}>
                  {isSwap ? (
                    <span>
                      Swap shift on <b style={{ color: "var(--ink)" }}>{r.date}</b> with <b style={{ color: "var(--ink)" }}>{r.with}</b> (their shift on <b style={{ color: "var(--ink)" }}>{r.swapDate || r.date}</b>)
                    </span>
                  ) : isToil ? (
                    <span>
                      Redeem TOIL day on <b style={{ color: "var(--ink)" }}>{r.date}</b>
                    </span>
                  ) : (
                    <span>
                      Take leave on <b style={{ color: "var(--ink)" }}>{r.date}</b> ({r.leaveType})
                    </span>
                  )}
                </div>

                {r.reason && (
                  <p style={{ margin: 0, padding: "10px 12px", borderRadius: 8, background: "var(--inset)", fontSize: 12.5, color: "var(--ink-3)", fontStyle: "italic", fontFamily: "var(--font-serif)", lineHeight: 1.4 }}>
                    “{r.reason}”
                  </p>
                )}

                {r.status === "Submitted" ? (
                  <div style={{ display: "flex", gap: 9, alignSelf: "flex-end", marginTop: 4 }}>
                    <button onClick={() => resolve(r.id, "Approved")} className="tap" style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 16px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "var(--font)", fontSize: 12.5, fontWeight: 750, color: "var(--accent-ink)", background: "var(--accent)" }}>
                      <Icon name="check" size={14} stroke={2.6} /> Approve
                    </button>
                    <button onClick={() => resolve(r.id, "Rejected")} className="tap glass-2" style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 16px", borderRadius: 8, border: "1px solid var(--hairline)", cursor: "pointer", fontFamily: "var(--font)", fontSize: 12.5, fontWeight: 650, color: "var(--ink-2)" }}>
                      <Icon name="x" size={14} stroke={2.6} /> Reject
                    </button>
                  </div>
                ) : (
                  <div style={{ alignSelf: "flex-end", fontSize: 12.5, fontWeight: 700, color: SCOL[r.status], display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <Icon name={r.status === "Approved" ? "check" : "x"} size={14} stroke={2.6} /> {r.status}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- OT & TOIL Claims Manager Hub Page ---------- */
function OtToilClaimsHub({ branch }) {
  const [claims, setClaims] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState("pending");
  
  // Selected month for payroll calculation and month-wise summaries (Format: 'YYYY-MM')
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = React.useState(currentMonthStr);
  
  // Local state for payroll inputs/edits and OT approvals
  const [editingRates, setEditingRates] = React.useState({});
  const [editingPayroll, setEditingPayroll] = React.useState({});
  const [adjustedHours, setAdjustedHours] = React.useState({});
  const [expandedMonths, setExpandedMonths] = React.useState({});
  const [activePayslipStaff, setActivePayslipStaff] = React.useState(null);
  
  const F = window.FETS;

  const parseNotes = (notesStr) => {
    try {
      const parsed = JSON.parse(notesStr);
      return {
        addition: parsed.addition || "",
        deduction: parsed.deduction || ""
      };
    } catch (e) {
      return {
        addition: notesStr || "",
        deduction: ""
      };
    }
  };
  
  const load = async () => {
    setLoading(true);
    const { loadMonthlyPayroll } = await import("./live-data");
    await loadLiveData(F);
    await loadMonthlyPayroll(F);
    setClaims(F._otClaims || []);
    setLoading(false);
  };
  
  React.useEffect(() => {
    load();
    const h = () => setClaims(F._otClaims || []);
    window.addEventListener("fets-ot-claims-changed", h);
    window.addEventListener("fets-roster-changed", load);
    window.addEventListener("fets-payroll-changed", load);
    return () => {
      window.removeEventListener("fets-ot-claims-changed", h);
      window.removeEventListener("fets-roster-changed", load);
      window.removeEventListener("fets-payroll-changed", load);
    };
  }, []);
  
  const resolve = async (id, status, approvedHours) => {
    await DB.dbResolveOtClaim(id, status, approvedHours);
    load();
  };
  
  // Niyas filtering rule
  const filterNiyas = (name) => {
    if (!name) return false;
    return !name.toLowerCase().includes("niyas");
  };

  const handleRateChange = (profileId, val) => {
    const monthly = parseFloat(val) || 0;
    const daily = parseFloat((monthly / 30).toFixed(2));
    const hourly = parseFloat((daily / 8 * 1.75).toFixed(2));
    setEditingRates(prev => ({
      ...prev,
      [profileId]: {
        monthly_salary: monthly,
        daily_rate: daily,
        hourly_rate: hourly
      }
    }));
  };
  
  const handleSaveRates = async (profileId) => {
    const updated = editingRates[profileId];
    if (!updated) return;
    const ok = await DB.dbUpdateStaffRates(profileId, updated.hourly_rate, updated.daily_rate, updated.monthly_salary);
    if (ok) {
      setEditingRates(prev => {
        const next = { ...prev };
        delete next[profileId];
        return next;
      });
      load();
    }
  };

  const handlePayrollEdit = (profileId, field, value) => {
    setEditingPayroll(prev => {
      const existing = prev[profileId] || {};
      return {
        ...prev,
        [profileId]: {
          ...existing,
          [field]: value
        }
      };
    });
  };

  const handleSavePayroll = async (profileId, baselineSalary) => {
    const current = editingPayroll[profileId] || {};
    const mp = F._monthlyPayroll?.[profileId]?.[selectedMonth];
    
    const savedSalary = mp ? mp.monthly_salary : baselineSalary;
    const savedAddition = mp ? mp.manual_addition : 0;
    const savedDeduction = mp ? mp.manual_deduction : 0;
    
    let savedAddNotes = "";
    let savedDedNotes = "";
    if (mp && mp.adjustment_notes) {
      const parsed = parseNotes(mp.adjustment_notes);
      savedAddNotes = parsed.addition;
      savedDedNotes = parsed.deduction;
    }

    const payload = {
      monthly_salary: current.monthly_salary !== undefined ? parseFloat(current.monthly_salary) || 0 : savedSalary,
      manual_addition: current.manual_addition !== undefined ? parseFloat(current.manual_addition) || 0 : savedAddition,
      manual_deduction: current.manual_deduction !== undefined ? parseFloat(current.manual_deduction) || 0 : savedDeduction,
      adjustment_notes: JSON.stringify({
        addition: current.addition_note !== undefined ? current.addition_note : savedAddNotes,
        deduction: current.deduction_note !== undefined ? current.deduction_note : savedDedNotes
      })
    };

    const res = await DB.dbUpdateMonthlyPayroll(profileId, selectedMonth, payload);
    if (res) {
      setEditingPayroll(prev => {
        const next = { ...prev };
        delete next[profileId];
        return next;
      });
      load();
    }
  };
  
  // Calculate dynamic months dropdown
  const monthsOptions = React.useMemo(() => {
    const opts = [];
    const d = new Date();
    // Go back 12 months
    for (let i = 0; i < 12; i++) {
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      opts.push({ value: `${yr}-${mo}`, label: formatMonthName(`${yr}-${mo}`) });
      d.setMonth(d.getMonth() - 1);
    }
    return opts;
  }, []);

  function formatMonthName(mStr) {
    const [yr, mo] = mStr.split("-").map(Number);
    const d = new Date(yr, mo - 1, 1);
    return `${window.P_MO[d.getMonth()]} ${yr}`;
  }

  // Get roster offsets for the selected month
  const getOffsetsForMonth = (monthStr) => {
    const [year, month] = monthStr.split("-").map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    const offsets = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      if (typeof F.offsetOf === 'function') {
        offsets.push(F.offsetOf(new Date(d)));
      }
    }
    return offsets;
  };
  
  // Claims filters
  const pendingClaims = claims.filter(c => {
    const matchesBranch = branch === "global" || c.branch === branch;
    return matchesBranch && c.status === "pending" && filterNiyas(c.name);
  });
  
  // Grouping approved/rejected claims by month for history view
  const monthWiseClaims = React.useMemo(() => {
    const grouped = {}; // YYYY-MM -> profile_id -> { name, branch, otHours, toilDays, claims: [] }
    claims.forEach(c => {
      if (c.status === "pending") return;
      if (branch !== "global" && c.branch !== branch) return;
      if (!filterNiyas(c.name)) return;
      
      const dObj = new Date(c.date + "T00:00:00");
      if (isNaN(dObj.getTime())) return;
      const mStr = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, "0")}`;
      
      grouped[mStr] = grouped[mStr] || {};
      grouped[mStr][c.profile_id] = grouped[mStr][c.profile_id] || {
        name: c.name,
        branch: c.branch,
        otHours: 0,
        toilDays: 0,
        claims: []
      };
      
      grouped[mStr][c.profile_id].claims.push(c);
      if (c.status === "approved") {
        if (c.toil_payout) {
          let list = [];
          try {
            list = typeof c.toil_dates === 'string' ? JSON.parse(c.toil_dates) : (c.toil_dates || []);
          } catch (e) {
            list = c.toil_dates || [];
          }
          grouped[mStr][c.profile_id].toilDays += Array.isArray(list) ? list.length : 1;
        } else {
          grouped[mStr][c.profile_id].otHours += c.ot_hours;
        }
      }
    });
    return grouped;
  }, [claims, branch]);

  // Aggregate stats of approved claims for selected month
  // Aggregate stats of approved claims for selected month directly from Roster
  const monthApprovedOt = React.useMemo(() => {
    let totalOt = 0;
    const offsets = getOffsetsForMonth(selectedMonth);
    Object.entries(F._staffRatesByName || {})
      .filter(([name, p]) => (branch === "global" || (p.branch || "Calicut").toLowerCase() === branch.toLowerCase()) && filterNiyas(name))
      .forEach(([name]) => {
        const dbRoster = F._dbRoster?.[name] || {};
        offsets.forEach(off => {
          const cell = dbRoster[off];
          if (cell && typeof cell === "object" && cell.ot) {
            totalOt += cell.ot;
          }
        });
      });
    return totalOt;
  }, [claims, F._dbRoster, F._staffRatesByName, selectedMonth, branch]);
  
  const monthApprovedToilDays = React.useMemo(() => {
    let totalToil = 0;
    const offsets = getOffsetsForMonth(selectedMonth);
    Object.entries(F._staffRatesByName || {})
      .filter(([name, p]) => (branch === "global" || (p.branch || "Calicut").toLowerCase() === branch.toLowerCase()) && filterNiyas(name))
      .forEach(([name]) => {
        const dbRoster = F._dbRoster?.[name] || {};
        offsets.forEach(off => {
          const cell = dbRoster[off];
          const code = cell ? (typeof cell === "string" ? cell : cell.code) : "";
          if (String(code).toUpperCase() === "TP") {
            totalToil++;
          }
        });
      });
    return totalToil;
  }, [claims, F._dbRoster, F._staffRatesByName, selectedMonth, branch]);

  const calcClaimPayout = (c) => {
    if (c.toil_payout) {
      let dates = [];
      try {
        dates = typeof c.toil_dates === 'string' ? JSON.parse(c.toil_dates) : (c.toil_dates || []);
      } catch (e) {
        dates = c.toil_dates || [];
      }
      return c.daily_rate * 1.5 * (Array.isArray(dates) && dates.length ? dates.length : 1);
    }
    return c.ot_hours * c.hourly_rate * 1.75;
  };
  
  // Calculate total monthly costs for cards
  const pendingMonthClaims = claims.filter(c => c.status === "pending" && c.date.startsWith(selectedMonth) && (branch === "global" || c.branch === branch) && filterNiyas(c.name));
  const totalApprovedMonthCost = React.useMemo(() => {
    let cost = 0;
    const offsets = getOffsetsForMonth(selectedMonth);
    Object.entries(F._staffRatesByName || {})
      .filter(([name, p]) => (branch === "global" || (p.branch || "Calicut").toLowerCase() === branch.toLowerCase()) && filterNiyas(name))
      .forEach(([name, p]) => {
        const rates = F._staffRatesByProfileId?.[p.id] || { monthly_salary: 0, hourly_rate: 0, daily_rate: 0 };
        const mp = F._monthlyPayroll?.[p.id]?.[selectedMonth];
        const monthly_salary = mp ? mp.monthly_salary : rates.monthly_salary;
        const dailyRate = monthly_salary / 30;
        const hourlyRate = dailyRate / 8 * 1.75;
        
        const dbRoster = F._dbRoster?.[name] || {};
        let otHours = 0;
        let toilDays = 0;
        offsets.forEach(off => {
          const cell = dbRoster[off];
          if (cell) {
            if (typeof cell === "object" && cell.ot) {
              otHours += cell.ot;
            }
            const code = typeof cell === "string" ? cell : cell.code;
            if (String(code).toUpperCase() === "TP") {
              toilDays++;
            }
          }
        });
        cost += (otHours * hourlyRate) + (toilDays * dailyRate * 1.5);
      });
    return cost;
  }, [claims, F._dbRoster, F._staffRatesByName, F._staffRatesByProfileId, F._monthlyPayroll, selectedMonth, branch]);

  const totalPendingMonthCost = pendingMonthClaims.reduce((sum, c) => sum + calcClaimPayout(c), 0);

  // Print function
  const printPayslip = (elementId) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    const printWindow = window.open("", "_blank", "width=850,height=800");
    if (!printWindow) {
      alert("Please allow popups to print payslips");
      return;
    }
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Salary Slip</title>
          <style>
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              margin: 40px;
              background: #fff;
              color: #333;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            * {
              box-sizing: border-box;
            }
          </style>
        </head>
        <body>
          <div style="max-width: 650px; margin: 0 auto;">
            ${element.innerHTML}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadSinglePng = async (elementId, name) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff"
      });
      const imgData = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `Payslip_${name.replace(/\s+/g, "_")}_${selectedMonth}.png`;
      link.href = imgData;
      link.click();
      toast("Payslip downloaded as PNG", "check");
    } catch (e) {
      console.error(e);
      toast("Download failed", "alert");
    }
  };

  const handleBatchDownload = async () => {
    const staffList = Object.entries(F._staffRatesByName || {})
      .filter(([name]) => filterNiyas(name))
      .map(([name, p]) => ({ name, id: p.id, branch: p.branch || "Calicut", role: p.role }));
    
    if (staffList.length === 0) return;
    
    toast("Starting batch download...", "download");
    
    for (const s of staffList) {
      const mp = F._monthlyPayroll?.[s.id]?.[selectedMonth];
      const rates = F._staffRatesByProfileId?.[s.id] || { monthly_salary: 0, hourly_rate: 0, daily_rate: 0 };
      const monthly_salary = mp ? mp.monthly_salary : rates.monthly_salary;
      const manualAddition = mp ? mp.manual_addition : 0;
      const manualDeduction = mp ? mp.manual_deduction : 0;
      
      const parsedNotes = mp ? parseNotes(mp.adjustment_notes) : { addition: "", deduction: "" };
      const addNotes = parsedNotes.addition;
      const dedNotes = parsedNotes.deduction;
      
      const dailyRate = monthly_salary / 30;
      const hourlyRate = dailyRate / 8 * 1.75;
      
      const offsets = getOffsetsForMonth(selectedMonth);
      const dbRoster = F._dbRoster?.[s.name] || {};
      let otHours = 0;
      let toilDays = 0;
      offsets.forEach(off => {
        const cell = dbRoster[off];
        if (cell) {
          if (typeof cell === "object" && cell.ot) {
            otHours += cell.ot;
          }
          const code = typeof cell === "string" ? cell : cell.code;
          if (String(code).toUpperCase() === "TP") {
            toilDays++;
          }
        }
      });
      const otSalary = otHours * hourlyRate;
      const toilSalary = toilDays * dailyRate * 1.5;
      
      let leaveDays = 0;
      offsets.forEach(off => {
        const cell = dbRoster[off];
        const code = cell ? (typeof cell === "string" ? cell : cell.code) : "";
        if (String(code).toUpperCase() === "L") {
          leaveDays++;
        }
      });
      const leaveDeduction = leaveDays * monthly_salary / 30;
      
      const totalEarnings = monthly_salary + otSalary + toilSalary + manualAddition;
      const totalDeductions = leaveDeduction + manualDeduction;
      const netSalary = totalEarnings - totalDeductions;

      // Create hidden rendering div
      const div = document.createElement("div");
      div.style.position = "fixed";
      div.style.left = "-9999px";
      div.style.top = "-9999px";
      document.body.appendChild(div);
      
      div.innerHTML = `
        <div style="width: 650px; padding: 36px; background: #ffffff; color: #2d3748; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; border: 1.5px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header and Logo -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #34908B; padding-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="/images/forun_logo.png" alt="Forun Logo" style="height: 52px; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.06));" />
            </div>
            <div style="text-align: right;">
              <h2 style="margin: 0; font-size: 14px; font-weight: 800; color: #718096; letter-spacing: 1px; text-transform: uppercase;">SALARY SLIP</h2>
              <p style="margin: 4px 0 0 0; font-size: 14px; color: #34908B; font-weight: 800; text-transform: uppercase;">${formatMonthName(selectedMonth)}</p>
            </div>
          </div>
          
          <!-- Staff and Gen Details -->
          <div style="background: #f4f9f7; border: 1px solid #e6f2dd; border-radius: 8px; padding: 14px 18px; display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 16px; margin: 20px 0; font-size: 12.5px;">
            <div style="display: flex; flexDirection: column; gap: 6px;">
              <div><span style="color: #718096; font-weight: 500;">Employee Name:</span> <strong style="color: #2d3748;">${s.name}</strong></div>
              <div><span style="color: #718096; font-weight: 500;">Role/Designation:</span> <strong style="color: #2d3748;">Test Centre Administrator</strong></div>
            </div>
            <div style="display: flex; flexDirection: column; gap: 6px; border-left: 1px solid #cbd5e0; padding-left: 16px;">
              <div><span style="color: #718096; font-weight: 500;">Department:</span> <strong style="color: #2d3748;">${s.branch} Center</strong></div>
              <div><span style="color: #718096; font-weight: 500;">Slip Issue Date:</span> <strong style="color: #2d3748;">${new Date().toLocaleDateString()}</strong></div>
            </div>
          </div>

          <!-- Earnings vs Deductions Grid -->
          <div style="display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 20px; margin: 24px 0;">
            <!-- Earnings -->
            <div style="border-right: 1px solid #edf2f7; padding-right: 10px;">
              <h3 style="margin: 0 0 10px 0; font-size: 11.5px; font-weight: 800; color: #34908B; background: #e6f2dd; padding: 6px 10px; borderRadius: 4px; letter-spacing: 0.5px; text-transform: uppercase;">EARNINGS</h3>
              <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
                <tbody>
                  <tr style="border-bottom: 1px solid #edf2f7;">
                    <td style="padding: 8px 0; color: #4a5568;">Basic Monthly Salary</td>
                    <td style="text-align: right; font-weight: 650; color: #2d3748;">₹${monthly_salary.toFixed(2)}</td>
                  </tr>
                  ${otHours > 0 ? `
                  <tr style="border-bottom: 1px solid #edf2f7;">
                    <td style="padding: 8px 0; color: #4a5568;">Overtime Pay (${otHours.toFixed(1)} hrs)</td>
                    <td style="text-align: right; font-weight: 650; color: #2d3748;">₹${otSalary.toFixed(2)}</td>
                  </tr>
                  ` : ''}
                  ${toilDays > 0 ? `
                  <tr style="border-bottom: 1px solid #edf2f7;">
                    <td style="padding: 8px 0; color: #4a5568;">Monthly TOIL Approved (${toilDays} days)</td>
                    <td style="text-align: right; font-weight: 650; color: #2d3748;">₹${toilSalary.toFixed(2)}</td>
                  </tr>
                  ` : ''}
                  ${manualAddition > 0 ? `
                  <tr style="border-bottom: 1px solid #edf2f7;">
                    <td style="padding: 8px 0; color: #4a5568;">Additions ${addNotes ? `<span style="font-size: 9.5px; color: #a0aec0; display: block; font-weight: 500;">${addNotes}</span>` : ''}</td>
                    <td style="text-align: right; font-weight: 650; color: #34908B;">₹${manualAddition.toFixed(2)}</td>
                  </tr>
                  ` : ''}
                </tbody>
              </table>
            </div>

            <!-- Deductions -->
            <div>
              <h3 style="margin: 0 0 10px 0; font-size: 11.5px; font-weight: 800; color: #e53e3e; background: #fff5f5; padding: 6px 10px; borderRadius: 4px; letter-spacing: 0.5px; text-transform: uppercase;">DEDUCTIONS</h3>
              <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
                <tbody>
                  ${leaveDays > 0 ? `
                  <tr style="border-bottom: 1px solid #edf2f7;">
                    <td style="padding: 8px 0; color: #4a5568;">Leave Deductions (${leaveDays} days)</td>
                    <td style="text-align: right; font-weight: 650; color: #e53e3e;">-₹${leaveDeduction.toFixed(2)}</td>
                  </tr>
                  ` : ''}
                  ${manualDeduction > 0 ? `
                  <tr style="border-bottom: 1px solid #edf2f7;">
                    <td style="padding: 8px 0; color: #4a5568;">Deductions ${dedNotes ? `<span style="font-size: 9.5px; color: #a0aec0; display: block; font-weight: 500;">${dedNotes}</span>` : ''}</td>
                    <td style="text-align: right; font-weight: 650; color: #e53e3e;">-₹${manualDeduction.toFixed(2)}</td>
                  </tr>
                  ` : ''}
                  ${leaveDays === 0 && manualDeduction === 0 ? `
                  <tr>
                    <td style="padding: 10px 0; color: #a0aec0; font-style: italic;">No deductions applied</td>
                    <td style="text-align: right; color: #a0aec0;">—</td>
                  </tr>
                  ` : ''}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Total Gross Info and Net box -->
          <div style="display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 20px; border-top: 1.5px solid #e2e8f0; padding-top: 16px; margin-bottom: 30px;">
            <div style="display: flex; flex-direction: column; gap: 6px; justify-content: center;">
              <div style="display: flex; justify-content: space-between; font-size: 12px; color: #4a5568;">
                <span>Gross Earnings:</span>
                <span style="font-weight: 600; color: #2d3748;">₹${totalEarnings.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 12px; color: #4a5568; margin-top: 4px;">
                <span>Gross Deductions:</span>
                <span style="font-weight: 600; color: #2d3748;">₹${totalDeductions.toFixed(2)}</span>
              </div>
            </div>
            <div style="background: linear-gradient(135deg, #a5e9dd 0%, #34908B 100%); color: #ffffff; padding: 12px 18px; border-radius: 8px; display: flex; flex-direction: column; justify-content: center; align-items: flex-end; box-shadow: 0 4px 10px rgba(52, 144, 139, 0.15);">
              <div style="font-size: 10px; font-weight: 700; letter-spacing: 0.5px; opacity: 0.9;">NET PAYABLE SALARY</div>
              <div style="font-size: 20px; font-weight: 950; margin-top: 2px;">₹${netSalary.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
            </div>
          </div>

          <!-- Signatures -->
          <div style="display: flex; justify-content: space-between; margin-top: 36px; padding-top: 16px; border-top: 1px solid #edf2f7; font-size: 11px; color: #718096;">
            <div style="position: relative;">
              <div style="height: 35px; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; position: absolute; top: -20px; left: 0; right: 0; text-align: center;">
                <span style="font-family: 'Brush Script MT', 'Dancing Script', 'Segoe Print', cursive; font-size: 19px; font-weight: bold; color: #34908B; line-height: 1; display: block;">Mithun</span>
                <span style="font-size: 7.5px; color: #a0aec0; font-family: monospace; display: block; margin-top: 1px; white-space: nowrap;">Digitally Signed: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</span>
              </div>
              <div style="border-top: 1px dashed #cbd5e0; width: 160px; text-align: center; padding-top: 6px; margin-top: 22px;">Prepared By (Mithun)</div>
            </div>
            <div>
              <div style="height: 22px;"></div>
              <div style="border-top: 1px dashed #cbd5e0; width: 160px; text-align: center; padding-top: 6px; margin-top: 22px;">Employee Signature</div>
            </div>
          </div>
        </div>
      `;

      try {
        const canvas = await html2canvas(div.firstElementChild, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff"
        });
        const imgData = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.download = `Payslip_${s.name.replace(/\s+/g, "_")}_${selectedMonth}.png`;
        link.href = imgData;
        link.click();
      } catch (err) {
        console.error(err);
      } finally {
        document.body.removeChild(div);
      }
      
      // Prevent browser throttling
      await new Promise(r => setTimeout(r, 600));
    }
    toast("Batch download complete", "check");
  };

  const SCOL = { pending: "var(--warn)", approved: "var(--ok)", rejected: "var(--bad)" };
  
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHeader eyebrow="Modules // Admin" title="OT & TOIL Claims Manager" />
      
      {/* Selector Month for payroll and cost cards */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)" }}>Target Payroll Month:</span>
        <select 
          value={selectedMonth} 
          onChange={(e) => setSelectedMonth(e.target.value)} 
          className="glass-2"
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--hairline)", color: "var(--ink)", background: "transparent", fontSize: 13.5, fontWeight: 650, outline: "none", cursor: "pointer" }}
        >
          {monthsOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <div className="glass" style={{ padding: 20, borderRadius: 16, borderLeft: "4px solid var(--accent)", position: "relative" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--ink-4)", letterSpacing: "0.05em" }}>Month Approved Cost</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)", marginTop: 8 }}>₹{totalApprovedMonthCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
          <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 6 }}>For approved OT & TOIL in {formatMonthName(selectedMonth)}</div>
        </div>
        
        <div className="glass" style={{ padding: 20, borderRadius: 16, borderLeft: "4px solid var(--warn)", position: "relative" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--ink-4)", letterSpacing: "0.05em" }}>Month Pending Cost</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--warn)", marginTop: 8 }}>₹{totalPendingMonthCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
          <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 6 }}>Estimated payout for pending claims</div>
        </div>
        
        <div className="glass" style={{ padding: 20, borderRadius: 16, borderLeft: "4px solid var(--v-ielts)", position: "relative" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--ink-4)", letterSpacing: "0.05em" }}>Month Approved OT</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--v-ielts)", marginTop: 8 }}>{monthApprovedOt.toFixed(1)} hrs</div>
          <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 6 }}>1.75x pay multiplier applied</div>
        </div>
        
        <div className="glass" style={{ padding: 20, borderRadius: 16, borderLeft: "4px solid var(--v-pearson)", position: "relative" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--ink-4)", letterSpacing: "0.05em" }}>Month TOIL Payouts</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--v-pearson)", marginTop: 8 }}>{monthApprovedToilDays} days</div>
          <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 6 }}>1.5x daily rate paid out</div>
        </div>
      </div>
      
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <Segmented value={tab} onChange={setTab} size="sm" options={[
          { value: "pending", label: "Pending Claims" },
          { value: "history", label: "Month-Wise Claims" },
          { value: "payroll", label: "Payroll Calculation" },
          { value: "rates", label: "Staff Rates Config" },
          { value: "discussion", label: "Roster Discussions" }
        ]} />
        <div style={{ flex: 1 }} />
        <button onClick={load} className="tap glass-2" style={{ width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center", border: "1px solid var(--hairline)", cursor: "pointer", color: "var(--ink-2)" }}>
          <Icon name="refresh" size={15} />
        </button>
      </div>
      
      {loading ? (
        <div className="glass" style={{ padding: 40, borderRadius: "var(--radius)", textAlign: "center", color: "var(--ink-4)" }}>
          Loading claims data…
        </div>
      ) : tab === "pending" ? (
        pendingClaims.length === 0 ? (
          <div className="glass" style={{ padding: 40, borderRadius: "var(--radius)", textAlign: "center", color: "var(--ink-4)" }}>
            No pending claims found.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {pendingClaims.map((c) => {
              const isToil = c.toil_payout;
              const payout = calcClaimPayout(c);
              const kindColor = isToil ? "var(--v-pearson)" : "var(--v-ielts)";
              
              return (
                <div key={c.id} className="glass rise" style={{ padding: 20, borderRadius: "var(--radius)", display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Avatar name={c.name} size={36} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ink)" }}>{c.name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 1 }}>
                        {c.branch} Center · Submitted on {new Date(c.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", padding: "4px 10px", borderRadius: 99,
                      color: kindColor, background: `color-mix(in oklch, ${kindColor} 15%, transparent)` }}>
                      {isToil ? "TOIL Payout" : "Overtime"}
                    </span>
                  </div>
                  
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 14, padding: "10px 14px", borderRadius: 10, background: "var(--inset)", border: "1px solid var(--hairline)" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <span style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 600 }}>Date of Work</span>
                      <span style={{ fontSize: 13, fontWeight: 750, color: "var(--ink)" }}>{c.date}</span>
                    </div>
                    
                    {!isToil && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <span style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 600 }}>Submitted OT Hours</span>
                        <span style={{ fontSize: 13, fontWeight: 750, color: "var(--ink)" }}>{c.ot_hours.toFixed(2)} hrs (${c.start_time} - ${c.end_time || "5:00 PM"})</span>
                      </div>
                    )}
                    
                    {isToil && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <span style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 600 }}>TOIL Dates to Cash Out</span>
                        <span style={{ fontSize: 12.5, fontWeight: 750, color: "var(--ink)" }}>
                          {(() => {
                            let dates = [];
                            try { dates = typeof c.toil_dates === 'string' ? JSON.parse(c.toil_dates) : (c.toil_dates || []); } catch(e) {}
                            return Array.isArray(dates) ? dates.join(", ") : "1 day";
                          })()}
                        </span>
                      </div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <span style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 600 }}>Base Rate</span>
                      <span style={{ fontSize: 13, fontWeight: 750, color: "var(--ink)" }}>₹{isToil ? `${c.daily_rate}/d` : `${c.hourly_rate}/h`}</span>
                    </div>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end" }}>
                      <span style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 600 }}>Estimated Payout</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "var(--ok)" }}>₹{payout.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                  
                  {c.notes && (
                    <p style={{ margin: 0, padding: "8px 12px", borderRadius: 8, background: "var(--inset)", fontSize: 12.5, color: "var(--ink-3)", fontStyle: "italic", fontFamily: "var(--font-serif)", lineHeight: 1.4 }}>
                      “{c.notes}”
                    </p>
                  )}
                  
                  <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                    {/* OT Hour Adjustment Input Box */}
                    {!isToil ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)" }}>Approved Hours:</span>
                        <input 
                          type="number"
                          step="0.25"
                          min="0"
                          value={adjustedHours[c.id] !== undefined ? adjustedHours[c.id] : c.ot_hours}
                          onChange={(e) => setAdjustedHours(prev => ({ ...prev, [c.id]: parseFloat(e.target.value) || 0 }))}
                          className="glass-2 tabnum"
                          style={{ width: 80, padding: "6px 8px", borderRadius: 7, border: "1px solid var(--hairline)", background: "transparent", color: "var(--ink)", textAlign: "center", fontSize: 13, fontWeight: 700 }}
                        />
                      </div>
                    ) : <div />}
                    
                    <div style={{ display: "flex", gap: 9 }}>
                      <button 
                        onClick={() => resolve(c.id, "Approved", isToil ? undefined : (adjustedHours[c.id] !== undefined ? adjustedHours[c.id] : c.ot_hours))} 
                        className="tap" 
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 16px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "var(--font)", fontSize: 12.5, fontWeight: 750, color: "var(--accent-ink)", background: "var(--accent)" }}
                      >
                        <Icon name="check" size={14} stroke={2.6} /> Approve
                      </button>
                      <button 
                        onClick={() => resolve(c.id, "Rejected")} 
                        className="tap glass-2" 
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 16px", borderRadius: 8, border: "1px solid var(--hairline)", cursor: "pointer", fontFamily: "var(--font)", fontSize: 12.5, fontWeight: 650, color: "var(--ink-2)" }}
                      >
                        <Icon name="x" size={14} stroke={2.6} /> Reject
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : tab === "history" ? (
        Object.keys(monthWiseClaims).length === 0 ? (
          <div className="glass" style={{ padding: 40, borderRadius: "var(--radius)", textAlign: "center", color: "var(--ink-4)" }}>
            No resolved claims history found.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {Object.entries(monthWiseClaims)
              .sort((a, b) => b[0].localeCompare(a[0])) // sort months descending
              .map(([mStr, staffGroup]) => {
                const isExpanded = expandedMonths[mStr];
                return (
                  <div key={mStr} className="glass" style={{ padding: 20, borderRadius: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div 
                      onClick={() => setExpandedMonths(prev => ({ ...prev, [mStr]: !isExpanded }))}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                    >
                      <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
                        <Icon name={isExpanded ? "arrowD" : "arrowR"} size={16} />
                        {formatMonthName(mStr)} History
                      </h3>
                      <span className="mono" style={{ fontSize: 12, color: "var(--ink-4)", fontWeight: 650 }}>
                        {Object.keys(staffGroup).length} Staff Members
                      </span>
                    </div>

                    {isExpanded && (
                      <div className="scroll-soft" style={{ overflowX: "auto", borderTop: "1px solid var(--hairline)", paddingTop: 12 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                          <thead>
                            <tr style={{ borderBottom: "1px solid var(--hairline)" }}>
                              <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 10.5, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase" }}>Employee</th>
                              <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 10.5, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase" }}>Center</th>
                              <th style={{ textAlign: "right", padding: "8px 12px", fontSize: 10.5, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase" }}>Approved OT</th>
                              <th style={{ textAlign: "right", padding: "8px 12px", fontSize: 10.5, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase" }}>Approved TOIL Payouts</th>
                              <th style={{ textAlign: "center", padding: "8px 12px", fontSize: 10.5, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase" }}>Claims Details</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(staffGroup).map(([profileId, sInfo]: [string, any]) => (
                              <tr key={profileId} style={{ borderBottom: "1px solid var(--hairline)" }}>
                                <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 650, color: "var(--ink)" }}>{sInfo.name}</td>
                                <td style={{ padding: "10px 12px", fontSize: 12.5, color: "var(--ink-3)" }}>{sInfo.branch}</td>
                                <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 13, fontWeight: 650 }} className="tabnum">{sInfo.otHours.toFixed(1)} hrs</td>
                                <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 13, fontWeight: 650 }} className="tabnum">{sInfo.toilDays} days</td>
                                <td style={{ padding: "10px 12px", textAlign: "center" }}>
                                  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center", fontSize: 11, color: "var(--ink-4)" }}>
                                    {sInfo.claims.map((cl) => {
                                      const isToil = cl.toil_payout;
                                      return (
                                        <div key={cl.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                          <span style={{ fontWeight: 600 }} className="mono">{cl.date}</span>
                                          <span style={{ padding: "1px 6px", borderRadius: 4, background: "var(--inset)", fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: cl.status === 'approved' ? "var(--ok)" : "var(--bad)" }}>
                                            {isToil ? "TOIL" : "OT"} · {cl.status}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )
      ) : tab === "payroll" ? (
        <div className="glass" style={{ padding: 24, borderRadius: 16, display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 750, color: "var(--ink)" }}>Monthly Payroll Calculation</h3>
              <p style={{ margin: 0, fontSize: 12, color: "var(--ink-4)" }}>Payroll summary for {formatMonthName(selectedMonth)}. Save individual rows to apply manual additions/deductions.</p>
            </div>
            <button 
              onClick={handleBatchDownload} 
              className="tap btn-accent" 
              style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 38, padding: "0 18px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "var(--font)", fontSize: 13, fontWeight: 750, background: "var(--accent)", color: "var(--accent-ink)" }}
            >
              <Icon name="download" size={15} /> Batch Download Slips
            </button>
          </div>

          <div className="scroll-soft" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--hairline)" }}>
                  <th style={{ textAlign: "left", padding: "10px 8px", fontSize: 10, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase" }}>Employee</th>
                  <th style={{ textAlign: "right", padding: "10px 8px", fontSize: 10, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase" }}>Monthly Sal.</th>
                  <th style={{ textAlign: "right", padding: "10px 8px", fontSize: 10, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase" }}>Daily Sal.</th>
                  <th style={{ textAlign: "right", padding: "10px 8px", fontSize: 10, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase" }}>OT Rate</th>
                  <th style={{ textAlign: "right", padding: "10px 8px", fontSize: 10, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase" }}>Approved OT</th>
                  <th style={{ textAlign: "right", padding: "10px 8px", fontSize: 10, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase" }}>OT Pay</th>
                  <th style={{ textAlign: "right", padding: "10px 8px", fontSize: 10, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase" }}>TOIL Payouts</th>
                  <th style={{ textAlign: "right", padding: "10px 8px", fontSize: 10, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase" }}>TOIL Pay</th>
                  <th style={{ textAlign: "right", padding: "10px 8px", fontSize: 10, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase" }}>Leaves (L)</th>
                  <th style={{ textAlign: "right", padding: "10px 8px", fontSize: 10, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase" }}>Leave Ded.</th>
                  <th style={{ textAlign: "left", padding: "10px 8px", fontSize: 10, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase" }}>Additions / Notes</th>
                  <th style={{ textAlign: "left", padding: "10px 8px", fontSize: 10, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase" }}>Deductions / Notes</th>
                  <th style={{ textAlign: "right", padding: "10px 8px", fontSize: 10, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase" }}>Net Pay</th>
                  <th style={{ textAlign: "center", padding: "10px 8px", fontSize: 10, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(F._staffRatesByName || {})
                  .filter(([name]) => filterNiyas(name))
                  .map(([name, p]) => {
                    const mp = F._monthlyPayroll?.[p.id]?.[selectedMonth];
                    const rates = F._staffRatesByProfileId?.[p.id] || { monthly_salary: 0, hourly_rate: 0, daily_rate: 0 };
                    
                    const monthly_salary = editingPayroll[p.id]?.monthly_salary !== undefined 
                      ? parseFloat(editingPayroll[p.id].monthly_salary) || 0 
                      : (mp ? mp.monthly_salary : rates.monthly_salary);
                      
                    const manualAddition = editingPayroll[p.id]?.manual_addition !== undefined 
                      ? parseFloat(editingPayroll[p.id].manual_addition) || 0 
                      : (mp ? mp.manual_addition : 0);
                      
                    const manualDeduction = editingPayroll[p.id]?.manual_deduction !== undefined 
                      ? parseFloat(editingPayroll[p.id].manual_deduction) || 0 
                      : (mp ? mp.manual_deduction : 0);
                      
                    const parsedNotes = mp ? parseNotes(mp.adjustment_notes) : { addition: "", deduction: "" };
                    const additionNote = editingPayroll[p.id]?.addition_note !== undefined 
                      ? editingPayroll[p.id].addition_note 
                      : parsedNotes.addition;
                      
                    const deductionNote = editingPayroll[p.id]?.deduction_note !== undefined 
                      ? editingPayroll[p.id].deduction_note 
                      : parsedNotes.deduction;

                    const dailyRate = monthly_salary / 30;
                    const hourlyRate = dailyRate / 8 * 1.75;
                    
                    const offsets = getOffsetsForMonth(selectedMonth);
                    const dbRoster = F._dbRoster?.[name] || {};
                    let otHours = 0;
                    let toilDays = 0;
                    offsets.forEach(off => {
                      const cell = dbRoster[off];
                      if (cell) {
                        if (typeof cell === "object" && cell.ot) {
                          otHours += cell.ot;
                        }
                        const code = typeof cell === "string" ? cell : cell.code;
                        if (String(code).toUpperCase() === "TP") {
                          toilDays++;
                        }
                      }
                    });
                    const otSalary = otHours * hourlyRate;
                    const toilSalary = toilDays * dailyRate * 1.5;
                    
                    // Count leave days "L" in roster
                    let leaveDays = 0;
                    offsets.forEach(off => {
                      const cell = dbRoster[off];
                      const code = cell ? (typeof cell === "string" ? cell : cell.code) : "";
                      if (String(code).toUpperCase() === "L") {
                        leaveDays++;
                      }
                    });
                    const leaveDeduction = leaveDays * monthly_salary / 30;
                    
                    const totalEarnings = monthly_salary + otSalary + toilSalary + manualAddition;
                    const totalDeductions = leaveDeduction + manualDeduction;
                    const netSalary = totalEarnings - totalDeductions;
                    const isEdited = editingPayroll[p.id] !== undefined;

                    return (
                      <tr key={p.id} style={{ borderBottom: "1px solid var(--hairline)" }}>
                        <td style={{ padding: "10px 8px", fontSize: 13, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
                          {name}
                          <div style={{ fontSize: 10, color: "var(--ink-4)", fontWeight: 500 }}>{p.role || "Staff"}</div>
                        </td>
                        <td style={{ padding: "8px" }}>
                          <input 
                            type="number"
                            value={monthly_salary || ""}
                            onChange={(e) => handlePayrollEdit(p.id, "monthly_salary", e.target.value)}
                            className="glass-2 tabnum"
                            style={{ width: 85, padding: "5px 7px", borderRadius: 6, border: "1px solid var(--hairline)", background: "transparent", color: "var(--ink)", textAlign: "right", fontSize: 12 }}
                          />
                        </td>
                        <td style={{ padding: "8px", textAlign: "right", fontSize: 12 }} className="tabnum">₹{dailyRate.toFixed(0)}</td>
                        <td style={{ padding: "8px", textAlign: "right", fontSize: 12 }} className="tabnum">₹{hourlyRate.toFixed(0)}</td>
                        <td style={{ padding: "8px", textAlign: "right", fontSize: 12 }} className="tabnum">{otHours.toFixed(1)} h</td>
                        <td style={{ padding: "8px", textAlign: "right", fontSize: 12 }} className="tabnum">₹{otSalary.toFixed(0)}</td>
                        <td style={{ padding: "8px", textAlign: "right", fontSize: 12 }} className="tabnum">{toilDays} d</td>
                        <td style={{ padding: "8px", textAlign: "right", fontSize: 12 }} className="tabnum">₹{toilSalary.toFixed(0)}</td>
                        <td style={{ padding: "8px", textAlign: "right", fontSize: 12 }} className="tabnum">{leaveDays} d</td>
                        <td style={{ padding: "8px", textAlign: "right", fontSize: 12, color: "var(--bad)" }} className="tabnum">-₹{leaveDeduction.toFixed(0)}</td>
                        
                        {/* Addition notes */}
                        <td style={{ padding: "8px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <input 
                              type="number"
                              placeholder="₹ Add"
                              value={manualAddition || ""}
                              onChange={(e) => handlePayrollEdit(p.id, "manual_addition", e.target.value)}
                              className="glass-2 tabnum"
                              style={{ width: 75, padding: "4px 6px", borderRadius: 6, border: "1px solid var(--hairline)", background: "transparent", color: "var(--ok)", textAlign: "right", fontSize: 12 }}
                            />
                            <input 
                              type="text"
                              placeholder="Reason"
                              value={additionNote}
                              onChange={(e) => handlePayrollEdit(p.id, "addition_note", e.target.value)}
                              className="glass-2"
                              style={{ width: 85, padding: "4px 6px", borderRadius: 6, border: "1px solid var(--hairline)", background: "transparent", color: "var(--ink-2)", fontSize: 11 }}
                            />
                          </div>
                        </td>

                        {/* Deduction notes */}
                        <td style={{ padding: "8px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <input 
                              type="number"
                              placeholder="₹ Ded"
                              value={manualDeduction || ""}
                              onChange={(e) => handlePayrollEdit(p.id, "manual_deduction", e.target.value)}
                              className="glass-2 tabnum"
                              style={{ width: 75, padding: "4px 6px", borderRadius: 6, border: "1px solid var(--hairline)", background: "transparent", color: "var(--bad)", textAlign: "right", fontSize: 12 }}
                            />
                            <input 
                              type="text"
                              placeholder="Reason"
                              value={deductionNote}
                              onChange={(e) => handlePayrollEdit(p.id, "deduction_note", e.target.value)}
                              className="glass-2"
                              style={{ width: 85, padding: "4px 6px", borderRadius: 6, border: "1px solid var(--hairline)", background: "transparent", color: "var(--ink-2)", fontSize: 11 }}
                            />
                          </div>
                        </td>

                        <td style={{ padding: "8px", textAlign: "right", fontSize: 13, fontWeight: 800, color: "var(--ok)" }} className="tabnum">
                          ₹{netSalary.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>

                        <td style={{ padding: "8px", textAlign: "center" }}>
                          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                            <button 
                              onClick={() => handleSavePayroll(p.id, rates.monthly_salary)}
                              disabled={!isEdited}
                              className="tap"
                              style={{ padding: "5px 10px", borderRadius: 6, border: "none", background: isEdited ? "var(--accent)" : "var(--inset)", color: isEdited ? "var(--accent-ink)" : "var(--ink-4)", fontWeight: 700, fontSize: 11, cursor: isEdited ? "pointer" : "default" }}
                            >
                              Save
                            </button>
                            <button 
                              onClick={() => setActivePayslipStaff({
                                id: p.id,
                                name,
                                role: p.role,
                                branch: p.branch || "Calicut",
                                monthly_salary,
                                dailyRate,
                                hourlyRate,
                                otHours,
                                otSalary,
                                toilDays,
                                toilSalary,
                                leaveDays,
                                leaveDeduction,
                                manualAddition,
                                additionNote,
                                manualDeduction,
                                deductionNote,
                                totalEarnings,
                                totalDeductions,
                                netSalary
                              })}
                              className="tap glass-2"
                              style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid var(--hairline)", color: "var(--ink-2)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                            >
                              Slip
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === "rates" ? (
        /* Rates Config Tab */
        <div className="glass" style={{ padding: 24, borderRadius: "var(--radius)", display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 750, color: "var(--ink)" }}>Staff Salaries Configuration</h3>
            <p style={{ margin: 0, fontSize: 12, color: "var(--ink-4)" }}>Set default Monthly Salary for employees. Daily rate (Salary/30) and OT hourly rate (Daily/8 * 1.75) are automatically calculated.</p>
          </div>
          
          <div className="scroll-soft" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--hairline)" }}>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase" }}>Employee</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase" }}>Role</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase" }}>Monthly Salary (₹)</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase" }}>Daily Rate (₹)</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase" }}>OT Hourly Rate (₹)</th>
                  <th style={{ textAlign: "center", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(F._staffRatesByName || {})
                  .filter(([name]) => filterNiyas(name))
                  .map(([name, p]) => {
                    const monthly_salary = editingRates[p.id]?.monthly_salary !== undefined 
                      ? editingRates[p.id].monthly_salary 
                      : (p.monthly_salary || 0);
                    const daily_rate = monthly_salary / 30;
                    const hourly_rate = daily_rate / 8 * 1.75;
                    const isEdited = editingRates[p.id] !== undefined;

                    return (
                      <tr key={p.id} style={{ borderBottom: "1px solid var(--hairline)" }}>
                        <td style={{ padding: "12px", fontSize: 13.5, fontWeight: 650, color: "var(--ink)", display: "flex", alignItems: "center", gap: 10 }}>
                          <Avatar name={name} size={28} />
                          {name}
                        </td>
                        <td style={{ padding: "12px", fontSize: 12.5, color: "var(--ink-3)", fontWeight: 550 }}>
                          {p.role || "Staff"}
                        </td>
                        <td style={{ padding: "12px", textAlign: "right" }}>
                          <input 
                            type="number"
                            value={monthly_salary || ""}
                            onChange={(e) => handleRateChange(p.id, e.target.value)}
                            className="glass-2 tabnum"
                            style={{ width: 120, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--hairline)", background: "transparent", color: "var(--ink)", textAlign: "right", fontSize: 13, outline: "none" }}
                          />
                        </td>
                        <td style={{ padding: "12px", textAlign: "right", fontSize: 13 }} className="tabnum">
                          ₹{daily_rate.toFixed(2)}
                        </td>
                        <td style={{ padding: "12px", textAlign: "right", fontSize: 13 }} className="tabnum">
                          ₹{hourly_rate.toFixed(2)}
                        </td>
                        <td style={{ padding: "12px", textAlign: "center" }}>
                          <button 
                            onClick={() => handleSaveRates(p.id)}
                            disabled={!isEdited}
                            className="tap"
                            style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: isEdited ? "var(--accent)" : "var(--inset)", color: isEdited ? "var(--accent-ink)" : "var(--ink-4)", fontWeight: 700, fontSize: 11.5, cursor: isEdited ? "pointer" : "default", opacity: isEdited ? 1 : 0.6 }}
                          >
                            Save
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === "discussion" ? (
        <RosterDiscussionsAdmin />
      ) : null}

      {/* Salary Slip Modal Popup */}
      {activePayslipStaff && (
        <React.Fragment>
          <div onClick={() => setActivePayslipStaff(null)} style={{ position: "fixed", inset: 0, background: "color-mix(in oklch, var(--shadow-base, #000) 65%, transparent)", backdropFilter: "blur(3px)", zIndex: 998 }} />
          <div role="dialog" className="glass rise" style={{ position: "fixed", zIndex: 999, top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "min(690px, 95vw)", maxHeight: "90vh", overflowY: "auto", borderRadius: "var(--radius)", padding: 24, boxShadow: "var(--shadow-lift)", display: "flex", flexDirection: "column", gap: 20 }}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>Payslip Preview</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button 
                  onClick={() => handleDownloadSinglePng("payslip-to-print", activePayslipStaff.name)}
                  className="tap glass-2"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--hairline)", fontSize: 12, fontWeight: 700, color: "var(--ink)", cursor: "pointer" }}
                >
                  <Icon name="download" size={13} /> PNG
                </button>
                <button 
                  onClick={() => printPayslip("payslip-to-print")}
                  className="tap glass-2"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--hairline)", fontSize: 12, fontWeight: 700, color: "var(--ink)", cursor: "pointer" }}
                >
                  <Icon name="printer" size={13} /> Print / PDF
                </button>
                <button 
                  onClick={() => setActivePayslipStaff(null)} 
                  className="tap glass-2" 
                  style={{ width: 28, height: 28, borderRadius: 999, display: "grid", placeItems: "center", cursor: "pointer", color: "var(--ink-2)", border: "1px solid var(--hairline)" }}
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            </div>

            {/* Payslip Design */}
            <div style={{ display: "flex", justifyContent: "center", background: "#f1f5f9", padding: "20px 10px", borderRadius: 12 }}>
              <div id="payslip-to-print" style={{ width: 610, padding: 36, background: "#ffffff", color: "#2d3748", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
                
                {/* Logo & Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2.5px solid #34908B", paddingBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <img src="/images/forun_logo.png" alt="Forun Logo" style={{ height: 52, objectFit: "contain", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.06))" }} />
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#718096", letterSpacing: "1px", textTransform: "uppercase" }}>SALARY SLIP</h2>
                    <p style={{ margin: "4px 0 0 0", fontSize: 14, color: "#34908B", fontWeight: 800, textTransform: "uppercase" }}>{formatMonthName(selectedMonth)}</p>
                  </div>
                </div>
                
                {/* Employee Details Info block */}
                <div style={{ background: "#f4f9f7", border: "1px solid #e6f2dd", borderRadius: 8, padding: "14px 18px", display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16, margin: "20px 0", fontSize: 12.5, color: "#2d3748" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div><span style={{ color: "#718096", fontWeight: 500 }}>Employee Name:</span> <strong>{activePayslipStaff.name}</strong></div>
                    <div><span style={{ color: "#718096", fontWeight: 500 }}>Role/Designation:</span> <strong>Test Centre Administrator</strong></div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, borderLeft: "1px solid #cbd5e0", paddingLeft: 16 }}>
                    <div><span style={{ color: "#718096", fontWeight: 500 }}>Department:</span> <strong>{activePayslipStaff.branch} Center</strong></div>
                    <div><span style={{ color: "#718096", fontWeight: 500 }}>Slip Issue Date:</span> <strong>{new Date().toLocaleDateString()}</strong></div>
                  </div>
                </div>

                {/* Earnings & Deductions Tables */}
                <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 20, margin: "24px 0" }}>
                  {/* Earnings */}
                  <div style={{ borderRight: "1px solid #edf2f7", paddingRight: 10 }}>
                    <h3 style={{ margin: "0 0 10px 0", fontSize: 11.5, fontWeight: 800, color: "#34908B", background: "#e6f2dd", padding: "6px 10px", borderRadius: 4, letterSpacing: "0.5px", textTransform: "uppercase" }}>EARNINGS</h3>
                    <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                      <tbody>
                        <tr style={{ borderBottom: "1px solid #edf2f7" }}>
                          <td style={{ padding: "8px 0", color: "#4a5568" }}>Basic Salary</td>
                          <td style={{ textAlign: "right", fontWeight: 650, color: "#2d3748" }}>₹{activePayslipStaff.monthly_salary.toFixed(2)}</td>
                        </tr>
                        {activePayslipStaff.otHours > 0 && (
                          <tr style={{ borderBottom: "1px solid #edf2f7" }}>
                            <td style={{ padding: "8px 0", color: "#4a5568" }}>Overtime Pay ({activePayslipStaff.otHours.toFixed(1)} hrs)</td>
                            <td style={{ textAlign: "right", fontWeight: 650, color: "#2d3748" }}>₹{activePayslipStaff.otSalary.toFixed(2)}</td>
                          </tr>
                        )}
                        {activePayslipStaff.toilDays > 0 && (
                          <tr style={{ borderBottom: "1px solid #edf2f7" }}>
                            <td style={{ padding: "8px 0", color: "#4a5568" }}>Monthly TOIL Approved ({activePayslipStaff.toilDays} days)</td>
                            <td style={{ textAlign: "right", fontWeight: 650, color: "#2d3748" }}>₹{activePayslipStaff.toilSalary.toFixed(2)}</td>
                          </tr>
                        )}
                        {activePayslipStaff.manualAddition > 0 && (
                          <tr style={{ borderBottom: "1px solid #edf2f7" }}>
                            <td style={{ padding: "8px 0", color: "#4a5568" }}>
                              Additions
                              {activePayslipStaff.additionNote && <div style={{ fontSize: 9.5, color: "#a0aec0", fontWeight: 500 }}>{activePayslipStaff.additionNote}</div>}
                            </td>
                            <td style={{ textAlign: "right", fontWeight: 650, color: "#34908B" }}>₹{activePayslipStaff.manualAddition.toFixed(2)}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Deductions */}
                  <div>
                    <h3 style={{ margin: "0 0 10px 0", fontSize: 11.5, fontWeight: 800, color: "#e53e3e", background: "#fff5f5", padding: "6px 10px", borderRadius: 4, letterSpacing: "0.5px", textTransform: "uppercase" }}>DEDUCTIONS</h3>
                    <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                      <tbody>
                        {activePayslipStaff.leaveDays > 0 && (
                          <tr style={{ borderBottom: "1px solid #edf2f7" }}>
                            <td style={{ padding: "8px 0", color: "#4a5568" }}>Leave Deductions ({activePayslipStaff.leaveDays} days)</td>
                            <td style={{ textAlign: "right", fontWeight: 650, color: "#e53e3e" }}>-₹{activePayslipStaff.leaveDeduction.toFixed(2)}</td>
                          </tr>
                        )}
                        {activePayslipStaff.manualDeduction > 0 && (
                          <tr style={{ borderBottom: "1px solid #edf2f7" }}>
                            <td style={{ padding: "8px 0", color: "#4a5568" }}>
                              Deductions
                              {activePayslipStaff.deductionNote && <div style={{ fontSize: 9.5, color: "#a0aec0", fontWeight: 500 }}>{activePayslipStaff.deductionNote}</div>}
                            </td>
                            <td style={{ textAlign: "right", fontWeight: 650, color: "#e53e3e" }}>-₹{activePayslipStaff.manualDeduction.toFixed(2)}</td>
                          </tr>
                        )}
                        {activePayslipStaff.leaveDays === 0 && activePayslipStaff.manualDeduction === 0 && (
                          <tr>
                            <td style={{ padding: "10px 0", color: "#a0aec0", fontStyle: "italic" }}>No deductions applied</td>
                            <td style={{ textAlign: "right", color: "#a0aec0" }}>—</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Final Net Box */}
                <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 20, borderTop: "1.5px solid #e2e8f0", paddingTop: 16, marginBottom: 30 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, justifyContent: "center" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#4a5568" }}>
                      <span>Gross Earnings:</span>
                      <span style={{ fontWeight: 600, color: "#2d3748" }}>₹{activePayslipStaff.totalEarnings.toFixed(2)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#4a5568", marginTop: 4 }}>
                      <span>Gross Deductions:</span>
                      <span style={{ fontWeight: 600, color: "#2d3748" }}>₹{activePayslipStaff.totalDeductions.toFixed(2)}</span>
                    </div>
                  </div>
                  <div style={{ background: "linear-gradient(135deg, #a5e9dd 0%, #34908B 100%)", color: "#ffffff", padding: "12px 18px", borderRadius: 8, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-end", boxShadow: "0 4px 10px rgba(52, 144, 139, 0.15)" }}>
                    <div style={{ fontSize: 10, fontStyle: "normal", fontWeight: 700, letterSpacing: "0.5px", opacity: 0.9 }}>NET PAYABLE SALARY</div>
                    <div style={{ fontSize: 20, fontWeight: 950, marginTop: 2 }}>₹{activePayslipStaff.netSalary.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                  </div>
                </div>

                {/* Signatures */}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 36, paddingTop: 16, borderTop: "1px solid #edf2f7", fontSize: 11, color: "#718096" }}>
                  <div style={{ position: "relative" }}>
                    <div style={{ height: 35, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", position: "absolute", top: -20, left: 0, right: 0, textAlign: "center" }}>
                      <span style={{ fontFamily: "'Brush Script MT', 'Dancing Script', 'Segoe Print', cursive", fontSize: 19, fontWeight: "bold", color: "#34908B", lineHeight: 1, display: "block" }}>Mithun</span>
                      <span style={{ fontSize: 7.5, color: "#a0aec0", fontFamily: "monospace", display: "block", marginTop: 1, whiteSpace: "nowrap" }}>Digitally Signed: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</span>
                    </div>
                    <div style={{ borderTop: "1px dashed #cbd5e0", width: 160, textAlign: "center", paddingTop: 6, marginTop: 22 }}>Prepared By (Mithun)</div>
                  </div>
                  <div>
                    <div style={{ height: 22 }}></div>
                    <div style={{ borderTop: "1px dashed #cbd5e0", width: 160, textAlign: "center", paddingTop: 6, marginTop: 22 }}>Employee Signature</div>
                  </div>
                </div>

              </div>
            </div>
            
          </div>
        </React.Fragment>
      )}

    </div>
  );
}


/* ---------- quick-add roster: 6 working + 1 rest, across a date range ---------- */
function QuickAddRoster({ branch, onClose }) {
  const pool = branch === "global" ? [...F().STAFF.calicut, ...F().STAFF.cochin] : F().STAFF[branch];
  const isoToday = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
  const [name, setName] = React.useState(pool[0]);
  const [from, setFrom] = React.useState(isoToday);
  const [to, setTo] = React.useState(isoToday);
  React.useEffect(() => { const k = (e) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);
  const apply = () => {
    const f = new Date(from + "T00:00:00"), t = new Date(to + "T00:00:00");
    if (isNaN(f.getTime()) || isNaN(t.getTime()) || t < f) { toast("Pick a valid date range", "alert"); return; }
    let n = 0, idx = 0;
    for (let d = new Date(f); d <= t; d.setDate(d.getDate() + 1)) {
      const off = F().offsetOf(new Date(d));
      const code = (idx % 7) < 6 ? "D" : "RD";   // 6 working days + 1 rest day
      F().rosterSet(name, off, { code, ot: 0 });
      idx++; n++;
    }
    DB.dbQuickAddRoster(name, from, to, branch);
    window.dispatchEvent(new Event("fets-roster-changed"));
    toast(`Rostered ${name} · ${n} day${n === 1 ? "" : "s"} (6+1)`, "check");
    setTimeout(onClose, 650);
  };
  const inp = { background: "var(--inset)", border: "1px solid var(--hairline)", borderRadius: 9, color: "var(--ink)", fontFamily: "var(--font)", fontSize: 13.5, padding: "9px 11px", width: "100%" };
  return (
    <React.Fragment>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "oklch(0.12 0.02 182 / 0.6)", backdropFilter: "blur(3px)", zIndex: 120 }} />
      <div role="dialog" className="glass rise" style={{ position: "fixed", zIndex: 121, top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "min(420px,93vw)", borderRadius: "var(--radius)", padding: 22, boxShadow: "var(--shadow-lift)", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, display: "grid", placeItems: "center", color: "var(--accent-ink)", background: "var(--accent)" }}><Icon name="plus" size={20} /></div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 760, color: "var(--ink)" }}>Quick add roster</h2>
            <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>Auto-fills a 6-on / 1-off pattern</div>
          </div>
          <button onClick={onClose} className="tap glass-2" style={{ width: 34, height: 34, borderRadius: 999, display: "grid", placeItems: "center", cursor: "pointer", color: "var(--ink-2)", border: "1px solid var(--hairline)" }}><Icon name="x" size={16} /></button>
        </div>
        <label style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-3)" }}>Staff member
          <select value={name} onChange={(e) => setName(e.target.value)} style={{ ...inp, marginTop: 5 }}>
            {pool.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <div style={{ display: "flex", gap: 12 }}>
          <label style={{ flex: 1, fontSize: 11.5, fontWeight: 700, color: "var(--ink-3)" }}>From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ ...inp, marginTop: 5 }} /></label>
          <label style={{ flex: 1, fontSize: 11.5, fontWeight: 700, color: "var(--ink-3)" }}>To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ ...inp, marginTop: 5 }} /></label>
        </div>
        <div className="inset" style={{ padding: "10px 13px", borderRadius: 10, fontSize: 12, color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="refresh" size={14} style={{ color: "var(--accent)", flexShrink: 0 }} /> 6 day shifts (<b style={{ color: "var(--ink-2)" }}>D</b>), then 1 rest day (<b style={{ color: "var(--ink-2)" }}>RD</b>), repeating.
        </div>
        <button onClick={apply} className="tap" style={{ height: 44, borderRadius: 12, border: "none", cursor: "pointer", fontFamily: "var(--font)", fontSize: 14, fontWeight: 780, color: "var(--accent-ink)", background: "var(--accent)" }}>Add to roster</button>
      </div>
    </React.Fragment>
  );
}

/* ---------- Styled Wrapper styles for Check In / Out button and Neon Tabs ---------- */
function RosterStyleBlock() {
  return (
    <style>{`
      /* Set complementing dark forest-teal-green background for Roster Page scroll region */
      .main-scroll {
        background: radial-gradient(120% 120% at 50% 10%, oklch(0.20 0.025 162) 0%, oklch(0.14 0.015 162) 100%) !important;
      }
      .wallpaper {
        opacity: 0.15 !important;
      }

      .attendance-hero-btn {
        --main-color: var(--accent);
        --main-bg-color: var(--accent-soft);
        --pattern-color: oklch(0.82 0.15 162 / 0.03);
        filter: hue-rotate(0deg);
        cursor: pointer;
        text-transform: uppercase;
        letter-spacing: 0.5rem;
        background: radial-gradient(
            circle,
            var(--main-bg-color) 0%,
            rgba(0, 0, 0, 0) 95%
          ),
          linear-gradient(var(--pattern-color) 1px, transparent 1px),
          linear-gradient(to right, var(--pattern-color) 1px, transparent 1px);
        background-size: cover, 15px 15px, 15px 15px;
        background-position: center center, center center, center center;
        border-image: radial-gradient(
            circle,
            var(--main-color) 0%,
            rgba(0, 0, 0, 0) 100%
          ) 1;
        border-width: 1px 0 1px 0;
        color: var(--main-color);
        padding: 1.25rem 3.5rem;
        font-weight: 800;
        font-size: 1.75rem;
        transition: background-size 0.2s ease-in-out, transform 0.1s ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-left: none;
        border-right: none;
        outline: none;
      }
      .attendance-hero-btn:hover {
        background-size: cover, 10px 10px, 10px 10px;
      }
      .attendance-hero-btn:active {
        filter: hue-rotate(250deg);
        transform: scale(0.95);
      }

      .fets-menu-btn {
        display: inline-flex;
        align-items: center;
        gap: 24px;
        padding: 8px 8px 8px 24px;
        border: 2px solid var(--hairline);
        border-radius: 16px;
        background: transparent;
        cursor: pointer;
        transition: background-color 0.3s ease, border-color 0.3s ease, transform 0.1s ease;
      }
      .fets-menu-btn.active {
        background-color: var(--panel);
        border-color: var(--accent);
      }
      .fets-menu-btn:hover {
        background-color: var(--panel);
        border-color: var(--accent);
      }
      .fets-menu-btn:active {
        transform: scale(0.95);
      }
      .fets-btn-text {
        font-size: 16px;
        font-weight: 700;
        color: var(--ink);
        transition: color 0.3s ease;
      }
      .fets-menu-btn.active .fets-btn-text {
        color: var(--accent);
      }
      .fets-menu-btn:hover .fets-btn-text {
        color: var(--accent);
      }
      .fets-btn-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: var(--accent);
        padding: 8px;
        border-radius: 8px;
        transition: transform 0.3s ease;
      }
      .fets-menu-btn:hover .fets-btn-icon {
        transform: rotate(45deg);
      }
      .fets-menu-btn.active .fets-btn-icon {
        transform: rotate(45deg);
      }
      .fets-btn-icon svg {
        width: 20px;
        height: 20px;
        color: #000;
        transition: transform 0.3s ease;
      }
      .fets-menu-btn:hover .fets-btn-icon svg {
        transform: rotate(-45deg);
      }
      .fets-menu-btn.active .fets-btn-icon svg {
        transform: rotate(-45deg);
      }
    `}</style>
  );
}

/* ---------- attendance check in / out button on top right ---------- */
function AttendanceHeroButton({ branch }) {
  const [row, setRow] = React.useState(undefined);
  const [nowTime, setNowTime] = React.useState(new Date());
  const [showDropdown, setShowDropdown] = React.useState(false);
  const dropdownRef = React.useRef(null);

  const load = () => ATT.attToday().then((r) => setRow(r || null));

  React.useEffect(() => {
    load();
    const handleRefresh = () => load();
    window.addEventListener("fets-roster-changed", handleRefresh);
    return () => window.removeEventListener("fets-roster-changed", handleRefresh);
  }, []);

  const checkedIn = row && row.check_in && !row.check_out;
  const onBreak = row && ATT.attOnBreak(row);
  const done = !!(row && row.check_out);

  React.useEffect(() => {
    if (checkedIn) {
      const interval = setInterval(() => {
        setNowTime(new Date());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [checkedIn]);

  React.useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const act = async (fn, okMessage) => {
    const r = await fn();
    if (r && r.error) {
      toast(r.error, "alert");
    } else {
      toast(okMessage, "check");
      window.dispatchEvent(new Event("fets-roster-changed"));
      load();
    }
    setShowDropdown(false);
  };

  const handleClick = () => {
    if (done) return;
    if (!row) {
      act(() => ATT.attCheckIn(branch), "Checked in");
    } else {
      setShowDropdown(!showDropdown);
    }
  };

  const parseDateTime = (dateStr: string, timeStr: string) => {
    if (!dateStr || !timeStr) return new Date();
    const [year, month, day] = dateStr.split("-").map(Number);
    const parts = timeStr.split(":");
    const hours = Number(parts[0]) || 0;
    const minutes = Number(parts[1]) || 0;
    const seconds = Number(parts[2]) || 0;
    return new Date(year, month - 1, day, hours, minutes, seconds);
  };

  let workedSeconds = 0;
  if (row && row.check_in) {
    const checkInDate = parseDateTime(row.date, row.check_in);
    const endTime = row.check_out 
      ? parseDateTime(row.date, row.check_out)
      : nowTime;
    const elapsedSeconds = Math.max(0, Math.floor((endTime.getTime() - checkInDate.getTime()) / 1000));
    
    const notes = row.notes ? (typeof row.notes === "string" ? JSON.parse(row.notes) : row.notes) : {};
    const completedBreakMins = notes.breakMins || 0;
    
    let currentBreakSeconds = 0;
    const steps = notes.steps || [];
    const lastStep = steps[steps.length - 1];
    const isOnBreak = !!(lastStep && lastStep.out && !lastStep.in);
    if (isOnBreak) {
      const breakStartDate = parseDateTime(row.date, lastStep.out);
      currentBreakSeconds = Math.max(0, Math.floor((endTime.getTime() - breakStartDate.getTime()) / 1000));
    }
    
    const totalBreakSeconds = (completedBreakMins * 60) + currentBreakSeconds;
    workedSeconds = Math.max(0, elapsedSeconds - totalBreakSeconds);
  }

  const formatSeconds = (totalSecs) => {
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
  };

  let btnLabel = "Start";
  let activeHue = "0deg";
  if (row === undefined) btnLabel = "Loading";
  else if (done) {
    btnLabel = "Done";
    activeHue = "120deg";
  } else if (onBreak) {
    btnLabel = "On Break";
    activeHue = "45deg";
  } else if (checkedIn) {
    btnLabel = "On Shift";
    activeHue = "250deg";
  }

  return (
    <div ref={dropdownRef} style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", position: "relative" }}>
      <button 
        onClick={handleClick} 
        disabled={row === undefined}
        className="attendance-hero-btn"
        style={{ filter: `hue-rotate(${activeHue})` }}
      >
        {btnLabel}
      </button>

      {showDropdown && row && !done && (
        <div className="glass" style={{
          position: "absolute",
          top: "100%",
          right: 0,
          marginTop: 10,
          borderRadius: 14,
          border: "1px solid var(--hairline)",
          background: "oklch(0.18 0.024 184 / 0.95)",
          padding: 8,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          minWidth: 160,
          boxShadow: "var(--shadow-lift)",
          zIndex: 120
        }}>
          {checkedIn && !onBreak && (
            <button 
              onClick={() => act(ATT.attStepOut, "Stepped out")} 
              className="tap" 
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                borderRadius: 10,
                border: "none",
                background: "transparent",
                color: "var(--ink)",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
                textAlign: "left",
                transition: "background 0.2s"
              }}
            >
              <Icon name="coffee" size={14} style={{ color: "var(--accent)" }} /> Step Out
            </button>
          )}
          {onBreak && (
            <button 
              onClick={() => act(ATT.attBack, "Back on shift")} 
              className="tap" 
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                borderRadius: 10,
                border: "none",
                background: "transparent",
                color: "var(--ink)",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
                textAlign: "left",
                transition: "background 0.2s"
              }}
            >
              <Icon name="arrowR" size={14} style={{ color: "var(--accent)" }} /> Resume Shift
            </button>
          )}
          {checkedIn && (
            <button 
              onClick={() => act(ATT.attCheckOut, "Checked out")} 
              className="tap" 
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                borderRadius: 10,
                border: "none",
                background: "transparent",
                color: "var(--bad)",
                cursor: "pointer",
                fontWeight: 650,
                fontSize: 13,
                textAlign: "left",
                transition: "background 0.2s"
              }}
            >
              <Icon name="power" size={14} style={{ color: "var(--bad)" }} /> Check Out
            </button>
          )}
        </div>
      )}

      {row && row.check_in && (
        <div style={{ 
          marginTop: 10, 
          textAlign: "right",
          color: done ? "var(--ink-3)" : "var(--accent)",
          textShadow: done ? "none" : "0 0 10px var(--accent-soft)",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 2
        }}>
          <div style={{ fontSize: 18, fontFamily: "monospace", fontWeight: 800, letterSpacing: "1px" }}>
            {formatSeconds(workedSeconds)}
          </div>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Worked today {done && " (Ended)"}
          </div>
        </div>
      )}
    </div>
  );
}

function RosterPage({ branch }) {
  const [activeRosterTab, setActiveRosterTab] = React.useState("duty"); // duty | time | shift | work | review
  const [view, setView] = React.useState("days");   // days | analysis
  const win = useMonthWindow();
  const [quickOpen, setQuickOpen] = React.useState(false);
  const [dayDrawer, setDayDrawer] = React.useState(null);
  const [showHours, setShowHours] = React.useState(false);
  const isAdmin = F().user.role === "Super Admin";
  const [tick, setTick] = React.useState(0);
  const [workLogs, setWorkLogs] = React.useState<any[] | null>(null);

  React.useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    window.addEventListener("fets-roster-changed", handler);
    return () => window.removeEventListener("fets-roster-changed", handler);
  }, []);

  React.useEffect(() => {
    if (activeRosterTab === "work") {
      ATT.attHistory(45).then(setWorkLogs);
    }
  }, [activeRosterTab, tick]);

  const reqsAll = F().staffReqList().filter((r) => branch === "global" || r.branch === branch);
  const onDutyToday = window.branchRoster(0, branch).length;
  const poolSize = branch === "global"
    ? F().STAFF.calicut.length + F().STAFF.cochin.length
    : F().STAFF[branch].length;
  const offs = win.offsets;
  const avgCover = Math.round(offs.reduce((a, o) => a + window.branchRoster(o, branch).length, 0) / offs.length);
  const busy = windowStats(offs, branch).busiest;
  const wide = true;
  const gap = "calc(28px * var(--density))";
  useLiveSync(win.offsets.map((o) => F().ISO(o)));

  // Review Desk state
  const [reviewMonth, setReviewMonth] = React.useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [reviewData, setReviewData] = React.useState([]);
  const [loadingReview, setLoadingReview] = React.useState(false);

  const loadReviewData = async () => {
    setLoadingReview(true);
    try {
      const start = `${reviewMonth}-01`;
      const [y, m] = reviewMonth.split("-").map(Number);
      const nextY = m === 12 ? y + 1 : y;
      const nextM = m === 12 ? 1 : m + 1;
      const end = `${nextY}-${String(nextM).padStart(2, '0')}-01`;

      const { data, error } = await supabase
        .from("staff_attendance")
        .select("*, staff:staff_profiles!staff_attendance_staff_id_fkey(full_name, branch_assigned)")
        .gte("date", start)
        .lt("date", end)
        .order("date", { ascending: true });
      
      if (error) throw error;
      setReviewData(data || []);
    } catch (err) {
      console.error("Error loading review data:", err);
    } finally {
      setLoadingReview(false);
    }
  };

  React.useEffect(() => {
    if (activeRosterTab === "review") {
      loadReviewData();
    }
  }, [reviewMonth, activeRosterTab, tick]);

  const divider = (
    <div style={{ height: 1, background: "var(--hairline)", margin: "4px 0" }} />
  );

  const meName = F()._meName || (F().user && F().user.name);

  // Aggregated review stats helper
  const parseNotesObj = (n) => { try { return typeof n === "string" ? JSON.parse(n) : n || {}; } catch (e) { return {}; } };
  const padNum = (num) => String(num).padStart(2, '0');

  // Group by branch & staff for Review Desk
  const branchStats = {};
  const staffStats = {};

  reviewData.forEach(row => {
    const staffName = row.staff?.full_name || row.staff_name || "Unknown Staff";
    const br = row.branch_location || row.staff?.branch_assigned || "unassigned";
    const isLate = row.status === "late";
    const isPresent = row.status === "present" || isLate;
    
    let workedMins = 0;
    if (row.check_in) {
      const checkOutVal = row.check_out || (row.date === ATT.attDateStr() ? new Date().toTimeString().slice(0, 5) : row.check_in);
      const [ih, im] = row.check_in.split(':').map(Number);
      const [oh, om] = checkOutVal.split(':').map(Number);
      const notes = parseNotesObj(row.notes);
      const breakMins = notes.breakMins || 0;
      workedMins = Math.max(0, (oh * 60 + om) - (ih * 60 + im) - breakMins);
    }
    
    const notes = parseNotesObj(row.notes);
    const breakMins = notes.breakMins || 0;

    if (!branchStats[br]) {
      branchStats[br] = { workedMins: 0, shiftsCount: 0, lateCount: 0 };
    }
    if (isPresent) {
      branchStats[br].shiftsCount++;
      branchStats[br].workedMins += workedMins;
      if (isLate) branchStats[br].lateCount++;
    }

    if (!staffStats[staffName]) {
      staffStats[staffName] = { name: staffName, branch: br, shiftsCount: 0, lateCount: 0, breakMins: 0, workedMins: 0 };
    }
    if (isPresent) {
      staffStats[staffName].shiftsCount++;
      staffStats[staffName].workedMins += workedMins;
      staffStats[staffName].breakMins += breakMins;
      if (isLate) staffStats[staffName].lateCount++;
    }
  });

  const [sortKey, setSortKey] = React.useState("shiftsCount");
  const [sortAsc, setSortAsc] = React.useState(false);

  const sortedStaff = React.useMemo(() => {
    return Object.values(staffStats).sort((a: any, b: any) => {
      let valA = a[sortKey];
      let valB = b[sortKey];
      if (typeof valA === "string") {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });
  }, [staffStats, sortKey, sortAsc]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  // Work Desk Metrics
  const monthlyOffsets = Array.from({ length: 30 }, (_, i) => i - 5);
  let workedDays = 0;
  let restDays = 0;
  let leaveDays = 0;
  
  const ov = F().rosterGet(meName) || {};
  monthlyOffsets.forEach((o) => {
    const c = ov[o];
    const code = c ? (typeof c === "string" ? c : c.code) : F().rosterOn(F().ISO(o), branch).includes(meName) ? "D" : "RD";
    if (["D", "E", "HD"].includes(code)) workedDays++;
    if (code === "RD") restDays++;
    if (code === "L") leaveDays++;
  });
  
  const toilBalance = F()._meToilBalance || 0;
  const toilEarned = F()._meToilEarned || 0;
  const toilRedeemed = F()._meToilRedeemed || 0;
  const totalMonthOt = F()._meTotalMonthOt || 0;

  const totalDays = workedDays + restDays + leaveDays;
  const workedPercent = totalDays > 0 ? Math.round((workedDays / totalDays) * 100) : 0;
  const restPercent = totalDays > 0 ? Math.round((restDays / totalDays) * 100) : 0;
  const leavePercent = totalDays > 0 ? Math.round((leaveDays / totalDays) * 100) : 0;

  // Daily Attendance log view for Time Desk
  const DailyAttendanceLog = () => {
    const [logDate, setLogDate] = React.useState(ATT.attDateStr());
    const [rows, setRows] = React.useState<any[] | null>(null);
    const [searchQ, setSearchQ] = React.useState("");

    React.useEffect(() => { 
      setRows(null); 
      ATT.attAllForDate(logDate).then(setRows); 
    }, [logDate]);

    const totalWorked = (rows || []).reduce((a, r) => a + (r.worked || 0), 0);
    const activeStaffCount = (rows || []).filter(r => r.check_in && !r.check_out).length;

    const filtered = (rows || []).filter(r => 
      !searchQ.trim() || String(r.name).toLowerCase().includes(searchQ.toLowerCase())
    );

    return (
      <div className="glass rise" style={{ borderRadius: "var(--radius)", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <SectionLabel style={{ margin: 0 }} right={<span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>centre logs</span>}>Daily Attendance</SectionLabel>
          <input 
            type="date" 
            value={logDate} 
            onChange={(e) => setLogDate(e.target.value)} 
            style={{ 
              background: "var(--inset)", 
              border: "1px solid var(--hairline)", 
              borderRadius: 10, 
              color: "var(--ink)", 
              fontFamily: "var(--font)", 
              fontSize: 13, 
              padding: "6px 12px",
              outline: "none"
            }} 
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div className="inset" style={{ padding: "10px 12px", borderRadius: 10, textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "var(--ink-4)", fontWeight: 700, textTransform: "uppercase" }}>Total Present</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)", marginTop: 4 }}>{rows ? rows.length : 0}</div>
          </div>
          <div className="inset" style={{ padding: "10px 12px", borderRadius: 10, textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "var(--ink-4)", fontWeight: 700, textTransform: "uppercase" }}>Active Shifts</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--accent)", marginTop: 4 }}>{activeStaffCount}</div>
          </div>
          <div className="inset" style={{ padding: "10px 12px", borderRadius: 10, textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "var(--ink-4)", fontWeight: 700, textTransform: "uppercase" }}>Hours Worked</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--v-ielts)", marginTop: 4 }}>{Math.floor(totalWorked / 60)}h</div>
          </div>
        </div>

        <div style={{ position: "relative" }}>
          <Icon name="search" size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ink-4)" }} />
          <input 
            type="text" 
            placeholder="Search staff logs..." 
            value={searchQ} 
            onChange={(e) => setSearchQ(e.target.value)} 
            style={{
              background: "var(--inset)",
              border: "1px solid var(--hairline)",
              borderRadius: 10,
              color: "var(--ink)",
              fontFamily: "var(--font)",
              fontSize: 12.5,
              padding: "8px 12px 8px 30px",
              width: "100%",
              outline: "none",
              boxSizing: "border-box"
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
          {!rows ? (
            <div style={{ textAlign: "center", padding: 24, color: "var(--ink-4)", fontSize: 13 }}>Loading team logs...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 24, color: "var(--ink-4)", fontSize: 13 }}>No records found.</div>
          ) : (
            filtered.map((r, i) => {
              const isActive = r.check_in && !r.check_out;
              const isLate = String(r.status).toLowerCase() === "late";
              return (
                <div key={i} className="glass-2" style={{
                  borderRadius: 12,
                  padding: "12px 14px",
                  border: "1px solid var(--hairline)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar name={r.name} size={32} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{r.name}</div>
                      <div style={{ fontSize: 10.5, color: "var(--ink-3)", textTransform: "capitalize", marginTop: 2 }}>
                        {r.branch || "unassigned"}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {isLate && (
                        <span style={{ fontSize: 8.5, fontWeight: 750, textTransform: "uppercase", padding: "1px 5px", borderRadius: 4, background: "rgba(253,203,110,0.12)", color: "#C2860F" }}>L</span>
                      )}
                      {isActive ? (
                        <span style={{ fontSize: 9.5, fontWeight: 750, textTransform: "uppercase", padding: "2px 7px", borderRadius: 99, background: "rgba(0,184,148,0.12)", color: "var(--ok)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--ok)", display: "inline-block" }} className="pulse" /> On Shift
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--ink-2)", fontFamily: "monospace" }}>
                          {r.check_in || "—"} - {r.check_out || "—"}
                        </span>
                      )}
                    </div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>
                      {r.worked ? ATT.attFmtMins(r.worked) : "—"} {r.breakMins > 0 && `(${r.breakMins}m break)`}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  // User requests list for Shift Desk
  const UserRequestsList = () => {
    const mine = F()._staffRequests?.filter(r => r.who === meName) || [];
    const statusMeta = {
      Submitted: { color: "var(--warn)", label: "Awaiting Admin Review", icon: "clock" },
      Approved: { color: "var(--ok)", label: "Approved & Synced", icon: "check" },
      Rejected: { color: "var(--bad)", label: "Rejected", icon: "x" }
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
        <SectionLabel right={<span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>{mine.length} requests</span>}>Your Shift & Leave Requests</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mine.length === 0 ? (
            <div className="glass" style={{ borderRadius: "var(--radius)", padding: "24px", textAlign: "center", color: "var(--ink-4)", fontSize: 13.5 }}>
              No requests submitted yet.
            </div>
          ) : (
            mine.map((r, i) => {
              const meta = statusMeta[r.status] || { color: "var(--ink-3)", label: r.status, icon: "info" };
              const isSwap = r.kind === "swap";
              const isToil = r.kind === "toil";
              
              return (
                <div key={r.id || i} className="glass rise hover-lift" style={{ 
                  borderRadius: "var(--radius)", 
                  padding: "16px 20px", 
                  borderLeft: `4px solid ${meta.color}`,
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center", 
                  flexWrap: "wrap", 
                  gap: 16,
                  transition: "all 0.2s"
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <div style={{ 
                      width: 36, 
                      height: 36, 
                      borderRadius: 10, 
                      background: "rgba(255,255,255,0.04)", 
                      display: "grid", 
                      placeItems: "center",
                      color: meta.color,
                      border: "1px solid var(--hairline)",
                      flexShrink: 0
                    }}>
                      <Icon name={r.kind === "swap" ? "refresh" : (r.kind === "toil" ? "clock" : "calendar")} size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 750, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
                        <span>{r.kind.toUpperCase()}</span>
                        {r.leaveType && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", background: "var(--glass-2)", padding: "1px 6px", borderRadius: 4 }}>
                            {r.leaveType}
                          </span>
                        )}
                      </div>
                      
                      <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 6, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                        <span>Target:</span>
                        <strong style={{ color: "var(--ink)" }}>{r.date}</strong>
                        {isSwap && r.with && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span style={{ color: "var(--ink-4)" }}>⇄</span>
                            <span>colleague</span>
                            <strong style={{ color: "var(--ink)" }}>{r.with}</strong>
                            <span>(shift: {r.swapDate || r.date})</span>
                          </span>
                        )}
                      </div>

                      {r.reason && (
                        <div style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic", marginTop: 6, display: "flex", alignItems: "flex-start", gap: 4 }}>
                          <span style={{ opacity: 0.5 }}>“</span>
                          <span>{r.reason}</span>
                          <span style={{ opacity: 0.5 }}>”</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <span style={{ 
                      fontSize: 10.5, 
                      fontWeight: 800, 
                      textTransform: "uppercase", 
                      letterSpacing: "0.06em",
                      padding: "4px 10px", 
                      borderRadius: 99, 
                      color: meta.color, 
                      background: `color-mix(in oklch, ${meta.color} 12%, transparent)`, 
                      border: `1px solid color-mix(in oklch, ${meta.color} 20%, transparent)`,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6
                    }}>
                      {r.status === "Submitted" && <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--warn)", display: "inline-block" }} className="pulse" />}
                      {meta.label}
                    </span>
                    {r.status !== "Submitted" && (
                      <span style={{ fontSize: 10, color: "var(--ink-4)" }}>
                        Processed in Real-time
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      maxWidth: 1180,
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
      gap: "20px",
      position: "relative",
      // Force whole roster page theme override to complementing forest-green
      "--accent": "oklch(0.82 0.15 162)",
      "--accent-2": "oklch(0.76 0.14 162)",
      "--accent-soft": "oklch(0.82 0.15 162 / 0.15)",
      "--accent-line": "oklch(0.82 0.15 162 / 0.40)",
      "--accent-ink": "#000",
      
      // Override panels and borders to use green hues for maximum integration
      "--panel": "oklch(0.24 0.025 162)",
      "--panel-2": "oklch(0.28 0.025 162)",
      "--panel-3": "oklch(0.17 0.02 162)",
      "--glass": "var(--panel)",
      "--glass-2": "var(--panel-2)",
      "--inset": "var(--panel-3)",
      "--hairline": "oklch(0.82 0.15 162 / 0.10)",
      "--glass-edge": "oklch(0.82 0.15 162 / 0.10)",

      "--v-cma": "oklch(0.82 0.15 162)",
      "--v-prometric": "oklch(0.82 0.15 162)"
    } as React.CSSProperties}>
      <RosterStyleBlock />

      {/* Roster Header and Top-Right Check-in button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 20 }}>
        <PageHeader eyebrow={`Staffing // ${capBranch(branch)}`} title="Roster" />
        
        {/* Check in / out button widget on the right, but positioned slightly down */}
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", alignItems: "flex-end", position: "relative", zIndex: 110 }}>
          <AttendanceHeroButton branch={branch} />
        </div>
      </div>

      {(() => {
        const myUnseenResolutions = F()._staffRequests?.filter(r => 
          r.who === meName && 
          (r.status === "Approved" || r.status === "Rejected") && 
          !localStorage.getItem(`fets-seen-req-${r.id}`)
        ) || [];
        if (myUnseenResolutions.length === 0) return null;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {myUnseenResolutions.map((r) => (
              <div 
                key={r.id} 
                className="glass rise" 
                style={{ 
                  padding: "12px 16px", 
                  borderRadius: 12, 
                  borderLeft: `4px solid ${r.status === "Approved" ? "var(--ok)" : "var(--bad)"}`,
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "space-between",
                  gap: 12
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ 
                    width: 24, 
                    height: 24, 
                    borderRadius: 6, 
                    display: "grid", 
                    placeItems: "center", 
                    color: r.status === "Approved" ? "var(--ok)" : "var(--bad)",
                    background: r.status === "Approved" ? "color-mix(in oklch, var(--ok) 15%, transparent)" : "color-mix(in oklch, var(--bad) 15%, transparent)"
                  }}>
                    <Icon name={r.status === "Approved" ? "check" : "x"} size={14} />
                  </span>
                  <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: 550 }}>
                    Your request for <strong>{r.leaveType || r.kind.toUpperCase()}</strong> on <strong>{r.date}</strong> has been <strong>{r.status.toLowerCase()}</strong>.
                  </span>
                </div>
                <button 
                  onClick={() => {
                    localStorage.setItem(`fets-seen-req-${r.id}`, "true");
                    window.dispatchEvent(new Event("fets-roster-changed"));
                  }}
                  className="tap glass-2" 
                  style={{ 
                    padding: "5px 10px", 
                    borderRadius: 6, 
                    border: "1px solid var(--hairline)", 
                    fontSize: 11, 
                    fontWeight: 700, 
                    color: "var(--ink-2)", 
                    cursor: "pointer" 
                  }}
                >
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Desk Tab Selection using Custom Neon Menu Button design */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 12 }}>
        {[
          { id: "duty", label: "Duty" },
          { id: "time", label: "Time" },
          { id: "shift", label: "Shift" },
          { id: "work", label: "Work" },
          { id: "review", label: "Review" }
        ].map((t) => {
          const isActive = activeRosterTab === t.id;
          return (
            <button 
              key={t.id} 
              onClick={() => setActiveRosterTab(t.id)} 
              className={`fets-menu-btn ${isActive ? "active" : ""}`}
            >
              <span className="fets-btn-text">{t.label}</span>
              <span className="fets-btn-icon">
                <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M5 13h11.17l-4.88 4.88c-.39.39-.39 1.03 0 1.42s1.02.39 1.41 0l6.59-6.59a.996.996 0 0 0 0-1.41l-6.58-6.6a.996.996 0 1 0-1.41 1.41L16.17 11H5c-.55 0-1 .45-1 1s.45 1 1 1" />
                </svg>
              </span>
            </button>
          );
        })}
      </div>

      {divider}

      {/* Desk Subviews */}
      {activeRosterTab === "duty" && (
        <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <span style={{ width: 22, height: 3, background: "var(--accent)", borderRadius: 99 }} />
              <SectionLabel style={{ margin: 0 }}>Roster — {win.monthName} {win.year}</SectionLabel>
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {view === "days" && <RangeNav win={win} unit="month" />}
              <Segmented value={view} onChange={setView} size="sm" options={[
                { value: "days", label: "Monthly Grid" }, { value: "analysis", label: "Overview" },
              ]} />
              {isAdmin && (
                <button onClick={() => setQuickOpen(true)} className="tap" title="Quick add roster (6+1 pattern)"
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 36, padding: "0 14px", borderRadius: 10,
                    cursor: "pointer", border: "none", fontFamily: "var(--font)", fontSize: 12, fontWeight: 750, color: "var(--accent-ink)", background: "var(--accent)" }}>
                  <Icon name="plus" size={14} /> Quick add
                </button>
              )}
            </div>
          </div>

          {view === "days" && <RosterGrid key={branch} offsets={win.offsets} branch={branch} />}
          {view === "analysis" && (
            <React.Fragment>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <StatPill value={onDutyToday} label="On duty today" />
                <StatPill value={poolSize} label="Staff in pool" tone="var(--v-cma)" />
                <StatPill value={avgCover} unit="/day" label="Avg cover this month" tone="var(--v-prometric)" />
                <StatPill value={busy.n} unit={`· ${busy.label}`} label="Busiest day" tone="var(--v-ielts)" />
              </div>
              <RosterAnalysis offsets={offs} branch={branch} />
            </React.Fragment>
          )}
          {view === "days" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>
                {window.FETS.isAdmin
                  ? "Tap any cell to change shift · Quick add fills a 6+1 week block"
                  : "Your shift schedule — editing is restricted to the administrator"}
              </span>
            </div>
          )}
        </section>
      )}

      {activeRosterTab === "time" && (
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 20 }}>
          <ShiftHistory />
          <DailyAttendanceLog />
        </section>
      )}

      {activeRosterTab === "shift" && (
        <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <RosterRequestForm branch={branch} />
          <UserRequestsList />
        </section>
      )}

      {activeRosterTab === "work" && (() => {
        const totalShifts = workLogs ? workLogs.length : 0;
        const latesCount = workLogs ? workLogs.filter(r => String(r.status).toLowerCase() === "late").length : 0;
        const punctuality = totalShifts > 0 ? Math.round(((totalShifts - latesCount) / totalShifts) * 100) : 100;
        
        let currentStreak = 0;
        if (workLogs) {
          const sorted = [...workLogs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          for (const r of sorted) {
            if (r.check_in && String(r.status).toLowerCase() !== "late") {
              currentStreak++;
            } else {
              break;
            }
          }
        }

        // SVG Circle properties
        const radius = 36;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (punctuality / 100) * circumference;

        // Goals calculation
        const goalPunctuality = 95;
        const goalShifts = 20;
        const goalOt = 5;

        // Badges check
        const badges = [
          { id: "early", name: "Early Bird", desc: ">= 95% Punctuality", icon: "zap", active: punctuality >= 95, color: "var(--warn)" },
          { id: "perfect", name: "Perfect Month", desc: "15+ shifts, 0 lates", active: totalShifts >= 15 && latesCount === 0, icon: "award", color: "var(--ok)" },
          { id: "toil", name: "TOIL Collector", desc: "TOIL balance >= 3 days", active: toilBalance >= 3, icon: "clock", color: "var(--accent)" },
          { id: "iron", name: "Iron Staff", desc: "Worked >= 20 shifts", active: workedDays >= 20, icon: "shield", color: "var(--v-ielts)" }
        ];

        return (
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 20 }}>
            {/* Left Column: Presence & Streak */}
            <div className="glass rise" style={{ padding: 24, borderRadius: "var(--radius)", display: "flex", flexDirection: "column", gap: 20 }}>
              <SectionLabel style={{ margin: 0 }} right={<span className="mono" style={{ fontSize: 11, color: "var(--accent)" }}>gamified performance</span>}>Presence & Streaks</SectionLabel>
              
              <div style={{ display: "flex", alignItems: "center", gap: 24, padding: "10px 0" }}>
                <div style={{ position: "relative", width: 90, height: 90, flexShrink: 0 }}>
                  <svg width="90" height="90" viewBox="0 0 90 90">
                    <circle cx="45" cy="45" r={radius} stroke="var(--hairline)" strokeWidth="6" fill="transparent" />
                    <circle cx="45" cy="45" r={radius} stroke={punctuality >= 90 ? "var(--ok)" : "var(--warn)"} strokeWidth="6" fill="transparent" 
                            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round"
                            transform="rotate(-90 45 45)" style={{ transition: "stroke-dashoffset 0.5s ease" }} />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 16, fontWeight: 850, color: "var(--ink)" }}>{punctuality}%</span>
                    <span style={{ fontSize: 8, color: "var(--ink-4)", fontWeight: 700, textTransform: "uppercase" }}>on time</span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 13, color: "var(--ink-3)", fontWeight: 600 }}>Active Attendance Streak</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255, 121, 63, 0.12)", display: "grid", placeItems: "center", color: "#FF793F" }}>
                      <Icon name="zap" size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 850, color: "var(--ink)" }}>{currentStreak} Day{currentStreak === 1 ? "" : "s"}</div>
                      <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 1 }}>Consecutive shifts on-time</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Allocation bar */}
              <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 750, color: "var(--ink-4)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  <span>Monthly Allocation Ratio</span>
                  <span>{workedDays}W / {restDays}R / {leaveDays}L</span>
                </div>
                <div style={{ height: 16, borderRadius: 99, overflow: "hidden", display: "flex", background: "var(--inset)", border: "1px solid var(--hairline)" }}>
                  {workedDays > 0 && <div style={{ width: `${workedPercent}%`, background: "var(--accent)" }} title={`${workedDays} Days Worked`} />}
                  {restDays > 0 && <div style={{ width: `${restPercent}%`, background: "var(--ink-4)" }} title={`${restDays} Rest Days`} />}
                  {leaveDays > 0 && <div style={{ width: `${leavePercent}%`, background: "var(--bad)" }} title={`${leaveDays} Leave Days`} />}
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 11, color: "var(--ink-3)" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--accent)" }} /> Worked ({workedPercent}%)</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--ink-4)" }} /> Rest ({restPercent}%)</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--bad)" }} /> Leave ({leavePercent}%)</span>
                </div>
              </div>
            </div>

            {/* Middle Column: Performance Goals */}
            <div className="glass rise" style={{ padding: 24, borderRadius: "var(--radius)", display: "flex", flexDirection: "column", gap: 20 }}>
              <SectionLabel style={{ margin: 0 }} right={<span className="mono" style={{ fontSize: 11, color: "var(--v-ielts)" }}>monthly focus</span>}>Active Performance Goals</SectionLabel>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Goal 1: Punctuality */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, marginBottom: 6 }}>
                    <span style={{ fontWeight: 650, color: "var(--ink)" }}>Punctuality Target</span>
                    <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}><strong style={{ color: "var(--ink)" }}>{punctuality}%</strong> / {goalPunctuality}%</span>
                  </div>
                  <div style={{ height: 6, background: "var(--inset)", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(100, (punctuality / goalPunctuality) * 100)}%`, background: punctuality >= goalPunctuality ? "var(--ok)" : "var(--warn)", borderRadius: 99 }} />
                  </div>
                </div>

                {/* Goal 2: Shift Fulfillment */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, marginBottom: 6 }}>
                    <span style={{ fontWeight: 650, color: "var(--ink)" }}>Shift Fulfillment</span>
                    <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}><strong style={{ color: "var(--ink)" }}>{workedDays}</strong> / {goalShifts} shifts</span>
                  </div>
                  <div style={{ height: 6, background: "var(--inset)", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(100, (workedDays / goalShifts) * 100)}%`, background: "var(--accent)", borderRadius: 99 }} />
                  </div>
                </div>

                {/* Goal 3: Overtime Contribution */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, marginBottom: 6 }}>
                    <span style={{ fontWeight: 650, color: "var(--ink)" }}>Overtime Contribution</span>
                    <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}><strong style={{ color: "var(--ink)" }}>{totalMonthOt.toFixed(1)}h</strong> / {goalOt}h</span>
                  </div>
                  <div style={{ height: 6, background: "var(--inset)", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(100, (totalMonthOt / goalOt) * 100)}%`, background: "var(--v-ielts)", borderRadius: 99 }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Achievements & Badges */}
            <div className="glass rise" style={{ padding: 24, borderRadius: "var(--radius)", display: "flex", flexDirection: "column", gap: 16 }}>
              <SectionLabel style={{ margin: 0 }} right={<span className="mono" style={{ fontSize: 11, color: "var(--ok)" }}>staff credentials</span>}>Unlocked Achievements</SectionLabel>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {badges.map((b) => (
                  <div key={b.id} className="inset" style={{ 
                    padding: "12px", 
                    borderRadius: 12, 
                    display: "flex", 
                    flexDirection: "column", 
                    alignItems: "center", 
                    textAlign: "center",
                    opacity: b.active ? 1 : 0.45,
                    border: b.active ? `1px solid ${b.color}40` : "1px solid transparent",
                    background: b.active ? `color-mix(in oklch, ${b.color} 5%, var(--inset))` : "var(--inset)"
                  }}>
                    <div style={{ 
                      width: 32, 
                      height: 32, 
                      borderRadius: 999, 
                      background: b.active ? `color-mix(in oklch, ${b.color} 15%, transparent)` : "rgba(255,255,255,0.03)", 
                      display: "grid", 
                      placeItems: "center",
                      color: b.active ? b.color : "var(--ink-4)",
                      border: `1px solid ${b.active ? b.color : "var(--hairline)"}30`
                    }}>
                      <Icon name={b.icon} size={15} />
                    </div>
                    <div style={{ fontSize: 11.5, fontWeight: 750, color: b.active ? "var(--ink)" : "var(--ink-3)", marginTop: 8 }}>{b.name}</div>
                    <div style={{ fontSize: 9, color: "var(--ink-4)", marginTop: 2 }}>{b.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })()}

      {activeRosterTab === "review" && (
        <section style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <SectionLabel right={<span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>performance & presence study</span>}>Centre & Staff Monthly Review</SectionLabel>
          
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <input type="month" value={reviewMonth} onChange={(e) => setReviewMonth(e.target.value)} style={{ background: "var(--inset)", border: "1px solid var(--hairline)", borderRadius: 10, color: "var(--ink)", fontFamily: "var(--font)", fontSize: 14, padding: "8px 12px", outline: "none" }} />
            <div style={{ flex: 1 }} />
            <button onClick={loadReviewData} disabled={loadingReview} className="tap glass-2" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 10, cursor: "pointer", border: "1px solid var(--hairline)", color: "var(--ink-2)", fontSize: 12, fontWeight: 700 }}>
              <Icon name="refresh" size={13} /> {loadingReview ? "Loading..." : "Refresh"}
            </button>
          </div>

          {loadingReview ? (
            <div style={{ color: "var(--ink-4)", fontSize: 14, padding: 24, textAlign: "center" }}>Loading monthly records...</div>
          ) : (
            <React.Fragment>
              {/* Leaderboard Podium & Weekly Spotlight */}
              {sortedStaff.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20 }} className="review-dashboard-grid">
                  {/* Leaderboard Podium Card */}
                  <div className="glass rise" style={{ padding: 24, borderRadius: "var(--radius)", display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <SectionLabel style={{ margin: 0 }} right={<span className="mono" style={{ fontSize: 11, color: "var(--warn)" }}>top performers</span>}>Monthly Leaderboard</SectionLabel>
                      <Icon name="award" size={16} style={{ color: "var(--warn)" }} />
                    </div>
                    
                    {/* Podium Grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr", gap: 12, alignItems: "end", padding: "16px 0 10px 0", minHeight: 180 }}>
                      {/* Rank 2 */}
                      {sortedStaff[1] && (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                          <Avatar name={sortedStaff[1].name} size={42} />
                          <div style={{ fontSize: 12, fontWeight: 750, color: "var(--ink)", textAlign: "center" }}>{sortedStaff[1].name.split(" ")[0]}</div>
                          <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)" }}>{ATT.attFmtMins(sortedStaff[1].workedMins)}</div>
                          <div style={{ height: 50, width: "100%", background: "var(--glass-2)", border: "1px solid var(--hairline)", borderBottom: "none", borderRadius: "8px 8px 0 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span style={{ fontSize: 13, fontWeight: 850, color: "var(--ink-3)" }}>2nd</span>
                          </div>
                        </div>
                      )}

                      {/* Rank 1 */}
                      {sortedStaff[0] && (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                          <div style={{ position: "relative" }}>
                            <Avatar name={sortedStaff[0].name} size={54} />
                            <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", fontSize: 14 }}>👑</div>
                          </div>
                          <div style={{ fontSize: 13.5, fontWeight: 850, color: "var(--accent)", textAlign: "center" }}>{sortedStaff[0].name.split(" ")[0]}</div>
                          <div className="mono" style={{ fontSize: 11, color: "var(--accent)", fontWeight: 750 }}>{ATT.attFmtMins(sortedStaff[0].workedMins)}</div>
                          <div style={{ height: 75, width: "100%", background: "color-mix(in oklch, var(--warn) 10%, var(--glass-2))", border: "1px solid var(--warn)", borderBottom: "none", borderRadius: "10px 10px 0 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span style={{ fontSize: 16, fontWeight: 900, color: "var(--warn)" }}>1st</span>
                          </div>
                        </div>
                      )}

                      {/* Rank 3 */}
                      {sortedStaff[2] && (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                          <Avatar name={sortedStaff[2].name} size={38} />
                          <div style={{ fontSize: 11.5, fontWeight: 750, color: "var(--ink)", textAlign: "center" }}>{sortedStaff[2].name.split(" ")[0]}</div>
                          <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{ATT.attFmtMins(sortedStaff[2].workedMins)}</div>
                          <div style={{ height: 35, width: "100%", background: "var(--glass-2)", border: "1px solid var(--hairline)", borderBottom: "none", borderRadius: "6px 6px 0 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span style={{ fontSize: 12, fontWeight: 800, color: "var(--ink-4)" }}>3rd</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Spotlight Card */}
                  <div className="glass rise" style={{ padding: 24, borderRadius: "var(--radius)", display: "flex", flexDirection: "column", gap: 14 }}>
                    <SectionLabel style={{ margin: 0 }} right={<span className="mono" style={{ fontSize: 11, color: "var(--ok)" }}>excellence</span>}>Spotlight Staff</SectionLabel>
                    
                    {(() => {
                      const perfectPresence = [...sortedStaff]
                        .filter(s => s.shiftsCount >= 5)
                        .sort((a, b) => (a.lateCount - b.lateCount) || (b.shiftsCount - a.shiftsCount))[0] || sortedStaff[0];
                      
                      if (!perfectPresence) return <div style={{ color: "var(--ink-4)", fontSize: 12 }}>No records.</div>;
                      
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", justifyContent: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <Avatar name={perfectPresence.name} size={42} />
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 750, color: "var(--ink)" }}>{perfectPresence.name}</div>
                              <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2, textTransform: "capitalize" }}>{perfectPresence.branch} Centre</div>
                            </div>
                          </div>
                          
                          <div className="inset" style={{ padding: "10px 12px", borderRadius: 10 }}>
                            <div style={{ fontSize: 10, color: "var(--ink-4)", fontWeight: 700, textTransform: "uppercase" }}>Monthly Highlight</div>
                            <div style={{ fontSize: 12.5, fontWeight: 650, color: "var(--ink-2)", marginTop: 6 }}>
                              Completed <strong style={{ color: "var(--accent)" }}>{perfectPresence.shiftsCount} shifts</strong> with <strong style={{ color: "var(--ok)" }}>{perfectPresence.lateCount} lates</strong>. Outstanding punctuality!
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Centre-wise stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                {Object.keys(branchStats).length === 0 ? (
                  <div style={{ gridColumn: "1 / -1", color: "var(--ink-4)", fontSize: 13, padding: 12, textAlign: "center" }}>No activity recorded for this period.</div>
                ) : (
                  Object.entries(branchStats).map(([brName, stats]: [string, any]) => {
                    const lateRate = stats.shiftsCount > 0 ? Math.round((stats.lateCount / stats.shiftsCount) * 100) : 0;
                    const avgMins = stats.shiftsCount > 0 ? Math.round(stats.workedMins / stats.shiftsCount) : 0;
                    return (
                      <div key={brName} className="glass" style={{ padding: "16px 18px", borderRadius: "var(--radius)" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "1px" }}>{brName} Centre</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--accent)", marginTop: 6 }}>{stats.shiftsCount} Shifts</div>
                        <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                          <div>Lates: <strong style={{ color: lateRate > 15 ? "var(--warn)" : "var(--ok)" }}>{stats.lateCount}</strong> ({lateRate}% rate)</div>
                          <div>Worked: <strong>{ATT.attFmtMins(stats.workedMins)}</strong> (Avg: {ATT.attFmtMins(avgMins)}/sh)</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Staff-wise list */}
              {Object.keys(staffStats).length > 0 && (
                <div className="glass" style={{ borderRadius: "var(--radius)", padding: "10px 4px", overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--hairline)" }}>
                        <th onClick={() => toggleSort("name")} style={{ textAlign: "left", padding: "12px 14px", fontSize: 10, color: "var(--ink-4)", cursor: "pointer", textTransform: "uppercase" }}>
                          Staff {sortKey === "name" && (sortAsc ? "▲" : "▼")}
                        </th>
                        <th onClick={() => toggleSort("branch")} style={{ textAlign: "left", padding: "12px 14px", fontSize: 10, color: "var(--ink-4)", cursor: "pointer", textTransform: "uppercase" }}>
                          Home Branch {sortKey === "branch" && (sortAsc ? "▲" : "▼")}
                        </th>
                        <th onClick={() => toggleSort("shiftsCount")} style={{ textAlign: "right", padding: "12px 14px", fontSize: 10, color: "var(--ink-4)", cursor: "pointer", textTransform: "uppercase" }}>
                          Shifts {sortKey === "shiftsCount" && (sortAsc ? "▲" : "▼")}
                        </th>
                        <th onClick={() => toggleSort("lateCount")} style={{ textAlign: "right", padding: "12px 14px", fontSize: 10, color: "var(--ink-4)", cursor: "pointer", textTransform: "uppercase" }}>
                          Lates {sortKey === "lateCount" && (sortAsc ? "▲" : "▼")}
                        </th>
                        <th onClick={() => toggleSort("breakMins")} style={{ textAlign: "right", padding: "12px 14px", fontSize: 10, color: "var(--ink-4)", cursor: "pointer", textTransform: "uppercase" }}>
                          Breaks {sortKey === "breakMins" && (sortAsc ? "▲" : "▼")}
                        </th>
                        <th onClick={() => toggleSort("workedMins")} style={{ textAlign: "right", padding: "12px 14px", fontSize: 10, color: "var(--ink-4)", cursor: "pointer", textTransform: "uppercase" }}>
                          Worked Hours {sortKey === "workedMins" && (sortAsc ? "▲" : "▼")}
                        </th>
                        <th style={{ textAlign: "right", padding: "12px 14px", fontSize: 10, color: "var(--ink-4)", textTransform: "uppercase" }}>
                          Avg Shift
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedStaff.map((s: any, idx) => {
                        const avgMins = s.shiftsCount > 0 ? Math.round(s.workedMins / s.shiftsCount) : 0;
                        return (
                          <tr key={idx} className="hover-lift-subtle" style={{ borderBottom: "1px solid var(--hairline)", verticalAlign: "middle" }}>
                            <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
                              <Avatar name={s.name} size={24} />
                              <span>{s.name}</span>
                            </td>
                            <td style={{ padding: "12px 14px", fontSize: 12.5, color: "var(--ink-3)", textTransform: "capitalize" }}>{s.branch}</td>
                            <td style={{ padding: "12px 14px", fontSize: 13, color: "var(--ink)", textAlign: "right", fontWeight: 600 }}>{s.shiftsCount}</td>
                            <td style={{ padding: "12px 14px", fontSize: 13, color: s.lateCount > 0 ? "var(--warn)" : "var(--ok)", textAlign: "right", fontWeight: 650 }}>{s.lateCount}</td>
                            <td style={{ padding: "12px 14px", fontSize: 12, color: "var(--ink-3)", textAlign: "right", fontFamily: "monospace" }}>{s.breakMins ? `${s.breakMins}m` : "—"}</td>
                            <td style={{ padding: "12px 14px", fontSize: 13, color: "var(--accent)", textAlign: "right", fontWeight: 700, fontFamily: "monospace" }}>{ATT.attFmtMins(s.workedMins)}</td>
                            <td style={{ padding: "12px 14px", fontSize: 12.5, color: "var(--ink-2)", textAlign: "right", fontFamily: "monospace" }}>{ATT.attFmtMins(avgMins)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </React.Fragment>
          )}
        </section>
      )}

      {isAdmin && quickOpen && <QuickAddRoster branch={branch} onClose={() => setQuickOpen(false)} />}
      <Drawer open={!!dayDrawer} onClose={() => setDayDrawer(null)} icon="users"
        title={dayDrawer ? `${window.P_WDL[dayDrawer.getDay()]}, ${window.P_MO[dayDrawer.getMonth()]} ${dayDrawer.getDate()}` : ""}
        sub={`${capBranch(branch)} · coverage detail`}>
        {dayDrawer && <DayDetailPanel date={dayDrawer} branch={branch} />}
      </Drawer>
    </div>
  );
}

Object.assign(window, { CalendarPage, RosterPage });

/* ============================================================
   SOURCE: pages-desk.jsx
   ============================================================ */
/* ============================================================
   FETS · LIVE — Raise a Case
   3-pane support playground: Category · Case queue · Live thread
   + Analysis view
   ============================================================ */

const PRIO_COLOR = { Urgent: "var(--bad)", High: "var(--warn)", Medium: "var(--accent)", Low: "var(--ink-4)" };
const STATUS_META = {
  open:     { label: "Open", color: "var(--warn)" },
  progress: { label: "In progress", color: "var(--v-prometric)" },
  resolved: { label: "Resolved", color: "var(--ok)" },
};
const STATUS_ORDER = ["open", "progress", "resolved"];
const caseNow = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

/* ---------- small form atoms ---------- */
function FieldLabel({ children }) {
  return <div className="eyebrow" style={{ fontSize: 10, color: "var(--ink-3)", marginBottom: 9 }}>{children}</div>;
}

function ChipRow({ options, value, onChange, multi, format }) {
  const isOn = (o) => (multi ? value.includes(o) : value === o);
  const pick = (o) => multi ? onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]) : onChange(o);
  const lbl = (o) => (format ? format(o) : (o.charAt(0).toUpperCase() + o.slice(1)));
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => {
        const on = isOn(o);
        return (
          <button key={o} type="button" onClick={() => pick(o)} className="tap"
            style={{ padding: "8px 13px", borderRadius: 999, cursor: "pointer", fontFamily: "var(--font)", fontSize: 12.5, fontWeight: 650,
              border: `1px solid ${on ? "var(--accent-line)" : "var(--hairline)"}`,
              background: on ? "var(--accent-soft)" : "var(--inset)", color: on ? "var(--ink)" : "var(--ink-3)" }}>
            {lbl(o)}
          </button>
        );
      })}
    </div>
  );
}

const caseInput = {
  width: "100%", padding: "12px 14px", borderRadius: 11, fontFamily: "var(--font)", fontSize: 14, fontWeight: 500,
  color: "var(--ink)", background: "var(--inset)", border: "1px solid var(--hairline)", outline: "none",
};

/* =====================================================================
   RAISE-A-CASE FORM  (Manual drawer fallback)
   ===================================================================== */
function RaiseCaseForm({ branch, onSubmit }) {
  const [cat, setCat] = React.useState("Technical");
  const [prio, setPrio] = React.useState("Medium");
  
  const isSuperAdmin = !!window.FETS?.isAdmin;
  const hasDelegation = !!window.FETS?._hasTempCrossAccess;
  const userProfileBranch = window.FETS?._meBranch || 'cochin';

  const defaultBr = (isSuperAdmin || hasDelegation)
    ? (branch === "global" ? "cochin" : branch)
    : userProfileBranch;

  const [br, setBr] = React.useState(defaultBr);

  React.useEffect(() => {
    if (isSuperAdmin || hasDelegation) {
      setBr(branch === "global" ? "cochin" : branch);
    } else {
      setBr(userProfileBranch);
    }
  }, [branch]);

  const [vendor, setVendor] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [desc, setDesc] = React.useState("");

  const submit = () => {
    if (!subject.trim()) { toast("Add a short subject first", "alert"); return; }
    const id = `FC-${2049 + Math.floor(Math.random() * 200)}`;
    onSubmit({
      id, subject: subject.trim(), category: cat, priority: prio,
      branch: br, vendor: vendor || null, status: "open", assignee: window.FETS.user.name,
      opened: "Just now", age: "now", detail: desc.trim() || "No further detail provided yet.",
      contact: null,
      thread: [{ id: "m" + Date.now(), kind: "msg", author: window.FETS.user.name, role: "staff", text: desc.trim() || "Case raised.", when: caseNow() }],
    });
    setSubject(""); setDesc(""); setVendor("");
    toast("Case raised", "check");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <FieldLabel>Category</FieldLabel>
        <ChipRow options={window.FETS.CASE_CATEGORIES} value={cat} onChange={setCat} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }} className="case-2col">
        <div>
          <FieldLabel>Priority</FieldLabel>
          <ChipRow options={window.FETS.CASE_PRIORITIES} value={prio} onChange={setPrio} />
        </div>
        <div>
          <FieldLabel>Centre</FieldLabel>
          <div style={{ opacity: (isSuperAdmin || hasDelegation) ? 1 : 0.65, pointerEvents: (isSuperAdmin || hasDelegation) ? "auto" : "none" }}>
            <ChipRow options={["calicut", "cochin"]} value={br} onChange={setBr} />
          </div>
        </div>
      </div>
      <div>
        <FieldLabel>Vendor (optional)</FieldLabel>
        <ChipRow options={["", ...window.FETS.VENDORS.map((v) => v.slug)]} value={vendor} onChange={setVendor}
          format={(o) => (o === "" ? "None" : (window.VENDOR_BY_SLUG[o] ? window.VENDOR_BY_SLUG[o].name : o))} />
      </div>
      <div>
        <FieldLabel>Subject</FieldLabel>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="One-line summary of the issue" style={caseInput} />
      </div>
      <div>
        <FieldLabel>What happened?</FieldLabel>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={5} placeholder="Where, when, and any candidate / vendor reference numbers…"
          style={{ ...caseInput, resize: "vertical", lineHeight: 1.5 }} />
      </div>
      <button onClick={submit} className="tap" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px 20px", borderRadius: 12,
        border: "none", cursor: "pointer", fontFamily: "var(--font)", fontSize: 14, fontWeight: 700, color: "var(--accent-ink)", background: "var(--accent)" }}>
        <Icon name="plus" size={16} stroke={2.5} /> Submit case
      </button>
    </div>
  );
}

/* =====================================================================
   BUBBLE — Slack Chronological Message rendering
   ===================================================================== */
function Bubble({ m }) {
  const isSystem = m.text.startsWith("[System]") || m.kind === "status";
  const displayVal = m.text.startsWith("[System]") ? m.text.replace("[System]", "").trim() : m.text;
  
  if (isSystem) {
    return (
      <div style={{ display: "flex", justifyContent: "center", margin: "6px 0" }}>
        <span className="system-msg-pill glass" style={{
          display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 99,
          background: "var(--glass-2)", border: "1px solid var(--hairline)", fontSize: 11, fontWeight: 650, color: "var(--ink-2)"
        }}>
          <Icon name="refresh" size={11} style={{ color: "var(--accent)" }} /> 
          <span>{displayVal}</span>
          <span className="mono" style={{ color: "var(--ink-4)", fontSize: 9.5, marginLeft: 4 }}>{m.when}</span>
        </span>
      </div>
    );
  }

  const staff = m.role === "staff" || m.role === "user";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: staff ? "flex-end" : "flex-start", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 4px", flexDirection: staff ? "row-reverse" : "row" }}>
        {!staff && <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--v-prometric)", flexShrink: 0 }} />}
        <span style={{ fontSize: 11.5, fontWeight: 700, color: staff ? "var(--accent)" : "var(--ink-2)" }}>{m.author}</span>
        {!staff && (
          <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--v-prometric)",
            background: "color-mix(in oklch, var(--v-prometric) 15%, transparent)", padding: "1px 6px", borderRadius: 5 }}>Proctor</span>
        )}
        <span className="mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>{m.when}</span>
      </div>
      <div style={{ maxWidth: "78%", padding: "11px 14px", borderRadius: 14, fontSize: 13.5, lineHeight: 1.5, fontWeight: 500,
        borderTopRightRadius: staff ? 4 : 14, borderTopLeftRadius: staff ? 14 : 4,
        color: staff ? "var(--accent-ink)" : "var(--ink)", background: staff ? "var(--accent)" : "var(--glass-2)",
        border: staff ? "none" : "1px solid var(--hairline)" }}>
        {displayVal}
      </div>
    </div>
  );
}

/* =====================================================================
   CONTACT STRIP — Outside / Candidate details mapping
   ===================================================================== */
function ContactStrip({ c, onSave, isLocked }) {
  const [edit, setEdit] = React.useState(false);
  const [name, setName] = React.useState(c.contact ? c.contact.name : "");
  const [phone, setPhone] = React.useState(c.contact ? c.contact.phone : "");
  const [role, setRole] = React.useState(c.contact ? c.contact.role : "");
  
  React.useEffect(() => { 
    setName(c.contact ? c.contact.name : ""); 
    setPhone(c.contact ? c.contact.phone : ""); 
    setRole(c.contact ? c.contact.role : ""); 
    setEdit(false); 
  }, [c.id]);

  if (edit) {
    return (
      <div className="inset" style={{ padding: 13, borderRadius: 13, display: "flex", flexDirection: "column", gap: 9 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" style={{ ...caseInput, padding: "9px 12px", fontSize: 13 }} />
          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role (e.g. Candidate)" style={{ ...caseInput, padding: "9px 12px", fontSize: 13 }} />
        </div>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Contact number" style={{ ...caseInput, padding: "9px 12px", fontSize: 13 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { onSave({ name: name.trim() || "Contact", role: role.trim() || "External", phone: phone.trim(), email: c.contact ? c.contact.email : "", external: true }); setEdit(false); toast("Contact saved", "check"); }}
            className="tap" style={{ padding: "8px 15px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "var(--font)", fontSize: 12.5, fontWeight: 700, color: "var(--accent-ink)", background: "var(--accent)" }}>Save</button>
          <button onClick={() => setEdit(false)} className="tap glass-2" style={{ padding: "8px 15px", borderRadius: 9, border: "1px solid var(--hairline)", cursor: "pointer", fontFamily: "var(--font)", fontSize: 12.5, fontWeight: 650, color: "var(--ink-3)" }}>Cancel</button>
        </div>
      </div>
    );
  }
  
  if (!c.contact) {
    return isLocked ? (
      <div className="inset" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 12,
        color: "var(--ink-4)", fontFamily: "var(--font)", fontSize: 12.5, fontWeight: 650 }}>
        No outside contact linked
      </div>
    ) : (
      <button onClick={() => setEdit(true)} className="tap inset" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 12,
        cursor: "pointer", borderStyle: "dashed", color: "var(--ink-3)", fontFamily: "var(--font)", fontSize: 12.5, fontWeight: 650 }}>
        <Icon name="plus" size={14} /> Add an outside contact (name &amp; number)
      </button>
    );
  }
  
  const ct = c.contact;
  return (
    <div className="inset" style={{ padding: "12px 14px", borderRadius: 13, display: "flex", alignItems: "center", gap: 12 }}>
      <Avatar name={ct.name} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>{ct.name}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: ct.external ? "var(--v-prometric)" : "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{ct.role}</span>
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 3, fontSize: 11.5, color: "var(--ink-3)", fontWeight: 600, flexWrap: "wrap" }}>
          {ct.phone && <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="phone" size={12} /> {ct.phone}</span>}
          {ct.email && <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="at" size={12} /> {ct.email}</span>}
        </div>
      </div>
      {!isLocked && (
        <button onClick={() => setEdit(true)} className="tap" title="Edit contact" style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--hairline)", background: "transparent", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--ink-3)" }}>
          <Icon name="settings" size={14} />
        </button>
      )}
    </div>
  );
}

/* =====================================================================
   CASE PLAYGROUND — Slack Conversation + Console Feed
   ===================================================================== */
function CasePlayground({ c, onStatus, onPost, onContact, onClaim, onEscalate, isLocked }) {
  const [mode, setMode] = React.useState("staff");
  const [draft, setDraft] = React.useState("");
  const [extName, setExtName] = React.useState("");
  const [extPhone, setExtPhone] = React.useState("");
  const threadRef = React.useRef(null);
  const v = c.vendor ? window.VENDOR_BY_SLUG[c.vendor] : null;

  React.useEffect(() => { setMode("staff"); setDraft(""); setExtName(""); setExtPhone(""); }, [c.id]);
  React.useEffect(() => { if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight; }, [c.thread.length, c.id]);

  const send = () => {
    if (!draft.trim()) return;
    const staff = mode === "staff";
    
    let textToSend = draft.trim();
    if (!staff) {
      const displayAuthor = extName.trim() || "External contact";
      textToSend = `[Contact: ${displayAuthor}] ${textToSend}`;
    }

    onPost(c.id, textToSend);

    if (!staff && !c.contact && (extName.trim() || extPhone.trim())) {
      onContact(c.id, { name: extName.trim() || "External contact", role: "External", phone: extPhone.trim(), email: "", external: true });
    }
    setDraft("");
  };

  const isAssignedToMe = c.assignee === window.FETS.user.name;

  return (
    <div className="glass" style={{ borderRadius: "var(--radius)", display: "flex", flexDirection: "column", overflow: "hidden", height: "calc(100vh - 220px)", minHeight: 620 }}>
      {/* header */}
      <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--hairline)", flexShrink: 0, display: "flex", flexDirection: "column", gap: 13, borderTop: `3px solid ${PRIO_COLOR[c.priority]}` }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}>
              <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-4)" }}>{c.id}</span>
              <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", padding: "3px 8px", borderRadius: 999,
                color: PRIO_COLOR[c.priority], background: `color-mix(in oklch, ${PRIO_COLOR[c.priority]} 16%, transparent)` }}>{c.priority}</span>
            </div>
            <h2 style={{ margin: 0, fontSize: 21, fontWeight: 720, letterSpacing: "-0.02em", color: "var(--ink)", lineHeight: 1.2 }}>{c.subject}</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 9, flexWrap: "wrap", fontSize: 11.5, color: "var(--ink-3)", fontWeight: 600 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="grid" size={12} style={{ color: "var(--ink-4)" }} /> {c.category}</span>
              {v && <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: v.color }} /> {v.name}</span>}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, textTransform: "capitalize" }}><Icon name="mapPin" size={12} style={{ color: "var(--ink-4)" }} /> {c.branch}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Avatar name={c.assignee || "?"} size={18} /> 
                <span>{c.assignee ? `Assigned to ${c.assignee}` : "Unassigned"}</span>
              </span>
              <span className="mono" style={{ color: "var(--ink-4)" }}>{c.opened}</span>
            </div>
          </div>
        </div>

        {/* Quick Actions Console */}
        <div style={{ display: "flex", alignItems: "center", justifyItems: "center", gap: 10, flexWrap: "wrap", borderTop: "1px solid var(--hairline)", paddingTop: 12 }}>
          <span className="eyebrow" style={{ fontSize: 9.5, color: "var(--ink-4)" }}>Quick actions</span>
          
          <button onClick={() => !isLocked && onClaim(c.id)} disabled={isLocked} className="tap"
            style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "1px solid var(--hairline)", cursor: "pointer",
              background: isAssignedToMe ? "var(--glass-strong)" : "var(--accent-soft)", color: isAssignedToMe ? "var(--ink-3)" : "var(--ink)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icon name="user" size={13} /> {isAssignedToMe ? "Claimed by you" : "Claim Case"}
          </button>

          <button onClick={() => !isLocked && onStatus(c.id, "progress")} disabled={isLocked || c.status === "progress"} className="tap"
            style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "1px solid var(--hairline)", cursor: (isLocked || c.status === "progress") ? "default" : "pointer",
              background: c.status === "progress" ? "rgba(59, 130, 246, 0.15)" : "transparent", color: c.status === "progress" ? "var(--v-prometric)" : "var(--ink-2)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: "var(--v-prometric)" }} /> In Progress
          </button>

          <button onClick={() => !isLocked && onStatus(c.id, "resolved")} disabled={isLocked || c.status === "resolved"} className="tap"
            style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "1px solid var(--hairline)", cursor: (isLocked || c.status === "resolved") ? "default" : "pointer",
              background: c.status === "resolved" ? "rgba(16, 185, 129, 0.15)" : "transparent", color: c.status === "resolved" ? "var(--ok)" : "var(--ink-2)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icon name="check" size={13} style={{ color: "var(--ok)" }} /> Resolve Case
          </button>

          <button onClick={() => !isLocked && onEscalate(c.id)} disabled={isLocked || c.priority === "Urgent"} className="tap"
            style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "1px solid rgba(239, 68, 68, 0.2)", cursor: (isLocked || c.priority === "Urgent") ? "default" : "pointer",
              background: c.priority === "Urgent" ? "rgba(239, 68, 68, 0.15)" : "transparent", color: "var(--bad)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icon name="alert" size={13} style={{ color: "var(--bad)" }} /> {c.priority === "Urgent" ? "Escalated" : "Escalate to Critical"}
          </button>
        </div>
      </div>

      {/* contact + detail + thread (scroll) */}
      <div ref={threadRef} className="scroll-soft" style={{ flex: 1, overflowY: "auto", padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14, minHeight: 0 }}>
        <ContactStrip c={c} onSave={(ct) => onContact(c.id, ct)} isLocked={isLocked} />
        <div className="inset" style={{ padding: "12px 14px", borderRadius: 12, fontSize: 13, color: "var(--ink-2)", fontWeight: 500, lineHeight: 1.55,
          fontFamily: "var(--font-serif)", fontStyle: "italic", borderLeft: "3px solid var(--accent-line)" }}>{c.detail}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 0" }}>
          <span style={{ flex: 1, height: 1, background: "var(--hairline)" }} />
          <span className="eyebrow" style={{ fontSize: 9, color: "var(--ink-4)" }}>Conversation Feed</span>
          <span style={{ flex: 1, height: 1, background: "var(--hairline)" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {c.thread.map((m) => <Bubble key={m.id} m={m} />)}
        </div>
      </div>

      {/* composer */}
      {isLocked ? (
        <div style={{ borderTop: "1px solid var(--hairline)", padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "var(--glass-2)", color: "var(--ink-3)", fontSize: 13, fontWeight: 650 }}>
          <Icon name="lock" size={15} /> This case is in {c.branch.toUpperCase()} and is locked (read-only)
        </div>
      ) : (
        <div style={{ borderTop: "1px solid var(--hairline)", padding: "13px 16px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 10, background: "var(--glass-2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <span className="eyebrow" style={{ fontSize: 9, color: "var(--ink-4)" }}>Post as</span>
            <div className="inset" style={{ display: "inline-flex", padding: 3, gap: 2, borderRadius: 999 }}>
              {[{ k: "staff", label: "You · Staff" }, { k: "external", label: "Outside contact" }].map((o) => {
                const on = mode === o.k;
                return (
                  <button key={o.k} onClick={() => setMode(o.k)} className="tap" style={{ border: "none", cursor: "pointer", padding: "6px 13px", borderRadius: 999,
                    fontFamily: "var(--font)", fontSize: 11.5, fontWeight: on ? 700 : 550, color: on ? "var(--ink)" : "var(--ink-3)",
                    background: on ? "var(--glass-strong)" : "transparent", boxShadow: on ? "var(--shadow)" : "none" }}>{o.label}</button>
                );
              })}
            </div>
          </div>
          {mode === "external" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input value={extName} onChange={(e) => setExtName(e.target.value)} placeholder="Proctor name" style={{ ...caseInput, padding: "9px 12px", fontSize: 12.5 }} />
              <input value={extPhone} onChange={(e) => setExtPhone(e.target.value)} placeholder="Proctor phone/seat" style={{ ...caseInput, padding: "9px 12px", fontSize: 12.5 }} />
            </div>
          )}
          <div style={{ display: "flex", gap: 9, alignItems: "flex-end" }}>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={1}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={mode === "staff" ? "Type update here… (Press Enter to post)" : "Log proctor feedback…"}
              style={{ ...caseInput, padding: "11px 14px", resize: "none", lineHeight: 1.4, minHeight: 44 }} />
            <button onClick={send} className="tap" style={{ width: 46, height: 46, borderRadius: 12, border: "none", cursor: "pointer", flexShrink: 0,
              display: "grid", placeItems: "center", color: "var(--accent-ink)", background: "var(--accent)" }}>
              <Icon name="arrowR" size={19} stroke={2.4} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* =====================================================================
   ANALYSIS VIEW
   ===================================================================== */
function CaseAnalysis({ cases }) {
  const byCat = {}; window.FETS.CASE_CATEGORIES.forEach((k) => byCat[k] = 0);
  cases.forEach((c) => { byCat[c.category] = (byCat[c.category] || 0) + 1; });
  const catRows = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const catMax = Math.max(1, ...catRows.map((r) => r[1]));

  const statusSeg = STATUS_ORDER.map((s) => ({ label: STATUS_META[s].label, color: STATUS_META[s].color, n: cases.filter((c) => c.status === s).length }));
  const prioSeg = ["Urgent", "High", "Medium", "Low"].map((p) => ({ label: p, color: PRIO_COLOR[p], n: cases.filter((c) => c.priority === p).length }));
  const total = cases.length;
  const resolved = cases.filter((c) => c.status === "resolved").length;
  const resPct = total ? Math.round(resolved / total * 100) : 0;

  const byBranch = [["calicut", "Calicut"], ["cochin", "Cochin"]].map(([k, l]) => ({ label: l, n: cases.filter((c) => c.branch === k).length }));
  const branchMax = Math.max(1, ...byBranch.map((b) => b.n));

  const stats = [
    { v: total, l: "Total cases", tone: "var(--accent)" },
    { v: cases.filter((c) => c.status === "open").length, l: "Open", tone: "var(--warn)" },
    { v: cases.filter((c) => c.priority === "Urgent" && c.status !== "resolved").length, l: "Urgent · unresolved", tone: "var(--bad)" },
    { v: resPct + "%", l: "Resolution rate", tone: "var(--ok)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "calc(22px * var(--density))" }}>
      <section style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {stats.map((s) => (
          <div key={s.l} className="glass" style={{ padding: "18px 20px", borderRadius: "var(--radius)", flex: "1 1 160px", minWidth: 150 }}>
            <div className="tabnum mono" style={{ fontSize: 38, fontWeight: 700, letterSpacing: "-0.04em", color: s.tone, lineHeight: 1 }}>{s.v}</div>
            <div className="eyebrow" style={{ marginTop: 12, color: "var(--ink-3)" }}>{s.l}</div>
          </div>
        ))}
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "calc(20px * var(--density))", alignItems: "start" }} className="case-cols">
        <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SectionLabel>Cases by category</SectionLabel>
          <div className="glass" style={{ padding: "20px 22px", borderRadius: "var(--radius)", display: "flex", flexDirection: "column", gap: 13 }}>
            {catRows.map(([k, n]) => <BarRow key={k} label={k} n={n} max={catMax} color="var(--accent)" />)}
          </div>
          <SectionLabel>Cases by centre</SectionLabel>
          <div className="glass" style={{ padding: "20px 22px", borderRadius: "var(--radius)", display: "flex", flexDirection: "column", gap: 13 }}>
            {byBranch.map((b) => <BarRow key={b.label} label={b.label} n={b.n} max={branchMax} color="var(--v-prometric)" />)}
          </div>
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SectionLabel>By status</SectionLabel>
          <div className="glass" style={{ padding: "22px", borderRadius: "var(--radius)" }}>
            <Donut segments={statusSeg} total={total} centerLabel={total} centerSub="cases" />
          </div>
          <SectionLabel>By priority</SectionLabel>
          <div className="glass" style={{ padding: "22px", borderRadius: "var(--radius)" }}>
            <Donut segments={prioSeg} total={total} centerLabel={prioSeg[0].n} centerSub="urgent" />
          </div>
        </section>
      </div>
    </div>
  );
}

/* =====================================================================
   LABELED SELECT Atom
   ===================================================================== */
const caseSelStyle = {
  appearance: "none", WebkitAppearance: "none", width: "100%", padding: "11px 36px 11px 14px", borderRadius: 11,
  fontFamily: "var(--font)", fontSize: 13.5, fontWeight: 600, color: "var(--ink)", background: "var(--inset)",
  border: "1px solid var(--hairline)", cursor: "pointer", outline: "none",
};
function LabeledSelect({ label, value, onChange, children, grow }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: grow ? 240 : 150, flex: grow ? "1 1 280px" : "0 0 auto" }}>
      <span className="eyebrow" style={{ fontSize: 9.5, color: "var(--ink-4)" }}>{label}</span>
      <div style={{ position: "relative" }}>
        <select value={value} onChange={onChange} style={caseSelStyle}>{children}</select>
        <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--ink-3)" }}><Icon name="chevronD" size={15} /></span>
      </div>
    </label>
  );
}

/* =====================================================================
   MAIN PAGE OVERHAUL (Stream Deck + Slack Command Console)
   ===================================================================== */
const DEFAULT_PRESETS = [
  { id: "p1", title: "Workstation Offline", category: "Technical", priority: "High", tint: "Red", icon: "power", promptType: "numeric", promptLabel: "Workstation #" },
  { id: "p2", title: "AC Stopped", category: "Facility", priority: "Urgent", tint: "Amber", icon: "alert", promptType: "text", promptLabel: "Which room/area?" },
  { id: "p3", title: "Headphones Broken", category: "Candidate", priority: "Low", tint: "Gold", icon: "headset", promptType: "numeric", promptLabel: "Candidate Seat #" },
  { id: "p4", title: "Candidate Cheating", category: "Security", priority: "Urgent", tint: "Red", icon: "shield", promptType: "text", promptLabel: "Seat / Name" },
  { id: "p5", title: "Exam Launch Failure", category: "Technical", priority: "High", tint: "Purple", icon: "clock", promptType: "numeric", promptLabel: "Workstation #" },
  { id: "p6", title: "Power Fluctuated", category: "Facility", priority: "Low", tint: "Blue", icon: "pulse", promptType: "none", promptLabel: "" }
];

function RaiseCasePage({ branch, setActive }) {
  // Styles for the new stream deck and keypad
  const styleBlock = `
    .stream-deck-card {
      position: relative;
      background: var(--glass);
      border: 1px solid var(--hairline);
      border-radius: 16px;
      padding: 16px;
      box-shadow: var(--shadow);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 105px;
      cursor: pointer;
      transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      overflow: hidden;
    }
    .stream-deck-card:hover {
      transform: translateY(-4px) scale(1.02);
      border-color: var(--accent-line);
    }
    .stream-deck-card.Red {
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(239, 68, 68, 0.02) 100%);
      border-color: rgba(239, 68, 68, 0.2);
    }
    .stream-deck-card.Red:hover {
      border-color: rgba(239, 68, 68, 0.6);
      box-shadow: 0 0 20px rgba(239, 68, 68, 0.25);
    }
    .stream-deck-card.Amber {
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.02) 100%);
      border-color: rgba(245, 158, 11, 0.2);
    }
    .stream-deck-card.Amber:hover {
      border-color: rgba(245, 158, 11, 0.6);
      box-shadow: 0 0 20px rgba(245, 158, 11, 0.25);
    }
    .stream-deck-card.Gold {
      background: linear-gradient(135deg, rgba(234, 179, 8, 0.08) 0%, rgba(234, 179, 8, 0.02) 100%);
      border-color: rgba(234, 179, 8, 0.2);
    }
    .stream-deck-card.Gold:hover {
      border-color: rgba(234, 179, 8, 0.6);
      box-shadow: 0 0 20px rgba(234, 179, 8, 0.25);
    }
    .stream-deck-card.Green {
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.02) 100%);
      border-color: rgba(16, 185, 129, 0.2);
    }
    .stream-deck-card.Green:hover {
      border-color: rgba(16, 185, 129, 0.6);
      box-shadow: 0 0 20px rgba(16, 185, 129, 0.25);
    }
    .stream-deck-card.Blue {
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.02) 100%);
      border-color: rgba(59, 130, 246, 0.2);
    }
    .stream-deck-card.Blue:hover {
      border-color: rgba(59, 130, 246, 0.6);
      box-shadow: 0 0 20px rgba(59, 130, 246, 0.25);
    }
    .stream-deck-card.Purple {
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(139, 92, 246, 0.02) 100%);
      border-color: rgba(139, 92, 246, 0.2);
    }
    .stream-deck-card.Purple:hover {
      border-color: rgba(139, 92, 246, 0.6);
      box-shadow: 0 0 20px rgba(139, 92, 246, 0.25);
    }
    .card-icon-container {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      display: grid;
      place-items: center;
      margin-bottom: 6px;
    }
    .wiggle-animation {
      animation: wiggle 0.3s ease-in-out infinite;
    }
    @keyframes wiggle {
      0%, 100% { transform: rotate(-1.5deg); }
      50% { transform: rotate(1.5deg); }
    }
    .num-btn {
      background: var(--glass-2);
      border: 1px solid var(--hairline);
      color: var(--ink);
      font-size: 17px;
      font-weight: 700;
      border-radius: 12px;
      padding: 12px;
      cursor: pointer;
      display: grid;
      place-items: center;
      transition: all 0.15s ease;
      font-family: var(--font-mono);
    }
    .num-btn:hover {
      background: var(--glass-strong);
      border-color: var(--accent-line);
      transform: scale(1.05);
    }
    .num-btn:active {
      transform: scale(0.95);
    }
    .case-badge-pill {
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
    }
    .system-msg-pill {
      background: var(--inset);
      color: var(--ink-3);
      font-size: 11px;
      font-weight: 650;
      padding: 6px 14px;
      border-radius: 99px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
  `;

  const [cases, setCases] = React.useState([]);
  const [view, setView] = React.useState("cases");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [cat, setCat] = React.useState("all");
  const [statusF, setStatusF] = React.useState("all");
  const [raiseOpen, setRaiseOpen] = React.useState(false);

  // Preset configuration
  const [presets, setPresets] = React.useState(() => {
    try {
      const stored = localStorage.getItem("fets_case_presets");
      return stored ? JSON.parse(stored) : DEFAULT_PRESETS;
    } catch (e) {
      return DEFAULT_PRESETS;
    }
  });

  const [editPresets, setEditPresets] = React.useState(false);
  const [editingPreset, setEditingPreset] = React.useState(null); // 'new' or preset object
  const [activePrompt, setActivePrompt] = React.useState(null); // { preset, value }

  // Preset Form fields
  const [formTitle, setFormTitle] = React.useState("");
  const [formCategory, setFormCategory] = React.useState("Technical");
  const [formPriority, setFormPriority] = React.useState("Medium");
  const [formTint, setFormTint] = React.useState("Red");
  const [formIcon, setFormIcon] = React.useState("power");
  const [formPromptType, setFormPromptType] = React.useState("none");
  const [formPromptLabel, setFormPromptLabel] = React.useState("");

  const isSuperAdmin = !!window.FETS?.isAdmin;
  const userProfileBranch = window.FETS?._meBranch || 'cochin';
  const isLocked = !isSuperAdmin && branch !== userProfileBranch;

  const formatAge = (dateStr) => {
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
          thread: (c.incident_comments || []).map((m: any) => ({
            id: m.id,
            kind: m.body.startsWith("[System]") ? "status" : "msg",
            role: m.author_id === (window.FETS?._meUserId || "00000000-0000-0000-0000-000000000000") ? "staff" : "proctor",
            author: m.author_full_name,
            text: m.body,
            when: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            rawTime: m.created_at
          })).sort((a: any, b: any) => new Date(a.rawTime).getTime() - new Date(b.rawTime).getTime()),
        }));

        setCases(loadedCases);
        window.FETS.CASES = loadedCases;
      }
    } catch (e) {
      console.error("fetchCases error:", e);
    }
  };

  React.useEffect(() => {
    fetchCases();
    const interval = setInterval(fetchCases, 5000);
    return () => clearInterval(interval);
  }, [branch]);

  const inBranch = cases.filter((c) => branch === "global" || c.branch === branch);
  const filtered = inBranch.filter((c) => {
    const matchesCat = cat === "all" || c.category === cat;
    const matchesStatus = statusF === "all" || c.status === statusF;
    const matchesSearch = !searchQuery.trim() || c.subject.toLowerCase().includes(searchQuery.toLowerCase()) || c.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesStatus && matchesSearch;
  });

  const [selectedId, setSelectedId] = React.useState(null);

  React.useEffect(() => {
    if (filtered.length > 0 && !filtered.find((c) => c.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [branch, cat, statusF, cases.length]);

  const selected = cases.find((c) => c.id === selectedId) || filtered[0] || null;

  const savePresets = (newPresets) => {
    setPresets(newPresets);
    try {
      localStorage.setItem("fets_case_presets", JSON.stringify(newPresets));
    } catch (e) {
      console.error(e);
    }
  };

  const handleStatusChange = async (id, s) => {
    if (isLocked) return;
    const c0 = cases.find((c) => c.id === id);
    if (!c0 || c0._dbId == null) return;

    // Optimistic Local State Update
    const sysMsg = { 
      id: "s" + Date.now(), 
      kind: "status", 
      role: "system", 
      author: window.FETS.user.name, 
      text: `[System] marked the case ${STATUS_META[s].label}`, 
      when: caseNow(), 
      rawTime: new Date().toISOString() 
    };
    
    setCases((cs) => cs.map((c) => c.id === id ? { ...c, status: s, thread: [...c.thread, sysMsg] } : c));

    // Supabase DB Sync
    await DB.dbSetCaseStatus(c0._dbId, s);
    await DB.dbAddCaseComment(c0._dbId, `[System] marked the case ${STATUS_META[s].label}`);
    
    fetchCases();
  };

  const handleClaimCase = async (id) => {
    if (isLocked) return;
    const c0 = cases.find((c) => c.id === id);
    if (!c0 || c0._dbId == null) return;

    const myName = window.FETS.user.name || "Staff";

    // Optimistic Local State Update
    const sysMsg = { 
      id: "s" + Date.now(), 
      kind: "status", 
      role: "system", 
      author: myName, 
      text: `[System] claimed this case`, 
      when: caseNow(), 
      rawTime: new Date().toISOString() 
    };

    setCases((cs) => cs.map((c) => c.id === id ? { ...c, assignee: myName, status: "progress", thread: [...c.thread, sysMsg] } : c));

    // Supabase DB Sync
    await DB.dbAssignCase(c0._dbId, myName);
    await DB.dbSetCaseStatus(c0._dbId, "progress");
    await DB.dbAddCaseComment(c0._dbId, `[System] claimed this case`);

    fetchCases();
  };

  const handleEscalateCase = async (id) => {
    if (isLocked) return;
    const c0 = cases.find((c) => c.id === id);
    if (!c0 || c0._dbId == null) return;

    // Optimistic Update
    const sysMsg = { 
      id: "s" + Date.now(), 
      kind: "status", 
      role: "system", 
      author: window.FETS.user.name, 
      text: `[System] escalated this case to CRITICAL`, 
      when: caseNow(), 
      rawTime: new Date().toISOString() 
    };

    setCases((cs) => cs.map((c) => c.id === id ? { ...c, priority: "Urgent", thread: [...c.thread, sysMsg] } : c));

    // Supabase DB Sync
    try {
      await supabase.from("incidents").update({ priority: "critical", severity: "critical" }).eq("id", c0._dbId);
    } catch (e) {
      console.error(e);
    }
    await DB.dbAddCaseComment(c0._dbId, `[System] escalated this case to CRITICAL`);

    fetchCases();
  };

  const postComment = async (id, body) => {
    if (isLocked) return;
    const c0 = cases.find((c) => c.id === id);
    if (!c0 || c0._dbId == null) return;

    // Optimistic Local Update
    const newMsg = {
      id: "temp-" + Date.now(),
      kind: "msg",
      role: "staff",
      author: window.FETS.user.name,
      text: body,
      when: caseNow(),
      rawTime: new Date().toISOString()
    };
    setCases((cs) => cs.map((c) => c.id === id ? { ...c, thread: [...c.thread, newMsg] } : c));

    // Supabase DB Sync
    await DB.dbAddCaseComment(c0._dbId, body);
    fetchCases();
  };

  const setContactDetails = async (id, ct) => {
    if (isLocked) return;
    const c0 = cases.find((c) => c.id === id);
    if (!c0 || c0._dbId == null) return;

    // Save to incidents table as json string
    try {
      await supabase.from("incidents").update({ contact_details: JSON.stringify(ct) }).eq("id", c0._dbId);
    } catch (e) {
      console.error(e);
    }

    setCases((cs) => cs.map((c) => c.id === id ? { ...c, contact: ct } : c));
    fetchCases();
  };

  const addCase = (c) => {
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
    setCat("all"); 
    setStatusF("all"); 
    setView("cases"); 
    setRaiseOpen(false);
  };

  const handleRaiseFromPreset = async (preset, promptVal) => {
    if (isLocked) return;

    let subject = preset.title;
    let detail = `Incident logged via Stream Deck Preset: ${preset.title}.`;

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
          author: window.FETS.user.name,
          role: "staff",
          text: detail,
          when: caseNow()
        }
      ]
    };

    // Optimistically add to state
    setCases(cs => [newCase, ...cs]);
    setSelectedId(caseId);

    // Save to DB
    const row = await DB.dbAddCase(newCase);
    if (row && row.id != null) {
      newCase._dbId = row.id;
      await DB.dbAddCaseComment(row.id, `[System] raised the case from preset: ${preset.title}`);
    }
    
    fetchCases();
    toast(`Raised Case ${caseId}`, "check");
  };

  // Preset Editor handlers
  const openEditPreset = (p) => {
    if (p === 'new') {
      setEditingPreset('new');
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
      setFormCategory(presetCategoryLabel(p.category));
      setFormPriority(p.priority);
      setFormTint(p.tint);
      setFormIcon(p.icon);
      setFormPromptType(p.promptType);
      setFormPromptLabel(p.promptLabel || "");
    }
  };

  const presetCategoryLabel = (cat) => {
    const found = window.FETS.CASE_CATEGORIES.find(c => c.toLowerCase() === cat.toLowerCase());
    return found || "Technical";
  };

  const saveFormPreset = () => {
    if (!formTitle.trim()) {
      toast("Title is required", "alert");
      return;
    }

    if (editingPreset === 'new') {
      const newP = {
        id: "p_" + Date.now(),
        title: formTitle.trim(),
        category: formCategory,
        priority: formPriority,
        tint: formTint,
        icon: formIcon,
        promptType: formPromptType,
        promptLabel: formPromptType !== 'none' ? formPromptLabel.trim() : ""
      };
      savePresets([...presets, newP]);
    } else {
      const updated = presets.map((p) => p.id === editingPreset.id ? {
        ...p,
        title: formTitle.trim(),
        category: formCategory,
        priority: formPriority,
        tint: formTint,
        icon: formIcon,
        promptType: formPromptType,
        promptLabel: formPromptType !== 'none' ? formPromptLabel.trim() : ""
      } : p);
      savePresets(updated);
    }
    setEditingPreset(null);
    toast("Presets list updated", "check");
  };

  const deletePreset = (id) => {
    const filteredPresets = presets.filter(p => p.id !== id);
    savePresets(filteredPresets);
    toast("Preset removed", "check");
  };

  const idx = filtered.findIndex((c) => selected && c.id === selected.id);
  const go = (delta) => { 
    const ni = idx + delta; 
    if (ni >= 0 && ni < filtered.length) {
      setSelectedId(filtered[ni].id); 
    }
  };

  const TINT_Glows = {
    Red: "#ff4d4d",
    Amber: "#ff9f1a",
    Gold: "#ffd32a",
    Green: "#05c46b",
    Blue: "#0fbcf9",
    Purple: "#be2edd"
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: "calc(20px * var(--density))" }}>
      <style>{styleBlock}</style>

      {/* Top bar */}
      <header className="rise" style={{ display: "flex", alignItems: "flex-end", gap: 18, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <button onClick={() => setActive("live")} className="tap" style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "transparent", border: "none", cursor: "pointer",
            fontFamily: "var(--font)", fontSize: 12, fontWeight: 700, color: "var(--ink-3)", padding: 0, marginBottom: 12 }}>
            <Icon name="chevronR" size={14} style={{ transform: "rotate(180deg)" }} /> Back to Live
          </button>
          <h1 style={{ margin: 0, fontFamily: '"Archivo Expanded", var(--font)', fontWeight: 800,
            fontSize: "clamp(32px,4.6vw,54px)", lineHeight: 0.9, letterSpacing: "-0.03em", color: "var(--ink)" }}>
            Incident <span style={{ color: "var(--accent)" }}>Manager</span>
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Segmented value={view} onChange={setView} options={[
            { value: "cases", label: "Cases Console", icon: "layers" },
            { value: "analysis", label: "Incident Metrics", icon: "trend" },
          ]} />
          {!isLocked && (
            <button onClick={() => setRaiseOpen(true)} className="tap" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: 12,
              border: "none", cursor: "pointer", fontFamily: "var(--font)", fontSize: 13.5, fontWeight: 700, color: "var(--accent-ink)", background: "var(--accent)", boxShadow: "var(--shadow)" }}>
              <Icon name="plus" size={16} stroke={2.6} /> Custom Case Form
            </button>
          )}
        </div>
      </header>

      {view === "analysis" ? <CaseAnalysis cases={inBranch} /> : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(350px, 420px) 1fr", gap: 20, alignItems: "stretch" }} className="case-main-layout">
          
          {/* LEFT PANEL — Presets + Queue */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            
            {/* STREAM DECK */}
            <div className="glass" style={{ borderRadius: "var(--radius)", padding: 18, display: "flex", flexDirection: "column", gap: 14, position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", justifyItems: "center" }}>
                <span className="eyebrow" style={{ fontSize: 10, color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name="grid" size={12} style={{ color: "var(--accent)" }} /> Presets Stream Deck
                </span>
                <div style={{ flex: 1 }} />
                {!isLocked && (
                  <button onClick={() => setEditPresets(!editPresets)} className="tap" title="Customize Preset Grid"
                    style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--hairline)", cursor: "pointer", display: "grid", placeItems: "center",
                      background: editPresets ? "var(--accent-soft)" : "transparent", color: editPresets ? "var(--accent)" : "var(--ink-3)" }}>
                    <Icon name="settings" size={13} />
                  </button>
                )}
              </div>

              {/* GRID */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, position: "relative" }}>
                {presets.map((p) => {
                  const glowColor = TINT_Glows[p.tint] || "var(--accent)";
                  return (
                    <div key={p.id} className={`stream-deck-card ${p.tint} ${editPresets ? 'wiggle-animation' : ''}`}
                      style={{ '--glow-color': glowColor }}
                      onClick={() => {
                        if (isLocked) return;
                        if (editPresets) {
                          openEditPreset(p);
                        } else {
                          if (p.promptType !== 'none') {
                            setActivePrompt({ preset: p, value: "" });
                          } else {
                            handleRaiseFromPreset(p, "");
                          }
                        }
                      }}>
                      
                      {/* Top Row: Icon + Category Badge */}
                      <div style={{ display: "flex", alignItems: "center", justifyItems: "center" }}>
                        <div className="card-icon-container" style={{ background: `color-mix(in oklch, ${glowColor} 18%, transparent)`, color: glowColor }}>
                          <Icon name={p.icon || "power"} size={16} />
                        </div>
                        <div style={{ flex: 1 }} />
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 4, background: "var(--glass-strong)", color: "var(--ink-3)", textTransform: "uppercase" }}>
                          {p.category}
                        </span>
                      </div>

                      {/* Title & Label */}
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 750, color: "var(--ink)", lineHeight: 1.25 }}>{p.title}</div>
                        <div style={{ fontSize: 10, color: "var(--ink-4)", fontWeight: 650, marginTop: 4, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 5, height: 5, borderRadius: 99, background: glowColor }} />
                          {p.priority} Priority {p.promptType !== 'none' && `· +Prompt`}
                        </div>
                      </div>

                      {/* Edit mode overlay buttons */}
                      {editPresets && (
                        <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 4 }}>
                          <button onClick={(e) => { e.stopPropagation(); deletePreset(p.id); }} className="tap" title="Delete Preset"
                            style={{ width: 20, height: 20, borderRadius: 5, border: "none", background: "rgba(239, 68, 68, 0.9)", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center" }}>
                            <Icon name="x" size={10} stroke={3} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {editPresets && (
                  <button onClick={() => openEditPreset('new')} className="stream-deck-card tap"
                    style={{ borderStyle: "dashed", borderWidth: 2, display: "grid", placeItems: "center", minHeight: 105, background: "transparent", color: "var(--ink-3)" }}>
                    <div style={{ textAlign: "center" }}>
                      <Icon name="plus" size={20} stroke={2.5} style={{ margin: "0 auto 6px" }} />
                      <div style={{ fontSize: 12, fontWeight: 700 }}>Add Preset</div>
                    </div>
                  </button>
                )}
              </div>

              {/* INLINE MICRO-INPUT OVERLAY */}
              {activePrompt && (
                <div className="glass" style={{
                  position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "var(--glass-strong)",
                  borderRadius: "var(--radius)", padding: 18, zIndex: 10, display: "flex", flexDirection: "column", gap: 12
                }}>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span className="eyebrow" style={{ fontSize: 10, color: "var(--ink-3)" }}>
                      Tap Input Required: {activePrompt.preset.title}
                    </span>
                    <div style={{ flex: 1 }} />
                    <button onClick={() => setActivePrompt(null)} className="tap"
                      style={{ border: "none", background: "none", color: "var(--ink-3)", cursor: "pointer" }}>
                      <Icon name="x" size={16} />
                    </button>
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)", textAlign: "center", marginTop: 4 }}>
                    {activePrompt.preset.promptLabel || "Enter Details"}
                  </div>

                  {activePrompt.preset.promptType === 'numeric' ? (
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                      {/* Readout screen */}
                      <div className="inset" style={{
                        padding: "10px 14px", borderRadius: 10, fontSize: 21, fontWeight: 800, color: "var(--accent)",
                        textAlign: "center", letterSpacing: "0.1em", minHeight: 45
                      }}>
                        {activePrompt.value || "—"}
                      </div>
                      
                      {/* Keypad Grid */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                          <button key={num} className="num-btn" onClick={() => setActivePrompt({ ...activePrompt, value: activePrompt.value + num })}>
                            {num}
                          </button>
                        ))}
                        <button className="num-btn" style={{ color: "var(--bad)" }} onClick={() => setActivePrompt({ ...activePrompt, value: "" })}>
                          C
                        </button>
                        <button className="num-btn" onClick={() => setActivePrompt({ ...activePrompt, value: activePrompt.value + "0" })}>
                          0
                        </button>
                        <button className="num-btn" onClick={() => setActivePrompt({ ...activePrompt, value: activePrompt.value.slice(0, -1) })}>
                          ⌫
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, justifyContent: "center" }}>
                      <input autoFocus value={activePrompt.value} onChange={(e) => setActivePrompt({ ...activePrompt, value: e.target.value })}
                        placeholder={`e.g. ${activePrompt.preset.promptLabel || "Details"}`} style={{ ...caseInput }}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRaiseFromPreset(activePrompt.preset, activePrompt.value); }} />
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { handleRaiseFromPreset(activePrompt.preset, activePrompt.value); setActivePrompt(null); }}
                      className="tap" style={{ flex: 1, padding: "10px", borderRadius: 9, border: "none", cursor: "pointer",
                        fontWeight: 700, fontSize: 13, background: "var(--accent)", color: "var(--accent-ink)" }}>
                      Submit Case
                    </button>
                    <button onClick={() => setActivePrompt(null)} className="tap glass-2"
                      style={{ padding: "10px 16px", borderRadius: 9, border: "1px solid var(--hairline)", cursor: "pointer",
                        fontWeight: 650, fontSize: 13, color: "var(--ink-3)" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* CASE QUEUE */}
            <div className="glass" style={{ borderRadius: "var(--radius)", display: "flex", flexDirection: "column", overflow: "hidden", flex: 1 }}>
              <div style={{ padding: "13px 15px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <span className="eyebrow" style={{ fontSize: 9.5, color: "var(--ink-4)" }}>Incident Queue</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-4)", background: "var(--glass-strong)", padding: "2px 6px", borderRadius: 4 }}>
                  {filtered.length}
                </span>
                <div style={{ flex: 1 }} />
                {/* Micro Search */}
                <div style={{ position: "relative", width: 140 }}>
                  <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search queue..."
                    style={{ width: "100%", padding: "5px 24px 5px 8px", borderRadius: 6, fontSize: 11.5, background: "var(--inset)", border: "1px solid var(--hairline)", color: "var(--ink)" }} />
                  <span style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", color: "var(--ink-4)" }}>
                    <Icon name="search" size={10} />
                  </span>
                </div>
              </div>

              {/* Filtering selects */}
              <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--hairline)", display: "flex", gap: 6, background: "rgba(0,0,0,0.1)" }}>
                <select value={cat} onChange={(e) => setCat(e.target.value)}
                  style={{ flex: 1, padding: "5px", borderRadius: 6, border: "1px solid var(--hairline)", background: "var(--glass-strong)", color: "var(--ink-2)", fontSize: 11.5 }}>
                  <option value="all">All Categories</option>
                  {window.FETS.CASE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={statusF} onChange={(e) => setStatusF(e.target.value)}
                  style={{ flex: 1, padding: "5px", borderRadius: 6, border: "1px solid var(--hairline)", background: "var(--glass-strong)", color: "var(--ink-2)", fontSize: 11.5 }}>
                  <option value="all">Any Status</option>
                  <option value="open">Open</option>
                  <option value="progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>

              <div className="scroll-soft" style={{ overflowY: "auto", padding: 9, display: "flex", flexDirection: "column", gap: 6, maxHeight: "calc(100vh - 510px)", minHeight: 220 }}>
                {filtered.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "var(--ink-4)", fontSize: 12.5 }}>No incidents match filters.</div>}
                {filtered.map((c) => {
                  const on = c.id === selectedId;
                  const st = STATUS_META[c.status] || { label: c.status, color: "var(--ink-4)" };
                  return (
                    <button key={c.id} onClick={() => setSelectedId(c.id)} className="tap" style={{ textAlign: "left", cursor: "pointer", fontFamily: "var(--font)",
                      padding: "12px 13px", borderRadius: 12, display: "flex", flexDirection: "column", gap: 7, position: "relative",
                      border: "1px solid " + (on ? "var(--accent-line)" : "var(--hairline)"), background: on ? "var(--accent-soft)" : "var(--glass-2)",
                      borderLeft: `3px solid ${PRIO_COLOR[c.priority]}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink-4)" }}>{c.id}</span>
                        <div style={{ flex: 1 }} />
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, color: st.color }}>
                          <span style={{ width: 6, height: 6, borderRadius: 999, background: st.color, boxShadow: `0 0 6px ${st.color}` }} /> {st.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 650, color: "var(--ink)", lineHeight: 1.3 }}>{c.subject}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10.5, color: "var(--ink-3)", fontWeight: 600 }}>
                        <span style={{ color: PRIO_COLOR[c.priority], fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>{c.priority}</span>
                        <div style={{ flex: 1 }} />
                        <span className="mono" style={{ color: "var(--ink-4)" }}>{c.age}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT PANEL — SLACK FEED */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {selected ? (
              <CasePlayground c={selected} onStatus={handleStatusChange} onPost={postComment} onContact={setContactDetails}
                onClaim={handleClaimCase} onEscalate={handleEscalateCase} isLocked={isLocked} />
            ) : (
              <div className="glass" style={{ borderRadius: "var(--radius)", padding: 48, textAlign: "center", color: "var(--ink-4)", fontSize: 14, display: "grid", placeItems: "center", minHeight: 420, height: "100%" }}>
                <div style={{ maxWidth: 300, margin: "0 auto" }}>
                  <Icon name="layers" size={42} style={{ color: "var(--accent-line)", marginBottom: 16, opacity: 0.5 }} />
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink-2)", marginBottom: 8 }}>No Active Case Selected</div>
                  Select a case from the queue list, or tap one of the Stream Deck presets to log a new fault in 2 seconds.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CUSTOM FORM DRAWER */}
      <Drawer open={raiseOpen} onClose={() => setRaiseOpen(false)} icon="plus" title="Raise custom case">
        <RaiseCaseForm branch={branch} onSubmit={addCase} />
      </Drawer>

      {/* PRESET EDITOR DRAWER */}
      <Drawer open={!!editingPreset} onClose={() => setEditingPreset(null)} icon="settings" title={editingPreset === 'new' ? "Add Custom Preset Tile" : "Edit Preset Tile"}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <FieldLabel>Preset Title</FieldLabel>
            <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="e.g. Workstation Offline" style={{ ...caseInput }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <FieldLabel>Category</FieldLabel>
              <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)}
                style={{ ...caseInput, appearance: "auto" }}>
                {window.FETS.CASE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Priority</FieldLabel>
              <select value={formPriority} onChange={(e) => setFormPriority(e.target.value)}
                style={{ ...caseInput, appearance: "auto" }}>
                <option value="Urgent">Urgent</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <FieldLabel>Accent Tint Color</FieldLabel>
              <select value={formTint} onChange={(e) => setFormTint(e.target.value)}
                style={{ ...caseInput, appearance: "auto" }}>
                {Object.keys(TINT_Glows).map(color => <option key={color} value={color}>{color}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Button Icon</FieldLabel>
              <select value={formIcon} onChange={(e) => setFormIcon(e.target.value)}
                style={{ ...caseInput, appearance: "auto" }}>
                {["power", "alert", "headset", "shield", "clock", "pulse", "coffee", "camera", "bell", "settings", "mapPin", "users"].map(icon => (
                  <option key={icon} value={icon}>{icon}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <FieldLabel>Require Rapid Prompt Input?</FieldLabel>
            <ChipRow options={["none", "numeric", "text"]} value={formPromptType} onChange={setFormPromptType}
              format={(o) => o === 'none' ? "No Prompt" : o === 'numeric' ? "Numeric Pad" : "Text Input"} />
          </div>

          {formPromptType !== 'none' && (
            <div>
              <FieldLabel>Prompt Display Label</FieldLabel>
              <input value={formPromptLabel} onChange={(e) => setFormPromptLabel(e.target.value)} placeholder="e.g. Enter Workstation #" style={{ ...caseInput }} />
            </div>
          )}

          <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 16, display: "flex", gap: 10 }}>
            <button onClick={saveFormPreset} className="tap"
              style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13.5, background: "var(--accent)", color: "var(--accent-ink)" }}>
              Save Preset
            </button>
            <button onClick={() => setEditingPreset(null)} className="tap glass-2"
              style={{ padding: "12px 18px", borderRadius: 10, border: "1px solid var(--hairline)", cursor: "pointer", fontWeight: 650, fontSize: 13.5, color: "var(--ink-3)" }}>
              Cancel
            </button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}

/* =====================================================================
   SHIFT HANDOVER PAGE — End of Shift Checklist, Headcount & Sign-off
   ===================================================================== */
const DEFAULT_CHECKLIST = [
  { label: "Workstations & servers" },
  { label: "Internet & network" },
  { label: "CCTV & recording" },
  { label: "Power & AC" },
  { label: "All candidates exited" },
  { label: "Secure materials locked" },
  { label: "Dashboards logged out" }
];

function ShiftHandoverPage({ branch, setActive }) {
  const [subView, setSubView] = React.useState("new"); // "new" | "pending" | "history"
  const [date, setDate] = React.useState(() => new Date().toISOString().split("T")[0]);
  const [handoverTime, setHandoverTime] = React.useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });
  
  // Multiple proctors tag arrays
  const [outgoing, setOutgoing] = React.useState(() => [window.FETS?.user?.name || "Staff"]);
  const [incoming, setIncoming] = React.useState([]);
  const [outgoingInput, setOutgoingInput] = React.useState("");
  const [incomingInput, setIncomingInput] = React.useState("");

  // Only currently testing and no-shows needed
  const [testing, setTesting] = React.useState(0);
  const [noShow, setNoShow] = React.useState(0);
  const [candidateNotes, setCandidateNotes] = React.useState("");

  // Checklist and Pending Work
  const [checklist, setChecklist] = React.useState([]);
  const [pending, setPending] = React.useState([]);
  const [instructions, setInstructions] = React.useState("");

  // Digital Signatures
  const [sigOut, setSigOut] = React.useState(null);
  const [sigIn, setSigIn] = React.useState(null);
  const [submitted, setSubmitted] = React.useState(false);

  // Question Management Drawer
  const [isManagingQuestions, setIsManagingQuestions] = React.useState(false);
  const [newQuestion, setNewQuestion] = React.useState("");
  const [editingQId, setEditingQId] = React.useState(null);
  const [editingQLabel, setEditingQLabel] = React.useState("");

  // History Logs
  const [historyLogs, setHistoryLogs] = React.useState([]);
  const [loadingHistory, setLoadingHistory] = React.useState(false);
  const [historyFilter, setHistoryFilter] = React.useState("all"); // "all" | "given" | "taken"
  const [selectedLog, setSelectedLog] = React.useState(null);

  // Pending handovers (outgoing staff's view of their submitted-but-unsigned)
  const [myPendingOut, setMyPendingOut] = React.useState([]);
  const [loadingPending, setLoadingPending] = React.useState(false);

  // Load staff list for autocomplete
  const staffList = React.useMemo(() => {
    const br = branch === "global" ? "calicut" : branch;
    return window.FETS?.STAFF[br] || [];
  }, [branch]);

  // Read draft from localStorage on mount & load checklist questions from Supabase
  React.useEffect(() => {
    let active = true;
    async function loadQuestionsAndDraft() {
      // 1. Fetch latest checklist questions from Supabase
      const qList = await DB.dbFetchHandoverQuestions();
      if (!active) return;

      // 2. Read draft if available
      let draftChecklist = null;
      try {
        const stored = localStorage.getItem(`fets_handover_draft_${branch}`);
        if (stored) {
          const d = JSON.parse(stored);
          if (d.date) setDate(d.date);
          if (d.handoverTime) setHandoverTime(d.handoverTime);
          if (d.outgoing) setOutgoing(d.outgoing);
          if (d.incoming) setIncoming(d.incoming);
          if (d.testing !== undefined) setTesting(d.testing);
          if (d.noShow !== undefined) setNoShow(d.noShow);
          if (d.candidateNotes !== undefined) setCandidateNotes(d.candidateNotes);
          if (d.pending) setPending(d.pending);
          if (d.instructions !== undefined) setInstructions(d.instructions);
          if (d.sigOut !== undefined) setSigOut(d.sigOut);
          if (d.sigIn !== undefined) setSigIn(d.sigIn);
          if (d.checklist) draftChecklist = d.checklist;
        }
      } catch (e) {
        console.error("Error restoring draft:", e);
      }

      // 3. Merge DB questions with draft statuses
      const merged = qList.map(q => {
        const match = draftChecklist?.find(d => d.id === q.id || d.label === q.label);
        return {
          id: q.id,
          label: q.label,
          status: match ? match.status : null,
          note: match ? (match.note || "") : ""
        };
      });
      setChecklist(merged);
    }

    loadQuestionsAndDraft();
    return () => { active = false; };
  }, [branch]);

  // Load history logs from Supabase
  const loadHistoryLogs = async () => {
    setLoadingHistory(true);
    try {
      const logs = await DB.dbFetchHandovers(branch, "completed");
      setHistoryLogs(logs || []);
    } catch (e) {
      console.error("Error loading history logs:", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  React.useEffect(() => {
    if (subView === "history") {
      loadHistoryLogs();
    } else if (subView === "pending") {
      loadMyPendingOut();
    }
  }, [subView, branch]);

  const loadMyPendingOut = async () => {
    setLoadingPending(true);
    try {
      const logs = await DB.dbFetchHandovers(branch, "pending");
      const myName = (window.FETS?.user?.name || "").toLowerCase().trim();
      const mine = (logs || []).filter(h =>
        (h.outgoing_staff || []).some(s => s.toLowerCase().trim() === myName)
      );
      setMyPendingOut(mine);
    } catch (e) {
      console.error("Error loading pending handovers:", e);
    } finally {
      setLoadingPending(false);
    }
  };

  // Save draft state helper
  const updateDraft = (patch) => {
    try {
      const current = {
        date, handoverTime, outgoing, incoming,
        testing, noShow, candidateNotes, checklist,
        pending, instructions, sigOut, sigIn, ...patch
      };
      localStorage.setItem(`fets_handover_draft_${branch}`, JSON.stringify(current));
    } catch (e) {
      console.error("Error saving draft:", e);
    }
  };

  // Multiple staff helpers
  const addStaff = (type, name) => {
    const val = name.trim();
    if (!val) return;
    if (type === "outgoing") {
      if (!outgoing.includes(val)) {
        const next = [...outgoing, val];
        setOutgoing(next);
        updateDraft({ outgoing: next });
      }
      setOutgoingInput("");
    } else {
      if (!incoming.includes(val)) {
        const next = [...incoming, val];
        setIncoming(next);
        updateDraft({ incoming: next });
      }
      setIncomingInput("");
    }
  };

  const removeStaff = (type, name) => {
    if (type === "outgoing") {
      const next = outgoing.filter(n => n !== name);
      setOutgoing(next);
      updateDraft({ outgoing: next });
    } else {
      const next = incoming.filter(n => n !== name);
      setIncoming(next);
      updateDraft({ incoming: next });
    }
  };

  // Candidate status headcount handlers
  const handleStep = (field, delta) => {
    if (field === "testing") {
      const v = Math.max(0, testing + delta);
      setTesting(v);
      updateDraft({ testing: v });
    } else if (field === "noShow") {
      const v = Math.max(0, noShow + delta);
      setNoShow(v);
      updateDraft({ noShow: v });
    }
  };

  // Checklist handlers
  const handleSeg = (id, status) => {
    const next = checklist.map(i => i.id === id ? { ...i, status: i.status === status ? null : status } : i);
    setChecklist(next);
    updateDraft({ checklist: next });
  };

  const handleNote = (id, val) => {
    const next = checklist.map(i => i.id === id ? { ...i, note: val } : i);
    setChecklist(next);
    updateDraft({ checklist: next });
  };

  const handleMarkAllOk = () => {
    const next = checklist.map(i => ({ ...i, status: "ok" }));
    setChecklist(next);
    updateDraft({ checklist: next });
  };

  // Dynamic Questions Drawer Actions
  const handleMutateQuestion = async (action, label, id) => {
    const res = await DB.dbMutateHandoverQuestion(action, label, id);
    // Refresh question list
    const qList = await DB.dbFetchHandoverQuestions();
    setChecklist(prev => {
      return qList.map(q => {
        const match = prev.find(p => p.id === q.id || p.label === q.label);
        return {
          id: q.id,
          label: q.label,
          status: match ? match.status : null,
          note: match ? (match.note || "") : ""
        };
      });
    });
  };

  // Pending Work helpers
  const handleAddPending = () => {
    const next = [...pending, { id: "p" + Date.now(), sev: "low", text: "" }];
    setPending(next);
    updateDraft({ pending: next });
  };

  const handlePendingSev = (id, sev) => {
    const next = pending.map(p => p.id === id ? { ...p, sev } : p);
    setPending(next);
    updateDraft({ pending: next });
  };

  const handlePendingText = (id, text) => {
    const next = pending.map(p => p.id === id ? { ...p, text } : p);
    setPending(next);
    updateDraft({ pending: next });
  };

  const handleRemovePending = (id) => {
    const next = pending.filter(p => p.id !== id);
    setPending(next);
    updateDraft({ pending: next });
  };

  // Sign-off handlers
  const handleSign = (which) => {
    const timeStr = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "");
    if (which === "out") {
      const staffName = outgoing.length > 0 ? outgoing.join(", ") : (window.FETS?.user?.name || "Staff");
      const stamp = { name: staffName, time: timeStr };
      setSigOut(stamp);
      updateDraft({ sigOut: stamp });
      toast(`Outgoing signed by ${staffName}`, "check");
    } else {
      const staffName = incoming.length > 0 ? incoming.join(", ") : "Incoming Staff";
      const stamp = { name: staffName, time: timeStr };
      setSigIn(stamp);
      updateDraft({ sigIn: stamp });
      toast(`Incoming signed by ${staffName}`, "check");
    }
  };

  const handleResetSig = (which) => {
    if (which === "out") {
      setSigOut(null);
      updateDraft({ sigOut: null });
    } else {
      setSigIn(null);
      updateDraft({ sigIn: null });
    }
  };

  const handleResetDraft = () => {
    setChecklist(checklist.map(i => ({ ...i, status: null, note: "" })));
    setPending([]);
    setSigOut(null);
    setSigIn(null);
    setTesting(0);
    setNoShow(0);
    setCandidateNotes("");
    setInstructions("");
    setOutgoing([window.FETS?.user?.name || "Staff"]);
    setIncoming([]);
    localStorage.removeItem(`fets_handover_draft_${branch}`);
    toast("Handover draft reset", "check");
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast("Complete all items and sign-offs first", "alert");
      return;
    }

    // Insert into Supabase with pending status (no Lab post yet — that happens when incoming signs)
    const dbRes = await DB.dbCreateHandover({
      branch: branch === "global" ? "all" : branch,
      date,
      handover_time: handoverTime,
      outgoing_staff: outgoing,
      incoming_staff: incoming,
      currently_testing: testing,
      no_shows: noShow,
      candidate_notes: candidateNotes,
      checklist,
      pending_items: pending,
      instructions,
      sig_out: sigOut
    });

    if (dbRes) {
      setSubmitted(true);
      handleResetDraft();
      toast(`Handover submitted — ${incoming.join(", ")} will be notified`, "check");
      window.dispatchEvent(new Event("fets-handover-pending"));
      window.dispatchEvent(new Event("fets-discussion-changed"));
    } else {
      toast("DB sync failed — saved locally", "alert");
    }
  };

  // Progress calculations
  const answered = checklist.filter((i) => i.status).length;
  const total = checklist.length;
  const criticalCount = checklist.filter((i) => i.status === "critical").length;
  const attentionCount = checklist.filter((i) => i.status === "attention").length;
  
  const signedOut = !!sigOut;
  const signedIn = !!sigIn;

  // Progress: checklist items + outgoing signature only (incoming signs later on My Desk)
  const totalReq = total + 1;
  const doneCount = answered + (signedOut ? 1 : 0);
  const percent = totalReq > 0 ? Math.round((doneCount / totalReq) * 100) : 100;

  // Need checklist 100%, outgoing signed, incoming staff tagged (for notification)
  const canSubmit = percent === 100 && outgoing.length > 0 && incoming.length > 0 && signedOut;

  // Filtered logs for History Log
  const filteredLogs = React.useMemo(() => {
    if (historyFilter === "all") return historyLogs;
    const myNameLower = (window.FETS?.user?.name || "").toLowerCase().trim();
    return historyLogs.filter(log => {
      const list = historyFilter === "given" 
        ? (log.outgoing_staff || []) 
        : (log.incoming_staff || []);
      return list.some(s => s.toLowerCase().trim() === myNameLower);
    });
  }, [historyLogs, historyFilter]);

  const PAL = {
    ok:        { sel: "#00B894", soft: "rgba(0, 184, 148, 0.10)" },
    attention: { sel: "#FDCB6E", soft: "rgba(253, 203, 110, 0.10)" },
    critical:  { sel: "#FF7675", soft: "rgba(255, 118, 117, 0.10)" },
    na:        { sel: "#B2BEC3", soft: "rgba(178, 190, 195, 0.10)" },
    low:       { sel: "#B2BEC3", soft: "rgba(178, 190, 195, 0.10)" },
    med:       { sel: "#FDCB6E", soft: "rgba(253, 203, 110, 0.10)" },
    high:      { sel: "#FF7675", soft: "rgba(255, 118, 117, 0.10)" },
  };

  const styleBlock = `
    @import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Caveat:wght@600;700&display=swap');

    :root, [data-theme="light"] {
      --ho-bg: #E4E8EC;
      --ho-card-bg: #E4E8EC;
      --ho-text: #2D3436;
      --ho-text-muted: #7F8C8D;
      --ho-border: transparent;
      --ho-input-bg: #dce0e4;
      --ho-input-border: transparent;
      --ho-inset: #dce0e4;
      --ho-focus-ring: rgba(108, 92, 231, 0.18);
      --ho-header-bg: #E4E8EC;
      --ho-header-text: #2D3436;
      --ho-header-muted: #6C5CE7;
      --ho-header-border: transparent;
      --ho-header-badge-bg: rgba(108, 92, 231, 0.08);
      --ho-signature-box: #E4E8EC;
      --ho-success-bg: #E4E8EC;
      --ho-success-border: transparent;
      --ho-success-text: #00B894;
      --ho-shadow-light: #ffffff;
      --ho-shadow-dark: rgba(163, 177, 198, 0.6);
      --ho-shadow-dark-strong: rgba(163, 177, 198, 0.8);
      --ho-accent: #6C5CE7;
      --ho-accent-soft: rgba(108, 92, 231, 0.10);
      --ho-accent-glow: rgba(108, 92, 231, 0.25);
    }
    [data-theme="dark"] {
      --ho-bg: #1a1d23;
      --ho-card-bg: #1a1d23;
      --ho-text: #E4E8EC;
      --ho-text-muted: #8899A6;
      --ho-border: transparent;
      --ho-input-bg: #15181d;
      --ho-input-border: transparent;
      --ho-inset: #15181d;
      --ho-focus-ring: rgba(108, 92, 231, 0.25);
      --ho-header-bg: #1a1d23;
      --ho-header-text: #E4E8EC;
      --ho-header-muted: #A29BFE;
      --ho-header-border: transparent;
      --ho-header-badge-bg: rgba(162, 155, 254, 0.08);
      --ho-signature-box: #1a1d23;
      --ho-success-bg: #1a1d23;
      --ho-success-border: transparent;
      --ho-success-text: #55EFC4;
      --ho-shadow-light: rgba(255, 255, 255, 0.05);
      --ho-shadow-dark: rgba(0, 0, 0, 0.5);
      --ho-shadow-dark-strong: rgba(0, 0, 0, 0.7);
      --ho-accent: #A29BFE;
      --ho-accent-soft: rgba(162, 155, 254, 0.10);
      --ho-accent-glow: rgba(162, 155, 254, 0.25);
    }

    .handover-page-wrapper {
      background: var(--ho-bg);
      color: var(--ho-text);
      min-height: 100vh;
      font-family: 'Hanken Grotesk', system-ui, sans-serif;
      -webkit-font-smoothing: antialiased;
      transition: background 0.3s ease, color 0.3s ease;
      width: 100%;
    }
    .handover-container {
      max-width: 1180px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 22px;
    }
    .handover-card {
      background: var(--ho-card-bg);
      border: none;
      border-radius: 20px;
      padding: 28px 30px;
      box-shadow: 8px 8px 16px var(--ho-shadow-dark), -8px -8px 16px var(--ho-shadow-light);
      transition: background 0.3s ease, box-shadow 0.3s ease;
    }
    .handover-label {
      display: block;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--ho-text-muted);
      margin-bottom: 7px;
    }
    .handover-input {
      width: 100%;
      padding: 12px 16px;
      border: none;
      border-radius: 12px;
      font-family: 'Hanken Grotesk', system-ui, sans-serif;
      font-size: 14px;
      font-weight: 500;
      color: var(--ho-text);
      background: var(--ho-input-bg);
      outline: none;
      transition: all 0.2s ease;
      box-shadow: inset 3px 3px 6px var(--ho-shadow-dark), inset -3px -3px 6px var(--ho-shadow-light);
    }
    .handover-input:focus {
      box-shadow: inset 3px 3px 6px var(--ho-shadow-dark), inset -3px -3px 6px var(--ho-shadow-light), 0 0 0 3px var(--ho-accent-glow);
    }
    .handover-btn-group {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .handover-seg-btn {
      padding: 9px 14px;
      border-radius: 10px;
      font-size: 12.5px;
      font-weight: 600;
      font-family: 'Hanken Grotesk', system-ui, sans-serif;
      border: none;
      background: var(--ho-card-bg);
      color: var(--ho-text-muted);
      cursor: pointer;
      transition: all 0.15s ease;
      min-width: 60px;
      text-align: center;
      user-select: none;
      box-shadow: 3px 3px 6px var(--ho-shadow-dark), -3px -3px 6px var(--ho-shadow-light);
    }
    .handover-seg-btn:hover {
      box-shadow: 2px 2px 4px var(--ho-shadow-dark), -2px -2px 4px var(--ho-shadow-light);
    }
    .handover-seg-btn:active {
      box-shadow: inset 2px 2px 4px var(--ho-shadow-dark), inset -2px -2px 4px var(--ho-shadow-light);
    }
    .handover-seg-btn.active-ok {
      background: #00B894;
      color: #fff;
      box-shadow: inset 2px 2px 4px rgba(0,0,0,.15), inset -2px -2px 4px rgba(255,255,255,.1);
    }
    .handover-seg-btn.active-attention {
      background: #FDCB6E;
      color: #2D3436;
      box-shadow: inset 2px 2px 4px rgba(0,0,0,.12), inset -2px -2px 4px rgba(255,255,255,.15);
    }
    .handover-seg-btn.active-critical {
      background: #FF7675;
      color: #fff;
      box-shadow: inset 2px 2px 4px rgba(0,0,0,.15), inset -2px -2px 4px rgba(255,255,255,.1);
    }
    .handover-seg-btn.active-na {
      background: #B2BEC3;
      color: #2D3436;
      box-shadow: inset 2px 2px 4px rgba(0,0,0,.1), inset -2px -2px 4px rgba(255,255,255,.15);
    }
    .checklist-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 14px 18px;
      border-radius: 14px;
      border: none;
      background: var(--ho-card-bg);
      transition: all 0.15s ease;
      flex-wrap: wrap;
      box-shadow: 4px 4px 8px var(--ho-shadow-dark), -4px -4px 8px var(--ho-shadow-light);
    }
    .checklist-row.attention {
      border-left: 3px solid #FDCB6E;
      background: var(--ho-card-bg);
    }
    .checklist-row.critical {
      border-left: 3px solid #FF7675;
      background: var(--ho-card-bg);
    }
    .signature-box {
      border: none;
      border-radius: 18px;
      padding: 22px;
      background: var(--ho-signature-box);
      box-shadow: 6px 6px 12px var(--ho-shadow-dark), -6px -6px 12px var(--ho-shadow-light);
    }
    .signature-cursive {
      font-family: 'Caveat', cursive;
      font-size: 36px;
      color: var(--ho-accent);
      line-height: 1;
    }
    .handover-back-btn {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      background: var(--ho-bg);
      border: none;
      color: var(--ho-accent);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s ease;
      box-shadow: 4px 4px 8px var(--ho-shadow-dark), -4px -4px 8px var(--ho-shadow-light);
    }
    .handover-back-btn:hover {
      box-shadow: 2px 2px 4px var(--ho-shadow-dark), -2px -2px 4px var(--ho-shadow-light);
      transform: translateX(-2px);
    }
    .counter-btn {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      border: none;
      background: var(--ho-card-bg);
      color: var(--ho-text);
      font-size: 18px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
      user-select: none;
      box-shadow: 4px 4px 8px var(--ho-shadow-dark), -4px -4px 8px var(--ho-shadow-light);
    }
    .counter-btn:hover {
      box-shadow: 2px 2px 4px var(--ho-shadow-dark), -2px -2px 4px var(--ho-shadow-light);
    }
    .counter-btn:active {
      box-shadow: inset 2px 2px 4px var(--ho-shadow-dark), inset -2px -2px 4px var(--ho-shadow-light);
      transform: scale(0.97);
    }
    .handover-grid-2 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
    }
  `;

  const branchLabel = branch === "global" ? "All Centres" : branch.charAt(0).toUpperCase() + branch.slice(1);

  return (
    <div className="handover-page-wrapper">
      <style dangerouslySetInnerHTML={{ __html: styleBlock }} />

      {/* STICKY HEADER BAR */}
      <div style={{ background: "var(--ho-header-bg)", padding: "24px clamp(14px,3vw,30px)", position: "sticky", top: 0, zIndex: 20, boxShadow: "0 4px 12px var(--ho-shadow-dark)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setActive("live")} className="handover-back-btn" title="Back to Live">
              <Icon name="arrowR" size={16} style={{ transform: "rotate(180deg)", display: "block" }} />
            </button>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", color: "var(--ho-header-muted)", textTransform: "uppercase" }}>Operations</span>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--ho-header-muted)" }} />
                <span className="mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", color: "var(--ho-header-muted)", textTransform: "uppercase" }}>{branchLabel}</span>
              </div>
              <h1 style={{ margin: "4px 0 0", font: "800 24px 'Hanken Grotesk'", color: "var(--ho-header-text)", letterSpacing: "-.02em" }}>Shift Handover </h1>
            </div>
          </div>
          
          {/* TAB SELECTOR */}
          <div style={{ display: "flex", gap: 8, background: "var(--ho-header-badge-bg)", padding: 4, borderRadius: 10, border: "1px solid var(--ho-header-border)" }}>
            <button 
              onClick={() => { setSubView("new"); setSelectedLog(null); }}
              className="tap"
              style={{
                padding: "8px 16px", borderRadius: 8, border: "none", font: "700 13px 'Hanken Grotesk'", cursor: "pointer",
                background: subView === "new" ? "var(--ho-card-bg)" : "transparent",
                color: subView === "new" ? "var(--ho-text)" : "var(--ho-header-muted)",
                transition: "all .2s ease"
              }}
            >
              New Handover
            </button>
            <button
              onClick={() => { setSubView("pending"); setSelectedLog(null); }}
              className="tap"
              style={{
                padding: "8px 16px", borderRadius: 8, border: "none", font: "700 13px 'Hanken Grotesk'", cursor: "pointer",
                background: subView === "pending" ? "var(--ho-card-bg)" : "transparent",
                color: subView === "pending" ? "var(--ho-text)" : "var(--ho-header-muted)",
                transition: "all .2s ease"
              }}
            >
              Pending
            </button>
            <button
              onClick={() => { setSubView("history"); setSelectedLog(null); }}
              className="tap"
              style={{
                padding: "8px 16px", borderRadius: 8, border: "none", font: "700 13px 'Hanken Grotesk'", cursor: "pointer",
                background: subView === "history" ? "var(--ho-card-bg)" : "transparent",
                color: subView === "history" ? "var(--ho-text)" : "var(--ho-header-muted)",
                transition: "all .2s ease"
              }}
            >
              History Log
            </button>
          </div>
        </div>
        
        {subView === "new" && (
          <div style={{ height: "3px", background: "var(--ho-header-border)", marginTop: 16, marginBottom: -24 }}>
            <div style={{ width: `${percent}%`, height: "100%", background: "var(--ho-accent)", borderRadius: 4, transition: "width .3s ease" }} />
          </div>
        )}
      </div>

      <div className="handover-container" style={{ padding: "24px clamp(14px,3vw,30px) 120px" }}>
        
        {subView === "history" ? (
          /* HISTORY LOGS VIEW */
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {selectedLog ? (
              /* DETAILED LOG CARD */
              <div className="handover-card">
                <button 
                  onClick={() => setSelectedLog(null)} 
                  className="tap" 
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8,
                    border: "1px solid var(--ho-border)", background: "var(--ho-card-bg)", color: "var(--ho-text-muted)",
                    font: "600 12.5px 'Hanken Grotesk'", cursor: "pointer", marginBottom: 20
                  }}
                >
                  ← Back to History List
                </button>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--ho-border)", paddingBottom: 16, marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <h2 style={{ margin: 0, font: "800 22px 'Hanken Grotesk'", color: "var(--ho-text)" }}>
                      Shift Handover Report
                    </h2>
                    <p style={{ margin: "4px 0 0", font: "500 14px 'Hanken Grotesk'", color: "var(--ho-text-muted)" }}>
                      Submitted on {new Date(selectedLog.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div style={{ textContent: "right", textAlign: "right" }}>
                    <span style={{ font: "700 16px 'JetBrains Mono'", color: "var(--ho-accent)" }}>
                      {new Date(selectedLog.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                    <div style={{ font: "600 13px 'JetBrains Mono'", color: "var(--ho-text-muted)", marginTop: 2 }}>
                      Handover Time: {selectedLog.handover_time}
                    </div>
                  </div>
                </div>

                <div className="handover-grid-2" style={{ marginBottom: 20 }}>
                  <div style={{ border: "none", borderRadius: 14, padding: 16, boxShadow: "inset 3px 3px 6px var(--ho-shadow-dark), inset -3px -3px 6px var(--ho-shadow-light)" }}>
                    <div className="handover-label">Outgoing Staff</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                      {(selectedLog.outgoing_staff || []).map((s, idx) => (
                        <span key={idx} style={{ padding: "5px 12px", borderRadius: 10, background: "var(--ho-card-bg)", border: "none", fontSize: 13, fontWeight: 600, boxShadow: "2px 2px 4px var(--ho-shadow-dark), -2px -2px 4px var(--ho-shadow-light)" }}>{s}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ border: "none", borderRadius: 14, padding: 16, boxShadow: "inset 3px 3px 6px var(--ho-shadow-dark), inset -3px -3px 6px var(--ho-shadow-light)" }}>
                    <div className="handover-label">Incoming Staff</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                      {(selectedLog.incoming_staff || []).map((s, idx) => (
                        <span key={idx} style={{ padding: "5px 12px", borderRadius: 10, background: "var(--ho-card-bg)", border: "none", fontSize: 13, fontWeight: 600, boxShadow: "2px 2px 4px var(--ho-shadow-dark), -2px -2px 4px var(--ho-shadow-light)" }}>{s}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
                  <div style={{ border: "1px solid var(--ho-border)", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ font: "800 28px 'JetBrains Mono'", color: "var(--ho-success-text)" }}>{selectedLog.currently_testing}</span>
                    <span className="handover-label" style={{ marginBottom: 0, marginTop: 4 }}>Currently Testing</span>
                  </div>
                  <div style={{ border: "1px solid var(--ho-border)", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ font: "800 28px 'JetBrains Mono'", color: "#FF7675" }}>{selectedLog.no_shows}</span>
                    <span className="handover-label" style={{ marginBottom: 0, marginTop: 4 }}>No Shows</span>
                  </div>
                </div>

                {selectedLog.candidate_notes && (
                  <div style={{ marginBottom: 20, border: "1px solid var(--ho-border)", borderRadius: 12, padding: 16 }}>
                    <div className="handover-label">Headcount Notes</div>
                    <div style={{ fontSize: 14, color: "var(--ho-text)", whiteSpace: "pre-wrap", marginTop: 4 }}>{selectedLog.candidate_notes}</div>
                  </div>
                )}

                <div style={{ marginBottom: 20 }}>
                  <div className="handover-label">Checklist Status</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                    {(selectedLog.checklist || []).map((item, idx) => {
                      const statusIcon = item.status === 'ok' ? '✅' : item.status === 'attention' ? '⚠️' : item.status === 'critical' ? '🚨' : '⚪';
                      return (
                        <div key={idx} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--ho-border)", background: "var(--ho-card-bg)", gap: 12 }}>
                          <div>
                            <span style={{ font: "600 13.5px 'Hanken Grotesk'", color: "var(--ho-text)" }}>{item.label}</span>
                            {item.note && <div style={{ fontSize: 12.5, fontStyle: "italic", color: "var(--ho-text-muted)", marginTop: 2 }}>"${item.note}"</div>}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", color: item.status === 'ok' ? "var(--ho-success-text)" : item.status === 'attention' ? "#C2860F" : item.status === 'critical' ? "#D23F3F" : "var(--ho-text-muted)" }}>
                            {statusIcon} {item.status || "N/A"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {selectedLog.pending_items?.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div className="handover-label">Pending Work</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                      {selectedLog.pending_items.map((p, idx) => (
                        <div key={idx} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", border: "1px solid var(--ho-border)", borderRadius: 10, background: "var(--ho-card-bg)" }}>
                          <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", padding: "3px 6px", borderRadius: 4, background: p.sev === "high" ? "rgba(255,118,117,0.1)" : p.sev === "med" ? "rgba(253,203,110,0.1)" : "rgba(178,190,195,0.1)", color: p.sev === "high" ? "#D23F3F" : p.sev === "med" ? "#C2860F" : "var(--ho-text-muted)" }}>{p.sev}</span>
                          <span style={{ fontSize: 13.5, color: "var(--ho-text)" }}>{p.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedLog.instructions && (
                  <div style={{ marginBottom: 20, border: "1px solid var(--ho-border)", borderRadius: 12, padding: 16 }}>
                    <div className="handover-label">Instructions for next shift</div>
                    <div style={{ fontSize: 14, color: "var(--ho-text)", fontStyle: "italic", whiteSpace: "pre-wrap", marginTop: 4 }}>{selectedLog.instructions}</div>
                  </div>
                )}

                <div className="handover-grid-2">
                  <div style={{ border: "1px solid var(--ho-border)", borderRadius: 12, padding: 16 }}>
                    <div className="handover-label">Outgoing Sign-off</div>
                    {selectedLog.sig_out ? (
                      <div style={{ marginTop: 8 }}>
                        <div className="signature-cursive">{selectedLog.sig_out.name}</div>
                        <div style={{ fontSize: 11, color: "var(--ho-success-text)", fontWeight: 600, marginTop: 6 }}>✓ Digitally Signed</div>
                        <div style={{ fontSize: 11, color: "var(--ho-text-muted)", marginTop: 2 }}>{selectedLog.sig_out.time}</div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: "var(--ho-text-muted)", fontStyle: "italic", marginTop: 8 }}>No signature</div>
                    )}
                  </div>
                  <div style={{ border: "1px solid var(--ho-border)", borderRadius: 12, padding: 16 }}>
                    <div className="handover-label">Incoming Sign-off</div>
                    {selectedLog.sig_in ? (
                      <div style={{ marginTop: 8 }}>
                        <div className="signature-cursive">{selectedLog.sig_in.name}</div>
                        <div style={{ fontSize: 11, color: "var(--ho-success-text)", fontWeight: 600, marginTop: 6 }}>✓ Digitally Signed</div>
                        <div style={{ fontSize: 11, color: "var(--ho-text-muted)", marginTop: 2 }}>{selectedLog.sig_in.time}</div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: "var(--ho-text-muted)", fontStyle: "italic", marginTop: 8 }}>No signature</div>
                    )}
                  </div>
                </div>

                {selectedLog.incoming_comments && (
                  <div style={{ marginTop: 20, border: "1px solid var(--ho-border)", borderRadius: 12, padding: 16 }}>
                    <div className="handover-label">Incoming Staff Comments</div>
                    <div style={{ fontSize: 14, color: "var(--ho-text)", fontStyle: "italic", whiteSpace: "pre-wrap", marginTop: 4 }}>{selectedLog.incoming_comments}</div>
                  </div>
                )}

                {selectedLog.completed_at && (
                  <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8, font: "600 12px 'JetBrains Mono'", color: "var(--ho-success-text)" }}>
                    <span>✓ Completed</span>
                    <span style={{ color: "var(--ho-text-muted)" }}>{new Date(selectedLog.completed_at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                )}
              </div>
            ) : (
              /* LOGS FILTER LIST */
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--ho-border)", paddingBottom: 12, flexWrap: "wrap" }}>
                  <button 
                    onClick={() => setHistoryFilter("all")} 
                    style={{
                      padding: "8px 14px", borderRadius: 8, border: "none", font: "700 13px 'Hanken Grotesk'", cursor: "pointer",
                      background: historyFilter === "all" ? "var(--ho-card-bg)" : "transparent",
                      color: historyFilter === "all" ? "var(--ho-text)" : "var(--ho-text-muted)",
                      borderWidth: 1, borderStyle: historyFilter === "all" ? "solid" : "none", borderColor: "var(--ho-border)"
                    }}
                  >
                    All Handovers
                  </button>
                  <button 
                    onClick={() => setHistoryFilter("given")} 
                    style={{
                      padding: "8px 14px", borderRadius: 8, border: "none", font: "700 13px 'Hanken Grotesk'", cursor: "pointer",
                      background: historyFilter === "given" ? "var(--ho-card-bg)" : "transparent",
                      color: historyFilter === "given" ? "var(--ho-text)" : "var(--ho-text-muted)",
                      borderWidth: 1, borderStyle: historyFilter === "given" ? "solid" : "none", borderColor: "var(--ho-border)"
                    }}
                  >
                    Given by me
                  </button>
                  <button 
                    onClick={() => setHistoryFilter("taken")} 
                    style={{
                      padding: "8px 14px", borderRadius: 8, border: "none", font: "700 13px 'Hanken Grotesk'", cursor: "pointer",
                      background: historyFilter === "taken" ? "var(--ho-card-bg)" : "transparent",
                      color: historyFilter === "taken" ? "var(--ho-text)" : "var(--ho-text-muted)",
                      borderWidth: 1, borderStyle: historyFilter === "taken" ? "solid" : "none", borderColor: "var(--ho-border)"
                    }}
                  >
                    Taken by me
                  </button>
                </div>

                {loadingHistory ? (
                  <div style={{ padding: 40, textAlign: "center", color: "var(--ho-text-muted)", font: "600 14px 'Hanken Grotesk'" }}>
                    Loading history logs...
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div style={{ border: "1.5px dashed var(--ho-border)", borderRadius: 14, padding: 40, textAlign: "center", background: "var(--ho-card-bg)" }}>
                    <div style={{ font: "700 15px 'Hanken Grotesk'", color: "var(--ho-text)", marginBottom: 4 }}>No Handover Logs Found</div>
                    <div style={{ font: "500 13px 'Hanken Grotesk'", color: "var(--ho-text-muted)" }}>
                      No handover reports match the selected filters.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {filteredLogs.map((log) => (
                      <div 
                        key={log.id} 
                        onClick={() => setSelectedLog(log)}
                        className="handover-card tap"
                        style={{
                          cursor: "pointer", padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center",
                          gap: 16, border: "none", borderRadius: 16, background: "var(--ho-card-bg)",
                          boxShadow: "5px 5px 10px var(--ho-shadow-dark), -5px -5px 10px var(--ho-shadow-light)"
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{ font: "800 15px 'Hanken Grotesk'", color: "var(--ho-text)" }}>
                            Shift Handover · {new Date(log.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                          <span style={{ font: "500 13px 'Hanken Grotesk'", color: "var(--ho-text-muted)" }}>
                            Given by: {log.outgoing_staff?.join(", ")} | Taken by: {log.incoming_staff?.join(", ")}
                          </span>
                        </div>
                        <div style={{ textContent: "right", textAlign: "right" }}>
                          <span style={{ font: "700 13px 'JetBrains Mono'", color: "var(--ho-accent)" }}>
                            {log.handover_time}
                          </span>
                          <div style={{ font: "600 11px 'Hanken Grotesk'", color: "var(--ho-text-muted)", marginTop: 2 }}>
                            {log.currently_testing} testing · {log.no_shows} no shows
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : subView === "pending" ? (
          /* PENDING HANDOVERS VIEW (outgoing's submitted-but-unsigned) */
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {loadingPending ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--ho-text-muted)", font: "600 14px 'Hanken Grotesk'" }}>Loading pending handovers...</div>
            ) : myPendingOut.length === 0 ? (
              <div style={{ border: "1.5px dashed var(--ho-border)", borderRadius: 14, padding: 40, textAlign: "center", background: "var(--ho-card-bg)" }}>
                <div style={{ font: "700 15px 'Hanken Grotesk'", color: "var(--ho-text)", marginBottom: 4 }}>No Pending Handovers</div>
                <div style={{ font: "500 13px 'Hanken Grotesk'", color: "var(--ho-text-muted)" }}>All your handovers have been signed off by incoming staff.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {myPendingOut.map((h) => {
                  const isExpired = h.expires_at && new Date(h.expires_at) < new Date();
                  const ago = timeAgo(h.created_at);
                  return (
                    <div key={h.id} className="handover-card" style={{ padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ font: "800 15px 'Hanken Grotesk'", color: "var(--ho-text)" }}>
                            {new Date(h.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} · {h.handover_time}
                          </span>
                          <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em",
                            background: isExpired ? "rgba(255,118,117,0.12)" : "rgba(253,203,110,0.15)",
                            color: isExpired ? "#D23F3F" : "#C2860F",
                            border: `1px solid ${isExpired ? "rgba(255,118,117,0.25)" : "rgba(253,203,110,0.3)"}` }}>
                            {isExpired ? "Expired" : "Awaiting sign-off"}
                          </span>
                        </div>
                        <span style={{ font: "500 13px 'Hanken Grotesk'", color: "var(--ho-text-muted)" }}>
                          Incoming: {(h.incoming_staff || []).join(", ")} · {ago}
                        </span>
                      </div>
                      <div style={{ font: "600 12px 'JetBrains Mono'", color: "var(--ho-text-muted)" }}>
                        {h.currently_testing} testing · {h.no_shows} no-shows
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* NEW HANDOVER REPORT VIEW */
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {submitted && (
              <div className="handover-card" style={{ border: "1px solid var(--ho-success-border)", background: "var(--ho-success-bg)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div style={{ font: "700 15px 'Hanken Grotesk'", color: "var(--ho-success-text)" }}>Handover submitted — awaiting sign-off</div>
                  <div style={{ font: "500 13px 'Hanken Grotesk'", color: "var(--ho-success-text)", marginTop: 2 }}>Incoming staff will be notified on their My Desk to review and sign off.</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setSubView("history"); loadHistoryLogs(); }} className="tap" style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "var(--ho-accent)", color: "#fff", font: "600 12.5px 'Hanken Grotesk'", cursor: "pointer" }}>View History</button>
                  <button onClick={() => setSubmitted(false)} className="tap" style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--ho-success-border)", background: "var(--ho-card-bg)", color: "var(--ho-success-text)", font: "600 12.5px 'Hanken Grotesk'", cursor: "pointer" }}>Dismiss</button>
                </div>
              </div>
            )}

            {/* SECTION 1: OVERVIEW & PROCTORS */}
            <div className="handover-card">
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
                <div style={{ width: 30, height: 30, borderRadius: 10, background: "var(--ho-card-bg)", border: "none", color: "var(--ho-accent)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 13px 'JetBrains Mono'", flex: "none", boxShadow: "inset 2px 2px 4px var(--ho-shadow-dark), inset -2px -2px 4px var(--ho-shadow-light)" }}>1</div>
                <div>
                  <div style={{ font: "700 16px 'Hanken Grotesk'", color: "var(--ho-text)" }}>Shift Overview & Staff</div>
                  <div style={{ font: "500 12.5px 'Hanken Grotesk'", color: "var(--ho-text-muted)" }}>Date, time, and rostered proctors</div>
                </div>
              </div>

              <div className="handover-grid-2" style={{ marginBottom: 16 }}>
                <div>
                  <label className="handover-label">Handover Date</label>
                  <input type="date" value={date} onChange={(e) => { setDate(e.target.value); updateDraft({ date: e.target.value }); }} className="handover-input" />
                </div>
                <div>
                  <label className="handover-label">Handover Time</label>
                  <input type="time" value={handoverTime} onChange={(e) => { setHandoverTime(e.target.value); updateDraft({ handoverTime: e.target.value }); }} className="handover-input" />
                </div>
              </div>

              <div className="handover-grid-2">
                <div>
                  <label className="handover-label">Outgoing Proctors</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    {outgoing.map((name, idx) => (
                      <span key={idx} onClick={() => removeStaff('outgoing', name)} className="tap" style={{
                        display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 8,
                        background: "var(--ho-success-bg)", color: "var(--ho-success-text)", font: "600 12.5px var(--font)", border: "1px solid var(--ho-success-border)", cursor: "pointer"
                      }}>
                        {name} <span style={{ fontSize: 10, color: "var(--ho-success-text)", opacity: 0.7 }}>×</span>
                      </span>
                    ))}
                    {outgoing.length === 0 && <span style={{ fontStyle: "italic", fontSize: 13, color: "var(--ho-text-muted)" }}>None added</span>}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input 
                      value={outgoingInput}
                      onChange={(e) => setOutgoingInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addStaff('outgoing', outgoingInput); } }}
                      placeholder="Add outgoing staff..."
                      list={`outgoing-staff-list-${branch}`}
                      className="handover-input"
                      style={{ flex: 1, padding: "9px 12px", fontSize: 13.5 }}
                    />
                    <button onClick={() => addStaff('outgoing', outgoingInput)} className="tap" style={{
                      padding: "0 14px", borderRadius: 8, border: "1px solid var(--ho-border)", background: "var(--ho-card-bg)", color: "var(--ho-text)", font: "600 13px 'Hanken Grotesk'", cursor: "pointer"
                    }}>
                      Add
                    </button>
                  </div>
                  <datalist id={`outgoing-staff-list-${branch}`}>
                    {staffList.filter(s => !outgoing.includes(s)).map(s => <option key={s} value={s} />)}
                  </datalist>
                </div>

                <div>
                  <label className="handover-label">Incoming Proctors</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    {incoming.map((name, idx) => (
                      <span key={idx} onClick={() => removeStaff('incoming', name)} className="tap" style={{
                        display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 8,
                        background: "var(--ho-success-bg)", color: "var(--ho-success-text)", font: "600 12.5px var(--font)", border: "1px solid var(--ho-success-border)", cursor: "pointer"
                      }}>
                        {name} <span style={{ fontSize: 10, color: "var(--ho-success-text)", opacity: 0.7 }}>×</span>
                      </span>
                    ))}
                    {incoming.length === 0 && <span style={{ fontStyle: "italic", fontSize: 13, color: "var(--ho-text-muted)" }}>None added</span>}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input 
                      value={incomingInput}
                      onChange={(e) => setIncomingInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addStaff('incoming', incomingInput); } }}
                      placeholder="Add incoming staff..."
                      list={`incoming-staff-list-${branch}`}
                      className="handover-input"
                      style={{ flex: 1, padding: "9px 12px", fontSize: 13.5 }}
                    />
                    <button onClick={() => addStaff('incoming', incomingInput)} className="tap" style={{
                      padding: "0 14px", borderRadius: 8, border: "1px solid var(--ho-border)", background: "var(--ho-card-bg)", color: "var(--ho-text)", font: "600 13px 'Hanken Grotesk'", cursor: "pointer"
                    }}>
                      Add
                    </button>
                  </div>
                  <datalist id={`incoming-staff-list-${branch}`}>
                    {staffList.filter(s => !incoming.includes(s)).map(s => <option key={s} value={s} />)}
                  </datalist>
                </div>
              </div>
            </div>

            {/* SECTION 2: CANDIDATE STATUS */}
            <div className="handover-card">
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
                <div style={{ width: 30, height: 30, borderRadius: 10, background: "var(--ho-card-bg)", border: "none", color: "var(--ho-accent)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 13px 'JetBrains Mono'", flex: "none", boxShadow: "inset 2px 2px 4px var(--ho-shadow-dark), inset -2px -2px 4px var(--ho-shadow-light)" }}>2</div>
                <div>
                  <div style={{ font: "700 16px 'Hanken Grotesk'", color: "var(--ho-text)" }}>Candidate status</div>
                  <div style={{ font: "500 12.5px 'Hanken Grotesk'", color: "var(--ho-text-muted)" }}>Headcount and attendance metrics</div>
                </div>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid var(--ho-border)", borderRadius: 12, padding: "14px 16px", background: "var(--ho-card-bg)" }}>
                  <div>
                    <span className="handover-label" style={{ marginBottom: 2 }}>Currently Testing</span>
                    <span style={{ font: "700 24px 'JetBrains Mono'", color: "var(--ho-accent)" }}>{testing}</span>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => handleStep("testing", -1)} className="counter-btn">-</button>
                    <button onClick={() => handleStep("testing", 1)} className="counter-btn">+</button>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid var(--ho-border)", borderRadius: 12, padding: "14px 16px", background: "var(--ho-card-bg)" }}>
                  <div>
                    <span className="handover-label" style={{ marginBottom: 2 }}>No-Shows</span>
                    <span style={{ font: "700 24px 'JetBrains Mono'", color: "#FF7675" }}>{noShow}</span>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => handleStep("noShow", -1)} className="counter-btn">-</button>
                    <button onClick={() => handleStep("noShow", 1)} className="counter-btn">+</button>
                  </div>
                </div>
              </div>

              <div>
                <label className="handover-label">Headcount notes</label>
                <textarea value={candidateNotes} onChange={(e) => { setCandidateNotes(e.target.value); updateDraft({ candidateNotes: e.target.value }); }} placeholder="Candidate issues, late arrivals, rescheduled sessions..." rows={2} className="handover-input" style={{ resize: "vertical", fontSize: 13.5, lineHeight: 1.4 }} />
              </div>
            </div>

            {/* SECTION 3: CHECKLIST */}
            <div className="handover-card">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 10, background: "var(--ho-card-bg)", border: "none", color: "var(--ho-accent)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 13px 'JetBrains Mono'", flex: "none", boxShadow: "inset 2px 2px 4px var(--ho-shadow-dark), inset -2px -2px 4px var(--ho-shadow-light)" }}>3</div>
                  <div>
                    <div style={{ font: "700 16px 'Hanken Grotesk'", color: "var(--ho-text)" }}>Handover checklist</div>
                    <div style={{ font: "500 12.5px 'Hanken Grotesk'", color: "var(--ho-text-muted)" }}>Confirm the state of each system</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                  <span style={{ font: "600 12px 'JetBrains Mono'", color: "var(--ho-text-muted)" }}>{answered}/{total} checked</span>
                  {criticalCount > 0 && <span style={{ padding: "4px 9px", borderRadius: 999, font: "700 11px 'Hanken Grotesk'", background: "rgba(255,118,117,0.12)", color: "#FF7675" }}>{criticalCount} critical</span>}
                  {attentionCount > 0 && <span style={{ padding: "4px 9px", borderRadius: 999, font: "700 11px 'Hanken Grotesk'", background: "rgba(253,203,110,0.12)", color: "#FDCB6E" }}>{attentionCount} attention</span>}
                  <button onClick={handleMarkAllOk} className="tap" style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--ho-border)", background: "var(--ho-card-bg)", color: "var(--ho-accent)", font: "600 12px 'Hanken Grotesk'", cursor: "pointer" }}>✓ Mark all OK</button>
                  <button onClick={() => setIsManagingQuestions(true)} className="tap" style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--ho-accent)", background: "transparent", color: "var(--ho-accent)", font: "600 12px 'Hanken Grotesk'", cursor: "pointer" }}>⚙️ Manage Questions</button>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {checklist.map((item) => {
                  const hasGlow = item.status === 'attention' || item.status === 'critical';
                  return (
                    <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div className={`checklist-row ${item.status || ""}`}>
                        <div style={{ display: "flex", alignItems: "center", gap: 11, flex: 1, minWidth: 140 }}>
                          <span style={{ width: 9, height: 9, borderRadius: "50%", flex: "none", background: item.status ? PAL[item.status].sel : "var(--ho-text-muted)" }} />
                          <span style={{ font: "600 14px 'Hanken Grotesk'", color: "var(--ho-text)" }}>{item.label}</span>
                        </div>
                        <div className="handover-btn-group">
                          <button onClick={() => handleSeg(item.id, "ok")} className={`handover-seg-btn ${item.status === 'ok' ? 'active-ok' : ''}`}>OK</button>
                          <button onClick={() => handleSeg(item.id, "attention")} className={`handover-seg-btn ${item.status === 'attention' ? 'active-attention' : ''}`}>Attention</button>
                          <button onClick={() => handleSeg(item.id, "critical")} className={`handover-seg-btn ${item.status === 'critical' ? 'active-critical' : ''}`}>Critical</button>
                          <button onClick={() => handleSeg(item.id, "na")} className={`handover-seg-btn ${item.status === 'na' ? 'active-na' : ''}`}>N/A</button>
                        </div>
                      </div>
                      {hasGlow && (
                        <div style={{ margin: "4px 0 2px 4px" }}>
                          <input type="text" value={item.note || ""} onChange={(e) => handleNote(item.id, e.target.value)} placeholder="Note — what needs attention and what action was taken?" className="handover-input" style={{ padding: "10px 12px", fontSize: 13 }} />
                        </div>
                      )}
                    </div>
                  );
                })}
                {checklist.length === 0 && (
                  <div style={{ padding: 20, textAlign: "center", color: "var(--ho-text-muted)", fontStyle: "italic", fontSize: 13 }}>No checklist questions defined. Tapping "Manage Questions" above to add some.</div>
                )}
              </div>
            </div>

            {/* SECTION 4: PENDING ITEMS */}
            <div className="handover-card">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 10, background: "var(--ho-card-bg)", border: "none", color: "var(--ho-accent)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 13px 'JetBrains Mono'", flex: "none", boxShadow: "inset 2px 2px 4px var(--ho-shadow-dark), inset -2px -2px 4px var(--ho-shadow-light)" }}>4</div>
                  <div>
                    <div style={{ font: "700 16px 'Hanken Grotesk'", color: "var(--ho-text)" }}>Pending work & incidents</div>
                    <div style={{ font: "500 12.5px 'Hanken Grotesk'", color: "var(--ho-text-muted)" }}>Anything the next shift must pick up</div>
                  </div>
                </div>
                <button onClick={handleAddPending} className="tap" style={{ padding: "9px 16px", borderRadius: 12, border: "none", background: "var(--ho-accent)", color: "#fff", font: "600 12.5px 'Hanken Grotesk'", cursor: "pointer", boxShadow: "3px 3px 6px var(--ho-shadow-dark), -3px -3px 6px var(--ho-shadow-light)" }}>+ Add item</button>
              </div>
              {pending.length === 0 ? (
                <div style={{ border: "1.5px dashed var(--ho-border)", borderRadius: 11, padding: 30, textAlign: "center" }}>
                  <div style={{ font: "600 13.5px 'Hanken Grotesk'", color: "var(--ho-text-muted)", marginBottom: 4 }}>No pending work or open incidents</div>
                  <div style={{ font: "500 12.5px 'Hanken Grotesk'", color: "var(--ho-text-muted)" }}>A clean slate for the next shift — nice work.</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {pending.map((p) => {
                    const activeLow = p.sev === "low";
                    const activeMed = p.sev === "med";
                    const activeHigh = p.sev === "high";
                    return (
                      <div key={p.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 14px", border: "1px solid var(--ho-border)", borderRadius: 11, background: "var(--ho-card-bg)", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                          <button onClick={() => handlePendingSev(p.id, "low")} className={`handover-seg-btn ${activeLow ? 'active-na' : ''}`} style={{ padding: "6px 10px", minWidth: 46 }}>Low</button>
                          <button onClick={() => handlePendingSev(p.id, "med")} className={`handover-seg-btn ${activeMed ? 'active-attention' : ''}`} style={{ padding: "6px 10px", minWidth: 46 }}>Med</button>
                          <button onClick={() => handlePendingSev(p.id, "high")} className={`handover-seg-btn ${activeHigh ? 'active-critical' : ''}`} style={{ padding: "6px 10px", minWidth: 46 }}>High</button>
                        </div>
                        <input type="text" value={p.text} onChange={(e) => handlePendingText(p.id, e.target.value)} placeholder="Describe the pending work or incident…" className="handover-input" style={{ flex: 1, minWidth: 200, padding: "10px 12px", fontSize: 13.5 }} />
                        <button onClick={() => handleRemovePending(p.id)} className="tap" style={{ width: 34, height: 34, border: "1px solid var(--ho-input-border)", borderRadius: 8, background: "var(--ho-card-bg)", color: "var(--ho-text-muted)", font: "600 17px 'Hanken Grotesk'", cursor: "pointer", display: "grid", placeItems: "center" }}>×</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SECTION 5: INSTRUCTIONS & SIGNATURES */}
            <div className="handover-card">
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
                <div style={{ width: 30, height: 30, borderRadius: 10, background: "var(--ho-card-bg)", border: "none", color: "var(--ho-accent)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 13px 'JetBrains Mono'", flex: "none", boxShadow: "inset 2px 2px 4px var(--ho-shadow-dark), inset -2px -2px 4px var(--ho-shadow-light)" }}>5</div>
                <div>
                  <div style={{ font: "700 16px 'Hanken Grotesk'", color: "var(--ho-text)" }}>Instructions & sign-off</div>
                  <div style={{ font: "500 12.5px 'Hanken Grotesk'", color: "var(--ho-text-muted)" }}>Final notes and signatures</div>
                </div>
              </div>
              <div style={{ marginBottom: 18 }}>
                <label className="handover-label">Instructions for next shift</label>
                <textarea value={instructions} onChange={(e) => { setInstructions(e.target.value); updateDraft({ instructions: e.target.value }); }} rows={3} placeholder="Key priorities, open items, who to call…" className="handover-input" style={{ resize: "vertical", lineHeight: 1.5 }}></textarea>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16 }}>
                <div className="signature-box">
                  <div className="handover-label">Outgoing staff</div>
                  <div style={{ font: "700 15px 'Hanken Grotesk'", color: "var(--ho-text)", marginTop: 3 }}>{outgoing.join(", ") || "—"}</div>
                  <div style={{ height: 1, background: "var(--ho-border)", margin: "14px 0" }}></div>
                  {signedOut ? (
                    <div style={{ border: "1px solid var(--ho-success-border)", background: "var(--ho-success-bg)", borderRadius: 10, padding: "14px 16px" }}>
                      <div className="signature-cursive">{sigOut.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 12, font: "600 11px 'JetBrains Mono'", color: "var(--ho-success-text)" }}>
                        <span>✓ Verified digital signature</span>
                      </div>
                      <div style={{ font: "500 11px 'JetBrains Mono'", color: "var(--ho-text-muted)", marginTop: 3 }}>{sigOut.time}</div>
                      <button onClick={() => handleResetSig("out")} className="tap" style={{ marginTop: 10, padding: 0, border: "none", background: "none", color: "#FF7675", font: "600 12px 'Hanken Grotesk'", cursor: "pointer" }}>Reset signature</button>
                    </div>
                  ) : (
                    <button onClick={() => handleSign("out")} className="tap" style={{ width: "100%", border: "none", borderRadius: 14, padding: 24, background: "var(--ho-card-bg)", cursor: "pointer", color: "var(--ho-accent)", font: "600 13.5px 'Hanken Grotesk'", display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", gap: 8, boxShadow: "4px 4px 8px var(--ho-shadow-dark), -4px -4px 8px var(--ho-shadow-light)" }}>✎ Tap to sign as Outgoing</button>
                  )}
                </div>

                <div className="signature-box">
                  <div className="handover-label">Incoming staff</div>
                  <div style={{ font: "700 15px 'Hanken Grotesk'", color: "var(--ho-text)", marginTop: 3 }}>{incoming.join(", ") || "—"}</div>
                  <div style={{ height: 1, background: "var(--ho-border)", margin: "14px 0" }}></div>
                  <div style={{ border: "1px dashed var(--ho-border)", borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
                    <div style={{ font: "600 13px 'Hanken Grotesk'", color: "var(--ho-text-muted)" }}>
                      {incoming.length > 0 ? `${incoming.join(", ")} will be notified on their My Desk to review & sign.` : "Tag incoming staff above to notify them."}
                    </div>
                    <div style={{ font: "500 11px 'JetBrains Mono'", color: "var(--ho-text-muted)", marginTop: 6, opacity: 0.7 }}>
                      Incoming sign-off happens on My Desk
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* SUBMIT BUTTON BAR */}
            <div className="handover-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14, borderTop: "1px solid var(--ho-border)", padding: "18px 24px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ho-text)" }}>
                  Completeness Progress: {percent}%
                </span>
                <span style={{ fontSize: 12, color: "var(--ho-text-muted)" }}>
                  {outgoing.length === 0 ? "⚠️ Add outgoing staff. " : ""}
                  {incoming.length === 0 ? "⚠️ Tag incoming staff. " : ""}
                  {!signedOut ? "Sign as outgoing. " : ""}
                  {percent < 100 ? "Complete all checklist items." : "Ready to submit."}
                </span>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={handleResetDraft} className="tap glass-2" style={{ padding: "11px 18px", borderRadius: 10, border: "1px solid var(--ho-border)", cursor: "pointer", fontWeight: 650, fontSize: 13.5, color: "var(--ho-text-muted)" }}>
                  Reset Draft
                </button>
                <button onClick={handleSubmit} disabled={!canSubmit} className="tap" style={{
                  padding: "12px 28px", borderRadius: 14, border: "none", font: "700 13.5px 'Hanken Grotesk'", cursor: canSubmit ? "pointer" : "not-allowed",
                  background: canSubmit ? "var(--ho-accent)" : "var(--ho-card-bg)", color: canSubmit ? "#fff" : "var(--ho-text-muted)",
                  boxShadow: canSubmit ? "4px 4px 8px var(--ho-shadow-dark), -4px -4px 8px var(--ho-shadow-light)" : "inset 2px 2px 4px var(--ho-shadow-dark), inset -2px -2px 4px var(--ho-shadow-light)"
                }}>
                  Submit Handover
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DYNAMIC QUESTIONS MANAGER DRAWER */}
      <Drawer open={isManagingQuestions} onClose={() => setIsManagingQuestions(false)} icon="settings" title="Manage Checklist Questions" sub="Add, edit, or delete handover checklist items">
        <div style={{ display: "flex", flexDirection: "column", gap: 18, height: "100%", padding: 6 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input 
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Add a new checklist question..."
              className="handover-input"
              style={{ flex: 1, padding: "10px 12px", fontSize: 13.5 }}
            />
            <button 
              onClick={async () => {
                if (!newQuestion.trim()) return;
                await handleMutateQuestion("add", newQuestion);
                setNewQuestion("");
              }}
              className="tap"
              style={{
                padding: "10px 16px", borderRadius: 10, border: "none", cursor: "pointer",
                background: "var(--accent)", color: "var(--accent-ink)", fontWeight: 700, fontSize: 13
              }}
            >
              Add
            </button>
          </div>
          
          <div className="scroll-soft" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            <div className="handover-label" style={{ marginBottom: 4 }}>Checklist Items</div>
            {checklist.map((item) => (
              <div key={item.id} className="glass-2" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--ho-border)", gap: 12 }}>
                {editingQId === item.id ? (
                  <div style={{ display: "flex", gap: 8, flex: 1 }}>
                    <input 
                      value={editingQLabel}
                      onChange={(e) => setEditingQLabel(e.target.value)}
                      className="handover-input"
                      style={{ flex: 1, padding: "6px 10px", fontSize: 13 }}
                    />
                    <button 
                      onClick={async () => {
                        if (!editingQLabel.trim()) return;
                        await handleMutateQuestion("edit", editingQLabel, item.id);
                        setEditingQId(null);
                      }}
                      className="tap"
                      style={{ border: "none", background: "none", color: "var(--ho-success-text)", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
                    >
                      Save
                    </button>
                    <button 
                      onClick={() => setEditingQId(null)}
                      className="tap"
                      style={{ border: "none", background: "none", color: "#FF7675", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <React.Fragment>
                    <span style={{ fontSize: 13.5, color: "var(--ho-text)", fontWeight: 600 }}>{item.label}</span>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <button 
                        onClick={() => {
                          setEditingQId(item.id);
                          setEditingQLabel(item.label);
                        }}
                        title="Edit"
                        className="tap"
                        style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={() => {
                          if (window.confirm(`Delete "${item.label}"?`)) {
                            handleMutateQuestion("delete", item.label, item.id);
                          }
                        }}
                        title="Delete"
                        className="tap"
                        style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}
                      >
                        🗑️
                      </button>
                    </div>
                  </React.Fragment>
                )}
              </div>
            ))}
          </div>
        </div>
      </Drawer>
    </div>
  );
}

Object.assign(window, { RaiseCasePage, FieldLabel, ChipRow, PRIO_COLOR, STATUS_META, ShiftHandoverPage });

/* ============================================================
   SOURCE: desk-modules.jsx
   ============================================================ */
/* ============================================================
   FETS · LIVE — My Desk cockpit modules  (B&W radio-device theme)
   Tasks · Exam-Day Checklist · Certifications · Attendance · Vault
   The four modules share one monochrome "radio" console face that
   matches the My Desk menu buttons. Gold is the single accent.
   ============================================================ */

const R = {
  ink:  "oklch(0.95 0 0)",
  ink2: "oklch(0.74 0 0)",
  ink3: "oklch(0.60 0 0)",
  ink4: "oklch(0.48 0 0)",
  line: "oklch(1 0 0 / 0.09)",
  gold: "var(--accent)",
};
const PRIO = {
  Critical: { tone: R.gold,            label: "Critical" },
  High:     { tone: "oklch(0.88 0 0)", label: "High" },
  Medium:   { tone: R.ink3,            label: "Medium" },
  Low:      { tone: R.ink4,            label: "Low" },
};
const durHM = (mins) => `${Math.floor(mins / 60)}h ${String(Math.round(mins % 60)).padStart(2, "0")}m`;

/* monochrome status pill */
function Pill({ tone, children, faint }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
      textTransform: "uppercase", padding: "3px 9px", borderRadius: 999, color: tone,
      background: faint ? "oklch(1 0 0 / .06)" : `color-mix(in oklch, ${tone} 16%, oklch(0.12 0 0))`,
      border: `1px solid ${faint ? "oklch(1 0 0 / .1)" : `color-mix(in oklch, ${tone} 35%, transparent)`}` }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: tone }} />{children}
    </span>
  );
}

/* device checkbox — gold when on */
function Check({ on, size = 22, onClick, title }) {
  return (
    <button onClick={onClick} title={title} className="tap" style={{ width: size, height: size, flexShrink: 0, borderRadius: 7, cursor: "pointer",
      display: "grid", placeItems: "center", border: `1.5px solid ${on ? "transparent" : "oklch(1 0 0 / .22)"}`,
      background: on ? R.gold : "oklch(0.13 0 0)", color: on ? "#1c1305" : "transparent",
      boxShadow: on ? "0 0 12px color-mix(in oklch, var(--accent) 50%, transparent)" : "inset 0 1px 3px oklch(0 0 0 / .5)",
      transition: "background .15s, border-color .15s" }}>
      <Icon name="check" size={size * 0.62} stroke={3} />
    </button>
  );
}

/* device header rail (eyebrow left, status right) */
function DevRail({ label, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
      <span className="eyebrow" style={{ fontSize: 9, color: R.ink3, letterSpacing: "0.22em" }}>{label}</span>
      {right}
    </div>
  );
}

function LED({ tone = R.gold, on = true }) {
  return <span style={{ width: 8, height: 8, borderRadius: 999, background: on ? tone : R.ink4, boxShadow: on ? `0 0 9px ${tone}` : "none", flexShrink: 0 }} />;
}

/* device sub-tabs (gold active) */
function RadioTabs({ tabs, value, onChange }) {
  return (
    <div className="radio-inset" style={{ display: "inline-flex", padding: 4, gap: 4, borderRadius: 13 }}>
      {tabs.map((t) => {
        const on = value === t.k;
        return (
          <button key={t.k} onClick={() => onChange(t.k)} className="tap" style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "none", cursor: "pointer",
            padding: "9px 17px", borderRadius: 10, fontFamily: "var(--font)", fontSize: 13, fontWeight: on ? 700 : 600,
            color: on ? "#1c1305" : R.ink3, background: on ? R.gold : "transparent",
            boxShadow: on ? "0 0 14px color-mix(in oklch, var(--accent) 45%, transparent)" : "none" }}>
            {t.icon && <Icon name={t.icon} size={15} />}{t.label}
          </button>
        );
      })}
    </div>
  );
}

/* =====================================================================
   MY TASKS — sticky wall on the radio face
   ===================================================================== */
function TaskCard({ t, onCycle, onProof, onDelete }) {
  const done = t.status === "Completed";
  const prio = PRIO[t.priority] || PRIO.Medium;
  const tone = done ? R.ink4 : prio.tone;
  return (
    <div className="radio-tile" style={{ padding: "14px 15px 11px", display: "flex", flexDirection: "column", gap: 10, opacity: done ? 0.62 : 1, breakInside: "avoid" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <Check on={done} onClick={() => onCycle(t.id)} title={done ? "Mark not done" : "Mark done"} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 650, color: R.ink, lineHeight: 1.3, letterSpacing: "-0.01em", textDecoration: done ? "line-through" : "none" }}>{t.title}</div>
          {t.comment && !done && <div style={{ fontSize: 12, color: R.ink3, marginTop: 5, lineHeight: 1.45 }}>{t.comment}</div>}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 9, borderTop: `1px solid ${R.line}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: tone }}>
            <LED tone={tone} />{done ? "Done" : prio.label}
          </span>
          <span style={{ width: 1, height: 11, background: R.line }} />
          <span className="mono" style={{ fontSize: 10, color: R.ink4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.due}{t.source !== "Self" ? ` · ${t.by}` : ""}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <button onClick={() => onProof(t)} title={t.proof ? "Proof attached" : "Attach proof"} className="tap" style={{ width: 26, height: 26, borderRadius: 7, cursor: "pointer", border: `1px solid ${t.proof ? "transparent" : "oklch(1 0 0 / .12)"}`, background: t.proof ? "color-mix(in oklch, var(--accent) 22%, oklch(0.13 0 0))" : "transparent", display: "grid", placeItems: "center", color: t.proof ? R.gold : R.ink4 }}>
            <Icon name="download" size={12} style={{ transform: "rotate(180deg)" }} />
          </button>
          <button onClick={() => onDelete(t.id)} title="Delete" className="tap" style={{ width: 26, height: 26, borderRadius: 7, cursor: "pointer", border: "1px solid oklch(1 0 0 / .12)", background: "transparent", display: "grid", placeItems: "center", color: R.ink4 }}>
            <Icon name="trash" size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

function TasksModule() {
  const [tasks, setTasks] = React.useState(window.FETS.DESK_TASKS.map((t) => ({ ...t })));
  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [prio, setPrio] = React.useState("Medium");
  const [sourceF, setSourceF] = React.useState("all");

  const cycle = (id) => setTasks((ts) => ts.map((t) => { if (t.id !== id) return t; const ns = t.status === "Completed" ? "Pending" : "Completed"; DB.dbToggleTask(id, ns === "Completed"); return { ...t, status: ns }; }));
  const del = (id) => { DB.dbDeleteTask(id); setTasks((ts) => ts.filter((t) => t.id !== id)); };
  const add = () => {
    if (!draft.trim()) { setAdding(false); return; }
    const _title = draft.trim();
    DB.dbAddTask(_title, prio).then((row) => { if (row && row.id != null) setTasks((ts) => ts.map((t) => t.title === _title && t.id.indexOf("t") === 0 ? { ...t, id: String(row.id) } : t)); });
    setTasks((ts) => [{ id: "t" + Date.now(), title: _title, source: "Self", by: "You", due: "Today", priority: prio, status: "Pending", comment: "", proof: false }, ...ts]);
    setDraft(""); setPrio("Medium"); setAdding(false); toast("Task added", "check");
  };
  const sourceOf = (t) => t.source === "Self" ? "self" : "assigned";
  const filtered = tasks.filter((t) => sourceF === "all" || sourceOf(t) === sourceF)
    .sort((a, b) => (a.status === "Completed" ? 1 : 0) - (b.status === "Completed" ? 1 : 0));
  const handlers = { onCycle: cycle, onProof: (x) => toast(`Attach proof · ${x.title}`, "download"), onDelete: del };
  const inputSt = { padding: "9px 11px", borderRadius: 9, fontFamily: "var(--font)", fontSize: 13, color: R.ink, background: "oklch(0.13 0 0)", border: "1px solid oklch(1 0 0 / .12)", outline: "none" };

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionLabel right={<span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>{tasks.filter((t) => t.status !== "Completed").length} open · {tasks.length} total</span>}>Sticky wall</SectionLabel>

      <div className="radio-chassis" style={{ padding: "calc(20px * var(--density))" }}>
        <DevRail label="Tasks · Wall" right={<span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: R.gold }}><LED />{tasks.filter((t) => t.status !== "Completed").length} open</span>} />

        {/* source filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <span className="eyebrow" style={{ fontSize: 9, color: R.ink4, marginRight: 2 }}>Source</span>
          {[{ k: "all", code: "ALL", label: "All tasks" }, { k: "assigned", code: "ME", label: "Assigned to me" }, { k: "self", code: "YOU", label: "Self-assigned" }].map((s) => {
            const on = sourceF === s.k;
            return (
              <button key={s.k} onClick={() => setSourceF(s.k)} className="tap radio-tile" style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 12px 6px 6px", cursor: "pointer", textAlign: "left", fontFamily: "var(--font)",
                borderColor: on ? "color-mix(in oklch, var(--accent) 55%, transparent)" : undefined, boxShadow: on ? "0 0 14px color-mix(in oklch, var(--accent) 28%, transparent)" : undefined, borderRadius: 11 }}>
                <span style={{ minWidth: 36, height: 24, padding: "0 7px", borderRadius: 7, display: "grid", placeItems: "center", flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700,
                  color: on ? "#1c1305" : R.ink2, background: on ? R.gold : "oklch(0.16 0 0)", border: on ? "none" : "1px solid oklch(1 0 0 / .1)" }}>{s.code}</span>
                <span style={{ fontSize: 12.5, fontWeight: on ? 700 : 600, color: on ? R.ink : R.ink2 }}>{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* note wall */}
        <div style={{ columnWidth: 250, columnGap: 13 }}>
          {filtered.map((t) => <div key={t.id} style={{ breakInside: "avoid", marginBottom: 13 }}><TaskCard t={t} {...handlers} /></div>)}
          {adding ? (
            <div className="radio-tile" style={{ breakInside: "avoid", marginBottom: 13, padding: 13, display: "flex", flexDirection: "column", gap: 10 }}>
              <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="What needs doing?" style={{ ...inputSt, fontWeight: 600, fontSize: 14 }} />
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select value={prio} onChange={(e) => setPrio(e.target.value)} style={{ ...inputSt, flex: 1, fontWeight: 600, cursor: "pointer" }}>
                  {window.FETS.TASK_PRIORITIES.map((p) => <option key={p} value={p} style={{ color: "#000" }}>{p} priority</option>)}
                </select>
                <button onClick={add} className="tap" style={{ padding: "9px 18px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "var(--font)", fontSize: 12.5, fontWeight: 700, color: "#1c1305", background: R.gold }}>Add</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="tap" style={{ breakInside: "avoid", marginBottom: 13, width: "100%", padding: "18px 0", borderRadius: 16, cursor: "pointer",
              border: "1.5px dashed oklch(1 0 0 / .16)", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, color: R.ink3, fontFamily: "var(--font)", fontSize: 13, fontWeight: 600 }}>
              <Icon name="plus" size={18} /> Add a task
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/* =====================================================================
   EXAM-DAY CHECKLIST — radio face, grouped checkboxes
   ===================================================================== */
const CHK_GROUPS = [
  { key: "before", label: "Before exam", icon: "sun2" },
  { key: "during", label: "During exam", icon: "pulse" },
  { key: "after", label: "After exam", icon: "moon" },
];
function Bar({ pct, h = 6 }) {
  return (
    <div style={{ height: h, borderRadius: 99, background: "oklch(0.13 0 0)", overflow: "hidden", boxShadow: "inset 0 1px 3px oklch(0 0 0 / .5)" }}>
      <div style={{ width: `${Math.max(2, pct)}%`, height: "100%", borderRadius: 99, background: R.gold, boxShadow: "0 0 10px color-mix(in oklch, var(--accent) 55%, transparent)", transition: "width .3s" }} />
    </div>
  );
}
function ChecklistModule() {
  const init = {};
  CHK_GROUPS.forEach((g) => { init[g.key] = window.FETS.CHECKLIST[g.key].map((t, i) => ({ id: g.key + i, t, done: false })); });
  const [groups, setGroups] = React.useState(init);
  const [addG, setAddG] = React.useState("before");
  const [draft, setDraft] = React.useState("");

  const all = Object.values(groups).flat();
  const doneN = all.filter((x) => x.done).length;
  const score = all.length ? Math.round((doneN / all.length) * 100) : 0;
  const toggle = (g, id) => setGroups((s) => ({ ...s, [g]: s[g].map((x) => x.id === id ? { ...x, done: !x.done } : x) }));
  const del = (g, id) => setGroups((s) => ({ ...s, [g]: s[g].filter((x) => x.id !== id) }));
  const addItem = () => { const v = draft.trim(); if (!v) return; setGroups((s) => ({ ...s, [addG]: [...s[addG], { id: addG + Date.now(), t: v, done: false }] })); setDraft(""); };
  const inputSt = { padding: "9px 12px", borderRadius: 9, fontFamily: "var(--font)", fontSize: 13, color: R.ink, background: "oklch(0.13 0 0)", border: "1px solid oklch(1 0 0 / .12)", outline: "none" };

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionLabel right={<span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>{score}% ready</span>}>Exam-day checklist</SectionLabel>

      <div className="radio-chassis" style={{ padding: "calc(22px * var(--density))" }}>
        <DevRail label="Exam-day · Checklist" right={<span style={{ display: "inline-flex", alignItems: "center", gap: 9, fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: score === 100 ? R.gold : R.ink2 }}>{doneN}/{all.length} steps <LED on={score > 0} /></span>} />

        {/* overall */}
        <div className="radio-inset" style={{ padding: "15px 17px", display: "flex", flexDirection: "column", gap: 11, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13.5, fontWeight: 650, color: R.ink }}>Overall readiness</span>
            <span className="tabnum mono" style={{ fontSize: 13, fontWeight: 700, color: R.gold, whiteSpace: "nowrap" }}>{score}%</span>
          </div>
          <Bar pct={score} h={8} />
        </div>

        {/* groups */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 13, alignItems: "start" }}>
          {CHK_GROUPS.map((g) => {
            const items = groups[g.key]; const gd = items.filter((x) => x.done).length;
            const pct = items.length ? Math.round((gd / items.length) * 100) : 0;
            return (
              <div key={g.key} className="radio-screen" style={{ padding: 15, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <span style={{ width: 32, height: 32, borderRadius: 9, display: "grid", placeItems: "center", flexShrink: 0, color: R.ink2, background: "oklch(0.2 0 0)", border: "1px solid oklch(1 0 0 / .08)" }}><Icon name={g.icon} size={16} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: R.ink }}>{g.label}</div>
                    <div className="mono" style={{ fontSize: 10, color: R.ink4, marginTop: 2 }}>{gd}/{items.length} · {pct}%</div>
                  </div>
                </div>
                <Bar pct={pct} />
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {items.map((it) => (
                    <div key={it.id} className="radio-row" style={{ display: "flex", alignItems: "center", gap: 11, padding: "8px 6px", borderRadius: 8 }}>
                      <Check on={it.done} size={20} onClick={() => toggle(g.key, it.id)} title={it.t} />
                      <span onClick={() => toggle(g.key, it.id)} style={{ flex: 1, fontSize: 12.5, cursor: "pointer", color: it.done ? R.ink4 : R.ink2, textDecoration: it.done ? "line-through" : "none", lineHeight: 1.35 }}>{it.t}</span>
                      <button onClick={() => del(g.key, it.id)} title="Remove" className="tap radio-del" style={{ width: 24, height: 24, borderRadius: 6, cursor: "pointer", border: "none", background: "transparent", display: "grid", placeItems: "center", color: R.ink4, flexShrink: 0 }}><Icon name="x" size={13} /></button>
                    </div>
                  ))}
                  {items.length === 0 && <div style={{ fontSize: 12, color: R.ink4, padding: "6px" }}>No steps.</div>}
                </div>
              </div>
            );
          })}
        </div>

        {/* add */}
        <div className="radio-inset" style={{ padding: 13, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 16 }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {CHK_GROUPS.map((g) => {
              const on = addG === g.key;
              return <button key={g.key} onClick={() => setAddG(g.key)} className="tap" style={{ padding: "8px 13px", borderRadius: 9, cursor: "pointer", fontFamily: "var(--font)", fontSize: 12.5, fontWeight: on ? 700 : 600,
                border: "1px solid " + (on ? "color-mix(in oklch, var(--accent) 50%, transparent)" : "oklch(1 0 0 / .1)"), background: on ? "color-mix(in oklch, var(--accent) 16%, oklch(0.13 0 0))" : "oklch(0.17 0 0)", color: on ? R.gold : R.ink3 }}>{g.label.replace(" exam", "")}</button>;
            })}
          </div>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addItem()} placeholder="Add a step…" style={{ ...inputSt, flex: "1 1 160px" }} />
          <button onClick={addItem} className="tap" style={{ padding: "9px 16px", borderRadius: 9, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "var(--font)", fontSize: 13, fontWeight: 700, color: "#1c1305", background: R.gold, border: "none" }}><Icon name="plus" size={15} /> Add</button>
        </div>
      </div>
    </section>
  );
}

/* =====================================================================
   MY CERTIFICATIONS — radio face credential tiles
   ===================================================================== */
const CERT_META = {
  taken:    { label: "Valid",     action: "View",   icon: "eye",     tone: R.gold },
  not:      { label: "Not taken", action: "Start",  icon: "arrowR",  tone: R.ink4 },
  pending:  { label: "Pending",   action: "Remind", icon: "bell",    tone: R.ink2 },
  expiring: { label: "Expiring",  action: "Renew",  icon: "refresh", tone: R.gold },
};
function CertCard({ c }) {
  const m = CERT_META[c.status];
  const reqMiss = c.required && c.status === "not";
  const tone = reqMiss ? R.gold : m.tone;
  return (
    <div className="radio-tile" style={{ padding: 15, display: "flex", flexDirection: "column", gap: 13 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: R.ink, letterSpacing: "-0.01em" }}>{c.name}</div>
          <div className="eyebrow" style={{ fontSize: 8.5, color: R.ink4, marginTop: 4, letterSpacing: "0.16em" }}>Certification</div>
        </div>
        <Pill tone={tone} faint={!reqMiss && c.status !== "taken" && c.status !== "expiring"}>{reqMiss ? "Required" : m.label}</Pill>
      </div>
      <div className="radio-inset" style={{ padding: "11px 13px", display: "flex", flexDirection: "column", gap: 7 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
          <span style={{ color: R.ink4 }}>Taken</span><span className="mono" style={{ color: c.taken ? R.ink2 : R.ink4, fontWeight: 600 }}>{c.taken || "—"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
          <span style={{ color: R.ink4 }}>Expiry</span><span className="mono" style={{ color: c.status === "expiring" ? R.gold : (c.expiry ? R.ink2 : R.ink4), fontWeight: 600 }}>{c.expiry || "—"}</span>
        </div>
        {c.note && <div style={{ fontSize: 11, color: c.status === "expiring" ? R.gold : R.ink3, marginTop: 1 }}>{c.note}</div>}
      </div>
      <button onClick={() => toast(`${m.action} · ${c.name}`, m.icon)} className="tap" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "9px 14px", borderRadius: 10, cursor: "pointer",
        fontFamily: "var(--font)", fontSize: 12.5, fontWeight: 700, color: reqMiss ? "#1c1305" : R.ink, background: reqMiss ? R.gold : "oklch(0.17 0 0)", border: reqMiss ? "none" : "1px solid oklch(1 0 0 / .12)" }}>
        <Icon name={m.icon} size={14} /> {m.action}{reqMiss ? " now" : ""}
      </button>
    </div>
  );
}
function CertsModule() {
  const certs = window.FETS.CERTS;
  const valid = certs.filter((c) => c.status === "taken").length;
  const reqMissing = certs.filter((c) => c.required && c.status === "not");
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionLabel right={<span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>{valid}/{certs.length} valid</span>}>My certifications</SectionLabel>

      <div className="radio-chassis" style={{ padding: "calc(22px * var(--density))" }}>
        <DevRail label="FETS · Certifications" right={<span className="mono" style={{ fontSize: 11, fontWeight: 700, color: R.gold }}>{valid}/{certs.length} valid</span>} />

        {reqMissing.length > 0 && (
          <div className="radio-inset" style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 15px", marginBottom: 16, border: "1px solid color-mix(in oklch, var(--accent) 40%, transparent)" }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", flexShrink: 0, color: R.gold, background: "color-mix(in oklch, var(--accent) 16%, oklch(0.12 0 0))" }}><Icon name="alert" size={16} /></span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: R.ink2 }}>
              {reqMissing.length === 1 ? <span><b style={{ color: R.ink }}>{reqMissing[0].name}</b> certification is required before assignment.</span> : <span><b style={{ color: R.ink }}>{reqMissing.length} required certifications</b> are missing.</span>}
            </span>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 13 }}>
          {certs.map((c) => <CertCard key={c.name} c={c} />)}
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
          <button onClick={() => toast("Upload certificate file", "download")} className="tap" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, cursor: "pointer",
            border: "1px solid oklch(1 0 0 / .12)", background: "oklch(0.17 0 0)", fontFamily: "var(--font)", fontSize: 13, fontWeight: 650, color: R.ink }}>
            <Icon name="download" size={15} style={{ transform: "rotate(180deg)" }} /> Upload a certificate
          </button>
        </div>
      </div>
    </section>
  );
}

/* =====================================================================
   ATTENDANCE — sub-tabs: Shift hours · Requests
   ===================================================================== */
const ATT_TONE = { present: R.gold, late: "oklch(0.88 0 0)", half: R.ink2, leave: R.ink3 };
const wDur = (m) => `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, "0")}m`;
const f12a = (t) => t ? (window.pfmt12 ? window.pfmt12(t) : t) : "—";

function WorkedHours() {
  const F = window.FETS;
  const [list, setList] = React.useState(() => F.workLogList());
  const readToday = () => { try { return JSON.parse(localStorage.getItem("fets-att-" + F.ISO(0).toDateString())); } catch (e) { return null; } };
  const [today, setToday] = React.useState(readToday);
  React.useEffect(() => {
    const refresh = () => { setList(F.workLogList()); setToday(readToday()); };
    window.addEventListener("fets-worklog-change", refresh);
    const iv = setInterval(refresh, 30000);
    return () => { window.removeEventListener("fets-worklog-change", refresh); clearInterval(iv); };
  }, []);
  const HMl = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const nowM = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  let liveRow = null;
  if (today && today.checkIn && !today.checkOut) {
    let br = 0; (today.breaks || []).forEach((b) => { const inT = b.in ? HMl(b.in) : nowM(); br += Math.max(0, inT - HMl(b.out)); });
    const worked = Math.max(0, (nowM() - HMl(today.checkIn)) - br);
    liveRow = { key: F.wlKey(F.ISO(0)), label: F.wlLabel(F.ISO(0)), inT: today.checkIn, outT: null, breakMins: br, workedMins: worked, status: today.status === "late" ? "late" : "present", live: true };
  }
  const rows = liveRow ? [liveRow, ...list.filter((e) => e.key !== liveRow.key)] : list;
  const totals = F.workLogTotals(list);
  const todayWorked = liveRow ? liveRow.workedMins : (list.find((e) => e.key === F.wlKey(F.ISO(0))) || {}).workedMins || 0;
  const stats = [
    { label: "Today", val: wDur(todayWorked), sub: liveRow ? "in progress" : "logged" },
    { label: "This week", val: wDur(totals.week), sub: "Mon–today" },
    { label: "This month", val: wDur(totals.month), sub: `${totals.days} day${totals.days === 1 ? "" : "s"}` },
  ];
  const cols = "minmax(120px,1.9fr) 0.8fr 0.8fr 0.7fr 1fr";

  return (
    <div className="radio-chassis" style={{ padding: "calc(20px * var(--density))" }}>
      <DevRail label="Attendance · Shift hours" right={<span className="mono" style={{ fontSize: 10, color: R.ink4, letterSpacing: "0.06em" }}>auto-logged on check-out</span>} />

      {/* totals on the screen */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 12, marginBottom: 16 }}>
        {stats.map((s, i) => (
          <div key={s.label} className="radio-screen" style={{ padding: "15px 17px" }}>
            <div className="eyebrow" style={{ fontSize: 8.5, color: R.ink4, letterSpacing: "0.16em" }}>{s.label}</div>
            <div className="tabnum mono" style={{ fontSize: 26, fontWeight: 700, color: i === 0 ? R.gold : R.ink, lineHeight: 1, letterSpacing: "-0.03em", marginTop: 9, textShadow: i === 0 ? "0 0 18px color-mix(in oklch, var(--accent) 45%, transparent)" : "none" }}>{s.val}</div>
            <div className="mono" style={{ fontSize: 10, color: R.ink4, marginTop: 6 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* dated history */}
      <div className="radio-screen" style={{ padding: "4px 6px 8px" }}>
        <div style={{ display: "grid", gridTemplateColumns: cols, gap: 8, padding: "11px 12px", alignItems: "center" }}>
          {["Date", "In", "Out", "Break", "Worked"].map((h, i) => <span key={h} className="eyebrow" style={{ fontSize: 8.5, color: R.ink4, letterSpacing: "0.14em", textAlign: i >= 1 ? "right" : "left" }}>{h}</span>)}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {rows.map((e) => (
            <div key={e.key} className="radio-row" style={{ display: "grid", gridTemplateColumns: cols, gap: 8, padding: "11px 12px", alignItems: "center", borderTop: `1px solid ${R.line}`,
              background: e.live ? "color-mix(in oklch, var(--accent) 12%, transparent)" : undefined, borderRadius: e.live ? 9 : 0 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                <LED tone={ATT_TONE[e.status] || R.ink4} on={true} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: R.ink, whiteSpace: "nowrap" }}>{e.label}{e.live ? " · today" : ""}</span>
              </span>
              <span className="mono tabnum" style={{ fontSize: 11.5, color: R.ink2, textAlign: "right" }}>{f12a(e.inT)}</span>
              <span className="mono tabnum" style={{ fontSize: 11.5, color: e.outT ? R.ink2 : R.ink4, textAlign: "right" }}>{e.live ? "live" : f12a(e.outT)}</span>
              <span className="mono tabnum" style={{ fontSize: 11.5, color: R.ink3, textAlign: "right" }}>{e.breakMins ? `${e.breakMins}m` : "—"}</span>
              <span className="mono tabnum" style={{ fontSize: 12.5, fontWeight: 700, color: e.status === "present" || e.status === "late" ? R.gold : R.ink, textAlign: "right" }}>{wDur(e.workedMins)}</span>
            </div>
          ))}
          {rows.length === 0 && <div style={{ padding: 22, textAlign: "center", fontSize: 13, color: R.ink4 }}>No shifts logged yet. Check in from the console above to start.</div>}
        </div>
      </div>
      <p style={{ margin: "12px 2px 0", fontSize: 11, color: R.ink4, lineHeight: 1.5 }}>Worked hours subtract every step-out break between check-in and check-out. The total saves here automatically when you check out at the end of the shift.</p>
    </div>
  );
}

function TimeOff() {
  const F = window.FETS;
  const user = F.user;
  const branch = user.shift.branch;
  const totals = F.rosterTotals(user.name);
  const [reqs, setReqs] = React.useState(() => F.staffReqList());
  const [mode, setMode] = React.useState("leave");
  const [leaveType, setLeaveType] = React.useState(F.LEAVE_TYPES[0]);
  const [withWho, setWithWho] = React.useState("");
  const [date, setDate] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [toilDays, setToilDays] = React.useState(1);
  const STAT = { Submitted: R.gold, Approved: R.ink, Rejected: R.ink3 };
  const KIND = { leave: "Leave", swap: "Swap", toil: "TOIL" };
  const mates = (F.STAFF[branch] || []).filter((n) => n !== user.name);
  const mine = reqs.filter((r) => r.who === user.name);
  const earnedToil = totals.toil;
  const usedToil = reqs.filter((r) => r.who === user.name && r.kind === "toil" && r.status === "Approved").reduce((a, r) => a + (+r.days || 0), 0);
  const availToil = Math.max(0, earnedToil - usedToil);

  const submit = () => {
    if (!date.trim()) { toast("Add a date first", "alert"); return; }
    let req;
    if (mode === "leave") req = { id: "q" + Date.now(), kind: "leave", who: user.name, branch, leaveType, date: date.trim(), reason: reason.trim(), status: "Submitted" };
    else if (mode === "swap") { if (!withWho) { toast("Pick who to swap with", "alert"); return; } req = { id: "q" + Date.now(), kind: "swap", who: user.name, with: withWho, branch, date: date.trim(), reason: reason.trim(), status: "Submitted" }; }
    else { if (availToil < 1) { toast("No TOIL left to use", "alert"); return; } const days = Math.max(1, Math.min(toilDays, availToil)); req = { id: "q" + Date.now(), kind: "toil", who: user.name, branch, days, date: date.trim(), reason: reason.trim(), status: "Submitted" }; }
    setReqs(F.staffReqAdd(req)); DB.dbAddLeave(req); setDate(""); setReason(""); setWithWho(""); setToilDays(1); toast("Sent to super admin for approval", "check");
  };
  const balances = [
    { n: totals.ot, suf: "h", label: "Overtime banked", icon: "clock" },
    { n: availToil, suf: "d", label: "TOIL to use", icon: "refresh", sub: `${earnedToil} earned · ${usedToil} used` },
    { n: totals.leave, suf: "", label: "Leave days marked", icon: "calendar" },
  ];
  const inputSt = { padding: "10px 12px", borderRadius: 10, fontFamily: "var(--font)", fontSize: 13, color: R.ink, background: "oklch(0.13 0 0)", border: "1px solid oklch(1 0 0 / .12)", outline: "none" };
  const chip = (on) => ({ padding: "8px 13px", borderRadius: 999, cursor: "pointer", fontFamily: "var(--font)", fontSize: 12.5, fontWeight: 650,
    border: `1px solid ${on ? "color-mix(in oklch, var(--accent) 50%, transparent)" : "oklch(1 0 0 / .1)"}`, background: on ? "color-mix(in oklch, var(--accent) 16%, oklch(0.13 0 0))" : "oklch(0.17 0 0)", color: on ? R.gold : R.ink3 });

  return (
    <div className="radio-chassis" style={{ padding: "calc(20px * var(--density))" }}>
      <DevRail label="Attendance · Time off" right={<span className="mono" style={{ fontSize: 10, color: R.ink4 }}>synced with roster</span>} />

      {/* balances */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 12, marginBottom: 18 }}>
        {balances.map((b) => (
          <div key={b.label} className="radio-screen" style={{ padding: "15px 16px", display: "flex", alignItems: "center", gap: 13 }}>
            <span style={{ width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", flexShrink: 0, color: R.gold, background: "oklch(0.2 0 0)", border: "1px solid oklch(1 0 0 / .08)" }}><Icon name={b.icon} size={18} /></span>
            <div style={{ minWidth: 0 }}>
              <div className="tabnum mono" style={{ fontSize: 26, fontWeight: 700, color: R.gold, lineHeight: 1, letterSpacing: "-0.03em" }}>{b.n}{b.suf}</div>
              <div className="eyebrow" style={{ fontSize: 8.5, color: R.ink4, marginTop: 6 }}>{b.label}</div>
              {b.sub && <div className="mono" style={{ fontSize: 9, color: R.ink4, marginTop: 3, whiteSpace: "nowrap" }}>{b.sub}</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="leave-cols" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "calc(18px * var(--density))", alignItems: "start" }}>
        {/* request */}
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", color: R.gold, background: "oklch(0.2 0 0)", border: "1px solid oklch(1 0 0 / .08)" }}><Icon name="plus" size={15} /></span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: R.ink }}>Raise a request</span>
          </div>
          <div className="radio-screen" style={{ padding: 15, display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="radio-inset" style={{ display: "flex", padding: 4, gap: 3, borderRadius: 999 }}>
              {[{ k: "leave", label: "Leave" }, { k: "swap", label: "Swap shift" }, { k: "toil", label: "Apply TOIL" }].map((o) => {
                const on = mode === o.k;
                return <button key={o.k} onClick={() => setMode(o.k)} className="tap" style={{ flex: 1, border: "none", cursor: "pointer", padding: "8px", borderRadius: 999, fontFamily: "var(--font)", fontSize: 12.5, fontWeight: on ? 700 : 550, color: on ? "#1c1305" : R.ink3, background: on ? R.gold : "transparent" }}>{o.label}</button>;
              })}
            </div>
            {mode === "leave" && <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{F.LEAVE_TYPES.map((tp) => <button key={tp} onClick={() => setLeaveType(tp)} className="tap" style={chip(leaveType === tp)}>{tp}</button>)}</div>}
            {mode === "swap" && (
              <div>
                <div className="eyebrow" style={{ fontSize: 9, color: R.ink4, marginBottom: 8 }}>Swap with</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {mates.map((n) => { const on = withWho === n; return <button key={n} onClick={() => setWithWho(on ? "" : n)} className="tap" style={{ ...chip(on), display: "inline-flex", alignItems: "center", gap: 7, paddingLeft: 6 }}><Avatar name={n} size={22} /> {n}</button>; })}
                </div>
              </div>
            )}
            {mode === "toil" && (
              <div className="radio-inset" style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div><div className="eyebrow" style={{ fontSize: 9, color: R.ink4 }}>TOIL available</div><div style={{ fontSize: 13, fontWeight: 700, color: availToil > 0 ? R.gold : R.ink3, marginTop: 3 }}>{availToil} day{availToil === 1 ? "" : "s"} to use</div></div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => setToilDays((d) => Math.max(1, d - 1))} className="tap" style={{ width: 28, height: 28, borderRadius: 999, border: "none", cursor: "pointer", background: "oklch(0.2 0 0)", color: R.ink2, display: "grid", placeItems: "center", fontSize: 16, fontWeight: 800 }}>–</button>
                  <span className="tabnum mono" style={{ minWidth: 22, textAlign: "center", fontSize: 15, fontWeight: 700, color: R.ink }}>{Math.min(toilDays, Math.max(1, availToil))}</span>
                  <button onClick={() => setToilDays((d) => Math.min(Math.max(1, availToil), d + 1))} className="tap" style={{ width: 28, height: 28, borderRadius: 999, border: "none", cursor: "pointer", background: "oklch(0.2 0 0)", color: R.ink2, display: "grid", placeItems: "center", fontSize: 16, fontWeight: 800 }}>+</button>
                </div>
              </div>
            )}
            <input value={date} onChange={(e) => setDate(e.target.value)} placeholder={mode === "toil" ? "Preferred day off (e.g. Jun 18, 2026)" : "Date (e.g. Jun 12, 2026)"} style={inputSt} />
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Reason" style={{ ...inputSt, resize: "vertical", lineHeight: 1.5 }} />
            <button onClick={submit} disabled={mode === "toil" && availToil < 1} className="tap" style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 17px", borderRadius: 10, border: "none",
              cursor: mode === "toil" && availToil < 1 ? "not-allowed" : "pointer", opacity: mode === "toil" && availToil < 1 ? 0.5 : 1, fontFamily: "var(--font)", fontSize: 13, fontWeight: 700, color: "#1c1305", background: R.gold }}><Icon name="shield" size={15} /> Send to super admin</button>
          </div>
        </div>

        {/* my requests */}
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", color: R.ink2, background: "oklch(0.2 0 0)", border: "1px solid oklch(1 0 0 / .08)" }}><Icon name="clock" size={15} /></span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: R.ink }}>My requests</span>
            <span className="mono" style={{ fontSize: 11, color: R.ink4 }}>{mine.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {mine.length === 0
              ? <div className="radio-inset" style={{ padding: 18, textAlign: "center", fontSize: 12.5, color: R.ink4 }}>No requests yet.</div>
              : mine.map((r) => (
                <div key={r.id} className="radio-tile" style={{ padding: "13px 15px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", padding: "3px 8px", borderRadius: 99, color: R.ink2, background: "oklch(1 0 0 / .07)", border: "1px solid oklch(1 0 0 / .1)" }}>{KIND[r.kind]}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 650, color: R.ink }}>{r.kind === "swap" ? `Swap with ${r.with}` : r.kind === "toil" ? `Use ${r.days || 1} TOIL day${(r.days || 1) > 1 ? "s" : ""}` : r.leaveType}</div>
                      <div className="mono" style={{ fontSize: 10.5, color: R.ink4, marginTop: 2 }}>{r.date}</div>
                    </div>
                    <Pill tone={STAT[r.status] || R.ink3} faint={r.status !== "Submitted"}>{r.status}</Pill>
                  </div>
                  {r.reason && <div className="radio-inset" style={{ padding: "8px 11px", display: "flex", gap: 8, alignItems: "flex-start" }}><Icon name="message" size={12} style={{ color: R.ink4, marginTop: 2, flexShrink: 0 }} /><span style={{ fontSize: 11.5, color: R.ink3, fontStyle: "italic" }}>{r.reason}</span></div>}
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RosterDiscussionChat() {
  const F = window.FETS;
  const profileId = F._meId;
  const [messages, setMessages] = React.useState([]);
  const [draft, setDraft] = React.useState("");
  const [topic, setTopic] = React.useState("general");
  const [loading, setLoading] = React.useState(true);
  const threadRef = React.useRef(null);

  const load = async () => {
    if (!profileId) return;
    const msgs = await DB.dbFetchRosterDiscussions(profileId);
    setMessages(msgs || []);
    setLoading(false);
  };

  React.useEffect(() => {
    load();
    window.addEventListener("fets-discussion-changed", load);
    return () => window.removeEventListener("fets-discussion-changed", load);
  }, [profileId]);

  React.useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages.length]);

  const send = async () => {
    if (!draft.trim() || !profileId) return;
    const msgText = draft.trim();
    setDraft("");
    const result = await DB.dbSendRosterDiscussion(profileId, profileId, msgText, topic);
    if (result) {
      load();
    } else {
      toast("Message failed to send", "alert");
    }
  };

  const topicOptions = [
    { value: "general", label: "General Inquiry" },
    { value: "roster", label: "Roster Schedule" },
    { value: "toil", label: "TOIL Balance / Payout" },
    { value: "rejection", label: "Claim Rejection" }
  ];

  return (
    <div className="glass" style={{ borderRadius: "var(--radius)", display: "flex", flexDirection: "column", overflow: "hidden", height: 500 }}>
      {/* Top control bar: select topic */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, background: "var(--glass-2)" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)" }}>Discussion Topic:</span>
        <div className="inset" style={{ display: "inline-flex", padding: 3, gap: 2, borderRadius: 999 }}>
          {topicOptions.map((o) => {
            const on = topic === o.value;
            return (
              <button key={o.value} onClick={() => setTopic(o.value)} className="tap" style={{ border: "none", cursor: "pointer", padding: "5px 12px", borderRadius: 999,
                fontFamily: "var(--font)", fontSize: 11.5, fontWeight: on ? 750 : 550, color: on ? "#1c1305" : "var(--ink-3)", background: on ? "var(--accent)" : "transparent" }}>
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Messages thread */}
      <div ref={threadRef} className="scroll-soft" style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, minHeight: 0 }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "var(--ink-4)", fontSize: 13, padding: 20 }}>Loading messages…</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--ink-4)", fontSize: 13, padding: 40, fontStyle: "italic" }}>
            No messages yet. Start a discussion with Super Admin regarding your Roster or TOIL balance!
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.sender_id === profileId;
            const senderName = isMe ? "You" : (m.sender?.full_name || "Admin");
            const senderRole = isMe ? "Staff" : (m.sender?.role || "Management");
            const formattedTime = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const formattedDate = new Date(m.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' });
            
            return (
              <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 4px", flexDirection: isMe ? "row-reverse" : "row" }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: isMe ? "var(--accent)" : "var(--ink-2)" }}>{senderName}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: isMe ? "var(--accent)" : "var(--v-ielts)",
                    background: isMe ? "color-mix(in oklch, var(--accent) 15%, transparent)" : "color-mix(in oklch, var(--v-ielts) 15%, transparent)", padding: "1px 6px", borderRadius: 5 }}>
                    {senderRole}
                  </span>
                  <span className="mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>{formattedDate} {formattedTime}</span>
                  {m.topic && m.topic !== 'general' && (
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--warn)", background: "color-mix(in oklch, var(--warn) 15%, transparent)", padding: "1px 6px", borderRadius: 5 }}>
                      #{m.topic}
                    </span>
                  )}
                </div>
                <div style={{ maxWidth: "78%", padding: "10px 14px", borderRadius: 14, fontSize: 13, lineHeight: 1.5, fontWeight: 500,
                  borderTopRightRadius: isMe ? 4 : 14, borderTopLeftRadius: isMe ? 14 : 4,
                  color: isMe ? "var(--accent-ink)" : "var(--ink)", background: isMe ? "var(--accent)" : "var(--glass-2)",
                  border: isMe ? "none" : "1px solid var(--hairline)" }}>
                  {m.message}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input Composer */}
      <div style={{ borderTop: "1px solid var(--hairline)", padding: "10px 14px", flexShrink: 0, display: "flex", gap: 9, background: "var(--glass-2)", alignItems: "flex-end" }}>
        <textarea 
          value={draft} 
          onChange={(e) => setDraft(e.target.value)} 
          rows={1}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Send a message to Super Admin…" 
          style={{ 
            background: "var(--inset)", border: "1px solid var(--hairline)", borderRadius: 10, color: "var(--ink)",
            fontFamily: "var(--font)", fontSize: 13.5, padding: "10px 12px", width: "100%", outline: "none",
            resize: "none", lineHeight: 1.4, minHeight: 38 
          }} 
        />
        <button onClick={send} className="tap" style={{ width: 38, height: 38, borderRadius: 10, border: "none", cursor: "pointer", flexShrink: 0,
          display: "grid", placeItems: "center", color: "var(--accent-ink)", background: "var(--accent)" }}>
          <Icon name="arrowR" size={17} stroke={2.4} />
        </button>
      </div>
    </div>
  );
}

function RosterDiscussionsAdmin() {
  const F = window.FETS;
  const adminId = F._meId;
  const [allMessages, setAllMessages] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedProfileId, setSelectedProfileId] = React.useState(null);
  const [replyText, setReplyText] = React.useState("");
  const threadScrollRef = React.useRef(null);

  const load = async () => {
    const msgs = await DB.dbFetchRosterThreads();
    setAllMessages(msgs || []);
    setLoading(false);
  };

  React.useEffect(() => {
    load();
    window.addEventListener("fets-discussion-changed", load);
    return () => window.removeEventListener("fets-discussion-changed", load);
  }, []);

  // Compile threads
  const threadsMap = {};
  allMessages.forEach((m) => {
    if (!threadsMap[m.profile_id]) {
      threadsMap[m.profile_id] = {
        profile_id: m.profile_id,
        staffName: m.thread_owner?.full_name || "Unknown Staff",
        branch: m.thread_owner?.branch_assigned || "cochin",
        lastMessage: m.message,
        lastCreatedAt: m.created_at,
        messages: []
      };
    }
    threadsMap[m.profile_id].messages.unshift(m);
  });

  const threads = Object.values(threadsMap).sort((a: any, b: any) => new Date(b.lastCreatedAt).getTime() - new Date(a.lastCreatedAt).getTime());
  const selectedThread = selectedProfileId ? threadsMap[selectedProfileId] : null;

  React.useEffect(() => {
    if (threadScrollRef.current) threadScrollRef.current.scrollTop = threadScrollRef.current.scrollHeight;
  }, [selectedThread?.messages.length, selectedProfileId]);

  const sendReply = async () => {
    if (!replyText.trim() || !selectedProfileId || !adminId) return;
    const msgText = replyText.trim();
    setReplyText("");
    const result = await DB.dbSendRosterDiscussion(selectedProfileId, adminId, msgText, "general");
    if (result) {
      load();
    } else {
      toast("Failed to send reply", "alert");
    }
  };

  if (loading) {
    return (
      <div className="glass" style={{ padding: 48, borderRadius: "var(--radius)", textAlign: "center", color: "var(--ink-4)" }}>
        Loading discussions…
      </div>
    );
  }

  return (
    <div className="glass" style={{ borderRadius: "var(--radius)", display: "flex", height: 600, overflow: "hidden" }}>
      {/* Threads Sidebar */}
      <div style={{ width: "30%", borderRight: "1px solid var(--hairline)", display: "flex", flexDirection: "column", background: "var(--glass-2)" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--hairline)", fontSize: 13, fontWeight: 750, color: "var(--ink)" }}>
          Active Threads
        </div>
        <div className="scroll-soft" style={{ flex: 1, overflowY: "auto" }}>
          {threads.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", fontSize: 12.5, color: "var(--ink-4)", fontStyle: "italic" }}>
              No discussions started yet.
            </div>
          ) : (
            threads.map((t: any) => {
              const active = selectedProfileId === t.profile_id;
              const formattedTime = new Date(t.lastCreatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
              return (
                <div 
                  key={t.profile_id} 
                  onClick={() => setSelectedProfileId(t.profile_id)}
                  className="tap"
                  style={{ 
                    padding: "12px 14px", borderBottom: "1px solid var(--hairline)", cursor: "pointer",
                    background: active ? "var(--glass-strong)" : "transparent",
                    transition: "background 0.2s"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Avatar name={t.staffName} size={24} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{t.staffName}</span>
                    </div>
                    <span className="mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>{formattedTime}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontSize: 11.5, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                      {t.lastMessage}
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "var(--accent)", background: "color-mix(in oklch, var(--accent) 15%, transparent)", padding: "1px 5px", borderRadius: 4 }}>
                      {t.branch.toUpperCase()}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Thread Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "transparent" }}>
        {selectedThread ? (
          <React.Fragment>
            {/* Thread Header */}
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "center", gap: 12, background: "var(--glass-2)" }}>
              <Avatar name={selectedThread.staffName} size={32} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 750, color: "var(--ink)" }}>{selectedThread.staffName}</div>
                <div style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 500 }}>
                  Branch: <span style={{ textTransform: "uppercase", fontWeight: 700 }}>{selectedThread.branch}</span>
                </div>
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div ref={threadScrollRef} className="scroll-soft" style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
              {selectedThread.messages.map((m: any) => {
                const isMe = m.sender_id === adminId;
                const senderName = isMe ? "You" : m.sender?.full_name || selectedThread.staffName;
                const senderRole = isMe ? "Admin" : m.sender?.role || "Staff";
                const formattedTime = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const formattedDate = new Date(m.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' });
                
                return (
                  <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", gap: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 4px", flexDirection: isMe ? "row-reverse" : "row" }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: isMe ? "var(--accent)" : "var(--ink-2)" }}>{senderName}</span>
                      <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: isMe ? "var(--accent)" : "var(--v-ielts)",
                        background: isMe ? "color-mix(in oklch, var(--accent) 15%, transparent)" : "color-mix(in oklch, var(--v-ielts) 15%, transparent)", padding: "1px 6px", borderRadius: 5 }}>
                        {senderRole}
                      </span>
                      <span className="mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>{formattedDate} {formattedTime}</span>
                      {m.topic && m.topic !== 'general' && (
                        <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--warn)", background: "color-mix(in oklch, var(--warn) 15%, transparent)", padding: "1px 6px", borderRadius: 5 }}>
                          #{m.topic}
                        </span>
                      )}
                    </div>
                    <div style={{ maxWidth: "78%", padding: "10px 14px", borderRadius: 14, fontSize: 13, lineHeight: 1.5, fontWeight: 500,
                      borderTopRightRadius: isMe ? 4 : 14, borderTopLeftRadius: isMe ? 14 : 4,
                      color: isMe ? "var(--accent-ink)" : "var(--ink)", background: isMe ? "var(--accent)" : "var(--glass-2)",
                      border: isMe ? "none" : "1px solid var(--hairline)" }}>
                      {m.message}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Composer */}
            <div style={{ borderTop: "1px solid var(--hairline)", padding: "12px 16px", flexShrink: 0, display: "flex", gap: 9, background: "var(--glass-2)", alignItems: "flex-end" }}>
              <textarea 
                value={replyText} 
                onChange={(e) => setReplyText(e.target.value)} 
                rows={1}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                placeholder={`Reply to ${selectedThread.staffName}…`} 
                style={{ 
                  background: "var(--inset)", border: "1px solid var(--hairline)", borderRadius: 10, color: "var(--ink)",
                  fontFamily: "var(--font)", fontSize: 13.5, padding: "10px 12px", width: "100%", outline: "none",
                  resize: "none", lineHeight: 1.4, minHeight: 38 
                }} 
              />
              <button onClick={sendReply} className="tap" style={{ width: 38, height: 38, borderRadius: 10, border: "none", cursor: "pointer", flexShrink: 0,
                display: "grid", placeItems: "center", color: "var(--accent-ink)", background: "var(--accent)" }}>
                <Icon name="arrowR" size={17} stroke={2.4} />
              </button>
            </div>
          </React.Fragment>
        ) : (
          <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--ink-4)", fontSize: 13, fontStyle: "italic" }}>
            Select a staff member from the left to view the discussion.
          </div>
        )}
      </div>
    </div>
  );
}

function LeaveModule() {
  const [tab, setTab] = React.useState("hours");
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <SectionLabel right={<RadioTabs value={tab} onChange={setTab} tabs={[{ k: "hours", label: "Shift hours", icon: "clock" }, { k: "requests", label: "Requests", icon: "calendar" }, { k: "discussion", label: "Discussion", icon: "message" }]} />}>Attendance</SectionLabel>
      </div>
      {tab === "hours" ? <WorkedHours /> : tab === "requests" ? <TimeOff /> : <RosterDiscussionChat />}
    </section>
  );
}

/* =====================================================================
   QUICK ACCESS VAULT (embedded)
   ===================================================================== */
function VaultModule() {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionLabel right={<span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>{window.FETS.VENDORS.length} vendors</span>}>Quick access vault</SectionLabel>
      <div className="glass" style={{ padding: 16, borderRadius: "var(--radius)" }}>
        <VaultPanel />
      </div>
    </section>
  );
}

Object.assign(window, { TasksModule, ChecklistModule, CertsModule, LeaveModule, VaultModule });

/* ============================================================
   SOURCE: pages-mydesk.jsx
   ============================================================ */
/* ============================================================
   FETS · LIVE — My Desk (daily operating cockpit)
   Masthead · Attendance console · Workspace presets · modules
   ============================================================ */

const HMIN = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
const nowHM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const durLabel = (mins) => `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
const f12 = (t) => window.pfmt12 ? window.pfmt12(t) : t;
const CONSOLE_ORANGE = "oklch(0.72 0.17 52)";

function useLocal(key, init) {
  const [v, setV] = React.useState(() => { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : init; } catch (e) { return init; } });
  React.useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }, [key, v]);
  return [v, setV];
}

/* ---------- uploadable profile avatar ---------- */
function ProfileAvatar({ name, size = 66 }) {
  const [img, setImg] = useLocal("fets-profile-pic", null);
  const inputRef = React.useRef(null);
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("");
  const onFile = (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { setImg(r.result); toast("Profile photo updated", "check"); };
    r.readAsDataURL(f);
  };
  return (
    <button onClick={() => inputRef.current && inputRef.current.click()} className="tap" title="Upload profile photo"
      style={{ position: "relative", width: size, height: size, borderRadius: 999, padding: 0, cursor: "pointer", flexShrink: 0,
        border: "1px solid var(--hairline)", background: img ? "var(--inset)" : "var(--accent)", overflow: "hidden", display: "grid", placeItems: "center" }}>
      {img
        ? <img src={img} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <span style={{ fontFamily: '"Archivo Expanded", var(--font)', fontWeight: 800, fontSize: size * 0.34, color: "var(--accent-ink)" }}>{initials}</span>}
      <span style={{ position: "absolute", right: -2, bottom: -2, width: size * 0.36, height: size * 0.36, borderRadius: 999,
        background: "var(--glass-strong)", border: "1px solid var(--hairline)", display: "grid", placeItems: "center", color: "var(--ink-2)", boxShadow: "var(--shadow)" }}>
        <Icon name="camera" size={size * 0.17} />
      </span>
      <input ref={inputRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
    </button>
  );
}

const ATT_META = {
  not_marked: { label: "Standby", color: "var(--ink-4)" },
  present:    { label: "On shift", color: "var(--ok)" },
  late:       { label: "Late start", color: "var(--warn)" },
  half:       { label: "Half day", color: "var(--v-prometric)" },
  leave:      { label: "On leave", color: "var(--bad)" },
};
const ATT_BLANK = { status: "not_marked", checkIn: null, checkOut: null, breaks: [], lateReason: "" };

/* ---------- console knob (rotary dial) ---------- */
function ConsoleKnob({ pct, label, sub, color, size = 124 }) {
  const p = Math.min(1, Math.max(0, pct || 0));
  const N = 30;
  const ang = -135 + p * 270;
  const c = size / 2;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 11 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: "absolute", inset: 0 }}>
          {Array.from({ length: N + 1 }).map((_, i) => {
            const a = (-135 + i * (270 / N)) * Math.PI / 180;
            const r1 = c - 6, r2 = (i % 5 === 0) ? c - 16 : c - 12;
            const passed = i / N <= p;
            return <line key={i} x1={c + r1 * Math.cos(a)} y1={c + r1 * Math.sin(a)} x2={c + r2 * Math.cos(a)} y2={c + r2 * Math.sin(a)}
              stroke={passed ? color : "var(--ink-4)"} strokeWidth={i % 5 === 0 ? 2 : 1.2} strokeLinecap="round" opacity={passed ? 0.95 : 0.32} />;
          })}
        </svg>
        <div style={{ position: "absolute", inset: 22, borderRadius: "50%",
          background: "radial-gradient(circle at 38% 30%, oklch(0.36 0.03 184), oklch(0.17 0.024 184))",
          boxShadow: "inset 0 2px 4px oklch(1 0 0 / .08), inset 0 -4px 8px oklch(0 0 0 / .55), 0 7px 16px oklch(0 0 0 / .45)",
          border: "1px solid oklch(0 0 0 / .55)" }}>
          <div style={{ position: "absolute", left: "50%", top: "50%", width: 3, height: "40%", borderRadius: 3,
            background: color, transformOrigin: "bottom center", transform: `translate(-50%,-100%) rotate(${ang}deg)`, boxShadow: `0 0 9px ${color}` }} />
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div className="eyebrow" style={{ fontSize: 8.5, color: "var(--ink-4)", letterSpacing: "0.18em" }}>{label}</div>
        {sub != null && <div className="mono" style={{ fontSize: 12.5, fontWeight: 700, color, marginTop: 4, letterSpacing: "-0.02em" }}>{sub}</div>}
      </div>
    </div>
  );
}

/* ---------- vertical level meter ---------- */
function VMeter({ pct, color, label }) {
  const p = Math.min(1, Math.max(0, pct || 0));
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, alignSelf: "stretch" }}>
      <div style={{ position: "relative", width: 14, flex: 1, minHeight: 104, borderRadius: 99,
        background: "var(--panel-3)", boxShadow: "inset 0 2px 6px oklch(0 0 0 / .55)", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${p * 100}%`,
          background: `linear-gradient(to top, ${color}, color-mix(in oklch, ${color} 45%, transparent))`, boxShadow: `0 0 14px ${color}` }} />
      </div>
      <div className="eyebrow" style={{ fontSize: 8.5, color: "var(--ink-4)", letterSpacing: "0.16em" }}>{label}</div>
    </div>
  );
}

/* ---------- digital readout cell ---------- */
function Readout({ label, time, tone }) {
  return (
    <div style={{ padding: "9px 11px", borderRadius: 9, background: "oklch(0.15 0.02 184)", border: "1px solid oklch(0 0 0 / .45)",
      boxShadow: "inset 0 1px 3px oklch(0 0 0 / .5)", minWidth: 76, flex: "1 1 76px" }}>
      <div className="eyebrow" style={{ fontSize: 7.5, color: "var(--ink-4)", letterSpacing: "0.14em" }}>{label}</div>
      <div className="tabnum mono" style={{ fontSize: 14, fontWeight: 700, marginTop: 3, color: time ? (tone || "var(--ink)") : "var(--ink-4)", letterSpacing: "-0.02em" }}>{time ? f12(time) : "––:––"}</div>
    </div>
  );
}

function AttendanceCard({ shift }) {
  const dayKey = "fets-att-" + window.FETS.ISO(0).toDateString();
  const [att, setAtt] = useLocal(dayKey, ATT_BLANK);
  const meta = ATT_META[att.status];
  const onBreak = att.breaks.length > 0 && att.breaks[att.breaks.length - 1].in === null;
  const grace = 10;

  const worked = () => {
    if (!att.checkIn) return 0;
    const end = att.checkOut || nowHM();
    let total = HMIN(end) - HMIN(att.checkIn);
    let br = 0;
    att.breaks.forEach((b) => { const inT = b.in || (att.checkOut ? b.out : nowHM()); br += Math.max(0, HMIN(inT) - HMIN(b.out)); });
    return Math.max(0, total - br);
  };
  const breakMinsFor = (a) => {
    let br = 0;
    a.breaks.forEach((b) => { const inT = b.in || (a.checkOut ? b.out : nowHM()); br += Math.max(0, HMIN(inT) - HMIN(b.out)); });
    return br;
  };

  const sched = Math.max(1, HMIN(shift.end) - HMIN(shift.start));
  const elapsed = Math.min(sched, Math.max(0, HMIN(nowHM()) - HMIN(shift.start)));
  const shiftPct = elapsed / sched;
  const outPct = Math.min(1, worked() / sched);

  const checkIn = () => { const t = nowHM(); const late = HMIN(t) > HMIN(shift.start) + grace; setAtt({ ...ATT_BLANK, checkIn: t, status: late ? "late" : "present" }); toast(late ? "Checked in (late)" : "Checked in", "check"); };
  const stepOut = () => { setAtt({ ...att, breaks: [...att.breaks, { out: nowHM(), in: null }] }); toast("Stepped out", "clock"); };
  const backIn = () => { setAtt({ ...att, breaks: att.breaks.map((b, i) => i === att.breaks.length - 1 ? { ...b, in: nowHM() } : b) }); toast("Back in", "clock"); };
  const checkOut = () => {
    const t = nowHM();
    const next = { ...att, checkOut: t };
    setAtt(next);
    // persist the completed day to the worked-hours log
    const brk = breakMinsFor(next);
    const total = Math.max(0, (HMIN(t) - HMIN(att.checkIn)) - brk);
    const d = window.FETS.ISO(0);
    window.FETS.workLogUpsert({ key: window.FETS.wlKey(d), label: window.FETS.wlLabel(d), inT: att.checkIn, outT: t, breakMins: brk, workedMins: total, status: att.status === "late" ? "late" : "present" });
    window.dispatchEvent(new Event("fets-worklog-change"));
    toast(`Checked out · ${durLabel(total)} worked`, "check");
  };
  const mark = (s) => { setAtt({ ...ATT_BLANK, status: s }); toast(ATT_META[s].label, "calendar"); };
  const reset = () => setAtt(ATT_BLANK);

  const CBtn = ({ children, onClick, primary, tone }) => (
    <button onClick={onClick} className="tap" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 18px", borderRadius: 999,
      cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
      border: "1px solid " + (primary ? "transparent" : "oklch(0 0 0 / .5)"),
      color: primary ? "#1c1305" : (tone || "var(--ink-2)"),
      background: primary ? CONSOLE_ORANGE : "linear-gradient(oklch(0.31 0.03 184), oklch(0.23 0.027 184))",
      boxShadow: primary ? `0 0 16px color-mix(in oklch, ${CONSOLE_ORANGE} 55%, transparent)` : "inset 0 1px 0 oklch(1 0 0 / .07), 0 2px 5px oklch(0 0 0 / .4)" }}>{children}</button>
  );

  return (
    <div className="console-shell" style={{ padding: "calc(22px * var(--density))", borderRadius: 22, position: "relative", overflow: "hidden",
      background: "linear-gradient(160deg, oklch(0.22 0.025 184), oklch(0.165 0.022 184))",
      border: "1px solid oklch(0 0 0 / .5)", boxShadow: "inset 0 1px 0 oklch(1 0 0 / .06), inset 0 0 0 1px oklch(1 0 0 / .015), 0 16px 40px oklch(0 0 0 / .45)" }}>
      {/* header rail */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
        <div className="eyebrow" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.22em" }}>Attendance · Console</div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: meta.color }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: meta.color, boxShadow: `0 0 10px ${meta.color}` }} />{meta.label}
        </div>
      </div>

      <div className="console-row" style={{ display: "flex", gap: 24, alignItems: "stretch", flexWrap: "wrap" }}>
        {/* zone 1 — knob */}
        <div style={{ display: "flex", alignItems: "center", paddingRight: 8 }}>
          <ConsoleKnob pct={shiftPct} label="Shift elapsed" sub={`${Math.round(shiftPct * 100)}%`} color={CONSOLE_ORANGE} />
        </div>

        {/* zone 2 — worked readout + actions */}
        <div style={{ flex: "1 1 240px", minWidth: 220, display: "flex", flexDirection: "column", justifyContent: "center", gap: 14, borderLeft: "1px solid oklch(0 0 0 / .4)", paddingLeft: 24 }}>
          <div>
            <div className="eyebrow" style={{ fontSize: 8.5, color: "var(--ink-4)", letterSpacing: "0.18em" }}>Worked today</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
              <span className="tabnum mono" style={{ fontSize: 46, fontWeight: 700, letterSpacing: "-0.05em", color: "var(--ink)", lineHeight: 0.85 }}>{durLabel(worked())}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-4)", fontWeight: 600, marginTop: 8, display: "inline-flex", alignItems: "center", gap: 7 }}>
              <Icon name="clock" size={12} style={{ color: CONSOLE_ORANGE }} /> Shift {f12(shift.start)}–{f12(shift.end)} · {shift.branch}
            </div>
          </div>
          {att.status === "late" && !att.checkOut && (
            <input value={att.lateReason} onChange={(e) => setAtt({ ...att, lateReason: e.target.value })} placeholder="Reason for late arrival…"
              style={{ width: "100%", padding: "10px 13px", borderRadius: 10, fontFamily: "var(--font)", fontSize: 13, color: "var(--ink)", background: "oklch(0.15 0.02 184)",
                border: "1px solid color-mix(in oklch, var(--warn) 40%, oklch(0 0 0 / .5))", outline: "none" }} />
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
            {!att.checkIn && att.status !== "leave" && att.status !== "half" && (
              <React.Fragment>
                <CBtn primary onClick={checkIn}><Icon name="power" size={15} stroke={2.5} /> Check in</CBtn>
                <CBtn onClick={() => mark("half")}>Half day</CBtn>
                <CBtn onClick={() => mark("leave")} tone="var(--bad)">On leave</CBtn>
              </React.Fragment>
            )}
            {att.checkIn && !att.checkOut && (
              onBreak
                ? <CBtn primary onClick={backIn}><Icon name="arrowR" size={15} stroke={2.4} /> I'm back</CBtn>
                : <React.Fragment>
                    <CBtn onClick={stepOut}><Icon name="coffee" size={15} /> Step out</CBtn>
                    <CBtn primary onClick={checkOut}><Icon name="power" size={15} stroke={2.5} /> Check out</CBtn>
                  </React.Fragment>
            )}
            {(att.checkOut || att.status === "leave" || att.status === "half") && (
              <CBtn onClick={reset}><Icon name="refresh" size={14} /> Reset day</CBtn>
            )}
          </div>
        </div>

        {/* zone 3 — OUT meter */}
        <div style={{ display: "flex", paddingLeft: 4 }}>
          <VMeter pct={outPct} color={CONSOLE_ORANGE} label="Out" />
        </div>

        {/* zone 4 — log / stamps */}
        <div style={{ flex: "1 1 230px", minWidth: 210, borderLeft: "1px solid oklch(0 0 0 / .4)", paddingLeft: 24, display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="eyebrow" style={{ fontSize: 8.5, color: "var(--ink-4)", letterSpacing: "0.18em" }}>Punch log</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Readout label="Check-in" time={att.checkIn} tone="var(--ok)" />
            {att.breaks.map((b, i) => (
              <React.Fragment key={i}>
                <Readout label={`Out ${i + 1}`} time={b.out} tone="var(--warn)" />
                <Readout label={`In ${i + 1}`} time={b.in} tone="var(--v-prometric)" />
              </React.Fragment>
            ))}
            <Readout label="Check-out" time={att.checkOut} tone={CONSOLE_ORANGE} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
   READINESS — dark performance console
   ===================================================================== */
function MetricMeter({ label, value, pct, plain }) {
  const col = pct >= 85 ? "var(--ok)" : pct >= 60 ? CONSOLE_ORANGE : "var(--warn)";
  const p = Math.min(1, Math.max(0.04, (plain ? 100 : pct) / 100));
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 9, flex: "1 1 64px", minWidth: 60 }}>
      <span className="tabnum mono" style={{ fontSize: 13, fontWeight: 700, color: col, letterSpacing: "-0.02em" }}>{value}</span>
      <div style={{ position: "relative", width: 12, height: 88, borderRadius: 99, background: "var(--panel-3)", boxShadow: "inset 0 2px 6px oklch(0 0 0 / .55)", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${p * 100}%`, background: `linear-gradient(to top, ${col}, color-mix(in oklch, ${col} 45%, transparent))`, boxShadow: `0 0 12px ${col}` }} />
      </div>
      <span className="eyebrow" style={{ fontSize: 7.5, color: "var(--ink-4)", letterSpacing: "0.1em", textAlign: "center", lineHeight: 1.25, maxWidth: 76 }}>{label}</span>
    </div>
  );
}

function ReadinessDial({ score, size = 188 }) {
  const p = Math.min(1, Math.max(0, score / 100));
  const col = score >= 85 ? "var(--ok)" : score >= 70 ? CONSOLE_ORANGE : "var(--warn)";
  const N = 44, c = size / 2;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: N + 1 }).map((_, i) => {
          const a = (-135 + i * (270 / N)) * Math.PI / 180;
          const r1 = c - 6, r2 = (i % 5 === 0) ? c - 18 : c - 13;
          const passed = i / N <= p;
          return <line key={i} x1={c + r1 * Math.cos(a)} y1={c + r1 * Math.sin(a)} x2={c + r2 * Math.cos(a)} y2={c + r2 * Math.sin(a)}
            stroke={passed ? col : "var(--ink-4)"} strokeWidth={i % 5 === 0 ? 2.2 : 1.2} strokeLinecap="round" opacity={passed ? 0.95 : 0.3} />;
        })}
      </svg>
      <div style={{ position: "absolute", inset: 26, borderRadius: "50%", display: "grid", placeItems: "center",
        background: "radial-gradient(circle at 40% 32%, oklch(0.32 0.03 184), oklch(0.15 0.022 184))",
        boxShadow: `inset 0 2px 5px oklch(1 0 0 / .07), inset 0 -5px 10px oklch(0 0 0 / .55), 0 0 26px color-mix(in oklch, ${col} 28%, transparent)`, border: "1px solid oklch(0 0 0 / .55)" }}>
        <div style={{ textAlign: "center" }}>
          <div className="tabnum" style={{ fontFamily: '"Archivo Expanded", var(--font)', fontWeight: 800, fontSize: 56, lineHeight: 0.85, letterSpacing: "-0.03em", color: col, textShadow: `0 0 20px color-mix(in oklch, ${col} 50%, transparent)` }}>{score}</div>
          <div className="eyebrow" style={{ fontSize: 8, color: "var(--ink-4)", letterSpacing: "0.24em", marginTop: 6 }}>Readiness</div>
        </div>
      </div>
    </div>
  );
}

function PerformanceSnapshot() {
  const p = window.FETS.PERFORMANCE;
  const half = Math.ceil(p.metrics.length / 2);
  const left = p.metrics.slice(0, half), right = p.metrics.slice(half);
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionLabel right={<span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>growth tracking</span>}>Professional readiness</SectionLabel>
      <div className="console-shell" style={{ padding: "calc(26px * var(--density)) calc(24px * var(--density))", borderRadius: 22, position: "relative", overflow: "hidden",
        background: "linear-gradient(160deg, oklch(0.22 0.025 184), oklch(0.165 0.022 184))",
        border: "1px solid oklch(0 0 0 / .5)", boxShadow: "inset 0 1px 0 oklch(1 0 0 / .06), 0 16px 40px oklch(0 0 0 / .45)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <div className="eyebrow" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.22em" }}>Readiness · Console</div>
          <div className="mono" style={{ fontSize: 9, color: "var(--ink-4)", letterSpacing: "0.08em" }}>BUILD 2.06 · {window.FETS.user.name}</div>
        </div>
        <div className="readiness-row" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 26, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 18, flex: "1 1 200px", justifyContent: "center" }}>{left.map((m) => <MetricMeter key={m.label} {...m} />)}</div>
          <ReadinessDial score={p.readiness} />
          <div style={{ display: "flex", gap: 18, flex: "1 1 200px", justifyContent: "center" }}>{right.map((m) => <MetricMeter key={m.label} {...m} />)}</div>
        </div>
        <div style={{ textAlign: "center", marginTop: 22, fontSize: 12, color: "var(--ink-3)", fontWeight: 600 }}>Keep it climbing — every checklist and task counts.</div>
      </div>
    </section>
  );
}

/* =====================================================================
   MY DESK — workspace presets + compose the cockpit
   ===================================================================== */
const DESK_TABS = [
  { id: "handovers", icon: "clipboard", color: "var(--v-prometric)", label: "Handovers" },
  { id: "tasks", icon: "check", color: "var(--accent)", label: "My Task" },
  { id: "checklist", icon: "clipboard", color: "var(--v-prometric)", label: "Checklist" },
  { id: "certs", icon: "shield", color: "var(--ok)", label: "Certificates" },
  { id: "leave", icon: "calendar", color: "var(--warn)", label: "Attendance & Leaves" },
  { id: "readiness", icon: "trend", color: "var(--v-cma)", label: "Readiness" },
];

/* =====================================================================
   HANDOVER INBOX — incoming staff review & sign-off module (My Desk)
   ===================================================================== */
function HandoverInbox() {
  const myName = window.FETS?.user?.name || "";
  const [pending, setPending] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState(null);
  const [comment, setComment] = React.useState("");
  const [signing, setSigning] = React.useState(false);

  const loadPending = async () => {
    setLoading(true);
    try {
      const items = await DB.dbFetchPendingHandovers(myName);
      setPending(items);
    } catch (e) {
      console.error("HandoverInbox load error:", e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadPending();
    const handler = () => loadPending();
    window.addEventListener("fets-handover-pending", handler);
    return () => window.removeEventListener("fets-handover-pending", handler);
  }, []);

  const handleSignOff = async () => {
    if (!selected || signing) return;
    setSigning(true);
    const timeStr = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "");
    const sigIn = { name: myName, time: timeStr };

    const result = await DB.dbCompleteHandover(selected.id, sigIn, comment);
    if (result) {
      // Post one-liner to Lab
      const branchLabel = (selected.branch === "all" || !selected.branch) ? "All centres" : selected.branch.charAt(0).toUpperCase() + selected.branch.slice(1);
      const outNames = (selected.outgoing_staff || []).join(", ");
      const inNames = (selected.incoming_staff || []).join(", ");
      const dateStr = new Date(selected.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      const oneLiner = `\u{1F504} Shift handover completed: ${outNames} \u2192 ${inNames} at ${selected.handover_time}, ${dateStr} \u00B7 ${branchLabel}`;

      await LAB.labCreate({
        type: "handover",
        center: selected.branch === "all" ? "all" : selected.branch,
        text: oneLiner
      });

      toast("Handover signed off successfully", "check");
      setSelected(null);
      setComment("");
      loadPending();
      window.dispatchEvent(new Event("fets-handover-pending"));
      window.dispatchEvent(new Event("fets-discussion-changed"));
    }
    setSigning(false);
  };

  const activePending = pending.filter(h => h.status === "pending");

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)", font: "600 14px var(--font)" }}>Loading handovers...</div>;
  }

  if (selected) {
    const h = selected;
    const isExpired = h.expires_at && new Date(h.expires_at) < new Date();
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <button onClick={() => { setSelected(null); setComment(""); }} className="tap glass-2"
          style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid var(--hairline)", cursor: "pointer", font: "600 12.5px var(--font)", color: "var(--ink-3)" }}>
          \u2190 Back to Handovers
        </button>

        {/* Header */}
        <div className="glass" style={{ borderRadius: "var(--radius)", padding: "20px 22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--ink)" }}>Shift Handover Review</h2>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-3)" }}>
                From: {(h.outgoing_staff || []).join(", ")} · {new Date(h.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} at {h.handover_time}
              </p>
            </div>
            {isExpired && (
              <span style={{ padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: "rgba(255,118,117,0.12)", color: "#D23F3F", border: "1px solid rgba(255,118,117,0.25)" }}>EXPIRED</span>
            )}
          </div>
        </div>

        {/* Candidate headcount */}
        <div className="glass" style={{ borderRadius: "var(--radius)", padding: "18px 22px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)", marginBottom: 12 }}>Candidate Headcount</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="inset" style={{ padding: 14, borderRadius: 12, textAlign: "center" }}>
              <div className="tabnum mono" style={{ fontSize: 26, fontWeight: 700, color: "var(--ok)" }}>{h.currently_testing}</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-3)", fontWeight: 600, marginTop: 2 }}>Currently Testing</div>
            </div>
            <div className="inset" style={{ padding: 14, borderRadius: 12, textAlign: "center" }}>
              <div className="tabnum mono" style={{ fontSize: 26, fontWeight: 700, color: "#FF7675" }}>{h.no_shows}</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-3)", fontWeight: 600, marginTop: 2 }}>No Shows</div>
            </div>
          </div>
          {h.candidate_notes && (
            <div style={{ marginTop: 12, fontSize: 13, color: "var(--ink-2)", whiteSpace: "pre-wrap" }}>{h.candidate_notes}</div>
          )}
        </div>

        {/* Checklist */}
        <div className="glass" style={{ borderRadius: "var(--radius)", padding: "18px 22px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)", marginBottom: 12 }}>Checklist Verification</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(h.checklist || []).map((item, idx) => {
              const icon = item.status === 'ok' ? '\u2705' : item.status === 'attention' ? '\u26A0\uFE0F' : item.status === 'critical' ? '\uD83D\uDEA8' : '\u26AA';
              return (
                <div key={idx} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "9px 12px", borderRadius: 8, background: "var(--inset)", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{item.label}</span>
                    {item.note && <div style={{ fontSize: 12, fontStyle: "italic", color: "var(--ink-3)", marginTop: 2 }}>"{item.note}"</div>}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", flexShrink: 0,
                    color: item.status === 'ok' ? "var(--ok)" : item.status === 'attention' ? "#C2860F" : item.status === 'critical' ? "#D23F3F" : "var(--ink-4)" }}>
                    {icon} {item.status || "N/A"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pending work */}
        {h.pending_items?.length > 0 && (
          <div className="glass" style={{ borderRadius: "var(--radius)", padding: "18px 22px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)", marginBottom: 12 }}>Pending Work & Incidents</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {h.pending_items.map((p, idx) => (
                <div key={idx} style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 12px", borderRadius: 8, background: "var(--inset)" }}>
                  <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", padding: "2px 7px", borderRadius: 4,
                    background: p.sev === "high" ? "rgba(255,118,117,0.1)" : p.sev === "med" ? "rgba(253,203,110,0.1)" : "rgba(178,190,195,0.1)",
                    color: p.sev === "high" ? "#D23F3F" : p.sev === "med" ? "#C2860F" : "var(--ink-4)" }}>{p.sev}</span>
                  <span style={{ fontSize: 13, color: "var(--ink)" }}>{p.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        {h.instructions && (
          <div className="glass" style={{ borderRadius: "var(--radius)", padding: "18px 22px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)", marginBottom: 8 }}>Instructions for Next Shift</div>
            <div style={{ fontSize: 14, color: "var(--ink)", fontStyle: "italic", whiteSpace: "pre-wrap" }}>{h.instructions}</div>
          </div>
        )}

        {/* Outgoing signature */}
        <div className="glass" style={{ borderRadius: "var(--radius)", padding: "18px 22px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)", marginBottom: 8 }}>Outgoing Sign-off</div>
          {h.sig_out ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontFamily: "'Homemade Apple', cursive", fontSize: 22, color: "var(--ink)" }}>{h.sig_out.name}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ok)" }}>\u2713 Verified</span>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-4)" }}>{h.sig_out.time}</span>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "var(--ink-4)", fontStyle: "italic" }}>No signature</div>
          )}
        </div>

        {/* Comment + sign-off section */}
        {!isExpired && (
          <div className="glass" style={{ borderRadius: "var(--radius)", padding: "22px", border: "1px solid var(--accent-line)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>Your Sign-off</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", display: "block", marginBottom: 6 }}>Add comments or observations (optional)</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="Any observations, issues noticed, or notes for the record..."
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--hairline)", background: "var(--inset)", color: "var(--ink)", fontFamily: "var(--font)", fontSize: 13, resize: "vertical", lineHeight: 1.5, boxSizing: "border-box" }}
              />
            </div>
            <button
              onClick={handleSignOff}
              disabled={signing}
              className="tap"
              style={{
                width: "100%", padding: "14px 24px", borderRadius: 14, border: "none",
                background: signing ? "var(--ink-4)" : "var(--accent)", color: signing ? "var(--ink-2)" : "var(--accent-ink)",
                font: "700 14px var(--font)", cursor: signing ? "not-allowed" : "pointer",
                boxShadow: "0 4px 16px color-mix(in oklch, var(--accent) 40%, transparent)"
              }}
            >
              {signing ? "Signing..." : "I confirm I have reviewed this handover and accept responsibility for the shift"}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {activePending.length > 0 && (
        <div style={{
          padding: "16px 20px", borderRadius: "var(--radius)",
          background: "linear-gradient(135deg, rgba(253,203,110,0.12), rgba(253,203,110,0.04))",
          border: "1px solid rgba(253,203,110,0.25)",
          display: "flex", alignItems: "center", gap: 12
        }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#FDCB6E", animation: "pulse 2s infinite", flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
            You have {activePending.length} handover{activePending.length > 1 ? "s" : ""} awaiting your sign-off
          </span>
        </div>
      )}

      {pending.length === 0 ? (
        <div className="inset" style={{ padding: 40, borderRadius: "var(--radius)", textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-2)", marginBottom: 4 }}>No Pending Handovers</div>
          <div style={{ fontSize: 13, color: "var(--ink-4)" }}>You're all caught up. New handovers will appear here.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {pending.map((h) => {
            const isExpired = h.status === "expired" || (h.expires_at && new Date(h.expires_at) < new Date());
            const ago = timeAgo(h.created_at);
            const branchLabel = (h.branch === "all" || !h.branch) ? "All centres" : h.branch.charAt(0).toUpperCase() + h.branch.slice(1);
            return (
              <div key={h.id} className="glass tap" onClick={() => setSelected(h)}
                style={{ borderRadius: "var(--radius)", padding: "16px 20px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                      {(h.outgoing_staff || []).join(", ")}
                    </span>
                    <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 800,
                      background: isExpired ? "rgba(255,118,117,0.12)" : "rgba(253,203,110,0.15)",
                      color: isExpired ? "#D23F3F" : "#C2860F" }}>
                      {isExpired ? "Expired" : "Pending"}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
                    {branchLabel} · {new Date(h.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} · {h.handover_time} · {ago}
                  </span>
                </div>
                <button className="tap" style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: isExpired ? "var(--inset)" : "var(--accent)", color: isExpired ? "var(--ink-3)" : "var(--accent-ink)", font: "700 12.5px var(--font)", cursor: "pointer" }}>
                  {isExpired ? "View" : "Review & Sign"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* preset-device style nav card — name only, big display */
function PresetCard({ m, idx, on, onClick, badge }) {
  return (
    <button onClick={onClick} className="tap" style={{ display: "flex", gap: 12, cursor: "pointer", textAlign: "left", fontFamily: "var(--font)",
      padding: 13, borderRadius: 20, alignItems: "stretch", position: "relative",
      border: "1px solid " + (on ? "var(--accent-line)" : "oklch(0 0 0 / .45)"),
      background: "linear-gradient(155deg, oklch(0.30 0.03 184), oklch(0.215 0.025 184))",
      boxShadow: on ? "inset 0 1px 0 oklch(1 0 0 / .07), 0 10px 24px oklch(0 0 0 / .4)" : "inset 0 1px 0 oklch(1 0 0 / .05), 0 4px 12px oklch(0 0 0 / .3)",
      transition: "border-color .18s, box-shadow .18s" }}>
      {badge > 0 && <span style={{ position: "absolute", top: 8, right: 8, minWidth: 20, height: 20, padding: "0 5px", borderRadius: 999, display: "grid", placeItems: "center", fontSize: 10, fontWeight: 800, color: "#fff", background: "#FF7675", boxShadow: "0 0 8px rgba(255,118,117,0.5)", zIndex: 2 }}>{badge > 99 ? "99+" : badge}</span>}
      {/* screen */}
      <div style={{ flex: 1, minWidth: 0, minHeight: 104, borderRadius: 13, padding: "11px 13px 12px", display: "flex", flexDirection: "column",
        background: on ? `linear-gradient(160deg, color-mix(in oklch, ${m.color} 16%, oklch(0.12 0.02 184)), oklch(0.1 0.018 184))` : "linear-gradient(160deg, oklch(0.14 0.02 184), oklch(0.1 0.018 184))",
        border: "1px solid oklch(0 0 0 / .5)", boxShadow: "inset 0 2px 6px oklch(0 0 0 / .5)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ flex: 1, height: 7, borderRadius: 2, background: `repeating-linear-gradient(90deg, ${on ? m.color : "var(--ink-4)"} 0 2px, transparent 2px 7px)`, opacity: on ? 0.7 : 0.35 }} />
          <span className="mono" style={{ fontSize: 8, fontWeight: 700, color: "var(--ink-4)", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>NO.{String(idx + 1).padStart(2, "0")}</span>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
          <span style={{ fontFamily: '"Archivo Expanded", var(--font)', fontWeight: 800, fontSize: 23, lineHeight: 0.96, letterSpacing: "-0.02em",
            color: on ? m.color : "var(--ink-2)", textShadow: on ? `0 0 18px color-mix(in oklch, ${m.color} 50%, transparent)` : "none" }}>{m.label}</span>
        </div>
      </div>
      {/* knob rail */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "center", paddingTop: 2 }}>
        <span style={{ width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", flexShrink: 0, color: on ? m.color : "var(--ink-3)",
          background: "radial-gradient(circle at 38% 30%, oklch(0.34 0.03 184), oklch(0.18 0.024 184))",
          boxShadow: "inset 0 1px 2px oklch(1 0 0 / .08), inset 0 -2px 4px oklch(0 0 0 / .5), 0 2px 5px oklch(0 0 0 / .4)", border: "1px solid oklch(0 0 0 / .5)" }}>
          <Icon name={m.icon} size={15} />
        </span>
        <span style={{ width: 9, height: 9, borderRadius: 999, background: on ? m.color : "var(--ink-4)", opacity: on ? 1 : 0.4, boxShadow: on ? `0 0 9px ${m.color}` : "none" }} />
      </div>
    </button>
  );
}

function DeskMenu({ tab, setTab, pendingHandovers }) {
  return (
    <nav className="desk-menu" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(206px, 1fr))", gap: 12 }}>
      {DESK_TABS.map((m, i) => <PresetCard key={m.id} m={m} idx={i} on={tab === m.id} onClick={() => setTab(m.id)} badge={m.id === "handovers" ? pendingHandovers : 0} />)}
    </nav>
  );
}

function MyDeskPage({ branch, setActive, setDrawer }) {
  const u = window.FETS.user;
  const gap = "calc(24px * var(--density))";
  const [pendingCount, setPendingCount] = React.useState(0);
  const [tab, setTab] = React.useState("tasks");

  // Fetch pending handover count + auto-select tab
  React.useEffect(() => {
    const refresh = async () => {
      const n = await DB.dbCountPendingHandovers(u.name);
      setPendingCount(n);
      if (n > 0) setTab("handovers");
    };
    refresh();
    const handler = () => refresh();
    window.addEventListener("fets-handover-pending", handler);
    return () => window.removeEventListener("fets-handover-pending", handler);
  }, []);

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", flexDirection: "column", gap }}>
      {/* masthead — name + profile photo only */}
      <header className="rise" style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <ProfileAvatar name={u.name} size={66} />
        <h1 style={{ margin: 0, fontFamily: '"Archivo Expanded", var(--font)', fontWeight: 800, whiteSpace: "nowrap",
          fontSize: "clamp(30px,4vw,48px)", lineHeight: 1, letterSpacing: "-0.03em", color: "var(--ink)" }}>{u.name}</h1>
      </header>

      {/* attendance console removed as requested */}

      {/* workspace presets */}
      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <SectionLabel right={<span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>{DESK_TABS.length} modules</span>}>Your workspace</SectionLabel>
        <DeskMenu tab={tab} setTab={setTab} pendingHandovers={pendingCount} />
      </section>

      {/* active feature — full width */}
      <div style={{ minHeight: 300 }}>
        {tab === "handovers" && <HandoverInbox />}
        {tab === "tasks" && <TasksModule />}
        {tab === "checklist" && <ChecklistModule />}
        {tab === "certs" && <CertsModule />}
        {tab === "leave" && <LeaveModule />}
        {tab === "readiness" && <PerformanceSnapshot />}
      </div>
    </div>
  );
}

Object.assign(window, { MyDeskPage, AttendanceCard, PerformanceSnapshot, DeskMenu, ProfileAvatar });

/* ============================================================
   SOURCE: command-centre.jsx
   ============================================================ */
/* ============================================================
   FETS · LIVE — top-nav shell, masthead, page routing
   ============================================================ */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "dark": true,
  "accent": "gold",
  "density": "regular"
}/*EDITMODE-END*/;

const ACCENTS = [
  { key: "sage", color: "#88BDA4" },
  { key: "gold", color: "oklch(0.86 0.16 92)" },
  { key: "amber", color: "oklch(0.80 0.15 64)" },
  { key: "lime", color: "oklch(0.84 0.16 122)" },
  { key: "sky", color: "oklch(0.80 0.13 220)" },
];
const DENSITY_VAL = { compact: 0.86, regular: 1, spacious: 1.14 };

/* primary nav */
const NAV = [
  { id: "live", label: "Live" },
  { id: "calendar", label: "Calendar" },
  { id: "roster", label: "Roster" },
  { id: "desk", label: "My Desk" },
];

/* secondary tools (Lost & Found now lives on the LIVE page under Help & support) */
const TOOLS = [
  { id: "attn-admin", icon: "clock", label: "Daily Attendance", sub: "All staff check-in / out · admin" },
  { id: "business", icon: "star", label: "Google Business", sub: "Reviews, ratings & reach", page: true },
  { id: "fets-intelligence", icon: "spark", label: "FETS AI", sub: "Ops copilot", legacy: true },
  { id: "candidate-tracker", icon: "users", label: "Candidate Tracker", sub: "Registrations & sessions", legacy: true },
  { id: "access-hub", icon: "key", label: "F-Vault / Access Hub", sub: "Credentials & access", legacy: true },
  { id: "staff-requests", icon: "user", label: "Roster Approvals Hub", sub: "Manage staff requests, leaves & swaps" },
  { id: "staff-ot", icon: "clock", label: "OT & TOIL Manager", sub: "Overtime logging & TOIL cash payouts" },
  { id: "dashboard", icon: "grid", label: "Dashboard", sub: "iCloud overview", legacy: true },
  { id: "news-manager", icon: "message", label: "News Manager", sub: "Announcements", legacy: true },
  { id: "system-manager", icon: "settings", label: "System Manager", sub: "Admin & config", legacy: true },
  { id: "user-management", icon: "shield", label: "User Management", sub: "Roles & permissions", legacy: true },
  { id: "branch-delegation", icon: "shield", label: "Branch Access Delegation", sub: "Temporary access override", legacy: true },
];

/* per-branch tint for the subtle top-bar indicator */
const BRANCH_TINT = {
  calicut: "oklch(0.86 0.16 92)",   // gold
  cochin:  "oklch(0.74 0.13 235)",  // blue
  global:  "oklch(0.76 0.15 162)",  // teal-green
};
const BRANCH_NAME = { calicut: "Calicut", cochin: "Cochin", global: "All centres" };

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
function ordinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/* ---------- top navigation ---------- */
function TopNav({ active, onNavigate, branch, setBranch, t, setTweak, onTools, onBurger, onLogout, pendingHandoverBadge }) {
  const candToday = branchSessions(0, branch).reduce((a, s) => a + s.count, 0);
  return (
    <header className="glass" style={{
      position: "sticky", top: 0, zIndex: 60, flexShrink: 0,
      margin: "14px clamp(14px,3vw,30px) 0", borderRadius: 16,
      padding: "11px 11px 11px 18px", display: "flex", alignItems: "center", gap: "clamp(14px,2.4vw,30px)",
      boxShadow: "var(--shadow)", "--branch": BRANCH_TINT[branch] || "var(--accent)",
    }}>
      {/* brand mark */}
      <button onClick={() => onNavigate({ id: "live" })} className="tap" style={{
        display: "flex", alignItems: "center", gap: 13, border: "none", background: "transparent",
        cursor: "pointer", padding: 0, flexShrink: 0, fontFamily: "var(--font)",
      }}>
        <span style={{ width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center",
          background: "var(--accent)", color: "var(--accent-ink)", fontWeight: 900, fontSize: 20,
          fontFamily: '"Archivo Expanded", var(--font)', letterSpacing: "-0.04em", lineHeight: 1 }}>F</span>
        <span style={{ width: 1, height: 26, background: "var(--accent)" }} />
      </button>

      {/* primary links */}
      <nav className="topnav-links" style={{ display: "flex", alignItems: "center", gap: "clamp(18px,2.4vw,32px)" }}>
        {NAV.map((n) => (
          <button key={n.id} className={`topnav-item ${active === n.id ? "active" : ""}`} onClick={() => onNavigate(n)} style={{ position: "relative" }}>
            {n.label}
            {n.id === "desk" && pendingHandoverBadge > 0 && (
              <span style={{ position: "absolute", top: -6, right: -10, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 999, display: "grid", placeItems: "center", fontSize: 9, fontWeight: 800, color: "#fff", background: "#FF7675", boxShadow: "0 0 6px rgba(255,118,117,0.5)" }}>
                {pendingHandoverBadge > 9 ? "9+" : pendingHandoverBadge}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      {/* right controls */}
      {/* candidates today — compact, reacts to the branch toggle */}
      <span title={`${candToday} candidates booked today · ${BRANCH_NAME[branch]}`} className="tap glass-2 topnav-count" style={{
        display: "inline-flex", alignItems: "center", gap: 8, height: 36, padding: "0 13px", borderRadius: 10, flexShrink: 0,
        color: "var(--ink-2)", fontFamily: "var(--font)", fontSize: 12.5, fontWeight: 650 }}>
        <Icon name="users" size={15} style={{ color: "var(--accent)" }} />
        <span className="tabnum" style={{ fontSize: 13.5, fontWeight: 750, color: "var(--ink)" }}>{candToday}</span>
        <span className="topnav-branch">today</span>
      </span>
      {active !== "news" && (
        <div className="topnav-seg">
          <Segmented value={branch} onChange={setBranch} size="sm" 
            options={[
              { value: "calicut", label: "Calicut", color: BRANCH_TINT.calicut },
              { value: "cochin", label: "Cochin", color: BRANCH_TINT.cochin },
              { value: "global", label: "All", color: BRANCH_TINT.global },
            ]} />
        </div>
      )}
      {window.FETS.isAdmin && (
        <button onClick={onTools} title="All modules" className="tap glass-2" style={{
          display: "inline-flex", alignItems: "center", gap: 8, height: 36, padding: "0 14px", borderRadius: 10,
          cursor: "pointer", color: "var(--ink-2)", fontFamily: "var(--font)", fontSize: 12.5, fontWeight: 650 }}>
          <Icon name="grid" size={15} /> <span className="topnav-branch">Modules</span>
        </button>
      )}
      <button onClick={onLogout} title="Log out" className="tap glass-2" style={{
        display: "inline-flex", alignItems: "center", gap: 8, height: 36, padding: "0 13px", borderRadius: 10,
        cursor: "pointer", color: "var(--ink-2)", fontFamily: "var(--font)", fontSize: 12.5, fontWeight: 650, flexShrink: 0 }}>
        <Icon name="power" size={15} /> <span className="topnav-branch">Log out</span>
      </button>
      <button onClick={onBurger} className="tap glass-2 topnav-burger" title="Menu" style={{
        display: "none", width: 36, height: 36, borderRadius: 10, placeItems: "center", cursor: "pointer", color: "var(--ink-2)" }}>
        <Icon name="menu" size={18} />
      </button>
    </header>
  );
}

/* ---------- LIVE masthead (ref image 1) ---------- */
function Masthead({ branch }) {
  const d = new Date();
  const branchLabel = branch === "global" ? "All Centres" : branch.charAt(0).toUpperCase() + branch.slice(1);
  const dateStr = `${["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][d.getDay()]}, ${["January","February","March","April","May","June","July","August","September","October","November","December"][d.getMonth()]} ${ordinal(d.getDate())}, ${d.getFullYear()}`;
  const user = window.FETS?.user || { name: "User", day: 1, role: "Staff" };

  return (
    <section className="rise" style={{
      paddingTop: 4,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "stretch",
      gap: 24,
      flexWrap: "wrap",
    }}>
      <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
            <span style={{ width: 34, height: 2, background: "var(--accent)", borderRadius: 99 }} />
            <span className="eyebrow" style={{ color: "var(--accent)" }}>Operational Intelligence // {branchLabel}</span>
          </div>
          <h1 style={{
            margin: 0, fontFamily: '"Archivo Expanded", var(--font)', fontWeight: 900,
            fontSize: "clamp(56px,11vw,128px)", lineHeight: 0.86, letterSpacing: "-0.03em",
            color: "var(--accent)", display: "flex", alignItems: "flex-end", gap: "0.1em", flexWrap: "wrap",
          }}>
            <span>FETS</span>
            <span style={{ display: "inline-flex", alignItems: "flex-end", gap: "0.18em" }}>
              LIVE
              <span className="mono" style={{ fontSize: "clamp(11px,1.1vw,15px)", fontWeight: 700, letterSpacing: "0.1em",
                color: "var(--ink-4)", paddingBottom: "0.7em" }}>V7.0</span>
            </span>
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 22 }}>
          <span style={{ width: 28, height: 1.5, background: "var(--ink-4)", borderRadius: 99 }} />
          <span className="serif-it" style={{ fontSize: "clamp(17px,2vw,23px)", color: "var(--accent)", fontWeight: 500 }}>{dateStr}</span>
        </div>
      </div>
      
      {/* Right side: Premium Welcome Card */}
      <div className="glass-2" style={{
        padding: "20px 24px",
        borderRadius: "var(--radius)",
        display: "flex",
        alignItems: "center",
        gap: 18,
        border: "1px solid var(--hairline)",
        background: "var(--glass-2)",
        flex: "0 1 360px",
        minWidth: 300,
        boxShadow: "var(--shadow-lift)",
        position: "relative",
        overflow: "hidden",
        alignSelf: "flex-end",
      }}>
        {/* Subtle accent vertical indicator */}
        <div style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: "linear-gradient(to bottom, var(--accent), var(--accent-2))",
        }} />
        
        {/* Glowing background blob */}
        <div style={{
          position: "absolute",
          top: -24,
          right: -24,
          width: 90,
          height: 90,
          borderRadius: "50%",
          background: "var(--accent)",
          filter: "blur(32px)",
          opacity: 0.12,
          pointerEvents: "none",
        }} />
        
        <Avatar name={user.name} size={54} />
        <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
          <span className="mono" style={{
            fontSize: 10,
            fontWeight: 800,
            color: "var(--accent)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}>
            {greeting()}
          </span>
          <h2 style={{
            margin: 0,
            fontSize: "clamp(20px, 2.3vw, 26px)",
            fontWeight: 850,
            fontFamily: "var(--font)",
            color: "var(--ink)",
            lineHeight: 1.15,
            letterSpacing: "-0.015em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}>
            {user.name}
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
            <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", fontWeight: 650 }}>
              Day {user.day}
            </span>
            <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--ink-4)" }} />
            <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-4)" }}>
              {user.role}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- front-page feature cards (ported designs) ---------- */
const _MONS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* Next 7 Days — boarding-pass ticket */
function TicketCard({ branch, onClick }) {
  const wk = weekTotals(branch);
  const s = window.FETS.ISO(0), e = window.FETS.ISO(6);
  const fd = (d) => `${_MONS[d.getMonth()]} ${d.getDate()}`;
  return (
    <div className="fz-ticket-wrap">
      <div className="fz-ticket" role="button" onClick={onClick} title="Next 7 days — tap for the client breakdown">
        <div className="fz-barcode" />
        <div className="fz-sep"><span /></div>
        <div className="fz-content">
          <div className="fz-cdata">
            <div className="fz-dest">
              <div><p className="c">From</p><p className="ac">{fd(s)}</p><p className="h"><Icon name="calendar" size={10} /> Today</p></div>
              <Icon name="arrowR" size={20} style={{ color: "#aeaeae", flexShrink: 0 }} />
              <div style={{ textAlign: "right" }}><p className="c">To</p><p className="ac">{fd(e)}</p><p className="h" style={{ justifyContent: "flex-end" }}>+7 days</p></div>
            </div>
            <div style={{ borderBottom: "2px solid #e8e8e8" }} />
            <div className="fz-row">
              <div className="fz-d"><p className="t">Sessions</p><p className="s">{wk.sess}</p></div>
              <div className="fz-d"><p className="t">Candidates</p><p className="s">{wk.cand}</p></div>
              <div className="fz-d"><p className="t">Branch</p><p className="s">{branch === "global" ? "All" : capBranch(branch)}</p></div>
            </div>
          </div>
          <div className="fz-icons">
            <span className="ic"><Icon name="calendar" size={22} /></span>
            <span className="ic"><Icon name="users" size={18} /></span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Raise a Case — retro TV */
function CaseTvCard({ onClick }) {
  return (
    <div className="fz-tv" role="button" onClick={onClick} title="Raise a case">
      <div className="main_wrapper">
        <div className="main">
          <div className="antenna">
            <div className="antenna_shadow" /><div className="a1" /><div className="a1d" /><div className="a2" /><div className="a2d" /><div className="a_base" />
          </div>
          <div className="tv">
            <div className="cruve">
              <svg className="curve_svg" version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 189.929 189.929"><path d="M70.343,70.343c-30.554,30.553-44.806,72.7-39.102,115.635l-29.738,3.951C-5.442,137.659,11.917,86.34,49.129,49.13C86.34,11.918,137.664-5.445,189.928,1.502l-3.95,29.738C143.041,25.54,100.895,39.789,70.343,70.343z" /></svg>
            </div>
            <div className="display_div"><div className="screen_out"><div className="screen_out1"><div className="screen"><span className="notfound_text">RAISE A CASE</span></div></div></div></div>
            <div className="lines"><div className="line1" /><div className="line2" /><div className="line3" /></div>
            <div className="buttons_div">
              <div className="b1"><div /></div><div className="b2" />
              <div className="speakers"><div className="g1"><div className="g11" /><div className="g12" /><div className="g13" /></div><div className="g" /><div className="g" /></div>
            </div>
          </div>
          <div className="bottom"><div className="base1" /><div className="base2" /><div className="base3" /></div>
        </div>
      </div>
    </div>
  );
}

/* Quick Access / Help Desk / Lost & Found — animated outline button */
function StartButton({ label, onClick }) {
  return (
    <button onClick={onClick} className="fz-startbtn" data-text={label}>
      <span className="actual-text">&nbsp;{label}&nbsp;</span>
      <span className="hover-text" aria-hidden="true">&nbsp;{label}&nbsp;</span>
    </button>
  );
}

/* minimal Next-7-Days drawer — just client → candidate count */
function OutlookMiniPanel({ branch }) {
  const totals = {};
  for (let o = 0; o < 7; o++) branchSessions(o, branch).forEach((x) => { totals[x.vendor] = (totals[x.vendor] || 0) + x.count; });
  const rows = Object.entries(totals).map(([slug, n]) => ({ v: window.VENDOR_BY_SLUG[slug], n })).filter((r) => r.v).sort((a, b) => b.n - a.n);
  const grand = rows.reduce((a, r) => a + r.n, 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="glass" style={{ padding: "16px 18px", borderRadius: "var(--radius)", display: "flex", alignItems: "baseline", gap: 10 }}>
        <span className="tabnum mono" style={{ fontSize: 34, fontWeight: 700, color: "var(--accent)", letterSpacing: "-0.04em" }}>{grand}</span>
        <span style={{ fontSize: 13, color: "var(--ink-3)", fontWeight: 600 }}>candidates · next 7 days</span>
      </div>
      <SectionLabel>By client</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.length === 0
          ? <div className="inset" style={{ padding: 16, borderRadius: 12, textAlign: "center", fontSize: 13, color: "var(--ink-4)", fontStyle: "italic" }}>No sessions in the next 7 days.</div>
          : rows.map((r) => (
            <div key={r.v.slug} className="glass-2" style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", borderRadius: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: r.v.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 650, color: "var(--ink)" }}>{r.v.name}</span>
              <span className="tabnum mono" style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>{r.n}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

/* ---------- LIVE page — outline-button menu ---------- */
function MenuRow({ items }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "calc(16px * var(--density))" }}>
      {items.map((q) => (
        <div key={q.label} className="glass" style={{ position: "relative", borderRadius: "var(--radius)", padding: "30px 22px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, minHeight: 140, textAlign: "center" }}>
          {q.badge ? <span title={`${q.badge} new`} style={{ position: "absolute", top: 12, right: 12, minWidth: 22, height: 22, padding: "0 6px", borderRadius: 999, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800, color: "var(--accent-ink)", background: "var(--accent)", boxShadow: "0 0 12px color-mix(in oklch, var(--accent) 60%, transparent)" }}>{q.badge > 99 ? "99+" : q.badge}</span> : null}
          <StartButton label={q.label} onClick={q.on} />
          <span style={{ fontSize: 12.5, color: "var(--ink-3)", fontWeight: 500 }}>{q.sub}</span>
        </div>
      ))}
    </div>
  );
}

function LivePage({ branch, setDrawer, setActive, bridge }) {
  const gap = "calc(34px * var(--density))";
  const [labUnread, setLabUnread] = React.useState(0);
  React.useEffect(() => { LAB.labUnread().then(setLabUnread); }, []);
  const ops = [
    { label: "Raise a Case", sub: "Log a technical, candidate or facility issue", on: () => setActive("case") },
    { label: "Shift Handover", sub: "Log checklist, headcount & sign-off", on: () => setActive("handover") },
    { label: "The Lab", sub: "Team wall — handovers, shoutouts, questions & notices", on: () => setActive("news"), badge: labUnread },
  ];
  const support = [
    { label: "Quick Access", sub: "Vendor credentials, portals & site codes", on: () => setDrawer("vault") },
    { label: "Help Desk", sub: "Live vendor support portals & helplines", on: () => setDrawer("help") },
    { label: "Lost & Found", sub: "Items handed in, logged & waiting to be claimed", on: () => setDrawer("lostfound") },
  ];
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", flexDirection: "column", gap }}>
      <Masthead branch={branch} />
      <section style={{ display: "flex", flexDirection: "column", gap: "calc(16px * var(--density))" }}>
        <SectionLabel right={<span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>operations</span>}>Operations</SectionLabel>
        <MenuRow items={ops} />
      </section>
      <section style={{ display: "flex", flexDirection: "column", gap: "calc(16px * var(--density))" }}>
        <SectionLabel right={<span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>support</span>}>Quick access &amp; support</SectionLabel>
        <MenuRow items={support} />
      </section>
    </div>
  );
}

/* ---------- News page (redesigned to match the other pages) ---------- */
/* ============================================================ THE LAB ============================================================ */
const LAB_TYPES = {
  announcement: { label: "Announcement", color: "var(--accent)", icon: "alert" },
  handover: { label: "Handover", color: "var(--v-prometric)", icon: "clipboard" },
  shoutout: { label: "Shoutout", color: "var(--v-cma)", icon: "star" },
  question: { label: "Question", color: "var(--v-ielts)", icon: "message" },
  general: { label: "General", color: "var(--ink-3)", icon: "users" },
};
const LAB_CENTERS = ["all", "calicut", "cochin"];
const LAB_CLABEL = { all: "All centres", calicut: "Calicut", cochin: "Cochin", kannur: "Kannur" };
function labCanAnnounce() {
  const e = (window.FETS.user.email || "").toLowerCase();
  return ["mithun@fets.in", "mithun@fets.live", "niyas@fets.in", "niyas@fets.live"].includes(e);
}
function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(d).toLocaleDateString();
}

function labRich(text) {
  if (!text) return null;
  const out = []; const re = /@([\w][\w'.\-]*(?:\s[\w'.\-]+)?)/g; let last = 0, m, k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<span key={k++} style={{ color: "var(--accent)", fontWeight: 700 }}>{m[0]}</span>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
function labMentionsMe(text) {
  const fn = (window.FETS.user.name || "").split(" ")[0].toLowerCase();
  return !!fn && (text || "").toLowerCase().includes("@" + fn);
}

function LabPostCard({ p, onChange, onDelete, canMod }) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const me = window.FETS._meUserId;
  const acked = (p.acks || []).includes(me);
  const reacts = p.reactions || {};
  const [picker, setPicker] = React.useState(false);
  const react = (emoji) => {
    const arr = reacts[emoji] || []; const mine = arr.includes(me);
    LAB.labReact(p.id, emoji, mine);
    const next = { ...reacts }; next[emoji] = mine ? arr.filter((x) => x !== me) : [...arr, me];
    if (!next[emoji].length) delete next[emoji];
    onChange({ ...p, reactions: next }); setPicker(false);
  };
  const comment = () => { const txt = draft.trim(); if (!txt) return; LAB.labAddComment(p.id, txt); onChange({ ...p, comments: [...p.comments, { id: "t" + Date.now(), text: txt, name: window.FETS.user.name, at: new Date().toISOString() }] }); setDraft(""); };
  const ack = () => { const next = acked ? p.acks.filter((x) => x !== me) : [...p.acks, me]; const np = { ...p, acks: next }; LAB.labSaveMeta(np); onChange(np); };
  const pin = () => { const np = { ...p, pinned: !p.pinned }; LAB.labSaveMeta(np); onChange(np); };
  return (
    <article className="glass rise" style={{ borderRadius: "var(--radius)", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, border: "1px solid var(--hairline)", boxShadow: "var(--shadow)" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar name={p.authorName} size={36} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13.5, fontWeight: 750, color: "var(--ink)" }}>{p.authorName}</span>
              {p.pinned && <span title="Pinned" style={{ color: "var(--accent)" }}><Icon name="pin" size={12} /></span>}
            </div>
            <span style={{ fontSize: 10.5, color: "var(--ink-4)", fontWeight: 550 }}>{timeAgo(p.when)}{p.role ? ` · ${p.role}` : ""}</span>
          </div>
        </div>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 999, color: "var(--accent)", background: "var(--accent-soft)", border: "1px solid var(--accent-line)" }}>{LAB_CLABEL[p.center] || "All centres"}</span>
      </div>
      {/* body */}
      {p.text && <div style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.6, whiteSpace: "pre-wrap", fontWeight: 550 }}>{labRich(p.text)}</div>}
      {p.image && <div style={{ width: "100%", borderRadius: "var(--radius-sm)", overflow: "hidden", border: "1px solid var(--hairline)", background: "var(--inset)", display: "flex", justifyContent: "center", alignItems: "center" }}><a href={p.image} target="_blank" rel="noopener noreferrer" style={{ width: "100%" }}><img src={p.image} alt="" style={{ width: "100%", maxHeight: 420, objectFit: "contain", display: "block" }} /></a></div>}
      {(p.attachments || []).map((a, i) => (
        <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="tap glass-2" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, textDecoration: "none", color: "var(--ink-2)", fontSize: 12, fontWeight: 650, border: "1px solid var(--hairline)" }}><Icon name="package" size={13} /> <span>{a.name || "Attachment"}</span></a>
      ))}
      {/* divider */}
      <div style={{ height: 1, background: "var(--hairline)" }} />
      {/* footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {Object.keys(reacts).filter((e) => reacts[e] && reacts[e].length).map((e) => { const mine = reacts[e].includes(me); return (
            <button key={e} onClick={() => react(e)} className="tap" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, cursor: "pointer", border: `1px solid ${mine ? "var(--accent-line)" : "var(--hairline)"}`, background: mine ? "var(--accent-soft)" : "var(--glass-2)", color: mine ? "var(--accent)" : "var(--ink-2)", fontSize: 12, fontWeight: 700 }}><span>{e}</span> <span style={{ fontSize: 11, opacity: 0.9 }}>{reacts[e].length}</span></button>
          ); })}
          <div style={{ position: "relative" }}>
            <button onClick={() => setPicker((v) => !v)} className="tap glass-2" title="React" style={{ display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: 999, cursor: "pointer", border: "1px solid var(--hairline)", color: "var(--ink-3)", fontSize: 15 }}>＋</button>
            {picker && <div className="glass" style={{ position: "absolute", bottom: 38, left: 0, zIndex: 8, display: "flex", gap: 6, padding: 8, borderRadius: 12, boxShadow: "var(--shadow-lift)", border: "1px solid var(--hairline)" }}>{LAB.LAB_EMOJIS.map((e) => <button key={e} onClick={() => react(e)} className="tap" style={{ fontSize: 18, border: "none", background: "transparent", cursor: "pointer", padding: 4, borderRadius: 8 }}>{e}</button>)}</div>}
          </div>
          <button onClick={() => setOpen((o) => !o)} className="tap glass-2" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999, cursor: "pointer", border: "1px solid var(--hairline)", color: "var(--ink-2)", fontFamily: "var(--font)", fontSize: 12, fontWeight: 700 }}><Icon name="message" size={13} /> <span>Comments</span> <span style={{ opacity: 0.7, fontSize: 11 }}>{p.comments.length}</span></button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {canMod && <button onClick={pin} title={p.pinned ? "Unpin" : "Pin"} className="tap glass-2" style={{ width: 32, height: 32, borderRadius: 10, display: "grid", placeItems: "center", cursor: "pointer", color: p.pinned ? "var(--accent)" : "var(--ink-3)", border: "1px solid var(--hairline)" }}><Icon name="pin" size={14} /></button>}
          {(p.mine || canMod) && <button onClick={() => onDelete(p)} title="Delete" className="tap glass-2" style={{ width: 32, height: 32, borderRadius: 10, display: "grid", placeItems: "center", cursor: "pointer", color: "var(--bad)", border: "1px solid var(--hairline)" }}><Icon name="trash" size={14} /></button>}
        </div>
      </div>
      {/* comments */}
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4, borderTop: "1px solid var(--hairline)" }}>
          {p.comments.map((c) => (
            <div key={c.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Avatar name={c.name} size={28} />
              <div className="inset" style={{ flex: 1, padding: "10px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--hairline)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 750, color: "var(--ink-2)" }}>{c.name}</span>
                  <span style={{ fontSize: 9.5, color: "var(--ink-4)" }}>{timeAgo(c.at)}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--ink)", marginTop: 4, whiteSpace: "pre-wrap", fontWeight: 500, lineHeight: 1.5 }}>{labRich(c.text)}</div>
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && comment()} placeholder="Write a comment…" style={{ flex: 1, background: "var(--inset)", border: "1px solid var(--hairline)", borderRadius: 10, color: "var(--ink)", fontFamily: "var(--font)", fontSize: 13, padding: "10px 14px", outline: "none" }} />
            <button onClick={comment} className="tap" style={{ padding: "0 18px", borderRadius: 10, border: "none", cursor: "pointer", color: "var(--accent-ink)", background: "var(--accent)", fontWeight: 800, fontSize: 13 }}>Send</button>
          </div>
        </div>
      )}
    </article>
  );
}

/* ========== Group Discussion Panel ========== */
function LabDiscussionPanel() {
  const F = window.FETS;
  const profileId = F._meId;
  const isAdmin = F.isAdmin || labCanAnnounce();
  const [convId, setConvId] = React.useState(null);
  const [messages, setMessages] = React.useState([]);
  const [draft, setDraft] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const threadRef = React.useRef(null);

  const initDiscussion = async () => {
    try {
      let { data: conv } = await supabase.from('conversations').select('id, name').eq('is_group', true).eq('name', 'Staff Discussion').maybeSingle();
      if (!conv) {
        const { data } = await supabase.from('conversations').insert({ name: 'Staff Discussion', is_group: true }).select('id, name').single();
        conv = data;
      }
      if (conv) {
        setConvId(conv.id);
        const { data: msgs } = await supabase.from('messages')
          .select('*, sender:staff_profiles(full_name)')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: true });
        setMessages(msgs || []);
      }
    } catch (e) {
      console.error("initDiscussion error:", e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    initDiscussion();
  }, []);

  React.useEffect(() => {
    if (!convId) return;
    const channel = supabase.channel(`lab_discussion:${convId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const { data: profileData } = await supabase.from('staff_profiles').select('full_name').eq('id', payload.new.sender_id).single();
            const newMsg = { ...payload.new, sender: profileData };
            setMessages(prev => {
              if (prev.some(m => m.id === payload.new.id)) return prev;
              return [...prev, newMsg];
            });
          } else if (payload.eventType === 'UPDATE') {
            setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(m => m.id !== payload.old.id));
          }
        })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [convId]);

  React.useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages.length]);

  const lastMsg = messages[messages.length - 1]?.content || "";
  const isLocked = lastMsg.startsWith("🚫 Discussion has been stopped");

  const send = async (textToSend?: string) => {
    const msgText = textToSend || draft.trim();
    if (!msgText || !profileId || !convId) return;
    if (!textToSend) setDraft("");
    
    try {
      await supabase.from('messages').insert({
        conversation_id: convId,
        sender_id: profileId,
        content: msgText,
        type: 'text'
      });
    } catch (err) {
      toast("Message failed to send", "alert");
    }
  };

  const toggleLock = () => {
    if (isLocked) {
      send("🔓 Discussion has been resumed by admin");
    } else {
      send("🚫 Discussion has been stopped by admin");
    }
  };

  return (
    <div className="glass" style={{ borderRadius: "var(--radius)", display: "flex", flexDirection: "column", overflow: "hidden", height: 340, border: "1px solid var(--hairline)" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "center", gap: 10, background: "var(--glass-2)" }}>
        <Icon name="message" size={16} style={{ color: "var(--accent)" }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Staff Discussion</span>
        {isAdmin && convId && (
          <button onClick={toggleLock} className="tap" style={{ marginLeft: "auto", fontSize: 9.5, fontWeight: 800, padding: "3px 8px", borderRadius: 6, border: "1px solid var(--hairline)", background: isLocked ? "var(--bad)" : "transparent", color: isLocked ? "#fff" : "var(--ink-3)" }}>
            {isLocked ? "Resume Chat" : "Stop Chat"}
          </button>
        )}
        <span style={{ fontSize: 10, color: "var(--ink-4)", marginLeft: !isAdmin ? "auto" : 0 }}>{messages.length} messages</span>
      </div>
      <div ref={threadRef} className="scroll-soft" style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "var(--ink-4)", fontSize: 13, padding: 20 }}>Loading messages…</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--ink-4)", fontSize: 13, padding: 30, fontStyle: "italic" }}>
            No messages yet. Start a discussion with the team!
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.sender_id === profileId;
            const senderName = isMe ? "You" : (m.sender?.full_name || "Admin");
            const isSystem = m.content.startsWith("🚫 Discussion has been stopped") || m.content.startsWith("🔓 Discussion has been resumed");
            const formattedTime = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            if (isSystem) {
              return (
                <div key={m.id} style={{ alignSelf: "center", margin: "6px 0", background: "var(--inset)", border: "1px solid var(--hairline)", padding: "4px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>{m.content}</span>
                </div>
              );
            }

            return (
              <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", gap: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 4px" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: isMe ? "var(--accent)" : "var(--ink-2)" }}>{senderName}</span>
                  <span className="mono" style={{ fontSize: 9, color: "var(--ink-4)" }}>{formattedTime}</span>
                </div>
                <div style={{ maxWidth: "85%", padding: "9px 13px", borderRadius: 12, fontSize: 12.5, lineHeight: 1.45,
                  borderTopRightRadius: isMe ? 3 : 12, borderTopLeftRadius: isMe ? 12 : 3,
                  color: isMe ? "var(--accent-ink)" : "var(--ink)", background: isMe ? "var(--accent)" : "var(--glass-2)",
                  border: isMe ? "none" : "1px solid var(--hairline)" }}>
                  {m.content}
                </div>
              </div>
            );
          })
        )}
      </div>
      <div style={{ borderTop: "1px solid var(--hairline)", padding: "10px 14px", flexShrink: 0, display: "flex", gap: 8, background: "var(--glass-2)", alignItems: "flex-end" }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={1}
          disabled={isLocked && !isAdmin}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={isLocked ? "Discussion has been stopped." : "Send a message…"}
          style={{ background: "var(--inset)", border: "1px solid var(--hairline)", borderRadius: 10, color: "var(--ink)",
            fontFamily: "var(--font)", fontSize: 13, padding: "9px 12px", width: "100%", outline: "none",
            resize: "none", lineHeight: 1.4, minHeight: 36, opacity: isLocked && !isAdmin ? 0.5 : 1 }}
        />
        <button onClick={() => send()} disabled={isLocked && !isAdmin} className="tap" style={{ width: 36, height: 36, borderRadius: 10, border: "none", cursor: (isLocked && !isAdmin) ? "not-allowed" : "pointer", flexShrink: 0,
          display: "grid", placeItems: "center", color: "var(--accent-ink)", background: "var(--accent)", opacity: isLocked && !isAdmin ? 0.5 : 1 }}>
          <Icon name="arrowR" size={16} stroke={2.4} />
        </button>
      </div>
    </div>
  );
}


/* ========== Staff Panel (with chat trigger) ========== */
function LabStaffPanel({ onChat }) {
  const F = window.FETS;
  const allStaff = React.useMemo(() => {
    const s = [];
    const meId = F._meId;
    ['calicut', 'cochin'].forEach(branch => {
      (F.STAFF?.[branch] || []).forEach(person => {
        if (typeof person === 'string') {
          if (person !== F.user?.name) s.push({ id: person, full_name: person, role: 'Staff', branch });
        } else if (person && person.id !== meId) {
          s.push({ ...person, branch });
        }
      });
    });
    (F.PEOPLE || []).forEach(name => {
      if (!s.find(x => x.full_name === name || x.name === name) && name !== F.user?.name) {
        s.push({ id: name, full_name: name, role: 'Staff', branch: 'unknown' });
      }
    });
    return s;
  }, [F]);

  const [filterBranch, setFilterBranch] = React.useState("all");
  const filtered = filterBranch === "all" ? allStaff : allStaff.filter(s => s.branch === filterBranch);

  return (
    <div className="glass" style={{ borderRadius: "var(--radius)", display: "flex", flexDirection: "column", overflow: "hidden", maxHeight: 300 }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--glass-2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="users" size={16} style={{ color: "var(--accent)" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Staff Online</span>
        </div>
        <div className="inset" style={{ display: "inline-flex", padding: 2, gap: 2, borderRadius: 999 }}>
          {["all", "calicut", "cochin"].map(b => {
            const on = filterBranch === b;
            return (
              <button key={b} onClick={() => setFilterBranch(b)} className="tap" style={{ border: "none", cursor: "pointer", padding: "4px 10px", borderRadius: 999,
                fontFamily: "var(--font)", fontSize: 10, fontWeight: on ? 750 : 550, color: on ? "#1c1305" : "var(--ink-3)", background: on ? "var(--accent)" : "transparent" }}>
                {b === "all" ? "All" : b === "calicut" ? "CLT" : "COK"}
              </button>
            );
          })}
        </div>
      </div>
      <div className="scroll-soft" style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--ink-4)", fontSize: 12.5, padding: 20, fontStyle: "italic" }}>No staff found.</div>
          ) : (
            filtered.map((staff, i) => (
              <div key={staff.id || i} onClick={() => onChat && onChat(staff)} className="tap" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, cursor: "pointer",
                border: "1px solid var(--hairline)", background: "var(--glass-2)" }}>
                <div style={{ position: "relative" }}>
                  <Avatar name={staff.full_name || staff.name} size={32} />
                  <span style={{ position: "absolute", bottom: 0, right: 0, width: 8, height: 8, borderRadius: 999, background: "var(--ok)", border: "2px solid var(--glass)" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{staff.full_name || staff.name}</div>
                  <div style={{ fontSize: 10, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{staff.role || "Staff"} · {staff.branch === "calicut" ? "Calicut" : staff.branch === "cochin" ? "Cochin" : "Unknown"}</div>
                </div>
                <button className="tap" style={{ width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer", display: "grid", placeItems: "center",
                  background: "var(--accent-soft)", color: "var(--accent)" }}>
                  <Icon name="message" size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ========== Main Lab Page ========== */
function TheLabPage({ branch }) {
  const canMod = labCanAnnounce();
  const [posts, setPosts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [text, setText] = React.useState("");
  const [attachments, setAttachments] = React.useState([]);
  const [image, setImage] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [fCenter, setFCenter] = React.useState("all");
  const [q, setQ] = React.useState("");
  const fileRef = React.useRef(null);
  const [chatTarget, setChatTarget] = React.useState(null);

  const reload = () => { LAB.labFetch().then((ps) => { setPosts(ps); setLoading(false); }); };
  React.useEffect(() => { reload(); LAB.labMarkRead(); }, []);

  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    setBusy(true);
    const up = await LAB.labUpload(f);
    setBusy(false);
    if (!up || !up.url) { toast("Upload failed", "alert"); return; }
    if ((f.type || "").startsWith("image/")) setImage(up.url);
    else setAttachments((a) => [...a, up]);
  };

  const submit = async () => {
    if (!text.trim() && !image && attachments.length === 0) return;
    setBusy(true);
    const created = await LAB.labCreate({ type: "handover", text: text.trim(), center: "all", exam: null, compliance: false, image, attachments });
    setBusy(false);
    if (created) setPosts((ps) => [created, ...ps]);
    else toast("Couldn't post — try again", "alert");
    setText(""); setAttachments([]); setImage(null);
  };

  const updatePost = (np) => setPosts((ps) => ps.map((x) => x.id === np.id ? np : x));
  const removePost = (p) => { if (!window.confirm("Delete this post?")) return; LAB.labDelete(p.id); setPosts((ps) => ps.filter((x) => x.id !== p.id)); };

  const match = (p) => (fCenter === "all" || p.center === fCenter || p.center === "all")
    && (!q.trim() || (p.text + " " + p.authorName).toLowerCase().includes(q.toLowerCase()));
  const shown = posts.filter(match);
  const pinned = shown.filter((p) => p.pinned);
  const rest = shown.filter((p) => !p.pinned);

  const inp = { background: "var(--inset)", border: "1px solid var(--hairline)", borderRadius: 10, color: "var(--ink)", fontFamily: "var(--font)", fontSize: 14, padding: "10px 12px" };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: "calc(18px * var(--density))" }}>
      <PageHeader eyebrow="Coordination wall // FETS" title="The Lab" />

      {/* Top bar: center filter + search */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Segmented value={fCenter} onChange={setFCenter} size="sm" options={LAB_CENTERS.map((c) => ({ value: c, label: c === "all" ? "All" : LAB_CLABEL[c] }))} />
        <div style={{ flex: 1, minWidth: 180, position: "relative" }}>
          <Icon name="search" size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--ink-4)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search handovers…" style={{ ...inp, width: "100%", paddingLeft: 32, fontSize: 13 }} />
        </div>
      </div>

      {/* 2-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20, alignItems: "start" }}>
        {/* Left: Composer + Feed */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Composer */}
          <div className="glass" style={{ borderRadius: "var(--radius)", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Write a handover note…" style={{ ...inp, resize: "vertical", lineHeight: 1.5, width: "100%" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => fileRef.current && fileRef.current.click()} className="tap glass-2" style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 36, padding: "0 12px", borderRadius: 10, cursor: "pointer", color: "var(--ink-2)", border: "1px solid var(--hairline)", fontFamily: "var(--font)", fontSize: 12.5, fontWeight: 650 }}><Icon name="camera" size={15} /> Attach</button>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={onFile} style={{ display: "none" }} />
              <select onChange={(e) => { if (e.target.value) { setText((tx) => tx + (tx && !tx.endsWith(" ") ? " " : "") + "@" + e.target.value + " "); e.target.value = ""; } }} defaultValue="" style={inp} title="Mention a teammate">
                <option value="">@ mention…</option>
                {(window.FETS.PEOPLE || [...(window.FETS.STAFF.calicut || []), ...(window.FETS.STAFF.cochin || [])]).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <div style={{ flex: 1 }} />
              <button onClick={submit} disabled={busy} className="tap" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 11, border: "none", cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1, fontFamily: "var(--font)", fontSize: 13, fontWeight: 750, color: "var(--accent-ink)", background: "var(--accent)" }}><Icon name="arrowR" size={16} /> Post</button>
            </div>
            {(image || attachments.length > 0) && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {image && <span className="inset" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 10px", borderRadius: 9, fontSize: 11.5, color: "var(--ink-2)" }}><Icon name="camera" size={13} /> image <button onClick={() => setImage(null)} style={{ border: "none", background: "transparent", color: "var(--bad)", cursor: "pointer" }}>×</button></span>}
                {attachments.map((a, i) => <span key={i} className="inset" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 10px", borderRadius: 9, fontSize: 11.5, color: "var(--ink-2)" }}>{a.name} <button onClick={() => setAttachments((x) => x.filter((_, j) => j !== i))} style={{ border: "none", background: "transparent", color: "var(--bad)", cursor: "pointer" }}>×</button></span>)}
              </div>
            )}
          </div>

          {/* Feed */}
          {loading ? <div className="glass" style={{ borderRadius: "var(--radius)", padding: 40, textAlign: "center", color: "var(--ink-4)" }}>Loading the wall…</div>
            : shown.length === 0 ? <div className="glass" style={{ borderRadius: "var(--radius)", padding: 40, textAlign: "center", color: "var(--ink-4)", fontSize: 14 }}>Nothing here yet — be the first to post.</div>
            : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {pinned.length > 0 && (
                  <React.Fragment>
                    <SectionLabel right={<Icon name="pin" size={13} style={{ color: "var(--accent)" }} />}>Pinned</SectionLabel>
                    {pinned.map((p) => <LabPostCard key={p.id} p={p} onChange={updatePost} onDelete={removePost} canMod={canMod} />)}
                    <SectionLabel>Latest</SectionLabel>
                  </React.Fragment>
                )}
                {rest.map((p) => <LabPostCard key={p.id} p={p} onChange={updatePost} onDelete={removePost} canMod={canMod} />)}
              </div>
            )}
        </div>

        {/* Right: Discussion + Staff */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 20 }}>
          <LabDiscussionPanel />
          <LabStaffPanel onChat={(staff) => setChatTarget(staff)} />
        </div>
      </div>

      {/* Chat popup */}
      {chatTarget && (
        <FetsChatPopup targetUser={chatTarget} onClose={() => setChatTarget(null)} zIndex={2000} />
      )}
    </div>
  );
}

/* ---------- tools sheet (overflow) ---------- */
function ToolsSheet({ open, onClose, onPick, includeNav }) {
  const isAdmin = !!window.FETS.isAdmin;
  const tools = isAdmin ? TOOLS : [];

  // If includeNav is true, render the sidebar drawer (ideal for mobile menu).
  if (includeNav) {
    const items = [...NAV.map((n) => ({ ...n, nav: true })), ...tools];
    return (
      <React.Fragment>
        <div className={`drawer-backdrop ${open ? "open" : ""}`} onClick={onClose} />
        <aside className={`drawer ${open ? "open" : ""}`} aria-hidden={!open} style={{ width: "min(420px, 92vw)" }}>
          <div className="drawer-grip" />
          <header style={{ display: "flex", alignItems: "center", gap: 13, padding: "18px 20px", borderBottom: "1px solid var(--hairline)", flexShrink: 0 }}>
            <div style={{ flex: 1 }}>
              <div className="eyebrow" style={{ color: "var(--accent)" }}>FETS · Live</div>
              <h2 style={{ margin: "3px 0 0", fontSize: 19, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--ink)" }}>All tools</h2>
            </div>
            <button onClick={onClose} className="tap glass-2" style={{ width: 36, height: 36, borderRadius: 999, display: "grid", placeItems: "center", cursor: "pointer", color: "var(--ink-2)" }}>
              <Icon name="x" size={17} />
            </button>
          </header>
          <div className="scroll-soft" style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((it) => (
              <button key={it.id} onClick={() => { onPick(it); onClose(); }} className="tap glass-2"
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 15px", borderRadius: 12, cursor: "pointer",
                  border: "1px solid var(--hairline)", textAlign: "left", fontFamily: "var(--font)" }}>
                <span style={{ width: 38, height: 38, borderRadius: 10, display: "grid", placeItems: "center", flexShrink: 0,
                  color: "var(--accent)", background: "var(--accent-soft)", border: "1px solid var(--accent-line)" }}>
                  <Icon name={it.nav ? "arrowR" : it.icon} size={18} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: "var(--ink)" }}>{it.label}</span>
                  {it.sub && <span style={{ display: "block", fontSize: 12, color: "var(--ink-3)", marginTop: 1 }}>{it.sub}</span>}
                </span>
                <Icon name="chevronR" size={16} style={{ color: "var(--ink-4)" }} />
              </button>
            ))}
          </div>
        </aside>
      </React.Fragment>
    );
  }

  // If includeNav is false, render the super premium grand pop-up modules console!
  const allModules = [
    ...NAV.map((n) => ({ 
      ...n, 
      icon: n.id === "live" ? "globe" : n.id === "calendar" ? "calendar" : n.id === "roster" ? "layers" : "briefcase", 
      nav: true,
      sub: n.id === "live" ? "Operations monitor & live queue" : n.id === "calendar" ? "Centre booking calendar & sessions" : n.id === "roster" ? "Shift schedules, time desk & metrics" : "Personal tasks, checklists & leave"
    })), 
    ...tools
  ];

  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCat, setSelectedCat] = React.useState("all");

  const nativeIds = ["live", "calendar", "roster", "desk", "attn-admin", "business", "staff-requests", "staff-ot"];

  const getModuleStatus = (it) => {
    if (nativeIds.includes(it.id)) {
      return { label: "Native React", color: "oklch(0.78 0.15 162)", isNative: true };
    } else {
      return { label: "Legacy Bridged", color: "oklch(0.86 0.16 92)", isNative: false };
    }
  };

  const filtered = allModules.filter(it => {
    const matchesSearch = it.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (it.sub && it.sub.toLowerCase().includes(searchQuery.toLowerCase()));
    const status = getModuleStatus(it);
    const matchesCategory = selectedCat === "all" || 
                            (selectedCat === "native" && status.isNative) ||
                            (selectedCat === "legacy" && !status.isNative);
    return matchesSearch && matchesCategory;
  });

  return (
    <React.Fragment>
      {/* Premium backdrop blur */}
      <div className={`fets-console-backdrop ${open ? "open" : ""}`} onClick={onClose} />
      
      <div className={`fets-console-modal ${open ? "open" : ""}`} aria-hidden={!open}>
        <style>{`
          .fets-console-backdrop {
            position: fixed;
            inset: 0;
            z-index: 1000;
            background: rgba(0, 0, 0, 0.45);
            backdrop-filter: blur(12px);
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .fets-console-backdrop.open {
            opacity: 1;
            pointer-events: auto;
          }

          .fets-console-modal {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -46%) scale(0.96);
            width: min(1040px, 95vw);
            height: min(720px, 86vh);
            z-index: 1001;
            background: linear-gradient(160deg, oklch(0.18 0.02 180) 0%, oklch(0.12 0.015 180) 100%);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 24px;
            box-shadow: 0 30px 90px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.08);
            display: flex;
            flex-direction: column;
            opacity: 0;
            pointer-events: none;
            overflow: hidden;
            transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .fets-console-modal.open {
            opacity: 1;
            pointer-events: auto;
            transform: translate(-50%, -50%) scale(1);
          }

          /* Ambient neon light inside the modal */
          .fets-console-glow {
            position: absolute;
            top: -200px;
            left: 20%;
            width: 600px;
            height: 400px;
            background: radial-gradient(circle, rgba(168, 255, 57, 0.05) 0%, rgba(0,0,0,0) 70%);
            pointer-events: none;
            z-index: 0;
          }

          .fets-module-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 16px;
            padding: 24px;
            overflow-y: auto;
            flex: 1;
          }

          .fets-module-card {
            position: relative;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.04);
            border-radius: 18px;
            padding: 20px;
            cursor: pointer;
            text-align: left;
            font-family: var(--font);
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-height: 154px;
            overflow: hidden;
          }
          .fets-module-card::before {
            content: "";
            position: absolute;
            inset: 0;
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, transparent 100%);
            opacity: 0;
            transition: opacity 0.3s ease;
          }
          .fets-module-card:hover {
            transform: translateY(-4px);
            background: rgba(255, 255, 255, 0.05);
            border-color: rgba(168, 255, 57, 0.2);
            box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3), 0 0 1px 1px rgba(168, 255, 57, 0.15);
          }
          .fets-module-card:hover::before {
            opacity: 1;
          }
          
          .fets-module-card-icon {
            width: 44px;
            height: 44px;
            border-radius: 12px;
            display: grid;
            place-items: center;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.08);
            color: var(--ink-2);
            transition: all 0.3s ease;
          }
          .fets-module-card:hover .fets-module-card-icon {
            background: rgba(168, 255, 57, 0.12);
            border-color: rgba(168, 255, 57, 0.3);
            color: #a8ff39;
            box-shadow: 0 0 15px rgba(168, 255, 57, 0.25);
          }

          .fets-cat-tab {
            font-size: 13px;
            font-weight: 700;
            color: var(--ink-3);
            background: transparent;
            border: none;
            padding: 8px 16px;
            border-radius: 99px;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .fets-cat-tab:hover {
            color: var(--ink);
            background: rgba(255, 255, 255, 0.04);
          }
          .fets-cat-tab.active {
            color: #000;
            background: #a8ff39;
          }
        `}</style>
        
        <div className="fets-console-glow" />

        {/* Console Header */}
        <header style={{ 
          display: "flex", 
          flexDirection: "column",
          gap: 16,
          padding: "24px 28px", 
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)", 
          position: "relative",
          zIndex: 1,
          flexShrink: 0 
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div className="eyebrow" style={{ color: "#a8ff39", letterSpacing: "2px" }}>OPERATIONS CONSOLE</div>
              <h2 style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 900, letterSpacing: "-0.02em", color: "var(--ink)" }}>All Modules</h2>
            </div>
            <button onClick={onClose} className="tap" style={{ 
              width: 40, 
              height: 40, 
              borderRadius: "50%", 
              display: "grid", 
              placeItems: "center", 
              cursor: "pointer", 
              border: "1px solid rgba(255, 255, 255, 0.1)",
              background: "rgba(255,255,255,0.03)", 
              color: "var(--ink-2)",
              transition: "all 0.2s"
            }}>
              <Icon name="x" size={20} />
            </button>
          </div>

          {/* Filters and Search Bar */}
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            {/* Category selection */}
            <div style={{ 
              display: "flex", 
              background: "rgba(0,0,0,0.2)", 
              padding: 4, 
              borderRadius: 99, 
              border: "1px solid rgba(255, 255, 255, 0.04)" 
            }}>
              <button 
                onClick={() => setSelectedCat("all")}
                className={`fets-cat-tab ${selectedCat === "all" ? "active" : ""}`}
              >
                All Modules
              </button>
              <button 
                onClick={() => setSelectedCat("native")}
                className={`fets-cat-tab ${selectedCat === "native" ? "active" : ""}`}
              >
                Native React
              </button>
              <button 
                onClick={() => setSelectedCat("legacy")}
                className={`fets-cat-tab ${selectedCat === "legacy" ? "active" : ""}`}
              >
                Legacy Bridged
              </button>
            </div>

            {/* Search Input */}
            <div style={{ flex: 1, minWidth: 260, position: "relative" }}>
              <Icon name="search" size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--ink-4)" }} />
              <input 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                placeholder="Search operations, analytics, settings..." 
                style={{ 
                  background: "rgba(0, 0, 0, 0.2)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 99,
                  color: "var(--ink)",
                  fontFamily: "var(--font)",
                  fontSize: 14,
                  padding: "10px 14px 10px 42px",
                  width: "100%",
                  outline: "none"
                }} 
              />
            </div>
          </div>
        </header>

        {/* Modules Grid */}
        <div className="scroll-soft fets-module-grid">
          {filtered.length === 0 ? (
            <div style={{ gridColumn: "1 / -1", padding: 60, textAlign: "center", color: "var(--ink-4)", fontSize: 15 }}>
              No modules match your query. Try searching for something else.
            </div>
          ) : (
            filtered.map((it) => {
              const status = getModuleStatus(it);
              return (
                <button 
                  key={it.id} 
                  onClick={() => { onPick(it); onClose(); }} 
                  className="fets-module-card"
                  style={{ border: "1px solid rgba(255, 255, 255, 0.04)" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
                    <div className="fets-module-card-icon">
                      <Icon name={it.icon} size={20} />
                    </div>
                    {/* Status badge */}
                    <span style={{ 
                      fontSize: 10, 
                      fontWeight: 800, 
                      textTransform: "uppercase", 
                      letterSpacing: "0.5px",
                      padding: "4px 10px", 
                      borderRadius: 999, 
                      color: status.color, 
                      background: `color-mix(in oklch, ${status.color} 12%, transparent)`, 
                      border: `1px solid color-mix(in oklch, ${status.color} 24%, transparent)`
                    }}>
                      {status.label}
                    </span>
                  </div>

                  <div style={{ marginTop: 24, zIndex: 1 }}>
                    <h3 style={{ fontSize: 16.5, fontWeight: 800, color: "var(--ink)", margin: 0 }}>
                      {it.label}
                    </h3>
                    <p style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 6, lineHeight: 1.4, marginBlockEnd: 0 }}>
                      {it.sub}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <footer style={{ 
          padding: "16px 28px", 
          borderTop: "1px solid rgba(255, 255, 255, 0.06)", 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          background: "rgba(0, 0, 0, 0.15)",
          flexShrink: 0,
          zIndex: 1
        }}>
          <span style={{ fontSize: 12.5, color: "var(--ink-4)" }}>
            Showing {filtered.length} of {allModules.length} modules
          </span>
          <span style={{ fontSize: 12.5, color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#a8ff39", boxShadow: "0 0 8px #a8ff39" }} />
            FETS · LIVE Ops Console
          </span>
        </footer>
      </div>
    </React.Fragment>
  );
}

function AccentSwatches({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 9, padding: "4px 2px 8px" }}>
      {ACCENTS.map((a) => {
        const sel = a.key === value;
        return (
          <button key={a.key} title={a.key} onClick={() => onChange(a.key)} className="tap"
            style={{ width: 34, height: 34, borderRadius: 10, cursor: "pointer", background: a.color,
              border: sel ? "2px solid var(--ink)" : "2px solid transparent",
              outline: sel ? "2px solid var(--glass-strong)" : "none", outlineOffset: -4 }} />
        );
      })}
    </div>
  );
}

function App({ bridge, onLogout }) {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [branch, setBranch] = React.useState(() => {
    const base = window.FETS?._meBaseBranch || "calicut";
    return base === "global" ? "global" : base;
  });
  const [drawer, setDrawer] = React.useState(null);  // 'outlook' | 'vault' | 'help'
  const [tools, setTools] = React.useState(false);
  const [burger, setBurger] = React.useState(false);
  const [active, setActive] = React.useState("live");
  const [pendingHandoverBadge, setPendingHandoverBadge] = React.useState(0);

  React.useEffect(() => {
    const r = document.getElementById("fets-redesign-root") || document.documentElement;
    r.setAttribute("data-theme", t.dark ? "dark" : "light");
    const acc = (ACCENTS.find((a) => a.key === t.accent) || ACCENTS[0]).color;
    r.style.setProperty("--accent", acc);
    r.style.setProperty("--density", DENSITY_VAL[t.density] ?? 1);
  }, [t]);

  // Pending handover badge for top nav
  React.useEffect(() => {
    const refresh = () => {
      const name = window.FETS?.user?.name;
      if (name) DB.dbCountPendingHandovers(name).then(setPendingHandoverBadge);
    };
    refresh();
    window.addEventListener("fets-handover-pending", refresh);
    return () => window.removeEventListener("fets-handover-pending", refresh);
  }, []);

  React.useEffect(() => {
    const channel = supabase.channel("realtime-claims-requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "staff_ot_claims" },
        async (payload) => {
          console.log("Realtime: staff_ot_claims changed", payload);
          await loadOtClaims(window.FETS);
          window.dispatchEvent(new Event("fets-roster-changed"));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leave_requests" },
        async (payload) => {
          console.log("Realtime: leave_requests changed", payload);
          await loadLeaveRequests(window.FETS);
          window.dispatchEvent(new Event("fets-roster-changed"));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "roster_discussions" },
        async (payload) => {
          console.log("Realtime: roster_discussions changed", payload);
          window.dispatchEvent(new Event("fets-discussion-changed"));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);



  const handlePick = (it) => {
    if (it.nav) { setActive(it.id); return; }
    if (["business", "attn-admin", "staff-requests", "staff-ot"].includes(it.id)) { setActive(it.id); return; }
    if (it.id === "vault") { setDrawer("vault"); return; }
    if (it.legacy && bridge) { bridge(it.id); return; }
    toast(it.label, "arrowR");
  };
  const onNavigate = (n) => setActive(n.id);
  const V = window.VENDOR_BY_SLUG;
  const branchLabel = branch === "global" ? "All centres" : branch.charAt(0).toUpperCase() + branch.slice(1);

  return (
    <div style={{ position: "relative", zIndex: 2, height: "100%", display: "flex", flexDirection: "column", "--branch": BRANCH_TINT[branch] || "var(--accent)" }}>
      <TopNav active={active} onNavigate={onNavigate} branch={branch} setBranch={setBranch}
        t={t} setTweak={setTweak} onTools={() => setTools(true)} onBurger={() => setBurger(true)} onLogout={onLogout}
        pendingHandoverBadge={pendingHandoverBadge} />

      <main className="scroll-soft main-scroll" style={{
        flex: 1,
        overflowY: "auto",
        padding: active === "handover" ? "0 0 80px" : "clamp(22px,3.2vw,40px) clamp(14px,3vw,30px) 80px"
      }}>
        {active === "live" && <LivePage branch={branch} setDrawer={setDrawer} setActive={setActive} bridge={bridge} />}
        {active === "calendar" && <CalendarPage branch={branch} />}
        {active === "roster" && <RosterPage branch={branch} />}
        {active === "case" && <RaiseCasePage branch={branch} setActive={setActive} />}
        {active === "handover" && <ShiftHandoverPage branch={branch} setActive={setActive} />}
        {active === "desk" && <MyDeskPage branch={branch} setActive={setActive} setDrawer={setDrawer} />}
        {active === "business" && <BusinessPage branch={branch} />}
        {active === "news" && <TheLabPage branch={branch} />}
        {active === "attn-admin" && <AttendanceAdminPage branch={branch} />}
        {active === "staff-requests" && <RosterApprovalsHub branch={branch} />}
        {active === "staff-ot" && <OtToilClaimsHub branch={branch} />}
      </main>

      {/* drawers */}
      <Drawer open={drawer === "outlook"} onClose={() => setDrawer(null)}
        icon="calendar" title="Next 7 Days" sub={`${branchLabel} · candidates by client`}>
        <OutlookMiniPanel branch={branch} />
      </Drawer>
      <Drawer open={drawer === "vault"} onClose={() => setDrawer(null)}
        icon="key" title="Quick Access Vault" sub="Credentials, portals & site codes by vendor" accentColor={V.prometric.color}>
        <VaultPanel />
      </Drawer>
      <Drawer open={drawer === "help"} onClose={() => setDrawer(null)}
        icon="headset" title="Help Desk" sub="Live support portals" accentColor={V.cma.color}>
        <HelpDeskPanel />
      </Drawer>
      <Drawer open={drawer === "lostfound"} onClose={() => setDrawer(null)}
        icon="package" title="Lost & Found" sub={`${branchLabel} · items handed in & logged`} accentColor={V.ielts.color}>
        <LostFoundPanel branch={branch} />
      </Drawer>

      <ToolsSheet open={tools} onClose={() => setTools(false)} onPick={handlePick} />
      <ToolsSheet open={burger} onClose={() => setBurger(false)} onPick={handlePick} includeNav />

      <TweaksPanel>
        <TweakSection label="Appearance" />
        <TweakToggle label="Dark mode" value={t.dark} onChange={(v) => setTweak("dark", v)} />
        <TweakRow label="Accent"><AccentSwatches value={t.accent} onChange={(v) => setTweak("accent", v)} /></TweakRow>
        <TweakSection label="Layout" />
        <TweakRadio label="Density" value={t.density} options={["compact", "regular", "spacious"]} onChange={(v) => setTweak("density", v)} />
      </TweaksPanel>

      <ToastHost />
    </div>
  );
}

function RedesignShell({ bridge, userName, userEmail, isAdmin, onLogout }) {
  // Identity + access from the real authenticated profile (replaces mock user)
  if (window.FETS) {
    if (userName) window.FETS.user = { ...window.FETS.user, name: userName, email: userEmail || "", role: isAdmin ? "Super Admin" : "Staff" };
    window.FETS.isAdmin = !!isAdmin;
  }
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let mounted = true;
    Promise.resolve(loadLiveData(window.FETS)).catch(() => {}).finally(() => { if (mounted) setReady(true); });
    return () => { mounted = false; document.body.style.overflow = prev; };
  }, []);
  return (
    <div id="fets-redesign-root" className="fets-redesign-root" data-theme="dark"
      style={{ position: "fixed", inset: 0, zIndex: 1, height: "100%", overflow: "hidden" }}>
      <div className="wallpaper" />
      <div className="grain" />
      <div style={{ position: "relative", zIndex: 2, height: "100%" }}>
        {ready ? <App bridge={bridge} onLogout={onLogout} /> : (
          <div style={{ height: "100%", display: "grid", placeItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <span style={{ width: 54, height: 54, borderRadius: 14, display: "grid", placeItems: "center", background: "var(--accent)", color: "var(--accent-ink)", fontWeight: 900, fontSize: 30, fontFamily: '"Archivo Expanded", var(--font)' }}>F</span>
              <span className="eyebrow" style={{ color: "var(--ink-3)" }}>Loading FETS · LIVE…</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RedesignShell;

