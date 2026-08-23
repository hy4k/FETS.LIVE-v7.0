/**
 * seed_august_assignments.js
 * Synchronizes and seeds August 2026 handover assignments and duty daily logs
 * according to individual staff working stretches (from first day after RD to last day before next RD).
 * 
 * Calicut:
 * - Aysha (22-27 Aug, etc.): ADMIN & CALENDAR (all tasks) + IT & INFRASTRUCTURE
 * - Nilufer (24-29 Aug, etc.): DATA & SYSTEMS (all tasks) + OFFICE & FACILITIES
 * - Lazeem (25-30 Aug, etc.): CASES & DOCUMENTATION (all tasks) + OTHER / FOLLOW-UP
 * 
 * Cochin:
 * - Naima MM (24-29 Aug, etc.): Lead Role + ADMIN & CALENDAR + DATA & SYSTEMS
 * - Shimna (22-27 Aug, etc.): CASES & DOCUMENTATION + IT & INFRASTRUCTURE
 * - NIMMY M (20-25 Aug / 27-31 Aug): OFFICE & FACILITIES + OTHER / FOLLOW-UP
 */

const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://qqewusetilxxfvfkmsed.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxZXd1c2V0aWx4eGZ2Zmttc2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzNjI2NTUsImV4cCI6MjA3MDkzODY1NX0.-x783XXpilPWC3O-cJqmdSTmhpAvObk_MSElfGdrU8s';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const REST_CODES = new Set(['rd', 'off', 'wo', 'l', 'leave', 'lv', 'h', 'holiday', 'to', 'toil', 'tr', 'tp']);

const DEFAULT_DUTIES = [
  // 1. ADMIN & CALENDAR
  { id: 'd_cal_mgmt', category: 'admin_calendar', title: 'Calendar Management', branch: 'both', scheduled_time: '08:30', sort_order: 10 },
  { id: 'd_sched_check', category: 'admin_calendar', title: 'Daily Schedule & Appointment Checks', branch: 'both', scheduled_time: '09:00', sort_order: 11 },
  { id: 'd_admin_reminders', category: 'admin_calendar', title: 'Important Reminders & Administrative Follow-ups', branch: 'both', scheduled_time: '09:30', sort_order: 12 },

  // 2. DATA & SYSTEMS
  { id: 'd_db_update', category: 'data_systems', title: 'Database Updating', branch: 'both', scheduled_time: '17:00', sort_order: 20 },
  { id: 'd_rma_running', category: 'data_systems', title: 'RMA Running', branch: 'both', scheduled_time: '08:45', sort_order: 21 },
  { id: 'd_dvr_check', category: 'data_systems', title: 'DVR Check', branch: 'both', scheduled_time: '08:15', sort_order: 22 },
  { id: 'd_sys_verify', category: 'data_systems', title: 'System-Related Verification', branch: 'both', scheduled_time: '08:30', sort_order: 23 },

  // 3. CASES & DOCUMENTATION
  { id: 'd_cpr_filing', category: 'cases_documentation', title: 'CPR Filing', branch: 'both', scheduled_time: '17:15', sort_order: 30 },
  { id: 'd_serv_direct', category: 'cases_documentation', title: 'Service Direct Case Filing', branch: 'both', scheduled_time: '17:30', sort_order: 31 },
  { id: 'd_celpip_filing', category: 'cases_documentation', title: 'CELIP / Vendor Case Filing', branch: 'both', scheduled_time: '17:45', sort_order: 32 },
  { id: 'd_doc_updates', category: 'cases_documentation', title: 'Document & Registry Updates', branch: 'both', scheduled_time: '18:00', sort_order: 33 },

  // 4. IT & INFRASTRUCTURE
  { id: 'd_workstation_check', category: 'it_infrastructure', title: 'Workstation Check', branch: 'both', scheduled_time: '08:00', sort_order: 40 },
  { id: 'd_admin_system', category: 'it_infrastructure', title: 'Admin System Check', branch: 'both', scheduled_time: '08:10', sort_order: 41 },
  { id: 'd_server_check', category: 'it_infrastructure', title: 'Server Check', branch: 'both', scheduled_time: '08:15', sort_order: 42 },
  { id: 'd_network_conn', category: 'it_infrastructure', title: 'Network & Connectivity Check', branch: 'both', scheduled_time: '08:20', sort_order: 43 },
  { id: 'd_infra_check', category: 'it_infrastructure', title: 'Infrastructure Check', branch: 'both', scheduled_time: '08:00', sort_order: 44 },

  // 5. OFFICE & FACILITIES
  { id: 'd_office_supplies', category: 'office_facilities', title: 'Office Supplies Check', branch: 'both', scheduled_time: '08:30', sort_order: 50 },
  { id: 'd_office_equip', category: 'office_facilities', title: 'Office Equipment & Security Check', branch: 'both', scheduled_time: '08:35', sort_order: 51 },
  { id: 'd_gen_facility', category: 'office_facilities', title: 'General Office Condition', branch: 'both', scheduled_time: '08:40', sort_order: 52 },

  // 6. OTHER / FOLLOW-UP
  { id: 'd_special_instr', category: 'other_followup', title: 'Special Instructions & Candidate Accommodations', branch: 'both', scheduled_time: '08:50', sort_order: 60 },
  { id: 'd_handover_followup', category: 'other_followup', title: 'Pending Issues & Handover Follow-up', branch: 'both', scheduled_time: '09:00', sort_order: 61 },
];

