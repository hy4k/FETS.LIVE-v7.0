import { describe, expect, it } from 'vitest';
import { Buffer } from 'buffer';
import * as XLSX from 'xlsx';
import { parseRosterFile, normaliseRosterTime } from './parse';

describe('shared provider roster parsing',()=>{
  it('retains the additional provider headings from the consolidated workspace',async()=>{
    const p=await parseRosterFile('provider.csv',Buffer.from('Booking ID,Participant Name,Exam Title,Exam Part,Session Time\n0009,Alex Full Name,CMA,Part 2,9AM'));
    expect(p.rows[0]).toMatchObject({roster_number:'0009',full_name:'Alex Full Name',exam_name:'CMA',exam_part:'PART 2',exam_start_time:'09:00:00'});
  });
  it('keeps full names and IDs intact and gives custom headings first claim',async()=>{
    const p=await parseRosterFile('provider.csv',Buffer.from('Name,Candidate,Confirmation Number,Start Time,Daytime Phone,Evening Phone\nCMA US,Alex Multi Part Name,000123,9:30 AM,,+91 90000 00000'),{exam_name:['name'],full_name:['candidate']});
    expect(p.rows[0]).toMatchObject({full_name:'Alex Multi Part Name',roster_number:'000123',exam_name:'CMA US',exam_start_time:'09:30:00',phone:'+919000000000'});
    expect(p.counts.errors).toBe(0);
  });
  it('combines provider first/last columns into one full_name and reports duplicates',async()=>{
    const p=await parseRosterFile('provider.csv',Buffer.from('Candidate First Name,Candidate Last Name,Candidate ID,Exam\nAlex,No Last Name,001,Part 2 CMA\nSam,Joseph,001,Part 1 CMA'));
    expect(p.rows[0]).toMatchObject({full_name:'Alex',exam_part:'PART 2'});
    expect(p.issues.some(x=>x.message.includes('duplicate roster number'))).toBe(true);
  });
  it.each(['xlsx','xls'] as const)('finds the roster after a cover sheet in %s',async(bookType)=>{
    const workbook=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([['Centre report']]),'Cover');
    XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([['Roster Number','Full Name','Exam Name','Start Time'],['0007','Long Full Name','Example','14:30']]),'Candidates');
    const buffer=Buffer.from(XLSX.write(workbook,{type:'array',bookType}));
    const p=await parseRosterFile(`provider.${bookType}`,buffer);
    expect(p.sheet_used).toBe('Candidates');expect(p.rows[0]).toMatchObject({roster_number:'0007',full_name:'Long Full Name',exam_start_time:'14:30:00'});
  });
  it('rejects missing IDs and malformed times without inventing rows',async()=>{
    const p=await parseRosterFile('provider.csv',Buffer.from('Roster Number,Full Name,Start Time\n,Missing ID,09:00\n10,Wrong Time,25:99'));
    expect(p.rows).toHaveLength(0);expect(p.counts.errors).toBe(2);
  });
  it('normalizes wall-clock time without browser timezone conversion',()=>{
    expect(normaliseRosterTime('12:00 AM')).toBe('00:00:00');expect(normaliseRosterTime('12:00 PM')).toBe('12:00:00');expect(normaliseRosterTime('0.375')).toBe('09:00:00');expect(normaliseRosterTime('2026-10-01 09:00:00')).toBe('09:00:00');expect(normaliseRosterTime('29:00')).toBeNull();
  });
  it('rejects broken CSV quoting instead of merging candidates silently',async()=>{
    await expect(parseRosterFile('broken.csv',Buffer.from('Roster Number,Full Name\n001,"Unclosed name\n002,Other candidate'))).rejects.toThrow('CSV formatting error');
  });
});
