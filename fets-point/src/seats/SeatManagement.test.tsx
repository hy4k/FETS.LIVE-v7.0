import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SeatManagement from './SeatManagement';
import type { SeatContext, SeatRule, SeatSession } from './types';

const boundary = vi.hoisted(() => ({ context: null as SeatContext | null, error: false, fetching: false, save: vi.fn(), refetch: vi.fn() }));
vi.mock('./useSeatContext', () => ({ useSeatContext: () => ({ data: boundary.context, isLoading: false, isError: boundary.error, error: boundary.error ? new Error('Context unavailable') : null, isFetching: boundary.fetching, refetch: boundary.refetch }) }));
vi.mock('./api', () => ({ saveSeatRule: boundary.save,saveSeatCapacity:vi.fn() }));
const rule: SeatRule = { id: 'rule-1', branch_location: 'cochin', provider: 'PEARSON VUE', exam_code: null, exam_name: null, earlier_minutes: 30, later_minutes: 30, updated_at: '2026-11-01T00:00:00Z' };
const sessions: SeatSession[] = [
  { id: 1, date: '2099-11-14', branch_location: 'cochin', client_name: 'PEARSON VUE', exam_name: 'Alpha exam', start_time: '10:00:00', end_time: '11:00:00', candidate_count: 20 },
  { id: 2, date: '2099-11-14', branch_location: 'cochin', client_name: 'PROMETRIC', exam_name: 'Beta exam', start_time: '10:30:00', end_time: '11:30:00', candidate_count: 15 },
  { id: 3, date: '2099-11-14', branch_location: 'calicut', client_name: 'PROMETRIC', exam_name: 'Other centre exam', start_time: '10:30:00', end_time: '11:30:00', candidate_count: 40 },
];
function show(overrides: Partial<React.ComponentProps<typeof SeatManagement>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const props = { sessions, currentDate: new Date(2099, 10, 14), branch: 'cochin', userId: 'synthetic-user', ...overrides };
  const view = render(<QueryClientProvider client={client}><SeatManagement {...props} /></QueryClientProvider>);
  const providerButton=screen.queryByRole('button',{name:'Provider defaults'});if(providerButton)fireEvent.click(providerButton);
  return { ...view, client, rerenderSeat: (next: typeof overrides) => view.rerender(<QueryClientProvider client={client}><SeatManagement {...props} {...next} /></QueryClientProvider>) };
}
beforeEach(() => { boundary.context = { rules: [], details: [], can_edit_rules: false }; boundary.error = false; boundary.fetching = false; boundary.save.mockReset(); boundary.refetch.mockReset(); });

