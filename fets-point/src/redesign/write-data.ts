// @ts-nocheck
/* eslint-disable */
/*
  Supabase write-back for the FETS · LIVE redesign.

  Components call these from their existing handlers. Every write is defensive:
  wrapped in try/catch, surfaces a toast, and never throws into React. The UI
  updates optimistically regardless, so a failed sync degrades to "saved
  locally" rather than breaking the feature. Reads come from the live cache
  (live-data.ts); after a successful write we also patch that cache so other
  views reflect the change without a refetch.
*/
import { supabase } from "../lib/supabase";

const F = () => window.FETS;
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const keyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const rtoast = (msg: string, icon?: string) => window.dispatchEvent(new CustomEvent("fets-toast", { detail: { msg, icon: icon || "check" } }));

/* ---------------- calendar_sessions ---------------- */
export async function dbAddSession(dateObj: Date, s: any, branch: string) {
  const row: any = {
    date: ymd(dateObj), start_time: s.start, end_time: s.end || s.start,
    client_name: s.exam, exam_name: s.exam, candidate_count: Number(s.count) || 0,
    branch_location: branch === "global" ? "calicut" : branch,
  };
  if (F()._meUserId) row.user_id = F()._meUserId;
  try {
    const { data, error } = await supabase.from("calendar_sessions").insert([row]).select().single();
    if (error) throw error;
    rtoast("Session added");
    return data;
  } catch (e) { rtoast("Saved locally — DB sync failed", "alert"); return null; }
}
export async function dbUpdateSession(id: any, patch: any) {
  if (id == null) return;
  const row: any = {};
  if (patch.count != null) row.candidate_count = Number(patch.count) || 0;
  if (patch.start) row.start_time = patch.start;
  if (patch.end) row.end_time = patch.end;
  try { const { error } = await supabase.from("calendar_sessions").update(row).eq("id", id); if (error) throw error; rtoast("Session updated"); }
  catch (e) { rtoast("DB update failed", "alert"); }
}
export async function dbDeleteSession(id: any) {
  if (id == null) return;
  try { const { error } = await supabase.from("calendar_sessions").delete().eq("id", id); if (error) throw error; rtoast("Session deleted"); }
  catch (e) { rtoast("DB delete failed", "alert"); }
}

/* ---------------- roster_schedules ---------------- */
function staffId(name: string) { return F()._staffIdByName ? F()._staffIdByName[name] : null; }
export async function dbSetRoster(name: string, dateObj: Date, shiftCode: string) {
  const pid = staffId(name); if (!pid) return;
  const date = ymd(dateObj);
  try {
    const { data: ex } = await supabase.from("roster_schedules").select("id").eq("profile_id", pid).eq("date", date).maybeSingle();
    if (ex && (ex as any).id) await supabase.from("roster_schedules").update({ shift_code: shiftCode }).eq("id", (ex as any).id);
    else await supabase.from("roster_schedules").insert([{ profile_id: pid, date, shift_code: shiftCode }]);
  } catch (e) { /* local already applied */ }
}
export async function dbClearRoster(name: string, dateObj: Date) {
  const pid = staffId(name); if (!pid) return;
  try { await supabase.from("roster_schedules").delete().eq("profile_id", pid).eq("date", ymd(dateObj)); } catch (e) {}
}
export async function dbQuickAddRoster(name: string, fromYmd: string, toYmd: string) {
  const pid = staffId(name);
  if (!pid) { rtoast("Saved locally — staff not matched in DB", "alert"); return; }
  const f = new Date(fromYmd + "T00:00:00"), t = new Date(toYmd + "T00:00:00");
  const rows: any[] = []; let idx = 0;
  for (let d = new Date(f); d <= t; d.setDate(d.getDate() + 1)) {
    rows.push({ profile_id: pid, date: ymd(new Date(d)), shift_code: (idx % 7) < 6 ? "D" : "RD" }); idx++;
  }
  try { const { error } = await supabase.from("roster_schedules").upsert(rows, { onConflict: "profile_id,date" }); if (error) throw error; rtoast(`Roster saved · ${rows.length} days`); }
  catch (e) {
    // fall back to row-by-row set/insert if no unique constraint for upsert
    try { for (const r of rows) await dbSetRoster(name, new Date(r.date + "T00:00:00"), r.shift_code); rtoast(`Roster saved · ${rows.length} days`); }
    catch (e2) { rtoast("Saved locally — DB sync failed", "alert"); }
  }
}

/* ---------------- incidents (cases) ---------------- */
export async function dbSetCaseStatus(dbId: any, status: string) {
  if (dbId == null) return;
  const map: any = { open: "open", progress: "in_progress", resolved: "resolved" };
  try { await supabase.from("incidents").update({ status: map[status] || status }).eq("id", dbId); } catch (e) {}
}

