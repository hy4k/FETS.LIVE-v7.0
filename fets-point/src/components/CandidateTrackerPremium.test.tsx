import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CandidateTrackerPremium } from './CandidateTrackerPremium';

const mocks = vi.hoisted(() => ({ sheet: vi.fn(), pdf: vi.fn(), update: vi.fn(), create: vi.fn(), rows: [] as Record<string, unknown>[] }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'test-staff' }, profile: {} }) }));
vi.mock('../hooks/useBranch', () => ({ useBranch: () => ({ activeBranch: 'cochin' }) }));
vi.mock('../hooks/useBranchFilter', () => ({ useBranchFilter: () => ({ isGlobalView: false }) }));
vi.mock('../hooks/useClients', () => ({ useClients: () => ({ data: [] }), useClientExams: () => ({ data: [] }) }));
vi.mock('../hooks/useQueries', () => ({
  useCandidates: () => ({ data: mocks.rows, isLoading: false, refetch: vi.fn() }),
  useTotalCandidatesCount: () => ({ data: 1 }), useCreateCandidate: () => ({ mutate: mocks.create }),
  useUpdateCandidateStatus: () => ({ mutate: vi.fn() }), useUpdateCandidate: () => ({ mutate: mocks.update }), useDeleteCandidate: () => ({ mutate: vi.fn() }),
}));
vi.mock('./CandidateAnalysis', () => ({ CandidateAnalysis: () => null }));
vi.mock('xlsx', () => ({ utils: { json_to_sheet: mocks.sheet, book_new: vi.fn(() => ({})), book_append_sheet: vi.fn() }, writeFile: vi.fn() }));
vi.mock('jspdf', () => ({ default: class { save = vi.fn(); } }));
vi.mock('jspdf-autotable', () => ({ default: mocks.pdf }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rows = [{ id: 'synthetic-candidate', full_name: 'Synthetic Candidate', address: 'Example Place', phone: 'personal-number', exam_date: `${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })}T08:00:00+05:30`, exam_name: 'Existing calendar label', status: 'registered', confirmation_number: 'FETS-TEST', created_at: '2026-01-01T00:00:00Z', client_name: 'PEARSON VUE', branch_location: 'cochin', email: 'Synthetic@example.test', exam_code: 'SYN-EXAM', exam_title: 'Synthetic exam title', exam_owner: 'Synthetic exam owner', exam_start_time: '09:00:00', exam_end_time: '10:30:00', pearson_source_phone: ' 00123  456 ' }];
});

describe('Candidate Tracker Pearson metadata', () => {
  it.each(['Synthetic@example.test', 'SYN-EXAM', 'Synthetic exam title', 'Synthetic exam owner', '10:30:00', '00123  456'])('searches %s and shows the report values alongside personal contact', async query => {
    render(<CandidateTrackerPremium />);
    fireEvent.change(screen.getByPlaceholderText('Search candidates...'), { target: { value: query } });
    const card = screen.getByRole('button', { name: /Synthetic Candidate/ });
    fireEvent.click(card);
    expect(await screen.findByRole('heading', { name: 'Synthetic Candidate' })).toBeInTheDocument();
    expect(screen.getByText('Synthetic@example.test')).toBeInTheDocument();
    expect(screen.getAllByText('SYN-EXAM').length).toBeGreaterThan(0);
    expect(screen.getByText('Synthetic exam title')).toBeInTheDocument();
    expect(screen.getByText('Synthetic exam owner')).toBeInTheDocument();
    expect(screen.getByText('10:30:00')).toBeInTheDocument();
    expect(screen.getByText('personal-number')).toBeInTheDocument();
    const phone = screen.getByText('00123 456');
    expect(phone.textContent).toBe(' 00123  456 ');
  });
  it('exports all Pearson metadata and exact source phone to Excel and PDF', () => {
    render(<CandidateTrackerPremium />);
    fireEvent.click(screen.getByTitle('Export to Excel'));
    const expected = { 'Email': 'Synthetic@example.test', 'Exam code': 'SYN-EXAM', 'Exam title': 'Synthetic exam title', 'Exam owner': 'Synthetic exam owner', 'Exam end · IST': '10:30:00', 'Pearson source phone': ' 00123  456 ', 'Phone no': 'personal-number' };
    expect(mocks.sheet).toHaveBeenCalledWith([expect.objectContaining(expected)]);
    fireEvent.click(screen.getByTitle('Export to PDF'));
    expect(mocks.pdf).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ head: [expect.arrayContaining(Object.keys(expected))], body: [expect.arrayContaining(Object.values(expected))] }));
  });
  it('keeps the regular manual save payload free of new Pearson metadata', async () => {
    render(<CandidateTrackerPremium />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Candidate' }));
    fireEvent.change(screen.getByPlaceholderText('e.g. John Doe'), { target: { value: 'Manual Candidate' } });
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[selects.length - 1], { target: { value: 'PROMETRIC' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Registration' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalled());
    const payload = mocks.create.mock.calls[0][0];
    for (const field of ['email', 'exam_code', 'exam_title', 'exam_owner', 'exam_end_time', 'pearson_source_phone']) expect(payload).not.toHaveProperty(field);
    expect(payload).toMatchObject({ full_name: 'Manual Candidate', client_name: 'PROMETRIC', branch_location: 'cochin' });
  });
});
