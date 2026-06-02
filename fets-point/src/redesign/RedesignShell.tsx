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
import { loadLiveData } from "./live-data";
import * as DB from "./write-data";

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
    calicut: ["Mithun Raj", "Niyas K", "Sandra Thomas", "Fathima R", "Arjun Menon", "Sneha P", "Vishnu Das"],
    cochin:  ["Rahul Nair", "Anjana S", "Ashik M", "Divya Krishnan", "Tom Varghese", "Meera B"],
  };

  // helper to make a session
  const S = (vendor, exam, count, start, end, branch) => ({
    vendor, exam, count, start, end, branch,
  });

  // ---- 7 days of exam sessions, keyed by day offset (0 = today) ----
  // each branch gets its own list; "global" = both
  const SCHEDULE = {
    0: [ // today
      S("prometric", "CMA Part 1 · Financial Planning", 14, "08:30", "12:30", "calicut"),
      S("pearson",   "NCLEX-RN", 9, "09:00", "15:00", "calicut"),
      S("psi",       "GRE General", 6, "10:00", "13:45", "cochin"),
      S("ielts",     "IELTS Academic", 22, "08:00", "11:30", "cochin"),
      S("celpip",    "CELPIP General", 8, "13:00", "16:00", "calicut"),
    ],
    1: [
      S("prometric", "ABIM Internal Medicine", 5, "08:30", "17:00", "calicut"),
      S("pearson",   "AWS Solutions Architect", 11, "09:30", "13:00", "cochin"),
      S("cma",       "CMA US Part 2", 7, "09:00", "13:00", "calicut"),
    ],
    2: [
      S("ielts",     "IELTS General Training", 18, "08:00", "11:30", "cochin"),
      S("psi",       "Real Estate License", 4, "10:00", "12:30", "calicut"),
      S("pearson",   "Microsoft AZ-900", 8, "11:00", "14:00", "cochin"),
    ],
    3: [
      S("prometric", "NBCOT · Occupational Therapy", 6, "08:30", "13:30", "calicut"),
      S("celpip",    "CELPIP General LS", 5, "13:00", "15:00", "cochin"),
    ],
    4: [
      S("pearson",   "CompTIA Security+", 10, "09:00", "12:30", "calicut"),
      S("cma",       "CMA US Part 1", 9, "09:00", "13:00", "cochin"),
      S("ielts",     "IELTS Academic", 20, "08:00", "11:30", "calicut"),
    ],
    5: [
      S("psi",       "PMP Certification", 7, "10:00", "14:00", "cochin"),
    ],
    6: [
      S("prometric", "USMLE Step 1", 4, "08:00", "16:00", "calicut"),
      S("pearson",   "NCLEX-PN", 6, "09:00", "14:00", "cochin"),
      S("ielts",     "IELTS Academic", 16, "08:00", "11:30", "cochin"),
    ],
  };

  // roster staff per day (subset rostered)
  const ROSTER = {
    0: { calicut: ["Niyas K", "Sandra Thomas", "Fathima R"], cochin: ["Rahul Nair", "Anjana S"] },
    1: { calicut: ["Arjun Menon", "Sneha P"], cochin: ["Ashik M", "Divya Krishnan", "Tom Varghese"] },
    2: { calicut: ["Niyas K", "Vishnu Das"], cochin: ["Anjana S", "Meera B"] },
    3: { calicut: ["Sandra Thomas", "Fathima R"], cochin: ["Rahul Nair"] },
    4: { calicut: ["Niyas K", "Arjun Menon", "Sneha P"], cochin: ["Ashik M", "Tom Varghese"] },
    5: { calicut: ["Vishnu Das"], cochin: ["Divya Krishnan", "Meera B"] },
    6: { calicut: ["Sandra Thomas", "Niyas K"], cochin: ["Rahul Nair", "Anjana S"] },
  };

  // ---- pending requests (manager view) ----
  const REQUESTS = [
    { id: 1, type: "leave", who: "Sneha P", branch: "calicut", date: ISO(3), reason: "Sister's wedding — need the full day off." },
    { id: 2, type: "swap", who: "Ashik M", with: "Tom Varghese", branch: "cochin", date: ISO(2), reason: "Doctor's appointment in the morning slot." },
    { id: 3, type: "leave", who: "Vishnu Das", branch: "calicut", date: ISO(5), reason: "Personal." },
    { id: 4, type: "leave", who: "Anjana S", branch: "cochin", date: ISO(8), reason: "Family function out of town, returning the next morning." },
    { id: 5, type: "swap", who: "Fathima R", with: "Arjun Menon", branch: "calicut", date: ISO(11), reason: "Prefer the afternoon IELTS slot that week." },
    { id: 6, type: "leave", who: "Tom Varghese", branch: "cochin", date: ISO(15), reason: "Medical check-up, half day." },
  ];

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
    const wd = d.getDay(), r = rngFor(d, 1);
    let n = wd === 0 ? Math.floor(r() * 2) : wd === 6 ? 1 + Math.floor(r() * 2) : 2 + Math.floor(r() * 3);
    const out = [];
    for (let i = 0; i < n; i++) {
      const vendor = VSLUGS[Math.floor(r() * VSLUGS.length)];
      const exam = EXAM_POOL[vendor][Math.floor(r() * EXAM_POOL[vendor].length)];
      const count = 3 + Math.floor(r() * 20);
      const start = START_TIMES[Math.floor(r() * START_TIMES.length)];
      const branch = r() < 0.5 ? "calicut" : "cochin";
      out.push(S(vendor, exam, count, start, addH(start, 3), branch));
    }
    return out.sort((a, b) => a.start.localeCompare(b.start));
  }
  function pickK(arr, k, r) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, k);
  }
  function genRoster(d) {
    const r = rngFor(d, 2);
    const c = 2 + Math.floor(r() * 3), k = 1 + Math.floor(r() * 3);
    return { calicut: pickK(STAFF.calicut, c, r), cochin: pickK(STAFF.cochin, k, r) };
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
  const CASES = [
    { id: "FC-2048", subject: "Prometric workstation #4 won't boot", category: "Technical", priority: "Urgent", branch: "calicut", vendor: "prometric", status: "open", assignee: "Mithun Raj", opened: "Today · 09:12", age: "2h",
      detail: "Workstation #4 in Hall A shows a black screen on power-up. First candidate is at 10:00. Tried a hard reset twice, no POST beep.",
      contact: { name: "Niyas K", role: "On-duty lead", phone: "+91 98470 11234", email: "niyas@fets.live", external: false },
      thread: [
        { id: "m1", kind: "msg", author: "Mithun Raj", role: "staff", text: "Logged this — workstation #4 won't POST. Pulled it from the seating plan for now.", when: "09:12" },
        { id: "m2", kind: "status", author: "Mithun Raj", role: "system", text: "marked the case In progress", when: "09:18" },
        { id: "m3", kind: "msg", author: "Prometric Support", role: "external", text: "Hi, this is Rakesh from Prometric L2. Please share the asset tag and try booting from the recovery USB.", when: "09:34", contact: "+1 800 853 6769" },
        { id: "m4", kind: "msg", author: "Mithun Raj", role: "staff", text: "Asset tag PRM-CLT-0044. Recovery USB gives the same black screen — looks like a PSU fault.", when: "09:41" },
      ] },
    { id: "FC-2047", subject: "Candidate ID mismatch — IELTS morning slot", category: "Candidate", priority: "High", branch: "cochin", vendor: "ielts", status: "progress", assignee: "Anjana S", opened: "Today · 08:40", age: "3h",
      detail: "Candidate's passport name doesn't match the booking spelling. Holding check-in until verified with the vendor.",
      contact: { name: "Aiswarya Nair", role: "Candidate", phone: "+91 99461 88210", email: "aiswarya.n@gmail.com", external: true },
      thread: [
        { id: "m1", kind: "msg", author: "Anjana S", role: "staff", text: "Name on passport reads 'Aiswariya', booking says 'Aiswarya'. Asked candidate to wait.", when: "08:40" },
        { id: "m2", kind: "msg", author: "Aiswarya Nair", role: "external", text: "The booking portal dropped the extra 'i'. I have my booking confirmation email as proof.", when: "08:52", contact: "+91 99461 88210" },
        { id: "m3", kind: "status", author: "Anjana S", role: "system", text: "marked the case In progress", when: "08:55" },
      ] },
    { id: "FC-2046", subject: "AC unit noisy in Hall B during exam", category: "Facility", priority: "Medium", branch: "calicut", vendor: null, status: "open", assignee: "Mithun Raj", opened: "Today · 07:55", age: "4h",
      detail: "Rattling noise from the Hall B split unit. Distracting for candidates seated in the back row.",
      contact: null,
      thread: [
        { id: "m1", kind: "msg", author: "Fathima R", role: "staff", text: "Reported by two candidates yesterday too. Raising before today's afternoon slot.", when: "07:55" },
      ] },
    { id: "FC-2044", subject: "Pearson VUE check-in scanner intermittent", category: "Technical", priority: "High", branch: "cochin", vendor: "pearson", status: "progress", assignee: "Ashik M", opened: "Yesterday · 16:20", age: "19h",
      detail: "Palm-vein scanner at desk 2 fails roughly 1 in 4 scans. Slows the check-in queue.",
      contact: { name: "Pearson VUE Helpdesk", role: "Vendor support", phone: "1800 209 0469", email: "support@pearsonvue.com", external: true },
      thread: [
        { id: "m1", kind: "msg", author: "Ashik M", role: "staff", text: "Scanner at desk 2 intermittent. Swapped USB port, no change.", when: "Yesterday 16:20" },
        { id: "m2", kind: "msg", author: "Pearson VUE Helpdesk", role: "external", text: "Please run the diagnostic from VUE Connect → Devices and send the log ID.", when: "Yesterday 17:02", contact: "1800 209 0469" },
        { id: "m3", kind: "status", author: "Ashik M", role: "system", text: "marked the case In progress", when: "Yesterday 17:05" },
      ] },
    { id: "FC-2041", subject: "Lost & found — laptop charger handed in", category: "Lost & Found", priority: "Low", branch: "calicut", vendor: null, status: "resolved", assignee: "Fathima R", opened: "2 days ago", age: "2d",
      detail: "65W USB-C charger found in the waiting area. Logged and stored at the front desk.",
      contact: { name: "Arun P", role: "Owner (candidate)", phone: "+91 90370 55120", email: "", external: true },
      thread: [
        { id: "m1", kind: "msg", author: "Fathima R", role: "staff", text: "Charger handed in after the morning slot. Stored in locker LF-12.", when: "2 days ago" },
        { id: "m2", kind: "msg", author: "Arun P", role: "external", text: "That's mine — I'll collect it tomorrow afternoon. Thank you!", when: "1 day ago", contact: "+91 90370 55120" },
        { id: "m3", kind: "status", author: "Fathima R", role: "system", text: "marked the case Resolved", when: "1 day ago" },
      ] },
    { id: "FC-2039", subject: "CMA candidate requested accommodation setup", category: "Candidate", priority: "Medium", branch: "calicut", vendor: "cma", status: "resolved", assignee: "Niyas K", opened: "3 days ago", age: "3d",
      detail: "Approved extra-time accommodation for a CMA candidate. Needed an isolated room and a separate proctor.",
      contact: { name: "Sneha Varma", role: "Candidate", phone: "+91 98951 33027", email: "sneha.v@gmail.com", external: true },
      thread: [
        { id: "m1", kind: "msg", author: "Niyas K", role: "staff", text: "Accommodation letter verified. Setting up room 3 with a dedicated proctor.", when: "3 days ago" },
        { id: "m2", kind: "status", author: "Niyas K", role: "system", text: "marked the case Resolved", when: "2 days ago" },
      ] },
    { id: "FC-2036", subject: "Network drop during PSI session", category: "Technical", priority: "Urgent", branch: "cochin", vendor: "psi", status: "resolved", assignee: "Ashik M", opened: "4 days ago", age: "4d",
      detail: "ISP outage interrupted a live PSI session for 6 minutes. Failover to 4G restored connectivity.",
      contact: null,
      thread: [
        { id: "m1", kind: "msg", author: "Ashik M", role: "staff", text: "Primary link dropped mid-session. Switched to 4G failover.", when: "4 days ago" },
        { id: "m2", kind: "status", author: "Ashik M", role: "system", text: "marked the case Resolved", when: "4 days ago" },
      ] },
  ];
  const CASE_CATEGORIES = ["Technical", "Candidate", "Facility", "Vendor", "Security", "Lost & Found"];
  const CASE_PRIORITIES = ["Low", "Medium", "High", "Urgent"];
  const CASE_CAT_ICON = { Technical: "settings", Candidate: "user", Facility: "package", Vendor: "briefcase", Security: "shield", "Lost & Found": "package" };

  /* ---- activity feed (My Desk) ---- */
  const ACTIVITY = [
    { icon: "check",    text: "You approved Sandra Thomas's shift swap", when: "12m ago", tone: "ok" },
    { icon: "alert",    text: "Case FC-2048 escalated to Urgent · Calicut", when: "1h ago", tone: "bad" },
    { icon: "key",      text: "Vault credential updated · Pearson VUE", when: "1h ago", tone: "accent" },
    { icon: "star",     text: "New 5★ Google review from Aiswarya Nair", when: "4h ago", tone: "accent" },
    { icon: "calendar", text: "Roster published for the week of Jun 8", when: "Yesterday", tone: "ink" },
    { icon: "users",    text: "Niyas K clocked in at Calicut", when: "Yesterday", tone: "ink" },
  ];

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
  const DESK_TASKS = [
    { id: "t1", title: "Check biometric device before 8:30 AM", source: "Supervisor", by: "Niyas K", due: "Today · 08:30", priority: "Critical", status: "In Progress", comment: "Make sure firmware is updated before the first slot.", proof: false },
    { id: "t2", title: "Verify lockers are empty", source: "Supervisor", by: "Niyas K", due: "Today · 09:00", priority: "High", status: "Pending", comment: "", proof: false },
    { id: "t3", title: "Upload exam day photos", source: "Supervisor", by: "Sandra Thomas", due: "Today · 18:00", priority: "Medium", status: "Pending", comment: "Lab, signage and candidate waiting area.", proof: true },
    { id: "t6", title: "Submit weekly incident summary", source: "Supervisor", by: "Niyas K", due: "Jun 6 · 17:00", priority: "Medium", status: "Pending", comment: "Use the new template shared on Friday.", proof: false },
    { id: "t4", title: "Complete Prometric certification", source: "Self", by: "You", due: "Jun 6", priority: "High", status: "Pending", comment: "" },
    { id: "t5", title: "Update candidate register", source: "Self", by: "You", due: "Today · 17:30", priority: "Low", status: "Completed", comment: "" },
    { id: "t7", title: "Tidy the F-Vault credentials list", source: "Self", by: "You", due: "This week", priority: "Low", status: "Pending", comment: "" },
  ];
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
  const MY_LEAVE = [
    { id: "l1", type: "Casual leave", date: "Jun 9, 2026", status: "Approved", comment: "Approved — enjoy the day." },
    { id: "l2", type: "Late arrival", date: "Jun 2, 2026", status: "Submitted", comment: "" },
    { id: "l3", type: "Half day", date: "Jun 4, 2026", status: "Need clarification", comment: "Morning or afternoon half?" },
  ];

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
  const STAFF_REQ_SEED = [
    { id: "r1", kind: "leave", who: "Mithun Raj", branch: "calicut", leaveType: "Full-day leave", date: "Jun 12, 2026", reason: "Family function out of town.", status: "Submitted" },
    { id: "r2", kind: "swap", who: "Mithun Raj", with: "Niyas K", branch: "calicut", date: "Jun 9, 2026", reason: "Need the morning for a dentist appointment.", status: "Approved" },
    { id: "r5", kind: "toil", who: "Mithun Raj", branch: "calicut", days: 1, date: "Jun 18, 2026", reason: "Long weekend with family.", status: "Submitted" },
    { id: "r3", kind: "leave", who: "Sandra Thomas", branch: "calicut", leaveType: "Half day", date: "Jun 7, 2026", reason: "School event — afternoon half.", status: "Submitted" },
    { id: "r4", kind: "swap", who: "Anjana S", with: "Ashik M", branch: "cochin", date: "Jun 10, 2026", reason: "Prefer the IELTS slot that day.", status: "Submitted" },
  ];

  // one-time seed of roster overrides for the signed-in user so OT / TOIL show
  if (localStorage.getItem(RKEY) === null) {
    localStorage.setItem(RKEY, JSON.stringify({
      "Mithun Raj": { 1: { code: "D", ot: 3 }, 4: { code: "D", ot: 2.5 }, 6: { code: "TOIL", ot: 0 }, 9: { code: "TOIL", ot: 0 }, 12: { code: "L", ot: 0 } },
    }));
  }

  window.FETS = {
    ISO, VENDORS, STAFF, SCHEDULE, ROSTER, REQUESTS, VAULT,
    sessionsOn, rosterOn, offsetOf, stripT,
    CASES, CASE_CATEGORIES, CASE_PRIORITIES, CASE_CAT_ICON, ACTIVITY,
    DESK_TASKS, TASK_PRIORITIES, TASK_STATUSES, CHECKLIST, CERTS,
    LEAVE_BALANCE, LEAVE_TYPES, MY_LEAVE, PERFORMANCE,
    rosterGet, rosterSet, rosterTotals, staffReqList, staffReqAdd, staffReqResolve,
    workLogList, workLogUpsert, workLogTotals, wlKey, wlLabel,
    user: { name: "Mithun Raj", role: "Super Admin", day: 412,
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
function Segmented({ options, value, onChange, size = "md", activeColor }) {
  const pad = size === "sm" ? "5px 11px" : "8px 16px";
  const fs = size === "sm" ? 12 : 13;
  return (
    <div className="inset" style={{ display: "inline-flex", padding: 3, gap: 2, borderRadius: 999 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)} className="tap"
            style={{
              border: "none", cursor: "pointer", padding: pad, fontSize: fs,
              fontWeight: active ? 650 : 550, letterSpacing: "-0.01em", borderRadius: 999,
              fontFamily: "var(--font)", display: "inline-flex", alignItems: "center", gap: 6,
              color: active ? (activeColor || "var(--ink)") : "var(--ink-3)",
              background: active ? (activeColor ? `color-mix(in oklch, ${activeColor} 22%, var(--glass-strong))` : "var(--glass-strong)") : "transparent",
              boxShadow: active ? "var(--shadow)" : "none",
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

function VaultPanel() {
  const vendors = window.FETS.VENDORS;
  const [active, setActive] = React.useState("prometric");
  const rows = window.FETS.VAULT[active] || [];
  const portal = rows.find((r) => r.type === "url");
  const creds = rows.filter((r) => r.type !== "url");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* vendor chips */}
      <div className="scroll-soft no-scrollbar" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
        {vendors.map((vn) => {
          const isA = vn.slug === active;
          return (
            <button key={vn.slug} onClick={() => setActive(vn.slug)} className="tap"
              style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 12, cursor: "pointer", fontFamily: "var(--font)",
                border: `1px solid ${isA ? "var(--accent-line)" : "var(--hairline)"}`,
                background: isA ? "var(--accent-soft)" : "var(--inset)" }}>
              <span style={{ width: 24, height: 24, borderRadius: 7, display: "grid", placeItems: "center", fontSize: 9, fontWeight: 800, color: "#fff", background: vn.color }}>{vn.short}</span>
              <span style={{ fontSize: 12.5, fontWeight: isA ? 650 : 550, color: isA ? "var(--ink)" : "var(--ink-3)" }}>{vn.name}</span>
            </button>
          );
        })}
      </div>
      {/* one-tap portal launch */}
      {portal && (
        <a href={portal.value} target="_blank" rel="noopener noreferrer" className="tap" style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 14, textDecoration: "none", color: "var(--accent-ink)", background: "var(--accent)", fontWeight: 750 }}>
          <Icon name="ext" size={18} /> <span style={{ flex: 1, fontSize: 14 }}>Open {VENDOR_BY_SLUG[active].name} portal</span> <Icon name="arrowR" size={16} />
        </a>
      )}
      {/* credentials — label + value + one-tap copy */}
      <SectionLabel>Credentials</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {creds.map((r, i) => <VaultRow key={active + i} row={r} />)}
        <button onClick={() => toast("Add entry", "plus")} className="tap inset"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", borderRadius: 14, cursor: "pointer", color: "var(--ink-3)", fontFamily: "var(--font)", fontSize: 12.5, fontWeight: 600, borderStyle: "dashed" }}>
          <Icon name="plus" size={15} /> Add credential
        </button>
      </div>
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

/* ---------- lost & found drawer panel (moved from Tools) ---------- */
const LOST_FOUND = [
  { item: "65W USB-C laptop charger", where: "Waiting area", when: "Today · 09:40", branch: "calicut", locker: "LF-12", status: "stored", by: "Fathima R" },
  { item: "Black folding umbrella", where: "Hall B", when: "Today · 08:15", branch: "calicut", locker: "LF-08", status: "stored", by: "Niyas K" },
  { item: "Spectacles · brown case", where: "Reception desk", when: "Yesterday", branch: "cochin", locker: "LF-03", status: "claimed", by: "Anjana S" },
  { item: "Car key · Maruti", where: "Parking lot", when: "2 days ago", branch: "cochin", locker: "LF-05", status: "stored", by: "Ashik M" },
  { item: "Steel water bottle", where: "Hall A", when: "3 days ago", branch: "calicut", locker: "LF-11", status: "claimed", by: "Sandra Thomas" },
];
const LF_STATUS = { stored: { label: "In locker", color: "var(--v-ielts)" }, claimed: { label: "Claimed", color: "var(--ok)" } };

function LostFoundPanel({ branch }) {
  const [items, setItems] = React.useState(() => (window.FETS._lostFound && window.FETS._lostFound.length) ? window.FETS._lostFound : LOST_FOUND);
  const list = items.filter((i) => branch === "global" || i.branch === branch);
  const stored = list.filter((i) => i.status === "stored").length;
  const claim = (idx) => { const it = list[idx]; if (it && it.id != null) DB.dbClaimLostFound(it.id); setItems((arr) => arr.map((x) => x === it ? { ...x, status: "claimed" } : x)); toast("Marked as claimed", "check"); };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <StatPill value={stored} label="Awaiting claim" tone={stored ? "var(--v-ielts)" : "var(--ok)"} />
        <StatPill value={list.length} label="Items logged" />
      </div>
      <button onClick={() => toast("Log a found item", "plus")} className="tap inset"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", borderRadius: 14, cursor: "pointer", color: "var(--ink-2)", fontFamily: "var(--font)", fontSize: 13, fontWeight: 650, borderStyle: "dashed" }}>
        <Icon name="plus" size={16} /> Log a found item
      </button>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {list.length === 0
          ? <div className="inset" style={{ padding: 22, borderRadius: 14, textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}>Nothing logged for this centre.</div>
          : list.map((it, i) => {
            const sm = LF_STATUS[it.status];
            return (
              <div key={i} className="glass-2" style={{ padding: 15, borderRadius: 14, display: "flex", alignItems: "center", gap: 13 }}>
                <span style={{ width: 40, height: 40, borderRadius: 11, display: "grid", placeItems: "center", flexShrink: 0, color: sm.color, background: `color-mix(in oklch, ${sm.color} 14%, transparent)`, border: `1px solid color-mix(in oklch, ${sm.color} 28%, transparent)` }}>
                  <Icon name="package" size={19} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.item}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-4)", marginTop: 3 }}>{it.where} · {it.when} · {it.locker}</div>
                </div>
                {it.status === "stored"
                  ? <button onClick={() => claim(i)} className="tap" style={{ flexShrink: 0, padding: "8px 13px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "var(--font)", fontSize: 12, fontWeight: 700, color: "var(--accent-ink)", background: "var(--accent)" }}>Mark claimed</button>
                  : <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", padding: "5px 10px", borderRadius: 99, color: sm.color, background: `color-mix(in oklch, ${sm.color} 16%, transparent)` }}><Icon name="check" size={12} stroke={3} /> {sm.label}</span>}
              </div>
            );
          })}
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
        <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, color: v.color, letterSpacing: "0.02em" }}>{pfmt12(s.start)}</span>
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
function useWindow(size) {
  const { totalDays } = monthCtx();
  const [start, setStart] = React.useState(0);
  const maxStart = Math.max(0, totalDays - size);
  const s = Math.min(start, maxStart);
  const end = Math.min(s + size, totalDays);
  const offsets = [];
  for (let o = s; o < end; o++) offsets.push(o);
  return {
    offsets, start: s, totalDays, maxStart,
    canPrev: s > 0, canNext: s < maxStart,
    prev: () => setStart((v) => Math.max(0, v - size)),
    next: () => setStart((v) => Math.min(maxStart, v + size)),
  };
}

function rangeLabel(offsets) {
  if (!offsets.length) return "";
  const a = F().ISO(offsets[0]), b = F().ISO(offsets[offsets.length - 1]);
  const mo = window.P_MO;
  return a.getMonth() === b.getMonth()
    ? `${mo[a.getMonth()]} ${a.getDate()} – ${b.getDate()}`
    : `${mo[a.getMonth()]} ${a.getDate()} – ${mo[b.getMonth()]} ${b.getDate()}`;
}

/* ---------- prev / next pager ---------- */
function RangeNav({ win, unit = "days" }) {
  const Btn = ({ dir, on, can }) => (
    <button onClick={on} disabled={!can} title={dir === "prev" ? "Earlier" : `Next ${unit}`} className="tap glass-2"
      style={{ width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", flexShrink: 0,
        cursor: can ? "pointer" : "not-allowed", opacity: can ? 1 : 0.34,
        color: can ? "var(--ink)" : "var(--ink-4)", border: "1px solid var(--hairline)" }}>
      <Icon name="chevronR" size={18} stroke={2.4} style={{ transform: dir === "prev" ? "rotate(180deg)" : "none" }} />
    </button>
  );
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <Btn dir="prev" on={win.prev} can={win.canPrev} />
      <button onClick={win.next} disabled={!win.canNext} className="tap" title={`Next ${unit}`}
        style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 38, padding: "0 14px", borderRadius: 11,
          cursor: win.canNext ? "pointer" : "not-allowed", opacity: win.canNext ? 1 : 0.34, border: "none",
          fontFamily: "var(--font)", fontSize: 12.5, fontWeight: 700, color: "var(--accent-ink)", background: "var(--accent)" }}>
        Next 10 <Icon name="arrowR" size={15} stroke={2.4} />
      </button>
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
function MonthGrid({ onPick, renderCell }) {
  const { y, m, daysInMonth, firstWeekday, today } = monthCtx();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));
  const tKey = today.getDate();
  return (
    <div className="glass" style={{ padding: "16px 16px 18px", borderRadius: "var(--radius)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 7, marginBottom: 9 }}>
        {window.P_WD.map((w, i) => (
          <div key={i} className="eyebrow" style={{ textAlign: "center", fontSize: 9.5,
            color: i === 0 || i === 6 ? "var(--ink-4)" : "var(--ink-3)" }}>{w}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 7 }}>
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const isToday = date.getDate() === tKey;
          const isPast = date < today;
          return (
            <button key={i} onClick={() => !isPast && onPick(date)} disabled={isPast} className="tap"
              style={{ minHeight: 92, padding: "8px 9px", borderRadius: 12, textAlign: "left", cursor: isPast ? "default" : "pointer",
                display: "flex", flexDirection: "column", gap: 6, fontFamily: "var(--font)",
                background: isToday ? "var(--accent-soft)" : "var(--inset)",
                border: isToday ? "1px solid var(--accent-line)" : "1px solid var(--glass-edge-lo)",
                opacity: isPast ? 0.4 : 1 }}>
              <span className="tabnum" style={{ fontSize: 14, fontWeight: 800, lineHeight: 1,
                color: isToday ? "var(--accent)" : "var(--ink-2)" }}>{date.getDate()}</span>
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
  const base = f.sessionsOn.bind(f);
  f.sessionsOn = function (d, branch) {
    let list;
    const live = f._liveSessions && f._liveSessions[sessKey(d)];
    if (live) list = branch === "global" ? live : live.filter((s) => s.branch === branch);
    else list = base(d, branch);
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

  const liveKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const delSession = (s) => {
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
          <button onClick={() => setEditing("__new")} className="tap" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 8, cursor: "pointer", fontSize: 11.5, fontWeight: 700, color: "var(--accent-ink)", background: "var(--accent)", border: "none" }}>
            <Icon name="plus" size={13} /> Add session
          </button>
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
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <button onClick={() => setEditing(sessSig(s))} title="Edit" className="tap glass-2" style={{ width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center", cursor: "pointer", color: "var(--ink-2)", border: "1px solid var(--hairline)" }}><Icon name="settings" size={15} /></button>
                        <button onClick={() => delSession(s)} title="Delete" className="tap glass-2" style={{ width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center", cursor: "pointer", color: "var(--bad)", border: "1px solid var(--hairline)" }}><Icon name="trash" size={15} /></button>
                      </div>
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
function CalendarStrip({ offsets, branch }) {
  const showBranch = branch === "global";
  return (
    <div className="scroll-soft" style={{ overflowX: "auto", paddingBottom: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${offsets.length}, minmax(172px,1fr))`, gap: 12, minWidth: offsets.length * 176 }}>
        {offsets.map((o, idx) => {
          const d = F().ISO(o), isToday = o === 0;
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          const sessions = window.branchSessions(o, branch).slice().sort((a, b) => a.start.localeCompare(b.start));
          const total = sessions.reduce((s, x) => s + x.count, 0);
          return (
            <div key={o} className="cal-col rise" style={{ display: "flex", flexDirection: "column", gap: 10, padding: 10, borderRadius: 16, minHeight: 180,
              animationDelay: `${idx * 35}ms`,
              background: isToday ? "color-mix(in oklch, var(--branch) 12%, var(--glass))" : "var(--glass)",
              border: "1px solid " + (isToday ? "color-mix(in oklch, var(--branch) 45%, transparent)" : "var(--glass-edge)"),
              boxShadow: isToday ? "0 10px 28px color-mix(in oklch, var(--branch) 16%, transparent), var(--shadow)" : "var(--shadow)" }}>
              {/* day header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingBottom: 9, borderBottom: "1px solid var(--hairline)" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span className="tabnum" style={{ fontSize: 27, fontWeight: 800, fontFamily: '"Archivo Expanded", var(--font)', letterSpacing: "-0.03em", lineHeight: 1, color: isToday ? "var(--branch)" : "var(--ink)" }}>{d.getDate()}</span>
                  <span className="eyebrow" style={{ fontSize: 9.5, color: isToday ? "var(--branch)" : (isWeekend ? "var(--ink-4)" : "var(--ink-3)"), letterSpacing: "0.12em" }}>{window.P_WD[d.getDay()]}</span>
                </div>
                {isToday
                  ? <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 999, color: "var(--accent-ink)", background: "var(--branch)" }}>Today</span>
                  : total > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 999, flexShrink: 0, background: "var(--inset)", color: "var(--ink-3)" }} title={`${total} candidates`}>
                      <Icon name="users" size={12} stroke={2.2} /><span className="tabnum mono" style={{ fontSize: 11.5, fontWeight: 700 }}>{total}</span>
                    </span>}
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

function CalendarPage({ branch }) {
  const [view, setView] = React.useState("days");   // days | agenda | month | analysis
  const win = useWindow(10);
  const [dayDrawer, setDayDrawer] = React.useState(null);
  const mc = monthCtx();
  const monthOffsets = Array.from({ length: mc.totalDays }, (_, i) => i);
  const wide = view === "month" || view === "analysis";

  // analysis: window vs whole remaining month
  const winS = windowStats(wide ? monthOffsets : win.offsets, branch);
  const gap = "calc(28px * var(--density))";

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", flexDirection: "column", gap }}>
      <PageHeader eyebrow={`Exam Schedule // ${capBranch(branch)}`} title="Calendar" />

      <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* control bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <span style={{ width: 22, height: 2, background: "var(--accent)", borderRadius: 99 }} />
            <span className="eyebrow">{wide ? `${mc.monthName} ${mc.y}` : rangeLabel(win.offsets)}</span>
          </div>
          <div style={{ flex: 1 }} />
          <Segmented value={view} onChange={setView} size="sm" options={[
            { value: "days", label: "10 Days" }, { value: "agenda", label: "Day wise" }, { value: "month", label: "Month wise" }, { value: "analysis", label: "Overview" },
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

        {view === "days" && <CalendarStrip offsets={win.offsets} branch={branch} />}
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
          <MonthGrid onPick={(d) => setDayDrawer(d)} renderCell={(date) => {
            const ss = F().sessionsOn(date, branch);
            const total = ss.reduce((a, x) => a + x.count, 0);
            const vends = [...new Set(ss.map((s) => s.vendor))].slice(0, 5);
            return (
              <React.Fragment>
                <div style={{ marginTop: "auto", display: "flex", gap: 3, flexWrap: "wrap" }}>
                  {vends.map((slug) => <span key={slug} style={{ width: 7, height: 7, borderRadius: 2, background: window.VENDOR_BY_SLUG[slug].color }} />)}
                </div>
                {total > 0 && <div className="mono" style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)" }}>{total} cand</div>}
              </React.Fragment>
            );
          }} />
        )}
      </section>

      <Drawer open={!!dayDrawer} onClose={() => setDayDrawer(null)} icon="calendar"
        title={dayDrawer ? `${window.P_WDL[dayDrawer.getDay()]}, ${window.P_MO[dayDrawer.getMonth()]} ${dayDrawer.getDate()}` : ""}
        sub={`${capBranch(branch)} · day detail`}>
        {dayDrawer && <DayDetailPanel date={dayDrawer} branch={branch} />}
      </Drawer>
    </div>
  );
}

/* =====================================================================
   ROSTER PAGE — 10-day coverage grid, month view, leave drawer
   ===================================================================== */
/* shift codes shown in every roster cell (OT is an add-on, not a base code) */
const ROSTER_CODES = {
  D:    { label: "Day shift",        color: "var(--accent)",      ink: "var(--accent-ink)", solid: true },
  E:    { label: "Evening shift",    color: "var(--v-prometric)", ink: "#fff",              solid: true },
  HD:   { label: "Half day",         color: "var(--warn)",        ink: "var(--accent-ink)", solid: true },
  RD:   { label: "Rest day",         color: "var(--ink-4)",       ink: "var(--ink-3)",      solid: false },
  L:    { label: "Leave",            color: "var(--bad)",         ink: "#fff",              solid: true },
  TOIL: { label: "Time off in lieu", color: "var(--v-cma)",       ink: "var(--accent-ink)", solid: true },
  TO:   { label: "TOIL taken",       color: "var(--accent-2)",    ink: "var(--accent-ink)", solid: true },
  SW:   { label: "Shift swapped",    color: "var(--v-ielts)",     ink: "#fff",              solid: true },
};
const RC_LIST = ["D", "E", "HD", "RD", "L", "TOIL"];
const WORK_CODES = ["D", "E", "HD"];
const OT_COLOR = "var(--v-ielts)";

/* reflect an approved staff request onto the shared roster store */
function reflectOnRoster(r) {
  if (!r || r.status !== "Approved") return;
  let off;
  try { off = F().offsetOf(new Date(r.date)); } catch (e) { return; }
  if (off == null || isNaN(off)) return;
  if (r.kind === "leave") F().rosterSet(r.who, off, { code: "L", ot: 0 });
  else if (r.kind === "toil") F().rosterSet(r.who, off, { code: "TO", ot: 0 });
  else if (r.kind === "swap") {
    F().rosterSet(r.who, off, { code: "SW", ot: 0 });
    if (r.with) F().rosterSet(r.with, off, { code: "SW", ot: 0 });
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
              color: m.ink, background: m.solid ? m.color : "var(--inset)", border: m.solid ? "none" : "1px solid var(--hairline)" }}>{k}</span>
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
  // working a rest day is logged as TOIL
  const effective = (isRest && WORK_CODES.includes(code)) ? "TOIL" : code;
  const otAllowed = WORK_CODES.includes(code) || effective === "TOIL";
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
                  color: m.ink, background: m.solid ? m.color : "var(--panel-3)", border: m.solid ? "none" : "1px solid var(--hairline)" }}>{k}</span>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: on ? 700 : 600, color: on ? "var(--ink)" : "var(--ink-2)" }}>{m.label}</span>
                {on && <Icon name="check" size={16} stroke={2.6} style={{ color: "var(--accent)" }} />}
              </button>
            );
          })}
        </div>

        {isRest && WORK_CODES.includes(code) && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 12, color: "var(--v-cma)", fontWeight: 600, lineHeight: 1.4 }}>
            <Icon name="refresh" size={14} style={{ marginTop: 1, flexShrink: 0 }} /> Working a rest day — logged as <b>TOIL</b>.
          </div>
        )}

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
            color: ROSTER_CODES[effective].ink, background: ROSTER_CODES[effective].solid ? ROSTER_CODES[effective].color : "var(--panel-3)",
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

function RosterGrid({ offsets, branch }) {
  const pool = branch === "global"
    ? [...F().STAFF.calicut.map((n) => ({ n, b: "calicut" })), ...F().STAFF.cochin.map((n) => ({ n, b: "cochin" }))]
    : F().STAFF[branch].map((n) => ({ n, b: branch }));

  const build = () => {
    const g = {};
    const total = monthCtx().totalDays;
    pool.forEach(({ n }) => {
      g[n] = {};
      const ov = F().rosterGet(n);
      for (let o = 0; o < total; o++) {
        const dflt = initRosterCode(n, o, new Set(window.branchRoster(o, branch)).has(n));
        g[n][o] = { code: dflt, ot: 0, dflt, override: !!ov[o] };
        if (ov[o]) g[n][o] = { ...g[n][o], code: cellCode(ov[o]), ot: cellOT(ov[o]), override: true };
      }
    });
    return g;
  };
  const [grid, setGrid] = React.useState(build);
  React.useEffect(() => { setGrid(build()); }, [branch]);
  React.useEffect(() => {
    const h = () => setGrid(build());
    window.addEventListener("fets-roster-changed", h);
    return () => window.removeEventListener("fets-roster-changed", h);
  }, [branch]);
  const [dialog, setDialog] = React.useState(null);   // { name, off, date, cell, defaultCode }

  const apply = (name, off, cell) => {
    F().rosterSet(name, off, cell);
    const _d = F().ISO(off);
    if (cell) DB.dbSetRoster(name, _d, cell.code); else DB.dbClearRoster(name, _d);
    setGrid((g) => {
      const dflt = g[name][off].dflt;
      const nc = cell ? { code: cell.code, ot: +cell.ot || 0, dflt, override: true } : { code: dflt, ot: 0, dflt, override: false };
      return { ...g, [name]: { ...g[name], [off]: nc } };
    });
    setDialog(null);
  };
  const cols = `190px repeat(${offsets.length}, minmax(56px,1fr))`;

  return (
    <React.Fragment>
    <div className="glass scroll-soft" style={{ borderRadius: "var(--radius)", overflow: "auto", padding: 4 }}>
      <div style={{ minWidth: 190 + offsets.length * 60 }}>
        <div style={{ display: "grid", gridTemplateColumns: cols, gap: 4, padding: "8px 8px 6px" }}>
          <div className="eyebrow" style={{ alignSelf: "center", color: "var(--ink-4)" }}>Staff</div>
          {offsets.map((o) => {
            const d = F().ISO(o), isToday = o === 0;
            const sc = window.branchSessions(o, branch).length;
            return (
              <div key={o} style={{ textAlign: "center", padding: "4px 0" }}>
                <div className="eyebrow" style={{ color: isToday ? "var(--accent)" : "var(--ink-4)", fontSize: 9.5 }}>{window.P_WD[d.getDay()]}</div>
                <div className="tabnum" style={{ fontSize: 15, fontWeight: 800, color: isToday ? "var(--accent)" : "var(--ink-2)" }}>{d.getDate()}</div>
                <div className="mono" style={{ fontSize: 9, color: "var(--ink-4)", marginTop: 1 }}>{sc} ex</div>
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
                {branch === "global"
                  ? <div className="eyebrow" style={{ fontSize: 8.5, color: "var(--ink-4)" }}>{b}</div>
                  : (n === F().user.name && <div className="eyebrow" style={{ fontSize: 8.5, color: "var(--accent)" }}>you</div>)}
              </div>
            </div>
            {offsets.map((o) => {
              const cell = grid[n]?.[o] || { code: "RD", ot: 0 };
              const code = cell.code; const m = ROSTER_CODES[code] || ROSTER_CODES.RD;
              const ot = +cell.ot || 0;
              const main = ot > 0 ? `${code}+OT` : code;
              const d = F().ISO(o);
              return (
                <button key={o} onClick={() => setDialog({ name: n, off: o, date: d, cell, defaultCode: cell.dflt || "RD" })} className="tap" title={`${m.label}${ot > 0 ? ` + OT ${ot}h` : ""} — tap to change`}
                  style={{ height: 40, borderRadius: 8, cursor: "pointer", border: m.solid ? "1px solid transparent" : "1px solid var(--glass-edge-lo)",
                    background: m.solid ? m.color : "var(--panel-3)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0,
                    color: m.ink, fontFamily: "var(--font)", fontWeight: 800, letterSpacing: "0.01em",
                    boxShadow: ot > 0 ? `inset 0 -3px 0 ${OT_COLOR}` : "none" }}>
                  <span style={{ fontSize: main.length > 2 ? 9.5 : 12, lineHeight: 1 }}>{main}</span>
                  {ot > 0 && <span className="mono" style={{ fontSize: 8, fontWeight: 700, lineHeight: 1.1, opacity: 0.92 }}>{ot}h</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
    {dialog && <RosterCellDialog ctx={dialog} onClose={() => setDialog(null)} onApply={(cell) => apply(dialog.name, dialog.off, cell)} />}
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
  const perStaff = {}; const codeCount = { D: 0, E: 0, HD: 0, RD: 0, L: 0, TOIL: 0 };
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
  const mixSeg = RC_LIST.map((k) => ({ label: ROSTER_CODES[k].label, color: k === "RD" ? "var(--ink-4)" : ROSTER_CODES[k].color, n: codeCount[k] }));
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
    DB.dbQuickAddRoster(name, from, to);
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

function RosterPage({ branch }) {
  const [view, setView] = React.useState("days");   // days | analysis
  const win = useWindow(10);
  const [quickOpen, setQuickOpen] = React.useState(false);
  const [dayDrawer, setDayDrawer] = React.useState(null);
  const mc = monthCtx();
  const isAdmin = F().user.role === "Super Admin";

  const reqsAll = F().staffReqList().filter((r) => branch === "global" || r.branch === branch);
  const pending = reqsAll.filter((r) => r.status === "Submitted").length;
  const onDutyToday = window.branchRoster(0, branch).length;
  const poolSize = branch === "global"
    ? F().STAFF.calicut.length + F().STAFF.cochin.length
    : F().STAFF[branch].length;
  // avg coverage across window
  const offs = (view === "month" || view === "analysis") ? Array.from({ length: mc.totalDays }, (_, i) => i) : win.offsets;
  const avgCover = Math.round(offs.reduce((a, o) => a + window.branchRoster(o, branch).length, 0) / offs.length);
  const busy = windowStats(offs, branch).busiest;
  const wide = view === "month" || view === "analysis";
  const gap = "calc(28px * var(--density))";

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", flexDirection: "column", gap }}>
      <PageHeader eyebrow={`Staffing // ${capBranch(branch)}`} title="Roster" />

      <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <span style={{ width: 22, height: 2, background: "var(--accent)", borderRadius: 99 }} />
            <span className="eyebrow">{wide ? `${mc.monthName} ${mc.y}` : rangeLabel(win.offsets)}</span>
          </div>
          <div style={{ flex: 1 }} />
          {isAdmin && (
            <button onClick={() => setQuickOpen(true)} className="tap" title="Quick add roster (6+1 pattern)"
              style={{ display: "inline-flex", alignItems: "center", gap: 9, height: 38, padding: "0 15px", borderRadius: 11,
                cursor: "pointer", border: "none", fontFamily: "var(--font)", fontSize: 12.5, fontWeight: 750, color: "var(--accent-ink)", background: "var(--accent)" }}>
              <Icon name="plus" size={15} /> Quick add
            </button>
          )}
          <Segmented value={view} onChange={setView} size="sm" options={[
            { value: "days", label: "10 Days" }, { value: "analysis", label: "Overview" },
          ]} />
          {view === "days" && <RangeNav win={win} />}
        </div>

        {view === "days" && <RosterLegend />}

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
        {view === "days" && <span className="mono" style={{ fontSize: 11, color: "var(--ink-4)", alignSelf: "flex-end" }}>tap a cell to change shift · use Quick add for a 6+1 block</span>}
      </section>

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
   RAISE-A-CASE FORM  (lives in a drawer)
   ===================================================================== */
function RaiseCaseForm({ branch, onSubmit }) {
  const [cat, setCat] = React.useState("Technical");
  const [prio, setPrio] = React.useState("Medium");
  const [br, setBr] = React.useState(branch === "global" ? "calicut" : branch);
  const [vendor, setVendor] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [desc, setDesc] = React.useState("");

  const submit = () => {
    if (!subject.trim()) { toast("Add a short subject first", "alert"); return; }
    const id = `FC-${2049 + Math.floor(Math.random() * 40)}`;
    onSubmit({
      id, subject: subject.trim(), category: cat, priority: prio,
      branch: br, vendor: vendor || null, status: "open", assignee: window.FETS.user.name,
      opened: "Just now", age: "now", detail: desc.trim() || "No further detail provided yet.",
      contact: null,
      thread: [{ id: "m" + Date.now(), kind: "msg", author: window.FETS.user.name, role: "staff", text: desc.trim() || "Case raised.", when: caseNow() }],
    });
    setSubject(""); setDesc(""); setVendor("");
    toast("Case raised — assigned to you", "check");
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
          <ChipRow options={["calicut", "cochin"]} value={br} onChange={setBr} />
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
   SECTION 1 — CATEGORY RAIL
   ===================================================================== */
function CategoryRail({ cases, cat, setCat, statusF, setStatusF }) {
  const counts = {};
  cases.forEach((c) => { counts[c.category] = (counts[c.category] || 0) + 1; });
  const rows = [{ key: "all", label: "All cases", icon: "layers", n: cases.length },
    ...window.FETS.CASE_CATEGORIES.map((k) => ({ key: k, label: k, icon: window.FETS.CASE_CAT_ICON[k] || "grid", n: counts[k] || 0 }))];
  return (
    <aside className="glass" style={{ borderRadius: "var(--radius)", padding: 14, display: "flex", flexDirection: "column", gap: 16, alignSelf: "start" }}>
      <div>
        <div className="eyebrow" style={{ fontSize: 9.5, color: "var(--ink-4)", marginBottom: 9, paddingLeft: 4 }}>Category</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {rows.map((r) => {
            const on = cat === r.key;
            return (
              <button key={r.key} onClick={() => setCat(r.key)} className="tap" style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 11px", borderRadius: 11,
                cursor: "pointer", textAlign: "left", fontFamily: "var(--font)", border: "1px solid " + (on ? "var(--accent-line)" : "transparent"),
                background: on ? "var(--accent-soft)" : "transparent" }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", flexShrink: 0,
                  color: on ? "var(--accent)" : "var(--ink-3)", background: on ? "color-mix(in oklch, var(--accent) 16%, transparent)" : "var(--inset)" }}>
                  <Icon name={r.icon} size={15} />
                </span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: on ? 700 : 600, color: on ? "var(--ink)" : "var(--ink-2)" }}>{r.label}</span>
                <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: on ? "var(--accent)" : "var(--ink-4)" }}>{r.n}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 14 }}>
        <div className="eyebrow" style={{ fontSize: 9.5, color: "var(--ink-4)", marginBottom: 9, paddingLeft: 4 }}>Status</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {[{ k: "all", label: "Everything", color: "var(--ink-3)" },
            { k: "open", label: "Open", color: STATUS_META.open.color },
            { k: "progress", label: "In progress", color: STATUS_META.progress.color },
            { k: "resolved", label: "Resolved", color: STATUS_META.resolved.color }].map((s) => {
            const on = statusF === s.k;
            return (
              <button key={s.k} onClick={() => setStatusF(s.k)} className="tap" style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", borderRadius: 9,
                cursor: "pointer", fontFamily: "var(--font)", border: "none", background: on ? "var(--inset)" : "transparent",
                fontSize: 12.5, fontWeight: on ? 700 : 550, color: on ? "var(--ink)" : "var(--ink-3)" }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: s.color, flexShrink: 0 }} /> {s.label}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

/* =====================================================================
   SECTION 2 — CASE QUEUE (the Case IDs)
   ===================================================================== */
function CaseQueue({ cases, selectedId, onSelect }) {
  return (
    <div className="glass" style={{ borderRadius: "var(--radius)", display: "flex", flexDirection: "column", overflow: "hidden", alignSelf: "start", maxHeight: "calc(100vh - 220px)" }}>
      <div style={{ padding: "13px 15px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span className="eyebrow" style={{ fontSize: 9.5, color: "var(--ink-4)" }}>Case queue</span>
        <span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>{cases.length}</span>
      </div>
      <div className="scroll-soft" style={{ overflowY: "auto", padding: 9, display: "flex", flexDirection: "column", gap: 6 }}>
        {cases.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "var(--ink-4)", fontSize: 12.5 }}>No cases match.</div>}
        {cases.map((c) => {
          const on = c.id === selectedId;
          const st = STATUS_META[c.status];
          return (
            <button key={c.id} onClick={() => onSelect(c.id)} className="tap" style={{ textAlign: "left", cursor: "pointer", fontFamily: "var(--font)",
              padding: "12px 13px", borderRadius: 12, display: "flex", flexDirection: "column", gap: 7, position: "relative",
              border: "1px solid " + (on ? "var(--accent-line)" : "var(--hairline)"), background: on ? "var(--accent-soft)" : "var(--glass-2)",
              borderLeft: `3px solid ${PRIO_COLOR[c.priority]}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink-4)" }}>{c.id}</span>
                <div style={{ flex: 1 }} />
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, color: st.color }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: st.color }} /> {st.label}
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
  );
}

/* =====================================================================
   SECTION 3 — CASE PLAYGROUND (live thread)
   ===================================================================== */
function Bubble({ m }) {
  if (m.kind === "status") {
    return (
      <div style={{ display: "flex", justifyContent: "center", margin: "4px 0" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 999, background: "var(--inset)",
          fontSize: 11, fontWeight: 650, color: "var(--ink-3)" }}>
          <Icon name="refresh" size={12} style={{ color: "var(--accent)" }} /> {m.author} {m.text}
          <span className="mono" style={{ color: "var(--ink-4)", marginLeft: 2 }}>{m.when}</span>
        </span>
      </div>
    );
  }
  const staff = m.role === "staff";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: staff ? "flex-end" : "flex-start", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 4px", flexDirection: staff ? "row-reverse" : "row" }}>
        {!staff && <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--v-prometric)", flexShrink: 0 }} />}
        <span style={{ fontSize: 11.5, fontWeight: 700, color: staff ? "var(--accent)" : "var(--ink-2)" }}>{m.author}</span>
        {!staff && <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--v-prometric)",
          background: "color-mix(in oklch, var(--v-prometric) 15%, transparent)", padding: "1px 6px", borderRadius: 5 }}>External</span>}
        <span className="mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>{m.when}</span>
      </div>
      <div style={{ maxWidth: "78%", padding: "11px 14px", borderRadius: 14, fontSize: 13.5, lineHeight: 1.5, fontWeight: 500,
        borderTopRightRadius: staff ? 4 : 14, borderTopLeftRadius: staff ? 14 : 4,
        color: staff ? "var(--accent-ink)" : "var(--ink)", background: staff ? "var(--accent)" : "var(--glass-2)",
        border: staff ? "none" : "1px solid var(--hairline)" }}>
        {m.text}
        {m.contact && <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, opacity: 0.85, display: "flex", alignItems: "center", gap: 5 }}>
          <Icon name="phone" size={11} /> {m.contact}</div>}
      </div>
    </div>
  );
}

function ContactStrip({ c, onSave }) {
  const [edit, setEdit] = React.useState(false);
  const [name, setName] = React.useState(c.contact ? c.contact.name : "");
  const [phone, setPhone] = React.useState(c.contact ? c.contact.phone : "");
  const [role, setRole] = React.useState(c.contact ? c.contact.role : "");
  React.useEffect(() => { setName(c.contact ? c.contact.name : ""); setPhone(c.contact ? c.contact.phone : ""); setRole(c.contact ? c.contact.role : ""); setEdit(false); }, [c.id]);

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
    return (
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
      <button onClick={() => setEdit(true)} className="tap" title="Edit contact" style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--hairline)", background: "transparent", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--ink-3)" }}>
        <Icon name="settings" size={14} />
      </button>
    </div>
  );
}

function CasePlayground({ c, onStatus, onPost, onContact }) {
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
    const msg = { id: "m" + Date.now(), kind: "msg", role: mode, when: caseNow(), text: draft.trim(),
      author: staff ? window.FETS.user.name : (extName.trim() || "External contact"),
      contact: staff ? undefined : (extPhone.trim() || undefined) };
    onPost(c.id, msg);
    if (!staff && !c.contact && (extName.trim() || extPhone.trim()))
      onContact(c.id, { name: extName.trim() || "External contact", role: "External", phone: extPhone.trim(), email: "", external: true });
    setDraft("");
  };

  return (
    <div className="glass" style={{ borderRadius: "var(--radius)", display: "flex", flexDirection: "column", overflow: "hidden", height: "calc(100vh - 220px)", minHeight: 560 }}>
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
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Avatar name={c.assignee} size={18} /> {c.assignee}</span>
              <span className="mono" style={{ color: "var(--ink-4)" }}>opened {c.opened}</span>
            </div>
          </div>
        </div>
        {/* status control — anyone can change */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span className="eyebrow" style={{ fontSize: 9.5, color: "var(--ink-4)" }}>Status</span>
          <div className="inset" style={{ display: "inline-flex", padding: 3, gap: 2, borderRadius: 999 }}>
            {STATUS_ORDER.map((s) => {
              const on = c.status === s;
              const m = STATUS_META[s];
              return (
                <button key={s} onClick={() => !on && onStatus(c.id, s)} className="tap" style={{ border: "none", cursor: "pointer", padding: "6px 14px", borderRadius: 999,
                  fontFamily: "var(--font)", fontSize: 12, fontWeight: on ? 700 : 550, display: "inline-flex", alignItems: "center", gap: 6,
                  color: on ? "#fff" : "var(--ink-3)", background: on ? m.color : "transparent" }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: on ? "#fff" : m.color }} /> {m.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* contact + detail + thread (scroll) */}
      <div ref={threadRef} className="scroll-soft" style={{ flex: 1, overflowY: "auto", padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14, minHeight: 0 }}>
        <ContactStrip c={c} onSave={(ct) => onContact(c.id, ct)} />
        <div className="inset" style={{ padding: "12px 14px", borderRadius: 12, fontSize: 13, color: "var(--ink-2)", fontWeight: 500, lineHeight: 1.55,
          fontFamily: "var(--font-serif)", fontStyle: "italic", borderLeft: "3px solid var(--accent-line)" }}>{c.detail}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 0" }}>
          <span style={{ flex: 1, height: 1, background: "var(--hairline)" }} />
          <span className="eyebrow" style={{ fontSize: 9, color: "var(--ink-4)" }}>Conversation</span>
          <span style={{ flex: 1, height: 1, background: "var(--hairline)" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {c.thread.map((m) => <Bubble key={m.id} m={m} />)}
        </div>
      </div>

      {/* composer */}
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
            <input value={extName} onChange={(e) => setExtName(e.target.value)} placeholder="Their name" style={{ ...caseInput, padding: "9px 12px", fontSize: 12.5 }} />
            <input value={extPhone} onChange={(e) => setExtPhone(e.target.value)} placeholder="Contact number" style={{ ...caseInput, padding: "9px 12px", fontSize: 12.5 }} />
          </div>
        )}
        <div style={{ display: "flex", gap: 9, alignItems: "flex-end" }}>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={1}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={mode === "staff" ? "Write an update… (Enter to send)" : "Log what the outside contact said…"}
            style={{ ...caseInput, padding: "11px 14px", resize: "none", lineHeight: 1.4, minHeight: 44 }} />
          <button onClick={send} className="tap" style={{ width: 46, height: 46, borderRadius: 12, border: "none", cursor: "pointer", flexShrink: 0,
            display: "grid", placeItems: "center", color: "var(--accent-ink)", background: "var(--accent)" }}>
            <Icon name="arrowR" size={19} stroke={2.4} />
          </button>
        </div>
      </div>
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
   PAGE
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

function RaiseCasePage({ branch, setActive }) {
  const [cases, setCases] = React.useState(() => window.FETS.CASES.map((c) => ({ ...c, thread: c.thread.map((m) => ({ ...m })) })));
  const [view, setView] = React.useState("cases");
  const [cat, setCat] = React.useState("all");
  const [statusF, setStatusF] = React.useState("all");
  const [raiseOpen, setRaiseOpen] = React.useState(false);

  const inBranch = cases.filter((c) => branch === "global" || c.branch === branch);
  const filtered = inBranch.filter((c) => (cat === "all" || c.category === cat) && (statusF === "all" || c.status === statusF));

  const [selectedId, setSelectedId] = React.useState(inBranch[0] ? inBranch[0].id : null);
  React.useEffect(() => {
    if (!filtered.find((c) => c.id === selectedId)) setSelectedId(filtered[0] ? filtered[0].id : null);
  }, [branch, cat, statusF, cases.length]);
  const selected = cases.find((c) => c.id === selectedId) || filtered[0] || null;

  const setStatus = (id, s) => {
    const c0 = cases.find((c) => c.id === id);
    if (c0 && c0._dbId != null) DB.dbSetCaseStatus(c0._dbId, s);
    setCases((cs) => cs.map((c) => c.id === id ? { ...c, status: s,
      thread: [...c.thread, { id: "s" + Date.now(), kind: "status", role: "system", author: window.FETS.user.name, text: `marked the case ${STATUS_META[s].label}`, when: caseNow() }] } : c));
  };
  const post = (id, msg) => setCases((cs) => cs.map((c) => c.id === id ? { ...c, thread: [...c.thread, msg] } : c));
  const setContact = (id, ct) => setCases((cs) => cs.map((c) => c.id === id ? { ...c, contact: ct } : c));
  const addCase = (c) => { DB.dbAddCase(c).then((row) => { if (row && row.id != null) c._dbId = row.id; }); setCases((cs) => [c, ...cs]); setSelectedId(c.id); setCat("all"); setStatusF("all"); setView("cases"); setRaiseOpen(false); };

  const idx = filtered.findIndex((c) => selected && c.id === selected.id);
  const go = (delta) => { const ni = idx + delta; if (ni >= 0 && ni < filtered.length) setSelectedId(filtered[ni].id); };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: "calc(20px * var(--density))" }}>
      {/* top bar */}
      <header className="rise" style={{ display: "flex", alignItems: "flex-end", gap: 18, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <button onClick={() => setActive("live")} className="tap" style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "transparent", border: "none", cursor: "pointer",
            fontFamily: "var(--font)", fontSize: 12, fontWeight: 700, color: "var(--ink-3)", padding: 0, marginBottom: 12 }}>
            <Icon name="chevronR" size={14} style={{ transform: "rotate(180deg)" }} /> Back to Live
          </button>
          <h1 style={{ margin: 0, fontFamily: '"Archivo Expanded", var(--font)', fontWeight: 800,
            fontSize: "clamp(32px,4.6vw,54px)", lineHeight: 0.9, letterSpacing: "-0.03em", color: "var(--ink)" }}>
            Raise a <span style={{ color: "var(--accent)" }}>Case</span>
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Segmented value={view} onChange={setView} options={[
            { value: "cases", label: "Cases", icon: "layers" },
            { value: "analysis", label: "Analysis", icon: "trend" },
          ]} />
          <button onClick={() => setRaiseOpen(true)} className="tap" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: 12,
            border: "none", cursor: "pointer", fontFamily: "var(--font)", fontSize: 13.5, fontWeight: 700, color: "var(--accent-ink)", background: "var(--accent)", boxShadow: "var(--shadow)" }}>
            <Icon name="plus" size={16} stroke={2.6} /> Raise a case
          </button>
        </div>
      </header>

      {view === "analysis" ? <CaseAnalysis cases={inBranch} /> : (
        <React.Fragment>
          {/* picker row */}
          <div className="glass" style={{ padding: "16px 18px", borderRadius: "var(--radius)", display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
            <LabeledSelect label="Category" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="all">All categories</option>
              {window.FETS.CASE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </LabeledSelect>
            <LabeledSelect label="Status" value={statusF} onChange={(e) => setStatusF(e.target.value)}>
              <option value="all">Any status</option>
              <option value="open">Open</option>
              <option value="progress">In progress</option>
              <option value="resolved">Resolved</option>
            </LabeledSelect>
            <LabeledSelect label={`Case · ${filtered.length} match${filtered.length === 1 ? "" : "es"}`} value={selected ? selected.id : ""} onChange={(e) => setSelectedId(e.target.value)} grow>
              {filtered.length === 0 && <option value="">No cases match</option>}
              {filtered.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.subject}</option>)}
            </LabeledSelect>
            <div style={{ display: "flex", gap: 7 }}>
              <button onClick={() => go(-1)} disabled={idx <= 0} className="tap glass-2" title="Previous case" style={{ width: 42, height: 42, borderRadius: 11, display: "grid", placeItems: "center", cursor: idx <= 0 ? "not-allowed" : "pointer", opacity: idx <= 0 ? 0.35 : 1, border: "1px solid var(--hairline)", color: "var(--ink-2)" }}><Icon name="chevronR" size={17} style={{ transform: "rotate(180deg)" }} /></button>
              <button onClick={() => go(1)} disabled={idx < 0 || idx >= filtered.length - 1} className="tap glass-2" title="Next case" style={{ width: 42, height: 42, borderRadius: 11, display: "grid", placeItems: "center", cursor: idx >= filtered.length - 1 ? "not-allowed" : "pointer", opacity: (idx < 0 || idx >= filtered.length - 1) ? 0.35 : 1, border: "1px solid var(--hairline)", color: "var(--ink-2)" }}><Icon name="chevronR" size={17} /></button>
            </div>
          </div>

          {selected
            ? <CasePlayground c={selected} onStatus={setStatus} onPost={post} onContact={setContact} />
            : <div className="glass" style={{ borderRadius: "var(--radius)", padding: 48, textAlign: "center", color: "var(--ink-4)", fontSize: 14, display: "grid", placeItems: "center", minHeight: 360 }}>
                No cases match these filters — adjust the dropdowns or raise a new one.
              </div>}
        </React.Fragment>
      )}

      <Drawer open={raiseOpen} onClose={() => setRaiseOpen(false)} icon="plus" title="Raise a new case">
        <RaiseCaseForm branch={branch} onSubmit={addCase} />
      </Drawer>
    </div>
  );
}

Object.assign(window, { RaiseCasePage, FieldLabel, ChipRow, PRIO_COLOR, STATUS_META });

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

function LeaveModule() {
  const [tab, setTab] = React.useState("hours");
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <SectionLabel right={<RadioTabs value={tab} onChange={setTab} tabs={[{ k: "hours", label: "Shift hours", icon: "clock" }, { k: "requests", label: "Requests", icon: "calendar" }]} />}>Attendance</SectionLabel>
      </div>
      {tab === "hours" ? <WorkedHours /> : <TimeOff />}
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
  { id: "tasks", icon: "check", color: "var(--accent)", label: "My Task" },
  { id: "checklist", icon: "clipboard", color: "var(--v-prometric)", label: "Checklist" },
  { id: "certs", icon: "shield", color: "var(--ok)", label: "Certificates" },
  { id: "leave", icon: "clock", color: "var(--v-ielts)", label: "Attendance" },
  { id: "readiness", icon: "trend", color: "var(--v-cma)", label: "Readiness" },
];

/* preset-device style nav card — name only, big display */
function PresetCard({ m, idx, on, onClick }) {
  return (
    <button onClick={onClick} className="tap" style={{ display: "flex", gap: 12, cursor: "pointer", textAlign: "left", fontFamily: "var(--font)",
      padding: 13, borderRadius: 20, alignItems: "stretch", position: "relative",
      border: "1px solid " + (on ? "var(--accent-line)" : "oklch(0 0 0 / .45)"),
      background: "linear-gradient(155deg, oklch(0.30 0.03 184), oklch(0.215 0.025 184))",
      boxShadow: on ? "inset 0 1px 0 oklch(1 0 0 / .07), 0 10px 24px oklch(0 0 0 / .4)" : "inset 0 1px 0 oklch(1 0 0 / .05), 0 4px 12px oklch(0 0 0 / .3)",
      transition: "border-color .18s, box-shadow .18s" }}>
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

function DeskMenu({ tab, setTab }) {
  return (
    <nav className="desk-menu" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(206px, 1fr))", gap: 12 }}>
      {DESK_TABS.map((m, i) => <PresetCard key={m.id} m={m} idx={i} on={tab === m.id} onClick={() => setTab(m.id)} />)}
    </nav>
  );
}

function MyDeskPage({ branch, setActive, setDrawer }) {
  const u = window.FETS.user;
  const gap = "calc(24px * var(--density))";
  const [tab, setTab] = React.useState("tasks");

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", flexDirection: "column", gap }}>
      {/* masthead — name + profile photo only */}
      <header className="rise" style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <ProfileAvatar name={u.name} size={66} />
        <h1 style={{ margin: 0, fontFamily: '"Archivo Expanded", var(--font)', fontWeight: 800, whiteSpace: "nowrap",
          fontSize: "clamp(30px,4vw,48px)", lineHeight: 1, letterSpacing: "-0.03em", color: "var(--ink)" }}>{u.name}</h1>
      </header>

      {/* attendance console — always visible centrepiece */}
      <AttendanceCard shift={u.shift} />

      {/* workspace presets */}
      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <SectionLabel right={<span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>5 modules</span>}>Your workspace</SectionLabel>
        <DeskMenu tab={tab} setTab={setTab} />
      </section>

      {/* active feature — full width */}
      <div style={{ minHeight: 300 }}>
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
  { id: "business", icon: "star", label: "Google Business", sub: "Reviews, ratings & reach", page: true },
  { id: "fets-intelligence", icon: "spark", label: "FETS AI", sub: "Ops copilot", legacy: true },
  { id: "candidate-tracker", icon: "users", label: "Candidate Tracker", sub: "Registrations & sessions", legacy: true },
  { id: "access-hub", icon: "key", label: "F-Vault / Access Hub", sub: "Credentials & access", legacy: true },
  { id: "staff-management", icon: "user", label: "Staff Management", sub: "Team & profiles", legacy: true },
  { id: "dashboard", icon: "grid", label: "Dashboard", sub: "iCloud overview", legacy: true },
  { id: "news-manager", icon: "message", label: "News Manager", sub: "Announcements", legacy: true },
  { id: "system-manager", icon: "settings", label: "System Manager", sub: "Admin & config", legacy: true },
  { id: "user-management", icon: "shield", label: "User Management", sub: "Roles & permissions", legacy: true },
  { id: "cma-availability", icon: "calendar", label: "CMA Availability", sub: "Prometric seats", legacy: true },
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
function TopNav({ active, onNavigate, branch, setBranch, t, setTweak, onTools, onBurger }) {
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
          <button key={n.id} className={`topnav-item ${active === n.id ? "active" : ""}`} onClick={() => onNavigate(n)}>
            {n.label}
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
      <div className="topnav-seg">
        <Segmented value={branch} onChange={setBranch} size="sm" activeColor={BRANCH_TINT[branch]} options={[
          { value: "calicut", label: "Calicut" },
          { value: "cochin", label: "Cochin" },
          { value: "global", label: "All" },
        ]} />
      </div>
      <button onClick={onTools} title="All modules" className="tap glass-2" style={{
        display: "inline-flex", alignItems: "center", gap: 8, height: 36, padding: "0 14px", borderRadius: 10,
        cursor: "pointer", color: "var(--ink-2)", fontFamily: "var(--font)", fontSize: 12.5, fontWeight: 650 }}>
        <Icon name="grid" size={15} /> <span className="topnav-branch">Modules</span>
      </button>
      <button onClick={() => toast("Mithun Raj · Super Admin", "settings")} className="tap" title={window.FETS.user.name}
        style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, flexShrink: 0 }}>
        <Avatar name={window.FETS.user.name} size={36} />
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
  return (
    <section className="rise" style={{ paddingTop: 4 }}>
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
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 22 }}>
        <span style={{ width: 28, height: 1.5, background: "var(--ink-4)", borderRadius: 99 }} />
        <span className="serif-it" style={{ fontSize: "clamp(17px,2vw,23px)", color: "var(--accent)", fontWeight: 500 }}>{dateStr}</span>
        <span style={{ fontSize: 13.5, color: "var(--ink-3)", fontWeight: 500 }}>
          · {greeting()}, {window.FETS.user.name.split(" ")[0]} · Day {window.FETS.user.day}
        </span>
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
        <div key={q.label} className="glass" style={{ borderRadius: "var(--radius)", padding: "30px 22px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, minHeight: 140, textAlign: "center" }}>
          <StartButton label={q.label} onClick={q.on} />
          <span style={{ fontSize: 12.5, color: "var(--ink-3)", fontWeight: 500 }}>{q.sub}</span>
        </div>
      ))}
    </div>
  );
}

function LivePage({ branch, setDrawer, setActive, bridge }) {
  const gap = "calc(34px * var(--density))";
  const ops = [
    { label: "Raise a Case", sub: "Log a technical, candidate or facility issue", on: () => setActive("case") },
    { label: "Next 7 Days", sub: "Candidates by client over the next week", on: () => setDrawer("outlook") },
    { label: "News Manager", sub: "Post & manage staff announcements", on: () => setActive("news") },
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
function NewsPage({ branch }) {
  const news = (window.FETS._news || []).filter((n) => n.active !== false);
  const prioColor = (p) => (p === "high" || p === "urgent") ? "var(--bad)" : p === "low" ? "var(--ink-4)" : "var(--accent)";
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: "calc(28px * var(--density))" }}>
      <PageHeader eyebrow={`Announcements // ${capBranch(branch)}`} title="News" />
      {news.length === 0 ? (
        <div className="glass" style={{ borderRadius: "var(--radius)", padding: 48, textAlign: "center", color: "var(--ink-4)", fontSize: 14 }}>
          No announcements right now.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {news.map((n, i) => (
            <article key={n.id || i} className="glass rise" style={{ borderRadius: "var(--radius)", padding: "18px 20px", display: "flex", gap: 14, alignItems: "flex-start", animationDelay: `${i * 40}ms` }}>
              <span style={{ width: 6, alignSelf: "stretch", borderRadius: 99, background: prioColor(n.priority), flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", lineHeight: 1.5 }}>{n.body}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                  {n.priority && n.priority !== "normal" && <span className="eyebrow" style={{ fontSize: 9, color: prioColor(n.priority) }}>{n.priority}</span>}
                  {n.when && <span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>{n.when}</span>}
                </div>
              </div>
              <Icon name="message" size={18} style={{ color: "var(--ink-4)", flexShrink: 0 }} />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- tools sheet (overflow) ---------- */
function ToolsSheet({ open, onClose, onPick, includeNav }) {
  const items = includeNav ? [...NAV.map((n) => ({ ...n, nav: true })), ...TOOLS] : TOOLS;
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

function App({ bridge }) {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [branch, setBranch] = React.useState("calicut");
  const [drawer, setDrawer] = React.useState(null);  // 'outlook' | 'vault' | 'help'
  const [tools, setTools] = React.useState(false);
  const [burger, setBurger] = React.useState(false);
  const [active, setActive] = React.useState("live");

  React.useEffect(() => {
    const r = document.getElementById("fets-redesign-root") || document.documentElement;
    r.setAttribute("data-theme", t.dark ? "dark" : "light");
    const acc = (ACCENTS.find((a) => a.key === t.accent) || ACCENTS[0]).color;
    r.style.setProperty("--accent", acc);
    r.style.setProperty("--density", DENSITY_VAL[t.density] ?? 1);
  }, [t]);

  const handlePick = (it) => {
    if (it.nav) { setActive(it.id); return; }
    if (it.id === "business") { setActive("business"); return; }
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
        t={t} setTweak={setTweak} onTools={() => setTools(true)} onBurger={() => setBurger(true)} />

      <main className="scroll-soft main-scroll" style={{ flex: 1, overflowY: "auto", padding: "clamp(22px,3.2vw,40px) clamp(14px,3vw,30px) 80px" }}>
        {active === "live" && <LivePage branch={branch} setDrawer={setDrawer} setActive={setActive} bridge={bridge} />}
        {active === "calendar" && <CalendarPage branch={branch} />}
        {active === "roster" && <RosterPage branch={branch} />}
        {active === "case" && <RaiseCasePage branch={branch} setActive={setActive} />}
        {active === "desk" && <MyDeskPage branch={branch} setActive={setActive} setDrawer={setDrawer} />}
        {active === "business" && <BusinessPage branch={branch} />}
        {active === "news" && <NewsPage branch={branch} />}
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

function RedesignShell({ bridge }) {
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
        {ready ? <App bridge={bridge} /> : (
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

