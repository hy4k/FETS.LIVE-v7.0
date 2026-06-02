// @ts-nocheck
/* eslint-disable */
/*
  Live data adapter for the FETS · LIVE redesign.

  The ported prototype reads everything synchronously from window.FETS (seed
  data). This module fetches the REAL Supabase tables once at shell mount and
  populates window.FETS so the same synchronous accessors return live data.

  Every fetch is defensive: on any error / empty result we keep the existing
  seed so the app degrades gracefully (important — this ships to production).
  Tables wired: calendar_sessions, staff_profiles, roster_schedules,
  news_ticker, lost_found_items. Others stay on seed until their shapes are
  confirmed against the live DB.
*/
import { supabase } from "../lib/supabase";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const keyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const lc = (s: any) => String(s || "").toLowerCase();

// map a free-text client / exam name onto one of the prototype vendor slugs
const VENDOR_HINTS: [string, string][] = [
  ["prometric", "prometric"], ["pearson", "pearson"], ["vue", "pearson"],
  ["psi", "psi"], ["celpip", "celpip"], ["cma", "cma"], ["ima", "cma"],
  ["ielts", "ielts"],
];
function clientToSlug(name: string) {
  const n = lc(name);
  for (const [hint, slug] of VENDOR_HINTS) if (n.includes(hint)) return slug;
  return "prometric";
}
const branchOf = (v: string) => {
  const b = lc(v);
  if (b.includes("cochin")) return "cochin";
  if (b.includes("calicut")) return "calicut";
  return b || "calicut";
};
// shift codes that mean "not on duty"
const REST_CODES = new Set(["rd", "off", "wo", "l", "leave", "lv", "h", "holiday", "to", "toil"]);

