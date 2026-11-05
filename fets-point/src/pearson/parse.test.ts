import {describe,expect,it} from 'vitest';
import {webcrypto} from 'node:crypto';
import ExcelJS from 'exceljs';
import {parsePearsonWorkbook} from './parse';
Object.defineProperty(globalThis.crypto,'subtle',{value:webcrypto.subtle,configurable:true});

const headers=['Exam Date','Appointment Time','First Name','Last Name','Email','Phone Number','Client','Exam Series','Exam Title'];
const booking=(name='Alex',code='TEST-A',range='9:30 AM - 11:45 AM',email='alex@example.test')=>[new Date('2026-11-01T00:00:00Z'),range,name,'N A',email,'415-000-0000','Example Owner',code,'Example exam'];
async function workbook(rows:unknown[][],setup?:(s:ExcelJS.Worksheet,w:ExcelJS.Workbook)=>void){const w=new ExcelJS.Workbook();w.addWorksheet('Cover').addRow(['Pearson report']);const s=w.addWorksheet('TC Exam Details');s.addRow(headers);rows.forEach(r=>s.addRow(r));setup?.(s,w);return new Uint8Array(await w.xlsx.writeBuffer());}

describe('Pearson monthly workbook parsing',()=>{
 it('expands actual date/time merges and retains names, email, owner, code and title',async()=>{
  const bytes=await workbook([booking(),[null,null,'Sam','NoLastname','sam@example.test','111','Example Owner','TEST-B','Second exam']],s=>{s.mergeCells('A2:A3');s.mergeCells('B2:B3');});
  const p=await parsePearsonWorkbook('Monthly.xlsx',bytes);
  expect(p.sheet).toBe('TC Exam Details');expect(p.file_hash).toMatch(/^[a-f0-9]{64}$/);expect(p.rows).toHaveLength(2);
  expect(p.rows[0]).toEqual({source_row:2,date:'2026-11-01',start_time:'09:30:00',end_time:'11:45:00',full_name:'Alex N A',email:'alex@example.test',phone:'415-000-0000',exam_owner:'Example Owner',exam_code:'TEST-A',exam_title:'Example exam'});
  expect(p.rows[1]).toMatchObject({source_row:3,date:'2026-11-01',start_time:'09:30:00',full_name:'Sam NoLastname'});
  expect(p.issues.filter(i=>i.level==='error')).toEqual([]);
 });
 it('does not forward-fill a missing date/time outside an actual merge',async()=>{
  const p=await parsePearsonWorkbook('missing.xlsx',await workbook([booking(),[null,null,'Sam','Last','sam@example.test','111','Example Owner','TEST-B','Second exam']]));
  expect(p.rows).toHaveLength(1);expect(p.issues).toContainEqual(expect.objectContaining({source_row:3,level:'error'}));
 });
 it('parses noon/midnight and rejects malformed or backwards appointments',async()=>{
  const p=await parsePearsonWorkbook('times.xlsx',await workbook([booking('Noon','N','12:00 PM – 2:15 PM'),booking('Early','E','12:00 AM - 1:15 AM'),booking('Bad','B','13:45 PM - 5:00 PM'),booking('Back','C','3:00 PM - 1:00 PM')]));
  expect(p.rows.map(r=>[r.start_time,r.end_time])).toEqual([['12:00:00','14:15:00'],['00:00:00','01:15:00']]);
  expect(p.issues.filter(i=>i.level==='error').map(i=>i.source_row)).toEqual([4,5]);
 });
 it('flags duplicate sitting identities without collapsing legitimate repeat exams',async()=>{
  const p=await parsePearsonWorkbook('repeat.xlsx',await workbook([booking(),booking(),booking('Alex','TEST-B','2:00 PM - 4:00 PM'),booking('Alex','TEST-A','4:00 PM - 6:00 PM')]));
  expect(p.rows).toHaveLength(4);expect(p.issues.filter(i=>i.level==='error')).toHaveLength(1);
  expect(p.issues.find(i=>i.level==='error')).toMatchObject({source_row:3});
  expect(p.rows[3].start_time).toBe('16:00:00');
 });
 it('keeps missing emails blank for explicit review and never invents one',async()=>{
  const p=await parsePearsonWorkbook('blank-email.xlsx',await workbook([booking('Alex','A','9:00 AM - 10:00 AM','')]));
  expect(p.rows[0].email).toBeNull();expect(p.issues).toContainEqual(expect.objectContaining({source_row:2,level:'warning'}));expect(p.issues.some(i=>i.level==='error')).toBe(false);
 });
 it('retains the source phone text and leading zeroes without treating it as identity',async()=>{
  const row=booking();row[5]=' 00123  456 ';
  const p=await parsePearsonWorkbook('phone.xlsx',await workbook([row]));
  expect(p.rows[0].phone).toBe(' 00123  456 ');
 });
 it('rejects formulas and reports invalid emails instead of accepting cached values',async()=>{
  const a=booking();a[4]='invalid';const p=await parsePearsonWorkbook('invalid.xlsx',await workbook([a]));expect(p.issues.some(i=>i.level==='error')).toBe(true);
  const b=await workbook([booking()],s=>{s.getCell('C2').value={formula:'"Injected"',result:'Alex'};});
  await expect(parsePearsonWorkbook('formula.xlsx',b)).rejects.toThrow(/formula/i);
 });
 it('finds moved headers and supports Excel serial dates including 1904 date mode',async()=>{
  const bytes=await workbook([booking()],(s,w)=>{w.properties.date1904=true;s.getCell('A2').value=44865;s.spliceRows(1,0,['Monthly registrations']);});
  const p=await parsePearsonWorkbook('serial.xlsx',bytes);expect(p.rows[0].date).toBe('2026-11-01');expect(p.rows[0].source_row).toBe(3);
 });
 it('rejects an unrelated workbook and unsupported formats',async()=>{
  const w=new ExcelJS.Workbook();w.addWorksheet('Other').addRow(['Name','Date']);
  await expect(parsePearsonWorkbook('other.xlsx',new Uint8Array(await w.xlsx.writeBuffer()))).rejects.toThrow(/headings/i);
  await expect(parsePearsonWorkbook('other.csv',new Uint8Array([1]))).rejects.toThrow(/xlsx/i);
 });
});
