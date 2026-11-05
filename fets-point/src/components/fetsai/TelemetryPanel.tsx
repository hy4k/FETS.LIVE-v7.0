import { useEffect, useState } from 'react'
import { Activity, MessageSquare, Zap, ShieldCheck, Database, TrendingUp } from 'lucide-react'
import { useAgentResource } from '../../fets-ai/useAgentResource'

/**
 * Telemetry — live operational stats about FETS AI itself:
 * how much it's used, what it's doing, and how much it's learned.
 */
interface Stats {
  totalQueries: number
  queries7d: number
  totalActions: number
  writeActions: number
  blockedActions: number
  failedActions: number
  memoryCount: number
  knowledgeCount: number
  topTools: Array<{ name: string; count: number }>
  recent: Array<{ tool: string; table: string | null; status: string; when: string }>
}

export function TelemetryPanel({userId,branch}:{userId:string;branch:string}) {
  const resource=useAgentResource<{stats:Stats}>(userId,branch,'telemetry');
  const stats=resource.data?.stats;
  if(resource.loading)return <div className="text-slate-500 text-sm p-4">Loading telemetry…</div>;
  if(resource.error||!stats)return <div role="alert">{resource.error||'Telemetry unavailable.'}<button onClick={resource.load}>Retry</button></div>;
  const cards = [
    { label: 'Total Queries', value: stats.totalQueries, icon: MessageSquare, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Queries · 7d', value: stats.queries7d, icon: TrendingUp, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { label: 'Agent Actions', value: stats.totalActions, icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Writes Executed', value: stats.writeActions, icon: ShieldCheck, color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Blocked Actions', value: stats.blockedActions, icon: ShieldCheck, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Failed Actions', value: stats.failedActions, icon: Activity, color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Pinned Memories', value: stats.memoryCount, icon: Database, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'External Docs', value: stats.knowledgeCount, icon: Activity, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  ]

  return (
    <div className="space-y-5"><div><h3 className="font-bold text-slate-900">Your AI activity</h3><p className="text-xs text-slate-500">Queries cover your account across centres. Actions show your activity for the selected centre.</p></div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <div key={c.label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-7 h-7 rounded-lg grid place-items-center ${c.bg}`}><Icon size={15} className={c.color} /></span>
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{c.label}</span>
              </div>
              <div className="text-3xl font-black text-slate-900 tabular-nums">{c.value.toLocaleString()}</div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <h4 className="text-xs uppercase tracking-widest text-indigo-600 font-black mb-3">Top Tools Used</h4>
          {stats.topTools.length === 0 ? (
            <p className="text-slate-400 text-sm">No activity yet.</p>
          ) : (
            <div className="space-y-2">
              {stats.topTools.map((t) => (
                <div key={t.name} className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 font-medium">{t.name.replace(/_/g, ' ')}</span>
                  <span className="text-sm text-slate-900 font-bold tabular-nums">{t.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <h4 className="text-xs uppercase tracking-widest text-cyan-600 font-black mb-3">Recent Actions</h4>
          {stats.recent.length === 0 ? (
            <p className="text-slate-400 text-sm">No actions logged yet.</p>
          ) : (
            <div className="space-y-2">
              {stats.recent.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 font-medium">
                    {r.tool.replace(/_/g, ' ')}{r.table ? ` · ${r.table}` : ''}
                  </span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    r.status === 'succeeded' ? 'bg-emerald-100 text-emerald-700'
                    : r.status === 'blocked' ? 'bg-amber-100 text-amber-700'
                    : 'bg-rose-100 text-rose-700'
                  }`}>{r.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
