import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DailyOperationsReports, { ManagerDailyOperationsDashboard } from './DailyOperationsReports';

const mockRows: Record<string, any> = {};
const mockTasks: any[] = [];
const mockStaff = [
  { id: 'staff-cal-1', full_name: 'Aysha' },
  { id: 'staff-cal-2', full_name: 'Lazeem' },
  { id: 'staff-coc-1', full_name: 'Naima MM' },
];

const lastInsertPayload: { value: any } = { value: null };
const lastUpdatePayload: { id: string; value: any } = { id: '', value: null };

vi.mock('../lib/supabase', () => {
  const buildChain = (table: string) => {
    const filters: Record<string, any> = {};
    let mode: 'select' | 'insert' | 'update' = 'select';
    let payload: any = null;

    const chain: any = {
      select: () => chain,
      eq: (col: string, val: any) => {
        filters[col] = val;
        return chain;
      },
      gte: () => chain,
      lte: () => chain,
      in: () => chain,
      order: () => chain,
      insert: (val: any) => {
        mode = 'insert';
        payload = val;
        lastInsertPayload.value = val;
        return chain;
      },
      update: (val: any) => {
        mode = 'update';
        payload = val;
        return chain;
      },
      maybeSingle: async () => {
        if (table === 'centre_daily_reports') {
          const found = Object.values(mockRows).find(
            (r: any) =>
              (!filters.branch || r.branch === filters.branch) &&
              (!filters.day || r.day === filters.day) &&
              (!filters.kind || r.kind === filters.kind)
          );
          return { data: found || null, error: null };
        }
        return { data: null, error: null };
      },
      single: async () => {
        if (table === 'centre_daily_reports') {
          if (mode === 'insert') {
            const id = `rep-${Object.keys(mockRows).length + 1}`;
            const saved = {
              id,
              ...payload,
              submitted_by: payload.submitted_by || 'staff-cal-1',
              updated_by: payload.submitted_by || 'staff-cal-1',
              submitted_at: '2026-10-30T03:00:00Z',
              updated_at: '2026-10-30T03:00:00Z',
            };
            mockRows[id] = saved;
            return { data: saved, error: null };
          }
          if (mode === 'update') {
            const id = filters.id;
            lastUpdatePayload.id = id;
            lastUpdatePayload.value = payload;
            const prev = mockRows[id] || {};
            const saved = {
              ...prev,
              ...payload,
              id,
              updated_by: 'staff-cal-2',
              updated_at: '2026-10-30T05:00:00Z',
            };
            mockRows[id] = saved;
            return { data: saved, error: null };
          }
        }
        return { data: null, error: null };
      },
      then: (resolve: any) => {
        if (table === 'staff_profiles') {
          return resolve({ data: mockStaff, error: null });
        }
        if (table === 'centre_day_tasks') {
          return resolve({ data: mockTasks, error: null });
        }
        if (table === 'centre_daily_reports') {
          const list = Object.values(mockRows).filter(
            (r: any) =>
              (!filters.branch || r.branch === filters.branch) &&
              (!filters.day || r.day === filters.day)
          );
          return resolve({ data: list, error: null });
        }
        return resolve({ data: [], error: null });
      },
    };
    return chain;
  };

  return {
    supabase: {
      from: (table: string) => buildChain(table),
    },
  };
});

