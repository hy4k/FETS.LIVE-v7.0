import{useEffect,useRef,useState}from'react';
import{useQueryClient}from'@tanstack/react-query';
import{saveSeatCapacity}from'./api';
import{toSeatSecond}from'./engine';
import type{SeatBranch,SeatCapacityAdjustment,SeatCapacityWindow}from'./types';
export type CapacityEditorProps={branch:SeatBranch;date:string;saved?:SeatCapacityAdjustment;canEdit:boolean;unavailable:boolean;onPreview:(capacity:SeatCapacityWindow|null)=>void;onConfirmed:(capacity:SeatCapacityAdjustment)=>void};
export default function CapacityEditor({branch,date,saved,canEdit,unavailable,onPreview,onConfirmed}:CapacityEditorProps){
 const client=useQueryClient(),generation=useRef(0);
 const[extra,setExtra]=useState(String(saved?.extra_systems||0)),[from,setFrom]=useState(saved?.start_time||'00:00'),[until,setUntil]=useState(saved?.end_time||'24:00'),[note,setNote]=useState(saved?.note||'');
 const[previewed,setPreviewed]=useState(''),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const signature=JSON.stringify([branch,date,extra,from,until,note]);
 const start=toSeatSecond(date,from),end=toSeatSecond(date,until),number=Number(extra);
 const valid=extra.trim()!==''&&Number.isInteger(number)&&number>=0&&number<=100&&start!==null&&end!==null&&end>start&&start<toSeatSecond(date,'24:00')!&&note.trim().length<=500;
 useEffect(()=>{generation.current++;setExtra(String(saved?.extra_systems||0));setFrom(saved?.start_time||'00:00');setUntil(saved?.end_time||'24:00');setNote(saved?.note||'');setPreviewed('');setSaving(false);setError('');return()=>{generation.current++;};},[branch,date,saved?.updated_at,canEdit]);
 const edit=(setter:(value:string)=>void,value:string)=>{setter(value);setPreviewed('');setError('');onPreview(null);};
 const window:SeatCapacityWindow={branch_location:branch,date,extra_systems:number,start_time:from,end_time:until};
 const confirm=async()=>{
  if(!canEdit||!valid||unavailable||saving||previewed!==signature)return;
  const token=++generation.current;setSaving(true);setError('');
  try{const receipt=await saveSeatCapacity({...window,note,expected_updated_at:saved?.updated_at||null});const refreshing=client.invalidateQueries({queryKey:['seat-context']});if(token===generation.current){onConfirmed(receipt);setPreviewed('');onPreview(null);}await refreshing;}
  catch(e){if(token===generation.current)setError(e instanceof Error?e.message:'Extra systems were not confirmed.');}
  finally{if(token===generation.current)setSaving(false);}
 };
 return <section className="seat-capacity-editor" aria-label="Extra systems">
  <div className="seat-section-heading"><h3>Extra systems for this date</h3><span className="seat-tag">Installed: {branch==='calicut'?40:31}</span></div>
  <p className="seat-muted">Add workstations to this centre for a stated time window. Preview first; confirm only when these systems will be available.</p>
  {saved&&saved.extra_systems>0&&<p className="seat-confirmed-capacity">Confirmed: +{saved.extra_systems} systems · {saved.start_time.slice(0,5)}–{saved.end_time.slice(0,5)}{saved.note&&` · ${saved.note}`}</p>}
  <form onSubmit={event=>{event.preventDefault();if(!valid||unavailable||saving)return;setError('');setPreviewed(signature);onPreview(window);}}>
   <div className="seat-input-row"><label>Additional systems<input aria-label="Additional systems" type="number" min="0" max="100" step="1" value={extra} onChange={e=>edit(setExtra,e.target.value)} disabled={saving} required/></label>
   <label>Systems available from<input aria-label="Systems available from" type="text" placeholder="HH:MM" value={from} onChange={e=>edit(setFrom,e.target.value)} disabled={saving} required/></label>
   <label>Systems available until<input aria-label="Systems available until" type="text" placeholder="HH:MM or 24:00" value={until} onChange={e=>edit(setUntil,e.target.value)} disabled={saving} required/></label></div>
   <label>Capacity note<input aria-label="Capacity note" maxLength={500} value={note} onChange={e=>edit(setNote,e.target.value)} disabled={saving} placeholder="For example: four prepared spare workstations"/></label>
   <div className="seat-plan-actions"><button className="seat-button seat-button-quiet" type="submit" disabled={!valid||unavailable||saving}>Preview capacity</button>
   {canEdit&&<button className="seat-button" type="button" onClick={()=>void confirm()} disabled={!valid||unavailable||saving||previewed!==signature}>{saving?'Confirming systems…':'Confirm extra systems for this date'}</button>}</div>
  </form>
  {previewed===signature&&<p className="seat-incomplete-note">Preview only · Calendar warnings stay unchanged until an authorised editor confirms this capacity.</p>}
  {!canEdit&&<p className="seat-muted">You can preview extra systems. Calendar editors can confirm capacity for everyone.</p>}
  {!valid&&<p className="seat-error">Use 0–100 whole systems and a valid same-day window. Set 0 to reset additional capacity.</p>}
  {error&&<p role="alert" className="seat-error">{error}</p>}
 </section>;
}
