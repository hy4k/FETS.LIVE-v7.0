import{beforeEach,describe,it,expect,vi}from'vitest';
import{fireEvent,render,screen,within}from'@testing-library/react';
import{QueryClient,QueryClientProvider}from'@tanstack/react-query';
import{analyseDay}from'./engine';
import DaySeatPlanner from'./DaySeatPlanner';
import type{SeatSession}from'./types';
vi.mock('./api',()=>({saveSeatCapacity:vi.fn()}));
const date='2099-11-14';
const sessions:SeatSession[]=[{id:1,date,branch_location:'cochin',client_name:'PEARSON VUE',exam_name:'Alpha exam',start_time:'10:00',end_time:'11:00',candidate_count:20},{id:2,date,branch_location:'cochin',client_name:'PROMETRIC',exam_name:'Beta exam',start_time:'10:50',end_time:'11:50',candidate_count:15}];
function show(patch:any={}){return render(<QueryClientProvider client={new QueryClient()}><DaySeatPlanner day={analyseDay(sessions,'cochin',date)} sessions={sessions} context={{rules:[],details:[],can_edit_rules:false,capacity_adjustments:[]}} unavailable={false} onCapacitySaved={()=>{}} {...patch}/></QueryClientProvider>);}
beforeEach(()=>vi.restoreAllMocks());
describe('daily seat rearrangement workbench',()=>{
 it('offers daily timing changes for every provider without reusable rules',()=>{
  show();expect(screen.getByLabelText('Day earlier limit')).toHaveValue(15);expect(screen.getByLabelText('Day later limit')).toHaveValue(15);expect(screen.getByLabelText('New start for Alpha exam')).toBeInTheDocument();expect(screen.getByLabelText('New start for Beta exam')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Day planning starts'),{target:{value:'09:30'}});fireEvent.change(screen.getByLabelText('Day planning ends'),{target:{value:'12:30'}});fireEvent.click(screen.getByRole('button',{name:'Find options for this day'}));
  expect(screen.getByRole('region',{name:'Day timing options'})).toHaveTextContent('Overload resolved');expect(screen.getByText(/No booking times have been changed/)).toBeInTheDocument();
 });
 it('keeps a locked exam out of proposed moves',()=>{
  show();fireEvent.change(screen.getByLabelText('Day planning starts'),{target:{value:'09:30'}});fireEvent.change(screen.getByLabelText('Day planning ends'),{target:{value:'12:30'}});fireEvent.click(screen.getByLabelText('Keep Alpha exam fixed'));fireEvent.click(screen.getByRole('button',{name:'Find options for this day'}));
  const result=screen.getByRole('region',{name:'Day timing options'});expect(result).toHaveTextContent('Beta exam');expect(within(result).queryByText('Alpha exam')).not.toBeInTheDocument();
 });
 it('previews a manual start while preserving duration and resets it',()=>{
  show();fireEvent.change(screen.getByLabelText('Day planning ends'),{target:{value:'12:30'}});fireEvent.change(screen.getByLabelText('New start for Beta exam'),{target:{value:'11:00'}});
  expect(screen.getByRole('region',{name:'Manual timing changes'})).toHaveTextContent('11:00–12:00');expect(screen.getByRole('region',{name:'Day plan preview'})).toHaveTextContent('Overload resolved');
  fireEvent.click(screen.getByRole('button',{name:'Reset day preview'}));expect(screen.getByLabelText('New start for Beta exam')).toHaveValue('');expect(screen.queryByRole('region',{name:'Manual timing changes'})).not.toBeInTheDocument();
 });
 it('previews four extra systems without changing the recorded schedule or provider rules',()=>{
  show();fireEvent.change(screen.getByLabelText('Additional systems'),{target:{value:'4'}});fireEvent.change(screen.getByLabelText('Systems available from'),{target:{value:'10:50'}});fireEvent.change(screen.getByLabelText('Systems available until'),{target:{value:'11:00'}});fireEvent.click(screen.getByRole('button',{name:'Preview capacity'}));
  const preview=screen.getByRole('region',{name:'Day plan preview'});expect(preview).toHaveTextContent('35 / 35 seats');expect(preview).toHaveTextContent('Full');expect(preview).not.toHaveTextContent('4 seats over capacity');expect(screen.queryByRole('button',{name:'Confirm extra systems for this date'})).not.toBeInTheDocument();
 });
 it('prevents recommendations when timings or manual starts are invalid',()=>{
  show();fireEvent.change(screen.getByLabelText('New start for Beta exam'),{target:{value:'09:00'}});expect(screen.getByRole('button',{name:'Find options for this day'})).toBeDisabled();expect(screen.getByRole('region',{name:'Day plan preview'})).toHaveTextContent(/incomplete|review/i);
 });
 it('checks a booking against preview systems for its whole interval',()=>{
  show();fireEvent.change(screen.getByLabelText('Additional systems'),{target:{value:'4'}});fireEvent.change(screen.getByLabelText('Systems available from'),{target:{value:'10:50'}});fireEvent.change(screen.getByLabelText('Systems available until'),{target:{value:'11:00'}});fireEvent.click(screen.getByRole('button',{name:'Preview capacity'}));
  fireEvent.change(screen.getByLabelText('Booking start'),{target:{value:'10:55'}});fireEvent.change(screen.getByLabelText('Booking end'),{target:{value:'11:05'}});fireEvent.click(screen.getByRole('button',{name:'Check booking fit'}));expect(screen.getByRole('status',{name:'Booking fit result'})).toHaveTextContent('Overbooked');
 });
});
