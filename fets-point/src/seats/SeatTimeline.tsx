import { useId } from 'react';
import { formatSeatTime } from './engine';
import type { SeatDay, SeatSegment } from './types';

export function seatEndTime(value: number) {
  return value % 86400 === 0 ? '24:00' : formatSeatTime(value);
}

export function seatRange(segment: Pick<SeatSegment, 'start' | 'end'>) {
  return `${formatSeatTime(segment.start)}–${seatEndTime(segment.end)}`;
}

export default function SeatTimeline({ day, label = 'Original', uncertain = false }: { day: SeatDay; label?: string; uncertain?: boolean }) {
  const id = useId();
  const segments = day.segments;
  const start = segments.length ? Math.min(...segments.map(s => s.start)) : 0;
  const end = segments.length ? Math.max(...segments.map(s => s.end)) : 1;
  const span = Math.max(1, end - start);
  const max = Math.max(day.capacity, day.peak, 1) * 1.18;
  const x = (value: number) => 44 + ((value - start) / span) * 828;
  const y = (value: number) => 158 - (value / max) * 130;
  const capacityY = y(day.capacity);
  const states = { overbooked: 'Overbooked', full: 'Full', available: 'Below capacity', incomplete: 'Incomplete data' };
  const attention = segments.filter(segment => segment.booked >= day.capacity);
  const ordinary = segments.filter(segment => segment.booked > 0 && segment.booked < day.capacity);
  const renderIntervals = (intervals: SeatSegment[]) => <ol className="seat-intervals">
          {intervals.map((segment, index) => {
            const status = segment.excess > 0 ? 'overbooked' : segment.free === 0 ? 'full' : uncertain || !day.complete ? 'incomplete' : 'available';
            const atoms = day.atoms.filter(atom => atom.start < segment.end && atom.end > segment.start);
            return <li key={`${segment.start}-${index}`} className={`seat-interval seat-state-${status}`}>
              <div className="seat-interval-heading"><strong>{seatRange(segment)}</strong><span>{segment.booked} / {day.capacity} seats</span><span className={`seat-tag seat-tag-${status}`}>{states[status]}</span></div>
              <p className="seat-muted">{segment.excess ? `${segment.excess} excess seats` : uncertain || !day.complete ? 'Free seats cannot be confirmed' : `${segment.free} free seats`}</p>
              <ul className="seat-contributors">{atoms.map(atom => <li key={atom.key}><strong>{atom.exam_name || atom.exam_code || 'Untitled exam'}</strong><span>{atom.provider} · {atom.count} {atom.count === 1 ? 'seat' : 'seats'} · {atom.basis === 'source' ? 'Source appointment times' : 'Calendar-declared times'}</span></li>)}</ul>
            </li>;
          })}
        </ol>;
  return <figure className="seat-timeline" aria-labelledby={`${id}-title`}>
    <figcaption id={`${id}-title`}><strong>{label} timeline</strong><span>{uncertain || !day.complete ? 'Incomplete data · known bookings shown' : 'Planned booked seats · all providers'}</span></figcaption>
    {segments.length ? <>
      <svg viewBox="0 0 900 198" role="img" aria-label={`${label} ${day.branch === 'calicut' ? 'Calicut' : 'Kochi'} planned booked seats: peak ${day.peak}, capacity ${day.capacity}${uncertain || !day.complete ? ' · incomplete data; known bookings only' : ''}`}>
        <line x1="44" x2="872" y1="158" y2="158" className="seat-axis" />
        <line x1="44" x2="872" y1={capacityY} y2={capacityY} className="seat-capacity" />
        <text x="38" y={capacityY + 4} textAnchor="end" className="seat-svg-text">{day.capacity}</text>
        <text x="38" y="162" textAnchor="end" className="seat-svg-text">0</text>
        {segments.map((segment, index) => <g key={`${segment.start}-${index}`}>
          <rect x={x(segment.start)} y={y(segment.booked)} width={Math.max(0, x(segment.end) - x(segment.start))} height={158 - y(segment.booked)} className={`seat-bar seat-bar-${segment.excess > 0 ? 'over' : segment.free === 0 ? 'full' : uncertain || !day.complete ? 'incomplete' : 'available'} ${uncertain ? 'seat-bar-uncertain' : ''}`} />
          <line x1={x(segment.start)} x2={x(segment.end)} y1={y(segment.booked)} y2={y(segment.booked)} className="seat-step" />
        </g>)}
        <text x="44" y="183" className="seat-svg-text">{formatSeatTime(start)}</text>
        {span > 3600 && <text x="458" y="183" textAnchor="middle" className="seat-svg-text">{formatSeatTime(Math.round((start + end) / 2))}</text>}
        <text x="872" y="183" textAnchor="end" className="seat-svg-text">{seatEndTime(end)}</text>
      </svg>
      <div className="seat-chart-key"><span><i className="seat-key-capacity" />Capacity {day.capacity}</span><span><i className="seat-key-full" />Full</span><span><i className="seat-key-over" />Overbooked</span></div>
      {attention.length > 0 && <details className="seat-interval-details" open>
        <summary>{attention.length} full or overloaded {attention.length === 1 ? 'interval' : 'intervals'} & contributing exams</summary>
        {renderIntervals(attention)}
      </details>}
      {ordinary.length > 0 && <details className="seat-interval-details">
        <summary>Other exact intervals & contributing exams</summary>
        {renderIntervals(ordinary)}
      </details>}
    </> : <p className="seat-empty">{uncertain || !day.complete ? 'The known schedule cannot establish available seats.' : 'No recorded appointments for this date.'}</p>}
  </figure>;
}