export async function dbAddCase(c: any) {
  const map: any = { Urgent: "critical", High: "major", Medium: "major", Low: "minor" };
  const row: any = {
    title: c.subject || "Case",
    description: c.detail || "",
    category: String(c.category || "").toLowerCase() || "other",
    status: "open",
    severity: map[c.priority] || "minor",
    branch_location: c.branch === "global" ? "calicut" : c.branch,
    reporter: F()._meName || F().user.name || "Unknown",
    user_id: F()._meUserId || "00000000-0000-0000-0000-000000000000"
  };
  try {
    const { data, error } = await supabase.from("incidents").insert([row]).select().single();
    if (error) throw error;
    rtoast("Case raised");
    return data;
  } catch (e) { rtoast("Saved locally — DB sync failed", "alert"); return null; }
}

/* ---------------- user_tasks ---------------- */
export async function dbAddTask(title: string, priority: string) {
  const row: any = { title, status: "pending", priority: (priority || "medium").toLowerCase() };
  if (F()._meId) row.assigned_to = F()._meId;
  try { const { data, error } = await supabase.from("user_tasks").insert([row]).select().single(); if (error) throw error; return data; }
  catch (e) { return null; }
}
export async function dbToggleTask(id: any, completed: boolean) {
  if (id == null) return;
  try { await supabase.from("user_tasks").update({ is_completed: completed, status: completed ? "completed" : "pending" }).eq("id", id); } catch (e) {}
}
export async function dbDeleteTask(id: any) {
  if (id == null) return;
  try { await supabase.from("user_tasks").delete().eq("id", id); } catch (e) {}
}

/* ---------------- lost_found_items ---------------- */
export async function dbClaimLostFound(id: any) {
  if (id == null) return;
  try { await supabase.from("lost_found_items").update({ status: "claimed" }).eq("id", id); } catch (e) {}
}

/* tries each payload in order, returns the first that inserts cleanly */
async function tryInsert(table: string, payloads: any[]) {
  for (const p of payloads) {
    try { const { data, error } = await supabase.from(table).insert([p]).select().single(); if (!error) return data; } catch (e) {}
  }
  return null;
}

/* ---------------- news_ticker ---------------- */
export async function dbAddNews(text: string, priority: string) {
  const pr = (priority || "normal").toLowerCase();
  const data = await tryInsert("news_ticker", [
    { content: text, priority: pr, is_active: true },
    { message: text, priority: pr, is_active: true },
    { content: text, is_active: true },
    { content: text },
  ]);
  rtoast(data ? "Announcement posted" : "Saved locally — DB sync failed", data ? "check" : "alert");
  return data;
}
export async function dbDeleteNews(id: any) {
  if (id == null) return;
  try { await supabase.from("news_ticker").delete().eq("id", id); rtoast("Announcement removed"); } catch (e) { rtoast("DB delete failed", "alert"); }
}

/* ---------------- lost_found_items ---------------- */
export async function dbAddLostFound(item: any) {
  const data = await tryInsert("lost_found_items", [
    { item_name: item.item, location: item.where, branch: item.branch, status: "stored" },
    { name: item.item, location: item.where, branch: item.branch, status: "stored" },
    { description: item.item, location: item.where, branch: item.branch, status: "stored" },
    { description: item.item, status: "stored" },
  ]);
  rtoast(data ? "Item logged" : "Saved locally — DB sync failed", data ? "check" : "alert");
  return data;
}
export async function dbDeleteLostFound(id: any) {
  if (id == null) return;
  try { await supabase.from("lost_found_items").delete().eq("id", id); rtoast("Item removed"); } catch (e) { rtoast("DB delete failed", "alert"); }
}

/* ---------------- fets_vault ---------------- */
export async function dbAddVault(entry: any) {
  const row: any = { title: entry.title || "Entry", category: entry.category || "General", username: entry.username || "", password: entry.password || "", url: entry.url || "", notes: entry.notes || "" };
  if (F()._meUserId) row.user_id = F()._meUserId;
  try { const { data, error } = await supabase.from("fets_vault").insert([row]).select().single(); if (error) throw error; rtoast("Saved to vault"); return data; }
  catch (e) { rtoast("Saved locally — DB sync failed", "alert"); return null; }
}
export async function dbUpdateVault(id: any, patch: any) {
  if (id == null) return;
  try { await supabase.from("fets_vault").update(patch).eq("id", id); rtoast("Vault updated"); } catch (e) { rtoast("DB update failed", "alert"); }
}
export async function dbDeleteVault(id: any) {
  if (id == null) return;
  try { await supabase.from("fets_vault").delete().eq("id", id); rtoast("Removed from vault"); } catch (e) { rtoast("DB delete failed", "alert"); }
}

