import { useEffect, useState } from 'react'
import { Brain, FileText, Plus, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { supabase } from '../../lib/supabase'

/**
 * Data Vault — the agent's brain, made visible and editable:
 *  • Memory: durable facts the agent has learned (ai_memory)
 *  • External Knowledge: docs/SOPs you feed it (ai_external_knowledge)
 * Adding external knowledge here loads it into the agent's context on every query.
 */
interface MemoryRow { id: string; category: string; mem_key: string; mem_value: string; importance: number; scope: string }
interface KnowledgeRow { id: string; title: string; category: string; content: string; is_active: boolean }

export function DataVaultPanel() {
  const [tab, setTab] = useState<'memory' | 'knowledge'>('knowledge')
  const [memory, setMemory] = useState<MemoryRow[]>([])
  const [knowledge, setKnowledge] = useState<KnowledgeRow[]>([])
  const [loading, setLoading] = useState(true)

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('general')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [{ data: mem }, { data: kn }] = await Promise.all([
        supabase.from('ai_memory').select('id,category,mem_key,mem_value,importance,scope').order('importance', { ascending: false }).limit(100),
        supabase.from('ai_external_knowledge').select('id,title,category,content,is_active').order('created_at', { ascending: false }).limit(100),
      ])
      setMemory(mem || [])
      setKnowledge(kn || [])
    } catch (e) {
      console.error('vault load failed', e)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const addKnowledge = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('ai_external_knowledge').insert({
        title: title.trim(), category: category.trim() || 'general', content: content.trim(),
        is_active: true, added_by: user?.id ?? null,
      })
      if (error) throw error
      toast.success('Knowledge added to FETS AI')
      setTitle(''); setContent(''); setCategory('general')
      load()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add knowledge')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (table: 'ai_memory' | 'ai_external_knowledge', id: string) => {
    try {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) throw error
      toast.success('Deleted')
      load()
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed')
    }
  }

  const inputCls = 'bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50'

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['knowledge', 'memory'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
              tab === t ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'text-slate-500 hover:text-slate-700 border-transparent'
            }`}>
            {t === 'knowledge' ? <FileText size={14} /> : <Brain size={14} />}
            {t === 'knowledge' ? 'External Knowledge' : 'Learned Memory'}
          </button>
        ))}
      </div>

      {tab === 'knowledge' && (
        <form onSubmit={addKnowledge} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
          <h4 className="text-xs uppercase tracking-widest text-indigo-600 font-black flex items-center gap-2">
            <Plus size={14} /> Teach FETS AI something new
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. Prometric refund policy)" className={`md:col-span-2 ${inputCls}`} />
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" className={inputCls} />
          </div>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="The information the agent should know and reason over…" rows={4} className={`w-full resize-y ${inputCls}`} />
          <button type="submit" disabled={saving || !title.trim() || !content.trim()}
            className="flex items-center gap-2 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all disabled:opacity-30 hover:brightness-110"
            style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Add Knowledge
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-slate-500 text-sm p-4">Loading…</div>
      ) : tab === 'knowledge' ? (
        <div className="space-y-2">
          {knowledge.length === 0 ? <p className="text-slate-400 text-sm p-2">No external knowledge yet. Add some above.</p> :
            knowledge.map((k) => (
              <div key={k.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-slate-900 truncate">{k.title}</span>
                    <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-bold">{k.category}</span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2">{k.content}</p>
                </div>
                <button onClick={() => remove('ai_external_knowledge', k.id)} className="text-slate-400 hover:text-rose-500 shrink-0"><Trash2 size={16} /></button>
              </div>
            ))}
        </div>
      ) : (
        <div className="space-y-2">
          {memory.length === 0 ? <p className="text-slate-400 text-sm p-2">The agent hasn't recorded any long-term memory yet. It will as you use it.</p> :
            memory.map((m) => (
              <div key={m.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-bold text-slate-900 truncate">{m.mem_key}</span>
                    <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded bg-violet-100 text-violet-700 font-bold">{m.category}</span>
                    <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-bold">{m.scope}</span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2">{m.mem_value}</p>
                </div>
                <button onClick={() => remove('ai_memory', m.id)} className="text-slate-400 hover:text-rose-500 shrink-0"><Trash2 size={16} /></button>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
