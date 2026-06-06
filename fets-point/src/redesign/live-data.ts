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
const REST_CODES = new Set(["rd", "off", "wo", "l", "leave", "lv", "h", "holiday", "to", "toil", "tr", "tp"]);

export async function loadLiveData(F: any) {
  if (!F || F._liveLoaded) return;
  F._dbRoster = F._dbRoster || {};
  F._staffIdByName = F._staffIdByName || {};
  F._staffUserIdByName = F._staffUserIdByName || {};
  F._userIdToProfileId = F._userIdToProfileId || {};
  F._profileIdToUserId = F._profileIdToUserId || {};
  const today = new Date();
  const from = new Date(today); from.setDate(from.getDate() - 35);
  const to = new Date(today); to.setDate(to.getDate() + 70);

  /* ---- calendar + roster load per-month on demand — see ensureMonth() below ---- */

  /* ---- current user (for write-back: profile_id / user_id) ---- */
  try { const { data: au } = await supabase.auth.getUser(); F._meUserId = au?.user?.id || null; } catch (e) { F._meUserId = null; }

  /* ---- staff pool (for roster grid + quick-add) + name→id map ---- */
  let profileBranch: Record<string, string> = {};
  try {
    const { data, error } = await supabase
      .from("staff_profiles").select("id, user_id, full_name, role, branch_assigned, is_active, hourly_rate, daily_rate").order("full_name");
    if (!error && data && data.length) {
      const pool: Record<string, string[]> = { calicut: [], cochin: [] };
      const idByName: Record<string, any> = {};
      const userIdByName: Record<string, any> = {};
      const userIdToProfileId: Record<string, string> = {};
      const profileIdToUserId: Record<string, string> = {};
      
      F._staffRatesByProfileId = F._staffRatesByProfileId || {};
      F._staffRatesByName = F._staffRatesByName || {};

      data.forEach((p: any) => {
        const b = branchOf(p.branch_assigned);
        const list = pool[b] || (pool[b] = []);
        if (p.full_name) list.push(p.full_name);
        if (p.id) {
          profileBranch[p.id] = b;
          F._staffRatesByProfileId[p.id] = { hourly_rate: Number(p.hourly_rate) || 0, daily_rate: Number(p.daily_rate) || 0 };
        }
        if (p.full_name && p.id) {
          idByName[p.full_name] = p.id;
          F._staffRatesByName[p.full_name] = { id: p.id, user_id: p.user_id, role: p.role, hourly_rate: Number(p.hourly_rate) || 0, daily_rate: Number(p.daily_rate) || 0, is_active: p.is_active };
        }
        if (p.full_name && p.user_id) userIdByName[p.full_name] = p.user_id;
        if (p.id && p.user_id) {
          userIdToProfileId[p.user_id] = p.id;
          profileIdToUserId[p.id] = p.user_id;
        }
        if (F._meUserId && p.user_id === F._meUserId) { F._meId = p.id; F._meName = p.full_name; F._meBranch = b; }
      });
      F._staffIdByName = idByName;
      F._staffUserIdByName = userIdByName;
      F._userIdToProfileId = userIdToProfileId;
      F._profileIdToUserId = profileIdToUserId;
      const activeStaff = data
        .filter((p: any) => p.is_active !== false && p.full_name)
        .map((p: any) => p.full_name.trim());
      F.PEOPLE = Array.from(new Set(activeStaff)).sort((x, y) => x.localeCompare(y));
      if (pool.calicut.length || pool.cochin.length) {
        F.STAFF = { calicut: pool.calicut.length ? pool.calicut : F.STAFF.calicut, cochin: pool.cochin.length ? pool.cochin : F.STAFF.cochin };
      }
    }
  } catch (e) { /* keep seed */ }

  /* ---- install live roster override, then load nearby months ---- */
  if (!F._rosterPatched) {
    const baseRosterOn = F.rosterOn.bind(F);
    F.rosterOn = (d: Date, branch: string) => {
      const cell = F._liveRoster && F._liveRoster[keyOf(d)];
      if (!cell) return baseRosterOn(d, branch);
      if (branch === "global") return [...cell.calicut, ...cell.cochin];
      return cell[branch] || [];
    };
    const baseRosterGet = F.rosterGet.bind(F);
    F.rosterGet = (name: string) => {
      const local = baseRosterGet(name) || {};
      const db = (F._dbRoster && F._dbRoster[name]) || {};
      return { ...db, ...local };
    };
    F._rosterPatched = true;
  }

  if (!F._reqPatched) {
    F.staffReqList = () => {
      return F._staffRequests || [];
    };
    F.staffReqAdd = (req: any) => {
      F._staffRequests = [req, ...(F._staffRequests || [])];
      window.dispatchEvent(new Event("fets-roster-changed"));
      return F._staffRequests;
    };
    F.staffReqResolve = (id: string, status: string) => {
      F._staffRequests = (F._staffRequests || []).map((r: any) =>
        r.id === id ? { ...r, status } : r
      );
      window.dispatchEvent(new Event("fets-roster-changed"));
      return F._staffRequests;
    };
    F._reqPatched = true;
  }

  await ensureMonth(today);
  ensureMonth(new Date(today.getFullYear(), today.getMonth() - 1, 1));
  ensureMonth(new Date(today.getFullYear(), today.getMonth() + 1, 1));

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
    if (!error && data) {
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
    const { data, error } = await supabase.from("incidents").select("*").order("created_at", { ascending: false }).limit(1000);
    if (!error && data) {
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
    const { data, error } = await supabase.from("user_tasks").select("*").order("created_at", { ascending: false }).limit(1000);
    if (!error && data) {
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
    const { data, error } = await supabase
      .from("leave_requests")
      .select(`
        *,
        requestor:staff_profiles!leave_requests_user_id_fkey(full_name, branch_assigned),
        target:staff_profiles!leave_requests_swap_with_user_id_fkey(full_name)
      `)
      .order("created_at", { ascending: false });

    if (!error && data) {
      F._staffRequests = data.map((r: any) => {
        const who = r.requestor?.full_name || "Unknown";
        const branch = branchOf(r.requestor?.branch_assigned);
        const withWho = r.target?.full_name || "";
        
        let status = "Submitted";
        if (r.status === "approved" || r.status === "Approved") status = "Approved";
        if (r.status === "rejected" || r.status === "Rejected") status = "Rejected";

        let kind = "leave";
        if (r.request_type === "shift_swap" || r.request_type === "swap") kind = "swap";
        if (r.request_type === "toil") kind = "toil";

        let leaveType = "";
        let reason = r.reason || "";
        if (kind === "leave") {
          const m = reason.match(/^\[(.*?)\]\s*(.*)/);
          if (m) {
            leaveType = m[1];
            reason = m[2];
          } else {
            leaveType = "Full-day leave";
          }
        } else if (kind === "toil") {
          leaveType = "TOIL Redeemed";
        }

        return {
          id: String(r.id),
          kind,
          who,
          with: withWho,
          branch,
          leaveType,
          days: r.request_type === "toil" ? 1 : undefined,
          date: r.requested_date || "",
          swapDate: r.swap_date || "",
          reason,
          status,
          user_id: r.user_id,
          swap_with_user_id: r.swap_with_user_id
        };
      });

      F.MY_LEAVE = F._staffRequests
        .filter((r: any) => r.user_id === F._meId || r.who === F.user.name)
        .map((r: any) => ({
          id: r.id,
          type: r.leaveType || (r.kind === "swap" ? "Shift swap" : "Leave"),
          date: r.date,
          status: r.status,
          comment: r.reason,
        }));
    }
  } catch (e) { /* keep seed */ }

  /* ---- current user toil balance ---- */
  try {
    if (F._meId) {
      const { data, error } = await supabase
        .from("roster_schedules")
        .select("shift_code")
        .eq("profile_id", F._meId);
      if (!error && data) {
        const toilEarned = data.filter((r: any) => String(r.shift_code).toUpperCase() === "TOIL").length;
        const toilRedeemed = data.filter((r: any) => String(r.shift_code).toUpperCase() === "TR").length;
        const toilPaid = data.filter((r: any) => String(r.shift_code).toUpperCase() === "TP").length;
        F._meToilBalance = toilEarned - toilRedeemed - toilPaid;
        F._meToilEarned = toilEarned;
        F._meToilRedeemed = toilRedeemed;
        F._meToilPaid = toilPaid;
      }
    }
  } catch (e) { /* ignore */ }

  /* ---- attendance → worked-hours log (best effort, current user) ---- */
  try {
    const { data: au } = await supabase.auth.getUser();
    const uid = au?.user?.id;
    if (uid) {
      const { data: prof } = await supabase.from("staff_profiles").select("id").eq("user_id", uid).maybeSingle();
      const sid = (prof as any)?.id;
      if (sid) {
        const fromA = new Date(today); fromA.setDate(fromA.getDate() - 365);
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

  /* ---- vault (fets_vault, current user) ---- */
  try {
    if (F._meUserId) {
      const { data, error } = await supabase.from("fets_vault").select("*").eq("user_id", F._meUserId).order("created_at", { ascending: false });
      if (!error && data) {
        F._vault = data.map((v: any) => ({
          id: v.id, title: v.title || "Entry", category: v.category || "General",
          username: v.username || "", password: v.password || "", url: v.url || "", notes: v.notes || "",
        }));
      }
    }
  } catch (e) { /* keep empty */ }

  try {
    await loadOtClaims(F);
  } catch (e) {
    console.error("Error loading OT claims on startup:", e);
  }

  F._liveLoaded = true;
}

/* =====================================================================
   ON-DEMAND MONTH LOADER — fetches calendar_sessions + roster_schedules
   for ONE month (keeps each query well under Supabase's 1000-row cap) and
   merges into the live caches. Pages call this for whatever month they show,
   so the calendar/roster cover any range — past or future, not just today.
   ===================================================================== */
const _loadedMonths = new Set<string>();
export async function ensureMonth(d: Date) {
  const F = window.FETS; if (!F) return false;
  const y = d.getFullYear(), m = d.getMonth();
  const mkey = `${y}-${m}`;
  if (_loadedMonths.has(mkey)) return false;
  _loadedMonths.add(mkey);
  const first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
  F._liveSessions = F._liveSessions || {};
  F._liveRoster = F._liveRoster || {};
  // mark every day in the month as "live, empty" so loaded-but-empty days
  // don't fall back to generated sample data
  for (let dd = 1; dd <= last.getDate(); dd++) {
    const k = `${y}-${m}-${dd}`;
    if (!(k in F._liveSessions)) F._liveSessions[k] = [];
    if (!(k in F._liveRoster)) F._liveRoster[k] = { calicut: [], cochin: [] };
  }
  let ok = false;
  try {
    const { data, error } = await supabase.from("calendar_sessions").select("*")
      .gte("date", ymd(first)).lte("date", ymd(last));
    if (!error && data) {
      data.forEach((s: any) => {
        const dt = new Date(`${s.date}T00:00:00`); if (isNaN(dt.getTime())) return;
        const k = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
        (F._liveSessions[k] || (F._liveSessions[k] = [])).push({
          id: s.id, vendor: clientToSlug(s.client_name || s.exam_name),
          exam: s.exam_name || s.client_name || "Exam session", count: Number(s.candidate_count) || 0,
          start: (s.start_time || "09:00").slice(0, 5), end: (s.end_time || s.start_time || "").slice(0, 5),
          branch: branchOf(s.branch_location || s.branch),
        });
      });
      Object.keys(F._liveSessions).forEach((k) => { const a = F._liveSessions[k]; if (Array.isArray(a)) a.sort((x: any, z: any) => x.start.localeCompare(z.start)); });
      ok = true;
    }
  } catch (e) {}
  try {
    const { data, error } = await supabase.from("roster_schedules")
      .select("date, shift_code, overtime_hours, profile_id, staff_profiles(full_name, branch_assigned)")
      .gte("date", ymd(first)).lte("date", ymd(last));
    if (!error && data) {
      F._dbRoster = F._dbRoster || {};
      data.forEach((r: any) => {
        const sp = r.staff_profiles || {}; const name = sp.full_name; if (!name) return;
        const dt = new Date(`${r.date}T00:00:00`); if (isNaN(dt.getTime())) return;
        
        // Calculate offset and populate DB roster override cache
        const off = F.offsetOf(dt);
        if (off != null && !isNaN(off)) {
          F._dbRoster[name] = F._dbRoster[name] || {};
          F._dbRoster[name][off] = { code: r.shift_code, ot: Number(r.overtime_hours) || 0 };
        }

        if (REST_CODES.has(lc(r.shift_code))) return;
        const k = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
        const b = branchOf(sp.branch_assigned);
        const cell = F._liveRoster[k] || (F._liveRoster[k] = { calicut: [], cochin: [] });
        if (b === "cochin") { if (!cell.cochin.includes(name)) cell.cochin.push(name); }
        else { if (!cell.calicut.includes(name)) cell.calicut.push(name); }
      });
      ok = true;
    }
  } catch (e) {}
  if (!ok) { _loadedMonths.delete(mkey); return false; } // allow retry on hard failure
  window.dispatchEvent(new Event("fets-data-loaded"));
  window.dispatchEvent(new Event("fets-roster-changed"));
  window.dispatchEvent(new Event("fets-sess-changed"));
  return true;
}

export async function loadOtClaims(F: any) {
  if (!F) return;
  try {
    const isAdmin = !!F.isAdmin;
    let query = supabase
      .from("staff_ot_claims")
      .select(`
        id,
        profile_id,
        date,
        start_time,
        end_time,
        ot_hours,
        toil_payout,
        status,
        notes,
        created_at,
        staff_profiles(full_name, branch_assigned, hourly_rate, daily_rate)
      `);
    
    if (!isAdmin && F._meId) {
      query = query.eq("profile_id", F._meId);
    }
    
    const { data, error } = await query.order("date", { ascending: false });
    if (!error && data) {
      F._otClaims = data.map((c: any) => {
        const sp = c.staff_profiles || {};
        return {
          id: c.id,
          profile_id: c.profile_id,
          name: sp.full_name || "Unknown",
          branch: branchOf(sp.branch_assigned),
          date: c.date,
          start_time: c.start_time ? c.start_time.slice(0, 5) : "17:00",
          end_time: c.end_time ? c.end_time.slice(0, 5) : "",
          ot_hours: Number(c.ot_hours) || 0,
          toil_payout: !!c.toil_payout,
          status: c.status || "pending",
          notes: c.notes || "",
          hourly_rate: Number(sp.hourly_rate) || 0,
          daily_rate: Number(sp.daily_rate) || 0,
          created_at: c.created_at,
        };
      });
      window.dispatchEvent(new Event("fets-ot-claims-changed"));
    }
  } catch (e) {
    console.error("loadOtClaims error:", e);
  }
}

