import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  X,
  Plus,
  Copy,
  Trash2,
  Pencil,
  Check,
  LayoutGrid,
  Eye,
  EyeOff,
  ExternalLink,
  Crown,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { isMithunEmail } from '../utils/authUtils'
import {
  LIVE_SUPPORT_CLIENTS,
  QUICK_ACCESS_EXTRA,
  type QuickAccessClientSlug,
} from '../constants/liveSupportClients'

export type { QuickAccessClientSlug }

export type QuickAccessFieldType =
  | 'url'
  | 'login_id'
  | 'password'
  | 'email'
  | 'contact_phone'
  | 'site_code'
  | 'access_code'
  | 'api_key'
  | 'support_pin'
  | 'notes'
  | 'other'

export type QuickAccessItemRow = {
  id: string
  owner_id: string
  client_slug: QuickAccessClientSlug
  field_type: QuickAccessFieldType
  value_text: string
  label: string | null
  sort_order: number
  source_vault_row_id: string | null
  is_global?: boolean
  created_at: string
  updated_at: string
}

const FIELD_OPTIONS: { id: QuickAccessFieldType; label: string }[] = [
  { id: 'url', label: 'URL / link' },
  { id: 'login_id', label: 'Login / ID' },
  { id: 'password', label: 'Password' },
  { id: 'email', label: 'Email' },
  { id: 'contact_phone', label: 'Phone' },
  { id: 'site_code', label: 'Site code' },
  { id: 'access_code', label: 'Access code' },
  { id: 'api_key', label: 'API key' },
  { id: 'support_pin', label: 'Support PIN' },
  { id: 'notes', label: 'Note / long text' },
  { id: 'other', label: 'Other' },
]

const QA_TILES = [
  ...LIVE_SUPPORT_CLIENTS.map((c) => ({
    slug: c.slug,
    name: c.name,
    image: c.image,
    supportUrl: c.supportUrl,
  })),
  ...QUICK_ACCESS_EXTRA.map((c) => ({
    slug: c.slug,
    name: c.name,
    image: c.image as string | undefined,
    supportUrl: undefined as string | undefined,
  })),
]

function inferClientSlug(v: Record<string, unknown>): QuickAccessClientSlug {
  const blob = `${v.category ?? ''} ${v.title ?? ''} ${v.notes ?? ''} ${v.type ?? ''} ${v.content ?? ''}`
    .toLowerCase()
  if (blob.includes('prometric')) return 'prometric'
  if (blob.includes('pearson') || blob.includes('vue')) return 'pearson'
  if (blob.includes('celpip')) return 'celpip'
  if (blob.includes('psi')) return 'psi'
  if (blob.includes('itts') || blob.includes('surpass')) return 'itts'
  return 'fets'
}

function fieldLabel(t: string) {
  return FIELD_OPTIONS.find((f) => f.id === t)?.label ?? t
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text)
  toast.success(`${label} copied`, {
    style: {
      background: '#121214',
      color: '#FACC15',
      border: '1px solid rgba(250, 204, 21, 0.2)',
      fontSize: '10px',
      fontWeight: 'bold',
      textTransform: 'uppercase',
    },
  })
}

function isSecretField(fieldType: QuickAccessFieldType) {
  return fieldType === 'password' || fieldType === 'api_key'
}

function looksLikeHttpUrl(s: string) {
  const t = s.trim()
  if (!t) return false
  try {
    const u = new URL(t.startsWith('http') ? t : `https://${t}`)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return /^https?:\/\//i.test(t)
  }
}

function normalizeHref(s: string) {
  const t = s.trim()
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}

/** Neomorphic surface (dark) */
const neuCard =
  'rounded-2xl border border-white/[0.07] bg-[#16181d] shadow-[6px_8px_18px_rgba(0,0,0,0.45),-4px_-4px_14px_rgba(255,255,255,0.03),inset_0_1px_0_rgba(255,255,255,0.06)]'
const neuInset =
  'rounded-xl border border-black/40 bg-[#0e0f12] shadow-[inset_3px_3px_10px_rgba(0,0,0,0.5),inset_-2px_-2px_8px_rgba(255,255,255,0.04)]'
