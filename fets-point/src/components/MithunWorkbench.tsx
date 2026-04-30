import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Briefcase,
  Calculator,
  Calendar,
  Check,
  ClipboardList,
  Coins,
  FileText,
  Layers,
  NotebookText,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { isMithunEmail } from '../utils/authUtils'
import { supabase } from '../lib/supabase'

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
  const [ledgerLabel, setLedgerLabel] = useState('')
  const [ledgerAmount, setLedgerAmount] = useState('')
  const [pageSearch, setPageSearch] = useState('')
  const [remoteReady, setRemoteReady] = useState(false)
  const [dbAvailable, setDbAvailable] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'loading' | 'cloud' | 'saving' | 'local'>('loading')

  const allowed = isMithunEmail(profile?.email)

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
      // Ignore corrupted local storage and keep defaults.
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
        } else {
          console.error('mithun_workbench_state load failed', error)
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

  useEffect(() => {
    if (!allowed || !user?.id || !remoteReady || !dbAvailable) return

    const timer = window.setTimeout(async () => {
      setSaveStatus('saving')
      const { error } = await supabase
        .from('mithun_workbench_state')
        .upsert({
          user_id: user.id,
          active_note: activeNote,
          todos,
          ledger,
          pages,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

      if (error) {
        if (tableMissingCodes.has(error.code)) setDbAvailable(false)
        console.error('mithun_workbench_state save failed', error)
        setSaveStatus('local')
      } else {
        setSaveStatus('cloud')
      }
    }, 700)

    return () => window.clearTimeout(timer)
  }, [activeNote, todos, ledger, pages, allowed, user?.id, remoteReady, dbAvailable])

  const openTodos = todos.filter((todo) => todo.status === 'open').length
  const doneTodos = todos.filter((todo) => todo.status === 'done').length
  const income = ledger.filter((entry) => entry.type === 'income').reduce((sum, entry) => sum + entry.amount, 0)
  const expense = ledger.filter((entry) => entry.type === 'expense').reduce((sum, entry) => sum + entry.amount, 0)
  const balance = income - expense

  const filteredPages = useMemo(() => {
    const q = pageSearch.toLowerCase().trim()
    if (!q) return pages
    return pages.filter((page) => `${page.title} ${page.body}`.toLowerCase().includes(q))
  }, [pages, pageSearch])

  if (!allowed) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] text-white flex items-center justify-center p-6">
        <div className="max-w-md rounded-3xl border border-white/10 bg-[#121214] p-8 text-center">
          <Layers size={36} className="mx-auto text-white/20 mb-4" />
          <h1 className="text-xl font-black">Private Workspace</h1>
          <p className="mt-2 text-sm text-white/45">This My Desk workspace is restricted to Mithun.</p>
          <button onClick={() => onNavigate?.('command-center')} className="mt-6 rounded-xl bg-[#FACC15] px-5 py-3 text-xs font-black text-black">
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  const addTodo = () => {
    if (!todoText.trim()) return
    setTodos([{ id: crypto.randomUUID(), text: todoText.trim(), status: 'open', priority: 'Medium' }, ...todos])
    setTodoText('')
  }

  const addLedgerEntry = (type: LedgerEntry['type']) => {
    const amount = Number(ledgerAmount)
    if (!ledgerLabel.trim() || Number.isNaN(amount)) return
    setLedger([{ id: crypto.randomUUID(), label: ledgerLabel.trim(), type, amount }, ...ledger])
    setLedgerLabel('')
    setLedgerAmount('')
  }

  const addPage = () => {
    setPages([{ id: crypto.randomUUID(), title: 'New Page', body: 'Start writing...' }, ...pages])
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white pb-16">
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
                <span className="text-[10px] font-black uppercase tracking-[0.28em] text-[#FACC15]/70">Mithun Private Desk</span>
              </div>
              <h1 className="text-4xl md:text-7xl font-black tracking-tighter leading-none">Executive Workbook</h1>
              <p className="mt-4 max-w-3xl text-sm md:text-base text-white/55">
                Notes, action tracking, workbook pages, and accounting scratchpad for FETS.LIVE leadership work.
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
                  {saveStatus === 'local' && 'Auto-saved locally. Supabase backup table is not available yet.'}
                </p>
              </div>
            </div>
            <textarea
              value={activeNote}
              onChange={(event) => setActiveNote(event.target.value)}
              className="min-h-[520px] w-full resize-none rounded-3xl border border-white/10 bg-black/25 p-5 text-sm leading-7 text-white outline-none placeholder:text-white/25 focus:border-[#FACC15]/50"
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
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold ${todo.status === 'done' ? 'text-white/35 line-through' : 'text-white'}`}>{todo.text}</p>
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#FACC15]/50">{todo.priority}</p>
                    </div>
                    <button onClick={() => setTodos(todos.filter((item) => item.id !== todo.id))} className="text-white/20 hover:text-rose-400">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/[0.08] bg-[#121214] p-5 md:p-6">
              <div className="flex items-center gap-3 mb-5">
                <Calculator size={20} className="text-[#FACC15]" />
                <div>
                  <h2 className="text-xl font-black">Accounting Scratchpad</h2>
                  <p className="text-xs text-white/35">Quick income/expense tracker for operational notes.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2 mb-3">
                <input value={ledgerLabel} onChange={(e) => setLedgerLabel(e.target.value)} placeholder="Entry label" className="h-11 rounded-xl border border-white/10 bg-black/25 px-4 text-sm text-white outline-none focus:border-[#FACC15]/50" />
                <input value={ledgerAmount} onChange={(e) => setLedgerAmount(e.target.value)} placeholder="Amount" type="number" className="h-11 rounded-xl border border-white/10 bg-black/25 px-4 text-sm text-white outline-none focus:border-[#FACC15]/50" />
              </div>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button onClick={() => addLedgerEntry('income')} className="h-10 rounded-xl bg-emerald-500/15 text-emerald-300 text-xs font-black uppercase tracking-wider border border-emerald-500/25">Income</button>
                <button onClick={() => addLedgerEntry('expense')} className="h-10 rounded-xl bg-rose-500/15 text-rose-300 text-xs font-black uppercase tracking-wider border border-rose-500/25">Expense</button>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="rounded-xl bg-black/20 border border-white/[0.06] p-3"><div className="text-[8px] text-white/30 font-black uppercase tracking-wider">Income</div><div className="text-lg font-black text-emerald-300">{income.toLocaleString('en-IN')}</div></div>
                <div className="rounded-xl bg-black/20 border border-white/[0.06] p-3"><div className="text-[8px] text-white/30 font-black uppercase tracking-wider">Expense</div><div className="text-lg font-black text-rose-300">{expense.toLocaleString('en-IN')}</div></div>
                <div className="rounded-xl bg-black/20 border border-white/[0.06] p-3"><div className="text-[8px] text-white/30 font-black uppercase tracking-wider">Net</div><div className="text-lg font-black text-[#FACC15]">{balance.toLocaleString('en-IN')}</div></div>
              </div>
              <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
                {ledger.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/20 p-3">
                    <div>
                      <p className="text-sm font-bold text-white">{entry.label}</p>
                      <p className={`text-[9px] font-black uppercase tracking-wider ${entry.type === 'income' ? 'text-emerald-300' : 'text-rose-300'}`}>{entry.type}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-black tabular-nums">{entry.amount.toLocaleString('en-IN')}</span>
                      <button onClick={() => setLedger(ledger.filter((item) => item.id !== entry.id))} className="text-white/20 hover:text-rose-400"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        <section className="rounded-3xl border border-white/[0.08] bg-[#121214] p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
            <div className="flex items-center gap-3">
              <BookOpen size={20} className="text-[#FACC15]" />
              <div>
                <h2 className="text-xl font-black">Workbook Pages</h2>
                <p className="text-xs text-white/35">Organize ideas, client follow-ups, finance notes, and decisions.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
                <input value={pageSearch} onChange={(e) => setPageSearch(e.target.value)} placeholder="Search pages" className="h-10 rounded-xl border border-white/10 bg-black/25 pl-9 pr-3 text-xs text-white outline-none focus:border-[#FACC15]/50" />
              </div>
              <button onClick={addPage} className="h-10 rounded-xl bg-[#FACC15] px-4 text-xs font-black text-black uppercase tracking-wider">New Page</button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {filteredPages.map((page) => (
              <div key={page.id} className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <input
                    value={page.title}
                    onChange={(event) => setPages(pages.map((item) => item.id === page.id ? { ...item, title: event.target.value } : item))}
                    className="min-w-0 flex-1 bg-transparent text-lg font-black text-white outline-none"
                  />
                  <button onClick={() => setPages(pages.filter((item) => item.id !== page.id))} className="text-white/20 hover:text-rose-400">
                    <Trash2 size={14} />
                  </button>
                </div>
                <textarea
                  value={page.body}
                  onChange={(event) => setPages(pages.map((item) => item.id === page.id ? { ...item, body: event.target.value } : item))}
                  className="min-h-[160px] w-full resize-none bg-transparent text-sm leading-6 text-white/65 outline-none"
                />
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            { label: 'Client Portal', tab: 'client-portal', icon: Briefcase },
            { label: 'Calendar', tab: 'fets-calendar', icon: Calendar },
            { label: 'Register', tab: 'candidate-tracker', icon: FileText },
            { label: 'Analytics', tab: 'fets-intelligence', icon: BarChart3 },
          ].map((item) => (
            <button key={item.label} onClick={() => onNavigate?.(item.tab)} className="rounded-2xl border border-white/[0.08] bg-[#121214] p-4 text-left hover:border-[#FACC15]/30">
              <item.icon size={18} className="text-[#FACC15] mb-4" />
              <span className="text-sm font-black uppercase tracking-[0.14em] text-white">{item.label}</span>
            </button>
          ))}
        </section>
      </div>
    </div>
  )
}

export default MithunWorkbench
