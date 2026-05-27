import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import {
  RefreshCw, AlertCircle, CheckCircle, Clock, MapPin,
  GraduationCap, Pencil, X, Save, ExternalLink,
  Wifi, WifiOff, TrendingUp, Info
} from 'lucide-react';

const CENTERS = [
  { id: 'cochin',  label: 'Cochin',     city: 'Kochi, Kerala',      code: 'COK' },
  { id: 'calicut', label: 'Calicut',    city: 'Kozhikode, Kerala',   code: 'CCJ' },
];

const STATUS_CFG = {
  available:   { label: 'Available',   color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', dot: 'bg-emerald-400', pulse: true,  icon: CheckCircle },
  limited:     { label: 'Limited',     color: 'text-amber-400',   bg: 'bg-amber-500/15',   border: 'border-amber-500/30',   dot: 'bg-amber-400',   pulse: true,  icon: Clock },
  unavailable: { label: 'No Slots',    color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     dot: 'bg-red-500',     pulse: false, icon: X },
  unknown:     { label: 'Checking…',   color: 'text-white/30',    bg: 'bg-white/5',        border: 'border-white/10',       dot: 'bg-white/20',    pulse: false, icon: Clock },
};

function cfg(status) {
  return STATUS_CFG[status] || STATUS_CFG.unknown;
}

function relativeTime(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ── Inline edit form ──────────────────────────────────────────────────────────
function UpdateForm({ record, onSave, onCancel }) {
  const [status, setStatus] = useState(record.status);
  const [seats, setSeats]   = useState(record.available_seats ?? '');
  const [notes, setNotes]   = useState(record.notes || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  async function handleSave() {
    setSaving(true);
    setErr('');
    const { error } = await supabase
      .from('cma_availability')
      .update({
        status,
        available_seats: seats === '' ? null : Number(seats),
        notes: notes.trim() || null,
        scraped_at: new Date().toISOString(),
      })
      .eq('id', record.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSave();
  }

  return (
    <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
      <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Update Status</p>
      <div className="grid grid-cols-3 gap-2">
        {['available', 'limited', 'unavailable'].map(s => {
          const c = cfg(s);
          return (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold border transition-all ${
                status === s
                  ? `${c.bg} ${c.border} ${c.color}`
                  : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
              {c.label}
            </button>
          );
        })}
      </div>

      {status !== 'unavailable' && (
        <input
          type="number" min="0"
          value={seats}
          onChange={e => setSeats(e.target.value)}
          placeholder="Seats available"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-teal-500/50"
        />
      )}

      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Notes (e.g. Next slot: May 15)"
        rows={2}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 resize-none focus:outline-none focus:border-teal-500/50"
      />

      {err && <p className="text-xs text-red-400">{err}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-2 bg-teal-500/20 border border-teal-500/30 text-teal-400 text-xs font-bold rounded-xl hover:bg-teal-500/30 disabled:opacity-40 transition-all"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-xs text-white/40 border border-white/10 rounded-xl hover:bg-white/5 transition-all"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Part row inside a center card ─────────────────────────────────────────────
function PartRow({ record, canEdit, onUpdated }) {
  const [editing, setEditing] = useState(false);
  if (!record) return null;
  const c = cfg(record.status);
  const Icon = c.icon;

  return (
    <div className={`rounded-2xl border p-4 transition-all duration-300 ${c.bg} ${c.border}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Animated status dot */}
          <div className="relative flex items-center justify-center w-7 h-7">
            {c.pulse && (
              <span className={`absolute inline-flex h-full w-full rounded-full ${c.dot} opacity-30 animate-ping`} />
            )}
            <span className={`relative inline-flex rounded-full w-3 h-3 ${c.dot}`} />
          </div>
          <div>
            <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Part {record.exam_part}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Icon className={`w-3.5 h-3.5 ${c.color}`} />
              <span className={`text-sm font-bold ${c.color}`}>{c.label}</span>
              {record.available_seats > 0 && record.status !== 'unavailable' && (
                <span className={`text-xs font-black ${c.color} opacity-60`}>· {record.available_seats} seats</span>
              )}
            </div>
          </div>
        </div>

        {canEdit && (
          <button
            onClick={() => setEditing(e => !e)}
            className="p-1.5 rounded-lg text-white/20 hover:text-teal-400 hover:bg-teal-500/10 border border-transparent hover:border-teal-500/20 transition-all"
          >
            {editing ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Notes */}
      {record.notes && (
        <p className="mt-2 text-[11px] text-white/40 leading-relaxed pl-10">{record.notes}</p>
      )}

      {editing && (
        <UpdateForm
          record={record}
          onSave={() => { setEditing(false); onUpdated(); }}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );
}

// ── Center card (Cochin / Calicut) ────────────────────────────────────────────
function CenterCard({ center, records, canEdit, onUpdated }) {
  const p1 = records.find(r => r.exam_part === '1' || r.exam_part === 1);
  const p2 = records.find(r => r.exam_part === '2' || r.exam_part === 2);
  const anyAvail = [p1, p2].some(r => r?.status === 'available' || r?.status === 'limited');

  return (
    <div className={`relative rounded-3xl border overflow-hidden transition-all duration-500 ${
      anyAvail ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/10 bg-white/[0.03]'
    }`}>
      {/* Top accent line */}
      <div className={`h-0.5 w-full ${anyAvail ? 'bg-gradient-to-r from-emerald-500/60 via-emerald-400/80 to-emerald-500/60' : 'bg-gradient-to-r from-white/5 via-white/10 to-white/5'}`} />

      <div className="p-5">
        {/* Center header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
              anyAvail ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-white/5 border-white/10'
            }`}>
              <MapPin className={`w-4.5 h-4.5 ${anyAvail ? 'text-emerald-400' : 'text-white/30'}`} size={18} />
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-tight">{center.label}</h3>
              <p className="text-[10px] text-white/30 uppercase tracking-widest">{center.city}</p>
            </div>
          </div>
          <div className={`px-2.5 py-1 rounded-full border text-[10px] font-black tracking-widest ${
            anyAvail ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-white/20'
          }`}>
            {center.code}
          </div>
        </div>

        {/* Part rows */}
        <div className="space-y-2.5">
          <PartRow record={p1} canEdit={canEdit} onUpdated={onUpdated} />
          <PartRow record={p2} canEdit={canEdit} onUpdated={onUpdated} />
        </div>

        {/* Scraped at */}
        {p1?.scraped_at && (
          <p className="mt-3 text-[10px] text-white/20 text-right">
            Scraped {relativeTime(p1.scraped_at)}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function CMAAvailabilityWidget() {
  const { profile }  = useAuth();
  const [records, setRecords]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [isLive, setIsLive]         = useState(false);

  const canEdit = ['admin', 'super_admin', 'manager'].includes(profile?.role);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('cma_availability')
        .select('*')
        .in('center_id', ['cochin', 'calicut'])
        .order('center_id')
        .order('exam_part');
      if (err) throw err;
      setRecords(data || []);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const ch = supabase
      .channel('cma_live_v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cma_availability' }, () => {
        fetchData();
      })
      .subscribe(status => setIsLive(status === 'SUBSCRIBED'));
    return () => supabase.removeChannel(ch);
  }, [fetchData]);

  const available = records.filter(r => r.status === 'available').length;
  const limited   = records.filter(r => r.status === 'limited').length;
  const full      = records.filter(r => r.status === 'unavailable').length;
  const anyGood   = available > 0 || limited > 0;

  // Latest scrape time across all records
  const latestScrape = records.reduce((latest, r) => {
    if (!r.scraped_at) return latest;
    return !latest || new Date(r.scraped_at) > new Date(latest) ? r.scraped_at : latest;
  }, null);

  return (
    <div className="min-h-full bg-[#080f10] overflow-auto">

      {/* ── HERO SECTION ──────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className={`absolute top-0 left-1/4 w-96 h-96 rounded-full blur-[120px] opacity-20 transition-colors duration-1000 ${anyGood ? 'bg-emerald-500' : 'bg-teal-700'}`} />
          <div className="absolute top-0 right-1/4 w-72 h-72 rounded-full blur-[100px] opacity-10 bg-[#FACC15]" />
        </div>

        <div className="relative max-w-4xl mx-auto px-5 pt-8 pb-6 md:pt-12 md:pb-8">
          {/* Top row */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center border transition-all duration-500 ${
                anyGood ? 'bg-emerald-500/20 border-emerald-500/40' : 'bg-teal-500/10 border-teal-500/20'
              }`}>
                <GraduationCap className={`w-6 h-6 md:w-7 md:h-7 ${anyGood ? 'text-emerald-400' : 'text-teal-400'}`} />
              </div>
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <h1 className="text-2xl md:text-3xl font-black text-white tracking-tighter">CMA US</h1>
                  {/* Live indicator */}
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest transition-all ${
                    isLive ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-white/30'
                  }`}>
                    {isLive
                      ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Live</>
                      : <><WifiOff className="w-3 h-3" />Offline</>
                    }
                  </div>
                </div>
                <p className="text-[11px] text-white/40 uppercase tracking-[0.2em]">
                  Prometric Seat Availability · Kerala Centers
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canEdit && (
                <a
                  href="https://proscheduler.prometric.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden md:flex items-center gap-1.5 px-3 py-2 bg-white/5 border border-white/10 text-white/40 text-xs font-bold rounded-xl hover:border-teal-500/30 hover:text-teal-400 transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Prometric
                </a>
              )}
              <button
                onClick={fetchData}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-2 bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-bold rounded-xl hover:bg-teal-500/20 disabled:opacity-40 transition-all uppercase tracking-wider"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

          {/* ── STATS BAND ───────────────────────────────────────────────── */}
          {!loading && records.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-2">
              {[
                { label: 'Available', count: available, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
                { label: 'Limited',   count: limited,   color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
                { label: 'No Slots',  count: full,      color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20' },
              ].map(s => (
                <div key={s.label} className={`${s.bg} border ${s.border} rounded-2xl p-3 md:p-4 text-center`}>
                  <p className={`text-3xl md:text-4xl font-black ${s.color} leading-none`}>{s.count}</p>
                  <p className="text-[9px] md:text-[10px] text-white/30 uppercase tracking-widest mt-1.5">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Exam window tag + scrape info */}
          <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FACC15]/10 border border-[#FACC15]/20 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FACC15]" />
                <span className="text-[10px] font-bold text-[#FACC15] uppercase tracking-widest">May – Jun 2026</span>
              </div>
              <span className="text-[10px] text-white/20 uppercase tracking-widest">CMA Exam Window</span>
            </div>
            {latestScrape && (
              <div className="flex items-center gap-1.5 text-[10px] text-white/20">
                <Clock className="w-3 h-3" />
                <span>Auto-scraped {relativeTime(latestScrape)} · Updates 2×/day</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── DIVIDER ──────────────────────────────────────────────────────── */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mx-5" />

      {/* ── CONTENT AREA ─────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-5 py-6 md:py-8">

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-2 border-teal-500/20 border-t-teal-400 animate-spin" />
              <GraduationCap className="w-6 h-6 text-teal-400 absolute inset-0 m-auto" />
            </div>
            <p className="text-sm text-white/30 uppercase tracking-widest">Loading availability…</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 flex items-start gap-4">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-red-300 text-sm">Failed to load data</p>
              <p className="text-xs text-red-400/70 mt-1">{error}</p>
              <button onClick={fetchData} className="text-xs text-red-300 underline underline-offset-2 mt-2">Try again</button>
            </div>
          </div>
        )}

        {/* Center cards */}
        {!loading && !error && (
          <>
            {/* Alert banner when slots are available */}
            {anyGood && (
              <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
                <TrendingUp className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <p className="text-sm font-bold text-emerald-300">Seats are available — book on Prometric now!</p>
                <a
                  href="https://proscheduler.prometric.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto flex items-center gap-1 text-[11px] text-emerald-400 underline underline-offset-2 whitespace-nowrap"
                >
                  Book now <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CENTERS.map(center => (
                <CenterCard
                  key={center.id}
                  center={center}
                  records={records.filter(r => r.center_id === center.id)}
                  canEdit={canEdit}
                  onUpdated={fetchData}
                />
              ))}
            </div>

            {/* Admin hint */}
            {canEdit && (
              <div className="mt-5 flex items-center gap-2.5 px-4 py-3 bg-white/[0.03] border border-white/8 rounded-2xl">
                <Info className="w-4 h-4 text-white/20 flex-shrink-0" />
                <p className="text-xs text-white/30">
                  Tap the <span className="font-bold text-white/40">pencil</span> on any row to manually override the scraped status.
                </p>
                <a
                  href="https://proscheduler.prometric.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto flex items-center gap-1 text-[10px] text-white/20 hover:text-teal-400 transition-colors whitespace-nowrap"
                >
                  Prometric <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Explanation */}
            <div className="mt-6 p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
              <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.25em] mb-3">About This Data</p>
              <div className="space-y-2 text-xs text-white/30 leading-relaxed">
                <p>Availability is scraped automatically from the Prometric ProScheduler portal twice daily (7:30 AM and 1:00 PM IST). Data covers the <span className="text-white/50 font-semibold">May–June 2026 CMA exam window</span> for Cochin (site 5290) and Calicut (site 4960) centers in Kerala.</p>
                <p>Part 1 = Case Based Questions + Essay. Part 2 = Case Based Questions + Essay. Both must be booked separately on Prometric.</p>
              </div>
            </div>
          </>
        )}

        {/* Footer timestamp */}
        {lastRefresh && !loading && (
          <p className="mt-6 text-center text-[10px] text-white/15 uppercase tracking-widest">
            Fetched at {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  );
}

export default CMAAvailabilityWidget;
