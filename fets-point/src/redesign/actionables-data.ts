import { supabase } from "../lib/supabase";
export { supabase };

export interface ActionableStaff {
  id: string;
  name: string;
  role: 'admin' | 'member';
  email?: string;
  active: boolean;
  created_at: string;
}

export interface ActionableAssignment {
  id: string;
  actionable_id: string;
  staff_id: string;
  member_role: 'lead' | 'member';
  assigned_at: string;
  staff?: { id: string; name: string };
}

export interface ActionableUpdate {
  id: string;
  actionable_id: string;
  staff_id?: string;
  kind: 'update' | 'instruction' | 'status_change' | 'submission';
  message: string;
  created_at: string;
  staff?: { id: string; name: string };
}

export interface ActionableDataEntry {
  id: string;
  actionable_id: string;
  staff_id?: string;
  label: string;
  content: { text?: string; [key: string]: any } | string;
  created_at: string;
  updated_at: string;
  staff?: { id: string; name: string };
}

export interface ActionableFileEntry {
  id: string;
  actionable_id: string;
  staff_id?: string;
  file_name: string;
  storage_path: string;
  size_bytes?: number;
  created_at: string;
  staff?: { id: string; name: string };
}

export interface Actionable {
  id: string;
  code: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'submitted' | 'completed';
  due_date?: string;
  created_by?: string;
  created_at: string;
  completed_at?: string;
  actionable_assignments: ActionableAssignment[];
  actionable_updates: ActionableUpdate[];
}

export interface Centre {
  id: string;
  name: string;
  status: 'live' | 'launching' | 'planned';
  sort_order: number;
  launched_at?: string;
  created_at: string;
}

export interface CentreRolloutItem {
  id: string;
  centre_id: string;
  actionable_id: string;
  status: 'not_started' | 'in_progress' | 'done' | 'na';
  note?: string;
  updated_by?: string;
  spawned_actionable_id?: string;
  created_at: string;
  updated_at: string;
  staff?: { id: string; name: string };
}

export interface ComplianceItem {
  id: string;
  title: string;
  category: 'certification' | 'audit' | 'insurance' | 'contract' | 'bill' | 'other';
  centre_id?: string;
  owner_staff_id?: string;
  frequency: 'once' | 'monthly' | 'quarterly' | 'half_yearly' | 'yearly';
  next_due: string;
  lead_days: number;
  notes?: string;
  active: boolean;
  last_spawned_due?: string;
  last_actionable_id?: string;
  created_at: string;
  updated_at: string;
  staff?: { id: string; name: string };
  centres?: { id: string; name: string };
}

export const CAT_ICONS: Record<string, string> = {
  certification: '🎓',
  audit: '🔍',
  insurance: '🛡️',
  contract: '📜',
  bill: '💡',
  other: '📌',
};

export const FREQ_LABELS: Record<string, string> = {
  once: 'One-time',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  half_yearly: 'Half-yearly',
  yearly: 'Yearly',
};

export const STATUS_LABELS: Record<string, string> = {
  pending: 'NOT STARTED',
  in_progress: 'IN PROGRESS',
  submitted: 'SUBMITTED',
  completed: 'STANDARD APPROVED',
};

export const RO_LABEL: Record<string, string> = {
  not_started: 'NOT STARTED',
  in_progress: 'IN PROGRESS',
  done: 'DONE ✔',
  na: 'N/A',
};

export const RO_NEXT: Record<string, 'not_started' | 'in_progress' | 'done' | 'na'> = {
  not_started: 'in_progress',
  in_progress: 'done',
  done: 'na',
  na: 'not_started',
};