describe('Calendar seat management', () => {
  it('shows the exact overloaded window and contributing exams across providers', () => {
    show();
    const day = screen.getByRole('region', { name: 'Kochi · booked seats' });
    expect(within(day).getByRole('heading', { name: '35 / 31 seats · 10:30–11:00' })).toBeInTheDocument();
    expect(within(day).getByText('4 seats over capacity')).toBeInTheDocument();
    expect(within(day).getAllByText(/Alpha exam/).length).toBeGreaterThan(0);
    expect(within(day).getAllByText(/Beta exam/).length).toBeGreaterThan(0);
    expect(within(day).queryByText(/Other centre exam/)).not.toBeInTheDocument();
    expect(within(day).getByRole('img', { name: /Original.*planned booked seats/ })).toBeInTheDocument();
    expect(screen.getAllByText(/Calendar-declared times/).length).toBeGreaterThan(0);
  });
  it('keeps both centre pools separate in global view and requires a concrete centre for changes', () => {
    boundary.context!.can_edit_rules = true;
    show({ branch: 'global' });
    expect(screen.getByRole('region', { name: 'Calicut · booked seats' })).toHaveTextContent('40 / 40 seats');
    expect(screen.getByRole('region', { name: 'Kochi · booked seats' })).toHaveTextContent('35 / 31 seats');
    expect(screen.getByText(/Choose one centre to check a booking/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save timing rule' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Seat management centre'), { target: { value: 'cochin' } });
    fireEvent.click(screen.getByRole('button',{name:'Provider defaults'}));
    expect(screen.getByRole('button', { name: 'Save timing rule' })).toBeInTheDocument();
  });
  it('labels exactly full without calling it overbooked', () => {
    show({ branch: 'calicut' });
    const day = screen.getByRole('region', { name: 'Calicut · booked seats' });
    expect(within(day).getByText('Full · no spare seats in this window')).toBeInTheDocument();
    expect(within(day).queryByText(/over capacity/)).not.toBeInTheDocument();
  });
  it('keeps unknown times incomplete and never claims a booking fits', () => {
    show({ sessions: [...sessions, { ...sessions[0], id: 9, start_time: null }] });
    expect(screen.getAllByText(/Incomplete data/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Check booking fit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Find timing options' })).toBeDisabled();
    expect(screen.getByRole('region', { name: 'Kochi · booked seats' }).querySelector('.seat-bar-available')).toBeNull();
  });
  it('checks an afternoon booking against that interval and clears its result on input changes', () => {
    show();
    fireEvent.change(screen.getByLabelText('Booking start'), { target: { value: '14:00' } });
    fireEvent.change(screen.getByLabelText('Booking end'), { target: { value: '15:00' } });
    fireEvent.change(screen.getByLabelText('Booking seats'), { target: { value: '31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check booking fit' }));
    expect(screen.getByRole('status', { name: 'Booking fit result' })).toHaveTextContent('Full');
    fireEvent.change(screen.getByLabelText('Booking seats'), { target: { value: '32' } });
    expect(screen.queryByRole('status', { name: 'Booking fit result' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Check booking fit' }));
    expect(screen.getByRole('status', { name: 'Booking fit result' })).toHaveTextContent('Overbooked');
  });
  it('defaults every missing rule to fixed and keeps simulation disabled until rules exist', () => {
    show();
    expect(screen.getByText(/Unconfigured providers and exams stay fixed/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Find timing options' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save timing rule' })).not.toBeInTheDocument();
  });
  it('uses the recorded day span and clears timing options on planning, date and session refreshes', () => {
    boundary.context!.rules = [rule];
    const view = show();
    expect(screen.getByLabelText('Planning window start')).toHaveValue('10:00');
    expect(screen.getByLabelText('Planning window end')).toHaveValue('11:30');
    fireEvent.change(screen.getByLabelText('Planning window start'), { target: { value: '09:00' } });
    fireEvent.change(screen.getByLabelText('Planning window end'), { target: { value: '12:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find timing options' }));
    expect(screen.getByRole('region', { name: 'Timing search result' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Planning window end'), { target: { value: '12:30' } });
    expect(screen.queryByRole('region', { name: 'Timing search result' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Find timing options' }));
    view.rerenderSeat({ sessions: [...sessions, { ...sessions[0], id: 90, candidate_count: 1 }] });
    expect(screen.queryByRole('region', { name: 'Timing search result' })).not.toBeInTheDocument();
  });
  it('clears options when rules change and renders both original and simulated timelines', () => {
    boundary.context!.rules = [rule];
    const view = show();
    fireEvent.change(screen.getByLabelText('Planning window start'), { target: { value: '09:00' } });
    fireEvent.change(screen.getByLabelText('Planning window end'), { target: { value: '12:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find timing options' }));
    fireEvent.click(screen.getByRole('button', { name: /Review option 1/ }));
    expect(screen.getByRole('img', { name: /Simulated.*planned booked seats/ })).toBeInTheDocument();
    expect(screen.getByText(/Review only/)).toBeInTheDocument();
    boundary.context = { ...boundary.context!, rules: [{ ...rule, earlier_minutes: 0, updated_at: '2099-01-01T00:00:00Z' }] };
    view.rerenderSeat({});
    expect(screen.queryByRole('region', { name: 'Timing search result' })).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Simulated.*planned booked seats/ })).not.toBeInTheDocument();
  });
  it('retains base occupancy but blocks simulations when source context fails', () => {
    boundary.error = true;
    show();
    expect(screen.getByRole('heading', { name: '35 / 31 seats · 10:30–11:00' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Context unavailable');
    expect(screen.getByRole('button', { name: 'Find timing options' })).toBeDisabled();
  });
  it('saves exact explicit rule bounds with the existing optimistic version and invalidates context', async () => {
    boundary.context = { rules: [rule], details: [], can_edit_rules: true };
    boundary.save.mockResolvedValue({ ...rule, earlier_minutes: 12 });
    const view = show(); const invalidate = vi.spyOn(view.client, 'invalidateQueries');
    fireEvent.change(screen.getByLabelText('Rule to edit'), { target: { value: rule.id } });
    fireEvent.change(screen.getByLabelText('Earlier by · minutes'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save timing rule' }));
    await screen.findByText('Timing rule saved.');
    expect(boundary.save).toHaveBeenCalledWith({ branch_location: 'cochin', provider: 'PEARSON VUE', exam_code: null, exam_name: null, earlier_minutes: 12, later_minutes: 30, expected_updated_at: rule.updated_at });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['seat-context'] });
  });
  it('retains the same-centre save acknowledgement while source context refreshes', async () => {
    boundary.context!.can_edit_rules = true;
    boundary.save.mockResolvedValue(rule);
    const view = show();
    fireEvent.change(screen.getByLabelText('Rule provider'), { target: { value: 'PEARSON VUE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save timing rule' }));
    await screen.findByText('Timing rule saved.');
    view.rerenderSeat({ isFetching: true });
    expect(screen.getByText(/Shared timing rule saved for Kochi/)).toBeInTheDocument();
    view.rerenderSeat({ branch: 'calicut' });
    expect(screen.queryByText(/Shared timing rule saved for Kochi/)).not.toBeInTheDocument();
  });
  it('ignores a late save result after the centre changes', async () => {
    boundary.context!.can_edit_rules = true;
    let finish!: (value: SeatRule) => void;
    boundary.save.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const view = show({ branch: 'global' });
    fireEvent.change(screen.getByLabelText('Seat management centre'), { target: { value: 'cochin' } });
    fireEvent.click(screen.getByRole('button',{name:'Provider defaults'}));
    fireEvent.change(screen.getByLabelText('Rule provider'), { target: { value: 'PEARSON VUE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save timing rule' }));
    view.rerenderSeat({ branch: 'calicut' });
    await act(async () => finish(rule));
    expect(screen.queryByText('Timing rule saved.')).not.toBeInTheDocument();
  });
});

describe('seat management review boundaries', () => {
  it('clears reviewed timing options after date, booking-input or refresh changes', () => {
    boundary.context!.rules = [rule];
    const view = show();
    const find = () => {
      fireEvent.change(screen.getByLabelText('Planning window start'), { target: { value: '09:00' } });
      fireEvent.change(screen.getByLabelText('Planning window end'), { target: { value: '12:00' } });
      fireEvent.click(screen.getByRole('button', { name: 'Find timing options' }));
      expect(screen.getByRole('region', { name: 'Timing search result' })).toBeInTheDocument();
    };
    find();
    fireEvent.change(screen.getByLabelText('Booking seats'), { target: { value: '2' } });
    expect(screen.queryByRole('region', { name: 'Timing search result' })).not.toBeInTheDocument();
    find();
    view.rerenderSeat({ isFetching: true });
    expect(screen.queryByRole('region', { name: 'Timing search result' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Find timing options' })).toBeDisabled();
    view.rerenderSeat({ isFetching: false });
    find();
    fireEvent.change(screen.getByLabelText('Seat management date'), { target: { value: '2099-11-15' } });
    expect(screen.queryByRole('region', { name: 'Timing search result' })).not.toBeInTheDocument();
  });
  it('keeps denied rule saves visible and never claims they succeeded', async () => {
    boundary.context!.can_edit_rules = true;
    boundary.save.mockRejectedValue(new Error('Rule changed since it was loaded. Refresh first.'));
    show();
    fireEvent.change(screen.getByLabelText('Rule provider'), { target: { value: 'Other Provider' } });
    fireEvent.change(screen.getByLabelText('Rule applies to'), { target: { value: 'code' } });
    fireEvent.change(screen.getByLabelText('Exam code'), { target: { value: 'TEST-1' } });
    fireEvent.change(screen.getByLabelText('Earlier by · minutes'), { target: { value: '121' } });
    expect(screen.getByRole('button', { name: 'Save timing rule' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Earlier by · minutes'), { target: { value: '1.5' } });
    expect(screen.getByRole('button', { name: 'Save timing rule' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Earlier by · minutes'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save timing rule' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Rule changed');
    expect(boundary.save).toHaveBeenCalledWith({ branch_location: 'cochin', provider: 'OTHER PROVIDER', exam_code: 'TEST-1', exam_name: null, earlier_minutes: 15, later_minutes: 0, expected_updated_at: null });
    expect(screen.queryByText('Timing rule saved.')).not.toBeInTheDocument();
  });
  it('includes anonymous adjacent-context sessions without duplicating the monthly reservations', () => {
    boundary.context!.adjacent_sessions = [...sessions, { ...sessions[0], id: 101, candidate_count: 2 }];
    show();
    expect(screen.getByRole('heading', { name: '37 / 31 seats · 10:30–11:00' })).toBeInTheDocument();
  });
  it('marks conflicting refreshed session dates incomplete instead of discarding the fresh reservation', () => {
    boundary.context!.adjacent_sessions = [{ ...sessions[0], date: '2099-11-15', updated_at: '2099-11-14T10:00:00Z' }];
    show({ sessions: [sessions[0]], currentDate: new Date(2099, 10, 15) });
    expect(screen.getByRole('region', { name: 'Kochi · booked seats' })).toHaveTextContent('Incomplete data');
    expect(screen.getByRole('button', { name: 'Check booking fit' })).toBeDisabled();
    expect(screen.getByText(/same session ID has inconsistent reservations/)).toBeInTheDocument();
  });
  it('uses 24:00 for an appointment ending at midnight and keeps that recorded planning window valid', () => {
    boundary.context!.rules = [rule];
    show({ sessions: [{ ...sessions[0], start_time: '23:00', end_time: '24:00', candidate_count: 32 }] });
    expect(screen.getByRole('heading', { name: '32 / 31 seats · 23:00–24:00' })).toBeInTheDocument();
    expect(screen.getByLabelText('Planning window end')).toHaveValue('24:00');
    expect(screen.getByRole('button', { name: 'Find timing options' })).toBeEnabled();
  });
});

describe('daily draft refresh boundaries',()=>{
 it('preserves manual draft controls during an identical background refresh while blocking calculations',()=>{
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  const props={sessions,currentDate:new Date(2099,10,14),branch:'cochin',userId:'synthetic-user'};
  const view=render(<QueryClientProvider client={client}><SeatManagement {...props}/></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText('Day planning ends'),{target:{value:'12:00'}});
  fireEvent.change(screen.getByLabelText('New start for Beta exam'),{target:{value:'10:45'}});
  expect(screen.getByRole('region',{name:'Manual timing changes'})).toHaveTextContent('10:45–11:45');
  view.rerender(<QueryClientProvider client={client}><SeatManagement {...props} isFetching/></QueryClientProvider>);
  expect(screen.getByLabelText('New start for Beta exam')).toHaveValue('10:45');expect(screen.getByRole('button',{name:'Find options for this day'})).toBeDisabled();
  view.rerender(<QueryClientProvider client={client}><SeatManagement {...props}/></QueryClientProvider>);
  expect(screen.getByLabelText('New start for Beta exam')).toHaveValue('10:45');
  boundary.context={...boundary.context!,adjacent_sessions:[{...sessions[0],candidate_count:21}]};
  view.rerender(<QueryClientProvider client={client}><SeatManagement {...props}/></QueryClientProvider>);
  expect(screen.getByLabelText('New start for Beta exam')).toHaveValue('');
 });
});
