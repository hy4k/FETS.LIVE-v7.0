import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Moon, Save, Sun, UserCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './daily-operations-reports.css';

type Kind = 'morning' | 'evening';
type Status = 'green' | 'yellow' | 'red';
type Answer = 'yes' | 'no' | 'unchecked';
type Report = {
  id?: string; branch: string; day: string; kind: Kind; overall: Status;
  exam_client: string; expected_sessions: number | null; expected_candidates: number | null;
  attended: number | null; no_shows: number | null; checks: Record<string, Answer>;
  issues: string; action_taken: string; pending: string; manager_attention: boolean;
  submitted_by?: string; submitted_at?: string; updated_at?: string;
};
const GROUPS: Record<Kind, { key: string; label: string }[]> = {
  morning: [
    { key: 'systems', label: 'Systems / Server / RMA' },
    { key: 'cctv', label: 'CCTV / DVR / Internet' },
    { key: 'rooms', label: 'AC / Admin / Front Office' },
    { key: 'roster', label: 'Roster / FETS.Live' },
    { key: 'duties', label: 'Duties allocated' },
  ],
  evening: [
    { key: 'monitoring', label: 'Hall walks / DVR checks' },
    { key: 'checkin', label: 'Candidate check-in / out' },
    { key: 'cpr', label: 'CPR / Client reports' },
    { key: 'records', label: 'FETS.Live / records updated' },
    { key: 'duties', label: 'Assigned duties completed' },
    { key: 'signedout', label: 'Candidates signed out' },
    { key: 'closing', label: 'Closing checks completed' },
  ],
};
const blank = (branch:string,day:string,kind:Kind):Report => ({
  branch,day,kind,overall:'green',exam_client:'',expected_sessions:null,
  expected_candidates:null,attended:null,no_shows:null,checks:{},
  issues:'',action_taken:'',pending:'',manager_attention:false,
});
const numberOrNull = (input: string) => input.trim()==='' ? null : Number(input);