beforeEach(() => {
  for (const k of Object.keys(mockRows)) delete mockRows[k];
  mockTasks.length = 0;
  lastInsertPayload.value = null;
  lastUpdatePayload.id = '';
  lastUpdatePayload.value = null;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('DailyOperationsReports', () => {
  it('saves a morning readiness report and allows another centre staff member to edit it', async () => {
    const { unmount } = render(
      <DailyOperationsReports branch="calicut" day="2026-10-30" profileId="staff-cal-1" staffName="Aysha" />
    );

    await screen.findByText('Ready for the day?');

    fireEvent.change(screen.getByPlaceholderText(/CMA US/i), { target: { value: 'Prometric / CMA US' } });
    fireEvent.change(screen.getByLabelText('Sessions'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Expected candidates'), { target: { value: '40' } });

    fireEvent.click(screen.getByRole('button', { name: /Confirm all Yes/i }));
    fireEvent.click(screen.getByRole('button', { name: /Submit report/i }));

    await screen.findByText('Report submitted successfully.');
    expect(lastInsertPayload.value).toMatchObject({
      branch: 'calicut',
      day: '2026-10-30',
      kind: 'morning',
      overall: 'green',
      exam_client: 'Prometric / CMA US',
      expected_sessions: 2,
      expected_candidates: 40,
      submitted_by: 'staff-cal-1',
    });

    unmount();

    // Another Calicut staff member opens the same day and updates the report
    render(
      <DailyOperationsReports branch="calicut" day="2026-10-30" profileId="staff-cal-2" staffName="Lazeem" />
    );

    await screen.findByDisplayValue('Prometric / CMA US');
    fireEvent.change(screen.getByLabelText('Expected candidates'), { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: /Update report/i }));

    await screen.findByText('Report updated successfully.');
    expect(lastUpdatePayload.value).toMatchObject({
      branch: 'calicut',
      day: '2026-10-30',
      kind: 'morning',
      expected_candidates: 45,
    });
    // Original submitted_by is not overwritten in update payload
    expect(lastUpdatePayload.value.submitted_by).toBeUndefined();
  });

  it('prevents Green status when any required check fails and requires an issue description', async () => {
    render(
      <DailyOperationsReports branch="cochin" day="2026-10-30" profileId="staff-coc-1" staffName="Naima MM" />
    );

    await screen.findByText('Ready for the day?');
    fireEvent.change(screen.getByPlaceholderText(/CMA US/i), { target: { value: 'Pearson VUE' } });
    fireEvent.change(screen.getByLabelText('Sessions'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Expected candidates'), { target: { value: '20' } });

    // Confirm all Yes first, then mark CCTV / DVR / Internet as No
    fireEvent.click(screen.getByRole('button', { name: /Confirm all Yes/i }));
    const cctvGroup = screen.getByRole('group', { name: 'CCTV / DVR / Internet' });
    const noBtn = cctvGroup.querySelectorAll('button')[1];
    fireEvent.click(noBtn);

    // Overall status should automatically downgrade from green to yellow and disable the All clear button
    const greenBtn = screen.getByRole('button', { name: /All clear/i });
    expect(greenBtn).toBeDisabled();
    expect(screen.getByText(/All clear \(Green\) is locked/i)).toBeInTheDocument();

    // Trying to submit without describing the issue should fail validation
    fireEvent.click(screen.getByRole('button', { name: /Submit report/i }));
    await screen.findByText('Describe the issue when any check fails or status is not green.');

    // Describe the issue and save
    fireEvent.change(screen.getByLabelText(/Issues \/ incidents/i), {
      target: { value: 'Backup ISP link flapping; ISP ticket raised.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Submit report/i }));
    await screen.findByText('Report submitted successfully.');
    expect(lastInsertPayload.value.overall).toBe('yellow');
  });

  it('validates candidate counts on evening reports', async () => {
    render(
      <DailyOperationsReports branch="calicut" day="2026-10-30" profileId="staff-cal-1" staffName="Aysha" />
    );

    await screen.findByText('Ready for the day?');
    fireEvent.click(screen.getByRole('button', { name: /Evening summary/i }));
    await screen.findByText('How did the day go?');

    fireEvent.change(screen.getByPlaceholderText(/CMA US/i), { target: { value: 'Prometric' } });
    fireEvent.change(screen.getByLabelText('Sessions'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Expected candidates'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Attended'), { target: { value: '28' } });
    fireEvent.change(screen.getByLabelText('No-shows'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirm all Yes/i }));

    fireEvent.click(screen.getByRole('button', { name: /Submit report/i }));
    await screen.findByText('Attended + no-shows exceeds expected candidates.');

    // Fix no-shows to 2 so 28 + 2 = 30
    fireEvent.change(screen.getByLabelText('No-shows'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /Submit report/i }));
    await screen.findByText('Report submitted successfully.');
    expect(lastInsertPayload.value).toMatchObject({
      kind: 'evening',
      expected_candidates: 30,
      attended: 28,
      no_shows: 2,
    });
  });

  it('renders the manager dashboard with daily reports, issues and pending work from both centres', async () => {
    mockRows['r1'] = {
      id: 'r1',
      branch: 'calicut',
      day: '2026-10-30',
      kind: 'morning',
      overall: 'green',
      exam_client: 'Prometric CMA',
      expected_sessions: 2,
      expected_candidates: 40,
      attended: null,
      no_shows: null,
      checks: { systems: 'yes', cctv: 'yes', rooms: 'yes', roster: 'yes', duties: 'yes' },
      issues: 'None',
      action_taken: '',
      pending: 'Verify afternoon biometric kit',
      manager_attention: false,
      submitted_by: 'staff-cal-1',
      submitted_at: '2026-10-30T02:45:00Z',
      updated_at: '2026-10-30T02:45:00Z',
    };
    mockRows['r2'] = {
      id: 'r2',
      branch: 'cochin',
      day: '2026-10-30',
      kind: 'evening',
      overall: 'yellow',
      exam_client: 'Pearson VUE',
      expected_sessions: 3,
      expected_candidates: 50,
      attended: 47,
      no_shows: 3,
      checks: {
        monitoring: 'yes',
        checkin: 'yes',
        cpr: 'yes',
        records: 'yes',
        duties: 'no',
        signedout: 'yes',
        closing: 'yes',
      },
      issues: 'Workstation 4 headset replaced',
      action_taken: 'Swapped with spare unit',
      pending: 'Order 2 replacement headsets',
      manager_attention: true,
      submitted_by: 'staff-coc-1',
      submitted_at: '2026-10-30T12:00:00Z',
      updated_at: '2026-10-30T12:00:00Z',
    };
    mockTasks.push({
      id: 'task-1',
      branch: 'cochin',
      day: '2026-10-30',
      title: 'UPS battery log verification',
      status: 'blocked',
      assigned_to: 'staff-coc-1',
      note: 'Awaiting vendor reading',
    });

    render(<ManagerDailyOperationsDashboard day="2026-10-30" activeBranch="global" />);

    await screen.findByText(/Centre Operations/i);
    await waitFor(() => expect(screen.getAllByText('Prometric CMA').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Pearson VUE').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Order 2 replacement headsets/i).length).toBeGreaterThan(0);
    expect(screen.getByText('UPS battery log verification')).toBeInTheDocument();
  });
});