// Helper: Ensure the current logged-in user exists in public.staff and return staff record
export async function getOrCreateCurrentStaff(): Promise<ActionableStaff | null> {
  try {
    const fets = (window as any).FETS;
    const fetsUser = fets?.user;
    const name = fetsUser?.name || 'Staff';
    const email = (fetsUser?.email || '').trim().toLowerCase();
    const isAdmin = !!fets?.isAdmin;

    // Check staff table by email first, then by name
    let query = supabase.from('staff').select('*');
    if (email) query = query.eq('email', email);
    else query = query.eq('name', name);

    const { data, error } = await query.maybeSingle();
    if (data) return data;

    // Check by name if email didn't hit
    if (email) {
      const { data: byName } = await supabase.from('staff').select('*').eq('name', name).maybeSingle();
      if (byName) {
        await supabase.from('staff').update({ email }).eq('id', byName.id);
        return { ...byName, email };
      }
    }

    // Auto-create staff row
    const role = isAdmin ? 'admin' : 'member';
    const { data: created, error: createErr } = await supabase
      .from('staff')
      .insert({ name, email: email || null, role, active: true })
      .select()
      .single();

    if (!createErr && created) return created;
    return null;
  } catch (e) {
    console.warn('getOrCreateCurrentStaff err', e);
    return null;
  }
}

export async function fetchStaffList(): Promise<ActionableStaff[]> {
  try {
    const { data, error } = await supabase.from('staff').select('*').order('name');
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.warn('fetchStaffList error:', e);
    return [];
  }
}

export async function fetchActionables(): Promise<Actionable[]> {
  try {
    const { data, error } = await supabase
      .from('actionables')
      .select(`
        *,
        actionable_assignments(id, member_role, staff(id, name)),
        actionable_updates(id, kind, message, created_at, staff(id, name))
      `)
      .order('code');
    if (error) throw error;
    return (data || []).map((a) => {
      if (a.actionable_updates) {
        a.actionable_updates.sort((x: any, y: any) => new Date(x.created_at).getTime() - new Date(y.created_at).getTime());
      }
      return a;
    });
  } catch (e) {
    console.warn('fetchActionables error:', e);
    return [];
  }
}

export async function fetchCentres(): Promise<Centre[]> {
  try {
    const { data, error } = await supabase.from('centres').select('*').order('sort_order').order('name');
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.warn('fetchCentres error:', e);
    return [];
  }
}

export async function fetchRollout(): Promise<CentreRolloutItem[]> {
  try {
    const { data, error } = await supabase.from('centre_rollout').select('*, staff:updated_by(name)');
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.warn('fetchRollout error:', e);
    return [];
  }
}

export async function fetchCompliance(): Promise<ComplianceItem[]> {
  try {
    const { data, error } = await supabase
      .from('compliance_items')
      .select('*, staff:owner_staff_id(name), centres:centre_id(name)')
      .order('next_due');
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.warn('fetchCompliance error:', e);
    return [];
  }
}

export async function fetchAppSettings(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.from('app_settings').select('*');
    const map: Record<string, string> = {};
    (data || []).forEach((row) => { map[row.key] = row.value; });
    return map;
  } catch (e) {
    return {};
  }
}

export async function saveAppSetting(key: string, value: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() });
    return !error;
  } catch (e) {
    return false;
  }
}

export async function fetchDataEntries(actId: string): Promise<ActionableDataEntry[]> {
  try {
    const { data, error } = await supabase
      .from('actionable_data')
      .select('*, staff(name)')
      .eq('actionable_id', actId)
      .order('created_at');
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.warn('fetchDataEntries error:', e);
    return [];
  }
}

export async function fetchFiles(actId: string): Promise<ActionableFileEntry[]> {
  try {
    const { data, error } = await supabase
      .from('actionable_files')
      .select('*, staff(name)')
      .eq('actionable_id', actId)
      .order('created_at');
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.warn('fetchFiles error:', e);
    return [];
  }
}

export function getAttachmentPublicUrl(storagePath: string): string {
  return supabase.storage.from('attachments').getPublicUrl(storagePath).data.publicUrl;
}

export async function uploadAttachment(actId: string, staffId: string, file: File): Promise<{ success: boolean; fileEntry?: ActionableFileEntry; error?: string }> {
  try {
    const safeName = file.name.replace(/[^\w.\-]+/g, '_');
    const path = `${actId}/${Date.now()}_${safeName}`;
    const { error: upErr } = await supabase.storage.from('attachments').upload(path, file);
    if (upErr) return { success: false, error: upErr.message };

    const { data, error: insertErr } = await supabase
      .from('actionable_files')
      .insert({
        actionable_id: actId,
        staff_id: staffId || null,
        file_name: file.name,
        storage_path: path,
        size_bytes: file.size,
      })
      .select('*, staff(name)')
      .single();

    if (insertErr) return { success: false, error: insertErr.message };

    // Post log update
    await postActionableUpdate(actId, staffId, 'update', `📎 Attached a file: ${file.name}`);
    return { success: true, fileEntry: data };
  } catch (e: any) {
    return { success: false, error: e.message || 'Upload failed' };
  }
}

