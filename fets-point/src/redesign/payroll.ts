/**
 * Monthly pay, worked out from the roster, and the salary statement it prints on.
 *
 * Daily rate = monthly salary ÷ 30. Overtime is paid at daily ÷ 8 × 1.75 per hour,
 * a paid TOIL day (TP) at daily × 1.5. A leave day (L) deducts a full day and a
 * half day (HD) deducts half a day. Manual additions and deductions come on top.
 */
export type RosterCell = string | { code?: string; ot?: number } | null | undefined;

export type PayInput = {
  monthlySalary: number;
  manualAddition?: number;
  manualDeduction?: number;
  cells: RosterCell[];
};

export type Pay = {
  monthlySalary: number; dailyRate: number; hourlyRate: number;
  otHours: number; otSalary: number;
  toilDays: number; toilSalary: number;
  leaveDays: number; leaveDeduction: number;
  halfDays: number; halfDayDeduction: number;
  manualAddition: number; manualDeduction: number;
  totalEarnings: number; totalDeductions: number; netSalary: number;
};

const codeOf = (cell: RosterCell) => String(cell && typeof cell === 'object' ? cell.code ?? '' : cell ?? '').toUpperCase();

export function computePay({ monthlySalary, manualAddition = 0, manualDeduction = 0, cells }: PayInput): Pay {
  const salary = Number(monthlySalary) || 0;
  const add = Number(manualAddition) || 0;
  const ded = Number(manualDeduction) || 0;
  const dailyRate = salary / 30;
  const hourlyRate = dailyRate / 8 * 1.75;
  let otHours = 0, toilDays = 0, leaveDays = 0, halfDays = 0;
  for (const cell of cells) {
    if (!cell) continue;
    if (typeof cell === 'object' && cell.ot) otHours += Number(cell.ot) || 0;
    const code = codeOf(cell);
    if (code === 'TP') toilDays++;
    else if (code === 'L') leaveDays++;
    else if (code === 'HD') halfDays++;
  }
  const otSalary = otHours * hourlyRate;
  const toilSalary = toilDays * dailyRate * 1.5;
  const leaveDeduction = leaveDays * dailyRate;
  const halfDayDeduction = halfDays * dailyRate / 2;
  const totalEarnings = salary + otSalary + toilSalary + add;
  const totalDeductions = leaveDeduction + halfDayDeduction + ded;
  return {
    monthlySalary: salary, dailyRate, hourlyRate, otHours, otSalary, toilDays, toilSalary,
    leaveDays, leaveDeduction, halfDays, halfDayDeduction, manualAddition: add, manualDeduction: ded,
    totalEarnings, totalDeductions, netSalary: totalEarnings - totalDeductions,
  };
}

