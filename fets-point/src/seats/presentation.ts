import type{SeatDay,SeatSegment,SeatSession}from'./types';
export const intervalCapacity=(day:SeatDay,segment:SeatSegment)=>segment.capacity??day.capacity;
export function criticalInterval(day:SeatDay){
 return [...(day.overbooked.length?day.overbooked:day.full.length?day.full:day.segments)].sort((a,b)=>b.excess-a.excess||b.booked-a.booked||a.start-b.start)[0];
}
export function capacityRange(day:SeatDay){const values=day.segments.length?day.segments.map(s=>intervalCapacity(day,s)):[day.capacity];const lo=Math.min(...values),hi=Math.max(...values);return lo===hi?String(lo):`${lo}–${hi}`;}
export function criticalLoad(day:SeatDay){const segment=criticalInterval(day);return{booked:segment?.booked??0,capacity:segment?intervalCapacity(day,segment):day.capacity};}
export const maximumExcess=(day:SeatDay)=>Math.max(0,...day.overbooked.map(s=>s.excess));

export function uniqueContributors<T extends SeatSession>(sessions:T[],ids:number[]):T[]{return [...new Map(sessions.filter(session=>ids.includes(session.id)).map(session=>[session.id,session])).values()];}