export async function deleteAttachment(file: ActionableFileEntry): Promise<boolean> {
  try {
    await supabase.storage.from('attachments').remove([file.storage_path]);
    const { error } = await supabase.from('actionable_files').delete().eq('id', file.id);
    return !error;
  } catch (e) {
    return false;
  }
}

export async function postActionableUpdate(actId: string, staffId: string | undefined, kind: 'update' | 'instruction' | 'status_change' | 'submission', message: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('actionable_updates').insert({
      actionable_id: actId,
      staff_id: staffId || null,
      kind,
      message,
    });
    return !error;
  } catch (e) {
    return false;
  }
}

export async function addDataEntry(actId: string, staffId: string | undefined, label: string, text: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('actionable_data').insert({
      actionable_id: actId,
      staff_id: staffId || null,
      label,
      content: { text },
    });
    return !error;
  } catch (e) {
    return false;
  }
}

export async function updateDataEntry(id: string, label: string, text: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('actionable_data').update({
      label,
      content: { text },
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    return !error;
  } catch (e) {
    return false;
  }
}

export async function deleteDataEntry(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('actionable_data').delete().eq('id', id);
    return !error;
  } catch (e) {
    return false;
  }
}

export async function createNewActionable(params: {
  title: string;
  description?: string;
  dueDate?: string;
  createdByStaffId?: string;
  assignedStaffIds: string[];
  leadStaffId?: string;
  step1?: string;
  acts: Actionable[];
}): Promise<{ success: boolean; actionable?: Actionable; error?: string }> {
  try {
    // Generate next code
    const codes = params.acts.map((a) => parseInt((a.code || '').replace(/\D/g, ''), 10)).filter((x) => !isNaN(x));
    const nextNum = (codes.length ? Math.max(...codes) : 0) + 1;
    const code = `ACT-${String(nextNum).padStart(2, '0')}`;

    const { data: act, error } = await supabase
      .from('actionables')
      .insert({
        code,
        title: params.title.trim(),
        description: params.description?.trim() || null,
        due_date: params.dueDate || null,
        status: 'pending',
        created_by: params.createdByStaffId || null,
      })
      .select()
      .single();

    if (error || !act) return { success: false, error: error?.message || 'Failed to create actionable' };

    // Assignments
    if (params.assignedStaffIds.length) {
      const inserts = params.assignedStaffIds.map((sid) => ({
        actionable_id: act.id,
        staff_id: sid,
        member_role: sid === params.leadStaffId ? 'lead' : 'member',
      }));
      await supabase.from('actionable_assignments').insert(inserts);
    }

    // Status change update
    await postActionableUpdate(act.id, params.createdByStaffId, 'status_change', `Actionable ${code} · ${params.title} was created.`);

    // Step 1 if provided
    if (params.step1?.trim()) {
      await postActionableUpdate(act.id, params.createdByStaffId, 'instruction', params.step1.trim());
    }

    return { success: true, actionable: act };
  } catch (e: any) {
    return { success: false, error: e.message || 'Exception creating actionable' };
  }
}

export async function updateActionableStatus(actId: string, status: 'pending' | 'in_progress' | 'submitted' | 'completed', staffId?: string, staffName?: string, note?: string): Promise<boolean> {
  try {
    const patch: any = { status };
    if (status === 'completed') patch.completed_at = new Date().toISOString();

    const { error } = await supabase.from('actionables').update(patch).eq('id', actId);
    if (error) return false;

    const actionText = note || (status === 'in_progress' ? 'started work' : status === 'submitted' ? 'submitted this actionable for review' : status === 'completed' ? 'approved this actionable as an official Standard' : 'updated status');
    await postActionableUpdate(actId, staffId, 'status_change', `${staffName || 'Staff'} ${actionText}.`);

    return true;
  } catch (e) {
    return false;
  }
}

