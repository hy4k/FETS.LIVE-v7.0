import { useEffect, useState } from 'react'
import { Power, Cpu, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { supabase } from '../../lib/supabase'

/**
 * Settings — admin control over the agent (writes to ai_settings, RLS-
 * restricted to admins via is_ai_admin()). Non-admins get a read-only view.
 */
interface AiSettings {
  provider: 'claude' | 'gemini'
  claude_model: string
  gemini_model: string
  kill_switch: boolean
  autonomous_enabled: boolean
  max_tool_iterations: number
}

export function SettingsPanel({ isAdmin }: { isAdmin: boolean }) {
  const [settings, setSettings] = useState<AiSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('ai_settings').select('*').eq('id', 1).maybeSingle()
    setSettings(data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const patch = async (changes: Partial<AiSettings>) => {
    if (!isAdmin) { toast.error('Admins only'); return }
    setSaving(true)
    try {
      const { data, error } = await supabase.from('ai_settings').update(changes).eq('id', 1).select().single()
      if (error) throw error
      setSettings(data)
      toast.success('Settings updated')
    } catch (err: any) {
      toast.error(err?.message || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-slate-500 text-sm p-4">Loading settings…</div>
  if (!settings) return <div className="text-slate-500 text-sm p-4">Settings unavailable.</div>

  const writesOn = !settings.kill_switch && settings.autonomous_enabled

  return (
    <div className="space-y-4 max-w-2xl">
      {!isAdmin && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
          <AlertTriangle size={14} /> Read-only — only admins can change these.
        </div>
      )}

      {/* Autonomous writes / kill switch */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Power size={16} className={writesOn ? 'text-emerald-600' : 'text-rose-500'} />
              <span className="text-sm font-black text-slate-900">Autonomous Writes</span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              When ON, FETS AI can create and modify live records without confirmation.
              When OFF (kill-switch), it is strictly read-only. Every action is audited either way.
            </p>
          </div>
          <button disabled={!isAdmin || saving}
            onClick={() => patch({ kill_switch: writesOn, autonomous_enabled: !writesOn })}
            className={`relative w-16 h-8 rounded-full transition-all disabled:opacity-40 shrink-0 ${writesOn ? 'bg-emerald-500' : 'bg-slate-300'}`}>
            <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${writesOn ? 'left-9' : 'left-1'}`} />
          </button>
        </div>
        <div className={`mt-3 text-[11px] font-bold uppercase tracking-widest ${writesOn ? 'text-emerald-600' : 'text-rose-500'}`}>
          {writesOn ? '● Live — writes enabled' : '● Safe — read-only mode'}
        </div>
      </div>

      {/* Provider */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Cpu size={16} className="text-indigo-600" />
          <span className="text-sm font-black text-slate-900">Model Provider</span>
          {saving && <Loader2 size={14} className="animate-spin text-slate-400" />}
        </div>
        <div className="flex gap-2">
          {(['claude', 'gemini'] as const).map((p) => (
            <button key={p} disabled={!isAdmin || saving} onClick={() => patch({ provider: p })}
              className={`flex-1 py-3 rounded-xl text-sm font-bold capitalize transition-all disabled:opacity-40 border ${
                settings.provider === p ? 'bg-indigo-50 text-indigo-700 border-indigo-300' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
              }`}>
              {p === 'claude' ? 'Claude (Anthropic)' : 'Gemini (Google)'}
            </button>
          ))}
        </div>
        <div className="text-xs text-slate-500 mt-3">
          Active model: <span className="text-slate-700 font-mono">{settings.provider === 'claude' ? settings.claude_model : settings.gemini_model}</span>
        </div>
      </div>
    </div>
  )
}
