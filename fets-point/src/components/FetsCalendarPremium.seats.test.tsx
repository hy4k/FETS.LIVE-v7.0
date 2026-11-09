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
afterEach(()=>vi.useRealTimers());
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
});
