/**
 * FETS AI — "Aurora" redesign.
 * Light, high-contrast, modern UI: animated aurora header, pill tab bar,
 * redesigned chat with markdown rendering, and a command-bar composer.
 */
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Newspaper, Send, Sparkles, Activity, FileText,
  Settings as SettingsIcon, AlertCircle, Users, Calendar,
  Bot, ArrowUp, Zap
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'react-hot-toast'
import { askFetsAgent, type AgentAction } from '../lib/fetsAgent'
import { Markdown } from './fetsai/Markdown'
import { NewsManager } from './NewsManager'
import { TelemetryPanel } from './fetsai/TelemetryPanel'
import { DataVaultPanel } from './fetsai/DataVaultPanel'
import { SettingsPanel } from './fetsai/SettingsPanel'
import { GeminiLiveStudio } from './Chat/GeminiLiveStudio'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  actions?: AgentAction[]
}

interface FetsAIProps {
  initialTab?: string
  initialQuery?: string
}

const QUICK_PROMPTS = [
  { text: 'How many candidates are registered?', icon: Users },
  { text: 'Show the upcoming exam schedule', icon: Calendar },
  { text: 'Summarise recent incidents', icon: AlertCircle },
  { text: 'Which staff are online right now?', icon: Zap },
]

export function FetsIntelligence({ initialTab = 'chat', initialQuery }: FetsAIProps) {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin'
  const [activeTab, setActiveTab] = useState<string>(initialTab)

  const [query, setQuery] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const hasProcessedInitialQuery = useRef(false)
  const conversationId = useRef<string | null>(null)

  useEffect(() => { if (initialTab) setActiveTab(initialTab) }, [initialTab])

  useEffect(() => {
    if (initialQuery && !hasProcessedInitialQuery.current && profile) {
      hasProcessedInitialQuery.current = true
      setActiveTab('chat')
      setTimeout(() => submitQuery(initialQuery), 400)
    }
  }, [initialQuery, profile])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const submitQuery = async (queryText: string) => {
    if (!queryText.trim()) return
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: queryText, timestamp: new Date() }
    setMessages((p) => [...p, userMsg])
    setLoading(true)
    setQuery('')
    try {
      const result = await askFetsAgent(userMsg.content, { conversationId: conversationId.current })
      conversationId.current = result.conversationId
      setMessages((p) => [...p, {
        id: (Date.now() + 1).toString(), role: 'assistant', content: result.response,
        timestamp: new Date(), actions: result.actions?.filter((a) => a.ok) ?? [],
      }])
      const writes = (result.actions ?? []).filter((a) => a.ok && !['read_table', 'aggregate', 'search_memory'].includes(a.name))
      if (writes.length) toast.success(`FETS AI performed ${writes.length} action${writes.length > 1 ? 's' : ''}`)
    } catch (error: any) {
      toast.error(error?.message || 'AI connection failed')
      setMessages((p) => [...p, {
        id: (Date.now() + 1).toString(), role: 'assistant',
        content: `Sorry, I hit an error: ${error?.message || 'connection failed'}. Please try again.`, timestamp: new Date(),
      }])
    } finally { setLoading(false) }
  }

  const handleSend = (e?: React.FormEvent) => { e?.preventDefault(); if (query.trim()) submitQuery(query) }

  const tabs = [
    { id: 'gemini-live', label: 'Gemini 3.1 Live', icon: Sparkles },
    { id: 'chat', label: 'Assistant', icon: Sparkles },
    { id: 'news', label: 'Broadcasts', icon: Newspaper },
    { id: 'exam-stats', label: 'Telemetry', icon: Activity },
    { id: 'knowledge', label: 'Knowledge', icon: FileText },
    { id: 'settings', label: 'Control', icon: SettingsIcon },
  ]

  return (
    <div className="min-h-screen w-full relative overflow-y-auto"
      style={{ background: 'radial-gradient(1200px 600px at 15% -10%, #EEF0FF 0%, transparent 60%), radial-gradient(1000px 500px at 110% 10%, #FFF3E0 0%, transparent 55%), linear-gradient(180deg, #F6F7FB 0%, #EEF1F8 100%)' }}>
      {/* aurora blobs */}
      <motion.div aria-hidden className="pointer-events-none absolute -top-24 -left-20 w-[38rem] h-[38rem] rounded-full blur-[120px]"
        style={{ background: 'conic-gradient(from 90deg, #818CF8, #C4B5FD, #F0ABFC, #FDE68A, #818CF8)', opacity: 0.25 }}
        animate={{ rotate: 360 }} transition={{ duration: 60, repeat: Infinity, ease: 'linear' }} />
      <div aria-hidden className="pointer-events-none absolute top-40 right-0 w-[28rem] h-[28rem] rounded-full blur-[120px]" style={{ background: '#A5B4FC', opacity: 0.18 }} />

      <div className="relative z-10 max-w-[1200px] mx-auto px-4 md:px-8 py-6 md:py-8 flex flex-col min-h-screen">

        {/* ---------- HEADER ---------- */}
        <div className="relative rounded-[28px] overflow-hidden mb-5 shadow-[0_20px_60px_-20px_rgba(79,70,229,0.5)]">
          <div className="absolute inset-0" style={{ background: 'linear-gradient(120deg, #4F46E5 0%, #7C3AED 45%, #C026D3 100%)' }} />
          <motion.div aria-hidden className="absolute inset-0 opacity-40"
            style={{ background: 'radial-gradient(600px 200px at 20% 0%, rgba(255,255,255,0.5), transparent), radial-gradient(500px 220px at 90% 120%, rgba(253,224,138,0.5), transparent)' }}
            animate={{ opacity: [0.3, 0.55, 0.3] }} transition={{ duration: 6, repeat: Infinity }} />
          <div className="relative px-5 md:px-8 py-6 md:py-7 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 grid place-items-center shadow-inner">
                  <Bot size={30} className="text-white" />
                </div>
                <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-white shadow" />
              </div>
              <div>
                <h1 className="text-white text-3xl md:text-4xl font-black tracking-tight leading-none">
                  FETS <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(90deg,#FDE68A,#FCA5A5)' }}>AI</span>
                </h1>
                <div className="flex items-center gap-2 mt-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  <span className="text-white/80 text-[11px] font-semibold uppercase tracking-[0.18em]">Operations Copilot · Online</span>
                </div>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 bg-white/15 backdrop-blur-md border border-white/20 rounded-full px-4 py-2">
              <Sparkles size={15} className="text-amber-200" />
              <span className="text-white text-xs font-semibold">{profile?.full_name?.split(' ')[0] || 'Operator'}</span>
            </div>
          </div>
        </div>

        {/* ---------- TAB BAR ---------- */}
        <div className="flex items-center gap-1 p-1.5 bg-white/70 backdrop-blur-xl border border-white/80 rounded-2xl shadow-sm mb-5 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors"
                style={{ color: active ? '#fff' : '#475569' }}>
                {active && (
                  <motion.span layoutId="fetsai-tab" className="absolute inset-0 rounded-xl"
                    style={{ background: 'linear-gradient(120deg,#4F46E5,#7C3AED)' }} transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
                )}
                <Icon size={16} className="relative z-10" />
                <span className="relative z-10">{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* ---------- CONTENT ---------- */}
        <div className="flex-1 flex flex-col pb-6">
          <AnimatePresence mode="wait">
            {activeTab === 'gemini-live' && (
              <motion.div
                key="gemini-live"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex-1 w-full mb-4"
              >
                <GeminiLiveStudio />
              </motion.div>
            )}

            {activeTab === 'chat' && (
              <motion.div key="chat" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="flex-1 flex flex-col bg-white/80 backdrop-blur-xl border border-white rounded-[24px] shadow-[0_20px_50px_-30px_rgba(30,41,59,0.5)] overflow-hidden">

                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5" style={{ minHeight: 420 }}>
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-10">
                      <div className="w-20 h-20 rounded-3xl grid place-items-center mb-5 shadow-lg"
                        style={{ background: 'linear-gradient(135deg,#4F46E5,#C026D3)' }}>
                        <Sparkles size={36} className="text-white" />
                      </div>
                      <h3 className="text-2xl font-black text-slate-900 mb-1.5">How can I help you run FETS today?</h3>
                      <p className="text-slate-500 text-sm max-w-md mb-8">
                        Ask about candidates, sessions, staff and incidents — or tell me to take an action. I read live data and remember what matters.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                        {QUICK_PROMPTS.map((p, i) => {
                          const Icon = p.icon
                          return (
                            <button key={i} onClick={() => submitQuery(p.text)}
                              className="group flex items-center gap-3 p-4 bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md rounded-2xl text-left transition-all">
                              <span className="w-9 h-9 rounded-xl grid place-items-center bg-indigo-50 group-hover:bg-indigo-100 transition-colors">
                                <Icon size={17} className="text-indigo-600" />
                              </span>
                              <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900">{p.text}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                          <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0 shadow" style={{ background: 'linear-gradient(135deg,#4F46E5,#C026D3)' }}>
                            <Bot size={18} className="text-white" />
                          </div>
                        )}
                        <div className={`max-w-[85%] md:max-w-[76%] ${msg.role === 'user' ? 'order-1' : ''}`}>
                          <div className={msg.role === 'user'
                            ? 'px-4 py-3 rounded-2xl rounded-tr-md text-white shadow-md'
                            : 'px-4 py-3 rounded-2xl rounded-tl-md bg-white border border-slate-200 shadow-sm'}
                            style={msg.role === 'user' ? { background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' } : undefined}>
                            {msg.role === 'user'
                              ? <p className="text-[15px] leading-relaxed whitespace-pre-wrap font-medium">{msg.content}</p>
                              : <div className="text-[15px]"><Markdown content={msg.content} /></div>}
                          </div>
                          {msg.role === 'assistant' && msg.actions && msg.actions.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {msg.actions.map((a, i) => (
                                <span key={i} className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                                  {a.name.replace(/_/g, ' ')}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className={`text-[10px] mt-1.5 font-semibold ${msg.role === 'user' ? 'text-right text-slate-400' : 'text-slate-400'}`}>
                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}

                  {loading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                      <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0 shadow" style={{ background: 'linear-gradient(135deg,#4F46E5,#C026D3)' }}>
                        <Bot size={18} className="text-white" />
                      </div>
                      <div className="px-5 py-4 rounded-2xl rounded-tl-md bg-white border border-slate-200 shadow-sm flex items-center gap-1.5">
                        {[0, 0.15, 0.3].map((d) => (
                          <span key={d} className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: `${d}s` }} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* composer */}
                <div className="p-3 md:p-4 border-t border-slate-100 bg-white/60">
                  <form onSubmit={handleSend} className="flex items-end gap-2 bg-white border border-slate-200 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100 rounded-2xl p-2 shadow-sm transition-all">
                    <input value={query} onChange={(e) => setQuery(e.target.value)} disabled={loading}
                      placeholder="Message FETS AI…  (e.g. 'log an incident for the Cochin AC outage')"
                      className="flex-1 bg-transparent px-3 py-2.5 text-[15px] text-slate-800 placeholder-slate-400 focus:outline-none" />
                    <button type="submit" disabled={!query.trim() || loading}
                      className="w-11 h-11 rounded-xl grid place-items-center text-white shadow-md transition-all disabled:opacity-30 hover:brightness-110"
                      style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}>
                      {loading ? <Activity size={19} className="animate-spin" /> : <ArrowUp size={19} />}
                    </button>
                  </form>
                </div>
              </motion.div>
            )}

            {activeTab === 'news' && (
              <motion.div key="news" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="flex-1 bg-white/85 backdrop-blur-xl border border-white rounded-[24px] shadow-sm overflow-hidden p-4 md:p-6">
                <NewsManager />
              </motion.div>
            )}

            {activeTab === 'exam-stats' && (
              <motion.div key="stats" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="flex-1 bg-white/85 backdrop-blur-xl border border-white rounded-[24px] shadow-sm p-4 md:p-6">
                <TelemetryPanel />
              </motion.div>
            )}

            {activeTab === 'knowledge' && (
              <motion.div key="vault" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="flex-1 bg-white/85 backdrop-blur-xl border border-white rounded-[24px] shadow-sm p-4 md:p-6">
                <DataVaultPanel />
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div key="settings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="flex-1 bg-white/85 backdrop-blur-xl border border-white rounded-[24px] shadow-sm p-4 md:p-6">
                <SettingsPanel isAdmin={!!isAdmin} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

export default FetsIntelligence