export async function updateActionableDetails(actId: string, title: string, description: string, dueDate: string, staffId?: string, staffName?: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('actionables').update({
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate || null,
    }).eq('id', actId);

    if (error) return false;
    await postActionableUpdate(actId, staffId, 'status_change', `${staffName || 'Staff'} updated this actionable's details.`);
    return true;
  } catch (e) {
    return false;
  }
}

export async function deleteActionable(actId: string): Promise<boolean> {
  try {
    const { data: files } = await supabase.from('actionable_files').select('storage_path').eq('actionable_id', actId);
    if (files && files.length) {
      await supabase.storage.from('attachments').remove(files.map((f) => f.storage_path));
    }
    const { error } = await supabase.from('actionables').delete().eq('id', actId);
    return !error;
  } catch (e) {
    return false;
  }
}

// Centre Rollout Sync & Playbook
export async function syncRolloutItems(centres: Centre[], acts: Actionable[], currentRollout: CentreRolloutItem[]): Promise<boolean> {
  try {
    const spawnedIds = new Set(currentRollout.map((r) => r.spawned_actionable_id).filter(Boolean));
    const approvedStandards = acts.filter((a) => a.status === 'completed' && !spawnedIds.has(a.id));
    const nonLiveCentres = centres.filter((c) => c.status !== 'live');

    const missing: { centre_id: string; actionable_id: string }[] = [];
    nonLiveCentres.forEach((c) => {
      approvedStandards.forEach((a) => {
        if (!currentRollout.some((r) => r.centre_id === c.id && r.actionable_id === a.id)) {
          missing.push({ centre_id: c.id, actionable_id: a.id });
        }
      });
    });

    if (missing.length) {
      await supabase.from('centre_rollout').insert(missing);
    }

    // If a spawned launch task completed, auto-mark its checklist item done
    const toComplete = currentRollout.filter(
      (r) => r.spawned_actionable_id && r.status !== 'done' && r.status !== 'na' && acts.some((a) => a.id === r.spawned_actionable_id && a.status === 'completed')
    );

    for (const item of toComplete) {
      await supabase.from('centre_rollout').update({ status: 'done', updated_at: new Date().toISOString() }).eq('id', item.id);
    }

    return true;
  } catch (e) {
    return false;
  }
}

export async function cycleRolloutStatus(rId: string, currentStatus: string, staffId?: string, staffName?: string, actCode?: string, centreName?: string): Promise<boolean> {
  try {
    const next = RO_NEXT[currentStatus] || 'in_progress';
    const { error } = await supabase.from('centre_rollout').update({
      status: next,
      updated_by: staffId || null,
      updated_at: new Date().toISOString(),
    }).eq('id', rId);

    if (error) return false;

    if (next === 'done' && actCode) {
      const { data: row } = await supabase.from('centre_rollout').select('actionable_id').eq('id', rId).single();
      if (row?.actionable_id) {
        await postActionableUpdate(row.actionable_id, staffId, 'status_change', `${staffName || 'Staff'} marked ${actCode} as rolled out at ${centreName || 'a new centre'} 🚀`);
      }
    }
    return true;
  } catch (e) {
    return false;
  }
}

export async function spawnLaunchTaskFromRollout(
  rId: string,
  centre: Centre,
  standard: Actionable,
  staffId?: string,
  staffName?: string,
  acts: Actionable[] = []
): Promise<{ success: boolean; actionableId?: string; error?: string }> {
  try {
    const { data: dataRows } = await supabase.from('actionable_data').select('label').eq('actionable_id', standard.id);
    const items = [...new Set((dataRows || []).filter((d) => !d.label.startsWith('__')).map((d) => {
      const p = d.label.split('·').map((s) => s.trim()).filter(Boolean);
      return p.length > 1 ? p.slice(1).join(' · ') : p[0];
    }))];

    const codes = acts.map((a) => parseInt((a.code || '').replace(/\D/g, ''), 10)).filter((x) => !isNaN(x));
    const nextNum = (codes.length ? Math.max(...codes) : 0) + 1;
    const code = `ACT-${String(nextNum).padStart(2, '0')}`;

    const desc = `Launch task for ${centre.name}, spawned from approved standard ${standard.code} · ${standard.title}.\nReplicate every item to the standard set by the live centres — match or beat it.\nLog collected details as "${centre.name} · <Item>" to compile into the master cross-centre comparison matrix.`;

    const { data: na, error } = await supabase.from('actionables').insert({
      code,
      title: `${centre.name} · ${standard.title}`,
      description: desc,
      status: 'pending',
      created_by: staffId || null,
    }).select().single();

    if (error || !na) return { success: false, error: error?.message || 'Failed to spawn task' };

    const instr = `Open standard ${standard.code} in the library to see what the live centres have. Replicate it for ${centre.name}.${items.length ? `\n\nItems to cover:\n${items.map((it, i) => `${i + 1}. ${it}`).join('\n')}` : ''}`;
    await postActionableUpdate(na.id, staffId, 'instruction', instr);
    await postActionableUpdate(na.id, staffId, 'status_change', `${staffName || 'Admin'} spawned this launch task from standard ${standard.code} for ${centre.name} 🚀`);

    await supabase.from('centre_rollout').update({
      spawned_actionable_id: na.id,
      status: 'in_progress',
      updated_by: staffId || null,
      updated_at: new Date().toISOString(),
    }).eq('id', rId);

    return { success: true, actionableId: na.id };
  } catch (e: any) {
    return { success: false, error: e.message || 'Exception spawning rollout task' };
  }
}

