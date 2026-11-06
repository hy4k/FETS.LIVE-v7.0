import type{SeatSession,SeatDetail}from'./types';
import {analyseDay}from'./engine';
import './seat-calendar.css';
export default function SeatCalendarBadges({sessions,details,date,branch,unavailable,onOpen}:{sessions:SeatSession[];details?:SeatDetail[];date:string;branch:string;unavailable?:boolean;onOpen:(date:string)=>void}){
  if(unavailable)return <span className="seat-calendar-unavailable">Seat data unavailable</span>;
  const centres=branch==='global'?['calicut','cochin'] as const:branch==='calicut'||branch==='cochin'?[branch]:[];
  if(!centres.length)return <span className="seat-calendar-unavailable">Seat capacity unconfigured</span>;
  const days=centres.map(b=>analyseDay(sessions,b as 'calicut'|'cochin',date,details));
  if(days.every(d=>d.total===0&&d.issues.length===0))return null;
  return <div className="seat-calendar-badges">{days.map(day=>{
    const name=day.branch==='cochin'?'Kochi':'Calicut';
    const label=day.status==='overbooked'?'Overbooked':!day.complete?'Timing needed':day.status==='full'?'Full':'Peak';
    return <button key={day.branch} type="button" className={`seat-calendar-badge seat-calendar-badge-${day.status}`} data-seat-status={day.status}
      aria-label={`${name} ${label}: ${day.peak} of ${day.capacity} seats on ${date}. Open seat management`}
      onKeyDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onOpen(date);}}>
      {branch==='global'&&<span>{name}</span>}<strong>{label} {day.peak}/{day.capacity}</strong>{!day.complete&&day.status==='overbooked'&&<span>Timing incomplete</span>}
    </button>;
  })}</div>;
}
