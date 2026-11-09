import{afterEach,beforeEach,describe,expect,it,vi}from'vitest';
import{fireEvent,render,screen,waitFor,within}from'@testing-library/react';
import{QueryClient,QueryClientProvider}from'@tanstack/react-query';
// Load the real lazy module before rendering so this test measures navigation, not Vite's cold transform latency.
import '../seats/SeatManagement';
import './CalendarAnalysis';
import{FetsCalendarPremium}from'./FetsCalendarPremium';
const rows=[{id:1,date:'2026-11-14',branch_location:'cochin',client_name:'PEARSON VUE',exam_name:'Pearson exam',start_time:'09:00',end_time:'12:00',candidate_count:20,user_id:'u'},{id:2,date:'2026-11-14',branch_location:'cochin',client_name:'PROMETRIC',exam_name:'CMA exam',start_time:'10:00',end_time:'13:00',candidate_count:15,user_id:'u'}];
const state=vi.hoisted(()=>({error:false,refresh:vi.fn()}));
vi.mock('../hooks/useAuth',()=>({useAuth:()=>({user:{id:'u'},hasPermission:()=>true})}));
vi.mock('../hooks/useBranch',()=>({useBranch:()=>({activeBranch:'cochin'})}));
vi.mock('../hooks/useBranchFilter',()=>({useBranchFilter:()=>({applyFilter:(q:any)=>q,isGlobalView:false})}));
vi.mock('../hooks/useTheme',()=>({useTheme:()=>({isDarkMode:false})}));
vi.mock('../hooks/useClients',()=>({useClients:()=>({data:[]}),useClientExams:()=>({data:[]})}));
vi.mock('../hooks/useCalendarSessions',()=>({useCalendarSessions:()=>({data:rows,isLoading:false,isError:state.error,error:state.error?Error('Unavailable'):null,isFetching:false,refetch:state.refresh}),useSessionMutations:()=>({addSession:vi.fn(),updateSession:vi.fn(),deleteSession:vi.fn(),isMutating:false})}));
vi.mock('../seats/useSeatContext',()=>({useSeatContext:()=>({data:{rules:[],details:[],can_edit_rules:false,adjacent_sessions:[]},isLoading:false,isFetching:false,isError:false,refetch:vi.fn()})}));
vi.mock('../calendar-insights/data',()=>({fetchInsightData:vi.fn(async()=>({sessions:[],previousSessions:[],context:{rules:[],details:[],can_edit_rules:false,adjacent_sessions:[]},previousError:null,seatError:null}))}));
const setup=()=>render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><FetsCalendarPremium/></QueryClientProvider>);
beforeEach(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-11-06T12:00:00Z'));state.error=false;state.refresh.mockReset();});
afterEach(()=>{rows.splice(2);vi.useRealTimers()});
describe('Calendar seat integration',()=>{
 it('keeps all providers in seat badges even while the visible schedule is searched',()=>{
  setup();expect(screen.getByRole('button',{name:/Kochi Overbooked: 35 of 31/})).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText('Search sessions…'),{target:{value:'CMA'}});
  expect(screen.getByRole('button',{name:/Kochi Overbooked: 35 of 31/})).toBeInTheDocument();
 });
 it('opens the real seat management view from a date badge with that date selected',async()=>{
  setup();fireEvent.click(screen.getByRole('button',{name:/Kochi Overbooked: 35 of 31/}));
  await waitFor(()=>expect(screen.getByRole('region',{name:'Calendar seat management'})).toBeInTheDocument());
  expect(screen.getByLabelText('Seat management date')).toHaveValue('2026-11-14');expect(screen.getByRole('region',{name:'Kochi · booked seats'})).toHaveTextContent('35 / 31');
 });
 it('hides safe capacity claims when the Calendar data read fails',()=>{
  state.error=true;setup();expect(screen.queryByRole('button',{name:/Kochi Overbooked:/})).not.toBeInTheDocument();expect(screen.getAllByText('Seat data unavailable').length).toBeGreaterThan(0);
 });
 it('keeps candidate tools discoverable without duplicate provider filters',()=>{
  setup();expect(screen.queryByRole('menu')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Candidate roster'}));
  expect(screen.getByRole('menuitem',{name:'Upload roster'})).toBeInTheDocument();expect(screen.getByRole('menuitem',{name:'Add by hand'})).toBeInTheDocument();
  expect(screen.getAllByRole('combobox',{name:'Filter by provider'})).toHaveLength(1);
 });
 it('opens actual Analytics on the displayed Calendar month',async()=>{
  setup();fireEvent.click(screen.getByRole('button',{name:'Next calendar period'}));fireEvent.click(screen.getByRole('button',{name:'Analytics'}));
  const panel=await screen.findByRole('dialog',{name:'Calendar analytics'});
  expect(within(panel).getAllByDisplayValue('2026-12').length).toBeGreaterThan(0);
 });
 it('keeps India civil dates through Today and Analytics drilldowns in any browser timezone',async()=>{
  setup();fireEvent.click(screen.getByRole('button',{name:'Day'}));
  expect(screen.getByRole('heading',{name:'Friday, 6 November 2026'})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Analytics'}));
  const panel=await screen.findByRole('dialog',{name:'Calendar analytics'});
  fireEvent.click(await within(panel).findByRole('button',{name:/^14 November 2026:/}));
  expect(screen.getByRole('heading',{name:'Saturday, 14 November 2026'})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Seat management'}));
  await waitFor(()=>expect(screen.getByLabelText('Seat management date')).toHaveValue('2026-11-14'));
  fireEvent.click(screen.getByRole('button',{name:'Day'}));fireEvent.click(screen.getByRole('button',{name:'Today'}));
  expect(screen.getByRole('heading',{name:'Friday, 6 November 2026'})).toBeInTheDocument();
 });
 it('excludes cancelled reservations from day totals while keeping their records available',()=>{
  rows.push({...rows[0],id:3,candidate_count:999,exam_name:'Cancelled exam',status:'cancelled'} as typeof rows[number]);
  setup();const day=screen.getByRole('button',{name:'View sessions for 14/11/2026'});
  expect(within(day).getByText('35 PAX')).toBeInTheDocument();expect(within(day).getByTitle('2 scheduled sessions')).toHaveTextContent('2s');expect(within(day).queryByText('1034 PAX')).toBeNull();
  fireEvent.click(day);const details=screen.getByRole('dialog',{name:'Session details'});
  expect(within(details).getByText('35 candidates')).toBeInTheDocument();
  expect(within(details).getAllByText(/Cancelled/).length).toBeGreaterThan(0);
 });
 it('returns keyboard focus to the same Calendar date after closing its details',()=>{
  setup();const day=screen.getByRole('button',{name:'View sessions for 14/11/2026'});day.focus();
  fireEvent.keyDown(day,{key:'Enter'});const details=screen.getByRole('dialog',{name:'Session details'});
  fireEvent.keyDown(details,{key:'Escape'});
  expect(screen.getByRole('button',{name:'View sessions for 14/11/2026'})).toHaveFocus();
  expect(day).toBeInTheDocument();
 });
 it('keeps one visible form and returns to its date when editing from session details',()=>{
  setup();const day=screen.getByRole('button',{name:'View sessions for 14/11/2026'});day.focus();fireEvent.keyDown(day,{key:'Enter'});
  const details=screen.getByRole('dialog',{name:'Session details'});const edit=within(details).getByRole('button',{name:'Edit Pearson exam'});edit.focus();fireEvent.click(edit);
  const form=screen.getByRole('dialog',{name:'Edit session'});
  expect(form.querySelectorAll(':scope > .fixed')).toHaveLength(1);
  expect(within(form).getByRole('button',{name:'Close session form'})).toHaveFocus();
  fireEvent.keyDown(form,{key:'Escape'});expect(screen.getByRole('button',{name:'View sessions for 14/11/2026'})).toHaveFocus();
 });
 it('opens the real session form outside the scrolling Calendar and restores its launcher on Escape',()=>{
  setup();const launcher=screen.getByRole('button',{name:'Add session'});launcher.focus();fireEvent.click(launcher);
  const panel=screen.getByRole('dialog',{name:'Add session'});expect(panel.parentElement).toBe(document.body);
  expect(within(panel).getByRole('button',{name:'Cancel'})).toBeInTheDocument();
  fireEvent.keyDown(panel,{key:'Escape'});expect(screen.queryByRole('dialog')).toBeNull();expect(launcher).toHaveFocus();
 });
});
