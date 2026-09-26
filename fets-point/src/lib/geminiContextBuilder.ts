/**
 * Builds a structured live-context string from window.FETS in-memory data
 * for injection into Gemini Live's system instruction at connect time.
 *
 * Key: date keys use "YYYY-M-D" (no zero-padding), matching live-data.ts keyOf().
 */

const keyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function buildLiveContext(): string {
  const F = (window as any).FETS;
  if (!F) return '';

  const now = new Date();
  const todayKey = keyOf(now);
  const sections: string[] = [];

  // --- Current user ---
  const u = F.user;
  if (u) {
    const shift = u.shift || {};
    sections.push(
      `[Current User]\nName: ${u.name || 'Staff'}\nRole: ${u.role || 'Staff'}\nBranch: ${(shift.branch || 'calicut').toUpperCase()}\nShift: ${shift.start || '?'} - ${shift.end || '?'}\nAdmin: ${F.isAdmin ? 'Yes' : 'No'}\nDay #${u.day || '?'} on the job`
    );
  }

  // --- Today's exam sessions ---
  const todaySessions = F._liveSessions?.[todayKey];
  if (todaySessions && todaySessions.length) {
    const lines = todaySessions.map((s: any) =>
      `  - ${s.exam} | ${s.vendor?.toUpperCase()} | ${s.count} candidates | ${s.start}-${s.end} | ${(s.branch || '').toUpperCase()}`
    );
    sections.push(`[Today's Exam Sessions — ${now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}]\n${lines.join('\n')}`);
  } else {
    sections.push(`[Today's Exam Sessions]\nNo sessions scheduled today.`);
  }

  // --- Today's staff roster ---
  const todayRoster = F._liveRoster?.[todayKey];
  if (todayRoster) {
    const cal = todayRoster.calicut || [];
    const coc = todayRoster.cochin || [];
    sections.push(
      `[Today's Staff On Duty]\nCalicut: ${cal.length ? cal.join(', ') : 'None'}\nCochin: ${coc.length ? coc.join(', ') : 'None'}`
    );
  }

  // --- Next 3 days upcoming sessions ---
  const upcoming: string[] = [];
  for (let d = 1; d <= 3; d++) {
    const future = new Date(now);
    future.setDate(future.getDate() + d);
    const fKey = keyOf(future);
    const sess = F._liveSessions?.[fKey];
    if (sess && sess.length) {
      const label = future.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
      sess.forEach((s: any) => {
        upcoming.push(`  ${label}: ${s.exam} (${s.vendor?.toUpperCase()}) — ${s.count} candidates, ${s.start}-${s.end}, ${(s.branch || '').toUpperCase()}`);
      });
    }
  }
  if (upcoming.length) {
    sections.push(`[Upcoming Sessions (Next 3 Days)]\n${upcoming.join('\n')}`);
  }

  // --- Open incidents ---
  if (F.CASES && F.CASES.length) {
    const open = F.CASES.filter((c: any) => c.status !== 'resolved').slice(0, 15);
    if (open.length) {
      const lines = open.map((c: any) =>
        `  - [${c.priority}] ${c.id}: ${c.subject} (${c.category}, ${(c.branch || '').toUpperCase()}) — ${c.status}`
      );
      sections.push(`[Open Incidents (${open.length})]\n${lines.join('\n')}`);
    }
  }

  // --- Pending tasks ---
  if (F.DESK_TASKS && F.DESK_TASKS.length) {
    const pending = F.DESK_TASKS.filter((t: any) => t.status !== 'Completed').slice(0, 10);
    if (pending.length) {
      const lines = pending.map((t: any) =>
        `  - [${t.priority}] ${t.title} — due: ${t.due}, status: ${t.status}`
      );
      sections.push(`[Pending Tasks (${pending.length})]\n${lines.join('\n')}`);
    }
  }

  // --- Pending staff requests ---
  if (F._staffRequests && F._staffRequests.length) {
    const pending = F._staffRequests.filter((r: any) => r.status === 'Submitted' || r.status === 'pending').slice(0, 10);
    if (pending.length) {
      const lines = pending.map((r: any) =>
        `  - ${r.kind.toUpperCase()}: ${r.who} — ${r.date}${r.kind === 'swap' ? ` swap with ${r.with}` : ''} — ${r.reason || 'No reason'}`
      );
      sections.push(`[Pending Staff Requests (${pending.length})]\n${lines.join('\n')}`);
    }
  }

  // --- Recent news ---
  if (F._news && F._news.length) {
    const recent = F._news.filter((n: any) => n.active !== false).slice(0, 5);
    if (recent.length) {
      const lines = recent.map((n: any) => `  - [${n.priority}] ${n.body}`);
      sections.push(`[Recent News/Announcements]\n${lines.join('\n')}`);
    }
  }

  // --- Leave balance ---
  if (F.LEAVE_BALANCE && F.LEAVE_BALANCE.length) {
    const lines = F.LEAVE_BALANCE.map((l: any) => `${l.label}: ${l.n} days`);
    sections.push(`[My Leave Balance]\n${lines.join(' | ')}`);
  }

  // --- Vendor list ---
  if (F.VENDORS && F.VENDORS.length) {
    const lines = F.VENDORS.map((v: any) => `${v.name} (${v.short})`);
    sections.push(`[Exam Vendors]\n${lines.join(', ')}`);
  }

  // --- Staff directory ---
  if (F.STAFF) {
    const cal = F.STAFF.calicut || [];
    const coc = F.STAFF.cochin || [];
    sections.push(
      `[Staff Directory]\nCalicut (${cal.length}): ${cal.join(', ')}\nCochin (${coc.length}): ${coc.join(', ')}`
    );
  }

  // --- Lost & found ---
  if (F._lostFound && F._lostFound.length) {
    const unclaimed = F._lostFound.filter((i: any) => i.status !== 'claimed').slice(0, 5);
    if (unclaimed.length) {
      const lines = unclaimed.map((i: any) => `  - ${i.item} found at ${i.where} on ${i.when} (${(i.branch || '').toUpperCase()})`);
      sections.push(`[Unclaimed Lost & Found (${unclaimed.length})]\n${lines.join('\n')}`);
    }
  }

  // --- Daily checklist ---
  if (F.CHECKLIST) {
    const groups = Object.entries(F.CHECKLIST).map(
      ([phase, items]) => `  ${phase}: ${(items as string[]).join(', ')}`
    );
    sections.push(`[Daily Checklist]\n${groups.join('\n')}`);
  }

  if (!sections.length) return '';

  return (
    `\n\n--- FETS LIVE OPERATIONAL CONTEXT (auto-injected, ${now.toLocaleString('en-IN')}) ---\n` +
    sections.join('\n\n') +
    `\n--- END CONTEXT ---`
  );
}
