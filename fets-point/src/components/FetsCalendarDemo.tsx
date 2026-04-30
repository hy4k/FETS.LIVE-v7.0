import { useMemo, useState } from 'react'
import { CalendarDays, RefreshCw, Users, Info } from 'lucide-react'
import { formatDateForIST } from '../utils/dateUtils'
import { useParagonCelpipBookings } from '../hooks/useParagonCelpipBookings'
import { useParagonSyncRuns, type ParagonSyncDetails, type ParagonSyncRunRow } from '../hooks/useParagonSyncRuns'
import { useBranch } from '../hooks/useBranch'

const MONTHS = [
  new Date(2026, 3, 1),
  new Date(2026, 4, 1),
  new Date(2026, 5, 1),
]

const formatMonthTitle = (date: Date) =>
  date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })

const formatTime = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const displayHour = h % 12 === 0 ? 12 : h % 12
  return `${displayHour}:${String(m).padStart(2, '0')} ${ampm}`
}

const formatHumanDate = (isoDate: string) => {
  const d = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
}

const getDaysInMonthGrid = (currentMonth: Date) => {
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
  const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
  const days: (Date | null)[] = []

  for (let i = 0; i < firstDay.getDay(); i += 1) {
    days.push(null)
  }
  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))
  }
  return days
}

/** Fallback when sync_details column is empty (older rows). */
const parseFallbackFromMessage = (message: string | null) => {
  const safe = message ?? ''
  const bookingDelta = Number((safe.match(/bookings delta ([+-]?\d+)/)?.[1] ?? '0'))
  const bookedTotal = Number((safe.match(/booked total (\d+)/)?.[1] ?? '0'))
  return { bookingDelta, bookedTotal }
}

const normalizeSyncDetails = (run: ParagonSyncRunRow | null): ParagonSyncDetails | null => {
  if (!run?.sync_details) return null
  const raw = run.sync_details as Record<string, unknown>
  if (typeof raw !== 'object' || raw === null) return null
  return {
    total_candidates_after: typeof raw.total_candidates_after === 'number' ? raw.total_candidates_after : undefined,
    additional_candidates_since_last_update:
      typeof raw.additional_candidates_since_last_update === 'number'
        ? raw.additional_candidates_since_last_update
        : undefined,
    test_days_with_changes: Array.isArray(raw.test_days_with_changes)
      ? (raw.test_days_with_changes as { date: string; change: number }[])
      : undefined,
  }
}

const branchLabel = (branch: string | null | undefined) => {
  if (!branch) return 'Unknown'
  if (branch === 'global') return 'All centres'
  return branch.charAt(0).toUpperCase() + branch.slice(1)
}