/* ---------- amount in words, Indian numbering ---------- */
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const upto99 = (n: number) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`);
const upto999 = (n: number) => {
  const h = Math.floor(n / 100), r = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', r ? upto99(r) : ''].filter(Boolean).join(' ');
};
export function rupeesInWords(amount: number) {
  const neg = amount < 0;
  let n = Math.abs(amount);
  const paise = Math.round((n - Math.floor(n)) * 100);
  n = Math.floor(n) + (paise === 100 ? 1 : 0);
  if (n === 0 && !paise) return 'Rupees Zero Only';
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  if (crore) parts.push(`${upto999(crore)} Crore`);
  if (lakh) parts.push(`${upto99(lakh)} Lakh`);
  if (thousand) parts.push(`${upto99(thousand)} Thousand`);
  if (n) parts.push(upto999(n));
  const rupees = parts.join(' ');
  const p = paise && paise !== 100 ? ` and ${upto99(paise)} Paise` : '';
  return `${neg ? 'Minus ' : ''}Rupees ${rupees || 'Zero'}${p} Only`;
}

/* ---------- salary statement ---------- */
export type SlipPerson = { id: string; name: string; designation?: string; employeeId?: string; branch?: string };
export type SlipNotes = { additionNote?: string; deductionNote?: string };

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const money = (v: number) => `₹${(Number(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const plural = (n: number, one: string, many = `${one}s`) => `${n % 1 ? n.toFixed(1) : n} ${n === 1 ? one : many}`;

const GOLD = '#F5C518';
const ICONS: Record<string, string> = {
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  bag: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/>',
  pin: '<path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M7.5 14h1M11.5 14h1M15.5 14h1M7.5 17.5h1M11.5 17.5h1"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.4 8.3-8 9.5C7.4 20.3 4 17 4 12V6l8-3z"/><path d="M8.5 12.2l2.4 2.4 4.6-4.8"/>',
};
const icon = (name: string, size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${GOLD}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
const ring = (name: string) => `<div style="width:54px;height:54px;flex:0 0 54px;border-radius:50%;border:1.5px solid ${GOLD};display:flex;align-items:center;justify-content:center;background:rgba(245,197,24,.06);">${icon(name, 24)}</div>`;

/** The Forun mark, drawn so the slip never depends on an image file. */
const DOTS: [number, number, string][] = [
  [0, 0, '#EF3B36'],
  [1, 0, '#EC2A8C'], [1, 2, '#FFC628'],
  [2, 0, '#E91E8C'], [2, 1, '#FF8A1F'], [2, 2, '#FFD000'],
  [3, 0, '#D6177A'], [3, 1, '#F4436C'], [3, 2, '#7DC242'], [3, 3, '#7B3FE4'],
];
const forunMark = () => `
  <div style="display:flex;align-items:center;gap:14px;">
    <div style="position:relative;width:62px;height:62px;">
      ${DOTS.map(([r, c, col]) => `<span style="position:absolute;left:${c * 16}px;top:${r * 16}px;width:13px;height:13px;border-radius:50%;background:${col};"></span>`).join('')}
    </div>
    <div>
      <div style="font-size:64px;line-height:.8;font-weight:900;letter-spacing:-2.5px;color:#fff;">forun</div>
      <div style="margin-top:8px;font-size:12.5px;font-weight:600;color:#e8e8e8;letter-spacing:.2px;">Educational &amp; Testing Services</div>
    </div>
  </div>`;

const infoCell = (iconName: string, rows: [string, string][], last = false) => `
  <div style="flex:1 1 auto;display:flex;align-items:center;gap:12px;padding:0 14px;${last ? '' : 'border-right:1px solid rgba(255,255,255,.12);'}">
    ${ring(iconName)}
    <div style="display:flex;flex-direction:column;gap:14px;min-width:0;">
      ${rows.map(([k, v]) => `<div><div style="font-size:13px;color:#cfcfcf;white-space:nowrap;">${esc(k)}</div><div style="margin-top:4px;font-size:15.5px;font-weight:700;color:#fff;white-space:nowrap;">${esc(v)}</div></div>`).join('')}
    </div>
  </div>`;

const line = (label: string, note: string, amount: number) => `
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:16px 0;border-bottom:1px dashed rgba(255,255,255,.14);">
    <div><div style="font-size:15.5px;color:#f2f2f2;">${label}</div>${note ? `<div style="margin-top:4px;font-size:13px;color:#9a9a9a;">${esc(note)}</div>` : ''}</div>
    <div style="font-size:15.5px;font-weight:600;color:#fff;white-space:nowrap;font-variant-numeric:tabular-nums;">${money(amount)}</div>
  </div>`;

const table = (title: string, rows: string, totalLabel: string, total: number) => `
  <div style="flex:1;display:flex;flex-direction:column;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:linear-gradient(180deg,#121212,#0b0b0b);overflow:hidden;">
    <div style="padding:16px 26px;font-size:17px;font-weight:800;letter-spacing:1.5px;color:${GOLD};border-bottom:1px solid rgba(255,255,255,.1);">${title}</div>
    <div style="display:flex;justify-content:space-between;padding:12px 26px;font-size:10.5px;font-weight:700;letter-spacing:2.5px;color:#cfcfcf;border-bottom:1px solid rgba(255,255,255,.1);"><span>DESCRIPTION</span><span>AMOUNT (₹)</span></div>
    <div style="flex:1;padding:0 26px;">${rows}</div>
    <div style="display:flex;justify-content:space-between;margin:0 22px;padding:18px 4px;border-top:1px solid rgba(255,255,255,.18);font-size:16.5px;font-weight:800;color:#fff;"><span>${totalLabel}</span><span style="font-variant-numeric:tabular-nums;">${money(total)}</span></div>
  </div>`;

export function payslipHtml(person: SlipPerson, month: string, monthLabel: string, pay: Pay, notes: SlipNotes = {}, preparedBy = 'Mithun') {
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const monthName = new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long' });
  const ref = `FETS/PAY/${month.replace('-', '')}/${(person.employeeId ? String(person.employeeId) : String(person.id || '').replace(/[^A-Za-z0-9]/g, '').slice(-6)).toUpperCase()}`;
  const now = new Date();
  const issued = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const earnings = [
    line('Basic Monthly Salary', '', pay.monthlySalary),
    pay.otHours > 0 ? line(`Overtime (${plural(Math.round(pay.otHours * 100) / 100, 'hr')})`, `@ ${money(pay.hourlyRate)} per hour`, pay.otSalary) : '',
    pay.toilDays > 0 ? line(`Paid TOIL (${plural(pay.toilDays, 'day')})`, `@ 1.5 × ${money(pay.dailyRate)} per day`, pay.toilSalary) : '',
    pay.manualAddition > 0 ? line('Additions', notes.additionNote || '', pay.manualAddition) : '',
  ].join('');
  const deductionRows = [
    pay.leaveDays > 0 ? line(`Leave Deductions (${plural(pay.leaveDays, 'day')})`, `@ ${money(pay.dailyRate)} per day`, pay.leaveDeduction) : '',
    pay.halfDays > 0 ? line(`Half Day Deductions (${plural(pay.halfDays, 'day')})`, `@ ${money(pay.dailyRate / 2)} per half day`, pay.halfDayDeduction) : '',
    pay.manualDeduction > 0 ? line('Deductions', notes.deductionNote || '', pay.manualDeduction) : '',
  ].join('');
  const deductions = deductionRows || `<div style="padding:16px 0;font-size:14.5px;color:#8a8a8a;font-style:italic;">No deductions this month</div>`;

  return `
<div style="width:1100px;box-sizing:border-box;padding:12px;background:#000;font-family:'Inter','Segoe UI',Roboto,system-ui,-apple-system,sans-serif;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
 <div style="position:relative;border:1.5px solid ${GOLD};border-radius:18px;padding:34px 26px 26px;background:radial-gradient(120% 60% at 50% 0%,#141414 0%,#050505 60%,#000 100%);overflow:hidden;">

  <div style="display:flex;justify-content:space-between;align-items:center;padding:0 14px 30px;">
    <div style="display:flex;align-items:center;gap:40px;">
      ${forunMark()}
      <div style="width:1.5px;height:110px;background:rgba(255,255,255,.35);"></div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:44px;font-weight:900;letter-spacing:2px;color:#fff;line-height:1;">SALARY STATEMENT</div>
      <div style="margin-top:14px;font-size:24px;font-weight:700;color:${GOLD};">${esc(monthLabel)}</div>
      <div style="margin-top:8px;font-size:11px;letter-spacing:1.5px;color:#8f8f8f;">REF ${esc(ref)} · ISSUED ${esc(issued.toUpperCase())}</div>
    </div>
  </div>

  <div style="position:relative;display:flex;align-items:center;padding:30px 6px;border:1px solid rgba(255,255,255,.16);border-radius:16px;background:linear-gradient(160deg,#171717 0%,#0c0c0c 55%,#101010 100%);">
    <div style="position:absolute;top:-1px;right:17%;width:260px;height:2px;background:linear-gradient(90deg,transparent,${GOLD},transparent);"></div>
    ${infoCell('user', [['Employee Name', person.name], ...(person.employeeId ? [['Employee ID', person.employeeId] as [string, string]] : [])])}
    ${infoCell('bag', [['Designation', person.designation || 'Test Centre Administrator']])}
    ${infoCell('pin', [['Location', `FETS ${person.branch || 'Calicut'}`]])}
    ${infoCell('cal', [['Pay Period', `${monthName.slice(0, 3)} 01 – ${monthName.slice(0, 3)} ${lastDay}, ${y}`]], true)}
  </div>

  <div style="display:flex;gap:30px;margin-top:26px;">
    ${table('EARNINGS', earnings, 'Gross Earnings', pay.totalEarnings)}
    ${table('DEDUCTIONS', deductions, 'Total Deductions', pay.totalDeductions)}
  </div>

  <div style="position:relative;margin-top:28px;padding:30px 40px;border:1.5px solid ${GOLD};border-radius:14px;background:linear-gradient(90deg,#141414,#070707 60%,#0d0d0d);overflow:hidden;">
    <div style="position:absolute;bottom:-1px;right:12%;width:340px;height:2px;background:linear-gradient(90deg,transparent,#FFB300,transparent);"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:24px;">
      <div style="display:flex;align-items:center;gap:30px;">
        <span style="font-size:19px;font-weight:700;letter-spacing:6px;color:#fff;white-space:nowrap;">NET PAYABLE SALARY</span>
        <span style="position:relative;display:block;width:150px;height:2px;background:${GOLD};"><span style="position:absolute;right:0;top:-5px;width:10px;height:10px;border-top:2px solid ${GOLD};border-right:2px solid ${GOLD};transform:rotate(45deg);"></span></span>
      </div>
      <div style="font-size:50px;font-weight:900;color:#fff;letter-spacing:-.5px;font-variant-numeric:tabular-nums;text-shadow:0 0 22px rgba(245,197,24,.25);">${money(pay.netSalary)}</div>
    </div>
    <div style="margin-top:12px;text-align:right;font-size:13px;font-style:italic;color:#bdbdbd;">${esc(rupeesInWords(Math.round(pay.netSalary * 100) / 100))}</div>
  </div>

  <div style="display:flex;justify-content:space-between;align-items:center;gap:20px;margin-top:28px;padding:22px 30px;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:#0a0a0a;">
    <div style="display:flex;align-items:center;gap:22px;">
      ${icon('shield', 56)}
      <div>
        <div style="font-size:15px;color:#f0f0f0;white-space:nowrap;">Digitally Prepared &nbsp;•&nbsp; Forun Educational &amp; Testing Services &nbsp;•&nbsp; ${y}</div>
        <div style="margin-top:6px;font-size:13px;color:#b5b5b5;">This is a system generated salary statement and needs no physical signature.</div>
      </div>
    </div>
    <div style="text-align:right;flex:0 0 auto;">
      <div style="font-family:'Brush Script MT','Segoe Script','Dancing Script',cursive;font-size:30px;line-height:1;color:${GOLD};">${esc(preparedBy)}</div>
      <div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,.2);font-size:10.5px;letter-spacing:1.5px;color:#9a9a9a;">PREPARED BY · ${esc(now.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).toUpperCase())}</div>
    </div>
  </div>

 </div>
</div>`;
}
