import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Calendar, Plus, ChevronLeft, ChevronRight, Edit, Trash2, X, Check,
  Clock, Users, Eye, MapPin, Building, Filter, TrendingUp, Search,
  Columns, AlignJustify,
  AlertCircle, Loader2, User, ChevronDown, LayoutGrid
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { CalendarAnalysis } from './CalendarAnalysis'
import { useAuth } from '../hooks/useAuth'
import { useBranch } from '../hooks/useBranch'
import { useBranchFilter } from '../hooks/useBranchFilter'
import { useTheme } from '../hooks/useTheme'
import {
  formatDateForIST, getCurrentISTDateString,
  isToday as isTodayIST, formatDateForDisplay
} from '../utils/dateUtils'
import { validateSessionCapacity, getBranchCapacity } from '../utils/sessionUtils'
import { useCalendarSessions, useSessionMutations } from '../hooks/useCalendarSessions'
import { useClients, useClientExams } from '../hooks/useClients'
import { toast } from 'react-hot-toast'
import '../styles/calendar-enhancements.css'

// ─── Types ───────────────────────────────────────────────────────────────────
interface Session {
  id?: number
  client_name: string
  exam_name: string
  date: string
  candidate_count: number
  start_time: string
  end_time: string
  assigned_staff?: string
  user_id: string
  created_at?: string
  updated_at?: string
  branch_location?: string
  status?: string
}

type CalendarViewMode = 'month' | 'week' | 'day'

// ─── Luxury exam palette (distinct, restrained — not all gold) ─────────────
const EXAM_COLORS: Record<string, {
  bg: string; text: string; border: string; dot: string; badge: string; badgeText: string
}> = {
  PROMETRIC: {
    bg: 'var(--accent-mint-glow)', text: 'var(--accent-mint)',
    border: 'var(--border-color)', dot: 'var(--accent-mint)',
    badge: 'var(--recessed-bg)', badgeText: 'var(--accent-mint)',
  },
  PEARSON: {
    bg: 'rgba(183, 162, 128, 0.08)', text: 'var(--text-accent)',
    border: 'var(--border-color)', dot: 'var(--text-accent)',
    badge: 'var(--recessed-bg)', badgeText: 'var(--text-accent)',
  },
  PSI: {
    bg: 'rgba(183, 162, 128, 0.08)', text: 'var(--text-accent)',
    border: 'var(--border-color)', dot: 'var(--text-accent)',
    badge: 'var(--recessed-bg)', badgeText: 'var(--text-accent)',
  },
  CELPIP: {
    bg: 'var(--accent-mint-glow)', text: 'var(--accent-mint)',
    border: 'var(--border-color)', dot: 'var(--accent-mint)',
    badge: 'var(--recessed-bg)', badgeText: 'var(--accent-mint)',
  },
  CMA: {
    bg: 'rgba(140, 161, 151, 0.08)', text: 'var(--text-secondary)',
    border: 'var(--border-color)', dot: 'var(--text-secondary)',
    badge: 'var(--recessed-bg)', badgeText: 'var(--text-secondary)',
  },
  ITTS: {
    bg: 'rgba(183, 162, 128, 0.08)', text: 'var(--text-accent)',
    border: 'var(--border-color)', dot: 'var(--text-accent)',
    badge: 'var(--recessed-bg)', badgeText: 'var(--text-accent)',
  },
  IELTS: {
    bg: 'var(--accent-mint-glow)', text: 'var(--accent-mint)',
    border: 'var(--border-color)', dot: 'var(--accent-mint)',
    badge: 'var(--recessed-bg)', badgeText: 'var(--accent-mint)',
  },
  OTHER: {
    bg: 'rgba(140, 161, 151, 0.05)', text: 'var(--text-secondary)',
    border: 'var(--border-color)', dot: 'var(--text-secondary)',
    badge: 'var(--recessed-bg)', badgeText: 'var(--text-secondary)',
  },
}

type ExamKind = keyof typeof EXAM_COLORS

const KIND_SECTION_LABEL: Record<ExamKind, string> = {
  PROMETRIC: 'CMA US (PRO)',
  PEARSON: 'Pearson VUE (VUE)',
  PSI: 'PSI',
  CELPIP: 'CELPIP (CEL)',
  CMA: 'CMA',
  ITTS: 'ITTS',
  IELTS: 'IELTS',
  OTHER: 'Other',
}

/** Uses exam title + client so CMA / CELPIP / Paragon-hosted exams don’t all read as “Prometric”. */
const resolveExamKind = (s: Pick<Session, 'client_name' | 'exam_name'>): ExamKind => {
  const ex = (s.exam_name || '').toUpperCase().trim()
  const cl = (s.client_name || '').toUpperCase().trim()

  // 1. CELPIP: only for CELPIP, seen as CEL
  if (ex.includes('CELPIP') || cl.includes('CELPIP') || ex.includes('CEL') || cl.includes('CEL')) {
    return 'CELPIP'
  }

  // 2. Prometric / PRO: only used for CMA US exam
  if (ex.includes('CMA') || cl.includes('CMA') || ex.includes('IMA') || cl.includes('IMA')) {
    return 'PROMETRIC'
  }

  // 3. PSI
  if (cl.includes('PSI') || ex.includes('PSI')) {
    return 'PSI'
  }

  // 4. Default: all rest of the exams are Pearson VUE
  return 'PEARSON'
}

const groupSessionsByKind = (list: Session[]) => {
  const order: ExamKind[] = ['PROMETRIC', 'PEARSON', 'PSI', 'CELPIP', 'CMA', 'ITTS', 'IELTS', 'OTHER']
  const byKind = new Map<ExamKind, Session[]>()
  order.forEach(k => byKind.set(k, []))
  list.forEach(s => {
    const k = resolveExamKind(s)
    byKind.get(k)!.push(s)
  })
  order.forEach(k => {
    byKind.get(k)!.sort((a, b) => a.start_time.localeCompare(b.start_time))
  })
  return order.map(k => ({ kind: k, sessions: byKind.get(k)! })).filter(g => g.sessions.length > 0)
}

const getExamColor = (kind: ExamKind) => EXAM_COLORS[kind] ?? EXAM_COLORS.OTHER

/** Cell / pill label: PV, PMT (not PRO), full CELPIP, PSI, ITTS, etc. */
const getClientBadgeLabel = (s: Pick<Session, 'client_name' | 'exam_name'>) => {
  const k = resolveExamKind(s)
  switch (k) {
    case 'PEARSON': return 'VUE'
    case 'PROMETRIC': return 'PRO'
    case 'PSI': return 'PSI'
    case 'CELPIP': return 'CEL'
    default: return 'VUE'
  }
}

const normalizeClientName = (name: string): ExamKind => {
  const u = (name || '').toUpperCase().trim()
  if (u.includes('CELPIP') || u.includes('CEL')) return 'CELPIP'
  if (u.includes('CMA') || u.includes('IMA')) return 'PROMETRIC'
  if (u.includes('PSI')) return 'PSI'
  return 'PEARSON'
}

