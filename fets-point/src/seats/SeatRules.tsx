import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { saveSeatRule } from './api';
import { normaliseProvider } from './engine';
import type { SeatBranch, SeatRule } from './types';

type Props = { branch: SeatBranch | null; rules: SeatRule[]; canEdit: boolean; disabled?: boolean; providers: string[]; onSaved: (rule: SeatRule) => void; onEditing?: () => void };
export default function SeatRules({ branch, rules, canEdit, disabled, providers, onSaved, onEditing }: Props) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState('new');
  const [provider, setProvider] = useState('');
  const [scope, setScope] = useState('provider');
  const [exam, setExam] = useState('');
  const [earlier, setEarlier] = useState('0');
  const [later, setLater] = useState('0');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const generation = useRef(0);
  const rulesKey = JSON.stringify(rules);
  useEffect(() => {
    generation.current += 1; setSaving(false); setMessage(''); setError('');
    setSelected('new'); setProvider(''); setScope('provider'); setExam(''); setEarlier('0'); setLater('0');
    return () => { generation.current += 1; };
  }, [branch, canEdit, rulesKey]);
  const editing = () => { generation.current += 1; setSaving(false); setMessage(''); setError(''); onEditing?.(); };
  const pick = (id: string) => {
    editing(); setSelected(id);
    const rule = rules.find(r => r.id === id);
    setProvider(rule?.provider || ''); setScope(rule?.exam_code ? 'code' : rule?.exam_name ? 'name' : 'provider');
    setExam(rule?.exam_code || rule?.exam_name || ''); setEarlier(String(rule?.earlier_minutes ?? 0)); setLater(String(rule?.later_minutes ?? 0));
  };
  const valid = provider.trim() && (scope === 'provider' || exam.trim()) && /^\d+$/.test(earlier) && /^\d+$/.test(later) && +earlier <= 120 && +later <= 120;
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!branch || !canEdit || disabled || saving || !valid) return;
    const token = ++generation.current;
    const canonical = normaliseProvider(provider);
    const code = scope === 'code' ? exam.trim() : null;
    const name = scope === 'name' ? exam.trim() : null;
    const existing = rules.find(r => r.branch_location === branch && normaliseProvider(r.provider) === canonical && (r.exam_code || '').trim().toLowerCase() === (code || '').toLowerCase() && (r.exam_name || '').trim().toLowerCase() === (name || '').toLowerCase());
    setSaving(true); setError(''); setMessage('');
    try {
      const rule = await saveSeatRule({ branch_location: branch, provider: canonical, exam_code: code, exam_name: name, earlier_minutes: +earlier, later_minutes: +later, expected_updated_at: existing?.updated_at ?? null });
      void queryClient.invalidateQueries({ queryKey: ['seat-context'] });
      if (generation.current !== token) return;
      setMessage('Timing rule saved.'); onSaved(rule);
    } catch (reason) {
      if (generation.current === token) setError(reason instanceof Error ? reason.message : 'Could not save this rule. Refresh and try again.');
    } finally { if (generation.current === token) setSaving(false); }
  }
  return <section className="seat-rules" aria-label="Shared timing rules">
    <div className="seat-section-heading"><h3>Shared timing rules</h3><span className="seat-muted">0 minutes = fixed</span></div>
    <p className="seat-muted">Unconfigured providers and exams stay fixed. Exam code or name overrides the provider default. Limits are shared with everyone at this centre.</p>
    {rules.length > 0 ? <ul className="seat-rule-list">{rules.map(rule => <li key={rule.id}><div><strong>{rule.provider}</strong><span>{!branch && ` · ${rule.branch_location === 'calicut' ? 'Calicut' : 'Kochi'}`}{rule.exam_code ? ` · Code ${rule.exam_code}` : rule.exam_name ? ` · ${rule.exam_name}` : ' · Provider default'}</span></div><span>Earlier {rule.earlier_minutes} min · Later {rule.later_minutes} min</span></li>)}</ul> : <p className="seat-empty">No timing flexibility configured.</p>}
    {branch && canEdit ? <details className="seat-rule-editor" open><summary>Configure timing flexibility</summary>
      <form onSubmit={save} className="seat-rule-form">
        <label className="seat-field-wide">Rule to edit<select aria-label="Rule to edit" value={selected} onChange={event => pick(event.target.value)} disabled={saving || disabled}><option value="new">New explicit rule</option>{rules.map(rule => <option key={rule.id} value={rule.id}>{rule.provider} · {rule.exam_code || rule.exam_name || 'Provider default'}</option>)}</select></label>
        <label>Rule provider<input aria-label="Rule provider" value={provider} list={`seat-providers-${branch}`} onChange={event => { editing(); setProvider(event.target.value); }} disabled={saving || disabled} required maxLength={150} autoComplete="off" /><datalist id={`seat-providers-${branch}`}>{providers.map(item => <option key={item} value={item} />)}</datalist></label>
        <label>Rule applies to<select aria-label="Rule applies to" value={scope} onChange={event => { editing(); setScope(event.target.value); setExam(''); }} disabled={saving || disabled}><option value="provider">Provider default</option><option value="code">Exam code override</option><option value="name">Exam name override</option></select></label>
        {scope !== 'provider' && <label className="seat-field-wide">{scope === 'code' ? 'Exam code' : 'Exam name'}<input aria-label={scope === 'code' ? 'Exam code' : 'Exam name'} value={exam} onChange={event => { editing(); setExam(event.target.value); }} disabled={saving || disabled} required maxLength={300} /></label>}
        <label>Earlier by · minutes<input aria-label="Earlier by · minutes" type="number" min="0" max="120" step="1" value={earlier} onChange={event => { editing(); setEarlier(event.target.value); }} disabled={saving || disabled} required /></label>
        <label>Later by · minutes<input aria-label="Later by · minutes" type="number" min="0" max="120" step="1" value={later} onChange={event => { editing(); setLater(event.target.value); }} disabled={saving || disabled} required /></label>
        <p className="seat-muted seat-field-wide">Enter the provider-approved allowance explicitly, from 0 to 120 whole minutes in each direction.</p>
        <button type="submit" className="seat-button" disabled={!valid || saving || disabled}>{saving ? 'Saving timing rule…' : 'Save timing rule'}</button>
        {error && <p role="alert" className="seat-error seat-field-wide">{error}</p>}{message && <p role="status" className="seat-field-wide">{message}</p>}
      </form>
    </details> : <p className="seat-muted">{!branch ? 'Choose one centre to edit its timing rules.' : 'You can view shared rules. Calendar editors can change them.'}</p>}
  </section>;
}