export async function loadLiveData(F: any) {
  if (!F || F._liveLoaded) return;
  const today = new Date();
  const from = new Date(today); from.setDate(from.getDate() - 35);
  const to = new Date(today); to.setDate(to.getDate() + 70);

  /* ---- calendar sessions ---- */
  try {
    const { data, error } = await supabase
      .from("calendar_sessions").select("*")
      .gte("date", ymd(from)).lte("date", ymd(to));
    if (!error && data && data.length) {
      const byKey: Record<string, any[]> = {};
      data.forEach((s: any) => {
        const d = new Date(`${s.date}T00:00:00`);
        if (isNaN(d.getTime())) return;
        (byKey[keyOf(d)] ||= []).push({
          id: s.id,
          vendor: clientToSlug(s.client_name || s.exam_name),
          exam: s.exam_name || s.client_name || "Exam session",
          count: Number(s.candidate_count) || 0,
          start: (s.start_time || "09:00").slice(0, 5),
          end: (s.end_time || s.start_time || "").slice(0, 5),
          branch: branchOf(s.branch_location || s.branch),
        });
      });
      Object.values(byKey).forEach((a) => a.sort((x, y) => x.start.localeCompare(y.start)));
      F._liveSessions = byKey;
    }
  } catch (e) { /* keep seed */ }

  /* ---- current user (for write-back: profile_id / user_id) ---- */
  try { const { data: au } = await supabase.auth.getUser(); F._meUserId = au?.user?.id || null; } catch (e) { F._meUserId = null; }

  /* ---- staff pool (for roster grid + quick-add) + name→id map ---- */
  let profileBranch: Record<string, string> = {};
  try {
    const { data, error } = await supabase
      .from("staff_profiles").select("id, user_id, full_name, role, branch_assigned").order("full_name");
    if (!error && data && data.length) {
      const pool: Record<string, string[]> = { calicut: [], cochin: [] };
      const idByName: Record<string, any> = {};
      data.forEach((p: any) => {
        const b = branchOf(p.branch_assigned);
        const list = pool[b] || (pool[b] = []);
        if (p.full_name) list.push(p.full_name);
        if (p.id) profileBranch[p.id] = b;
        if (p.full_name && p.id) idByName[p.full_name] = p.id;
        if (F._meUserId && p.user_id === F._meUserId) { F._meId = p.id; F._meName = p.full_name; F._meBranch = b; }
      });
      F._staffIdByName = idByName;
      if (pool.calicut.length || pool.cochin.length) {
        F.STAFF = { calicut: pool.calicut.length ? pool.calicut : F.STAFF.calicut, cochin: pool.cochin.length ? pool.cochin : F.STAFF.cochin };
      }
    }
  } catch (e) { /* keep seed */ }

  /* ---- roster schedules ---- */
  try {
    const { data, error } = await supabase
      .from("roster_schedules")
      .select("date, shift_code, profile_id, staff_profiles(full_name, branch_assigned)")
      .gte("date", ymd(from)).lte("date", ymd(to));
    if (!error && data && data.length) {
      const byKey: Record<string, { calicut: string[]; cochin: string[] }> = {};
      data.forEach((r: any) => {
        if (REST_CODES.has(lc(r.shift_code))) return;
        const sp = r.staff_profiles || {};
        const name = sp.full_name;
        if (!name) return;
        const d = new Date(`${r.date}T00:00:00`);
        if (isNaN(d.getTime())) return;
        const b = branchOf(sp.branch_assigned || profileBranch[r.profile_id]);
        const cell = (byKey[keyOf(d)] ||= { calicut: [], cochin: [] });
        if (b === "cochin") { if (!cell.cochin.includes(name)) cell.cochin.push(name); }
        else { if (!cell.calicut.includes(name)) cell.calicut.push(name); }
      });
      F._liveRoster = byKey;
      const baseRosterOn = F.rosterOn.bind(F);
      F.rosterOn = (d: Date, branch: string) => {
        const cell = F._liveRoster && F._liveRoster[keyOf(d)];
        if (!cell) return baseRosterOn(d, branch);
        if (branch === "global") return [...cell.calicut, ...cell.cochin];
        return cell[branch] || [];
      };
    }
  } catch (e) { /* keep seed */ }

  /* ---- news ticker (powers the redesigned News page) ---- */
  try {
    const { data, error } = await supabase
      .from("news_ticker").select("*").order("created_at", { ascending: false });
    if (!error && data) {
      F._news = data.map((n: any) => ({
        id: n.id,
        body: n.content || n.message || n.text || n.title || "",
        priority: lc(n.priority) || "normal",
        active: n.is_active !== false,
        when: n.created_at ? new Date(n.created_at).toLocaleDateString() : "",
      })).filter((n: any) => n.body);
    }
  } catch (e) { /* leave undefined → empty state */ }

  /* ---- lost & found ---- */
  try {
    const { data, error } = await supabase
      .from("lost_found_items").select("*").order("created_at", { ascending: false });
    if (!error && data && data.length) {
      F._lostFound = data.map((i: any) => ({
        id: i.id,
        item: i.item_name || i.name || i.description || "Item",
        where: i.location || i.found_location || "—",
        when: i.created_at ? new Date(i.created_at).toLocaleDateString() : "",
        branch: branchOf(i.branch || i.branch_location),
        locker: i.locker || i.locker_no || "",
        status: lc(i.status).includes("claim") ? "claimed" : "stored",
        by: i.reported_by || i.logged_by || "",
      }));
    }
  } catch (e) { /* keep seed */ }

  /* ---- cases (incidents) ---- */
  try {
    const { data, error } = await supabase.from("incidents").select("*").order("created_at", { ascending: false }).limit(60);
    if (!error && data && data.length) {
      const mapStatus = (s: string) => { s = lc(s); if (s.includes("resolv") || s.includes("close") || s.includes("done")) return "resolved"; if (s.includes("progress")) return "progress"; return "open"; };
      const mapPrio = (p: string) => { p = lc(p); if (p.includes("urgent") || p.includes("critical")) return "Urgent"; if (p.includes("high")) return "High"; if (p.includes("low")) return "Low"; return "Medium"; };
      F.CASES = data.map((c: any, i: number) => ({
        _dbId: c.id,
        id: c.case_id || c.ref || `FC-${c.id ?? i}`,
        subject: c.title || c.subject || c.summary || "Case",
        category: c.category || "Technical",
        priority: mapPrio(c.priority || c.severity),
        branch: branchOf(c.branch_location || c.branch),
        vendor: c.vendor || null,
        status: mapStatus(c.status),
        assignee: c.assigned_to || c.assignee || "",
        opened: c.created_at ? new Date(c.created_at).toLocaleString() : "",
        age: "",
        detail: c.description || c.details || "",
        contact: null,
        thread: [],
      }));
    }
  } catch (e) { /* keep seed */ }

  /* ---- my tasks (user_tasks) ---- */
  try {
    const { data, error } = await supabase.from("user_tasks").select("*").order("created_at", { ascending: false }).limit(80);
    if (!error && data && data.length) {
      const mapPrio = (p: string) => { p = lc(p); if (p.includes("critical") || p.includes("urgent")) return "Critical"; if (p.includes("high")) return "High"; if (p.includes("low")) return "Low"; return "Medium"; };
      F.DESK_TASKS = data.map((t: any, i: number) => ({
        id: t.id ? String(t.id) : "t" + i,
        title: t.title || t.task || t.name || "Task",
        source: (t.assigned_by || t.created_by) ? "Supervisor" : "Self",
        by: t.assigned_by || t.created_by || "You",
        due: t.due_date ? new Date(t.due_date).toLocaleDateString() : (t.due || "—"),
        priority: mapPrio(t.priority),
        status: (t.is_completed || lc(t.status) === "completed" || lc(t.status) === "done") ? "Completed" : (lc(t.status).includes("progress") ? "In Progress" : "Pending"),
        comment: t.description || t.notes || "",
        proof: false,
      }));
    }
  } catch (e) { /* keep seed */ }

  /* ---- leave requests (my leave) ---- */
  try {
    const { data, error } = await supabase.from("leave_requests").select("*").order("created_at", { ascending: false }).limit(40);
    if (!error && data && data.length) {
      F.MY_LEAVE = data.map((l: any, i: number) => ({
        id: l.id ? String(l.id) : "l" + i,
        type: l.leave_type || l.type || "Leave",
        date: l.requested_date ? new Date(l.requested_date).toLocaleDateString() : (l.date || ""),
        status: l.status || "Submitted",
        comment: l.reason || l.comment || "",
      }));
    }
  } catch (e) { /* keep seed */ }

  /* ---- attendance → worked-hours log (best effort, current user) ---- */
  try {
    const { data: au } = await supabase.auth.getUser();
    const uid = au?.user?.id;
    if (uid) {
      const { data: prof } = await supabase.from("staff_profiles").select("id").eq("user_id", uid).maybeSingle();
      const sid = (prof as any)?.id;
      if (sid) {
        const fromA = new Date(today); fromA.setDate(fromA.getDate() - 30);
        const { data, error } = await supabase.from("staff_attendance").select("*").eq("staff_id", sid).gte("date", ymd(fromA)).lte("date", ymd(today)).order("date", { ascending: false });
        if (!error && data && data.length) {
          const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const hm = (t: string) => { if (!t) return 0; const [h, m] = String(t).split(":").map(Number); return h * 60 + (m || 0); };
          const mapped = data.map((r: any) => {
            const d = new Date(`${r.date}T00:00:00`);
            const inT = (r.check_in || "").slice(0, 5), outT = (r.check_out || "").slice(0, 5);
            const worked = inT && outT ? Math.max(0, hm(outT) - hm(inT)) : 0;
            const st = lc(r.status);
            return { key: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`, label: `${DOW[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`, inT: inT || "—", outT: outT || "—", breakMins: 0, workedMins: worked, status: st.includes("late") ? "late" : st.includes("half") ? "half" : st.includes("absent") ? "leave" : "present" };
          });
          if (mapped.length) localStorage.setItem("fets-worklog-1", JSON.stringify(mapped));
        }
      }
    }
  } catch (e) { /* keep seed */ }

  F._liveLoaded = true;
}
