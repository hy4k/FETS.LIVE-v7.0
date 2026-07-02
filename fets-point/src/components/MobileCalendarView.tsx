import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  MapPin, Clock, Users
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns';

interface MobileCalendarViewProps {
  setActiveTab?: (tab: string) => void;
}

// Same client color system as desktop for consistency
const CLIENT_COLORS: Record<string, { bg: string; text: string; dot: string; badge: string; badgeText: string }> = {
  PEARSON: { bg: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6', badge: '#DBEAFE', badgeText: '#1E40AF' },
  PSI: { bg: '#FDF2F8', text: '#BE185D', dot: '#E11D48', badge: '#FCE7F3', badgeText: '#9D174D' },
  ITTS: { bg: '#FFF7ED', text: '#C2410C', dot: '#EA580C', badge: '#FFEDD5', badgeText: '#9A3412' },
  PROMETRIC: { bg: '#FFFBEB', text: '#A16207', dot: '#D4AF37', badge: '#FEF9C3', badgeText: '#854D0E' },
  CELPIP: { bg: '#FEF2F2', text: '#B91C1C', dot: '#EF4444', badge: '#FEE2E2', badgeText: '#991B1B' },
  CMA: { bg: '#ECFDF5', text: '#047857', dot: '#10B981', badge: '#D1FAE5', badgeText: '#065F46' },
  IELTS: { bg: '#EEF2FF', text: '#4338CA', dot: '#818CF8', badge: '#E0E7FF', badgeText: '#3730A3' },
  OTHER: { bg: '#F8FAFC', text: '#475569', dot: '#64748B', badge: '#F1F5F9', badgeText: '#334155' },
}

const resolveExamKind = (s: { client_name?: string; exam_name?: string }) => {
  const ex = (s.exam_name || '').toUpperCase()
  const cl = (s.client_name || '').toUpperCase()
  if (ex.includes('CELPIP') || cl.includes('CELPIP')) return 'CELPIP'
  if (ex.includes('CMA') || cl.includes('CMA')) return 'CMA'
  if (ex.includes('PEARSON') || ex.includes('VUE') || cl.includes('PEARSON') || cl.includes('VUE')) return 'PEARSON'
  if (cl.includes('PROMETRIC') || ex.includes('PROMETRIC')) return 'PROMETRIC'
  if (cl.includes('PSI') || ex.includes('PSI')) return 'PSI'
  if (cl.includes('ITTS') || ex.includes('ITTS')) return 'ITTS'
  if (cl.includes('IELTS') || ex.includes('IELTS')) return 'IELTS'
  return 'OTHER'
}

const getBadgeLabel = (s: { client_name?: string; exam_name?: string }) => {
  const k = resolveExamKind(s)
  switch (k) {
    case 'PEARSON': return 'PV'
    case 'PROMETRIC': return 'PMT'
    case 'PSI': return 'PSI'
    case 'ITTS': return 'ITTS'
    case 'CELPIP': return 'CELPIP'
    case 'CMA': return 'CMA'
    case 'IELTS': return 'IELTS'
    default: return (s.client_name || '—').trim().slice(0, 12)
  }
}

const getClientColor = (session: { client_name?: string; exam_name?: string }) =>
  CLIENT_COLORS[resolveExamKind(session)] || CLIENT_COLORS.OTHER

export function MobileCalendarView({ setActiveTab }: MobileCalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMonthSessions() {
      setLoading(true);
      try {
        const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
        const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
        const { data, error } = await supabase
          .from('calendar_sessions')
          .select('*')
          .gte('date', start)
          .lte('date', end)
          .order('start_time', { ascending: true });
        if (error) throw error;
        const mapped = (data || []).map((s: any) => {
          const clientUpper = (s.client_name || '').toUpperCase().trim();
          const examUpper = (s.exam_name || '').toUpperCase().trim();
          if (clientUpper === 'PROMETRIC') {
            if (examUpper.includes('CMA US') || examUpper.includes('CMA')) {
              return { ...s, client_name: 'CMA US' };
            }
            if (examUpper.includes('CELPIP')) {
              return { ...s, client_name: 'CELPIP' };
            }
          }
          return s;
        });
        setSessions(mapped);
      } catch (err) {
        console.error('Error fetching sessions:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchMonthSessions();
  }, [currentMonth]);

  const monthDays = useMemo(() => {
    return eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  }, [currentMonth]);

  const selectedDateSessions = useMemo(() => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return sessions
      .filter(s => s.date === dateStr)
      .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))
  }, [selectedDate, sessions]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    const next = new Date(currentMonth);
    next.setMonth(currentMonth.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentMonth(next);
    setSelectedDate(startOfMonth(next));
  };

  const getDateSessionCount = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return sessions.filter(s => s.date === dateStr).reduce((sum: number, s: any) => sum + (s.candidate_count || 0), 0);
  };

  const hasSession = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return sessions.some(s => s.date === dateStr);
  };

  const totalSelected = selectedDateSessions.reduce((sum, s) => sum + (s.candidate_count || 0), 0);

  const formatTime = (time: string) => {
    if (!time) return '';
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${m} ${ampm}`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#FAFBFD] pb-32" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>

      {/* ── HEADER ── */}
      <div className="bg-white border-b border-slate-100 px-5 pt-4 pb-3 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-extrabold text-slate-800 tracking-tight">Exam Calendar</h1>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 rounded-lg">
            <CalendarIcon size={13} className="text-amber-600" />
            <span className="text-[10px] font-bold text-amber-700">{format(currentMonth, 'MMM yyyy')}</span>
          </div>
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => navigateMonth('prev')} className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center active:scale-95">
            <ChevronLeft size={18} className="text-slate-500" />
          </button>
          <h2 className="text-sm font-extrabold text-slate-700">{format(currentMonth, 'MMMM yyyy')}</h2>
          <button onClick={() => navigateMonth('next')} className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center active:scale-95">
            <ChevronRight size={18} className="text-slate-500" />
          </button>
        </div>

        {/* Horizontal date strip */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
          {monthDays.map((date, i) => {
            const isSelected = isSameDay(date, selectedDate);
            const isCurr = isToday(date);
            const count = getDateSessionCount(date);
            const exists = hasSession(date);

            return (
              <button
                key={i}
                onClick={() => setSelectedDate(date)}
                className={`flex-none w-14 h-20 rounded-2xl flex flex-col items-center justify-between py-2 transition-all duration-200 border ${
                  isSelected
                    ? 'bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-200/80 scale-105 z-10'
                    : isCurr
                      ? 'bg-amber-50/80 border-amber-400/70 text-slate-800 shadow-sm shadow-amber-100/50'
                      : exists
                        ? 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                        : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className={`text-[9px] font-extrabold uppercase tracking-wider ${
                  isSelected ? 'text-slate-400' : isCurr ? 'text-amber-700/80' : 'text-slate-400'
                }`}>
                  {format(date, 'EEE')}
                </span>
                <span className="text-base font-black leading-none -mt-1">
                  {format(date, 'd')}
                </span>
                <div className="h-5 flex items-center justify-center">
                  {exists ? (
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black tabular-nums leading-none ${
                      isSelected 
                        ? 'bg-[#f6c810] text-slate-950'
                        : isCurr
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-200 text-slate-700'
                    }`}>
                      {count}
                    </span>
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-200/50" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── SELECTED DATE DETAILS ── */}
      <div className="px-5 mt-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-800">{format(selectedDate, 'EEEE, do MMMM')}</h3>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              {selectedDateSessions.length} session{selectedDateSessions.length !== 1 ? 's' : ''} · {totalSelected} candidate{totalSelected !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Session Cards */}
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {loading ? (
              [1, 2].map(i => (
                <div key={i} className="w-full h-24 bg-white rounded-xl border border-slate-100 animate-pulse" />
              ))
            ) : selectedDateSessions.length > 0 ? (
              selectedDateSessions.map((session: any, i: number) => {
                const c = getClientColor(session);
                return (
                  <motion.div
                    key={session.id || i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden active:scale-[0.99] transition-transform"
                  >
                    <div className="flex items-stretch">
                      {/* Color strip */}
                      <div className="w-1.5 shrink-0" style={{ backgroundColor: c.dot }} />

                      <div className="flex-1 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            {/* Client badge */}
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold mb-1.5 tracking-wide" style={{ backgroundColor: c.badge, color: c.badgeText }}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.dot }} />
                              {getBadgeLabel(session)}
                            </span>
                            <p className="text-[9px] text-slate-400 font-medium truncate mb-0.5">{session.client_name}</p>
                            {/* Exam */}
                            <h4 className="text-sm font-bold text-slate-800 leading-snug truncate">{session.exam_name}</h4>
                          </div>

                          {/* Candidate count */}
                          <div className="text-right shrink-0">
                            <div className="text-xl font-extrabold" style={{ color: c.text }}>{session.candidate_count}</div>
                            <div className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">pax</div>
                          </div>
                        </div>

                        {/* Meta row */}
                        <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-slate-50 text-[11px] text-slate-500">
                          <div className="flex items-center gap-1">
                            <Clock size={12} className="text-amber-500" />
                            <span className="font-semibold">{formatTime(session.start_time)} – {formatTime(session.end_time)}</span>
                          </div>
                          {session.branch_location && (
                            <div className="flex items-center gap-1 ml-auto">
                              <MapPin size={12} className="text-slate-400" />
                              <span className="font-semibold capitalize">{session.branch_location}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-200">
                <CalendarIcon size={36} className="text-slate-200 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-400">No sessions</p>
                <p className="text-xs text-slate-300 mt-1">{format(selectedDate, 'do MMMM')} is clear</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