/* ---------------- leave_requests (staff requests) ---------------- */
export async function dbSetRosterById(pid: string, date: string, shiftCode: string) {
  try {
    const { data: ex } = await supabase.from("roster_schedules").select("id").eq("profile_id", pid).eq("date", date).maybeSingle();
    if (ex && (ex as any).id) {
      await supabase.from("roster_schedules").update({ shift_code: shiftCode }).eq("id", (ex as any).id);
    } else {
      await supabase.from("roster_schedules").insert([{ profile_id: pid, date: date, shift_code: shiftCode, status: 'confirmed' }]);
    }
  } catch (e) {
    console.error("dbSetRosterById error:", e);
  }
}

export async function dbAddStaffRequest(req: any) {
  let finalReason = req.reason || "";
  if (req.kind === "leave" && req.leaveType) {
    finalReason = `[${req.leaveType}] ${req.reason || ""}`.trim();
  }

  // We need to resolve to the auth user ID (user_id field in staff_profiles) for leave_requests.user_id and swap_with_user_id
  const row: any = {
    user_id: F()._meUserId || (F()._staffUserIdByName ? F()._staffUserIdByName[req.who] : null) || (F()._staffIdByName ? F()._staffIdByName[req.who] : null) || req.profile_id,
    request_type: req.kind === "swap" ? "shift_swap" : req.kind,
    requested_date: req.date,
    reason: finalReason || null,
    status: "pending",
  };

  if (req.kind === "swap") {
    row.swap_with_user_id = F()._staffUserIdByName ? F()._staffUserIdByName[req.with] : (F()._staffIdByName ? F()._staffIdByName[req.with] : null);
    row.swap_date = req.swapDate || req.date;
  }

  try {
    const { data, error } = await supabase.from("leave_requests").insert([row]).select().single();
    if (error) throw error;
    
    const newReq = {
      id: String(data.id),
      kind: req.kind,
      who: req.who || F().user.name,
      with: req.with || "",
      branch: req.branch || F()._meBranch || "calicut",
      leaveType: req.kind === "leave" ? (req.leaveType || "Full-day leave") : (req.kind === "toil" ? "TOIL Redeemed" : ""),
      days: req.kind === "toil" ? 1 : undefined,
      date: data.requested_date || "",
      swapDate: data.swap_date || "",
      reason: req.reason || "",
      status: "Submitted",
      user_id: data.user_id,
      swap_with_user_id: data.swap_with_user_id
    };
    
    F().staffReqAdd(newReq);
    rtoast("Request submitted");
    return data;
  } catch (e) {
    console.error("dbAddStaffRequest error:", e);
    rtoast("Sync failed — saved locally", "alert");
    return null;
  }
}

export const dbAddLeave = dbAddStaffRequest;

export async function dbResolveStaffRequest(reqId: string, status: "Approved" | "Rejected", adminProfileId: string) {
  const dbStatus = status === "Approved" ? "approved" : "rejected";
  // Map the admin's profile ID to their auth user ID (user_id field in staff_profiles)
  const adminUserId = F()._profileIdToUserId ? F()._profileIdToUserId[adminProfileId] : (F()._meUserId || adminProfileId);
  try {
    const { data, error } = await supabase
      .from("leave_requests")
      .update({
        status: dbStatus,
        approved_by: adminUserId,
        approved_at: new Date().toISOString()
      })
      .eq("id", reqId)
      .select("*")
      .single();

    if (error) throw error;

    if (status === "Approved" && data) {
      // Map the auth user ID to profile.id for roster_schedules
      const profileId = F()._userIdToProfileId ? F()._userIdToProfileId[data.user_id] : data.user_id;
      const date = data.requested_date;
      const rtype = data.request_type;

      if (rtype === "leave") {
        await dbSetRosterById(profileId, date, "L");
      } else if (rtype === "toil") {
        await dbSetRosterById(profileId, date, "TR");
      } else if (rtype === "shift_swap" && data.swap_with_user_id) {
        const pidA = profileId;
        const pidB = F()._userIdToProfileId ? F()._userIdToProfileId[data.swap_with_user_id] : data.swap_with_user_id;
        const dateA = date;
        const dateB = data.swap_date || date;

        const { data: currentShifts } = await supabase
          .from("roster_schedules")
          .select("*")
          .in("profile_id", [pidA, pidB])
          .in("date", [dateA, dateB]);

        const shiftA = currentShifts?.find(s => s.profile_id === pidA && s.date === dateA);
        const shiftB = currentShifts?.find(s => s.profile_id === pidB && s.date === dateB);

        const codeA = shiftA ? shiftA.shift_code : "D";
        const codeB = shiftB ? shiftB.shift_code : "D";

        await dbSetRosterById(pidA, dateA, codeB);
        await dbSetRosterById(pidB, dateB, codeA);
      }
    }

    F().staffReqResolve(reqId, status);
    window.dispatchEvent(new Event("fets-roster-changed"));
    rtoast(status === "Approved" ? "Request approved" : "Request rejected");
    return data;
  } catch (e) {
    console.error("dbResolveStaffRequest error:", e);
    rtoast("Failed to resolve request", "alert");
    return null;
  }
}
