import { describe, expect, it } from 'vitest';
import { computePay, payslipHtml, rupeesInWords } from './payroll';

describe('computePay', () => {
  it('deducts a full day for L and half a day for HD', () => {
    const pay = computePay({ monthlySalary: 18000, cells: ['D', 'L', 'HD', 'RD', null] });
    expect(pay.dailyRate).toBe(600);
    expect(pay.leaveDeduction).toBe(600);
    expect(pay.halfDayDeduction).toBe(300);
    expect(pay.totalDeductions).toBe(900);
    expect(pay.netSalary).toBe(17100);
  });

  it('keeps OT, paid TOIL and manual adjustments as before', () => {
    const pay = computePay({ monthlySalary: 18000, manualAddition: 900, manualDeduction: 300, cells: [{ code: 'D', ot: 2 }, 'TP', { code: 'hd' }] });
    expect(pay.otSalary).toBeCloseTo(2 * 600 / 8 * 1.75);
    expect(pay.toilSalary).toBe(900);
    expect(pay.halfDays).toBe(1);
    expect(pay.totalEarnings).toBeCloseTo(18000 + 262.5 + 900 + 900);
    expect(pay.totalDeductions).toBe(600);
  });
});

describe('rupeesInWords', () => {
  it('uses Indian numbering', () => {
    expect(rupeesInWords(18000)).toBe('Rupees Eighteen Thousand Only');
    expect(rupeesInWords(125000.5)).toBe('Rupees One Lakh Twenty Five Thousand and Fifty Paise Only');
  });
});

describe('payslipHtml', () => {
  it('escapes names and notes', () => {
    const html = payslipHtml({ id: 'x', name: '<b>A</b>' }, '2026-08', 'August 2026', computePay({ monthlySalary: 100, manualAddition: 1, cells: [] }), { additionNote: '<script>' });
    expect(html).not.toContain('<b>A</b>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('Aug 01 – Aug 31');
  });
});
