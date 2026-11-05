import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CalendarRosterDialog from '../roster/CalendarRosterDialog';
import type { PearsonPreview, PearsonRow } from './types';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), parse: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('./parse', () => ({ parsePearsonWorkbook: mocks.parse }));

const row: PearsonRow = { source_row: 4, date: '2026-11-20', start_time: '09:00:00', end_time: '10:30:00', full_name: 'Synthetic Candidate', email: 'synthetic@example.test', phone: ' 0123 456 ', exam_owner: 'Example Owner', exam_code: 'EX-1', exam_title: 'Example Exam' };
const receipt = { import_id: 'import-1', saved: 1, inserted: 0, updated: 1, sessions: 1, cancellation_reviews: 0, already_applied: false, file_hash: 'a'.repeat(64) };
const preview = (): PearsonPreview => ({ preview_id: 'preview-1', expires_at: '2099-11-06T00:00:00Z', branch: 'cochin', from: '2026-11-01', through: '2026-11-30', rows: [{ ...row, match_kind: 'review', candidate_id: null, changes: [], possible_candidates: [{ id: 'candidate-1', full_name: 'Prior Synthetic Candidate', date: '2026-11-19', start_time: '08:00:00', email: row.email, exam_code: row.exam_code }] }], sessions: [{ group_key: 'group-1', date: row.date, exam_owner: row.exam_owner, start_time: row.start_time, end_time: row.end_time, candidate_count: 1, calendar_id: null, match_kind: 'review', possible_sessions: [{ id: 42, exam_name: 'Prior Example Owner', date: '2026-11-19', start_time: '08:00:00', end_time: '09:30:00', candidate_count: 1 }] }], missing: [], warnings: [], counts: { incoming: 1, new: 0, existing: 0, review: 1, sessions: 1, missing: 0 } });
const missing = { id: 'review-1', candidate_id: 'missing-1', full_name: 'Missing Synthetic Candidate', date: '2026-11-25', start_time: '11:00:00', exam_code: 'EX-2', status: 'pending', updated_at: '2026-11-05T10:00:00Z', has_progress: false };

beforeEach(() => {
  mocks.parse.mockReset().mockResolvedValue({ filename: 'monthly.xlsx', file_hash: 'a'.repeat(64), sheet: 'TC Exam Details', rows: [row], issues: [] });
  mocks.rpc.mockReset().mockImplementation(async (name: string) => ({ data: name === 'preview_pearson_roster' ? preview() : name === 'apply_pearson_roster' ? receipt : [], error: null }));
});
function show(branch = 'cochin') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const onClose = vi.fn();
  render(<QueryClientProvider client={client}><CalendarRosterDialog mode="upload" day="2026-11-05" branch={branch} onClose={onClose} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Pearson monthly report' }));
  const file = new File(['synthetic'], 'monthly.xlsx');
  Object.defineProperty(file, 'arrayBuffer', { value: async () => new Uint8Array([1, 2]).buffer });
  fireEvent.change(screen.getByLabelText('Pearson XLSX report'), { target: { files: [file] } });
  fireEvent.change(screen.getByLabelText('Source snapshot as of'), { target: { value: '2026-11-05' } });
  return { client, invalidate, onClose };
}
async function review() { fireEvent.click(screen.getByRole('button', { name: 'Preview Pearson report' })); return screen.findByRole('region', { name: 'Pearson report preview' }); }
function resolve(candidate = 'candidate-1', session = '42') {
  fireEvent.change(screen.getByLabelText('Booking resolution for row 4'), { target: { value: candidate } });
  fireEvent.change(screen.getByLabelText('Session resolution for group-1'), { target: { value: session } });
}