export function FetsCalendarDemo() {
  const { activeBranch } = useBranch()

  const [monthIndex, setMonthIndex] = useState(0)

  const currentMonth = MONTHS[monthIndex]
  const currentMonthPrefix = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`
  const days = useMemo(() => getDaysInMonthGrid(currentMonth), [currentMonth])
  const bookingsQuery = useParagonCelpipBookings(true, activeBranch === 'global', activeBranch)
  const syncRunsQuery = useParagonSyncRuns(true, activeBranch === 'global', activeBranch)
  const sessions = bookingsQuery.data ?? []
  const syncRuns = syncRunsQuery.data ?? []

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, typeof sessions>()
    sessions.forEach(session => {
      const dateKey = String(session.exam_date).slice(0, 10)
      if (!map.has(dateKey)) map.set(dateKey, [])
      map.get(dateKey)!.push(session)
    })
    return map
  }, [sessions])

  const currentMonthSessions = useMemo(
    () => sessions.filter(session => String(session.exam_date).startsWith(currentMonthPrefix)),
    [sessions, currentMonthPrefix],
  )

  const currentMonthTotal = useMemo(
    () => currentMonthSessions.reduce((sum, session) => sum + session.booked_count, 0),
    [currentMonthSessions],
  )
  const currentMonthSlotCount = currentMonthSessions.length

  const latestRun = useMemo(() => syncRuns[0] ?? null, [syncRuns])

  const latestByBranch = useMemo(() => {
    if (activeBranch !== 'global') return []
    const map = new Map<string, ParagonSyncRunRow>()
    for (const run of syncRuns) {
      const key = run.branch_location ?? 'unknown'
      if (!map.has(key)) map.set(key, run)
    }
    return Array.from(map.values())
      .filter((run) => run.branch_location === 'cochin' || run.branch_location === 'calicut')
      .sort((a, b) => (a.branch_location ?? '').localeCompare(b.branch_location ?? ''))
  }, [activeBranch, syncRuns])

  const details = useMemo(() => normalizeSyncDetails(latestRun), [latestRun])
  const fallback = useMemo(() => parseFallbackFromMessage(latestRun?.message ?? null), [latestRun?.message])

  const daysChanged = details?.test_days_with_changes ?? []
  const daysChangedThisMonth = useMemo(
    () => daysChanged.filter((row) => row.date.startsWith(currentMonthPrefix)),
    [daysChanged, currentMonthPrefix],
  )
  const monthChangeSinceRefresh = useMemo(
    () => daysChangedThisMonth.reduce((sum, row) => sum + Number(row.change || 0), 0),
    [daysChangedThisMonth],
  )

  const monthChangeLine = () => {
    if (monthChangeSinceRefresh === 0) {
      return 'No change in this month since previous refresh.'
    }
    if (monthChangeSinceRefresh > 0) {
      return `+${monthChangeSinceRefresh} candidates in this month vs previous refresh.`
    }
    return `${monthChangeSinceRefresh} candidates in this month vs previous refresh.`
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-[#0c0c0e] via-[#12121a] to-[#0a0a0c] text-zinc-100"
      style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}
    >
      <div className="max-w-[1680px] mx-auto px-4 md:px-10 py-8 md:py-10">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-8 mb-10 mt-20 md:mt-24">
          <div className="space-y-3 max-w-3xl">
            <div className="flex items-center gap-3">
              <div className="h-px w-14 bg-amber-400/80" />
              <span className="text-sm md:text-base font-semibold uppercase tracking-[0.18em] text-amber-300/90">
                CELPIP · Apr–Jun 2026
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-[1.05]">
              CELPIP calendar
            </h1>
            <p className="text-base md:text-lg text-zinc-300 leading-relaxed max-w-2xl">
              Candidate counts from the test centre schedule. Numbers refresh automatically; use Refresh if you need the latest view right away.
            </p>
          </div>

          <div className="w-full xl:w-auto flex flex-wrap gap-3 items-stretch">
            <div className="flex items-center gap-2.5 px-5 py-3 rounded-xl bg-white/[0.06] border border-white/10 text-amber-300 min-w-[10rem]">
              <CalendarDays className="shrink-0 opacity-90" size={22} strokeWidth={2} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Test times shown</p>
                <p className="text-xl font-bold tabular-nums text-white">{sessions.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 px-5 py-3 rounded-xl bg-white/[0.06] border border-white/10 text-amber-300 min-w-[10rem]">
              <Users className="shrink-0 opacity-90" size={22} strokeWidth={2} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">This month (candidates)</p>
                <p className="text-xl font-bold tabular-nums text-white">{currentMonthTotal}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                bookingsQuery.refetch()
                syncRunsQuery.refetch()
              }}
              disabled={bookingsQuery.isFetching || syncRunsQuery.isFetching}
              className="inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-black text-base font-bold shadow-lg shadow-amber-900/30 hover:brightness-105 disabled:opacity-55 disabled:cursor-not-allowed min-h-[3.25rem]"
            >
              <RefreshCw size={20} className={bookingsQuery.isFetching || syncRunsQuery.isFetching ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Update summary — month-scoped plain language */}
        <section className="mb-8 rounded-2xl border border-zinc-700/80 bg-[#181923] p-6 md:p-8 shadow-xl shadow-black/25">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">Latest update for {formatMonthTitle(currentMonth)}</h2>
              <p className="text-sm md:text-base text-zinc-300 mt-1">
                Easy view: how many candidates and sessions are in this month, and what changed after the latest refresh.
              </p>
            </div>
            {latestRun?.created_at && (
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Updated</p>
                <p className="text-base md:text-lg font-semibold text-zinc-200">
                  {new Date(latestRun.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
                <p className="text-sm text-zinc-500 mt-0.5">{branchLabel(latestRun.branch_location)}</p>
              </div>
            )}
          </div>

          {!latestRun && (
            <p className="text-base text-zinc-400">Waiting for the first schedule refresh to complete.</p>
          )}

          {latestRun && !latestRun.ok && (
            <p className="text-base text-rose-300">
              Something went wrong while refreshing: {latestRun.message ?? 'Unknown issue'}
            </p>
          )}

          {latestRun && latestRun.ok && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 p-5 md:p-6">
                <p className="text-sm font-semibold text-sky-200 uppercase tracking-wide mb-2">Candidates in this month</p>
                <p className="text-3xl md:text-4xl font-black tabular-nums text-white">
                  {currentMonthTotal}
                </p>
                <p className="text-sm text-zinc-300 mt-2">Booked candidates visible in {formatMonthTitle(currentMonth)}</p>
              </div>
              <div className="rounded-xl border border-violet-400/25 bg-violet-500/10 p-5 md:p-6">
                <p className="text-sm font-semibold text-violet-200 uppercase tracking-wide mb-2">Sessions in this month</p>
                <p className="text-3xl md:text-4xl font-black tabular-nums text-white">{currentMonthSlotCount}</p>
                <p className="text-sm text-zinc-300 mt-2">Total time slots currently listed for this month</p>
              </div>
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-5 md:p-6 md:col-span-2 lg:col-span-1">
                <p className="text-sm font-semibold text-emerald-200 uppercase tracking-wide mb-2">Change in this month</p>
                <p className="text-base md:text-lg text-zinc-100 leading-snug">{monthChangeLine()}</p>
                <p className="text-sm text-zinc-300 mt-2">Compared with the refresh just before this one</p>
              </div>
            </div>
          )}

          {latestRun && latestRun.ok && daysChangedThisMonth.length > 0 && (
            <div className="mt-6 pt-6 border-t border-white/10">
              <p className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                <Info size={18} className="text-amber-400/90 shrink-0" />
                Days in {formatMonthTitle(currentMonth)} where numbers changed in the latest refresh
              </p>
              <ul className="flex flex-wrap gap-2.5">
                {daysChangedThisMonth.map((row) => (
                  <li
                    key={row.date}
                    className="px-4 py-2 rounded-lg bg-white/[0.07] border border-white/10 text-sm md:text-base text-zinc-100"
                  >
                    <span className="font-semibold">{formatHumanDate(row.date)}</span>
                    <span className="text-zinc-500 mx-2">·</span>
                    <span className={row.change > 0 ? 'text-emerald-400' : row.change < 0 ? 'text-rose-300' : 'text-zinc-400'}>
                      {row.change > 0 ? `+${row.change}` : row.change}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {latestRun && latestRun.ok && currentMonthSlotCount === 0 && (
            <p className="mt-6 text-sm text-zinc-300 border-t border-white/10 pt-5">
              No CELPIP slots are currently listed for {formatMonthTitle(currentMonth)}.
            </p>
          )}

          {latestRun && latestRun.ok && currentMonthSlotCount > 0 && daysChangedThisMonth.length === 0 && monthChangeSinceRefresh === 0 && (
            <p className="mt-6 text-sm text-zinc-500 border-t border-white/10 pt-5">
              No day in this month had a count change in the latest refresh.
            </p>
          )}
        </section>

        {activeBranch === 'global' && latestByBranch.length > 0 && (
          <div className="mb-8 grid md:grid-cols-2 gap-4">
            {latestByBranch.map((run) => {
              const d = normalizeSyncDetails(run) ?? ({} as ParagonSyncDetails)
              const fb = parseFallbackFromMessage(run.message)
              const total = sessions
                .filter((s) => s.branch_location === run.branch_location && String(s.exam_date).startsWith(currentMonthPrefix))
                .reduce((sum, s) => sum + s.booked_count, 0)
              const slotCount = sessions.filter(
                (s) => s.branch_location === run.branch_location && String(s.exam_date).startsWith(currentMonthPrefix),
              ).length
              const monthDeltaFromDetails = (d.test_days_with_changes ?? [])
                .filter((row) => row.date.startsWith(currentMonthPrefix))
                .reduce((sum, row) => sum + Number(row.change || 0), 0)
              const delta = Number.isFinite(monthDeltaFromDetails) ? monthDeltaFromDetails : fb.bookingDelta
              const deltaText =
                delta === 0
                  ? 'No month-level change since previous update'
                  : delta > 0
                    ? `+${delta} candidates in this month`
                    : `${delta} candidates in this month`
              return (
                <div
                  key={`${run.branch_location}-${run.id}`}
                  className="rounded-xl border border-white/10 bg-white/[0.05] p-5 md:p-6"
                >
                  <p className="text-lg font-bold text-amber-300">{branchLabel(run.branch_location)}</p>
                  <p className="text-sm text-zinc-500 mt-1">
                    {new Date(run.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                  <p className="text-2xl font-black text-white mt-3 tabular-nums">{total} candidates</p>
                  <p className="text-sm text-zinc-400 mt-1">{slotCount} sessions in {formatMonthTitle(currentMonth)}</p>
                  <p className="text-base text-zinc-300 mt-2">{deltaText}</p>
                </div>
              )
            })}
          </div>
        )}

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setMonthIndex(prev => Math.max(prev - 1, 0))}
            disabled={monthIndex === 0}
            className="px-5 py-2.5 text-sm md:text-base font-semibold rounded-xl border border-white/15 text-zinc-200 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <div className="px-6 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-lg md:text-xl font-bold text-amber-300">
            {formatMonthTitle(currentMonth)}
          </div>
          <button
            type="button"
            onClick={() => setMonthIndex(prev => Math.min(prev + 1, MONTHS.length - 1))}
            disabled={monthIndex === MONTHS.length - 1}
            className="px-5 py-2.5 text-sm md:text-base font-semibold rounded-xl border border-white/15 text-zinc-200 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
          <span className="ml-auto text-sm text-zinc-500 flex items-center gap-2">
            <RefreshCw size={16} className={bookingsQuery.isFetching || syncRunsQuery.isFetching ? 'animate-spin text-amber-400' : ''} />
            {bookingsQuery.dataUpdatedAt
              ? `Data loaded ${new Date(bookingsQuery.dataUpdatedAt).toLocaleString('en-IN')}`
              : 'Loading…'}
          </span>
        </div>

        <div className="rounded-2xl border border-white/12 overflow-hidden shadow-2xl bg-[#14141a]/80">
          <div className="grid grid-cols-7 border-b border-white/10 bg-[#1a1a22]">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div
                key={day}
                className="py-4 md:py-5 text-center text-sm md:text-base font-bold uppercase tracking-[0.12em] text-zinc-400"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map((date, idx) => {
              if (!date) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="min-h-[148px] md:min-h-[200px] lg:min-h-[220px] bg-black/20 border-b border-r border-white/[0.06]"
                  />
                )
              }

              const dateKey = formatDateForIST(date)
              const daySessions = sessionsByDate.get(dateKey) ?? []
              const totalBooked = daySessions.reduce((sum, session) => sum + session.booked_count, 0)

              return (
                <div
                  key={dateKey}
                  className="min-h-[148px] md:min-h-[200px] lg:min-h-[220px] p-2.5 md:p-3 border-b border-r border-white/[0.06] bg-[#16161e]/90"
                >
                  <div className="flex items-center justify-between mb-2 md:mb-3">
                    <span className="text-lg md:text-xl font-bold text-white">{date.getDate()}</span>
                    <span
                      className="min-w-[3.25rem] rounded-lg border border-amber-300/70 bg-amber-300/15 px-2.5 py-1 text-right shadow-[0_0_18px_rgba(251,191,36,0.22)]"
                      title={`${totalBooked} total candidates`}
                    >
                      <span className="block text-[8px] font-black uppercase leading-none tracking-wider text-amber-200/85">
                        Total
                      </span>
                      <span className="block text-xl md:text-2xl font-black leading-none tabular-nums text-amber-300">
                        {totalBooked}
                      </span>
                    </span>
                  </div>

                  <div className="space-y-2">
                    {daySessions.map(session => (
                      <div
                        key={`${session.branch_location}|${session.slot_key}`}
                        className="rounded-lg border border-amber-500/25 bg-amber-500/[0.08] px-2.5 py-2 md:px-3 md:py-2.5"
                      >
                        <div className="text-sm md:text-base font-bold text-amber-200">
                          {formatTime(session.start_time)} · {session.test_type || 'G'}
                        </div>
                        <div className="text-sm md:text-base text-zinc-200 font-medium mt-0.5">
                          {session.booked_count} / {session.capacity} candidates
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default FetsCalendarDemo
