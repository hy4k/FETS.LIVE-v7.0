import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Buffer } from 'buffer';
import { Upload, UserPlus, X, ArrowRight, CheckCircle2, FileSpreadsheet, Loader2, AlertCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { parseRosterFile, normaliseRosterTime, type ExtraAliases } from './parse';
import { PROVIDERS, type RosterPreview, type RosterRow } from './types';
import { loadRosterContext, possibleLegacyMatch, projectedGroups, rosterMatch, saveRoster } from './roster-api';
import './calendar-roster.css';

type Props={mode:'upload'|'manual';day:string;branch:string;onClose:()=>void};
const blank={full_name:'',roster_number:'',phone:'',exam_part:''};
const aliasFields=['roster_number','full_name','first_name','last_name','exam_name','part','phone','exam_start_time'] as const;
export default function CalendarRosterDialog({mode:initialMode,day:initialDay,branch:initialBranch,onClose}:Props){
  const queryClient=useQueryClient();
  const [mode,setMode]=useState(initialMode),[day,setDay]=useState(initialDay),[branch,setBranch]=useState(initialBranch==='cochin'?'cochin':'calicut');
  const [provider,setProvider]=useState<string>('PROMETRIC'),[exam,setExam]=useState(''),[time,setTime]=useState('');
  const [file,setFile]=useState<File|null>(null),[manual,setManual]=useState(blank),[aliasText,setAliasText]=useState<Record<string,string>>({});
  const [preview,setPreview]=useState<RosterPreview|null>(null),[context,setContext]=useState<Awaited<ReturnType<typeof loadRosterContext>>|null>(null);
  const [selected,setSelected]=useState<Set<string>>(new Set()),[busy,setBusy]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
  const generation=useRef(0),dialog=useRef<HTMLElement>(null);
  const reset=()=>{generation.current++;setPreview(null);setContext(null);setError('');setSuccess('');setBusy(false);};
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();return()=>{generation.current++;previous?.focus();};},[]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!saving)onClose();};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[saving,onClose]);
  const rows=useMemo(()=>preview?.rows.filter(r=>selected.has(r.roster_number))||[],[preview,selected]);
  const groups=useMemo(()=>context?projectedGroups(rows,context.candidates,context.sessions,provider):[],[rows,context,provider]);
  const updates=rows.filter(r=>context&&rosterMatch(r,context.candidates,provider)).length;
  const review=async()=>{
    if(!day||!branch)return setError('Choose a date and centre.');
    if(mode==='upload'&&!file)return setError('Choose a CSV, XLSX or XLS roster.');
    const request=++generation.current;setBusy(true);setError('');setPreview(null);setSuccess('');
    try{
      const aliases:ExtraAliases = Object.fromEntries(Object.entries(aliasText).map(([field,text])=>[field,text.split(',').map(v=>v.toLowerCase().replace(/[^a-z0-9 .]/g,' ').replace(/\s+/g,' ').trim()).filter(Boolean)]));
      let result:RosterPreview;
      if(mode==='upload')result=await parseRosterFile(file!.name,Buffer.from(await file!.arrayBuffer()),aliases);
      else result={filename:'By-hand entry',header_row:0,columns:{},issues:[],counts:{valid:1,warnings:0,errors:0,no_show:0,skipped:0},rows:[{...manual,full_name:manual.full_name.trim(),roster_number:manual.roster_number.trim(),source_row:1,exam_name:exam.trim(),exam_start_time:normaliseRosterTime(time)}]};
      result={...result,rows:result.rows.map(r=>({...r,exam_name:r.exam_name||exam.trim(),exam_start_time:r.exam_start_time||normaliseRosterTime(time)})),issues:[...result.issues]};
      for(const r of result.rows){if(!r.full_name||!r.roster_number||!r.exam_name||!r.exam_start_time)result.issues.push({source_row:r.source_row,level:'error',message:'Full name, provider roster number, exam name and IST start time are required. Set the missing defaults or correct the file.'});}
      result.counts={...result.counts,errors:result.issues.filter(x=>x.level==='error').length};
      const current=await loadRosterContext(day,branch);
      if(request!==generation.current)return;
      setContext(current);setPreview(result);setSelected(new Set(result.rows.filter(r=>!possibleLegacyMatch(r,current.candidates,provider)).map(r=>r.roster_number)));
    }catch(e){if(request===generation.current)setError(e instanceof Error?e.message:(e as {message?:string})?.message||'Could not read this roster.');}
    finally{if(request===generation.current)setBusy(false);}
  };
  const save=async()=>{
    if(!preview||preview.counts.errors||!rows.length||saving)return;
    setSaving(true);setError('');
    try{const result=await saveRoster(day,branch,provider,mode,rows);setSuccess(`${result.inserted} added · ${result.updated} updated. Calendar totals recalculated.`);setPreview(null);setContext(null);
      await Promise.all([queryClient.invalidateQueries({queryKey:['candidates']}),queryClient.invalidateQueries({queryKey:['sessions','calendar']}),queryClient.invalidateQueries({queryKey:['dashboardStats']}),queryClient.invalidateQueries({queryKey:['upcomingSchedule']})]);window.dispatchEvent(new Event('fets-data-loaded'));
    }catch(e){setError((e as {message?:string})?.message||'Nothing was saved. Please try again.');}finally{setSaving(false);}
  };
  return createPortal(<div className="calendar-roster-backdrop"><section ref={dialog} className="calendar-roster-dialog" role="dialog" aria-modal="true" aria-label="Candidate roster">
    <header><div><span className="cr-eyebrow">ONE ROSTER · ONE SOURCE</span><h2>Bring the day’s candidates together.</h2><p>Save once to Candidate Tracker. Calendar totals stay in step.</p></div><button aria-label="Close candidate roster" disabled={saving} onClick={onClose}><X size={22}/></button></header>
    <div className="cr-content"><nav aria-label="Roster entry method"><button aria-pressed={mode==='upload'} disabled={saving} onClick={()=>{reset();setMode('upload');}}><Upload size={17}/> Upload roster</button><button aria-pressed={mode==='manual'} disabled={saving} onClick={()=>{reset();setMode('manual');}}><UserPlus size={17}/> Add by hand</button></nav>
    <fieldset disabled={saving}><div className="cr-fields"><label>Exam date<input type="date" value={day} onChange={e=>{reset();setDay(e.target.value);}}/></label><label>Centre<select value={branch} onChange={e=>{reset();setBranch(e.target.value);}}><option value="calicut">Calicut</option><option value="cochin">Cochin</option></select></label><label>Provider<select value={provider} onChange={e=>{reset();setProvider(e.target.value);}}>{PROVIDERS.map(p=><option key={p}>{p}</option>)}</select></label><label>{mode==='upload'?'Exam name when missing from file':'Exam name'}<input value={exam} placeholder="e.g. CMA US" onChange={e=>{reset();setExam(e.target.value);}}/></label><label>{mode==='upload'?'Start time when missing · IST':'Start time · IST'}<input type="time" value={time} onChange={e=>{reset();setTime(e.target.value);}}/></label></div>
    {mode==='upload'?<><label className="cr-file"><FileSpreadsheet size={27}/><span><strong>{file?.name||'Choose a candidate roster'}</strong><small>CSV, XLSX or legacy XLS · up to 20 MB · 2,000 candidates per save</small></span><input aria-label="Roster file" type="file" accept=".csv,.xlsx,.xls" onChange={e=>{reset();const f=e.target.files?.[0]||null;if(f&&!/\.(csv|xlsx|xls)$/i.test(f.name)){setError('Choose a CSV, XLSX or XLS file.');setFile(null);}else setFile(f);}}/></label><details className="cr-aliases"><summary>Custom column headings</summary><p>Use these when a provider uses different headers. Your mappings take priority over built-in names.</p><div className="cr-fields">{aliasFields.map(field=><label key={field}>{field.replace(/_/g,' ')}<input placeholder="Header names, separated by commas" value={aliasText[field]||''} onChange={e=>{reset();setAliasText(a=>({...a,[field]:e.target.value}));}}/></label>)}</div></details></>:<div className="cr-fields">{(['full_name','roster_number','phone','exam_part'] as const).map(field=><label key={field}>{({full_name:'Full name',roster_number:'Provider roster / confirmation ID',phone:'Phone · optional',exam_part:'Exam part · optional'})[field]}<input value={manual[field]} onChange={e=>{reset();setManual(m=>({...m,[field]:e.target.value}));}}/></label>)}</div>}
    <button className="cr-primary" disabled={busy} onClick={review}>{busy?<Loader2 size={16} className="animate-spin"/>:<ArrowRight size={16}/>} Preview {mode==='upload'?'roster':'candidate'}</button></fieldset>
    {error&&<p role="alert" className="cr-error"><AlertCircle size={17}/>{error}</p>}{success&&<p role="status" className="cr-success"><CheckCircle2 size={18}/>{success}</p>}
    {preview&&context&&<section className="cr-review" aria-label="Roster preview"><div className="cr-review-heading"><div><span className="cr-eyebrow">REVIEW BEFORE SAVING</span><h3>{rows.length} selected · {rows.length-updates} new · {updates} existing</h3><p>{preview.sheet_used&&`Sheet: ${preview.sheet_used} · `}{preview.header_row?`Header row ${preview.header_row} · `:''}{preview.counts.skipped} empty or separator rows skipped</p></div><span className="cr-pill">Totals replace, never add</span></div>
    {preview.issues.length>0&&<div className="cr-issues" role="status"><strong>{preview.counts.errors} errors · {preview.counts.warnings} warnings</strong>{preview.issues.map((issue,i)=><p key={i}>{issue.source_row?`Row ${issue.source_row}: `:''}{issue.message}</p>)}{preview.counts.errors>0&&<p>Correct these issues and preview again before saving.</p>}</div>}
    <div className="cr-table-scroll"><table><thead><tr><th>Save</th><th>Provider ID</th><th>Full name</th><th>Exam / part</th><th>Start · IST</th><th>Phone</th><th>Result</th></tr></thead><tbody>{preview.rows.map(r=>{const match=rosterMatch(r,context.candidates,provider),possible=possibleLegacyMatch(r,context.candidates,provider);return <tr key={r.roster_number}><td><input aria-label={`Save ${r.roster_number}`} type="checkbox" checked={selected.has(r.roster_number)} disabled={saving} onChange={e=>setSelected(old=>{const next=new Set(old);e.target.checked?next.add(r.roster_number):next.delete(r.roster_number);return next;})}/></td><td>{r.roster_number}</td><td>{r.full_name}</td><td>{r.exam_name||'Missing'}<small>{r.exam_part||'—'}</small></td><td>{r.exam_start_time||'Missing'}</td><td>{r.phone||'—'}</td><td>{match?'Update existing; keep progress':possible?'Possible tracker match without provider ID — excluded by default':'New registration'}</td></tr>;})}</tbody></table></div>
    {preview.rows.some(r=>possibleLegacyMatch(r,context.candidates,provider))&&<p className="cr-hint">A matching name already exists in Candidate Tracker without a provider ID. Add its provider ID in the tracker and preview again, or select this row only if it is a different candidate.</p>}
    <h4>Calendar reconciliation · {day} · {branch}</h4><div className="cr-groups">{groups.map((g,i)=><div key={i}><span>{g.exam||'Exam not specified'} <small>{g.time||'Time not specified'}</small></span><strong>{g.before} → {g.after}</strong>{g.sessionCount>1&&<small>{g.sessionCount} matching sessions; total assigned once.</small>}</div>)}</div><p className="cr-hint">Names, parts and times update on a matching provider ID. Existing status and check-in progress stay intact. Sessions are retained even when their roster count becomes zero.</p>
    </section>}
    </div><footer><span>Candidate Tracker + Calendar · always synchronized</span><button disabled={saving||!preview||preview.counts.errors>0||rows.length===0||rows.length>2000} className="cr-primary" onClick={save}>{saving?<Loader2 size={17} className="animate-spin"/>:<CheckCircle2 size={17}/>} {saving?'Saving…':`Save ${rows.length||''} ${rows.length===1?'candidate':'candidates'}`}</button></footer>
  </section></div>,document.body);
}