const formatTime = (time: string) => {
  const [h, m] = time.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${displayHour}:${m} ${ampm}`
}

const timeToMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function FetsCalendarPremium() {
  const { isDarkMode } = useTheme()
  const { user, hasPermission } = useAuth()
  const canEdit = hasPermission('calendar_edit')
  const { activeBranch } = useBranch()
  const { applyFilter, isGlobalView } = useBranchFilter()

  // Date/View state
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  // Filter/search state
  const [searchQuery, setSearchQuery] = useState('')
  const [examTypeFilter, setExamTypeFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [editingSession, setEditingSession] = useState<Session | null>(null)
  const [expandedClient, setExpandedClient] = useState<ExamKind | null>(null)

  const [formData, setFormData] = useState({
    client_name: '', exam_name: '', date: '',
    candidate_count: 1, start_time: '09:00', end_time: '17:00', status: 'scheduled'
  })

  const { data: sessions = [], isLoading: loading, isError, error } = useCalendarSessions(
    currentDate, activeBranch, applyFilter, isGlobalView
  )
  const { data: dbClients = [] } = useClients()
  const clientsWithOptions = useMemo(() => {
    const list = [...dbClients];
    if (!list.some((c: any) => c.name === 'CMA US')) {
      list.push({ id: 'cma-us-client', name: 'CMA US', color: 'emerald' });
    }
    if (!list.some((c: any) => c.name === 'CELPIP')) {
      list.push({ id: 'celpip-client', name: 'CELPIP', color: 'rose' });
    }
    return list;
  }, [dbClients]);
  const { data: dbExams = [] } = useClientExams()
  const { addSession, updateSession, deleteSession, isMutating } = useSessionMutations()

  useEffect(() => {
    if (isError) toast.error(`Failed to load sessions: ${(error as Error).message}`)
  }, [isError, error])

  // ── Computed ──────────────────────────────────────────────────────────────
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const match = s.client_name.toLowerCase().includes(q) ||
          s.exam_name.toLowerCase().includes(q) ||
          String(s.id || '').includes(q)
        if (!match) return false
      }
      if (examTypeFilter !== 'all' && resolveExamKind(s) !== examTypeFilter) return false
      return true
    })
  }, [sessions, searchQuery, examTypeFilter])

  const getSessionsForDate = useCallback((date: Date) => {
    const dateStr = formatDateForIST(date)
    return filteredSessions.filter(s => s.date === dateStr)
  }, [filteredSessions])

  const getAllSessionsForDate = useCallback((date: Date) => {
    const dateStr = formatDateForIST(date)
    return sessions.filter(s => s.date === dateStr)
  }, [sessions])

  // ── Month navigation ──────────────────────────────────────────────────────
  const getDaysInMonth = useCallback(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days: (Date | null)[] = []
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d))
    return days
  }, [currentDate])

  // ── Week helpers ──────────────────────────────────────────────────────────
  const getWeekDays = useCallback(() => {
    const d = new Date(currentDate)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Mon start
    d.setDate(diff)
    return Array.from({ length: 7 }, (_, i) => {
      const dd = new Date(d)
      dd.setDate(d.getDate() + i)
      return dd
    })
  }, [currentDate])

  // ── Navigation ────────────────────────────────────────────────────────────
  const navigate = (dir: 'prev' | 'next') => {
    const d = new Date(currentDate)
    const delta = dir === 'next' ? 1 : -1
    if (viewMode === 'month') d.setMonth(d.getMonth() + delta)
    else if (viewMode === 'week') d.setDate(d.getDate() + delta * 7)
    else d.setDate(d.getDate() + delta)
    setCurrentDate(d)
  }

  const getHeaderTitle = () => {
    if (viewMode === 'month')
      return currentDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })
    if (viewMode === 'week') {
      const wk = getWeekDays()
      const start = wk[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      const end = wk[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      return `${start} – ${end}`
    }
    return currentDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })
  }

  // ── Modals ────────────────────────────────────────────────────────────────
  const openModal = (date?: Date, session?: Session) => {
    if (session) {
      setEditingSession(session)
      // Case-insensitive match against dropdown options so edit form pre-selects correctly
      const matchedClient = clientsWithOptions.find((c: any) =>
        c.name.toUpperCase().trim() === session.client_name.toUpperCase().trim()
      )
      const matchedClientName = matchedClient?.name || session.client_name
      const matchedExams = matchedClient ? dbExams.filter((e: any) => e.client_id === matchedClient.id) : []
      const matchedExam = matchedExams.find((e: any) =>
        e.name.toUpperCase().trim() === session.exam_name.toUpperCase().trim()
      )
      setFormData({
        client_name: matchedClientName, exam_name: matchedExam?.name || session.exam_name,
        date: session.date, candidate_count: session.candidate_count,
        start_time: session.start_time, end_time: session.end_time,
        status: session.status || 'scheduled'
      })
    } else {
      setEditingSession(null)
      const dateStr = date ? formatDateForIST(date) : getCurrentISTDateString()
      setFormData({ client_name: '', exam_name: '', date: dateStr, candidate_count: 1, start_time: '09:00', end_time: '17:00', status: 'scheduled' })
    }
    setShowModal(true)
  }

  const openDetailsModal = (date: Date) => {
    const ds = getSessionsForDate(date)
    if (ds.length > 0) { setSelectedDate(date); setShowDetailsModal(true) }
    else if (canEdit) openModal(date)
  }

  const closeModal = () => {
    setShowModal(false); setShowDetailsModal(false)
    setEditingSession(null); setSelectedDate(null); setExpandedClient(null)
    setFormData({ client_name: '', exam_name: '', date: '', candidate_count: 1, start_time: '09:00', end_time: '17:00', status: 'scheduled' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const cap = validateSessionCapacity(formData.candidate_count, activeBranch)
    if (!cap.isValid) { toast.error(cap.error!); return }
    if (cap.warning) toast(cap.warning, { icon: '⚠️' })
    try {
      if (activeBranch === 'global') { toast.error('Select a centre to add/edit sessions.'); return }
      
      let clientName = formData.client_name;
      const examNameUpper = formData.exam_name.toUpperCase().trim();
      const clientNameUpper = clientName.toUpperCase().trim();
      
      if (examNameUpper.includes('CELPIP') || clientNameUpper.includes('CELPIP') || examNameUpper.includes('CEL') || clientNameUpper.includes('CEL')) {
        clientName = 'CELPIP';
      } else if (examNameUpper.includes('CMA') || clientNameUpper.includes('CMA') || examNameUpper.includes('IMA') || clientNameUpper.includes('IMA')) {
        clientName = 'CMA US';
      } else if (clientNameUpper.includes('PSI') || examNameUpper.includes('PSI')) {
        clientName = 'PSI';
      } else {
        clientName = 'PEARSON VUE';
      }

      const data: any = { 
        ...formData, 
        client_name: clientName,
        user_id: user.id, 
        updated_at: new Date().toISOString(), 
        branch_location: activeBranch 
      }
      if (editingSession?.id) await updateSession({ ...data, id: editingSession.id })
      else await addSession({ ...data, created_at: new Date().toISOString() })
      closeModal()
    } catch (err) { console.error(err) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this session?')) return
    await deleteSession(id)
    if (selectedDate) {
      const rem = sessions.filter(s => s.date === formatDateForIST(selectedDate) && s.id !== id)
      if (rem.length === 0) setShowDetailsModal(false)
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: sessions.reduce((s, x) => s + x.candidate_count, 0),
    totalSessions: sessions.length,
    uniqueClients: new Set(sessions.map(s => resolveExamKind(s))).size
  }), [sessions])

  const days = useMemo(() => getDaysInMonth(), [getDaysInMonth])
  const isToday = (d: Date | null) => d ? isTodayIST(d) : false
  const HOURS = Array.from({ length: 14 }, (_, i) => i + 7) // 7am–8pm

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER HELPERS
  // ─────────────────────────────────────────────────────────────────────────
  const SessionPill = ({ session }: { session: Session }) => {
    const kind = resolveExamKind(session)
    const c = getExamColor(kind)
    return (
      <div
        className="flex items-center gap-1 px-1.5 py-[3px] rounded-md border text-[10px] leading-tight transition-all hover:opacity-90 cursor-pointer shadow-sm"
        style={{ backgroundColor: c.bg, borderColor: c.border, color: c.badgeText }}
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0 ring-1 ring-white/10" style={{ backgroundColor: c.dot }} />
        <span className="font-bold truncate flex-1 tracking-tight">{getClientBadgeLabel(session)}</span>
        <span className="font-extrabold tabular-nums opacity-90">{session.candidate_count}</span>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MONTH VIEW
  // ─────────────────────────────────────────────────────────────────────────
  const MonthView = () => (
    <div className="rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-2xl bg-[var(--card-bg)]">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-[var(--border-color)] bg-[var(--recessed-bg)]">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
          <div key={day} className={`py-3 text-center text-[11px] font-bold uppercase tracking-widest ${i === 0 || i === 6 ? 'text-[var(--text-secondary)]/50' : 'text-[var(--text-secondary)]/80'}`}>
            {day}
          </div>
        ))}
      </div>
      {/* Grid */}
      <div className="grid grid-cols-7">
        {days.map((date, idx) => {
          if (!date) return (
            <div key={idx} className="min-h-[175px] bg-[var(--recessed-bg)]/30 border-b border-r border-[var(--border-color)]/30" />
          )
          const ds = getSessionsForDate(date)
          const allDs = getAllSessionsForDate(date)
          const total = ds.reduce((s, x) => s + x.candidate_count, 0)
          const isCurrentDay = isToday(date)
          const isWeekend = date.getDay() === 0 || date.getDay() === 6
          
          // Group by resolved exam kind
          const groups: Record<string, { count: number; kind: ExamKind }> = {}
          ds.forEach(s => {
            const k = resolveExamKind(s)
            if (!groups[k]) groups[k] = { count: 0, kind: k }
            groups[k].count += s.candidate_count
          })
          const entries = Object.entries(groups).sort((a, b) => {
            const order: ExamKind[] = ['PROMETRIC', 'PEARSON', 'PSI', 'CELPIP', 'CMA', 'ITTS', 'IELTS', 'OTHER']
            return order.indexOf(a[1].kind) - order.indexOf(b[1].kind)
          })

          const capacity = activeBranch === 'global' ? 100 : getBranchCapacity(activeBranch)
          const isOverloaded = total >= capacity * 1.5
          const isPeak = total >= capacity * 0.8

          // SVG progress gauge constants
          const radius = 14
          const circumference = 2 * Math.PI * radius // ~87.96
          const pct = Math.min(total / capacity, 1.5)
          const strokeDashoffset = circumference - (pct * circumference)
          const gaugeColor = isOverloaded 
            ? '#ef4444' // Red
            : isPeak 
            ? 'var(--accent-mint)' // Bronze
            : total > 0
            ? 'var(--text-accent)' // Sand
            : 'transparent'

          const DateGauge = () => {
            const displayDate = date.getDate()
            if (total === 0) {
              return (
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-extrabold transition-colors duration-200
                  ${isCurrentDay
                    ? 'bg-[var(--accent-mint)] text-white font-black shadow-[0_0_12px_rgba(177,119,41,0.35)]'
                    : isWeekend
                    ? 'text-[var(--text-secondary)]/50 group-hover:text-[var(--accent-mint)]'
                    : 'text-[var(--text-primary)]/80 group-hover:text-[var(--accent-mint)]'
                  }`}
                >
                  {displayDate}
                </span>
              )
            }

            return (
              <div className="relative w-9 h-9 flex items-center justify-center shrink-0 select-none">
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                  {/* Track */}
                  <circle
                    cx="18"
                    cy="18"
                    r={radius}
                    fill="transparent"
                    stroke="var(--border-color)"
                    strokeWidth="2"
                  />
                  {/* Progress */}
                  <motion.circle
                    cx="18"
                    cy="18"
                    r={radius}
                    fill="transparent"
                    stroke={gaugeColor}
                    strokeWidth="2.5"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: strokeDashoffset }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    strokeLinecap="round"
                    style={{
                      filter: total > 0 ? `drop-shadow(0 0 4px ${gaugeColor}44)` : 'none'
                    }}
                  />
                </svg>
                {/* Date text inside */}
                <span className={`text-[13px] font-black tracking-tight leading-none z-10 transition-colors duration-200
                  ${isCurrentDay ? 'text-[var(--accent-mint)]' : 'text-[var(--text-primary)] group-hover:text-[var(--accent-mint)]'}`}
                >
                  {displayDate}
                </span>
              </div>
            )
          }

          // Stacked progress bar representing proportions of exam kinds
          const examProportions = entries.map(([_, stat]) => {
            const propPct = (stat.count / total) * 100
            return {
              kind: stat.kind,
              pct: propPct,
              count: stat.count,
              color: getExamColor(stat.kind).dot
            }
          })

          return (
            <div
              key={idx}
              onClick={() => openDetailsModal(date)}
              className={`
                month-day-cell-premium cursor-pointer relative group overflow-hidden flex flex-col justify-between
                ${isCurrentDay ? 'today' : ''}
                ${isWeekend ? 'weekend' : ''}
              `}
            >
              <div>
                {/* Micro-progress bar for capacity utilization */}
                {total > 0 && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--recessed-bg)] overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        isOverloaded 
                          ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' 
                          : isPeak 
                          ? 'bg-[var(--accent-mint)] shadow-[0_0_8px_var(--accent-mint)]' 
                          : 'bg-[var(--text-accent)] shadow-[0_0_8px_var(--text-accent)]'
                      }`}
                      style={{ width: `${Math.min((total / capacity) * 100, 100)}%` }}
                    />
                  </div>
                )}

                {/* Date number & dynamic badges */}
                <div className="flex items-center justify-between mb-3 mt-1">
                  <DateGauge />
                  
                  {total > 0 && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Session count pill */}
                      <span 
                        className="text-[9px] font-black text-[var(--text-secondary)] bg-[var(--recessed-bg)] px-1.5 py-0.5 rounded border border-[var(--border-color)] uppercase tracking-wider leading-none"
                        title={`${ds.length} session${ds.length > 1 ? 's' : ''}`}
                      >
                        {ds.length}s
                      </span>
                    </div>
                  )}
                </div>

                {/* Session List */}
                <div className="space-y-1 mt-2">
                  {entries.slice(0, 3).map(([key, stat]) => {
                    const label = getClientBadgeLabel({ client_name: stat.kind, exam_name: '' })
                    return (
                      <div 
                        key={key} 
                        className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-secondary)] py-1 border-b border-[var(--border-color)]/20 last:border-b-0"
                      >
                        <span className="truncate tracking-wide uppercase text-[var(--text-primary)] font-bold">{label}</span>
                        <span className="tabular-nums font-extrabold text-[var(--accent-mint)]">{stat.count} PAX</span>
                      </div>
                    )
                  })}
                  {entries.length > 3 && (
                    <div className="text-[9px] text-[var(--text-secondary)] opacity-80 font-bold pl-1 pt-1 uppercase tracking-wider">+{entries.length - 3} more clients</div>
                  )}
                  {allDs.length > ds.length && (
                    <div className="text-[9px] text-[var(--accent-mint)]/70 font-bold pl-1 pt-0.5 uppercase tracking-wider">+{allDs.length - ds.length} filtered</div>
                  )}
                </div>
              </div>

              {/* Bottom footer showing total candidates count strictly at the bottom */}
              {total > 0 && (
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-[var(--border-color)]/30 text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider z-10">
                  <span className="flex items-center gap-1 text-[var(--accent-mint)]">
                    <Users size={10} />
                    <span>{total} PAX</span>
                  </span>
                  <span>{ds.length} sessions</span>
                </div>
              )}

              {/* Stacked Exam Mix Ribbon at the bottom */}
              {total > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-1.5 flex bg-[var(--recessed-bg)]/20 overflow-hidden">
                  {examProportions.map((prop, idx) => (
                    <div
                      key={idx}
                      className="h-full first:rounded-l-sm last:rounded-r-sm transition-all duration-300"
                      style={{
                        width: `${prop.pct}%`,
                        backgroundColor: prop.color,
                        boxShadow: `inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 0 6px ${prop.color}88`
                      }}
                      title={`${prop.kind}: ${prop.count} candidates (${Math.round(prop.pct)}%)`}
                    />
                  ))}
                </div>
              )}

              {/* Hover hint */}
              <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <Eye size={12} className="text-[var(--text-secondary)] opacity-80" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // WEEK VIEW
  // ─────────────────────────────────────────────────────────────────────────
  const WeekView = () => {
    const weekDays = getWeekDays()
    return (
      <div className="rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-2xl bg-[var(--card-bg)]">
        {/* Header row */}
        <div className="grid border-b border-[var(--border-color)] bg-[var(--recessed-bg)]"
          style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
          <div className="py-3 border-r border-[var(--border-color)]" />
          {weekDays.map((d, i) => {
            const isCur = isToday(d)
            const isWknd = d.getDay() === 0 || d.getDay() === 6
            return (
              <div key={i} className={`py-3 text-center border-r border-[var(--border-color)] last:border-r-0
                ${isWknd ? 'opacity-50' : ''}`}>
                <div className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                  {d.toLocaleDateString('en', { weekday: 'short' })}
                </div>
                <div className={`text-lg font-black mt-1 mx-auto w-8 h-8 flex items-center justify-center rounded-full
                  ${isCur
                    ? 'bg-[var(--accent-mint)] text-white shadow-[0_0_15px_var(--accent-mint-glow)]'
                    : 'text-[var(--text-primary)]/80'}`}>
                  {d.getDate()}
                </div>
              </div>
            )
          })}
        </div>
        {/* Time slots */}
        <div className="overflow-y-auto max-h-[600px] custom-scrollbar">
          {HOURS.map(hour => (
            <div key={hour} className="grid border-b border-[var(--border-color)]/30"
              style={{ gridTemplateColumns: '60px repeat(7, 1fr)', minHeight: '75px' }}>
              <div className="py-2 px-2 text-right border-r border-[var(--border-color)] bg-[var(--recessed-bg)]/30">
                <span className="text-[10px] text-[var(--text-secondary)]/70 font-bold uppercase tracking-wider">
                  {hour > 12 ? `${hour - 12}` : hour}{hour >= 12 ? 'PM' : 'AM'}
                </span>
              </div>
              {weekDays.map((d, i) => {
                const ds = getSessionsForDate(d).filter(s => {
                  const startH = parseInt(s.start_time.split(':')[0])
                  return startH === hour
                })
                return (
                  <div key={i}
                    className={`p-1.5 border-r border-[var(--border-color)]/30 last:border-r-0 cursor-pointer
                      ${isToday(d) ? 'bg-[var(--accent-mint)]/5' : (d.getDay() === 0 || d.getDay() === 6) ? 'bg-[var(--recessed-bg)]/30' : 'bg-transparent'}
                      hover:bg-[var(--recessed-bg)]/40 transition-colors duration-300`}
                    onClick={() => canEdit && ds.length === 0 && openModal(d)}
                  >
                    {ds.map(s => {
                      const c = getExamColor(resolveExamKind(s))
                      return (
                        <div
                          key={s.id}
                          onClick={e => { e.stopPropagation(); setSelectedDate(d); setShowDetailsModal(true) }}
                          className="px-2.5 py-3 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] hover:bg-[var(--recessed-bg)] transition-all shadow-sm hover:shadow-md relative pl-3 overflow-hidden mb-2 group"
                        >
                          {/* Soft Left Accent indicator */}
                          <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: c.dot }} />
                          
                          <div className="flex items-start gap-2">
                            {/* Initials circle badge (like in the reference image) */}
                            <div 
                              className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 border"
                              style={{ backgroundColor: c.bg, borderColor: c.border, color: c.text }}
                            >
                              {getClientBadgeLabel(s).slice(0, 2)}
                            </div>
                            
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-[11px] text-[var(--text-primary)] truncate group-hover:text-[var(--accent-mint)] transition-colors leading-tight">
                                {s.exam_name}
                              </div>
                              <div className="text-[9px] text-[var(--text-secondary)] font-bold truncate mt-0.5">
                                {s.client_name}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[var(--border-color)]/20">
                            <div className="text-[9px] text-[var(--text-secondary)] font-semibold flex items-center gap-1">
                              <Clock size={9} className="text-[var(--text-accent)] shrink-0" />
                              {formatTime(s.start_time).replace(' AM', 'AM').replace(' PM', 'PM')}
                            </div>
                            <div className="text-[10px] text-[var(--accent-mint)] font-black flex items-center gap-1">
                              <Users size={9} className="shrink-0" />
                              {s.candidate_count} PAX
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DAY VIEW
  // ─────────────────────────────────────────────────────────────────────────
  const DayView = () => {
    const dayStr = formatDateForIST(currentDate)
    const daySessions = filteredSessions
      .filter(s => s.date === dayStr)
      .sort((a, b) => {
        const t = a.start_time.localeCompare(b.start_time)
        if (t !== 0) return t
        const k = resolveExamKind(a).localeCompare(resolveExamKind(b))
        if (k !== 0) return k
        return (a.exam_name || '').localeCompare(b.exam_name || '')
      })
    const DAY_HOURS = Array.from({ length: 16 }, (_, i) => i + 6) // 6am–9pm

    return (
      <div className="rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-2xl bg-[var(--card-bg)]">
        {/* Day header */}
        <div className="px-6 py-5 bg-[var(--recessed-bg)] border-b border-[var(--border-color)] flex items-center justify-between">
          <div>
            <h3 className={`text-2xl font-black tracking-tight ${isToday(currentDate) ? 'text-[var(--accent-mint)]' : 'text-[var(--text-primary)]'}`}>
              {currentDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' })}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1 font-medium tracking-wide uppercase">
              {daySessions.length} sessions <span className="mx-1.5 text-[var(--border-color)]">•</span> {daySessions.reduce((s, x) => s + x.candidate_count, 0)} candidates
            </p>
          </div>
          {canEdit && (
            <button onClick={() => openModal(currentDate)}
              className="px-4 py-2.5 text-xs font-bold bg-[var(--accent-mint)] text-white rounded-lg hover:bg-[var(--accent-mint-hover)] transition-all flex items-center gap-2 shadow-[0_0_15px_var(--accent-mint-glow)]">
              <Plus size={14} /> ADD SESSION
            </button>
          )}
        </div>
        {/* Timeline */}
        <div className="flex overflow-y-auto max-h-[600px] custom-scrollbar">
          {/* Hour labels */}
          <div className="w-20 flex-shrink-0 border-r border-[var(--border-color)] bg-[var(--recessed-bg)]/30">
            {DAY_HOURS.map(h => (
              <div key={h} className="h-[70px] flex items-start justify-end pr-4 pt-2 border-b border-[var(--border-color)]/30">
                <span className="text-[10px] text-[var(--text-secondary)]/50 font-bold uppercase tracking-widest">
                  {h > 12 ? `${h - 12} PM` : h === 12 ? '12 PM' : `${h} AM`}
                </span>
              </div>
            ))}
          </div>
          {/* Sessions column */}
          <div className="flex-1 relative bg-[var(--card-bg)]">
            {DAY_HOURS.map(h => (
              <div key={h} className="h-[70px] border-b border-[var(--border-color)]/20 hover:bg-[var(--recessed-bg)]/20 transition-colors duration-300" />
            ))}
            {/* Session blocks */}
            {daySessions.map(s => {
              const startMins = timeToMinutes(s.start_time)
              const endMins = timeToMinutes(s.end_time)
              const topOffset = (startMins - 6 * 60) * (70 / 60) // px per hour = 70
              const height = Math.max((endMins - startMins) * (70 / 60), 45)
              const c = getExamColor(resolveExamKind(s))
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="absolute left-3 right-3 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] cursor-pointer hover:bg-[var(--recessed-bg)] transition-all shadow-md hover:shadow-lg overflow-hidden group"
                  style={{
                    top: `${topOffset}px`,
                    height: `${height}px`,
                  }}
                  onClick={() => { setSelectedDate(currentDate); setShowDetailsModal(true) }}
                >
                  {/* Left Accent indicator */}
                  <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: c.dot }} />
                  
                  <div className="pl-5 pr-4 py-3 h-full flex flex-col justify-between">
                    <div className="flex items-start gap-3">
                      {/* Initials circle badge */}
                      <div 
                        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0 border"
                        style={{ backgroundColor: c.bg, borderColor: c.border, color: c.text }}
                      >
                        {getClientBadgeLabel(s).slice(0, 3)}
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-[var(--text-primary)] line-clamp-1 leading-snug group-hover:text-[var(--accent-mint)] transition-colors">
                          {s.exam_name}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)] font-semibold truncate mt-0.5">
                          {s.client_name}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 pb-1.5 border-t border-[var(--border-color)]/20 pt-2 mt-2">
                      <span className="text-xs flex items-center gap-1.5 font-bold tracking-wider text-[var(--text-secondary)]">
                        <Clock size={12} className="text-[var(--text-accent)]" />
                        {formatTime(s.start_time)} – {formatTime(s.end_time)}
                      </span>
                      <span className="text-xs flex items-center gap-1.5 font-black tracking-wider text-[var(--accent-mint)]">
                        <Users size={12} className="text-[var(--text-accent)]" />
                        {s.candidate_count} PAX
                      </span>
                      {(s as any).assigned_staff && (
                        <span className="text-xs flex items-center gap-1.5 font-semibold tracking-wider text-[var(--text-secondary)]">
                          <User size={12} className="text-[var(--text-accent)]" />
                          {(s as any).assigned_staff}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LOADING STATE
  // ─────────────────────────────────────────────────────────────────────────
  if (loading) return (
    <div data-theme={isDarkMode ? 'dark' : 'light'} className="fets-calendar-standalone-mint flex items-center justify-center min-h-screen bg-[var(--page-bg)]">
      <div className="bg-[var(--card-bg)] p-8 rounded-2xl border border-[var(--border-color)] flex flex-col items-center gap-4 shadow-2xl text-[var(--text-primary)]">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-[var(--border-color)]" />
          <div className="absolute inset-0 rounded-full border-2 border-t-[var(--accent-mint)] animate-spin" />
        </div>
        <p className="text-[var(--text-secondary)] text-sm font-medium">Loading calendar…</p>
      </div>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div data-theme={isDarkMode ? 'dark' : 'light'} className="min-h-screen fets-calendar-standalone-mint sovereign-theme" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6">

        {/* ── HEADER (aligned with FETS LIVE: title | centre selector | stats) ── */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-12 gap-8 mt-24">
          <div className="relative">
            <div className="flex items-center gap-4 mb-3">
              <div className="h-[1px] w-12 bg-[var(--accent-mint)]" />
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[var(--accent-mint)]">
                Calendar Operations {activeBranch !== 'global' && `// ${activeBranch.toUpperCase()}`}
              </span>
            </div>
            <div className="text-6xl md:text-8xl font-black text-[var(--accent-mint)] tracking-tighter leading-none" role="heading" aria-level={1}>
              FETS CALENDAR
            </div>
            <div className="mt-2 text-[var(--text-accent)] text-[10px] tracking-[0.3em] uppercase font-medium">
              {getHeaderTitle()}
            </div>
          </div>

          <div className="hidden lg:block lg:flex-1" />

          <div className="flex items-center gap-3 flex-wrap justify-end w-full lg:w-auto">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--recessed-bg)] border border-[var(--border-color)] text-[var(--accent-mint)] rounded-lg text-xs font-bold">
              <Users size={12} />{stats.total} candidates
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--recessed-bg)] border border-[var(--border-color)] text-[var(--accent-mint)] rounded-lg text-xs font-bold">
              <Calendar size={12} />{stats.totalSessions} sessions
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--recessed-bg)] border border-[var(--border-color)] text-[var(--accent-mint)] rounded-lg text-xs font-bold">
              <Building size={12} />{stats.uniqueClients} clients
            </div>
          </div>
        </div>

        {/* ── TOOLBAR ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5 bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] px-4 py-3">
          <div className="flex items-center gap-3 flex-wrap">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-[var(--recessed-bg)] rounded-lg border border-[var(--border-color)] p-0.5">
              {([
                { mode: 'month' as CalendarViewMode, icon: <LayoutGrid size={14} />, label: 'Month' },
                { mode: 'day'   as CalendarViewMode, icon: <AlignJustify size={14} />, label: 'Day' },
                { mode: 'week'  as CalendarViewMode, icon: <Columns size={14} />,   label: 'Week' },
              ]).map(({ mode, icon, label }) => (
                <button key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${viewMode === mode
                    ? 'bg-[var(--accent-mint)] text-white shadow'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                  {icon} {label}
                </button>
              ))}
            </div>

            {/* Month/Week/Day Navigation */}
            <div className="flex items-center bg-[var(--recessed-bg)] rounded-lg border border-[var(--border-color)]">
              <button onClick={() => navigate('prev')} className="p-2.5 hover:bg-[var(--card-bg)] rounded-l-lg transition-colors">
                <ChevronLeft size={16} className="text-[var(--text-secondary)]" />
              </button>
              <span className="px-4 text-sm font-bold text-[var(--text-primary)] min-w-[160px] text-center">{getHeaderTitle()}</span>
              <button onClick={() => navigate('next')} className="p-2.5 hover:bg-[var(--card-bg)] rounded-r-lg transition-colors">
                <ChevronRight size={16} className="text-[var(--text-secondary)]" />
              </button>
            </div>
            <button onClick={() => setCurrentDate(new Date())}
              className="px-4 py-2.5 text-sm font-bold text-[var(--text-secondary)] bg-[var(--recessed-bg)] border border-[var(--border-color)] rounded-lg hover:border-[var(--accent-mint)] hover:text-[var(--accent-mint)] transition-colors">
              Today
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search sessions…"
                className="pl-9 pr-3 py-2.5 bg-[var(--recessed-bg)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--accent-mint)] w-40 md:w-48 transition-all"
              />
            </div>

            {/* Exam Type Dropdown */}
            <div className="relative hidden md:block">
              <select 
                value={examTypeFilter} 
                onChange={e => setExamTypeFilter(e.target.value)}
                className="pl-3 pr-8 py-2.5 bg-[var(--recessed-bg)] border border-[var(--border-color)] rounded-lg text-sm font-bold text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-mint)] transition-all appearance-none"
              >
                <option value="all">All Clients</option>
                {Object.keys(EXAM_COLORS).filter(k => k !== 'OTHER').map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none" />
            </div>

            {/* Advanced Filters */}
            <div className="relative">
              <button onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg border transition-colors ${showFilters ? 'bg-[var(--accent-mint)]/10 border-[var(--accent-mint)]/40 text-[var(--accent-mint)]' : 'bg-[var(--recessed-bg)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                <Filter size={14} />
              </button>
              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.97 }}
                    className="absolute right-0 mt-2 w-64 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl shadow-2xl z-30 p-4"
                  >
                    <p className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Filters</p>
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Exam Type</label>
                        <select value={examTypeFilter} onChange={e => setExamTypeFilter(e.target.value)}
                          className="mt-1 w-full px-2 py-1.5 bg-[var(--recessed-bg)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none">
                          <option value="all">All Types</option>
                          {Object.keys(EXAM_COLORS).filter(k => k !== 'OTHER').map(k => (
                            <option key={k} value={k}>{k}</option>
                          ))}
                        </select>
                      </div>
                      <button onClick={() => { setExamTypeFilter('all'); setSearchQuery('') }}
                        className="w-full py-1.5 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg transition-colors">
                        Clear Filters
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Analysis */}
            <button onClick={() => setShowAnalysis(true)}
              className="px-4 py-2.5 text-sm font-bold text-[var(--text-secondary)] bg-[var(--recessed-bg)] border border-[var(--border-color)] rounded-lg hover:border-[var(--accent-mint)] hover:text-[var(--accent-mint)] transition-colors flex items-center gap-1.5">
              <TrendingUp size={13} /> Analysis
            </button>

            {/* Add Session */}
            <button onClick={() => openModal()}
              disabled={!canEdit}
              className="px-4 py-2 text-xs font-bold text-white bg-[var(--accent-mint)] hover:bg-[var(--accent-mint-hover)] rounded-lg shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
              <Plus size={13} /> Add Session
            </button>
          </div>
        </div>

        {/* ── ACTIVE FILTERS CHIPS ── */}
        {(searchQuery || examTypeFilter !== 'all') && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-[11px] text-[var(--text-secondary)] font-medium">Active filters:</span>
            {searchQuery && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-[var(--accent-mint)]/10 border border-[var(--accent-mint)]/30 text-[var(--accent-mint)] rounded-full text-[10px] font-bold">
                "{searchQuery}" <button onClick={() => setSearchQuery('')}><X size={10} /></button>
              </span>
            )}
            {examTypeFilter !== 'all' && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-[var(--recessed-bg)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-full text-[10px] font-bold">
                {examTypeFilter} <button onClick={() => setExamTypeFilter('all')}><X size={10} /></button>
              </span>
            )}
          </div>
        )}

        {/* ── CALENDAR VIEWS ── */}
        {viewMode === 'month' && <MonthView />}
        {viewMode === 'week' && <WeekView />}
        {viewMode === 'day' && <DayView />}
      </div>
      {/* ════════════════════ DAILY DETAILS MODAL ════════════════════ */}
      <AnimatePresence>
        {showDetailsModal && selectedDate && (() => {
          const daySessions = getSessionsForDate(selectedDate)
          const grouped = groupSessionsByKind(daySessions)
          return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-6xl bg-[var(--card-bg)] rounded-2xl shadow-2xl border border-[var(--border-color)] overflow-hidden max-h-[85vh] flex flex-col"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--recessed-bg)]">
                <div>
                  <h3 className="text-lg font-extrabold text-[var(--text-primary)]">
                    {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs font-bold text-[var(--text-secondary)]">{daySessions.length} sessions</span>
                    <span className="w-1 h-1 rounded-full bg-[var(--border-color)]" />
                    <span className="text-xs font-bold text-[var(--text-secondary)]">
                      {daySessions.reduce((s, x) => s + x.candidate_count, 0)} candidates
                    </span>
                  </div>
                </div>
                <button onClick={closeModal}
                  className="w-9 h-9 rounded-xl bg-[var(--recessed-bg)]/40 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--recessed-bg)]/80 transition-colors">
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {daySessions.length > 0 ? (
                  <>
                    {/* ── Client Summary Cards ── */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {grouped.map(({ kind, sessions: grpSessions }) => {
                        const band = getExamColor(kind)
                        const totalPax = grpSessions.reduce((s, x) => s + x.candidate_count, 0)
                        const isExpanded = expandedClient === kind
                        return (
                          <button
                            key={kind}
                            onClick={() => setExpandedClient(isExpanded ? null : kind)}
                            className={`text-left rounded-xl border p-3 transition-all ${isExpanded ? 'ring-2 ring-[var(--accent-mint)] border-[var(--accent-mint)]' : 'border-[var(--border-color)] hover:border-[var(--accent-mint)]/50'}`}
                            style={{ background: isExpanded ? band.bg : 'var(--recessed-bg)' }}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <span
                                className="px-2 py-0.5 rounded text-[9px] font-black tracking-widest uppercase border"
                                style={{ backgroundColor: band.badge, color: band.badgeText, borderColor: band.border }}
                              >
                                {KIND_SECTION_LABEL[kind]}
                              </span>
                              {isExpanded && <ChevronDown size={12} className="text-[var(--accent-mint)] ml-auto" />}
                            </div>
                            <div className="flex items-baseline justify-between">
                              <span className="text-2xl font-extrabold tabular-nums" style={{ color: band.text }}>{totalPax}</span>
                              <span className="text-[10px] font-bold text-[var(--text-secondary)]">{grpSessions.length} {grpSessions.length === 1 ? 'session' : 'sessions'}</span>
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    {/* ── Expanded Client Sessions ── */}
                    <AnimatePresence mode="wait">
                      {expandedClient ? (
                        <motion.div
                          key={expandedClient}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-2.5 overflow-hidden"
                        >
                          {(() => {
                            const grp = grouped.find(g => g.kind === expandedClient)
                            if (!grp) return null
                            return grp.sessions.map((session, idx) => {
                              const c = getExamColor(resolveExamKind(session))
                              return (
                                <div
                                  key={session.id ?? idx}
                                  className="rounded-xl border border-[var(--border-color)] overflow-hidden transition-all hover:ring-1 hover:ring-[var(--accent-mint)]"
                                  style={{ borderColor: c.border, background: `linear-gradient(145deg, ${c.bg} 0%, var(--recessed-bg) 100%)` }}
                                >
                                  <div className="flex items-stretch">
                                    <div className="w-1 shrink-0 rounded-l-xl" style={{ backgroundColor: c.dot }} />
                                    <div className="flex-1 p-4 min-w-0">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                                            <span
                                              className="px-2.5 py-1 rounded-md text-[10px] font-black tracking-widest uppercase border border-[var(--border-color)]"
                                              style={{ backgroundColor: c.badge, color: c.badgeText }}
                                            >
                                              {getClientBadgeLabel(session)}
                                            </span>
                                            <span className="text-[10px] text-[var(--text-secondary)] font-semibold truncate max-w-[200px]">
                                              {session.client_name}
                                            </span>
                                          </div>
                                          <h4 className="text-sm font-bold text-[var(--text-primary)] leading-snug">{session.exam_name}</h4>
                                          {(session as any).assigned_staff && (
                                            <p className="text-xs text-[var(--text-secondary)] mt-1 flex items-center gap-1">
                                              <User size={11} className="text-[var(--text-secondary)]/80" /> {(session as any).assigned_staff}
                                            </p>
                                          )}
                                        </div>
                                        <div className="text-right shrink-0">
                                          <div className="text-2xl font-extrabold tabular-nums" style={{ color: c.text }}>
                                            {session.candidate_count}
                                          </div>
                                          <div className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">candidates</div>
                                        </div>
                                      </div>
                                      <div className="flex items-center flex-wrap gap-3 mt-3 pt-3 border-t border-[var(--border-color)]/30">
                                        <div className="flex items-center gap-1.5 text-xs text-[var(--text-primary)]">
                                          <Clock size={12} style={{ color: c.dot }} />
                                          <span className="font-semibold tabular-nums">
                                            {formatTime(session.start_time)} – {formatTime(session.end_time)}
                                          </span>
                                        </div>
                                        {session.branch_location && (
                                          <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                                            <MapPin size={12} className="text-[var(--text-secondary)]/80" />
                                            <span className="font-semibold capitalize">{session.branch_location}</span>
                                          </div>
                                        )}
                                        {canEdit && (session.id === undefined || session.id >= 0) && (
                                          <div className="ml-auto flex items-center gap-1">
                                            <button
                                              onClick={(e) => { e.stopPropagation(); openModal(selectedDate!, session as Session) }}
                                              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent-mint)] hover:bg-[var(--accent-mint)]/10 transition-colors"
                                            >
                                              <Edit size={13} />
                                            </button>
                                            <button
                                              onClick={(e) => { e.stopPropagation(); typeof session.id === 'number' && handleDelete(session.id) }}
                                              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                            >
                                              <Trash2 size={13} />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )
                            })
                          })()}
                        </motion.div>
                      ) : (
                        /* ── Default: all sessions in 2-col grid grouped by client ── */
                        <motion.div
                          key="all"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="grid grid-cols-1 md:grid-cols-2 gap-4"
                        >
                          {grouped.map(({ kind, sessions: grpSessions }) => {
                            const band = getExamColor(kind)
                            return (
                              <div key={kind} className="space-y-2">
                                <div className="flex items-center gap-2 px-0.5">
                                  <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--border-color)] to-transparent opacity-60" />
                                  <span
                                    className="text-[9px] font-black uppercase tracking-[0.2em] shrink-0 px-2.5 py-0.5 rounded-full border"
                                    style={{ color: band.badgeText, borderColor: band.border, backgroundColor: band.badge }}
                                  >
                                    {KIND_SECTION_LABEL[kind]}
                                  </span>
                                  <span className="h-px flex-1 bg-gradient-to-l from-transparent via-[var(--border-color)] to-transparent opacity-60" />
                                </div>
                                {grpSessions.map((session, idx) => {
                                  const c = getExamColor(resolveExamKind(session))
                                  return (
                                    <div
                                      key={session.id ?? idx}
                                      className="rounded-lg border border-[var(--border-color)] p-3 transition-all hover:ring-1 hover:ring-[var(--accent-mint)]"
                                      style={{ background: `linear-gradient(145deg, ${c.bg} 0%, var(--recessed-bg) 100%)` }}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-1">
                                            <span className="px-2 py-0.5 rounded text-[9px] font-black tracking-widest uppercase border border-[var(--border-color)]"
                                              style={{ backgroundColor: c.badge, color: c.badgeText }}>
                                              {getClientBadgeLabel(session)}
                                            </span>
                                            <span className="text-xs font-bold text-[var(--text-primary)] truncate">{session.exam_name}</span>
                                          </div>
                                          <div className="flex items-center gap-3 text-[10px] text-[var(--text-secondary)]">
                                            <span className="flex items-center gap-1">
                                              <Clock size={10} style={{ color: c.dot }} />
                                              {formatTime(session.start_time)} – {formatTime(session.end_time)}
                                            </span>
                                            <span className="flex items-center gap-1">
                                              <Users size={10} /> {session.candidate_count}
                                            </span>
                                          </div>
                                        </div>
                                        {canEdit && (
                                          <div className="flex items-center gap-0.5 shrink-0">
                                            <button onClick={() => openModal(selectedDate!, session as Session)}
                                              className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--accent-mint)] hover:bg-[var(--accent-mint)]/10 transition-colors">
                                              <Edit size={12} />
                                            </button>
                                            <button onClick={() => typeof session.id === 'number' && handleDelete(session.id)}
                                              className="p-1 rounded text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 transition-colors">
                                              <Trash2 size={12} />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-[var(--text-secondary)]/50">
                    <Calendar size={40} className="mb-3" />
                    <p className="text-sm font-bold">No sessions for this day</p>
                  </div>
                )}
              </div>

              {canEdit && (
                <div className="p-4 border-t border-[var(--border-color)] bg-[var(--recessed-bg)] flex justify-center">
                  <button onClick={() => openModal(selectedDate!)}
                    className="px-6 py-2.5 bg-[var(--accent-mint)] hover:bg-[var(--accent-mint-hover)] text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-2">
                    <Plus size={13} /> Add Session
                  </button>
                </div>
              )}
            </motion.div>
          </div>
          )
        })()}
      </AnimatePresence>

      {/* ════════════════════ ADD / EDIT SESSION MODAL ════════════════════ */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-xl bg-[var(--card-bg)] rounded-2xl shadow-2xl border border-[var(--border-color)] overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--recessed-bg)]">
                <div>
                  <h3 className="text-lg font-extrabold text-[var(--text-primary)]">{editingSession ? 'Edit Session' : 'New Session'}</h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">{editingSession ? 'Update session details' : 'Schedule a new exam session'}</p>
                </div>
                <button onClick={closeModal}
                  className="w-9 h-9 rounded-xl bg-[var(--recessed-bg)]/40 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--recessed-bg)]/80 transition-colors">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Client</label>
                      <select value={formData.client_name}
                        onChange={e => setFormData({ ...formData, client_name: e.target.value, exam_name: '' })}
                        className="w-full px-3 py-2.5 bg-[var(--recessed-bg)] border border-[var(--border-color)] rounded-lg text-sm font-medium text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent-mint)]/50 focus:border-[var(--accent-mint)] outline-none"
                        required>
                        <option value="">Select Client</option>
                        {clientsWithOptions.length > 0 ? (
                          clientsWithOptions.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)
                        ) : (
                          Object.keys(EXAM_COLORS).filter(k => k !== 'OTHER').map(k => <option key={k} value={k}>{k}</option>)
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Exam</label>
                      {(() => {
                        const sel = clientsWithOptions.find((c: any) => c.name === formData.client_name)
                        const exams = sel ? dbExams.filter((e: any) => e.client_id === sel.id) : []
                        return exams.length > 0 ? (
                          <select value={formData.exam_name}
                            onChange={e => setFormData({ ...formData, exam_name: e.target.value })}
                            className="w-full px-3 py-2.5 bg-[var(--recessed-bg)] border border-[var(--border-color)] rounded-lg text-sm font-medium text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent-mint)]/50 focus:border-[var(--accent-mint)] outline-none" required>
                            <option value="">Select Exam</option>
                            {exams.map((e: any) => <option key={e.id} value={e.name}>{e.name}</option>)}
                          </select>
                        ) : (
                          <input type="text" value={formData.exam_name}
                            onChange={e => setFormData({ ...formData, exam_name: e.target.value })}
                            className="w-full px-3 py-2.5 bg-[var(--recessed-bg)] border border-[var(--border-color)] rounded-lg text-sm font-medium text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent-mint)]/50 focus:border-[var(--accent-mint)] outline-none placeholder-[var(--text-secondary)]/30"
                            placeholder="e.g. CMA US Exam" required />
                        )
                      })()}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Date</label>
                      <input type="date" value={formData.date}
                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                        className="w-full px-3 py-2.5 bg-[var(--recessed-bg)] border border-[var(--border-color)] rounded-lg text-sm font-medium text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent-mint)]/50 focus:border-[var(--accent-mint)] outline-none" required />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Candidates</label>
                      <input type="number" value={formData.candidate_count}
                        onChange={e => setFormData({ ...formData, candidate_count: parseInt(e.target.value) })}
                        className="w-full px-3 py-2.5 bg-[var(--recessed-bg)] border border-[var(--border-color)] rounded-lg text-sm font-medium text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent-mint)]/50 focus:border-[var(--accent-mint)] outline-none"
                        min="1" required />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Start Time</label>
                      <input type="time" value={formData.start_time}
                        onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                        className="w-full px-3 py-2.5 bg-[var(--recessed-bg)] border border-[var(--border-color)] rounded-lg text-sm font-medium text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent-mint)]/50 focus:border-[var(--accent-mint)] outline-none" required />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">End Time</label>
                      <input type="time" value={formData.end_time}
                        onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                        className="w-full px-3 py-2.5 bg-[var(--recessed-bg)] border border-[var(--border-color)] rounded-lg text-sm font-medium text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent-mint)]/50 focus:border-[var(--accent-mint)] outline-none" required />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-6 pt-5 border-t border-[var(--border-color)]/30">
                  <button type="button" onClick={closeModal}
                    className="flex-1 px-4 py-2.5 bg-[var(--recessed-bg)] border border-[var(--border-color)] text-[var(--text-secondary)] font-bold text-sm rounded-lg hover:border-[var(--accent-mint)] transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={isMutating}
                    className="flex-1 px-4 py-2.5 bg-[var(--accent-mint)] hover:bg-[var(--accent-mint-hover)] text-white font-bold text-sm rounded-lg shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {isMutating
                      ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                      : editingSession ? 'Update Session' : 'Create Session'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Analysis Modal */}
      <AnimatePresence>
        {showAnalysis && (
          <CalendarAnalysis onClose={() => setShowAnalysis(false)} activeBranch={activeBranch} />
        )}
      </AnimatePresence>

      {/* Custom scrollbar styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: var(--recessed-bg); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--accent-mint); }
      `}</style>
    </div>
  )
}

export default FetsCalendarPremium
