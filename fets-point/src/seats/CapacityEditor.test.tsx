import{act,fireEvent,render,screen,waitFor}from'@testing-library/react';
import{QueryClient,QueryClientProvider}from'@tanstack/react-query';
import{beforeEach,describe,it,expect,vi}from'vitest';
import CapacityEditor from'./CapacityEditor';
const save=vi.hoisted(()=>vi.fn());vi.mock('./api',()=>({saveSeatCapacity:save}));
const preview=vi.fn(),confirmed=vi.fn();
const base={branch:'cochin' as const,date:'2099-11-14',canEdit:true,unavailable:false,onPreview:preview,onConfirmed:confirmed};
function show(props={}){const client=new QueryClient({defaultOptions:{queries:{retry:false}}});return {...render(<QueryClientProvider client={client}><CapacityEditor {...base}{...props}/></QueryClientProvider>),client};}
beforeEach(()=>{save.mockReset();preview.mockReset();confirmed.mockReset();});
const enter=()=>{fireEvent.change(screen.getByLabelText('Additional systems'),{target:{value:'4'}});fireEvent.change(screen.getByLabelText('Systems available from'),{target:{value:'10:30'}});fireEvent.change(screen.getByLabelText('Systems available until'),{target:{value:'11:00'}});};
describe('additional systems preview and confirmation',()=>{
 it('previews a scoped availability window and requires it before confirming',async()=>{
  save.mockResolvedValue({...base,branch_location:'cochin',extra_systems:4,start_time:'10:30',end_time:'11:00',note:'',updated_at:'v1'});show();enter();
  expect(screen.getByRole('button',{name:'Confirm extra systems for this date'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Preview capacity'}));
  expect(preview).toHaveBeenLastCalledWith({branch_location:'cochin',date:'2099-11-14',extra_systems:4,start_time:'10:30',end_time:'11:00'});
  expect(save).not.toHaveBeenCalled();expect(screen.getByText(/Preview only/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Confirm extra systems for this date'}));
  await waitFor(()=>expect(confirmed).toHaveBeenCalledTimes(1));expect(save).toHaveBeenCalledWith({branch_location:'cochin',date:'2099-11-14',extra_systems:4,start_time:'10:30',end_time:'11:00',note:'',expected_updated_at:null});
 });
 it('keeps preview available to readers while withholding shared confirmation',()=>{
  show({canEdit:false});enter();fireEvent.click(screen.getByRole('button',{name:'Preview capacity'}));expect(preview).toHaveBeenCalled();expect(screen.queryByRole('button',{name:/Confirm extra systems/})).not.toBeInTheDocument();
 });
 it('invalidates confirmation when a preview input changes',()=>{
  show();enter();fireEvent.click(screen.getByRole('button',{name:'Preview capacity'}));expect(screen.getByRole('button',{name:'Confirm extra systems for this date'})).toBeEnabled();
  fireEvent.change(screen.getByLabelText('Additional systems'),{target:{value:'5'}});expect(screen.getByRole('button',{name:'Confirm extra systems for this date'})).toBeDisabled();expect(preview).toHaveBeenLastCalledWith(null);
 });
 it('preserves the loaded version and reports stale failures without success',async()=>{
  save.mockRejectedValue(Error('Capacity changed; refresh'));show({saved:{branch_location:'cochin',date:'2099-11-14',extra_systems:2,start_time:'00:00',end_time:'24:00',note:'ready',updated_at:'v1'}});enter();fireEvent.click(screen.getByRole('button',{name:'Preview capacity'}));fireEvent.click(screen.getByRole('button',{name:'Confirm extra systems for this date'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Capacity changed');expect(save.mock.calls[0][0].expected_updated_at).toBe('v1');expect(confirmed).not.toHaveBeenCalled();
 });
 it('ignores a late confirmation after the selected day changes',async()=>{
  let finish!:(value:any)=>void;save.mockImplementation(()=>new Promise(resolve=>finish=resolve));const view=show();const invalidate=vi.spyOn(view.client,'invalidateQueries');enter();fireEvent.click(screen.getByRole('button',{name:'Preview capacity'}));fireEvent.click(screen.getByRole('button',{name:'Confirm extra systems for this date'}));
  view.rerender(<QueryClientProvider client={new QueryClient()}><CapacityEditor {...base}date="2099-11-15"/></QueryClientProvider>);await act(async()=>finish({updated_at:'v2'}));expect(confirmed).not.toHaveBeenCalled();expect(invalidate).toHaveBeenCalledWith({queryKey:['seat-context']});
 });
});
