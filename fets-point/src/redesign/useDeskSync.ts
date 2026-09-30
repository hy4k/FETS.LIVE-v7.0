import { useCallback, useEffect, useRef, useState } from 'react';
import type { DeskRepository, FocusRecord, Versioned } from './desk-data';

type Draft<T> = { value: T; version: number | null; dirty: boolean };
export function useDeskDocument<T extends object>(key: string, initial: T, load?: () => Promise<Versioned<T> | null>, write?: (value: T, version: number | null) => Promise<Versioned<T>>, initialDirty = false) {
  const [draft, setDraft] = useState<Draft<T>>(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(key) || 'null');
      if (cached?.value && Object.keys(initial).every(k => typeof cached.value[k] === typeof initial[k])) return cached;
    } catch { /* Keep the in-memory draft if browser storage is blocked. */ }
    return { value: initial, version: null, dirty: initialDirty };
  });
  const ref = useRef(draft); ref.current = draft;
  const loadRef = useRef(load); loadRef.current = load;
  const writeRef = useRef(write); writeRef.current = write;
  const mounted = useRef(true);
  const busy = useRef(false);
  const [status, setStatus] = useState<'local' | 'loading' | 'ready' | 'saving' | 'saved' | 'error' | 'conflict'>(load ? 'loading' : 'local');
  const [localSaved, setLocalSaved] = useState(true);
  const [message, setMessage] = useState('');
  const [loaded, setLoaded] = useState(!load);
  const enabled = !!load;
  const errorMessage = (error: any) => error?.code === '40001'
    ? 'This changed on another device. Your draft is safe here. Copy it before loading the cloud version.'
    : 'Cloud sync is unavailable. Your changes are kept as a draft on this browser when storage is available.';
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(draft)); setLocalSaved(true); }
    catch { setLocalSaved(false); }
  }, [key, draft]);
  const reload = useCallback(async (replaceDraft = false) => {
    if (!loadRef.current || busy.current) return;
    busy.current = true;
    setStatus('loading');
    try {
      const remote = await loadRef.current();
      if (!mounted.current) return;
      const current = ref.current;
      if (!replaceDraft && current.dirty && (remote?.version ?? null) !== current.version) {
        setStatus('conflict');
        setMessage(errorMessage({ code: '40001' }));
      } else {
        setDraft(old => ({ value: replaceDraft ? remote?.value ?? initial : old.dirty ? old.value : remote?.value ?? old.value, version: remote?.version ?? null, dirty: replaceDraft ? false : old.dirty }));
        setStatus('ready'); setMessage(''); setLoaded(true);
      }
    } catch (error) {
      if (mounted.current) { setStatus('error'); setMessage(errorMessage(error)); }
    } finally { busy.current = false; }
  }, [key]);
  useEffect(() => {
    mounted.current = true;
    // Defer so React StrictMode's first mount cannot leave the reload lock held.
    const id = window.setTimeout(() => void reload(), 0);
    return () => { mounted.current = false; window.clearTimeout(id); };
  }, [reload, enabled]);
  const edit = (patch: Partial<T>) => {
    setDraft(old => ({ ...old, value: { ...old.value, ...patch }, dirty: true }));
    setStatus(old => old === 'saved' ? 'ready' : old);
  };
  const save = async () => {
    if (!writeRef.current || busy.current || !loaded || status === 'conflict') return;
    busy.current = true;
    const snapshot = ref.current;
    setStatus('saving');
    try {
      const remote = await writeRef.current(snapshot.value, snapshot.version);
      if (!mounted.current) return;
      setDraft(current => ({ value: current.value, version: remote.version, dirty: current.value !== snapshot.value }));
      setStatus('saved'); setMessage('');
    } catch (error: any) {
      if (mounted.current) { setStatus(error?.code === '40001' ? 'conflict' : 'error'); setMessage(errorMessage(error)); }
    } finally { busy.current = false; }
  };
  return { ...draft, edit, save, reload, status, message, localSaved, canSave: enabled && loaded && !busy.current && status !== 'conflict', cloud: enabled };
}

export function useDeskFocusLog(userId: string, repository?: DeskRepository) {
  const key = `fets-desk:${userId}:focus-outbox`;
  const [pending, setPending] = useState<FocusRecord[]>(() => {
    try { const stored = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(stored) ? stored.filter(r => r.id && [25, 50].includes(r.duration_minutes) && r.completed_at) : []; } catch { return []; }
  });
  const [recent, setRecent] = useState<FocusRecord[]>([]);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [cached, setCached] = useState(true);
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(pending)); setCached(true); } catch { setCached(false); }
  }, [key, pending]);
  useEffect(() => {
    const online = () => setRetry(n => n + 1);
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, []);
  useEffect(() => {
    if (!repository) return;
    let cancelled = false;
    (async () => {
      try {
        for (const record of pending) {
          await repository.saveFocus(userId, record);
          if (cancelled) return;
          // Idempotent IDs make a replay safe after a lost response or remount.
        }
        const records = await repository.recentFocus(userId);
        if (cancelled) return;
        setRecent(records); setError(false);
        if (pending.length) setPending(old => old.filter(r => !pending.some(done => done.id === r.id)));
      } catch { if (!cancelled) setError(true); }
    })();
    return () => { cancelled = true; };
  }, [repository, userId, pending, retry]);
  const complete = useCallback((record: FocusRecord) => {
    setPending(old => old.some(r => r.id === record.id) ? old : [...old, record]);
  }, []);
  return { complete, recent, pending: pending.length, error, cached, retry: () => setRetry(n => n + 1) };
}
