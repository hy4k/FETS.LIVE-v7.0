import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowUpRight,
  BarChart3,
  Briefcase,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  Link2,
  MapPin,
  NotebookText,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useClients, useClientExams } from '../hooks/useClients'
import { useBranch } from '../hooks/useBranch'
import { formatDateForIST } from '../utils/dateUtils'
import { getBranchCapacity } from '../utils/sessionUtils'
import { LIVE_SUPPORT_CLIENTS, type QuickAccessClientSlug } from '../constants/liveSupportClients'

type CalendarSession = {
  id?: number
  client_name: string
  exam_name: string
  date: string
  candidate_count: number
  start_time: string
  end_time: string
  branch_location?: string | null
}

type QuickAccessItem = {
  id: string
  client_slug: QuickAccessClientSlug
  field_type: string
  value_text: string
  label: string | null
  is_global?: boolean
}

const branchLabel = (branch: string) => branch.charAt(0).toUpperCase() + branch.slice(1)

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

const getClientSlug = (name: string): QuickAccessClientSlug => {
  const value = name.toLowerCase()
  if (value.includes('prometric')) return 'prometric'
  if (value.includes('pearson') || value.includes('vue')) return 'pearson'
  if (value.includes('psi')) return 'psi'
  if (value.includes('celpip') || value.includes('paragon')) return 'celpip'
  if (value.includes('itts') || value.includes('surpass')) return 'itts'
  return 'fets'
}

const formatDateLabel = (value: string) =>
  new Date(value).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })

const formatMonthTitle = (value: Date) =>
  value.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