// Compliance calendar automated spawn engine
export async function runComplianceEngine(complianceList: ComplianceItem[], staffId?: string): Promise<number> {
  if (!complianceList || !complianceList.length) return 0;
  let count = 0;
  try {
    const today = new Date().toISOString().slice(0, 10);
    for (const item of complianceList.filter((i) => i.active)) {
      const daysToDue = Math.ceil((new Date(item.next_due + 'T00:00:00').getTime() - new Date(new Date().toDateString()).getTime()) / 864e5);
      const effLead = Math.min(item.lead_days, { monthly: 21, quarterly: 80, half_yearly: 170, yearly: 350 }[item.frequency] ?? item.lead_days);

      if (daysToDue > effLead) continue;
      if (item.last_spawned_due === item.next_due) continue;

      // Compute next due date for recurring
      const addMonths = { monthly: 1, quarterly: 3, half_yearly: 6, yearly: 12 }[item.frequency] || 0;
      let nextDue = item.next_due;
      if (addMonths > 0) {
        const d = new Date(item.next_due + 'T00:00:00');
        d.setMonth(d.getMonth() + addMonths);
        nextDue = d.toISOString().slice(0, 10);
      }

      // Claim cycle first to prevent race condition
      const { data: claim, error: claimErr } = await supabase
        .from('compliance_items')
        .update({
          last_spawned_due: item.next_due,
          next_due: nextDue,
          active: item.frequency !== 'once',
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)
        .eq('next_due', item.next_due)
        .select();

      if (claimErr || !claim || !claim.length) continue;

      // Create actionable
      const { data: allActs } = await supabase.from('actionables').select('code');
      const codes = (allActs || []).map((a) => parseInt((a.code || '').replace(/\D/g, ''), 10)).filter((x) => !isNaN(x));
      const nextNum = (codes.length ? Math.max(...codes) : 0) + 1;
      const code = `ACT-${String(nextNum).padStart(2, '0')}`;

      const cName = item.centres?.name;
      const desc = `Compliance & renewal task — auto-created by the Compliance Calendar.\nCategory: ${item.category}${cName ? `\nCentre: ${cName}` : ''}\nDue: ${item.next_due}${item.notes ? `\n${item.notes}` : ''}`;

      const { data: na } = await supabase.from('actionables').insert({
        code,
        title: item.title,
        description: desc,
        status: 'pending',
        due_date: item.next_due,
        created_by: staffId || null,
      }).select().single();

      if (na) {
        if (item.owner_staff_id) {
          await supabase.from('actionable_assignments').insert({
            actionable_id: na.id,
            staff_id: item.owner_staff_id,
            member_role: 'lead',
          });
        }
        await postActionableUpdate(na.id, staffId, 'status_change', `📅 ${code} · ${item.title} — due ${item.next_due}. Auto-created by the compliance calendar${item.staff?.name ? ', assigned to ' + item.staff.name : ''}.`);
        await supabase.from('compliance_items').update({ last_actionable_id: na.id }).eq('id', item.id);
        count++;
      }
    }
  } catch (e) {
    console.warn('runComplianceEngine err', e);
  }
  return count;
}
