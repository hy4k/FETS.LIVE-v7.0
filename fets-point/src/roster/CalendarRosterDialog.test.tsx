import {describe,it,expect,vi,beforeEach} from 'vitest';
import {fireEvent,render,screen} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import CalendarRosterDialog from './CalendarRosterDialog';
const api=vi.hoisted(()=>({load:vi.fn(),save:vi.fn()}));
vi.mock('./roster-api',async()=>{const original=await vi.importActual<typeof import('./roster-api')>('./roster-api');return {...original,loadRosterContext:api.load,saveRoster:api.save};});
vi.mock('../lib/supabase',()=>({supabase:{}}));
beforeEach(()=>{api.load.mockReset().mockResolvedValue({candidates:[],sessions:[]});api.save.mockReset().mockResolvedValue({inserted:1,updated:0,saved:1,calendar_synced:true});});
const show=()=>render(<QueryClientProvider client={new QueryClient()}><CalendarRosterDialog mode="manual" day="2026-10-01" branch="cochin" onClose={vi.fn()}/></QueryClientProvider>);
describe('Calendar candidate review',()=>{
  it('requires review before saving one full-name candidate and invalidates the preview when scope changes',async()=>{
    show();expect(screen.getByRole('button',{name:'Save candidates'})).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Full name'),{target:{value:'Alex Thomas Joseph'}});
    fireEvent.change(screen.getByLabelText('Provider roster / confirmation ID'),{target:{value:'00042'}});
    fireEvent.change(screen.getByLabelText('Exam name'),{target:{value:'CMA US'}});
    fireEvent.change(screen.getByLabelText('Start time · IST'),{target:{value:'09:30'}});
    fireEvent.click(screen.getByRole('button',{name:'Preview candidate'}));await screen.findByRole('region',{name:'Roster preview'});
    expect(api.save).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Centre'),{target:{value:'calicut'}});expect(screen.queryByRole('region',{name:'Roster preview'})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Preview candidate'}));await screen.findByRole('region',{name:'Roster preview'});
    fireEvent.click(screen.getByRole('button',{name:'Save 1 candidate'}));await screen.findByText(/1 added · 0 updated/);
    expect(api.save).toHaveBeenCalledWith('2026-10-01','calicut','PROMETRIC','manual',[expect.objectContaining({full_name:'Alex Thomas Joseph',roster_number:'00042',exam_start_time:'09:30:00'})]);
  });
  it('blocks saving incomplete entries',async()=>{
    show();fireEvent.click(screen.getByRole('button',{name:'Preview candidate'}));await screen.findByText(/Correct these issues/);expect(screen.getByRole('button',{name:'Save 1 candidate'})).toBeDisabled();
  });
});
