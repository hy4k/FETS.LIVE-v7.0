import {describe,expect,it,vi} from 'vitest';
import {fireEvent,render,screen} from '@testing-library/react';
import SeatCalendarBadges from './SeatCalendarBadges';
import type{SeatSession}from './types';
const row=(id:number,start_time:string,end_time:string,candidate_count:number,branch_location='cochin'):SeatSession=>({id,date:'2026-11-14',branch_location,client_name:id===1?'PEARSON VUE':'PROMETRIC',exam_name:'Example',start_time,end_time,candidate_count});
describe('Calendar concurrency badges',()=>{
 it('shows peak30/31 for60 sequential candidates instead of overbooked',()=>{
  render(<SeatCalendarBadges sessions={[row(1,'09:00','11:00',30),row(2,'11:00','13:00',30)]} date="2026-11-14" branch="cochin" onOpen={()=>{}}/>);
  expect(screen.getByRole('button').textContent).toContain('30/31');expect(screen.getByRole('button').getAttribute('data-seat-status')).toBe('available');
 });
 it('counts providers together and opens the selected date without bubbling',()=>{
  const open=vi.fn(),parent=vi.fn();render(<div onClick={parent}><SeatCalendarBadges sessions={[row(1,'09:00','12:00',20),row(2,'10:00','13:00',15)]} date="2026-11-14" branch="cochin" onOpen={open}/></div>);
  const button=screen.getByRole('button');expect(button.textContent).toContain('35/31');expect(button.getAttribute('data-seat-status')).toBe('overbooked');fireEvent.click(button);expect(open).toHaveBeenCalledWith('2026-11-14');expect(parent).not.toHaveBeenCalled();
 });
 it('shows independent global capacities and exactly-full status',()=>{
  render(<SeatCalendarBadges sessions={[row(1,'09:00','12:00',31),row(2,'09:00','12:00',20,'calicut')]} date="2026-11-14" branch="global" onOpen={()=>{}}/>);
  const buttons=screen.getAllByRole('button');expect(buttons).toHaveLength(2);expect(buttons.some(b=>b.textContent?.includes('31/31')&&b.getAttribute('data-seat-status')==='full')).toBe(true);expect(buttons.some(b=>b.textContent?.includes('20/40'))).toBe(true);
 });
 it('never reports unknown end times or failed reads as free seats',()=>{
  const{rerender}=render(<SeatCalendarBadges sessions={[row(1,'09:00','09:00',20)]} date="2026-11-14" branch="cochin" onOpen={()=>{}}/>);expect(screen.getByRole('button').textContent).toMatch(/timing needed/i);
  rerender(<SeatCalendarBadges sessions={[]} date="2026-11-14" branch="cochin" unavailable onOpen={()=>{}}/>);expect(screen.getByText(/seat data unavailable/i)).toBeInTheDocument();
 });
});