const neuModalShell =
  'rounded-[28px] border border-white/[0.08] bg-gradient-to-br from-[#1c1f26] via-[#14161c] to-[#101115] shadow-[12px_16px_40px_rgba(0,0,0,0.55),-8px_-10px_28px_rgba(255,255,255,0.04),inset_0_1px_0_rgba(255,255,255,0.09)]'

export function QuickAccessSection({
  profile,
  authUserId,
}: {
  profile: { id: string; email?: string | null; role?: string | null } | null | undefined
  authUserId?: string | null
}) {
  const [items, setItems] = useState<QuickAccessItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [migrationDone, setMigrationDone] = useState(false)
  const [activeClient, setActiveClient] = useState<QuickAccessClientSlug | null>(null)
  /** Expanded by default — same visibility as Live Support (all logos) */
  const [collapsed, setCollapsed] = useState(false)

  const [addFieldType, setAddFieldType] = useState<QuickAccessFieldType>('other')
  const [addValue, setAddValue] = useState('')
  const [addLabel, setAddLabel] = useState('')
  const [addShareGlobally, setAddShareGlobally] = useState(false)
  const [showAddPanel, setShowAddPanel] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editLabel, setEditLabel] = useState('')
  const [editFieldType, setEditFieldType] = useState<QuickAccessFieldType>('other')
  const [editShareGlobally, setEditShareGlobally] = useState(false)
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({})
  const isMithun = isMithunEmail(profile?.email) && profile?.role === 'super_admin'

  const fetchItems = useCallback(async () => {
    if (!profile?.id) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('quick_access_items')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      if (error.code === '42P01' || (error.message && error.message.includes('does not exist'))) {
        setTableMissing(true)
        setItems([])
      } else {
        console.error('quick_access_items', error)
        toast.error(error.message)
      }
      setLoading(false)
      return
    }
    setTableMissing(false)
    const visibleRows = ((data || []) as QuickAccessItemRow[]).filter(
      (row) => row.is_global || row.owner_id === profile.id
    )
    setItems(visibleRows)
    setLoading(false)
  }, [profile?.id])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  useEffect(() => {
    if (!profile?.id || tableMissing || migrationDone) return

    let cancelled = false
    ;(async () => {
      const { data: existingTags } = await supabase
        .from('quick_access_items')
        .select('source_vault_row_id')
        .not('source_vault_row_id', 'is', null)

      const migratedVaultIds = new Set(
        (existingTags || []).map((r: { source_vault_row_id: string }) => r.source_vault_row_id).filter(Boolean)
      )

      const { data: vaultRows, error: vErr } = await supabase.from('fets_vault').select('*')
      if (vErr || !vaultRows?.length) {
        setMigrationDone(true)
        return
      }

      const toInsert: Record<string, unknown>[] = []
      for (const v of vaultRows as Record<string, unknown>[]) {
        const vid = v.id as string | undefined
        if (!vid || migratedVaultIds.has(vid)) continue

        const rowOwner = v.user_id as string | undefined
        const isMine =
          rowOwner && (rowOwner === profile.id || (authUserId && rowOwner === authUserId))
        if (!isMine) continue

        const client = inferClientSlug(v)
        const rowLabel = (v.title as string) || null

        const push = (field_type: QuickAccessFieldType, val: unknown) => {
          if (val == null) return
          const s = String(val).trim()
          if (!s) return
          toInsert.push({
            owner_id: profile.id,
            client_slug: client,
            field_type,
            value_text: s,
            label: rowLabel,
            sort_order: 0,
            source_vault_row_id: vid,
          })
        }

        push('url', v.url)
        push('login_id', v.username)
        push('password', v.password)
        push('email', v.prof_email)
        push('contact_phone', v.contact_numbers)
        push('site_code', v.site_id)
        push('password', v.prof_email_password)
        const notes = (v.notes as string) || (v.content as string)
        push('notes', notes)
        if (v.other_urls) {
          push('notes', typeof v.other_urls === 'string' ? v.other_urls : JSON.stringify(v.other_urls))
        }
      }

      if (cancelled || toInsert.length === 0) {
        setMigrationDone(true)
        return
      }

      const { error: insErr } = await supabase.from('quick_access_items').insert(toInsert)
      if (insErr) {
        console.error('Quick access migration', insErr)
      } else {
        await fetchItems()
      }
      setMigrationDone(true)
    })()

    return () => {
      cancelled = true
    }
  }, [profile?.id, authUserId, tableMissing, migrationDone, fetchItems])

  const byClient = useMemo(() => {
    const m = new Map<QuickAccessClientSlug, QuickAccessItemRow[]>()
    QA_TILES.forEach((c) => m.set(c.slug, []))
    for (const it of items) {
      const list = m.get(it.client_slug) || []
      list.push(it)
      m.set(it.client_slug, list)
    }
    return m
  }, [items])

  const activeItems = useMemo(() => {
    if (!activeClient) return []
    const list = byClient.get(activeClient) || []
    return [...list].sort(
      (a, b) =>
        a.sort_order - b.sort_order || new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
  }, [activeClient, byClient])

  const resetAdd = () => {
    setAddFieldType('other')
    setAddValue('')
    setAddLabel('')
    setAddShareGlobally(false)
    setShowAddPanel(false)
  }

  const handleAdd = async () => {
    if (!profile?.id || !activeClient) return
    const v = addValue.trim()
    if (!v) {
      toast.error('Enter a value')
      return
    }
    const nextOrder =
      activeItems.length > 0 ? Math.max(...activeItems.map((x) => x.sort_order), -1) + 1 : 0
    const { error } = await supabase.from('quick_access_items').insert({
      owner_id: profile.id,
      client_slug: activeClient,
      field_type: addFieldType,
      value_text: v,
      label: addLabel.trim() || null,
      sort_order: nextOrder,
      is_global: Boolean(isMithun && addShareGlobally),
    })
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Saved')
    resetAdd()
    fetchItems()
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('quick_access_items').delete().eq('id', id)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Removed')
    if (editingId === id) setEditingId(null)
    setRevealedIds((prev) => {
      const n = { ...prev }
      delete n[id]
      return n
    })
    fetchItems()
  }

  const startEdit = (row: QuickAccessItemRow) => {
    setEditingId(row.id)
    setEditValue(row.value_text)
    setEditLabel(row.label || '')
    setEditFieldType(row.field_type as QuickAccessFieldType)
    setEditShareGlobally(Boolean(row.is_global))
  }

  const saveEdit = async () => {
    if (!editingId || !profile?.id) return
    const v = editValue.trim()
    if (!v) {
      toast.error('Value required')
      return
    }
    const { error } = await supabase
      .from('quick_access_items')
      .update({
        value_text: v,
        label: editLabel.trim() || null,
        field_type: editFieldType,
        is_global: Boolean(isMithun && editShareGlobally),
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingId)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Updated')
    setEditingId(null)
    fetchItems()
  }

  const activeMeta = QA_TILES.find((c) => c.slug === activeClient)

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const inputForField = (
    fieldType: QuickAccessFieldType,
    value: string,
    onChange: (v: string) => void,
    id: string
  ) => {
    if (fieldType === 'notes') {
      return (
        <textarea
          id={id}
          rows={5}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Long note, instructions, pasted content…"
          className={`w-full px-3 py-2.5 text-xs text-white/90 placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-sky-400/40 resize-y min-h-[100px] ${neuInset}`}
        />
      )
    }
    const type =
      fieldType === 'password'
        ? 'password'
        : fieldType === 'email'
          ? 'email'
          : fieldType === 'contact_phone'
            ? 'tel'
            : fieldType === 'url'
              ? 'url'
              : 'text'
    return (
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-3 py-2.5 text-xs text-white/90 placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-sky-400/40 ${neuInset}`}
      />
    )
  }

  const renderValueDisplay = (row: QuickAccessItemRow) => {
    const raw = row.value_text
    const showSecret = isSecretField(row.field_type)
    const revealed = revealedIds[row.id]
    const asUrl = row.field_type === 'url' || (row.field_type === 'other' && looksLikeHttpUrl(raw))

    if (editingId === row.id) {
      return null
    }

    if (asUrl && looksLikeHttpUrl(raw)) {
      return (
        <a
          href={normalizeHref(raw)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-sky-300/95 hover:text-sky-200 underline underline-offset-2 break-all font-medium"
        >
          {raw}
        </a>
      )
    }

    if (showSecret && !revealed) {
      return <span className="text-sm text-white/35 tracking-widest select-none">••••••••</span>
    }

    return (
      <p className="text-sm text-white/88 whitespace-pre-wrap break-words font-medium leading-relaxed">{raw}</p>
    )
  }

  if (!profile?.id) {
    return null
  }

  return (
    <>
      {/* Visual separation from Live Support: cool accent + double ring vs gold section above */}
      <section
        className="mb-12 rounded-[24px] border border-sky-500/25 bg-gradient-to-b from-sky-500/[0.07] via-[#0a0c10]/40 to-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_0_1px_rgba(56,189,248,0.06)] overflow-hidden"
        aria-label="Quick access credentials by vendor"
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-3 md:p-4"
        >
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="w-full flex items-center justify-between gap-4 pb-3 md:pb-4 border-b border-sky-500/15 group text-left rounded-sm hover:bg-white/[0.02] transition-colors -mx-1 px-1"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-sky-500/15 flex items-center justify-center border border-sky-400/25 shrink-0 shadow-[3px_4px_12px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.1)]">
                <LayoutGrid size={16} className="text-sky-300" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm md:text-base font-black text-white uppercase tracking-[0.12em] leading-none">
                  Quick Access
                </h3>
                <p className="text-[9px] text-sky-200/50 uppercase tracking-widest font-bold mt-1.5 truncate">
                  {collapsed
                    ? 'Your saved logins & notes — tap to expand'
                    : `${items.length} saved · personal vault + shared client links`}
                </p>
              </div>
            </div>
            <ChevronDown
              size={20}
              className={`shrink-0 text-sky-300/70 transition-transform duration-300 ${collapsed ? '' : 'rotate-180'}`}
              aria-hidden
            />
          </button>

          {tableMissing && (
            <p className="text-xs text-amber-400/90 mt-3 px-1 leading-relaxed">
              Run the SQL migration{' '}
              <code className="text-[10px] bg-white/5 px-1 rounded">supabase/migrations/20260404120000_quick_access_items.sql</code> in the
              Supabase SQL editor to enable Quick Access storage.
            </p>
          )}

          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="pt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 md:gap-3">
                  {QA_TILES.map((c) => {
                    const count = byClient.get(c.slug)?.length ?? 0
                    return (
                      <button
                        key={c.slug}
                        type="button"
                        onClick={() => {
                          setActiveClient(c.slug)
                          setShowAddPanel(false)
                        }}
                        className={`group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl min-h-[96px] md:min-h-[100px] px-2 py-3
                        border border-white/[0.1] bg-[#14161c]/90 backdrop-blur-xl
                        shadow-[8px_10px_22px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.08)]
                        transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-400/35 hover:bg-[#1a1d24]
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400/45`}
                      >
                        <span
                          className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-sky-500/10 via-transparent to-[#0c4a6e]/20 opacity-60 group-hover:opacity-90"
                          aria-hidden
                        />
                        {c.image ? (
                          <div className="relative z-[1] w-full max-w-[120px] h-9 md:h-10 flex items-center justify-center">
                            <img
                              src={c.image}
                              alt={c.name}
                              className="max-h-full max-w-full object-contain opacity-95"
                              loading="lazy"
                            />
                          </div>
                        ) : (
                          <div className="relative z-[1] w-14 h-14 rounded-2xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center">
                            <span className="text-sm font-black text-sky-200 tracking-[0.2em]">FETS</span>
                          </div>
                        )}
                        <span className="relative z-[1] mt-1.5 text-[9px] font-bold text-sky-200/50 uppercase tracking-widest">
                          {count} saved
                        </span>
                      </button>
                    )
                  })}
                </div>
                {loading && <p className="text-xs text-white/40 mt-3 px-1">Loading…</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </section>

      <AnimatePresence>
        {activeClient && activeMeta && (
          <motion.div
            role="dialog"
            aria-modal
            aria-labelledby="quick-access-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 bg-black/75 backdrop-blur-md"
            onClick={() => {
              setActiveClient(null)
              resetAdd()
              setEditingId(null)
            }}
          >
            <motion.div
              initial={{ y: 48, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 48, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className={`w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden ${neuModalShell}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 p-4 border-b border-white/[0.06] shadow-[inset_0_-1px_0_rgba(255,255,255,0.04)]">
                <div className="flex items-center gap-3 min-w-0">
                  {activeMeta.image ? (
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 p-1.5 ${neuInset}`}
                    >
                      <img src={activeMeta.image} alt="" className="max-w-full max-h-full object-contain" />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-sky-500/15 border border-sky-400/25 flex items-center justify-center shrink-0">
                      <span className="text-xs font-black text-sky-200 tracking-widest">FETS</span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 id="quick-access-title" className="text-base font-black text-white uppercase tracking-wide truncate">
                      {activeMeta.name}
                    </h2>
                    <p className="text-[10px] text-sky-300/70 uppercase tracking-widest mt-0.5">Saved credentials</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {activeMeta.supportUrl && (
                    <a
                      href={activeMeta.supportUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Official live support (new tab)"
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-sky-300/80 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors"
                    >
                      <ExternalLink size={18} />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveClient(null)
                      resetAdd()
                      setEditingId(null)
                    }}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-white/45 hover:text-white hover:bg-white/5 ${neuInset}`}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Primary: saved items */}
              <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
                {activeItems.length === 0 && (
                  <div
                    className={`${neuInset} border-dashed border-white/12 px-4 py-10 text-center`}
                  >
                    <p className="text-xs text-white/45 leading-relaxed">
                      No entries yet. Use <span className="text-sky-300 font-semibold">+ Add</span> below for this client’s
                      URL, username, password, phone number, site code, PIN, or notes.
                    </p>
                  </div>
                )}

                {activeItems.map((row) => {
                  const isShared = Boolean(row.is_global)
                  const canModifyRow = !isShared || isMithun
                  return (
                  <div key={row.id} className={`p-4 space-y-3 ${neuCard} ${isShared ? 'border-[#FACC15]/20' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-400/80">
                            {row.label?.trim() || fieldLabel(row.field_type)}
                          </p>
                          {isShared && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-[#FACC15]/25 bg-[#FACC15]/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.16em] text-[#FACC15]">
                              <Crown size={10} />
                              Shared
                            </span>
                          )}
                        </div>
                        {row.label?.trim() && (
                          <p className="text-[9px] text-white/30 uppercase tracking-wider">{fieldLabel(row.field_type)}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {editingId === row.id ? (
                          <button
                            type="button"
                            onClick={saveEdit}
                            className="p-2 rounded-lg bg-sky-500/20 text-sky-200 hover:bg-sky-500/30"
                            title="Save"
                          >
                            <Check size={15} />
                          </button>
                        ) : canModifyRow ? (
                          <button
                            type="button"
                            onClick={() => startEdit(row)}
                            className="p-2 rounded-lg bg-white/[0.04] text-white/45 hover:text-sky-200"
                            title="Edit"
                          >
                            <Pencil size={15} />
                          </button>
                        ) : null}
                        {canModifyRow && (
                          <button
                            type="button"
                            onClick={() => handleDelete(row.id)}
                            className="p-2 rounded-lg bg-red-500/10 text-red-400/90 hover:bg-red-500/20"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(row.value_text, row.label?.trim() || fieldLabel(row.field_type))
                          }
                          className="p-2 rounded-lg bg-white/[0.04] text-white/40 hover:text-sky-200"
                          title="Copy"
                        >
                          <Copy size={15} />
                        </button>
                        {isSecretField(row.field_type) && editingId !== row.id && (
                          <button
                            type="button"
                            onClick={() => toggleReveal(row.id)}
                            className="p-2 rounded-lg bg-white/[0.04] text-white/40 hover:text-sky-200"
                            title={revealedIds[row.id] ? 'Hide' : 'Show'}
                          >
                            {revealedIds[row.id] ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        )}
                      </div>
                    </div>

                    {editingId === row.id ? (
                      <div className="space-y-3 pt-1">
                        <div>
                          <label className="text-[9px] uppercase font-bold text-white/35 block mb-1">Label (your name for this)</label>
                          <input
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            placeholder="e.g. Main portal password"
                            className={`w-full px-3 py-2 text-xs text-white/90 placeholder:text-white/20 ${neuInset}`}
                          />
                        </div>
                        <div>
                          <label className="text-[9px] uppercase font-bold text-white/35 block mb-1">Type</label>
                          <select
                            value={editFieldType}
                            onChange={(e) => setEditFieldType(e.target.value as QuickAccessFieldType)}
                            className={`w-full px-3 py-2 text-xs text-white/90 ${neuInset}`}
                          >
                            {FIELD_OPTIONS.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] uppercase font-bold text-white/35 block mb-1">Value</label>
                          {inputForField(editFieldType, editValue, setEditValue, `edit-${row.id}`)}
                        </div>
                        {isMithun && (
                          <label className="flex items-start gap-2 rounded-xl border border-[#FACC15]/15 bg-[#FACC15]/5 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#FACC15]/80">
                            <input
                              type="checkbox"
                              className="mt-0.5 accent-[#FACC15]"
                              checked={editShareGlobally}
                              onChange={(e) => setEditShareGlobally(e.target.checked)}
                            />
                            Keep this entry shared for all users
                          </label>
                        )}
                      </div>
                    ) : (
                      renderValueDisplay(row)
                    )}
                  </div>
                )})}
              </div>

              {/* Secondary: add — starts collapsed */}
              <div className={`border-t border-white/[0.06] p-4 space-y-3 shadow-[inset_0_2px_12px_rgba(0,0,0,0.35)]`}>
                {!showAddPanel ? (
                  <button
                    type="button"
                    onClick={() => setShowAddPanel(true)}
                    className={`w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-sky-200/90 hover:text-white border border-sky-500/25 bg-sky-500/10 hover:bg-sky-500/15 transition-colors ${neuInset}`}
                  >
                    <Plus size={16} strokeWidth={2.5} />
                    Add entry
                  </button>
                ) : (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase tracking-widest text-sky-300/80">New entry</p>
                      <button
                        type="button"
                        onClick={() => setShowAddPanel(false)}
                        className="text-[10px] text-white/35 hover:text-white/60 uppercase font-bold"
                      >
                        Cancel
                      </button>
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-white/35 block mb-1">Label (optional)</label>
                      <input
                        value={addLabel}
                        onChange={(e) => setAddLabel(e.target.value)}
                        placeholder="Name this field — e.g. TCC login, API key, Notes"
                        className={`w-full px-3 py-2.5 text-xs text-white/90 placeholder:text-white/20 ${neuInset}`}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-white/35 block mb-1">Type</label>
                      <select
                        value={addFieldType}
                        onChange={(e) => setAddFieldType(e.target.value as QuickAccessFieldType)}
                        className={`w-full px-3 py-2.5 text-xs text-white/90 ${neuInset}`}
                      >
                        {FIELD_OPTIONS.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-white/35 block mb-1">Value</label>
                      {inputForField(addFieldType, addValue, setAddValue, 'add-value')}
                    </div>
                    {isMithun && (
                      <label className="flex items-start gap-2 rounded-xl border border-[#FACC15]/15 bg-[#FACC15]/5 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#FACC15]/80">
                        <input
                          type="checkbox"
                          className="mt-0.5 accent-[#FACC15]"
                          checked={addShareGlobally}
                          onChange={(e) => setAddShareGlobally(e.target.checked)}
                        />
                        Share permanently with all users
                      </label>
                    )}
                    <button
                      type="button"
                      onClick={handleAdd}
                      className="w-full py-3 rounded-2xl bg-gradient-to-r from-sky-500/90 to-sky-600/90 text-white font-black text-[10px] uppercase tracking-widest hover:brightness-110 shadow-lg shadow-sky-900/30"
                    >
                      Save to {activeMeta.name}
                    </button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