const formatTime = (time: string) => {
  if (!time) return '--'
  const [h, m] = time.split(':')
  const hour = Number(h)
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${display}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

const isSecret = (fieldType: string) => fieldType === 'password' || fieldType === 'api_key'

export function ClientPortal() {
  const { activeBranch } = useBranch()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [sessions, setSessions] = useState<CalendarSession[]>([])
  const [quickAccess, setQuickAccess] = useState<QuickAccessItem[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [search, setSearch] = useState('')
  const [notes, setNotes] = useState('')

  const { data: clients = [], isLoading: clientsLoading } = useClients()
  const { data: exams = [] } = useClientExams()

  useEffect(() => {
    if (!selectedClientId && clients.length > 0) setSelectedClientId(clients[0].id)
  }, [clients, selectedClientId])

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? clients[0],
    [clients, selectedClientId]
  )

  const selectedSlug = selectedClient ? getClientSlug(selectedClient.name) : 'fets'

  useEffect(() => {
    const loadSessions = async () => {
      if (!selectedClient) {
        setSessions([])
        return
      }
      setLoadingSessions(true)
      const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
      const { data, error } = await supabase
        .from('calendar_sessions')
        .select('*')
        .gte('date', formatDateForIST(start))
        .lte('date', formatDateForIST(end))
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })

      if (error) {
        toast.error(`Client schedule failed: ${error.message}`)
        setSessions([])
      } else {
        const clientKey = normalize(selectedClient.name)
        setSessions(((data as CalendarSession[]) || []).filter((session) => {
          const haystack = `${session.client_name} ${session.exam_name}`
          const branch = (session.branch_location || 'calicut').toLowerCase()
          const branchMatches = activeBranch === 'global' || branch === activeBranch.toLowerCase()
          return branchMatches && (normalize(haystack).includes(clientKey) || normalize(session.client_name).includes(clientKey))
        }))
      }
      setLoadingSessions(false)
    }
    loadSessions()
  }, [currentMonth, selectedClient, activeBranch])

  useEffect(() => {
    const loadQuickAccess = async () => {
      const { data, error } = await supabase
        .from('quick_access_items')
        .select('id,client_slug,field_type,value_text,label,is_global')
        .order('sort_order', { ascending: true })

      if (error) {
        setQuickAccess([])
        return
      }
      setQuickAccess(((data as QuickAccessItem[]) || []).filter((item) => item.client_slug === selectedSlug))
    }
    loadQuickAccess()
  }, [selectedSlug])

  const clientExams = useMemo(() => {
    if (!selectedClient) return []
    return exams.filter((exam) => exam.client_id === selectedClient.id)
  }, [exams, selectedClient])

  const filteredSessions = useMemo(() => {
    if (!search.trim()) return sessions
    const q = search.toLowerCase()
    return sessions.filter((session) =>
      `${session.exam_name} ${session.client_name} ${session.branch_location ?? 'calicut'} ${session.date}`.toLowerCase().includes(q)
    )
  }, [sessions, search])

  const stats = useMemo(() => {
    const totalCandidates = sessions.reduce((sum, session) => sum + (session.candidate_count || 0), 0)
    const centres = new Set(sessions.map((session) => session.branch_location || 'calicut'))
    const upcoming = sessions.find((session) => new Date(`${session.date}T23:59:59`) >= new Date())
    return {
      totalCandidates,
      totalSessions: sessions.length,
      activeCentres: centres.size,
      upcomingDate: upcoming?.date,
    }
  }, [sessions])

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarSession[]>()
    filteredSessions.forEach((session) => {
      map.set(session.date, [...(map.get(session.date) || []), session])
    })
    return Array.from(map.entries()).map(([date, daySessions]) => {
      const branches = daySessions.reduce<Record<string, { booked: number; seats: number; sessions: number }>>((acc, session) => {
        const branch = session.branch_location || 'calicut'
        acc[branch] ??= { booked: 0, seats: getBranchCapacity(branch), sessions: 0 }
        acc[branch].booked += session.candidate_count || 0
        acc[branch].sessions += 1
        return acc
      }, {})
      return {
        date,
        sessions: daySessions,
        booked: daySessions.reduce((sum, session) => sum + (session.candidate_count || 0), 0),
        branches,
      }
    })
  }, [filteredSessions])

  const branchTotals = useMemo(() => {
    return sessions.reduce<Record<string, { candidates: number; sessions: number }>>((acc, session) => {
      const branch = session.branch_location || 'calicut'
      acc[branch] ??= { candidates: 0, sessions: 0 }
      acc[branch].candidates += session.candidate_count || 0
      acc[branch].sessions += 1
      return acc
    }, {})
  }, [sessions])

  const supportPortal = LIVE_SUPPORT_CLIENTS.find((client) => client.slug === selectedSlug)

  const copyInvoiceSummary = async () => {
    const rows = [
      ['Client', 'Month', 'Branch', 'Candidates', 'Sessions'],
      ...Object.entries(branchTotals).map(([branch, data]) => [
        selectedClient?.name ?? 'Client',
        formatMonthTitle(currentMonth),
        branchLabel(branch),
        String(data.candidates),
        String(data.sessions),
      ]),
      [selectedClient?.name ?? 'Client', formatMonthTitle(currentMonth), 'TOTAL', String(stats.totalCandidates), String(stats.totalSessions)],
    ]
    await navigator.clipboard.writeText(rows.map((row) => row.join(',')).join('\n'))
    toast.success('Invoice summary copied')
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    const next = new Date(currentMonth)
    next.setMonth(currentMonth.getMonth() + (direction === 'next' ? 1 : -1))
    setCurrentMonth(next)
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white pb-16">
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-8 space-y-6">
        <section className="relative overflow-hidden rounded-3xl border border-[#FACC15]/15 bg-gradient-to-br from-[#1a3a3d] via-[#111315] to-[#0A0A0B] p-5 md:p-8 shadow-2xl">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-[#FACC15]/10 to-transparent blur-3xl" />
          <div className="relative z-10 flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3 mb-4">
                <Briefcase size={18} className="text-[#FACC15]" />
                <span className="text-[10px] font-black uppercase tracking-[0.28em] text-[#FACC15]/70">Internal Client Workspace</span>
              </div>
              <h1 className="text-3xl md:text-6xl font-black tracking-tighter leading-none">
                Client Portal
              </h1>
              <p className="mt-4 text-sm md:text-base text-white/55 max-w-2xl leading-relaxed">
                Schedule, invoice counts, centre split, support links, and working notes for each client in one staff-only view.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[minmax(220px,320px)_auto] gap-3 w-full xl:w-auto">
              <label className="block">
                <span className="block text-[9px] font-black uppercase tracking-[0.24em] text-white/35 mb-2">Client</span>
                <select
                  value={selectedClientId}
                  onChange={(event) => setSelectedClientId(event.target.value)}
                  className="w-full h-12 rounded-2xl border border-white/10 bg-black/35 px-4 text-sm font-bold text-white outline-none focus:border-[#FACC15]/60"
                  disabled={clientsLoading || clients.length === 0}
                >
                  {clients.length === 0 ? (
                    <option value="">No clients</option>
                  ) : clients.map((client) => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </label>
              <div>
                <span className="block text-[9px] font-black uppercase tracking-[0.24em] text-white/35 mb-2">Month</span>
                <div className="h-12 rounded-2xl border border-white/10 bg-black/35 flex items-center">
                  <button onClick={() => navigateMonth('prev')} className="h-12 w-11 flex items-center justify-center text-white/45 hover:text-[#FACC15]">
                    <ChevronLeft size={18} />
                  </button>
                  <span className="min-w-[150px] text-center text-sm font-black text-white">{formatMonthTitle(currentMonth)}</span>
                  <button onClick={() => navigateMonth('next')} className="h-12 w-11 flex items-center justify-center text-white/45 hover:text-[#FACC15]">
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {[
            { label: 'Monthly Candidates', value: stats.totalCandidates, icon: Users, color: '#FACC15' },
            { label: 'Sessions', value: stats.totalSessions, icon: Calendar, color: '#7dd3fc' },
            { label: 'Active Centres', value: stats.activeCentres, icon: MapPin, color: '#86efac' },
            { label: 'Next Exam', value: stats.upcomingDate ? formatDateLabel(stats.upcomingDate) : 'None', icon: Clock, color: '#fda4af' },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/[0.08] bg-[#121214] p-4 md:p-5">
              <div className="flex items-center justify-between mb-5">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <item.icon size={18} style={{ color: item.color }} />
                </div>
                <span className="text-[8px] font-black uppercase tracking-[0.22em] text-white/25">{item.label}</span>
              </div>
              <div className="text-2xl md:text-4xl font-black tracking-tighter text-white">{item.value}</div>
            </div>
          ))}
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.85fr] gap-6">
          <section className="rounded-3xl border border-white/[0.08] bg-[#121214] overflow-hidden">
            <div className="p-5 border-b border-white/[0.06] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-xl font-black tracking-tight">Schedule Workspace</h2>
                <p className="text-xs text-white/35 mt-1">Daily schedule with booked candidates, centre split, exam names, and timings.</p>
              </div>
              <div className="relative w-full md:w-72">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search schedule"
                  className="w-full h-10 rounded-xl border border-white/10 bg-black/25 pl-9 pr-3 text-xs font-semibold text-white outline-none focus:border-[#FACC15]/50"
                />
              </div>
            </div>

            <div className="p-4 md:p-5 space-y-4">
              {loadingSessions ? (
                <div className="py-16 text-center text-white/40 text-sm font-bold">Loading client schedule...</div>
              ) : byDate.length === 0 ? (
                <div className="py-16 text-center">
                  <Calendar size={34} className="mx-auto text-white/15 mb-3" />
                  <p className="text-sm font-bold text-white/45">No sessions found for this client and month.</p>
                </div>
              ) : byDate.map((day) => (
                <motion.div
                  key={day.date}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-white/[0.08] bg-black/20 p-4"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-lg font-black text-white">{formatDateLabel(day.date)}</h3>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">{day.sessions.length} sessions</p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-black text-[#FACC15] tabular-nums">{day.booked}</div>
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30">booked candidates</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                    {Object.entries(day.branches).map(([branch, data]) => (
                      <div key={branch} className="rounded-xl bg-[#0A0A0B] border border-white/[0.06] px-3 py-2 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">{branchLabel(branch)}</span>
                        <span className="text-sm font-black text-white tabular-nums">{data.booked} / {data.seats} seats</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {day.sessions.map((session) => (
                      <div key={session.id ?? `${session.date}-${session.start_time}-${session.exam_name}`} className="rounded-xl border border-white/[0.06] bg-white/[0.035] p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-black text-white truncate">{session.exam_name || 'Exam session'}</p>
                          <p className="text-xs text-white/35 truncate">{session.client_name}</p>
                        </div>
                        <div className="flex items-center gap-3 text-xs font-bold text-white/55">
                          <span className="inline-flex items-center gap-1.5"><Clock size={13} /> {formatTime(session.start_time)} - {formatTime(session.end_time)}</span>
                          <span className="inline-flex items-center gap-1.5"><MapPin size={13} /> {branchLabel(session.branch_location || 'calicut')}</span>
                          <span className="text-[#FACC15] font-black tabular-nums">{session.candidate_count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-3xl border border-white/[0.08] bg-[#121214] p-5">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-lg font-black">Invoice Summary</h2>
                  <p className="text-xs text-white/35 mt-1">Export-ready centre totals.</p>
                </div>
                <button
                  onClick={copyInvoiceSummary}
                  className="h-10 px-3 rounded-xl bg-[#FACC15] text-black text-xs font-black flex items-center gap-2 hover:brightness-105"
                >
                  <Copy size={14} /> Copy CSV
                </button>
              </div>
              <div className="space-y-2">
                {Object.entries(branchTotals).length === 0 ? (
                  <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4 text-sm text-white/35 font-bold">No invoice rows this month.</div>
                ) : Object.entries(branchTotals).map(([branch, data]) => (
                  <div key={branch} className="rounded-xl border border-white/[0.06] bg-black/20 p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black text-white">{branchLabel(branch)}</p>
                      <p className="text-[10px] text-white/35 font-bold uppercase tracking-[0.16em]">{data.sessions} sessions</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-[#FACC15]">{data.candidates}</p>
                      <p className="text-[9px] text-white/30 font-black uppercase tracking-wider">candidates</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/[0.08] bg-[#121214] p-5">
              <div className="flex items-center gap-3 mb-5">
                <Link2 size={18} className="text-[#FACC15]" />
                <div>
                  <h2 className="text-lg font-black">Support Workspace</h2>
                  <p className="text-xs text-white/35 mt-1">Client support links and saved quick access items.</p>
                </div>
              </div>
              {supportPortal && (
                <a
                  href={supportPortal.supportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-3 rounded-2xl border border-[#FACC15]/20 bg-[#FACC15]/10 p-4 flex items-center justify-between hover:border-[#FACC15]/45"
                >
                  <div className="flex items-center gap-3">
                    <Globe size={18} className="text-[#FACC15]" />
                    <div>
                      <p className="text-sm font-black text-white">{supportPortal.name} Support</p>
                      <p className="text-[10px] text-[#FACC15]/55 font-bold uppercase tracking-wider">Official portal</p>
                    </div>
                  </div>
                  <ExternalLink size={16} className="text-[#FACC15]" />
                </a>
              )}
              <div className="space-y-2">
                {quickAccess.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4 text-sm text-white/35 font-bold">No quick access items saved for this client.</div>
                ) : quickAccess.map((item) => (
                  <div key={item.id} className="rounded-xl border border-white/[0.06] bg-black/20 p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-white/45">{item.label || item.field_type}</p>
                      <p className="text-sm font-bold text-white truncate">{isSecret(item.field_type) ? '••••••••' : item.value_text}</p>
                    </div>
                    {item.field_type === 'url' ? (
                      <a href={item.value_text.startsWith('http') ? item.value_text : `https://${item.value_text}`} target="_blank" rel="noopener noreferrer" className="text-[#FACC15]">
                        <ArrowUpRight size={16} />
                      </a>
                    ) : (
                      <ShieldCheck size={16} className="text-white/25" />
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/[0.08] bg-[#121214] p-5">
              <div className="flex items-center gap-3 mb-4">
                <NotebookText size={18} className="text-[#FACC15]" />
                <div>
                  <h2 className="text-lg font-black">Notes & Documents</h2>
                  <p className="text-xs text-white/35 mt-1">Local v1 workspace, not saved to database.</p>
                </div>
              </div>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={`Working notes for ${selectedClient?.name ?? 'this client'}...`}
                className="min-h-[120px] w-full resize-none rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white outline-none placeholder:text-white/20 focus:border-[#FACC15]/50"
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                {clientExams.slice(0, 4).map((exam) => (
                  <div key={exam.id} className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
                    <FileText size={14} className="text-[#FACC15] mb-2" />
                    <p className="text-xs font-bold text-white truncate">{exam.name}</p>
                  </div>
                ))}
                {clientExams.length === 0 && (
                  <div className="col-span-2 rounded-xl border border-white/[0.06] bg-black/20 p-4 text-sm text-white/35 font-bold">
                    No client exam catalogue entries found.
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ClientPortal