export default function DailyOperationsReports({ branch, day, profileId }: {
  branch: string; day: string; profileId: string;
}) {
  const [kind,setKind]=useState<Kind>('morning');
  const [records,setRecords]=useState<Partial<Record<Kind,Report>>>({});
  const [draft,setDraft]=useState<Report>(()=>blank(branch,day,'morning'));
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const existing=records[kind];
  useEffect(()=>{
    let live=true; setLoading(true);setError('');setNotice('');setKind('morning');
    (async()=>{
      const {data,error}=await supabase.from('centre_daily_reports').select('*').eq('branch',branch).eq('day',day);
      if(error)throw error;
      if(!live)return;
      const next:Partial<Record<Kind,Report>>={};
      for(const item of data||[])next[item.kind as Kind]=item as Report;
      setRecords(next);setDraft(next.morning||blank(branch,day,'morning'));
    })().catch(e=>{if(live)setError(e?.message||'Could not load daily reports. Check database migration.');})
      .finally(()=>{if(live)setLoading(false);});
    return()=>{live=false};
  },[branch,day]);
  const choose=(next:Kind)=>{setKind(next);setDraft(records[next]||blank(branch,day,next));setNotice('');setError('');};
  const update=(value:Partial<Report>)=>setDraft(d=>({...d,...value}));
  const answered=useMemo(()=>GROUPS[kind].filter(i=>draft.checks[i.key] && draft.checks[i.key]!=='unchecked').length,[draft.checks,kind]);
  const save=async()=>{
    setError('');setNotice('');
    if(!profileId){setError('Staff profile missing. Please sign in again.');return;}
    if(!draft.exam_client.trim()){setError('Enter the exam or client name.');return;}
    if(draft.expected_sessions===null || draft.expected_candidates===null){setError('Enter sessions and expected candidates.');return;}
    if(draft.expected_sessions<0 || draft.expected_candidates<0){setError('Numbers cannot be negative.');return;}
    if(GROUPS[kind].some(i=>!draft.checks[i.key] || draft.checks[i.key]==='unchecked')){
      setError('Complete every checklist item. Select Yes or No.');return;
    }
    if(kind==='evening'){
      if(draft.attended===null || draft.no_shows===null){setError('Enter attendance and no-shows.');return;}
      if(draft.attended+draft.no_shows>draft.expected_candidates){setError('Attended + no-shows exceeds expected candidates.');return;}
    }
    if((draft.overall!=='green' || Object.values(draft.checks).includes('no'))&&!draft.issues.trim()){
      setError('Describe the issue when any check fails or status is not green.');return;
    }
    setSaving(true);
    try{
      const payload={
        branch,day,kind,overall:draft.overall,exam_client:draft.exam_client.trim(),
        expected_sessions:draft.expected_sessions,expected_candidates:draft.expected_candidates,
        attended:kind==='evening'?draft.attended:null,no_shows:kind==='evening'?draft.no_shows:null,
        checks:draft.checks,issues:draft.issues.trim(),action_taken:draft.action_taken.trim(),
        pending:draft.pending.trim(),manager_attention:draft.manager_attention,
      };
      const query=existing?.id
        ?supabase.from('centre_daily_reports').update(payload).eq('id',existing.id)
        :supabase.from('centre_daily_reports').insert({...payload,submitted_by:profileId});
      const {data,error}=await query.select().single();
      if(error)throw error;
      const saved=data as Report;
      setRecords(r=>({...r,[kind]:saved}));setDraft(saved);
      setNotice(existing?'Report updated successfully.':'Report submitted successfully.');
    }catch(e:any){setError(e.message||'Could not save your report.');}
    finally{setSaving(false);}
  };
  return <section className="fets-daily" aria-label="Daily operations reports">
    <header className="fets-daily-hero">
      <div><span className="fets-daily-kicker">FETS / OPERATIONS CONTROL</span>
        <h2>Every shift. <em>Accounted for.</em></h2>
        <p>Two quick reports. Clear answers. No missed issues.</p></div>
      <div className="fets-daily-location"><ClipboardCheck size={22}/><strong>{branch.toUpperCase()}</strong><small>{day}</small></div>
    </header>
    <div className="fets-daily-switch">
      {(['morning','evening'] as const).map(k=><button type="button" key={k}
        className={kind===k?'active':''} aria-pressed={kind===k} onClick={()=>choose(k)}>
        {k==='morning'?<Sun size={18}/>:<Moon size={18}/>}
        <span>{k==='morning'?'Opening readiness':'Evening summary'}</span>
        {records[k]&&<CheckCircle2 size={16} className="fets-daily-done"/>}
      </button>)}
    </div>
    {loading?<p className="fets-daily-message">Loading centre reports…</p>:<>
    <div className="fets-daily-subheading"><div>
      <span>{kind==='morning'?'01 / BEFORE ADMISSIONS':'02 / AFTER FINAL SESSION'}</span>
      <h3>{kind==='morning'?'Ready for the day?':'How did the day go?'}</h3>
    </div><small>{answered}/{GROUPS[kind].length} checks confirmed</small></div>
    <div className="fets-daily-fields">
      <label>Exam / client<input maxLength={160} placeholder="e.g. CMA US / Prometric" value={draft.exam_client}
        onChange={e=>update({exam_client:e.target.value})}/></label>
      <label>Sessions<input type="number" min="0" max="30" value={draft.expected_sessions??''}
        onChange={e=>update({expected_sessions:numberOrNull(e.target.value)})}/></label>
      <label>Expected candidates<input type="number" min="0" max="5000" value={draft.expected_candidates??''}
        onChange={e=>update({expected_candidates:numberOrNull(e.target.value)})}/></label>
      {kind==='evening'&&<>
        <label>Attended<input type="number" min="0" value={draft.attended??''}
          onChange={e=>update({attended:numberOrNull(e.target.value)})}/></label>
        <label>No-shows<input type="number" min="0" value={draft.no_shows??''}
          onChange={e=>update({no_shows:numberOrNull(e.target.value)})}/></label>
      </>}
    </div>
    <div className="fets-daily-checks">{GROUPS[kind].map(item=><div className="fets-daily-check" key={item.key}>
      <strong>{item.label}</strong><div role="group" aria-label={item.label}>
        {(['yes','no','unchecked'] as const).map(a=><button type="button" key={a}
          aria-pressed={(draft.checks[item.key]||'unchecked')===a}
          className={(draft.checks[item.key]||'unchecked')===a?'selected '+a:''}
          onClick={()=>update({checks:{...draft.checks,[item.key]:a}})}>
          {a==='yes'?'Yes':a==='no'?'No':'Not checked'}</button>)}
      </div></div>)}</div>
    <div className="fets-daily-fields fets-daily-notes">
      <label>Issues / incidents<textarea rows={2} maxLength={2000} placeholder="Write None if all clear" value={draft.issues} onChange={e=>update({issues:e.target.value})}/></label>
      <label>Action taken<textarea rows={2} maxLength={2000} placeholder="What did you do?" value={draft.action_taken} onChange={e=>update({action_taken:e.target.value})}/></label>
      <label>Pending / next shift<textarea rows={2} maxLength={2000} placeholder="Anything left to finish?" value={draft.pending} onChange={e=>update({pending:e.target.value})}/></label>
    </div>
    <div className="fets-daily-bottom">
      <div className="fets-daily-status"><span>Overall centre status</span>
        <div>{(['green','yellow','red'] as const).map(s=><button key={s} type="button"
          className={draft.overall===s?'on '+s:''} aria-pressed={draft.overall===s}
          onClick={()=>update({overall:s})}>{s==='green'?'● All clear':s==='yellow'?'● Attention':'● Urgent'}</button>)}</div>
      </div>
      <label className="fets-daily-attention"><input type="checkbox" checked={draft.manager_attention}
        onChange={e=>update({manager_attention:e.target.checked})}/> <UserCheck size={18}/> Manager attention needed</label>
    </div>
    {(draft.overall==='red'||draft.manager_attention)&&<p className="fets-daily-warning"><AlertTriangle size={16}/> For urgent issues, contact the manager immediately. This report is not an emergency alert.</p>}
    {error&&<p className="fets-daily-error" role="alert">{error}</p>}
    {notice&&<p className="fets-daily-success" role="status">{notice}</p>}
    <footer className="fets-daily-footer">
      <span>{existing?.submitted_at?'Submitted '+new Date(existing.submitted_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}):'Your name and submission time are recorded.'}</span>
      <button type="button" disabled={saving} onClick={()=>void save()}><Save size={17}/>{saving?'Saving…':existing?'Update report':'Submit report'}</button>
    </footer>
    </>}
  </section>;
}
