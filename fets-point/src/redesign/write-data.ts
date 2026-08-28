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
import { loadOtClaims } from "./live-data";

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
export async function dbSetRoster(name: string, dateObj: Date, shiftCode: string, branch?: string) {
  const pid = staffId(name); if (!pid) return;
  const date = ymd(dateObj);
  const staff = F()._staffRatesByName && F()._staffRatesByName[name];
  const scheduleBranch = branch && branch !== "global" ? branch : (F()._profileBranch && F()._profileBranch[pid]) || (staff?.branch_assigned || "calicut");
  try {
    const { data: ex } = await supabase.from("roster_schedules").select("id").eq("profile_id", pid).eq("date", date).maybeSingle();
    if (ex && (ex as any).id) await supabase.from("roster_schedules").update({ shift_code: shiftCode, branch_location: scheduleBranch }).eq("id", (ex as any).id);
    else await supabase.from("roster_schedules").insert([{ profile_id: pid, date, shift_code: shiftCode, branch_location: scheduleBranch }]);
  } catch (e) { /* local already applied */ }
}
export async function dbClearRoster(name: string, dateObj: Date) {
  const pid = staffId(name); if (!pid) return;
  try { await supabase.from("roster_schedules").delete().eq("profile_id", pid).eq("date", ymd(dateObj)); } catch (e) {}
}
export async function dbQuickAddRoster(name: string, fromYmd: string, toYmd: string, branch?: string) {
  const pid = staffId(name);
  if (!pid) { rtoast("Saved locally — staff not matched in DB", "alert"); return; }
  const f = new Date(fromYmd + "T00:00:00"), t = new Date(toYmd + "T00:00:00");
  const staff = F()._staffRatesByName && F()._staffRatesByName[name];
  const scheduleBranch = branch && branch !== "global" ? branch : (F()._profileBranch && F()._profileBranch[pid]) || (staff?.branch_assigned || "calicut");
  const rows: any[] = []; let idx = 0;
  for (let d = new Date(f); d <= t; d.setDate(d.getDate() + 1)) {
    rows.push({ profile_id: pid, date: ymd(new Date(d)), shift_code: (idx % 7) < 6 ? "D" : "RD", branch_location: scheduleBranch }); idx++;
  }
  try { const { error } = await supabase.from("roster_schedules").upsert(rows, { onConflict: "profile_id,date" }); if (error) throw error; rtoast(`Roster saved · ${rows.length} days`); }
  catch (e) {
    // fall back to row-by-row set/insert if no unique constraint for upsert
    try { for (const r of rows) await dbSetRoster(name, new Date(r.date + "T00:00:00"), r.shift_code, branch); rtoast(`Roster saved · ${rows.length} days`); }
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

export async function dbAssignCase(dbId: any, staffName: string) {
  if (dbId == null) return;
  try { await supabase.from("incidents").update({ assigned_to: staffName }).eq("id", dbId); } catch (e) {}
}

export async function dbAddCaseComment(caseDbId: any, body: string) {
  if (caseDbId == null) return null;
  const row: any = {
    incident_id: caseDbId,
    author_id: F()._meUserId || "00000000-0000-0000-0000-000000000000",
    author_full_name: F()._meName || F().user.name || "Staff",
    body: body.trim()
  };
  try {
    const { data, error } = await supabase.from("incident_comments").insert([row]).select().single();
    if (error) throw error;
    return data;
  } catch (e) {
    console.error("dbAddCaseComment error:", e);
    return null;
  }
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
export async function dbClaimLostFound(id: any, claimant?: { name: string; contact: string; idProof: string; date?: string }) {
  if (id == null) return;
  const payload: any = { status: "claimed" };
  if (claimant) {
    payload.returned_date = claimant.date || new Date().toISOString();
    payload.returned_to_name = claimant.name;
    payload.returned_to_contact = claimant.contact;
    payload.returned_to_id_proof = claimant.idProof;
  } else {
    payload.returned_date = new Date().toISOString();
  }
  try { await supabase.from("lost_found_items").update(payload).eq("id", id); } catch (e) {}
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
  const payload = {
    description: item.item,
    found_date: item.when || new Date().toISOString(),
    found_location: item.where,
    found_by_staff_id: item.by || null,
    branch_location: item.branch,
    perishable: !!item.perishable,
    locker: item.locker || null,
    reference_no: item.reference_no ? parseInt(item.reference_no, 10) : null,
    exam_details: item.exam_details || null,
    cctv_dvr_no: item.cctv_dvr_no || null,
    candidate_details: item.candidate_details || null,
    contact_info: item.contact_info || null,
    status: "active"
  };

  const data = await tryInsert("lost_found_items", [
    payload,
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

/* ---------------- staff_branch_delegations ---------------- */
export async function dbAddBranchDelegation(delegation: any) {
  try {
    const { data, error } = await supabase
      .from("staff_branch_delegations")
      .insert([delegation])
      .select()
      .single();
    if (error) throw error;
    rtoast("Access delegation saved");
    return data;
  } catch (e) {
    rtoast("DB sync failed", "alert");
    return null;
  }
}
export async function dbDeleteBranchDelegation(id: any) {
  if (id == null) return;
  try {
    const { error } = await supabase
      .from("staff_branch_delegations")
      .delete()
      .eq("id", id);
    if (error) throw error;
    rtoast("Delegation revoked");
  } catch (e) {
    rtoast("Revocation failed", "alert");
  }
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
export async function dbSetRosterById(pid: string, date: string, shiftCode: string, branch?: string) {
  try {
    const { data: ex } = await supabase.from("roster_schedules").select("id").eq("profile_id", pid).eq("date", date).maybeSingle();
    let scheduleBranch = branch;
    if (!scheduleBranch) {
      if (F() && F()._profileBranch && F()._profileBranch[pid]) {
        scheduleBranch = F()._profileBranch[pid];
      } else {
        const { data: p } = await supabase.from("staff_profiles").select("branch_assigned").eq("id", pid).maybeSingle();
        scheduleBranch = p ? p.branch_assigned : "calicut";
      }
    }
    if (scheduleBranch === "global") scheduleBranch = "calicut";

    if (ex && (ex as any).id) {
      await supabase.from("roster_schedules").update({ shift_code: shiftCode, branch_location: scheduleBranch }).eq("id", (ex as any).id);
    } else {
      await supabase.from("roster_schedules").insert([{ profile_id: pid, date: date, shift_code: shiftCode, status: 'confirmed', branch_location: scheduleBranch }]);
    }
  } catch (e) {
    console.error("dbSetRosterById error:", e);
  }
}

async function notifySuperAdminsOfLeave(req: any) {
  try {
    const { data: admins } = await supabase
      .from("staff_profiles")
      .select("id, branch_assigned")
      .or("role.eq.Super Admin,role.eq.admin,role.eq.Admin");
    
    if (admins && admins.length > 0) {
      const isSudden = (new Date(req.date).getTime() - new Date().getTime()) < 2 * 24 * 60 * 60 * 1000;
      const prefix = isSudden ? "🚨 [SUDDEN LEAVE]" : "📅 [Leave Request]";
      const notifications = admins.map((admin: any) => ({
        recipient_id: admin.id,
        type: "critical_incident",
        title: `${prefix} ${req.who}`,
        message: `${req.who} has requested ${req.leaveType || "leave"} for ${req.date}. Reason: ${req.reason || "None"}.`,
        priority: "high",
        branch_location: req.branch || admin.branch_assigned || "global",
        is_read: false,
        created_at: new Date().toISOString()
      }));

      await supabase.from("notifications").insert(notifications);
    }
  } catch (err) {
    console.error("notifySuperAdminsOfLeave error:", err);
  }
}

export async function dbFetchHandoverAssignments(branch: string, startDate: string, endDate: string) {
  try {
    const { data, error } = await supabase
      .from("handover_assignments")
      .select("*")
      .eq("branch", branch)
      .gte("date", startDate)
      .lte("date", endDate);
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error("dbFetchHandoverAssignments error:", e);
    return [];
  }
}

export async function dbSaveHandoverAssignment(date: string, branch: string, staffNames: string[]) {
  try {
    const { data, error } = await supabase
      .from("handover_assignments")
      .upsert({ date, branch, staff_names: staffNames, created_at: new Date().toISOString() }, { onConflict: "date,branch" })
      .select()
      .single();
    if (error) throw error;
    rtoast("Assignment saved");
    return data;
  } catch (e) {
    console.error("dbSaveHandoverAssignment error:", e);
    rtoast("Save assignment failed", "alert");
    return null;
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

    if (req.kind === "leave") {
      notifySuperAdminsOfLeave(req);
    }

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

        const branchA = shiftA ? shiftA.branch_location : (F()._profileBranch && F()._profileBranch[pidA]) || "calicut";
        const branchB = shiftB ? shiftB.branch_location : (F()._profileBranch && F()._profileBranch[pidB]) || "calicut";

        await dbSetRosterById(pidA, dateA, codeB, branchB);
        await dbSetRosterById(pidB, dateB, codeA, branchA);
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

export async function dbSetRosterOtById(pid: string, date: string, ot: number) {
  try {
    const { data: ex } = await supabase.from("roster_schedules").select("id").eq("profile_id", pid).eq("date", date).maybeSingle();
    let scheduleBranch = (F() && F()._profileBranch && F()._profileBranch[pid]);
    if (!scheduleBranch) {
      const { data: p } = await supabase.from("staff_profiles").select("branch_assigned").eq("id", pid).maybeSingle();
      scheduleBranch = p ? p.branch_assigned : "calicut";
    }
    if (scheduleBranch === "global") scheduleBranch = "calicut";

    if (ex && (ex as any).id) {
      await supabase.from("roster_schedules").update({ overtime_hours: ot }).eq("id", (ex as any).id);
    } else {
      await supabase.from("roster_schedules").insert([{ profile_id: pid, date: date, shift_code: 'D', overtime_hours: ot, status: 'confirmed', branch_location: scheduleBranch }]);
    }
  } catch (e) {
    console.error("dbSetRosterOtById error:", e);
  }
}

function formatTimeForDb(t: string) {
  if (!t) return null;
  const parts = t.split(":");
  if (parts.length >= 2) {
    const hh = parts[0].padStart(2, "0");
    const mm = parts[1].padStart(2, "0");
    const ss = parts[2] ? parts[2].padStart(2, "0") : "00";
    return `${hh}:${mm}:${ss}`;
  }
  return t;
}

async function revertRosterChangesForClaim(claim: any) {
  if (!claim) return;
  const pid = claim.profile_id;
  const date = claim.date;
  const name = Object.keys(F()._staffIdByName).find(k => F()._staffIdByName[k] === pid);

  const tDates = (() => {
    let list = [];
    if (claim.toil_dates) {
      try {
        list = typeof claim.toil_dates === 'string' ? JSON.parse(claim.toil_dates) : claim.toil_dates;
      } catch (e) {}
    }
    return Array.isArray(list) ? list : [];
  })();
  const isToilClaim = claim.toil_payout || tDates.length > 0;

  if (isToilClaim) {
    await dbSetRosterById(pid, date, "RD");
    if (name) {
      const dt = new Date(date + "T00:00:00");
      const off = F().offsetOf ? F().offsetOf(dt) : null;
      if (off != null && !isNaN(off)) {
        F()._dbRoster = F()._dbRoster || {};
        F()._dbRoster[name] = F()._dbRoster[name] || {};
        F()._dbRoster[name][off] = { code: "RD", ot: 0 };
      }
    }
    for (const d of tDates) {
      await dbSetRosterById(pid, d, "RD");
      if (name) {
        const dt = new Date(d + "T00:00:00");
        const off = F().offsetOf ? F().offsetOf(dt) : null;
        if (off != null && !isNaN(off)) {
          F()._dbRoster = F()._dbRoster || {};
          F()._dbRoster[name] = F()._dbRoster[name] || {};
          F()._dbRoster[name][off] = { code: "RD", ot: 0 };
        }
      }
    }
  } else {
    await dbSetRosterOtById(pid, date, 0);
    if (name) {
      const dt = new Date(date + "T00:00:00");
      const off = F().offsetOf ? F().offsetOf(dt) : null;
      if (off != null && !isNaN(off)) {
        F()._dbRoster = F()._dbRoster || {};
        F()._dbRoster[name] = F()._dbRoster[name] || {};
        const existingCell = F()._dbRoster[name][off];
        const existingCode = existingCell ? (typeof existingCell === 'string' ? existingCell : existingCell.code) : 'D';
        F()._dbRoster[name][off] = { code: existingCode, ot: 0 };
      }
    }
  }
}

export async function dbAddOtClaim(claim: any) {
  let notesValue = claim.notes || null;
  if (claim.toil_payout && claim.toil_dates && claim.toil_dates.length) {
    notesValue = JSON.stringify({
      user_notes: claim.notes || "",
      toil_dates: claim.toil_dates
    });
  }
  const row = {
    profile_id: claim.profile_id || F()._meId,
    date: claim.date,
    start_time: formatTimeForDb(claim.start_time || "17:00:00"),
    end_time: claim.end_time ? formatTimeForDb(claim.end_time) : null,
    ot_hours: Number(claim.ot_hours) || 0,
    toil_payout: !!claim.toil_payout,
    notes: notesValue,
    status: "pending"
  };
  try {
    const { data, error } = await supabase.from("staff_ot_claims").insert([row]).select().single();
    if (error) throw error;
    await loadOtClaims(F());
    rtoast("OT/TOIL claim submitted");
    return data;
  } catch (e) {
    console.error("dbAddOtClaim error:", e);
    rtoast("Sync failed — saved locally", "alert");
    return null;
  }
}

export async function dbDeleteOtClaim(claimId: string) {
  try {
    const { data: claimBefore } = await supabase.from("staff_ot_claims").select("*").eq("id", claimId).maybeSingle();
    if (claimBefore && claimBefore.status === "approved") {
      await revertRosterChangesForClaim(claimBefore);
    }
    const { error } = await supabase.from("staff_ot_claims").delete().eq("id", claimId);
    if (error) throw error;
    await loadOtClaims(F());
    rtoast("Claim cancelled");
    return true;
  } catch (e) {
    console.error("dbDeleteOtClaim error:", e);
    rtoast("Failed to cancel claim", "alert");
    return false;
  }
}

export async function dbUpdateStaffRates(profileId: string, hourlyRate: number, dailyRate: number, monthlySalary?: number) {
  try {
    const updatePayload: any = { hourly_rate: hourlyRate, daily_rate: dailyRate };
    const { error } = await supabase
      .from("staff_profiles")
      .update(updatePayload)
      .eq("id", profileId);
    
    if (error) throw error;
    
    const calculatedSalary = monthlySalary !== undefined ? monthlySalary : (dailyRate * 30);
    if (F()._staffRatesByProfileId) {
      F()._staffRatesByProfileId[profileId] = { 
        ...F()._staffRatesByProfileId[profileId], 
        hourly_rate: hourlyRate, 
        daily_rate: dailyRate,
        monthly_salary: calculatedSalary
      };
    }
    const name = Object.keys(F()._staffIdByName).find(k => F()._staffIdByName[k] === profileId);
    if (name && F()._staffRatesByName && F()._staffRatesByName[name]) {
      F()._staffRatesByName[name].hourly_rate = hourlyRate;
      F()._staffRatesByName[name].daily_rate = dailyRate;
      F()._staffRatesByName[name].monthly_salary = calculatedSalary;
    }
    
    rtoast("Pay rates updated");
    return true;
  } catch (e) {
    console.error("dbUpdateStaffRates error:", e);
    rtoast("Failed to update rates", "alert");
    return false;
  }
}

export async function dbUpdateMonthlyPayroll(profileId: string, month: string, data: any) {
  try {
    const { data: prof, error: getErr } = await supabase
      .from("staff_profiles")
      .select("permissions")
      .eq("id", profileId)
      .maybeSingle();
      
    if (getErr) throw getErr;
    
    const permissions = prof?.permissions || {};
    permissions.monthly_payroll = permissions.monthly_payroll || {};
    permissions.monthly_payroll[month] = {
      monthly_salary: Number(data.monthly_salary) || 0,
      manual_addition: Number(data.manual_addition) || 0,
      manual_deduction: Number(data.manual_deduction) || 0,
      adjustment_notes: data.adjustment_notes || null
    };
    
    const { error: updErr } = await supabase
      .from("staff_profiles")
      .update({ permissions })
      .eq("id", profileId);
      
    if (updErr) throw updErr;
    
    // Update local cache baseline
    if (F()._staffRatesByProfileId && F()._staffRatesByProfileId[profileId]) {
      F()._staffRatesByProfileId[profileId].monthly_salary = Number(data.monthly_salary) || 0;
    }
    const name = Object.keys(F()._staffIdByName).find(k => F()._staffIdByName[k] === profileId);
    if (name && F()._staffRatesByName && F()._staffRatesByName[name]) {
      F()._staffRatesByName[name].monthly_salary = Number(data.monthly_salary) || 0;
    }

    const { loadMonthlyPayroll } = await import("./live-data");
    await loadMonthlyPayroll(F());
    rtoast("Monthly payroll updated");
    return { profile_id: profileId, month, ...permissions.monthly_payroll[month] };
  } catch (e) {
    console.error("dbUpdateMonthlyPayroll error:", e);
    rtoast("Failed to update payroll", "alert");
    return null;
  }
}

export async function dbResolveOtClaim(claimId: string, status: "Approved" | "Rejected", approvedOtHours?: number) {
  const dbStatus = status === "Approved" ? "approved" : "rejected";
  const updatePayload: any = { status: dbStatus, updated_at: new Date().toISOString() };
  if (status === "Approved" && approvedOtHours !== undefined) {
    updatePayload.ot_hours = Number(approvedOtHours) || 0;
  }
  
  try {
    const { data: claimBefore } = await supabase.from("staff_ot_claims").select("*").eq("id", claimId).maybeSingle();
    
    const { data: claim, error } = await supabase
      .from("staff_ot_claims")
      .update(updatePayload)
      .eq("id", claimId)
      .select()
      .single();
    
    if (error) throw error;
    
    if (claimBefore && claimBefore.status === "approved" && dbStatus !== "approved") {
      await revertRosterChangesForClaim(claimBefore);
    }
    
    if (status === "Approved" && claim) {
      const pid = claim.profile_id;
      const date = claim.date;
      const otHours = claim.ot_hours;
      
      const name = Object.keys(F()._staffIdByName).find(k => F()._staffIdByName[k] === pid);
      
      const tDates = (() => {
        let list = [];
        if (claim.toil_dates) {
          try {
            list = typeof claim.toil_dates === 'string' ? JSON.parse(claim.toil_dates) : claim.toil_dates;
          } catch (e) {}
        }
        return Array.isArray(list) ? list : [];
      })();
      const isToilClaim = claim.toil_payout || tDates.length > 0;
      
      if (isToilClaim) {
        if (claim.toil_payout) {
          await dbSetRosterById(pid, date, "TP");
          if (name) {
            const dt = new Date(date + "T00:00:00");
            const off = F().offsetOf ? F().offsetOf(dt) : null;
            if (off != null && !isNaN(off)) {
              F()._dbRoster = F()._dbRoster || {};
              F()._dbRoster[name] = F()._dbRoster[name] || {};
              F()._dbRoster[name][off] = { code: "TP", ot: 0 };
            }
          }
        } else if (tDates.length > 0) {
          await dbSetRosterById(pid, date, "TR");
          if (name) {
            const dt = new Date(date + "T00:00:00");
            const off = F().offsetOf ? F().offsetOf(dt) : null;
            if (off != null && !isNaN(off)) {
              F()._dbRoster = F()._dbRoster || {};
              F()._dbRoster[name] = F()._dbRoster[name] || {};
              F()._dbRoster[name][off] = { code: "TR", ot: 0 };
            }
          }
          for (const targetDate of tDates) {
            await dbSetRosterById(pid, targetDate, "TRD");
            if (name) {
              const dt = new Date(targetDate + "T00:00:00");
              const off = F().offsetOf ? F().offsetOf(dt) : null;
              if (off != null && !isNaN(off)) {
                F()._dbRoster = F()._dbRoster || {};
                F()._dbRoster[name] = F()._dbRoster[name] || {};
                F()._dbRoster[name][off] = { code: "TRD", ot: 0 };
              }
            }
          }
        }
      } else if (otHours > 0) {
        await dbSetRosterOtById(pid, date, otHours);
        if (name) {
          const dt = new Date(date + "T00:00:00");
          const off = F().offsetOf ? F().offsetOf(dt) : null;
          if (off != null && !isNaN(off)) {
            F()._dbRoster = F()._dbRoster || {};
            F()._dbRoster[name] = F()._dbRoster[name] || {};
            const existingCell = F()._dbRoster[name][off];
            const existingCode = existingCell ? (typeof existingCell === 'string' ? existingCell : existingCell.code) : 'D';
            F()._dbRoster[name][off] = { code: existingCode, ot: otHours };
          }
        }
      }
    }
    
    await loadOtClaims(F());
    window.dispatchEvent(new Event("fets-roster-changed"));
    rtoast(status === "Approved" ? "Claim approved" : "Claim rejected");
    return claim;
  } catch (e) {
    console.error("dbResolveOtClaim error:", e);
    rtoast("Failed to resolve claim", "alert");
    return null;
  }
}

export async function dbUpdateOtClaim(claimId: string, claim: any) {
  let notesValue = claim.notes || null;
  if (claim.toil_payout && claim.toil_dates && claim.toil_dates.length) {
    notesValue = JSON.stringify({
      user_notes: claim.notes || "",
      toil_dates: claim.toil_dates
    });
  }
  
  try {
    const { data: claimBefore } = await supabase.from("staff_ot_claims").select("*").eq("id", claimId).maybeSingle();
    
    const row = {
      start_time: formatTimeForDb(claim.start_time || "17:00:00"),
      end_time: claim.end_time ? formatTimeForDb(claim.end_time) : null,
      ot_hours: Number(claim.ot_hours) || 0,
      toil_payout: !!claim.toil_payout,
      notes: notesValue,
      status: claim.status || "pending",
      updated_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase.from("staff_ot_claims").update(row).eq("id", claimId).select().single();
    if (error) throw error;

    if (claimBefore) {
      const oldStatus = claimBefore.status;
      const newStatus = row.status;
      
      if (oldStatus === "approved" && newStatus !== "approved") {
        await revertRosterChangesForClaim(claimBefore);
      }
      else if (newStatus === "approved") {
        if (oldStatus === "approved") {
          await revertRosterChangesForClaim(claimBefore);
        }
        
        const pid = data.profile_id;
        const date = data.date;
        const toilPayout = data.toil_payout;
        const otHours = data.ot_hours;
        const name = Object.keys(F()._staffIdByName).find(k => F()._staffIdByName[k] === pid);
        
        if (toilPayout) {
          let tDates = [];
          if (data.notes && data.notes.trim().startsWith("{")) {
            try {
              const parsed = JSON.parse(data.notes);
              tDates = parsed.toil_dates || [];
            } catch (e) {}
          } else if (Array.isArray(claim.toil_dates)) {
            tDates = claim.toil_dates;
          } else if (typeof claim.toil_dates === 'string') {
            try {
              tDates = JSON.parse(claim.toil_dates);
            } catch (e) {}
          }
          for (const d of tDates) {
            await dbSetRosterById(pid, d, "TP");
            if (name) {
              const dt = new Date(d + "T00:00:00");
              const off = F().offsetOf ? F().offsetOf(dt) : null;
              if (off != null && !isNaN(off)) {
                F()._dbRoster = F()._dbRoster || {};
                F()._dbRoster[name] = F()._dbRoster[name] || {};
                F()._dbRoster[name][off] = { code: "TP", ot: 0 };
              }
            }
          }
        } else if (otHours > 0) {
          await dbSetRosterOtById(pid, date, otHours);
          if (name) {
            const dt = new Date(date + "T00:00:00");
            const off = F().offsetOf ? F().offsetOf(dt) : null;
            if (off != null && !isNaN(off)) {
              F()._dbRoster = F()._dbRoster || {};
              F()._dbRoster[name] = F()._dbRoster[name] || {};
              const existingCell = F()._dbRoster[name][off];
              const existingCode = existingCell ? (typeof existingCell === 'string' ? existingCell : existingCell.code) : 'D';
              F()._dbRoster[name][off] = { code: existingCode, ot: otHours };
            }
          }
        }
      }
    }
    
    await loadOtClaims(F());
    window.dispatchEvent(new Event("fets-roster-changed"));
    rtoast("OT/TOIL claim updated");
    return data;
  } catch (e) {
    console.error("dbUpdateOtClaim error:", e);
    rtoast("Sync failed — saved locally", "alert");
    return null;
  }
}

export async function dbFetchRosterDiscussions(profileId: string) {
  try {
    const { data, error } = await supabase
      .from("roster_discussions")
      .select(`
        id,
        profile_id,
        sender_id,
        message,
        related_date,
        topic,
        created_at,
        sender:staff_profiles!roster_discussions_sender_id_fkey(full_name, role)
      `)
      .eq("profile_id", profileId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error("dbFetchRosterDiscussions error:", e);
    return [];
  }
}

export async function dbFetchRosterThreads() {
  try {
    const { data, error } = await supabase
      .from("roster_discussions")
      .select(`
        id,
        profile_id,
        sender_id,
        message,
        topic,
        created_at,
        thread_owner:staff_profiles!roster_discussions_profile_id_fkey(full_name, branch_assigned),
        sender:staff_profiles!roster_discussions_sender_id_fkey(full_name, role)
      `)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error("dbFetchRosterThreads error:", e);
    return [];
  }
}

export async function dbSendRosterDiscussion(profileId: string, senderId: string, message: string, topic: string = 'general', relatedDate: string | null = null) {
  const row = {
    profile_id: profileId,
    sender_id: senderId,
    message: message.trim(),
    topic,
    related_date: relatedDate
  };
  try {
    const { data, error } = await supabase.from("roster_discussions").insert([row]).select().single();
    if (error) throw error;
    return data;
  } catch (e) {
    console.error("dbSendRosterDiscussion error:", e);
    return null;
  }
}

/* ---------------- shift_handovers & questions ---------------- */

export async function dbFetchHandoverQuestions() {
  try {
    const { data, error } = await supabase
      .from("handover_questions")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error("dbFetchHandoverQuestions error:", e);
    // Return standard defaults if table is empty or error
    return [
      { label: "Workstations & servers" },
      { label: "Internet & network" },
      { label: "CCTV & recording" },
      { label: "Power & AC" },
      { label: "All candidates exited" },
      { label: "Secure materials locked" },
      { label: "Dashboards logged out" }
    ];
  }
}

export async function dbMutateHandoverQuestion(action: "add" | "edit" | "delete", label: string, id?: string) {
  try {
    if (action === "add") {
      const { data, error } = await supabase
        .from("handover_questions")
        .insert([{ label }])
        .select()
        .single();
      if (error) throw error;
      rtoast("Question added");
      return data;
    } else if (action === "edit") {
      const { data, error } = await supabase
        .from("handover_questions")
        .update({ label, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      rtoast("Question updated");
      return data;
    } else if (action === "delete") {
      const { data, error } = await supabase
        .from("handover_questions")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      rtoast("Question deleted");
      return data;
    }
  } catch (e) {
    console.error("dbMutateHandoverQuestion error:", e);
    rtoast("Saved locally — DB sync failed", "alert");
    return null;
  }
}

export async function dbCreateHandover(h: any) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const legacyRow = {
    branch: h.branch,
    date: h.date,
    handover_time: h.handover_time,
    outgoing_staff: h.outgoing_staff,
    incoming_staff: h.incoming_staff,
    currently_testing: Number(h.currently_testing) || 0,
    no_shows: Number(h.no_shows) || 0,
    candidate_notes: h.candidate_notes || "",
    checklist: h.checklist,
    pending_items: h.pending_items || [],
    instructions: h.instructions || "",
    sig_out: h.sig_out || null,
    sig_in: null,
    status: "pending",
    expires_at: expiresAt,
    created_by: F()._meUserId || null
  };
  const row = {
    ...legacyRow,
    outgoing_user_ids: h.outgoing_user_ids || [],
    incoming_user_ids: h.incoming_user_ids || [],
    overall_status: h.overall_status || "ready",
    total_sessions: Number(h.total_sessions) || 0,
    scheduled_candidates: Number(h.scheduled_candidates) || 0,
    attended_candidates: Number(h.attended_candidates) || 0,
    sessions_completed: h.sessions_completed !== false,
    timing_exception: !!h.timing_exception,
    incident_status: h.incident_status || "none",
    client_report_status: h.client_report_status || "completed",
    next_day_sessions: h.next_day_sessions || []
  };
  try {
    let { data, error } = await supabase
      .from("shift_handovers")
      .insert([row])
      .select()
      .single();
    // Backward compatibility: the UI remains usable before the V2 SQL is run.
    if (error && (error.code === "PGRST204" || String(error.message || "").includes("column"))) {
      const fallback = await supabase.from("shift_handovers").insert([legacyRow]).select().single();
      data = fallback.data;
      error = fallback.error;
    }
    if (error) throw error;
    rtoast("Handover submitted — awaiting incoming sign-off");
    return data;
  } catch (e) {
    console.error("dbCreateHandover error:", e);
    rtoast("Saved locally — DB sync failed", "alert");
    return null;
  }
}

export async function dbFetchPendingHandovers(staffName?: string, userId?: string, branch?: string) {
  try {
    let query = supabase
      .from("shift_handovers")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (branch && branch !== "global") {
      query = query.in("branch", [branch, "all"]);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    let results = data || [];
    if (staffName) {
      const nameLower = staffName.toLowerCase().trim();
      results = results.filter((h: any) => {
        const hasName = (h.incoming_staff || []).some((n: string) => n.toLowerCase().trim() === nameLower);
        const hasId = userId && (h.incoming_user_ids || []).includes(userId);
        return hasName || hasId;
      });
    }
    return results.map((h: any) => {
      const now = new Date();
      if (h.expires_at && new Date(h.expires_at) < now) {
        return { ...h, status: "expired" };
      }
      return h;
    });
  } catch (e) {
    console.error("dbFetchPendingHandovers error:", e);
    return [];
  }
}

export async function dbFetchHandoverNotes() {
  try {
    const { data, error } = await supabase
      .from("handover_notes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error("dbFetchHandoverNotes error:", e);
    return [];
  }
}

export async function dbSaveHandoverNote(author: string, content: string, taggedStaff: string[], centers: string[]) {
  try {
    const { data, error } = await supabase
      .from("handover_notes")
      .insert([{
        author,
        content,
        tagged_staff: taggedStaff,
        centers,
        created_at: new Date().toISOString(),
        created_by: F()._meUserId || null
      }])
      .select()
      .single();
    if (error) throw error;
    rtoast("Note posted");
    return data;
  } catch (e) {
    console.error("dbSaveHandoverNote error:", e);
    rtoast("Sync failed — saved locally", "alert");
    return null;
  }
}

export async function dbDeleteHandoverNote(id: string) {
  try {
    const { error } = await supabase
      .from("handover_notes")
      .delete()
      .eq("id", id);
    if (error) throw error;
    rtoast("Note deleted");
    return true;
  } catch (e) {
    console.error("dbDeleteHandoverNote error:", e);
    rtoast("Failed to delete note", "alert");
    return false;
  }
}


export async function dbCompleteHandover(id: string, sigIn: any, comments: string) {
  try {
    const { data, error } = await supabase
      .from("shift_handovers")
      .update({
        status: "completed",
        sig_in: sigIn,
        incoming_comments: comments || "",
        completed_at: new Date().toISOString()
      })
      .eq("id", id)
      .eq("status", "pending")
      .select()
      .single();
    if (error) throw error;
    rtoast("Handover signed off successfully");
    return data;
  } catch (e) {
    console.error("dbCompleteHandover error:", e);
    rtoast("Sign-off failed — try again", "alert");
    return null;
  }
}

export async function dbCountPendingHandovers(staffName: string) {
  try {
    const { count, error } = await supabase
      .from("shift_handovers")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .filter("incoming_staff", "cs", JSON.stringify([staffName]))
      .gt("expires_at", new Date().toISOString());
    if (error) throw error;
    return count || 0;
  } catch (e) {
    console.error("dbCountPendingHandovers error:", e);
    return 0;
  }
}

export async function dbFetchHandovers(branch: string, statusFilter?: string) {
  try {
    let query = supabase
      .from("shift_handovers")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (branch && branch !== "global") {
      query = query.in("branch", [branch, "all"]);
    }
    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query.limit(100);
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error("dbFetchHandovers error:", e);
    return [];
  }
}

export async function dbFetchIncomingHandovers(userName: string) {
  try {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("shift_handovers")
      .select("*")
      .contains("incoming_staff", [userName])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error("dbFetchIncomingHandovers error:", e);
    return [];
  }
}

export function getSeenHandoverIds(): string[] {
  try {
    const raw = localStorage.getItem("fets_seen_handovers");
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function markHandoverSeen(id: string) {
  try {
    const seen = getSeenHandoverIds();
    if (!seen.includes(id)) seen.push(id);
    localStorage.setItem("fets_seen_handovers", JSON.stringify(seen.slice(-200)));
  } catch {}
}

/* ====================================================================
   STAFF APPLICATIONS PORTAL
   New table: staff_applications (leave | swap | emergency_duty | reimbursement)
   ==================================================================== */

const APP_KIND_LABEL: Record<string, string> = {
  leave:          "Leave",
  swap:           "Shift Swap",
  emergency_duty: "Emergency Duty Change",
  reimbursement:  "Reimbursement",
};

async function notifyAdminsOfApplication(app: any) {
  try {
    const { data: admins } = await supabase
      .from("staff_profiles")
      .select("id, branch_assigned")
      .or("role.eq.super_admin,role.eq.admin,role.eq.Super Admin,role.eq.Admin");

    if (!admins || admins.length === 0) return;

    const kindLabel = APP_KIND_LABEL[app.kind] || app.kind;
    let title = `[${kindLabel}] ${app.applicant_name}`;
    let message = "";

    if (app.kind === "leave") {
      message = `${app.applicant_name} applied for ${app.leave_type || "leave"} on ${app.request_date}. Reason: ${app.reason || "—"}`;
    } else if (app.kind === "swap") {
      message = `${app.applicant_name} wants to swap ${app.request_date} with ${app.swap_with_name} (${app.swap_date || "same date"}). Reason: ${app.reason || "—"}`;
    } else if (app.kind === "emergency_duty") {
      message = `${app.applicant_name} requests emergency duty change on ${app.request_date} → shift ${app.new_shift_code || "?"}. Reason: ${app.reason || "—"}`;
    } else if (app.kind === "reimbursement") {
      message = `${app.applicant_name} claims ₹${app.amount || 0} for ${app.expense_type || "expenses"}. Note: ${app.receipt_note || "—"}`;
    }

    const notifications = admins.map((admin: any) => ({
      recipient_id: admin.id,
      type: "critical_incident",
      title,
      message,
      priority: app.kind === "emergency_duty" ? "critical" : "high",
      branch_location: app.branch || admin.branch_assigned || "global",
      is_read: false,
      created_at: new Date().toISOString(),
    }));

    await supabase.from("notifications").insert(notifications);
  } catch (err) {
    console.error("notifyAdminsOfApplication error:", err);
  }
}

async function notifyApplicantOfResolution(app: any, status: string, adminReply: string) {
  try {
    if (!app.applicant_id) return;
    const kindLabel = APP_KIND_LABEL[app.kind] || app.kind;
    const approved = status === "approved";
    const title = approved
      ? `✅ ${kindLabel} Approved`
      : `❌ ${kindLabel} Rejected`;
    const message = adminReply
      ? `Your ${kindLabel.toLowerCase()} request was ${status}. Admin says: "${adminReply}"`
      : `Your ${kindLabel.toLowerCase()} request was ${status}.`;

    await supabase.from("notifications").insert([{
      recipient_id: app.applicant_id,
      type: approved ? "success" : "critical_incident",
      title,
      message,
      priority: "high",
      branch_location: app.branch || "global",
      is_read: false,
      created_at: new Date().toISOString(),
    }]);
  } catch (err) {
    console.error("notifyApplicantOfResolution error:", err);
  }
}

export async function dbSubmitApplication(app: {
  kind: string;
  request_date?: string;
  leave_type?: string;
  swap_with_name?: string;
  swap_with_id?: string;
  swap_date?: string;
  new_shift_code?: string;
  amount?: number;
  expense_type?: string;
  receipt_note?: string;
  reason?: string;
}) {
  const f = F();
  const applicantName = f._meName || f.user?.name || "Staff";
  const applicantId = f._meId || (f._staffIdByName ? f._staffIdByName[applicantName] : null);
  const applicantUserId = f._meUserId || (f._staffUserIdByName ? f._staffUserIdByName[applicantName] : null) || applicantId;
  const branch = f._meBranch || (f._profileBranch && applicantId ? f._profileBranch[applicantId] : "calicut");

  const targetName = app.swap_with_name || "";
  const targetId = app.swap_with_id || (f._staffIdByName && targetName ? f._staffIdByName[targetName] : null);
  const targetUserId = (f._staffUserIdByName && targetName ? f._staffUserIdByName[targetName] : null) || (f._profileIdToUserId && targetId ? f._profileIdToUserId[targetId] : null) || targetId;

  // ── 1. Insert into staff_applications (canonical table, UUID id) ──────────
  const saRow: any = {
    kind: app.kind,
    status: "pending",
    applicant_id: applicantId || undefined,
    applicant_name: applicantName,
    branch,
    request_date: app.request_date || new Date().toISOString().split("T")[0],
    leave_type: app.leave_type || (app.kind === "leave" ? "Full-day" : null),
    swap_with_name: targetName || null,
    swap_with_id: targetId || undefined,
    swap_date: app.swap_date || app.request_date || null,
    new_shift_code: app.new_shift_code || null,
    amount: app.amount || null,
    expense_type: app.expense_type || null,
    receipt_note: app.receipt_note || null,
    reason: app.reason || ""
  };
  // Remove undefined keys
  Object.keys(saRow).forEach(k => { if (saRow[k] === undefined) delete saRow[k]; });

  let dbResult: any = null;
  try {
    const { data: saData, error: saError } = await supabase
      .from("staff_applications")
      .insert([saRow])
      .select()
      .single();
    if (!saError && saData) {
      dbResult = {
        id: String(saData.id),
        kind: saData.kind,
        status: saData.status,
        applicant_id: saData.applicant_id,
        applicant_name: saData.applicant_name,
        branch: saData.branch,
        request_date: saData.request_date,
        leave_type: saData.leave_type,
        swap_with_name: saData.swap_with_name,
        swap_with_id: saData.swap_with_id,
        swap_date: saData.swap_date,
        new_shift_code: saData.new_shift_code,
        amount: saData.amount,
        expense_type: saData.expense_type,
        receipt_note: saData.receipt_note,
        reason: saData.reason,
        admin_reply: null,
        created_at: saData.created_at
      };
    } else {
      console.warn("staff_applications insert error:", saError?.message);
    }
  } catch (err) {
    console.warn("staff_applications insert threw:", err);
  }

  // ── 2. Also notify via leave_requests (best-effort, audit trail) ──────────
  try {
    const reasonEncoded = JSON.stringify({
      kind: app.kind, leave_type: app.leave_type,
      swap_with_name: targetName, swap_with_id: targetId, swap_date: app.swap_date,
      new_shift_code: app.new_shift_code, amount: app.amount,
      expense_type: app.expense_type, receipt_note: app.receipt_note,
      user_note: app.reason, applicant_name: applicantName, applicant_id: applicantId, branch,
      staff_application_id: dbResult?.id  // link back to canonical record
    });
    const lrRow: any = {
      user_id: applicantUserId,
      request_type: app.kind === "swap" ? "shift_swap" : app.kind,
      requested_date: app.request_date || new Date().toISOString().split("T")[0],
      reason: reasonEncoded,
      status: "pending"
    };
    if (app.kind === "swap" && targetUserId) {
      lrRow.swap_with_user_id = targetUserId;
      lrRow.swap_date = app.swap_date || app.request_date;
    }
    await supabase.from("leave_requests").insert([lrRow]);
  } catch (_) {}

  // ── 3. Build final app object ──────────────────────────────────────────────
  const finalApp = dbResult || {
    id: `app_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    kind: app.kind, status: "pending",
    applicant_id: applicantId, applicant_name: applicantName, branch,
    request_date: app.request_date || new Date().toISOString().split("T")[0],
    leave_type: app.leave_type || (app.kind === "leave" ? "Full-day" : null),
    swap_with_name: targetName || null, swap_with_id: targetId || null,
    swap_date: app.swap_date || app.request_date || null,
    new_shift_code: app.new_shift_code || null, amount: app.amount || null,
    expense_type: app.expense_type || null, receipt_note: app.receipt_note || null,
    reason: app.reason || "", admin_reply: null,
    created_at: new Date().toISOString()
  };

  // Update local memory and localStorage
  if (!f._applications) f._applications = [];
  f._applications = [finalApp, ...f._applications.filter((a: any) => String(a.id) !== String(finalApp.id))];

  if (!f._myApplications) f._myApplications = [];
  f._myApplications = [finalApp, ...f._myApplications.filter((a: any) => String(a.id) !== String(finalApp.id))];

  // Also synchronize with _staffRequests so roster can immediately show pending tags
  if (!f._staffRequests) f._staffRequests = [];
  f._staffRequests = [
    {
      id: String(finalApp.id),
      kind: finalApp.kind,
      who: finalApp.applicant_name,
      with: finalApp.swap_with_name || "",
      branch: finalApp.branch || "calicut",
      leaveType: finalApp.leave_type || (finalApp.kind === "leave" ? "Full-day" : ""),
      date: finalApp.request_date || "",
      swapDate: finalApp.swap_date || finalApp.request_date || "",
      reason: finalApp.reason || "",
      status: "Submitted",
      user_id: finalApp.applicant_id,
      swap_with_user_id: finalApp.swap_with_id,
      new_shift_code: finalApp.new_shift_code
    },
    ...f._staffRequests.filter((r: any) => String(r.id) !== String(finalApp.id))
  ];

  // Save to persistent localStorage
  try {
    const stored = JSON.parse(localStorage.getItem("fets_staff_applications") || "[]");
    const updated = [finalApp, ...stored.filter((a: any) => String(a.id) !== String(finalApp.id))];
    localStorage.setItem("fets_staff_applications", JSON.stringify(updated.slice(0, 100)));
  } catch (e) {}

  window.dispatchEvent(new Event("fets-applications-changed"));
  window.dispatchEvent(new Event("fets-roster-changed"));

  rtoast("Application submitted ✓");
  notifyAdminsOfApplication(finalApp);
  return finalApp;
}

export async function dbResolveApplication(appId: string, status: "approved" | "rejected", adminReply: string) {
  const f = F();
  const adminName = f.user?.name || "Super Admin";
  const adminId = f._meId || null;
  const adminUserId = f._meUserId || adminId;

  // Find the app in cache or storage
  const storedApps = JSON.parse(localStorage.getItem("fets_staff_applications") || "[]");
  const app = (f._applications || []).find((a: any) => String(a.id) === String(appId)) ||
              storedApps.find((a: any) => String(a.id) === String(appId));

  // ── Update staff_applications (UUID — always the canonical source) ──────────
  let dbUpdated = false;
  try {
    const { error } = await supabase
      .from("staff_applications")
      .update({
        status,
        admin_reply: adminReply || null,
        resolved_by: adminId || undefined,
        resolved_at: new Date().toISOString()
      })
      .eq("id", appId);
    if (!error) {
      dbUpdated = true;
    } else {
      console.warn("staff_applications update error:", error.message);
      // Fallback: try leave_requests if numeric id
      if (!isNaN(Number(appId))) {
        await supabase.from("leave_requests").update({
          status, admin_reply: adminReply || null,
          approved_by: adminUserId, approved_at: new Date().toISOString()
        }).eq("id", Number(appId));
      }
    }
  } catch (e) {
    console.warn("resolve DB update threw:", e);
  }

  // ROSTER UPDATE ON APPROVAL
  if (status === "approved" && app) {
    const applicantName = app.applicant_name || app.who;
    const applicantId = app.applicant_id || (f._staffIdByName && applicantName ? f._staffIdByName[applicantName] : null);
    const date = app.request_date || app.date;
    const branch = app.branch || (f._profileBranch && applicantId ? f._profileBranch[applicantId] : "calicut");

    // 1. LEAVE APPROVAL -> Set Roster Cell to 'L'
    if (app.kind === "leave") {
      if (applicantId && date) {
        await dbSetRosterById(applicantId, date, "L", branch);
        if (applicantName) {
          f.rosterSet(applicantName, date, "L");
        }
      }
    }

    // 2. EMERGENCY DUTY CHANGE APPROVAL -> Set Roster Cell to new_shift_code
    else if (app.kind === "emergency_duty") {
      const newShift = app.new_shift_code || "D";
      if (applicantId && date) {
        await dbSetRosterById(applicantId, date, newShift, branch);
        if (applicantName) {
          f.rosterSet(applicantName, date, newShift);
        }
      }
    }

    // 3. SHIFT SWAP APPROVAL -> Swap Roster Cells between applicant and target
    else if (app.kind === "swap") {
      const partnerName = app.swap_with_name || app.with;
      const partnerId = app.swap_with_id || (f._staffIdByName && partnerName ? f._staffIdByName[partnerName] : null);
      const dateA = app.request_date || app.date;
      const dateB = app.swap_date || app.swapDate || dateA;

      if (applicantId && partnerId && applicantName && partnerName && dateA) {
        // Read CURRENT shift codes directly from DB (local cache uses numeric offsets, not date strings — always fetch from DB)
        let codeA = "D", codeB = "D";
        try {
          const [rA, rB] = await Promise.all([
            supabase.from("roster_schedules").select("shift_code").eq("profile_id", applicantId).eq("date", dateA).maybeSingle(),
            supabase.from("roster_schedules").select("shift_code").eq("profile_id", partnerId).eq("date", dateB).maybeSingle()
          ]);
          if (rA.data?.shift_code) codeA = rA.data.shift_code;
          if (rB.data?.shift_code) codeB = rB.data.shift_code;
        } catch(e) { console.warn("Swap: could not read current codes from DB, using D fallback:", e); }

        const branchA = (f._profileBranch && f._profileBranch[applicantId]) || "calicut";
        const branchB = (f._profileBranch && f._profileBranch[partnerId]) || "calicut";

        // Swap in Supabase — each person gets the other's original code
        await dbSetRosterById(applicantId, dateA, codeB, branchA);
        await dbSetRosterById(partnerId, dateB, codeA, branchB);

        // Update local state immediately for instant UI feedback
        if (f.rosterSet) {
          f.rosterSet(applicantName, dateA, codeB);
          f.rosterSet(partnerName, dateB, codeA);
        }
      }
    }

  }

  // Update in-memory applications cache
  const updatedApp = {
    ...app,
    status,
    admin_reply: adminReply || null,
    resolved_by: adminName,
    resolved_at: new Date().toISOString()
  };

  if (f._applications) {
    f._applications = f._applications.map((a: any) => String(a.id) === String(appId) ? updatedApp : a);
  }
  if (f._myApplications) {
    f._myApplications = f._myApplications.map((a: any) => String(a.id) === String(appId) ? updatedApp : a);
  }
  if (f._staffRequests) {
    f._staffRequests = f._staffRequests.map((r: any) => String(r.id) === String(appId) ? {
      ...r,
      status: status === "approved" ? "Approved" : "Rejected"
    } : r);
  }

  // Update localStorage
  try {
    const stored = JSON.parse(localStorage.getItem("fets_staff_applications") || "[]");
    const updated = stored.map((a: any) => String(a.id) === String(appId) ? updatedApp : a);
    localStorage.setItem("fets_staff_applications", JSON.stringify(updated));
  } catch (e) {}

  window.dispatchEvent(new Event("fets-applications-changed"));
  window.dispatchEvent(new Event("fets-roster-changed"));

  // Force roster re-fetch so the swapped/changed cells are immediately visible
  if (status === "approved") {
    try {
      const { ensureMonth } = await import("./live-data");
      const today = new Date();
      // Clear month cache so ensureMonth re-fetches fresh from DB
      (window as any).__fetsLoadedMonths?.clear?.();
      await Promise.all([
        ensureMonth(today),
        ensureMonth(new Date(today.getFullYear(), today.getMonth() + 1, 1)),
        ensureMonth(new Date(today.getFullYear(), today.getMonth() - 1, 1))
      ]);
    } catch(e) { /* ignore — roster event was already fired */ }
  }

  notifyApplicantOfResolution(updatedApp, status, adminReply);
  rtoast(status === "approved" ? "Application approved ✓ Roster updated" : "Application rejected");
  return updatedApp;
}


