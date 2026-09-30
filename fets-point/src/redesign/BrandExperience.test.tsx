import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import OperationsHome from './OperationsHome';
afterEach(()=>{cleanup();vi.useRealTimers();});
it('ticks India time through midnight without fetching dashboard data every second',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-29T18:29:59Z'));
  const load=vi.fn().mockResolvedValue({sessions:[],roster:[],attendance:[],handovers:[],failures:[],updatedAt:''});
  render(<OperationsHome userName="Maya Joseph" branch="cochin" navigate={vi.fn()} openDrawer={vi.fn()} load={load}/>);
  await act(async()=>{await Promise.resolve();});expect(screen.getByLabelText('India time 23:59:59')).toBeInTheDocument();
  await act(async()=>{vi.advanceTimersByTime(1000);});expect(screen.getByLabelText('India time 00:00:00')).toBeInTheDocument();expect(screen.getByText('Wednesday, 30 September 2026')).toBeInTheDocument();expect(load).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('heading',{name:/Maya Joseph/})).toBeInTheDocument();
});
