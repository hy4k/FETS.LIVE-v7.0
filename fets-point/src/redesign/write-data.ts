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
    start_time: claim.start_time || "17:00:00",
    end_time: claim.end_time || null,
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
    const { data: claim, error } = await supabase
      .from("staff_ot_claims")
      .update(updatePayload)
      .eq("id", claimId)
      .select()
      .single();
    
    if (error) throw error;
    
    if (status === "Approved" && claim) {
      const pid = claim.profile_id;
      const date = claim.date;
      const toilPayout = claim.toil_payout;
      const otHours = claim.ot_hours;
      
      const name = Object.keys(F()._staffIdByName).find(k => F()._staffIdByName[k] === pid);
      
      if (toilPayout) {
        let tDates = [];
        if (claim.notes && claim.notes.trim().startsWith("{")) {
          try {
            const parsed = JSON.parse(claim.notes);
            tDates = parsed.toil_dates || [];
          } catch (e) {
            // ignore
          }
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

