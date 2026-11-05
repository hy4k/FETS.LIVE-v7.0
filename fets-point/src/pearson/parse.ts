import ExcelJS from 'exceljs';
import {Buffer} from 'buffer';
import type {PearsonParsedFile,PearsonRow} from './types';

const headings=['exam date','appointment time','first name','last name','email','phone number','client','exam series','exam title'] as const;
const plain=(value:unknown)=>String(value??'').replace(/\s+/g,' ').trim();

function text(cell:ExcelJS.Cell):string{
  // A merged cell resolves to its actual master. An unmerged blank stays blank.
  const value=cell.value;
  if(value&&typeof value==='object'&&('formula' in value||'sharedFormula' in value))throw new Error('Formula cells are not supported in a Pearson report. Export the original report as values.');
  return plain(cell.text);
}

function date(cell:ExcelJS.Cell,date1904:boolean):string|null{
  text(cell);
  const value=cell.value;
  if(value instanceof Date&&!Number.isNaN(value.getTime()))return value.toISOString().slice(0,10);
  if(typeof value==='number'&&Number.isInteger(value)&&value>0&&value<150000){
    const base=date1904?Date.UTC(1904,0,1):Date.UTC(1899,11,30);
    return new Date(base+value*86400000).toISOString().slice(0,10);
  }
  const s=text(cell);
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s)return s;
  return null;
}

function clock(value:string):string|null{
  const m=value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if(!m||Number(m[1])<1||Number(m[1])>12||Number(m[2])>59)return null;
  return String(Number(m[1])%12+(m[3].toUpperCase()==='PM'?12:0)).padStart(2,'0')+':'+m[2]+':00';
}

/** Parse a provider report; source row numbers are for review, never booking identity. */
export async function parsePearsonWorkbook(filename:string,bytes:Uint8Array):Promise<PearsonParsedFile>{
  if(!/\.xlsx$/i.test(filename))throw new Error('Choose the original Pearson XLSX report.');
  if(bytes.byteLength>20*1024*1024)throw new Error('Choose a report smaller than 20 MB.');
  const book=new ExcelJS.Workbook();
  try{await book.xlsx.load(Buffer.from(bytes));}catch{throw new Error('Could not read this Excel file. Choose the original Pearson XLSX report.');}
  let sheet:ExcelJS.Worksheet|undefined,headerRow=0,columns:number[]=[];
  for(const candidate of book.worksheets){
    for(let n=1;n<=Math.min(candidate.rowCount,25);n++){
      const found=new Map<string,number>();candidate.getRow(n).eachCell((cell,col)=>found.set(text(cell).toLowerCase(),col));
      if(headings.every(h=>found.has(h))){sheet=candidate;headerRow=n;columns=headings.map(h=>found.get(h)!);break;}
    }
    if(sheet)break;
  }
  if(!sheet)throw new Error('Pearson report headings are missing. Expected Exam Date, Appointment Time, First Name, Last Name, Email, Phone Number, Client, Exam Series and Exam Title.');
  if(sheet.rowCount-headerRow>5000)throw new Error('Choose a report with no more than 5,000 rows.');
  const result:PearsonParsedFile={filename,file_hash:'',sheet:sheet.name,rows:[],issues:[]};
  const seen=new Set<string>();
  for(let n=headerRow+1;n<=sheet.rowCount;n++){
    const cells=columns.map(col=>sheet!.getCell(n,col));
    const values=cells.map(text);
    if(values.slice(2).every(v=>!v))continue;
    const issue=(message:string,level:'error'|'warning'='error')=>result.issues.push({source_row:n,level,message});
    const day=date(cells[0],!!book.properties.date1904);
    const range=values[1].split(/\s*[-–—]\s*/);
    const start=range.length===2?clock(range[0]):null,end=range.length===2?clock(range[1]):null;
    const fullName=plain(values[2]+' '+values[3]);
    if(!day||!start||!end||start>=end||!fullName||!values[6]||!values[7]||!values[8]){
      issue('A valid date, AM/PM appointment range, full name, client, exam series and exam title are required. Blank dates/times must be genuinely merged cells in the report.');continue;
    }
    const email=values[4]||null;
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))issue('Email address is not valid. Correct this row before saving.');
    if(!email)issue('Email is missing. Keep this booking separate unless an existing identity is explicitly confirmed.','warning');
    const row:PearsonRow={source_row:n,date:day,start_time:start,end_time:end,full_name:fullName,email,phone:values[5]?cells[5].text:null,exam_owner:values[6],exam_code:values[7],exam_title:values[8]};
    const identity=JSON.stringify([day,start,end,fullName.toLowerCase(),email?.toLowerCase()||'',row.exam_owner.toLowerCase(),row.exam_code.toLowerCase()]);
    if(seen.has(identity))issue('Duplicate booking in this file: same name, email, exam and appointment. Remove the duplicate source row before saving.');
    seen.add(identity);result.rows.push(row);
  }
  if(!result.rows.length)throw new Error('No valid Pearson bookings were found in this report.');
  const digest=await globalThis.crypto.subtle.digest('SHA-256',Uint8Array.from(bytes).buffer);
  result.file_hash=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
  return result;
}