describe('Pearson monthly review', () => {
  it('requires every ambiguity decision and sends only explicit bindings with the trusted preview ID', async () => {
    const { invalidate } = show();
    fireEvent.click(screen.getByLabelText('This file is a complete snapshot of the selected coverage'));
    await review();
    expect(screen.getByText(/2026-11-20.*1 booking/)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /#42.*2026-11-19/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply Pearson import' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Booking resolution for row 4'), { target: { value: 'candidate-1' } });
    expect(screen.getByRole('button', { name: 'Apply Pearson import' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Session resolution for group-1'), { target: { value: '42' } });
    expect(screen.getByText('1 proposed update · 0 unchanged bookings')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '1 bookings · 0 new · 1 existing · 0 need review' })).toBeInTheDocument();
    expect(screen.getByText('Reviewed existing booking — source details will be updated')).toBeInTheDocument();
    expect(screen.getByText('Prior appointment: 2026-11-19 08:00:00 · Prior Synthetic Candidate')).toBeInTheDocument();
    const loaded = vi.fn(); window.addEventListener('fets-data-loaded', loaded);
    fireEvent.click(screen.getByRole('button', { name: 'Apply Pearson import' }));
    await screen.findByText(/0 added · 1 updated/);
    expect(mocks.rpc).toHaveBeenCalledWith('preview_pearson_roster', { p_branch: 'cochin', p_from: '2026-11-01', p_through: '2026-11-30', p_complete: true, p_source_as_of: '2026-11-05', p_filename: 'monthly.xlsx', p_file_hash: 'a'.repeat(64), p_rows: [row] });
    expect(mocks.rpc).toHaveBeenCalledWith('apply_pearson_roster', { p_preview_id: 'preview-1', p_candidate_bindings: [{ source_row: 4, candidate_id: 'candidate-1' }], p_session_bindings: [{ group_key: 'group-1', calendar_id: 42 }] });
    for (const queryKey of [['candidates'], ['sessions', 'calendar'], ['dashboardStats'], ['upcomingSchedule']]) expect(invalidate).toHaveBeenCalledWith({ queryKey });
    expect(loaded).toHaveBeenCalledTimes(1); window.removeEventListener('fets-data-loaded', loaded);
  });
  it('allows an explicit new booking and new calendar session decision', async () => {
    show(); await review(); resolve('new', 'new');
    expect(screen.getByRole('heading', { name: '1 bookings · 1 new · 0 existing · 0 need review' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Apply Pearson import' }));
    await screen.findByText(/0 added · 1 updated/);
    expect(mocks.rpc).toHaveBeenCalledWith('apply_pearson_roster', { p_preview_id: 'preview-1', p_candidate_bindings: [{ source_row: 4, candidate_id: null }], p_session_bindings: [{ group_key: 'group-1', calendar_id: null }] });
  });
  it('removes a potentially missing original only after explicitly binding the incoming booking to it', async () => {
    mocks.rpc.mockImplementation(async (name: string) => ({ data: name === 'preview_pearson_roster' ? { ...preview(), missing: [{ ...missing, candidate_id: 'candidate-1' }], counts: { ...preview().counts, missing: 1 } } : [], error: null }));
    show(); await review();
    expect(within(screen.getByRole('region', { name: 'Potential missing bookings' })).getByText(/Missing Synthetic Candidate/)).toBeInTheDocument();
    expect(screen.getByText(/1 potentially missing booking/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Booking resolution for row 4'), { target: { value: 'candidate-1' } });
    expect(screen.queryByRole('region', { name: 'Potential missing bookings' })).toBeNull();
    expect(screen.getByText(/0 potentially missing bookings/)).toBeInTheDocument();
  });
  it('keeps the original visible as potentially missing when the report row is explicitly a new booking', async () => {
    mocks.rpc.mockImplementation(async (name: string) => ({ data: name === 'preview_pearson_roster' ? { ...preview(), missing: [{ ...missing, candidate_id: 'candidate-1' }], counts: { ...preview().counts, missing: 1 } } : [], error: null }));
    show(); await review(); resolve('new', 'new');
    expect(within(screen.getByRole('region', { name: 'Potential missing bookings' })).getByText(/Missing Synthetic Candidate/)).toBeInTheDocument();
    expect(screen.getByText(/1 potentially missing booking/)).toBeInTheDocument();
  });
  it.each(['Coverage from · inclusive', 'Coverage through · inclusive', 'Source snapshot as of', 'Centre', 'This file is a complete snapshot of the selected coverage'])('clears the reviewed preview when %s changes', async label => {
    show(); await review(); resolve();
    const input = screen.getByLabelText(label);
    if (label.startsWith('This file')) fireEvent.click(input);
    else fireEvent.change(input, { target: { value: label === 'Centre' ? 'calicut' : '2026-11-02' } });
    expect(screen.queryByRole('region', { name: 'Pearson report preview' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Apply Pearson import' })).toBeDisabled();
    if (label === 'Centre') await screen.findByText('No pending cancellation reviews for this centre.');
  });
  it('ignores a preview response that arrives after its source changed', async () => {
    let finish!: (value: unknown) => void;
    mocks.rpc.mockImplementation((name: string) => name === 'preview_pearson_roster' ? new Promise(resolve => { finish = resolve; }) : Promise.resolve({ data: [], error: null }));
    show(); fireEvent.click(screen.getByRole('button', { name: 'Preview Pearson report' }));
    await waitFor(() => expect(finish).toBeTypeOf('function'));
    fireEvent.change(screen.getByLabelText('Coverage through · inclusive'), { target: { value: '2026-11-29' } });
    await act(async () => finish({ data: preview(), error: null }));
    expect(screen.queryByRole('region', { name: 'Pearson report preview' })).toBeNull();
  });
  it('rejects non-XLSX files and parser errors before the preview RPC', async () => {
    show();
    fireEvent.change(screen.getByLabelText('Pearson XLSX report'), { target: { files: [new File(['x'], 'report.csv')] } });
    expect(screen.getByRole('alert')).toHaveTextContent('XLSX');
    expect(mocks.rpc.mock.calls.some(([name]) => name === 'preview_pearson_roster')).toBe(false);
    await screen.findByText('No pending cancellation reviews for this centre.');
  });
  it('blocks the preview RPC when the workbook has even one error alongside valid rows', async () => {
    mocks.parse.mockResolvedValue({ filename: 'monthly.xlsx', file_hash: 'a'.repeat(64), rows: [row], issues: [{ source_row: 8, level: 'error', message: 'Appointment is missing.' }] });
    show(); fireEvent.click(screen.getByRole('button', { name: 'Preview Pearson report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Correct the report errors');
    expect(screen.getByText(/Appointment is missing/)).toBeInTheDocument();
    expect(mocks.rpc.mock.calls.some(([name]) => name === 'preview_pearson_roster')).toBe(false);
    expect(screen.getByRole('button', { name: 'Apply Pearson import' })).toBeDisabled();
  });
  it('requires a concrete centre when launched from a global calendar', async () => {
    show('global'); fireEvent.click(screen.getByRole('button', { name: 'Preview Pearson report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a concrete centre');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('shows preview failures and never enables apply', async () => {
    mocks.rpc.mockImplementation(async (name: string) => ({ data: [], error: name === 'preview_pearson_roster' ? { message: 'Source snapshot is older than the last import.' } : null }));
    show(); fireEvent.click(screen.getByRole('button', { name: 'Preview Pearson report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Source snapshot is older');
    expect(screen.getByRole('button', { name: 'Apply Pearson import' })).toBeDisabled();
  });
  it('shows a repeated upload receipt without attempting another apply', async () => {
    mocks.rpc.mockImplementation(async (name: string) => ({ data: name === 'preview_pearson_roster' ? { ...preview(), existing_receipt: { ...receipt, already_applied: true } } : [], error: null }));
    show(); fireEvent.click(screen.getByRole('button', { name: 'Preview Pearson report' }));
    expect(await screen.findByText('Previously applied report')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply Pearson import' })).toBeDisabled();
    expect(mocks.rpc.mock.calls.some(([name]) => name === 'apply_pearson_roster')).toBe(false);
  });
  it('requires a fresh preview after the server preview expires', async () => {
    mocks.rpc.mockImplementation(async (name: string) => ({ data: name === 'preview_pearson_roster' ? { ...preview(), expires_at: '2000-01-01T00:00:00Z' } : [], error: null }));
    show(); fireEvent.click(screen.getByRole('button', { name: 'Preview Pearson report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('preview has expired');
    expect(screen.getByRole('button', { name: 'Apply Pearson import' })).toBeDisabled();
  });
  it('clears reviewed choices when a different source file is selected', async () => {
    show(); await review(); resolve();
    const file = new File(['replacement'], 'replacement.xlsx');
    fireEvent.change(screen.getByLabelText('Pearson XLSX report'), { target: { files: [file] } });
    expect(screen.queryByRole('region', { name: 'Pearson report preview' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Apply Pearson import' })).toBeDisabled();
  });
  it('keeps the server error visible and requires a fresh preview after apply fails', async () => {
    mocks.rpc.mockImplementation(async (name: string) => ({ data: name === 'preview_pearson_roster' ? preview() : [], error: name === 'apply_pearson_roster' ? { message: 'Preview is stale. Preview again.' } : null }));
    show(); await review(); resolve(); fireEvent.click(screen.getByRole('button', { name: 'Apply Pearson import' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Preview is stale');
    expect(screen.getByRole('button', { name: 'Apply Pearson import' })).toBeDisabled();
  });
  it('prevents closing or changing inputs while apply is in flight', async () => {
    let finish!: (value: unknown) => void;
    mocks.rpc.mockImplementation((name: string) => name === 'apply_pearson_roster' ? new Promise(resolve => { finish = resolve; }) : Promise.resolve({ data: name === 'preview_pearson_roster' ? preview() : [], error: null }));
    const { onClose } = show(); await review(); resolve(); fireEvent.click(screen.getByRole('button', { name: 'Apply Pearson import' }));
    expect(screen.getByLabelText('Centre')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close Pearson report' })).toBeDisabled();
    fireEvent.keyDown(window, { key: 'Escape' }); expect(onClose).not.toHaveBeenCalled();
    await act(async () => finish({ data: receipt, error: null }));
  });
  it('requires reviewing a missing booking before a versioned cancellation decision', async () => {
    mocks.rpc.mockImplementation(async (name: string) => ({ data: name === 'list_pearson_cancellation_reviews' ? [missing] : {}, error: null }));
    const { invalidate } = show();
    expect(await screen.findByText(missing.full_name)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve cancellation' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Review missing booking' }));
    const region = screen.getByRole('region', { name: 'Review missing booking' });
    expect(within(region).getByText(/remain counted/)).toBeInTheDocument();
    fireEvent.click(within(region).getByRole('button', { name: 'Approve cancellation' }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('decide_pearson_cancellation', { p_review_id: 'review-1', p_decision: 'cancel', p_expected_updated_at: missing.updated_at }));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['sessions', 'calendar'] }));
    await screen.findByText('Cancellation approved. Calendar totals refreshed.');
  });
  it('allows keeping a progressed booking while preventing its cancellation', async () => {
    mocks.rpc.mockImplementation(async (name: string) => ({ data: name === 'list_pearson_cancellation_reviews' ? [{ ...missing, has_progress: true }] : {}, error: null }));
    show(); await screen.findByText(missing.full_name);
    fireEvent.click(screen.getByRole('button', { name: 'Review missing booking' }));
    expect(screen.getByRole('button', { name: 'Approve cancellation' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep booking' }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('decide_pearson_cancellation', { p_review_id: 'review-1', p_decision: 'keep', p_expected_updated_at: missing.updated_at }));
    await screen.findByText('Booking kept and remains counted.');
  });
  it('shows a stale cancellation decision error and closes the obsolete decision controls', async () => {
    mocks.rpc.mockImplementation(async (name: string) => ({ data: name === 'list_pearson_cancellation_reviews' ? [missing] : {}, error: name === 'decide_pearson_cancellation' ? { message: 'Review changed. Refresh reviews.' } : null }));
    show(); await screen.findByText(missing.full_name);
    fireEvent.click(screen.getByRole('button', { name: 'Review missing booking' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep booking' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Review changed');
    expect(screen.queryByRole('region', { name: 'Review missing booking' })).toBeNull();
  });
});
