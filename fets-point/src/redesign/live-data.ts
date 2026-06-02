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

  /* ---- staff pool (for roster grid + quick-add) ---- */
  let profileBranch: Record<string, string> = {};
  try {
    const { data, error } = await supabase
      .from("staff_profiles").select("id, full_name, role, branch_assigned").order("full_name");
    if (!error && data && data.length) {
      const pool: Record<string, string[]> = { calicut: [], cochin: [] };
      data.forEach((p: any) => {
        const b = branchOf(p.branch_assigned);
        const list = pool[b] || (pool[b] = []);
        if (p.full_name) list.push(p.full_name);
        if (p.id) profileBranch[p.id] = b;
      });
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

  F._liveLoaded = true;
}
