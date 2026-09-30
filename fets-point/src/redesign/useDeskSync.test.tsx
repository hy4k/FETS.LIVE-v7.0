import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeskDocument, useDeskFocusLog } from './useDeskSync';

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('desk cloud saves', () => {
  it('loads the server before allowing a save and preserves newer edits while a save is in flight', async () => {
    let finish: (value: any) => void = () => {};
    const load = vi.fn().mockResolvedValue({ value: { note: 'From cloud' }, version: 3 });
    const write = vi.fn(() => new Promise<any>(resolve => { finish = resolve; }));
    const { result } = renderHook(() => useDeskDocument('journal', { note: '' }, load, write));
    expect(result.current.canSave).toBe(false);
    await waitFor(() => expect(result.current.value.note).toBe('From cloud'));
    act(() => result.current.edit({ note: 'First edit' }));
    let saving: Promise<void>;
    act(() => { saving = result.current.save(); });
    act(() => result.current.edit({ note: 'Second edit while saving' }));
    await act(async () => { finish({ value: { note: 'First edit' }, version: 4 }); await saving; });
    expect(result.current.value.note).toBe('Second edit while saving');
    expect(result.current.dirty).toBe(true);
    expect(result.current.version).toBe(4);
  });
  it('preserves a stale local draft and blocks overwriting a newer cloud version', async () => {
    localStorage.setItem('journal', JSON.stringify({ value: { note: 'Offline draft' }, version: 1, dirty: true }));
    const load = vi.fn().mockResolvedValue({ value: { note: 'Newer cloud note' }, version: 2 });
    const write = vi.fn();
    const { result } = renderHook(() => useDeskDocument('journal', { note: '' }, load, write));
    await waitFor(() => expect(result.current.status).toBe('conflict'));
    expect(result.current.value.note).toBe('Offline draft');
    await act(() => result.current.save());
    expect(write).not.toHaveBeenCalled();
    await act(() => result.current.reload(true));
    expect(result.current.value.note).toBe('Newer cloud note');
    expect(result.current.dirty).toBe(false);
  });
  it('keeps failed cloud saves recoverable instead of marking them synced', async () => {
    const load = vi.fn().mockResolvedValue(null);
    const write = vi.fn().mockRejectedValue(new Error('Offline'));
    const { result } = renderHook(() => useDeskDocument('journal', { note: '' }, load, write));
    await waitFor(() => expect(result.current.canSave).toBe(true));
    act(() => result.current.edit({ note: 'Keep this' }));
    await act(() => result.current.save());
    expect(result.current.status).toBe('error');
    expect(result.current.dirty).toBe(true);
    expect(JSON.parse(localStorage.getItem('journal')!).value.note).toBe('Keep this');
  });
  it('replays a completed focus session after a connection failure with the same id', async () => {
    const record = { id: 'session-one', duration_minutes: 25, completed_at: '2026-09-29T10:00:00Z' };
    const repository: any = { saveFocus: vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(undefined), recentFocus: vi.fn().mockResolvedValue([record]) };
    const { result } = renderHook(() => useDeskFocusLog('person-one', repository));
    act(() => result.current.complete(record));
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.pending).toBe(1);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.pending).toBe(0));
    expect(repository.saveFocus).toHaveBeenLastCalledWith('person-one', record);
  });
});
