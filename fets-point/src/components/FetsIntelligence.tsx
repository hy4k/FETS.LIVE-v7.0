/**
 * FETS AI - Premium Intelligence Dashboard
 * Stunning, dynamic dark mode with glassmorphism
 */

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Newspaper, Send, Sparkles, Activity,
  FileText, Search, Settings as SettingsIcon,
  AlertCircle, Users, Calendar, BrainCircuit
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'react-hot-toast'
import { askFetsAgent, type AgentAction } from '../lib/fetsAgent'

// Feature Components
import { NewsManager } from './NewsManager'
import { TelemetryPanel } from './fetsai/TelemetryPanel'
import { DataVaultPanel } from './fetsai/DataVaultPanel'
import { SettingsPanel } from './fetsai/SettingsPanel'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  actions?: AgentAction[]
}

interface FetsAIProps {
  initialTab?: string;
  initialQuery?: string;
}

export function FetsIntelligence({ initialTab = 'chat', initialQuery }: FetsAIProps) {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin'
  const [activeTab, setActiveTab] = useState<string>(initialTab)

  // Chat State
  const [query, setQuery] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const hasProcessedInitialQuery = useRef(false)
  const conversationId = useRef<string | null>(null)

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab)
  }, [initialTab]);

  // Auto-submit query when initialQuery is provided
  useEffect(() => {
    if (initialQuery && !hasProcessedInitialQuery.current && profile) {
      hasProcessedInitialQuery.current = true
      setActiveTab('chat')
      setTimeout(() => {
        submitQuery(initialQuery)
      }, 500)
    }
  }, [initialQuery, profile])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const submitQuery = async (queryText: string) => {
    if (!queryText.trim()) return

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: queryText,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    setQuery('') // clear input early

    try {
      // The agent brain (Edge Function) handles context, memory, tools and
      // autonomous actions server-side. Conversation continuity is preserved
      // by passing back the conversationId it returns.
      const result = await askFetsAgent(userMsg.content, {
        conversationId: conversationId.current,
      })
      conversationId.current = result.conversationId

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.response,
        timestamp: new Date(),
        actions: result.actions?.filter(a => a.ok) ?? []
      }
      setMessages(prev => [...prev, aiMsg])

      const writes = (result.actions ?? []).filter(a => a.ok && a.name !== 'read_table' && a.name !== 'aggregate' && a.name !== 'search_memory')
      if (writes.length > 0) {
        toast.success(`FETS AI performed ${writes.length} action${writes.length > 1 ? 's' : ''}`)
      }
    } catch (error: any) {
      toast.error(error?.message || 'AI Connection Failed')
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, I hit an error: ${error?.message || 'connection failed'}. Please try again.`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!query.trim()) return
    await submitQuery(query)
  }

  // Navigation tabs - Enhanced for FETS AI
  const navTabs = [
    { id: 'chat', label: 'AI Nexus', icon: BrainCircuit },
    { id: 'news', label: 'Broadcasts', icon: Newspaper },
    { id: 'exam-stats', label: 'Telemetry', icon: Activity },
    { id: 'knowledge', label: 'Data Vault', icon: FileText },
    { id: 'settings', label: 'Control', icon: SettingsIcon },
  ];

  // Quick Prompts
  const quickPrompts = [
    { text: "Show all exams conducted", icon: Calendar },
    { text: "How many candidates registered?", icon: Users },
    { text: "Future exam schedule", icon: Calendar },
    { text: "Past incidents summary", icon: AlertCircle },
  ]

  return (
    <div className="min-h-screen bg-[#0A0D14] text-slate-200 lg:p-4 md:p-8 p-4 relative overflow-y-auto flex flex-col items-center">
      {/* Ambient background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-[1400px] w-full z-10 flex flex-col h-full flex-1 md:mt-0 mt-14">

        {/* --- HEADER --- */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-center mb-6 gap-6"
        >
          {/* AI Branding */}
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute inset-0 bg-emerald-400 blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500 rounded-full" />
              <div className="w-16 h-16 bg-[#111621] border border-white/10 rounded-2xl flex items-center justify-center relative z-10 shadow-xl overflow-hidden">
                <BrainCircuit size={32} className="text-emerald-400 transform group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </div>
            </div>

            <div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white m-0 leading-none">
                FETS <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)] italic">AI</span>
              </h1>
              <div className="flex items-center gap-2 mt-2">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_8px_#34d399] animate-pulse" />
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-emerald-400/80">Intelligence Nexus</span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2 bg-[#111621]/80 backdrop-blur-md p-1.5 rounded-2xl border border-white/5 shadow-lg w-full md:w-auto overflow-x-auto">
            {navTabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all duration-300 whitespace-nowrap ${isActive
                      ? 'bg-slate-800 text-emerald-400 shadow-[0_4px_15px_rgba(0,0,0,0.3)] border border-emerald-500/20'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent'
                    }`}
                >
                  <Icon size={16} className={isActive ? "drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" : ""} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </motion.div>

        {/* --- MAIN AREA --- */}
        <AnimatePresence mode="wait">
          {activeTab === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex-1 flex flex-col bg-[#111621]/60 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden relative mb-4"
            >
              {/* Top Accent Line */}
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />

              {/* Messages Container */}
              <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col gap-6" style={{ minHeight: '400px' }}>
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-4 mt-8 md:mt-0">
                    <div className="w-24 h-24 bg-[#1A2234] border border-white/5 rounded-[2rem] flex items-center justify-center mb-6 shadow-2xl relative group cursor-default">
                      <div className="absolute inset-0 bg-emerald-500 blur-2xl opacity-10 group-hover:opacity-30 transition-opacity duration-700 rounded-full" />
                      <BrainCircuit size={48} className="text-emerald-400/80 group-hover:scale-110 group-hover:text-emerald-300 transition-all duration-500" />
                    </div>

                    <h3 className="text-2xl font-black text-white mb-2 tracking-tight">System Online</h3>
                    <p className="text-slate-400 text-sm max-w-md mx-auto mb-10 font-medium tracking-wide leading-relaxed">
                      FETS AI processes all operational telemetry, candidates, and historical incident logs. Enter a query below.
                    </p>

                    {/* Prompts Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl w-full">
                      {quickPrompts.map((prompt, idx) => {
                        const Icon = prompt.icon
                        return (
                          <button
                            key={idx}
                            onClick={() => { setQuery(prompt.text); submitQuery(prompt.text); }}
                            className="flex items-center gap-4 p-4 bg-[#1A2234]/50 border border-white/5 hover:border-emerald-500/30 hover:bg-[#1A2234] rounded-2xl text-left transition-all duration-300 group"
                          >
                            <div className="p-2.5 bg-[#0A0D14] rounded-xl border border-white/5 group-hover:border-emerald-500/30 transition-colors">
                              <Icon size={18} className="text-emerald-500" />
                            </div>
                            <span className="text-sm font-bold text-slate-300 group-hover:text-emerald-100 transition-colors">
                              {prompt.text}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[95%] md:max-w-[75%] p-5 rounded-3xl ${msg.role === 'user'
                          ? 'bg-gradient-to-br from-emerald-600/90 to-emerald-800/90 text-white shadow-[0_10px_30px_rgba(4,120,87,0.2)] rounded-tr-sm backdrop-blur-md border border-emerald-400/20'
                          : 'bg-[#1A2234]/80 text-slate-200 border border-white/10 rounded-tl-sm shadow-xl backdrop-blur-md'
                        }`}>
                        {msg.role === 'assistant' && (
                          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/5">
                            <Sparkles size={14} className="text-emerald-400" />
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]">
                              FETS AI
                            </span>
                          </div>
                        )}
                        <p className="text-[14px] md:text-[15px] leading-relaxed whitespace-pre-wrap font-medium">
                          {msg.content}
                        </p>
                        {msg.role === 'assistant' && msg.actions && msg.actions.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-4">
                            {msg.actions.map((a, i) => (
                              <span
                                key={i}
                                className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                              >
                                {a.name.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className={`text-[10px] mt-4 font-bold uppercase flex items-center gap-2 ${msg.role === 'user' ? 'text-emerald-200/70 justify-end' : 'text-slate-500'
                          }`}>
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}

                {loading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                    <div className="bg-[#1A2234]/80 border border-white/10 px-6 py-5 rounded-3xl rounded-tl-sm shadow-xl backdrop-blur-md flex items-center gap-4">
                      <div className="flex gap-1.5">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce shadow-[0_0_8px_#34d399]" style={{ animationDelay: '0s' }} />
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce shadow-[0_0_8px_#34d399]" style={{ animationDelay: '0.15s' }} />
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce shadow-[0_0_8px_#34d399]" style={{ animationDelay: '0.3s' }} />
                      </div>
                      <span className="text-[10px] text-emerald-400/80 font-bold uppercase tracking-widest">Processing</span>
                    </div>
                  </motion.div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 md:p-6 bg-[#0A0D14]/80 border-t border-white/5 backdrop-blur-xl">
                <form onSubmit={handleSend} className="relative flex items-center">
                  <div className="absolute left-6 text-slate-500">
                    <Search size={20} />
                  </div>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Provide query parameters..."
                    disabled={loading}
                    className="w-full bg-[#1A2234]/50 border border-white/10 text-white placeholder-slate-500 rounded-2xl pl-14 pr-20 py-5 font-medium focus:outline-none focus:border-emerald-500/50 focus:bg-[#1A2234] transition-all shadow-inner"
                  />
                  <button
                    type="submit"
                    disabled={!query.trim() || loading}
                    className="absolute right-3 bg-emerald-500 hover:bg-emerald-400 text-[#0A0D14] p-3 rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-emerald-500 flex items-center justify-center shadow-[0_0_20px_rgba(52,211,153,0.2)] disabled:shadow-none"
                  >
                    {loading ? <Activity size={20} className="animate-spin" /> : <Send size={20} className="ml-1" />}
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {/* Broadcasts Tab */}
          {activeTab === 'news' && (
            <motion.div
              key="news"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 bg-[#111621]/60 backdrop-blur-3xl border border-white/10 rounded-3xl overflow-hidden relative shadow-2xl mb-4"
            >
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
              <div className="p-4 md:p-8 h-full overflow-y-auto">
                <NewsManager />
              </div>
            </motion.div>
          )}

          {/* Stats Tab */}
          {activeTab === 'exam-stats' && (
            <motion.div
              key="exam-stats"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 bg-[#111621]/60 backdrop-blur-3xl border border-white/10 rounded-3xl overflow-hidden relative shadow-2xl p-4 md:p-8 mb-4 overflow-y-auto"
            >
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
              <TelemetryPanel />
            </motion.div>
          )}

          {/* Knowledge Tab */}
          {activeTab === 'knowledge' && (
            <motion.div
              key="knowledge"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 bg-[#111621]/60 backdrop-blur-3xl border border-white/10 rounded-3xl overflow-hidden relative shadow-2xl p-4 md:p-8 mb-4 overflow-y-auto"
            >
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
              <DataVaultPanel />
            </motion.div>
          )}

          {/* Control / Settings Tab */}
          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 bg-[#111621]/60 backdrop-blur-3xl border border-white/10 rounded-3xl overflow-hidden relative shadow-2xl p-4 md:p-8 mb-4 overflow-y-auto"
            >
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
              <SettingsPanel isAdmin={!!isAdmin} />
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}

export default FetsIntelligence