async function seedAugust() {
  console.log('🚀 Starting August 2026 Roster Stretch & Duty Sync...');

  // 1. Fetch roster schedules
  const { data: roster, error } = await supabase
    .from('roster_schedules')
    .select('date, shift_code, branch_location, staff_profiles(full_name, branch_assigned)')
    .gte('date', '2026-08-01')
    .lte('date', '2026-08-31')
    .order('date');

  if (error) {
    console.error('Error fetching roster:', error);
    return;
  }

  const branches = ['calicut', 'cochin'];

  for (const branch of branches) {
    const isCochin = branch === 'cochin';
    console.log(`\n--- Processing ${branch.toUpperCase()} ---`);

    const branchRoster = (roster || []).filter((r) => {
      const br = (r.branch_location || r.staff_profiles?.branch_assigned || '').toLowerCase();
      return isCochin ? br.includes('cochin') : !br.includes('cochin');
    });

    const staffDates = {};
    branchRoster.forEach((r) => {
      const name = r.staff_profiles?.full_name;
      if (!name) return;
      staffDates[name] = staffDates[name] || {};
      staffDates[name][r.date] = r.shift_code;
    });

    // Compute stretches
    const staffStretches = {};
    for (const [name, dates] of Object.entries(staffDates)) {
      const sortedDates = Object.keys(dates).sort();
      let stretches = [];
      let cur = [];
      sortedDates.forEach((d) => {
        const code = (dates[d] || '').toLowerCase();
        if (!REST_CODES.has(code) && code) {
          cur.push(d);
        } else {
          if (cur.length) {
            stretches.push({ start: cur[0], end: cur[cur.length - 1], days: cur });
            cur = [];
          }
        }
      });
      if (cur.length) stretches.push({ start: cur[0], end: cur[cur.length - 1], days: cur });
      staffStretches[name] = stretches;
    }

    // Days in August 2026
    for (let day = 1; day <= 31; day++) {
      const dateStr = '2026-08-' + String(day).padStart(2, '0');

      // Present staff today
      const presentStaff = Object.keys(staffDates).filter((name) => {
        const code = (staffDates[name][dateStr] || '').toLowerCase();
        return code && !REST_CODES.has(code);
      });

      if (!presentStaff.length) continue;

      // Determine category mapping & lead for this date
      const catMap = {};
      let lead = null;

      if (isCochin) {
        const naimaStretch = (staffStretches['Naima MM'] || []).find((s) => s.days.includes(dateStr));
        const shimnaStretch = (staffStretches['Shimna'] || []).find((s) => s.days.includes(dateStr));
        const nimmyStretch = (staffStretches['NIMMY M'] || []).find((s) => s.days.includes(dateStr));

        if (naimaStretch) {
          lead = 'Naima MM';
          catMap['admin_calendar'] = 'Naima MM';
          catMap['data_systems'] = 'Naima MM';
        } else if (shimnaStretch) {
          lead = 'Shimna';
        } else if (nimmyStretch) {
          lead = 'NIMMY M';
        }

        if (shimnaStretch) {
          catMap['cases_documentation'] = 'Shimna';
          catMap['it_infrastructure'] = 'Shimna';
        }
        if (nimmyStretch) {
          catMap['office_facilities'] = 'NIMMY M';
          catMap['other_followup'] = 'NIMMY M';
        }
      } else {
        const ayshaStretch = (staffStretches['Aysha'] || []).find((s) => s.days.includes(dateStr));
        const niluferStretch = (staffStretches['Nilufer'] || []).find((s) => s.days.includes(dateStr));
        const lazeemStretch = (staffStretches['Lazeem'] || []).find((s) => s.days.includes(dateStr));

        if (ayshaStretch) {
          lead = 'Aysha';
          catMap['admin_calendar'] = 'Aysha';
          catMap['it_infrastructure'] = 'Aysha';
        }
        if (niluferStretch) {
          catMap['data_systems'] = 'Nilufer';
          catMap['office_facilities'] = 'Nilufer';
          if (!lead) lead = 'Nilufer';
        }
        if (lazeemStretch) {
          catMap['cases_documentation'] = 'Lazeem';
          catMap['other_followup'] = 'Lazeem';
          if (!lead) lead = 'Lazeem';
        }
      }

      if (!lead) lead = presentStaff[0];

      // Save/Upsert handover_assignments for Lead
      const { data: existingLead } = await supabase
        .from('handover_assignments')
        .select('id')
        .eq('date', dateStr)
        .eq('branch', branch)
        .maybeSingle();

      if (existingLead) {
        await supabase
          .from('handover_assignments')
          .update({ staff_names: [lead] })
          .eq('id', existingLead.id);
      } else {
        await supabase
          .from('handover_assignments')
          .insert({ date: dateStr, branch, staff_names: [lead] });
      }

      // Ensure duty_daily_log rows for today
      const { data: existingLogs } = await supabase
        .from('duty_daily_log')
        .select('id, duty_id, staff_name')
        .eq('date', dateStr)
        .eq('branch', branch);

      const existingMap = new Set((existingLogs || []).map((l) => l.duty_id));

      const rowsToInsert = [];
      DEFAULT_DUTIES.forEach((d) => {
        if (!existingMap.has(d.id)) {
          const stretchStaff = catMap[d.category];
          let actualStaff = stretchStaff || presentStaff[0];
          let origStaff = null;

          if (!presentStaff.includes(stretchStaff) && stretchStaff) {
            actualStaff = presentStaff[0];
            origStaff = stretchStaff;
          }

          rowsToInsert.push({
            id: `${dateStr}_${d.id}`,
            date: dateStr,
            branch,
            duty_id: d.id,
            staff_name: actualStaff,
            original_staff_name: origStaff,
            status: 'pending',
            steps_state: [],
            recorded_time: null,
            recorded_val: null,
            note: null,
            submitted_by: null,
            submitted_at: null,
            verified_by: null,
            verified_at: null,
            lead_comments: null,
          });
        }
      });

      if (rowsToInsert.length > 0) {
        await supabase.from('duty_daily_log').insert(rowsToInsert);
      }

      if (day >= 22 && day <= 30) {
        console.log(`[${dateStr}] Lead: ${lead} | Present: ${presentStaff.join(', ')}`);
      }
    }
  }

  console.log('✅ August 2026 Roster Stretch & Duty Sync completed successfully!');
}

seedAugust();
