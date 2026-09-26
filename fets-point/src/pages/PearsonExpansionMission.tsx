/**
 * PearsonExpansionMission.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * MISSION 7: Pearson VUE Center Expansion — Kerala
 * Collaborative workspace for FETS internal staff to track, audit, and onboard
 * 7 partner colleges as Pearson VUE testing centers by November 30, 2026.
 *
 * Route: /expansion   (tab key: "expansion")
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

type District = 'Kannur' | 'Calicut' | 'Thrissur' | 'Ernakulam' | 'Kottayam';

type Stage =
  | 'identified'
  | 'contacted'
  | 'audit_in_progress'
  | 'mou_review'
  | 'pearson_approved';

interface Institution {
  id: string;
  name: string;
  district: District;
  address: string | null;
  primary_contact_name: string | null;
  primary_contact_phone: string | null;
  primary_contact_email: string | null;
  primary_contact_role: string | null;
  lab_seat_capacity: number;
  stage: Stage;
  assigned_staff_name: string | null;
  has_dual_isp: boolean;
  has_static_ip: boolean;
  has_ups_generator: boolean;
  has_cctv_coverage: boolean;
  has_air_conditioning: boolean;
  has_secure_candidate_storage: boolean;
  is_acca_ready: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ActivityLog {
  id: string;
  institution_id: string;
  staff_name: string;
  entry_type: string;
  content: string;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEADLINE = new Date('2026-11-30T23:59:59+05:30');

const DISTRICT_TARGETS: { district: District; target: number; color: string; accent: string }[] = [
  { district: 'Kannur',    target: 1, color: '#f97316', accent: 'rgba(249,115,22,0.18)' },
  { district: 'Calicut',   target: 2, color: '#a855f7', accent: 'rgba(168,85,247,0.18)' },
  { district: 'Thrissur',  target: 1, color: '#06b6d4', accent: 'rgba(6,182,212,0.18)'  },
  { district: 'Ernakulam', target: 2, color: '#10b981', accent: 'rgba(16,185,129,0.18)' },
  { district: 'Kottayam',  target: 1, color: '#3b82f6', accent: 'rgba(59,130,246,0.18)' },
];

const STAGES: { key: Stage; label: string; color: string; bg: string; icon: string }[] = [
  { key: 'identified',      label: 'Identified / Lead',              color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', icon: '🔍' },
  { key: 'contacted',       label: 'Contacted & Meeting Scheduled',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: '📞' },
  { key: 'audit_in_progress', label: 'Site Audit & Inspection',      color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',   icon: '🏗️' },
  { key: 'mou_review',      label: 'MoU / Commercial Review',        color: '#a855f7', bg: 'rgba(168,85,247,0.12)', icon: '📋' },
  { key: 'pearson_approved', label: 'Pearson Approved / Active',     color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: '✅' },
];

const AUDIT_FIELDS: { key: keyof Institution; label: string; icon: string }[] = [
  { key: 'has_dual_isp',                label: 'Dual ISP / 50 Mbps+ Leased Line',         icon: '🌐' },
  { key: 'has_static_ip',               label: 'Static Public IP Feasibility',             icon: '📡' },
  { key: 'has_ups_generator',           label: 'Online UPS + Generator Changeover (30min+)', icon: '⚡' },
  { key: 'has_cctv_coverage',           label: '360° CCTV Coverage + DVR Retention',       icon: '📷' },
  { key: 'has_air_conditioning',        label: 'Redundant A/C (Lab + Server Zone)',         icon: '❄️' },
  { key: 'has_secure_candidate_storage', label: 'TCA Desk, Biometric + Locked Storage',    icon: '🔒' },
  { key: 'is_acca_ready',              label: 'ACCA Delivery Infrastructure Ready',         icon: '🎓' },
];

const DISTRICT_COLORS: Record<District, string> = {
  Kannur: '#f97316', Calicut: '#a855f7', Thrissur: '#06b6d4',
  Ernakulam: '#10b981', Kottayam: '#3b82f6',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useCountdown(target: Date) {
  const calc = () => {
    const diff = target.getTime() - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
    const days    = Math.floor(diff / 86400000);
    const hours   = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000)  / 60000);
    const seconds = Math.floor((diff % 60000)    / 1000);
    return { days, hours, minutes, seconds, expired: false };
  };
  const [t, setT] = useState(calc);
  useEffect(() => { const id = setInterval(() => setT(calc()), 1000); return () => clearInterval(id); }, []);
  return t;
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `hsl(${hue},60%,28%)`,
      border: `2px solid hsl(${hue},60%,45%)`,
      display: 'grid', placeItems: 'center',
      fontSize: size * 0.36, fontWeight: 800, color: `hsl(${hue},80%,80%)`,
      flexShrink: 0,
    }}>{initials}</div>
  );
}

function auditScore(inst: Institution): number {
  return AUDIT_FIELDS.filter(f => inst[f.key] === true).length;
}

function stageMeta(stage: Stage) {
  return STAGES.find(s => s.key === stage) ?? STAGES[0];
}

// ─── Add Institution Modal ────────────────────────────────────────────────────

function AddInstitutionModal({ onClose, onSave, staffName }: {
  onClose: () => void;
  onSave: () => void;
  staffName: string;
}) {
  const blank = {
    name: '', district: 'Ernakulam' as District, address: '',
    primary_contact_name: '', primary_contact_phone: '',
    primary_contact_email: '', primary_contact_role: '',
    lab_seat_capacity: 25, stage: 'identified' as Stage,
    assigned_staff_name: staffName,
  };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('expansion_institutions').insert([form]);
      if (error) throw error;
      onSave();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 9,
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
    color: '#f1f5f9', fontSize: 13.5, fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
      display: 'grid', placeItems: 'center', padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 520, borderRadius: 20,
        background: 'linear-gradient(145deg,#0f172a,#1e293b)',
        border: '1.5px solid rgba(99,102,241,0.35)',
        boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
        padding: '28px 30px', display: 'flex', flexDirection: 'column', gap: 16,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#f1f5f9' }}>🏫 Add New Institution</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {[
          { label: 'Institution Name *', key: 'name', type: 'text' },
          { label: 'Address', key: 'address', type: 'text' },
          { label: 'Contact Name', key: 'primary_contact_name', type: 'text' },
          { label: 'Contact Phone', key: 'primary_contact_phone', type: 'text' },
          { label: 'Contact Email', key: 'primary_contact_email', type: 'email' },
          { label: 'Contact Role (e.g. Principal)', key: 'primary_contact_role', type: 'text' },
        ].map(({ label, key, type }) => (
          <div key={key}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
            <input type={type} value={form[key as keyof typeof form] as string}
              onChange={e => set(key, e.target.value)} style={inp} />
          </div>
        ))}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>District</div>
            <select value={form.district} onChange={e => set('district', e.target.value)} style={{ ...inp }}>
              {DISTRICT_TARGETS.map(d => <option key={d.district}>{d.district}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stage</div>
            <select value={form.stage} onChange={e => set('stage', e.target.value)} style={{ ...inp }}>
              {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lab Seat Capacity</div>
          <input type="number" min={0} value={form.lab_seat_capacity}
            onChange={e => set('lab_seat_capacity', Number(e.target.value))} style={inp} />
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '11px 0', borderRadius: 10,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            color: '#94a3b8', fontWeight: 750, fontSize: 13.5, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={save} disabled={saving || !form.name.trim()} style={{
            flex: 2, padding: '11px 0', borderRadius: 10,
            background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
            border: 'none', color: '#fff', fontWeight: 850, fontSize: 13.5,
            cursor: saving ? 'wait' : 'pointer', opacity: !form.name.trim() ? 0.5 : 1,
          }}>{saving ? 'Saving…' : '✓ Add Institution'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Institution Detail Drawer ─────────────────────────────────────────────────

function InstitutionDrawer({
  inst, logs, onClose, onSave, staffName,
}: {
  inst: Institution;
  logs: ActivityLog[];
  onClose: () => void;
  onSave: (updated: Partial<Institution>) => void;
  staffName: string;
}) {
  const [note, setNote] = useState('');
  const [postingNote, setPostingNote] = useState(false);
  const [editStage, setEditStage] = useState<Stage>(inst.stage);
  const [auditState, setAuditState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(AUDIT_FIELDS.map(f => [f.key, inst[f.key] as boolean]))
  );
  const [saving, setSaving] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const saveChanges = async () => {
    setSaving(true);
    try {
      const patch: Partial<Institution> = { stage: editStage, updated_at: new Date().toISOString(), ...auditState as Partial<Institution> };
      const { error } = await supabase.from('expansion_institutions').update(patch).eq('id', inst.id);
      if (error) throw error;

      if (editStage !== inst.stage) {
        await supabase.from('expansion_activity_logs').insert([{
          institution_id: inst.id,
          staff_name: staffName,
          entry_type: 'stage_change',
          content: `Stage changed from "${stageMeta(inst.stage).label}" → "${stageMeta(editStage).label}"`,
        }]);
      }
      onSave(patch);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const postNote = async () => {
    if (!note.trim()) return;
    setPostingNote(true);
    try {
      await supabase.from('expansion_activity_logs').insert([{
        institution_id: inst.id, staff_name: staffName,
        entry_type: 'note', content: note.trim(),
      }]);
      setNote('');
      onSave({});
    } catch (e) { console.error(e); }
    finally { setPostingNote(false); }
  };

  const sm = stageMeta(editStage);
  const score = AUDIT_FIELDS.filter(f => auditState[f.key]).length;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', justifyContent: 'flex-end',
    }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }} />

      {/* Panel */}
      <div style={{
        width: '100%', maxWidth: 520, height: '100%',
        background: 'linear-gradient(180deg,#0f172a 0%,#0d1a2e 100%)',
        borderLeft: '1.5px solid rgba(99,102,241,0.25)',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{
          padding: '22px 24px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(15,23,42,0.8))',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#f1f5f9', lineHeight: 1.3 }}>{inst.name}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 99,
                  background: `${DISTRICT_COLORS[inst.district]}20`, color: DISTRICT_COLORS[inst.district],
                  border: `1px solid ${DISTRICT_COLORS[inst.district]}40`,
                }}>📍 {inst.district}</span>
                <span style={{
                  fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 99,
                  background: sm.bg, color: sm.color, border: `1px solid ${sm.color}40`,
                }}>{sm.icon} {sm.label}</span>
              </div>
            </div>
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8, color: '#94a3b8', fontSize: 16, cursor: 'pointer', padding: '6px 10px',
            }}>✕</button>
          </div>
        </div>

        <div style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* ── Contact Info ── */}
          <Section title="📇 Institution Dossier">
            <InfoRow label="Address">{inst.address || '—'}</InfoRow>
            {inst.primary_contact_name && <InfoRow label="Primary Contact">
              <strong style={{ color: '#f1f5f9' }}>{inst.primary_contact_name}</strong>
              {inst.primary_contact_role && <span style={{ color: '#64748b' }}> · {inst.primary_contact_role}</span>}
            </InfoRow>}
            {inst.primary_contact_phone && <InfoRow label="Phone">
              <a href={`tel:${inst.primary_contact_phone}`} style={{ color: '#6366f1' }}>{inst.primary_contact_phone}</a>
            </InfoRow>}
            {inst.primary_contact_email && <InfoRow label="Email">
              <a href={`mailto:${inst.primary_contact_email}`} style={{ color: '#6366f1' }}>{inst.primary_contact_email}</a>
            </InfoRow>}
            <InfoRow label="Lab Seats">{inst.lab_seat_capacity} seats</InfoRow>
          </Section>

          {/* ── Stage Update ── */}
          <Section title="📌 Update Pipeline Stage">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {STAGES.map(s => (
                <button key={s.key} onClick={() => setEditStage(s.key)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                  borderRadius: 9, border: `1.5px solid ${editStage === s.key ? s.color : 'rgba(255,255,255,0.08)'}`,
                  background: editStage === s.key ? s.bg : 'transparent',
                  color: editStage === s.key ? s.color : '#64748b',
                  fontWeight: 750, fontSize: 13, cursor: 'pointer', textAlign: 'left',
                }}>
                  <span>{s.icon}</span>
                  <span>{s.label}</span>
                  {editStage === s.key && <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.8 }}>● Selected</span>}
                </button>
              ))}
            </div>
          </Section>

          {/* ── Audit Checklist ── */}
          <Section title={`🔬 Technical Audit Checklist (${score}/${AUDIT_FIELDS.length})`}>
            <div style={{
              height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.08)', marginBottom: 14, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', width: `${(score / AUDIT_FIELDS.length) * 100}%`,
                background: score === AUDIT_FIELDS.length ? '#10b981' : 'linear-gradient(90deg,#6366f1,#a855f7)',
                borderRadius: 99, transition: 'width 0.4s ease',
              }} />
            </div>
            {AUDIT_FIELDS.map(f => (
              <div key={f.key} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 12px', borderRadius: 9,
                background: auditState[f.key] ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${auditState[f.key] ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.06)'}`,
                marginBottom: 5, cursor: 'pointer',
              }} onClick={() => setAuditState(s => ({ ...s, [f.key]: !s[f.key] }))}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span>{f.icon}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 650, color: auditState[f.key] ? '#d1fae5' : '#94a3b8' }}>{f.label}</span>
                </div>
                <div style={{
                  width: 22, height: 22, borderRadius: 6, display: 'grid', placeItems: 'center',
                  background: auditState[f.key] ? '#10b981' : 'rgba(255,255,255,0.06)',
                  border: `1.5px solid ${auditState[f.key] ? '#10b981' : 'rgba(255,255,255,0.15)'}`,
                  fontSize: 12, color: '#fff', transition: 'all 0.2s',
                }}>
                  {auditState[f.key] ? '✓' : ''}
                </div>
              </div>
            ))}
          </Section>

          {/* ── Save Button ── */}
          <button onClick={saveChanges} disabled={saving} style={{
            padding: '12px 0', borderRadius: 11,
            background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
            border: 'none', color: '#fff', fontWeight: 850, fontSize: 14,
            cursor: saving ? 'wait' : 'pointer',
          }}>{saving ? 'Saving Changes…' : '💾 Save Changes'}</button>

          {/* ── Activity Log ── */}
          <Section title="💬 Activity Log & Team Notes">
            <div ref={logRef} style={{
              maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column',
              gap: 8, paddingRight: 4,
            }}>
              {logs.length === 0 ? (
                <div style={{ color: '#475569', fontSize: 12.5, textAlign: 'center', padding: '20px 0' }}>No activity yet</div>
              ) : logs.map(l => (
                <div key={l.id} style={{
                  background: l.entry_type === 'stage_change' ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${l.entry_type === 'stage_change' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 9, padding: '9px 12px',
                }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <Avatar name={l.staff_name} size={20} />
                    <span style={{ fontSize: 11.5, fontWeight: 750, color: '#94a3b8' }}>{l.staff_name}</span>
                    <span style={{ fontSize: 10, color: '#475569', marginLeft: 'auto' }}>
                      {new Date(l.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.5 }}>{l.content}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Add a note or update…"
                rows={2}
                style={{
                  flex: 1, padding: '9px 12px', borderRadius: 9,
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                  color: '#f1f5f9', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none',
                }}
              />
              <button onClick={postNote} disabled={postingNote || !note.trim()} style={{
                padding: '0 14px', borderRadius: 9, border: 'none',
                background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
                color: '#fff', fontWeight: 850, fontSize: 13,
                cursor: !note.trim() ? 'default' : 'pointer', opacity: !note.trim() ? 0.5 : 1,
              }}>{postingNote ? '…' : '➤'}</button>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, fontSize: 12.5, marginBottom: 6, alignItems: 'flex-start' }}>
      <span style={{ color: '#475569', fontWeight: 700, minWidth: 110, flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#cbd5e1', lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}

// ─── Kanban Card ──────────────────────────────────────────────────────────────

function KanbanCard({ inst, onClick, onDragStart }: {
  inst: Institution;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  const sm = stageMeta(inst.stage);
  const score = auditScore(inst);
  const missing = AUDIT_FIELDS.length - score;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      style={{
        background: 'linear-gradient(145deg,rgba(30,41,59,0.9),rgba(15,23,42,0.8))',
        border: `1.5px solid ${sm.color}28`,
        borderRadius: 12, padding: '14px 15px',
        cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s',
        boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 24px rgba(0,0,0,0.35), 0 0 0 1.5px ${sm.color}45`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.2)';
      }}
    >
      <div style={{ fontSize: 13.5, fontWeight: 850, color: '#f1f5f9', marginBottom: 7, lineHeight: 1.3 }}>{inst.name}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={{
          fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 99,
          background: `${DISTRICT_COLORS[inst.district]}18`, color: DISTRICT_COLORS[inst.district],
          border: `1px solid ${DISTRICT_COLORS[inst.district]}35`,
        }}>📍 {inst.district}</span>
        {inst.lab_seat_capacity > 0 && (
          <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)' }}>
            🪑 {inst.lab_seat_capacity} seats
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {inst.assigned_staff_name && <Avatar name={inst.assigned_staff_name} size={22} />}
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{inst.primary_contact_name || 'No contact'}</span>
        </div>
        {missing > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 99,
            background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)',
          }}>⚠ {missing} missing</span>
        )}
      </div>
      {/* Audit bar */}
      <div style={{ marginTop: 10, height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${(score / AUDIT_FIELDS.length) * 100}%`,
          background: score === AUDIT_FIELDS.length ? '#10b981' : '#6366f1',
          borderRadius: 99, transition: 'width 0.4s',
        }} />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function PearsonExpansionMission({ staffName = 'Staff', isAdmin = false }: {
  staffName?: string;
  isAdmin?: boolean;
}) {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'kanban' | 'table'>('kanban');
  const [selected, setSelected] = useState<Institution | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const countdown = useCountdown(DEADLINE);

  // ── Data loading ──

  const loadInstitutions = useCallback(async () => {
    const { data, error } = await supabase
      .from('expansion_institutions')
      .select('*')
      .order('created_at', { ascending: true });
    if (!error && data) setInstitutions(data as Institution[]);
    setLoading(false);
  }, []);

  const loadLogs = useCallback(async (instId?: string) => {
    const q = supabase.from('expansion_activity_logs').select('*').order('created_at', { ascending: true });
    if (instId) q.eq('institution_id', instId);
    const { data } = await q;
    if (data) setLogs(data as ActivityLog[]);
  }, []);

  useEffect(() => { loadInstitutions(); }, [loadInstitutions]);

  useEffect(() => {
    if (selected) loadLogs(selected.id);
  }, [selected, loadLogs]);

  // ── Stats ──
  const confirmed = institutions.filter(i => i.stage === 'pearson_approved').length;

  const districtStats = DISTRICT_TARGETS.map(dt => ({
    ...dt,
    confirmed: institutions.filter(i => i.district === dt.district && i.stage === 'pearson_approved').length,
    pipeline:  institutions.filter(i => i.district === dt.district && i.stage !== 'pearson_approved').length,
  }));

  // ── Drag & Drop ──
  const handleDrop = async (targetStage: Stage) => {
    if (!draggedId) return;
    const inst = institutions.find(i => i.id === draggedId);
    if (!inst || inst.stage === targetStage) { setDraggedId(null); return; }

    setInstitutions(prev => prev.map(i => i.id === draggedId ? { ...i, stage: targetStage } : i));
    setDraggedId(null);

    await supabase.from('expansion_institutions').update({ stage: targetStage, updated_at: new Date().toISOString() }).eq('id', draggedId);
    await supabase.from('expansion_activity_logs').insert([{
      institution_id: draggedId,
      staff_name: staffName,
      entry_type: 'stage_change',
      content: `Stage moved to "${stageMeta(targetStage).label}"`,
    }]);
  };

  const handleSave = useCallback((updated: Partial<Institution>) => {
    if (selected) {
      setSelected(prev => prev ? { ...prev, ...updated } : null);
      setInstitutions(prev => prev.map(i => i.id === selected.id ? { ...i, ...updated } : i));
    }
    loadInstitutions();
    if (selected) loadLogs(selected.id);
  }, [selected, loadInstitutions, loadLogs]);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(160deg,#060d1a 0%,#0c1628 40%,#080f1f 100%)',
      fontFamily: "'Inter','Segoe UI',sans-serif", color: '#f1f5f9',
    }}>
      {/* ══ MISSION CONTROL HEADER ══ */}
      <div style={{
        background: 'linear-gradient(135deg,rgba(99,102,241,0.18) 0%,rgba(15,23,42,0.95) 60%,rgba(6,182,212,0.1) 100%)',
        borderBottom: '1px solid rgba(99,102,241,0.2)',
        padding: '28px 32px 24px', position: 'sticky', top: 0, zIndex: 100,
        backdropFilter: 'blur(16px)',
      }}>
        {/* Top row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'linear-gradient(135deg,rgba(99,102,241,0.35),rgba(79,70,229,0.2))',
                border: '1.5px solid rgba(99,102,241,0.5)',
                display: 'grid', placeItems: 'center', fontSize: 22,
                boxShadow: '0 0 20px rgba(99,102,241,0.4)',
              }}>🎯</div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#6366f1', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Mission 7 · FETS Internal
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#f1f5f9', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                  Pearson VUE Center Expansion · Kerala
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginLeft: 56 }}>
              Onboard 7 authorized partner test centers across 5 districts · Deadline: 30 Nov 2026
            </div>
          </div>

          {/* Countdown */}
          <div style={{
            display: 'flex', gap: 10, flexShrink: 0,
          }}>
            {[
              { val: countdown.days,    label: 'Days'    },
              { val: countdown.hours,   label: 'Hours'   },
              { val: countdown.minutes, label: 'Minutes' },
              { val: countdown.seconds, label: 'Seconds' },
            ].map(({ val, label }) => (
              <div key={label} style={{
                background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(99,102,241,0.3)',
                borderRadius: 10, padding: '8px 12px', textAlign: 'center', minWidth: 54,
              }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: countdown.days < 30 ? '#ef4444' : '#6366f1', fontVariantNumeric: 'tabular-nums' }}>
                  {String(val).padStart(2, '0')}
                </div>
                <div style={{ fontSize: 9.5, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#94a3b8' }}>
              Mission Progress
            </div>
            <div style={{ fontSize: 15, fontWeight: 900, color: confirmed >= 7 ? '#10b981' : '#f1f5f9' }}>
              {confirmed} / 7 Confirmed Centers
            </div>
          </div>
          <div style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${(confirmed / 7) * 100}%`,
              background: confirmed >= 7
                ? '#10b981'
                : 'linear-gradient(90deg,#6366f1 0%,#a855f7 60%,#06b6d4 100%)',
              borderRadius: 99,
              transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
              boxShadow: '0 0 14px rgba(99,102,241,0.5)',
            }} />
          </div>
        </div>

        {/* District Quota Badges */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          {districtStats.map(d => (
            <div key={d.district} style={{
              background: d.confirmed >= d.target ? 'rgba(16,185,129,0.12)' : d.accent,
              border: `1.5px solid ${d.confirmed >= d.target ? '#10b981' : d.color}35`,
              borderRadius: 10, padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 3,
              minWidth: 100,
            }}>
              <div style={{ fontSize: 12, fontWeight: 850, color: d.confirmed >= d.target ? '#10b981' : d.color }}>
                📍 {d.district}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 650 }}>
                <span style={{ color: d.confirmed >= d.target ? '#10b981' : '#f1f5f9', fontWeight: 900 }}>{d.confirmed}</span>
                /{d.target} confirmed
                {d.pipeline > 0 && <span style={{ color: '#f59e0b' }}> · {d.pipeline} in pipeline</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ PIPELINE CONTROLS ══ */}
      <div style={{
        padding: '16px 32px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['kanban', 'table'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '7px 16px', borderRadius: 8,
              background: view === v ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${view === v ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'}`,
              color: view === v ? '#a5b4fc' : '#64748b',
              fontWeight: 750, fontSize: 12.5, cursor: 'pointer',
            }}>
              {v === 'kanban' ? '🗂 Kanban' : '📊 Table'}
            </button>
          ))}
        </div>
        <button onClick={() => setShowAdd(true)} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', borderRadius: 10,
          background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
          border: 'none', color: '#fff', fontWeight: 850, fontSize: 13.5, cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
        }}>
          <span style={{ fontSize: 16 }}>＋</span> Add New Institution
        </button>
      </div>

      {/* ══ CONTENT ══ */}
      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 300, color: '#475569', fontSize: 14 }}>
          Loading institutions…
        </div>
      ) : view === 'kanban' ? (
        /* ── KANBAN ── */
        <div style={{
          display: 'flex', gap: 14, padding: '20px 24px',
          overflowX: 'auto', alignItems: 'flex-start', minHeight: '60vh',
        }}>
          {STAGES.map(stage => {
            const cards = institutions.filter(i => i.stage === stage.key);
            return (
              <div
                key={stage.key}
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(stage.key)}
                style={{
                  width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10,
                }}
              >
                {/* Column header */}
                <div style={{
                  padding: '10px 14px', borderRadius: 10,
                  background: stage.bg, border: `1.5px solid ${stage.color}30`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 850, fontSize: 12.5, color: stage.color }}>
                    <span>{stage.icon}</span>
                    <span>{stage.label}</span>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 900, padding: '2px 8px', borderRadius: 99,
                    background: `${stage.color}25`, color: stage.color,
                  }}>{cards.length}</span>
                </div>

                {/* Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 80 }}>
                  {cards.length === 0 ? (
                    <div style={{
                      padding: '20px 14px', borderRadius: 10, textAlign: 'center',
                      border: `1.5px dashed ${stage.color}20`, color: '#334155', fontSize: 12,
                    }}>Drop here</div>
                  ) : cards.map(inst => (
                    <KanbanCard
                      key={inst.id}
                      inst={inst}
                      onClick={() => setSelected(inst)}
                      onDragStart={e => {
                        setDraggedId(inst.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── TABLE ── */
        <div style={{ padding: '20px 32px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 6px', fontSize: 13 }}>
            <thead>
              <tr>
                {['Institution', 'District', 'Stage', 'Seats', 'Audit', 'Contact', 'Assigned'].map(h => (
                  <th key={h} style={{
                    padding: '8px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 800,
                    color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {institutions.map(inst => {
                const sm = stageMeta(inst.stage);
                const score = auditScore(inst);
                return (
                  <tr key={inst.id} onClick={() => setSelected(inst)} style={{ cursor: 'pointer' }}
                    onMouseEnter={e => { const row = e.currentTarget; row.style.background = 'rgba(99,102,241,0.07)'; }}
                    onMouseLeave={e => { const row = e.currentTarget; row.style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '12px 14px', borderRadius: '10px 0 0 10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRight: 'none', fontWeight: 800, color: '#f1f5f9' }}>{inst.name}</td>
                    <td style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderLeft: 'none', borderRight: 'none' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 9px', borderRadius: 99, background: `${DISTRICT_COLORS[inst.district]}18`, color: DISTRICT_COLORS[inst.district] }}>{inst.district}</span>
                    </td>
                    <td style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderLeft: 'none', borderRight: 'none' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 9px', borderRadius: 99, background: sm.bg, color: sm.color }}>{sm.icon} {sm.label}</span>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#94a3b8', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderLeft: 'none', borderRight: 'none' }}>{inst.lab_seat_capacity || '—'}</td>
                    <td style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderLeft: 'none', borderRight: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 60, height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(score / AUDIT_FIELDS.length) * 100}%`, background: score === AUDIT_FIELDS.length ? '#10b981' : '#6366f1', borderRadius: 99 }} />
                        </div>
                        <span style={{ fontSize: 11, color: '#64748b' }}>{score}/{AUDIT_FIELDS.length}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#94a3b8', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderLeft: 'none', borderRight: 'none' }}>{inst.primary_contact_name || '—'}</td>
                    <td style={{ padding: '12px 14px', borderRadius: '0 10px 10px 0', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderLeft: 'none' }}>
                      {inst.assigned_staff_name ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Avatar name={inst.assigned_staff_name} size={22} />
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>{inst.assigned_staff_name}</span>
                        </div>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
              {institutions.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '50px 0', color: '#334155' }}>
                    No institutions yet. Add one to get started!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ══ MODALS & DRAWER ══ */}
      {showAdd && (
        <AddInstitutionModal
          staffName={staffName}
          onClose={() => setShowAdd(false)}
          onSave={loadInstitutions}
        />
      )}

      {selected && (
        <InstitutionDrawer
          inst={selected}
          logs={logs.filter(l => l.institution_id === selected.id)}
          staffName={staffName}
          onClose={() => setSelected(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

export default PearsonExpansionMission;
