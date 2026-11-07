import{useEffect,useState}from'react';
import{checkBooking,formatSeatTime,toSeatSecond}from'./engine';
import{prepareDayPlan}from'./day-plan';
import{findAtomSuggestions}from'./solver';
import CapacityEditor from'./CapacityEditor';
import SeatTimeline,{seatRange,seatEndTime}from'./SeatTimeline';
import{criticalLoad,maximumExcess,capacityRange,intervalCapacity}from'./presentation';
import type{BookingFit,SeatAtomLimits,SeatCapacityAdjustment,SeatCapacityWindow,SeatContext,SeatDay,SeatSession,SeatSuggestions}from'./types';
export type DaySeatPlannerProps={day:SeatDay;sessions:SeatSession[];context?:SeatContext;unavailable:boolean;onCapacitySaved:(record:SeatCapacityAdjustment)=>void};
export default function DaySeatPlanner({day,sessions,context,unavailable,onCapacitySaved}:DaySeatPlannerProps){
 const[first,last]=[day.atoms.length?Math.max(toSeatSecond(day.date,'00:00')!,Math.min(...day.atoms.map(a=>a.start))):null,day.atoms.length?Math.min(toSeatSecond(day.date,'24:00')!,Math.max(...day.atoms.map(a=>a.end))):null];
 const[earlier,setEarlier]=useState('15'),[later,setLater]=useState('15'),[windowStart,setWindowStart]=useState(first===null?'08:00':formatSeatTime(first)),[windowEnd,setWindowEnd]=useState(last===null?'18:00':seatEndTime(last));
 const[examLimits,setExamLimits]=useState<Record<string,SeatAtomLimits>>({}),[manualStarts,setManualStarts]=useState<Record<string,string>>({}),[extraPreview,setExtraPreview]=useState<SeatCapacityWindow|null>(null),[resetId,setResetId]=useState(0);
 const[result,setResult]=useState<SeatSuggestions|null>(null),[selected,setSelected]=useState<string|null>(null),[fit,setFit]=useState<BookingFit|null>(null);
 const[bookingStart,setBookingStart]=useState(''),[bookingEnd,setBookingEnd]=useState(''),[bookingCount,setBookingCount]=useState('1');
 const now=new Date().toISOString(),nowLocal=Date.parse(now)/1000+19800;
 const confirmed=context?.capacity_adjustments||[];
 const capacityWindows=extraPreview?[...confirmed.filter(x=>x.branch_location!==day.branch||x.date!==day.date),extraPreview]:confirmed;
 const saved=confirmed.find(x=>x.branch_location===day.branch&&x.date===day.date);
 const plan=prepareDayPlan(sessions,day.branch,day.date,context?.details||[],{earlier_minutes:Number(earlier),later_minutes:Number(later),exam_limits:examLimits,manual_starts:manualStarts,window_start:windowStart,window_end:windowEnd,capacity_windows:capacityWindows,now});
 const chosen=result?.suggestions.find(x=>x.id===selected);
 const preview=chosen?.day||plan.day;
 const load=criticalLoad(preview);
 const blocked=unavailable||!plan.day.complete||plan.issues.length>0;
 const clear=()=>{setResult(null);setSelected(null);setFit(null);};
 useEffect(()=>{if(unavailable){setResult(null);setSelected(null);setFit(null);}},[unavailable]);
 const edit=(setter:(value:string)=>void,value:string)=>{clear();setter(value);};
 const override=(key:string,patch:Partial<SeatAtomLimits>)=>{clear();setExamLimits(v=>({...v,[key]:{earlier_minutes:Number(earlier),later_minutes:Number(later),...v[key],...patch}}));if(patch.locked)setManualStarts(v=>{const copy={...v};delete copy[key];return copy;});};
 const reset=()=>{clear();setEarlier('15');setLater('15');setWindowStart(first===null?'08:00':formatSeatTime(first));setWindowEnd(last===null?'18:00':seatEndTime(last));setExamLimits({});setManualStarts({});setExtraPreview(null);setResetId(x=>x+1);};
 return <section className="seat-daily-planner" aria-label="Daily seat planner">
  <div className="seat-section-heading"><div><h3>Rearrange this day</h3><p className="seat-muted">Any provider · small timing changes · individual exam locks</p></div><button type="button" className="seat-button seat-button-quiet" onClick={reset}>Reset day preview</button></div>
  <p className="seat-review-note">No booking times have been changed. These controls prepare a day-specific plan for review.</p>
  <div className="seat-day-limits">
   <label>Earlier by · minutes<input aria-label="Day earlier limit" type="number" min="0" max="120" step="1" value={earlier} onChange={e=>edit(setEarlier,e.target.value)}/></label>
   <label>Later by · minutes<input aria-label="Day later limit" type="number" min="0" max="120" step="1" value={later} onChange={e=>edit(setLater,e.target.value)}/></label>
   <label>Planning starts<input aria-label="Day planning starts" type="text" value={windowStart} onChange={e=>edit(setWindowStart,e.target.value)} placeholder="HH:MM"/></label>
   <label>Planning ends<input aria-label="Day planning ends" type="text" value={windowEnd} onChange={e=>edit(setWindowEnd,e.target.value)} placeholder="HH:MM or 24:00"/></label>
  </div>
  <p className="seat-muted">These allowances apply to this preview only. Adjust the permitted planning hours, and lock any exam that cannot move on this date. Duration stays unchanged.</p>
  <details className="seat-exam-adjustments" open><summary>Individual exams and manual starts</summary>
   <div className="seat-exam-list">{day.atoms.map((atom,index)=>{
    const fixed=!atom.movable||atom.start<=nowLocal||atom.start<toSeatSecond(day.date,'00:00')!||atom.end>toSeatSecond(day.date,'24:00')!;
    const limit=examLimits[atom.key],locked=fixed||Boolean(limit?.locked);
    return <article className="seat-exam-row" key={atom.key}>
     <div className="seat-exam-title"><strong>{atom.exam_name}</strong><span>{atom.provider||'Provider unrecorded'}{atom.exam_code&&` · ${atom.exam_code}`} · {atom.count} seats · {formatSeatTime(atom.start)}–{seatEndTime(atom.end)}</span></div>
     <label className="seat-lock"><input aria-label={`Keep ${atom.exam_name} fixed`} type="checkbox" checked={locked} onChange={e=>override(atom.key,{locked:e.target.checked})} disabled={fixed||unavailable}/>Keep fixed{fixed&&<span> · already started or fixed</span>}</label>
     <div className="seat-exam-fields">
      <label>Earlier limit<input aria-label={`Earlier limit for ${atom.exam_name}`} type="number" min="0" max="120" value={limit?.earlier_minutes??earlier} onChange={e=>override(atom.key,{earlier_minutes:Number(e.target.value)})} disabled={locked||unavailable}/></label>
      <label>Later limit<input aria-label={`Later limit for ${atom.exam_name}`} type="number" min="0" max="120" value={limit?.later_minutes??later} onChange={e=>override(atom.key,{later_minutes:Number(e.target.value)})} disabled={locked||unavailable}/></label>
      <label>New start · optional<input aria-label={`New start for ${atom.exam_name}`} type="text" placeholder={formatSeatTime(atom.start)} value={manualStarts[atom.key]||''} onChange={e=>{clear();setManualStarts(v=>{const next={...v};if(e.target.value)next[atom.key]=e.target.value;else delete next[atom.key];return next;});}} disabled={locked||unavailable}/></label>
     </div>
     {index===0&&<span className="seat-muted">Leave a new start blank to let the search choose within your limits.</span>}
    </article>;
   })}{!day.atoms.length&&<p className="seat-empty">No valid recorded exam intervals for this date.</p>}</div>
  </details>
  <CapacityEditor key={resetId} branch={day.branch} date={day.date} saved={saved} canEdit={Boolean(context?.can_edit_rules)} unavailable={unavailable} onPreview={value=>{clear();setExtraPreview(value);}} onConfirmed={record=>{clear();onCapacitySaved(record);}}/>
  <section className="seat-preview" aria-label="Day plan preview">
   <div className="seat-section-heading"><h3>{load.booked} / {load.capacity} seats</h3><span className={`seat-tag seat-tag-${blocked?'incomplete':preview.status}`}>{blocked?'Incomplete preview':preview.overbooked.length?'Overbooked':preview.full.length?'Full':'Overload resolved'}</span></div>
   <p className="seat-muted">Installed {day.capacity} · planned capacity {capacityRange(preview)} · {extraPreview?'includes unconfirmed systems preview':'confirmed systems only'}</p>
   {maximumExcess(preview)>0&&<p className="seat-conflict-summary">{maximumExcess(preview)} seats over capacity</p>}
   {plan.issues.length>0&&<ul className="seat-plan-errors">{plan.issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul>}
   {plan.manual_moves.length>0&&<section aria-label="Manual timing changes"><h4>Manual changes in this preview</h4><ul className="seat-moves">{plan.manual_moves.map(move=><li key={move.atom_key}><strong>{move.exam_name} · {move.count} seats</strong><span>{formatSeatTime(move.before_start)}–{seatEndTime(move.before_end)} → {formatSeatTime(move.after_start)}–{seatEndTime(move.after_end)}</span></li>)}</ul></section>}
   <SeatTimeline day={preview} label={chosen?'Simulated':'Day preview'} uncertain={unavailable||plan.issues.length>0}/>
  </section>
  <button type="button" className="seat-button" disabled={blocked} onClick={()=>{setSelected(null);setResult(findAtomSuggestions(plan.atoms,plan.day,day.branch,day.date,[],{window_start:windowStart,window_end:windowEnd,now,atom_limits:plan.limits,capacity_windows:capacityWindows,max_moves:6,max_evaluations:5000}));}}>Find options for this day</button>
  {result&&<section aria-label="Day timing options" className="seat-search-result" aria-live="polite"><h4>{result.status==='resolved'?'Overload resolved':result.status==='partial'?'Partial improvement':result.status==='incomplete'?'Complete the preview first':!plan.day.overbooked.length?'No rearrangement needed':'No solution found within these limits'}</h4><p className="seat-muted">{result.message}</p><p className="seat-muted">Bounded search · {result.evaluated.toLocaleString()} candidates · up to 6 automatic moves{result.limited?' · search limit reached':''}. Manual changes stay fixed during this search.</p>
   {result.suggestions.map((option,index)=><article className="seat-option" key={option.id}><div className="seat-section-heading"><h4>Option {index+1} · {option.resolved?'Overload resolved':'Partial improvement'}</h4><button type="button" className="seat-button seat-button-quiet" aria-pressed={selected===option.id} onClick={()=>{setFit(null);setSelected(selected===option.id?null:option.id);}}>Review day option {index+1}</button></div><p>{option.people_moved} people moved · {option.seat_minutes} seat-minutes shifted</p><p>Remaining overload: {option.remaining_excess} excess seats · {Math.round(option.remaining_overload_seconds/60)} minutes</p><ul className="seat-moves">{option.moves.map(move=><li key={move.atom_key}><strong>{move.exam_name}</strong><span>{move.count} seats · {move.minutes<0?`${-move.minutes} minutes earlier`:`${move.minutes} minutes later`}</span><span>{formatSeatTime(move.before_start)}–{seatEndTime(move.before_end)} → {formatSeatTime(move.after_start)}–{seatEndTime(move.after_end)}</span></li>)}</ul></article>)}
  </section>}
  <section className="seat-booking-check" aria-label="Check a booking"><div className="seat-section-heading"><h3>Check a booking against this preview</h3><span className="seat-muted">Whole interval, including system availability</span></div>
   <form className="seat-input-row" onSubmit={event=>{event.preventDefault();if(!blocked)setFit(checkBooking(preview,{start_time:bookingStart,end_time:bookingEnd,count:Number(bookingCount)}));}}>
    <label>Booking start<input aria-label="Booking start" type="time" step="1" value={bookingStart} onChange={e=>{setFit(null);setBookingStart(e.target.value);}} required/></label>
    <label>Booking end<input aria-label="Booking end" type="time" step="1" value={bookingEnd} onChange={e=>{setFit(null);setBookingEnd(e.target.value);}} required/></label>
    <label>Booking seats<input aria-label="Booking seats" type="number" min="1" step="1" value={bookingCount} onChange={e=>{setFit(null);setBookingCount(e.target.value);}} required/></label>
    <button type="submit" className="seat-button" disabled={blocked}>Check booking fit</button>
   </form>
   {fit&&<div role="status" aria-label="Booking fit result" className={`seat-fit seat-fit-${fit.status}`}><strong>{fit.status==='overbooked'?'Overbooked':fit.status==='fits'?'Fits throughout preview':fit.status==='full'?'Fits and fills the tightest interval':fit.status==='unknown'?'Availability unknown':'Check booking inputs'}</strong><p>{fit.message}</p>{fit.minimum_free!==null&&<p>Minimum free before booking: {fit.minimum_free} seats</p>}{fit.conflicts.map((x,i)=><p key={i}>{seatRange(x)} · {x.booked} / {intervalCapacity(preview,x)} seats</p>)}</div>}
  </section>
 </section>;
}
