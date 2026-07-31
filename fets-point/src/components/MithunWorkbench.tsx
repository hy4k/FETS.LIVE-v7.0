import React, { useEffect, useState, useMemo } from 'react'
import {
  ArrowLeft,
  Briefcase,
  Check,
  ClipboardList,
  Coins,
  NotebookText,
  Plus,
  Sparkles,
  Target,
  Clock,
  RefreshCw,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { isMithunEmail } from '../utils/authUtils'
import { supabase } from '../lib/supabase'
import { ShiftSwapModal } from './ShiftSwapModal'
import { EnhancedRequestsModal } from './EnhancedRequestsModal'
import { StaffProfile } from '../types/shared'

type Todo = {
  id: string
  text: string
  status: 'open' | 'done'
  priority: 'High' | 'Medium' | 'Low'
}

type LedgerEntry = {
  id: string
  label: string
  type: 'income' | 'expense'
  amount: number
}

type WorkbookPage = {
  id: string
  title: string
  body: string
}

const storageKey = 'fets.mithun.workbench.v1'
const tableMissingCodes = new Set(['42P01', 'PGRST205'])

const defaultState = {
  activeNote:
    'Daily control notes\n\n- Revenue / client follow-ups\n- Calendar capacity decisions\n- Staff and roster actions\n- Systems, support, and escalation notes',
  todos: [
    { id: 'seed-1', text: 'Review next 7 days capacity and overlap risk', status: 'open', priority: 'High' },
    { id: 'seed-2', text: 'Check client invoice counts before month close', status: 'open', priority: 'Medium' },
  ] as Todo[],
  ledger: [
    { id: 'ledger-1', label: 'Monthly client billing review', type: 'income', amount: 0 },
    { id: 'ledger-2', label: 'Operational expense note', type: 'expense', amount: 0 },
  ] as LedgerEntry[],
  pages: [
    { id: 'page-1', title: 'Operations', body: 'Key operational decisions, escalations, and centre status.' },
    { id: 'page-2', title: 'Clients', body: 'Client calls, invoice notes, support portal findings, and follow-ups.' },
    { id: 'page-3', title: 'Finance', body: 'Collections, vendor costs, pending payments, and accounting notes.' },
  ] as WorkbookPage[],
}

export function MithunWorkbench({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { profile, user } = useAuth()
  const [activeNote, setActiveNote] = useState(defaultState.activeNote)
  const [todos, setTodos] = useState<Todo[]>(defaultState.todos)
  const [ledger, setLedger] = useState<LedgerEntry[]>(defaultState.ledger)
  const [pages, setPages] = useState<WorkbookPage[]>(defaultState.pages)
  const [todoText, setTodoText] = useState('')
  const [remoteReady, setRemoteReady] = useState(false)
  const [dbAvailable, setDbAvailable] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'loading' | 'cloud' | 'saving' | 'local'>('loading')
  const [staffList, setStaffList] = useState<StaffProfile[]>([])

  // Modals for Shift & Swap tools moved to My Desk
  const [showSwapModal, setShowSwapModal] = useState(false)
  const [showRequestsModal, setShowRequestsModal] = useState(false)

  const allowed = isMithunEmail(profile?.email)

  useEffect(() => {
    supabase.from('staff_profiles').select('*').then(({ data }) => {
      if (data) setStaffList(data as StaffProfile[])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return
      const parsed = JSON.parse(raw)
      setActiveNote(parsed.activeNote ?? defaultState.activeNote)
      setTodos(parsed.todos ?? defaultState.todos)
      setLedger(parsed.ledger ?? defaultState.ledger)
      setPages(parsed.pages ?? defaultState.pages)
    } catch {
      // Keep defaults on read fail
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ activeNote, todos, ledger, pages }))
  }, [activeNote, todos, ledger, pages])

  useEffect(() => {
    if (!allowed || !user?.id) {
      setRemoteReady(true)
      setSaveStatus('local')
      return
    }

    let cancelled = false
    setSaveStatus('loading')
    ;(async () => {
      const { data, error } = await supabase
        .from('mithun_workbench_state')
        .select('active_note,todos,ledger,pages')
        .eq('user_id', user.id)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        if (tableMissingCodes.has(error.code)) {
          setDbAvailable(false)
        }
        setSaveStatus('local')
      } else if (data) {
        setActiveNote(data.active_note ?? defaultState.activeNote)
        setTodos((data.todos as Todo[]) ?? defaultState.todos)
        setLedger((data.ledger as LedgerEntry[]) ?? defaultState.ledger)
        setPages((data.pages as WorkbookPage[]) ?? defaultState.pages)
        setSaveStatus('cloud')
      } else {
        setSaveStatus('cloud')
      }

      setRemoteReady(true)
    })()

    return () => {
      cancelled = true
    }
  }, [allowed, user?.id])

  const openTodos = useMemo(() => todos.filter((t) => t.status === 'open').length, [todos])
  const doneTodos = useMemo(() => todos.filter((t) => t.status === 'done').length, [todos])
  const balance = useMemo(() => {
    const inc = ledger.filter((l) => l.type === 'income').reduce((acc, curr) => acc + curr.amount, 0)
    const exp = ledger.filter((l) => l.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0)
    return inc - exp
  }, [ledger])

  const addTodo = () => {
    if (!todoText.trim()) return
    setTodos([{ id: crypto.randomUUID(), text: todoText.trim(), status: 'open', priority: 'Medium' }, ...todos])
    setTodoText('')
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white pb-16">
      {/* Modals for Shift & Swap Tools on My Desk */}
      <ShiftSwapModal isOpen={showSwapModal} onClose={() => setShowSwapModal(false)} onSuccess={() => {}} />
      <EnhancedRequestsModal isOpen={showRequestsModal} onClose={() => setShowRequestsModal(false)} onSuccess={() => {}} staffProfiles={staffList} />

      <div className="max-w-[1700px] mx-auto px-4 md:px-8 py-8 space-y-6">
        <section className="relative overflow-hidden rounded-[32px] border border-[#FACC15]/15 bg-gradient-to-br from-[#1a3a3d] via-[#121214] to-[#0A0A0B] p-6 md:p-8">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-[#FACC15]/12 to-transparent blur-3xl" />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <button onClick={() => onNavigate?.('command-center')} className="mb-6 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white/45 hover:text-[#FACC15]">
                <ArrowLeft size={15} /> Command Centre
              </button>
              <div className="flex items-center gap-3 mb-4">
                <Sparkles size={18} className="text-[#FACC15]" />
                <span className="text-[10px] font-black uppercase tracking-[0.28em] text-[#FACC15]/70">My Desk Executive Control</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-none">My Desk & Operations Hub</h1>
              <p className="mt-4 max-w-3xl text-sm md:text-base text-white/55">
                Executive workbook, staff shift swap tools, leave requests, and operational control.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 w-full lg:w-[520px]">
              {[
                { label: 'Open Tasks', value: openTodos, icon: Target },
                { label: 'Done', value: doneTodos, icon: Check },
                { label: 'Balance', value: balance.toLocaleString('en-IN'), icon: Coins },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/[0.08] bg-black/25 p-4">
                  <stat.icon size={17} className="text-[#FACC15] mb-4" />
                  <div className="text-2xl font-black text-white tabular-nums truncate">{stat.value}</div>
                  <div className="mt-2 text-[8px] font-black uppercase tracking-[0.2em] text-white/30">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── SHIFT & SWAP TOOLS SECTION MOVED TO MY DESK ── */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Shift & Time-off Requests Tool */}
          <div
            onClick={() => setShowRequestsModal(true)}
            className="group cursor-pointer rounded-3xl border border-[#1BB5AC]/30 bg-gradient-to-r from-[#1A3A3D] to-[#121214] p-6 transition-all hover:border-[#1BB5AC] hover:shadow-[0_10px_30px_rgba(27,181,172,0.2)]"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 rounded-2xl bg-[#1BB5AC]/20 flex items-center justify-center text-[#1BB5AC] group-hover:scale-110 transition-transform">
                <Clock size={22} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full bg-[#1BB5AC]/10 text-[#1BB5AC] border border-[#1BB5AC]/30">Shift Tool</span>
            </div>
            <h3 className="text-xl font-black text-white group-hover:text-[#1BB5AC] transition-colors">Shifts & Time Off Requests</h3>
            <p className="text-xs text-white/50 mt-1">Submit leave requests, TOIL claims, and view shift request history.</p>
          </div>

          {/* Shift Swap Tool */}
          <div
            onClick={() => setShowSwapModal(true)}
            className="group cursor-pointer rounded-3xl border border-[#F2994A]/30 bg-gradient-to-r from-[#3A2518] to-[#121214] p-6 transition-all hover:border-[#F2994A] hover:shadow-[0_10px_30px_rgba(242,153,74,0.2)]"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 rounded-2xl bg-[#F2994A]/20 flex items-center justify-center text-[#F2994A] group-hover:scale-110 transition-transform">
                <RefreshCw size={22} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full bg-[#F2994A]/10 text-[#F2994A] border border-[#F2994A]/30">Swap Tool</span>
            </div>
            <h3 className="text-xl font-black text-white group-hover:text-[#F2994A] transition-colors">Shift Swap Tool</h3>
            <p className="text-xs text-white/50 mt-1">Request shift swaps with colleagues or manage pending duty exchanges.</p>
          </div>
        </section>

        {/* Workbook Notes and To-Do */}
        <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-6">
          <section className="rounded-3xl border border-white/[0.08] bg-[#121214] p-5 md:p-6">
            <div className="flex items-center gap-3 mb-5">
              <NotebookText size={20} className="text-[#FACC15]" />
              <div>
                <h2 className="text-xl font-black">Daily Notes</h2>
                <p className="text-xs text-white/35">
                  {saveStatus === 'cloud' && 'Auto-saved to Supabase with local backup.'}
                  {saveStatus === 'saving' && 'Saving to Supabase...'}
                  {saveStatus === 'loading' && 'Loading cloud backup...'}
                  {saveStatus === 'local' && 'Auto-saved locally.'}
                </p>
              </div>
            </div>
            <textarea
              value={activeNote}
              onChange={(event) => setActiveNote(event.target.value)}
              className="min-h-[480px] w-full resize-none rounded-3xl border border-white/10 bg-black/25 p-5 text-sm leading-7 text-white outline-none placeholder:text-white/25 focus:border-[#FACC15]/50"
            />
          </section>

          <div className="space-y-6">
            <section className="rounded-3xl border border-white/[0.08] bg-[#121214] p-5 md:p-6">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-3">
                  <ClipboardList size={20} className="text-[#FACC15]" />
                  <h2 className="text-xl font-black">To Do</h2>
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">{openTodos} open</span>
              </div>
              <div className="flex gap-2 mb-4">
                <input
                  value={todoText}
                  onChange={(event) => setTodoText(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && addTodo()}
                  placeholder="Add an action..."
                  className="h-11 flex-1 rounded-xl border border-white/10 bg-black/25 px-4 text-sm text-white outline-none focus:border-[#FACC15]/50"
                />
                <button onClick={addTodo} className="h-11 w-11 rounded-xl bg-[#FACC15] text-black flex items-center justify-center">
                  <Plus size={18} />
                </button>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {todos.map((todo) => (
                  <div key={todo.id} className="rounded-2xl border border-white/[0.06] bg-black/20 p-3 flex items-center gap-3">
                    <button
                      onClick={() => setTodos(todos.map((item) => item.id === todo.id ? { ...item, status: item.status === 'open' ? 'done' : 'open' } : item))}
                      className={`h-8 w-8 rounded-xl border flex items-center justify-center ${todo.status === 'done' ? 'bg-[#FACC15] border-[#FACC15] text-black' : 'border-white/15 text-white/25'}`}
                    >
                      <Check size={15} />
                    </button>
                    <span className={`text-sm flex-1 ${todo.status === 'done' ? 'line-through text-white/30' : 'text-white'}`}>{todo.text}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
