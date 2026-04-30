import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ChevronLeft, ChevronRight, Calendar, Clock, Trash2, X,
  CheckCircle, XCircle, AlertTriangle, Plus, Eye, Search,
  Users, BarChart3, RefreshCw, Filter, User, Phone, Mail,
  Award, Shield, Activity, Zap, CheckCheck, LogIn, LogOut,
  LayoutGrid, AlignJustify, Star, Grid3x3, TrendingUp, MapPin
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { MonthlyRosterTimeline } from './MonthlyRosterTimeline'
import { ShiftCellPopup } from './ShiftCellPopup'
import { EnhancedQuickAddModal } from './EnhancedQuickAddModal'
import { EnhancedRequestsModal } from './EnhancedRequestsModal'
import { RosterListView } from './RosterListView'
import { EnhancedAnalysisView } from './EnhancedAnalysisView'
import { MobileRosterView } from './MobileRosterView'
import { LocationSelectorThread } from './LocationSelectorThread'
import { useAuth } from '../hooks/useAuth'
import { useBranch } from '../hooks/useBranch'
import { canSwitchBranches, getAvailableBranches } from '../utils/authUtils'
import { supabase } from '../lib/supabase'
import { formatDateForIST, getCurrentISTDateString } from '../utils/dateUtils'
import { LeaveRequest, Schedule, StaffProfile, SHIFT_CODES, ShiftCode } from '../types/shared'
import { useIsMobile } from '../hooks/use-mobile'
import { useAttendance, useAttendanceMutations, getWeeklyAttendanceSummary, AttendanceRecord } from '../hooks/useAttendance'

import '../styles/glassmorphism.css'

// ─── Types ────────────────────────────────────────────────────────────────────
type ViewMode = 'month' | 'list'
type MainView = 'roster' | 'staff-grid' | 'attendance' | 'analysis'

const AVAILABILITY_STATUS = {
  available:  { label: 'Available',   bg: 'rgba(52,211,153,0.1)',  text: '#34d399',  dot: '#10b981' },
  on_duty:    { label: 'On Duty',     bg: 'rgba(246,200,16,0.1)',  text: '#f6c810',  dot: '#f6c810' },
  on_leave:   { label: 'On Leave',    bg: 'rgba(251,113,133,0.1)', text: '#fb7185',  dot: '#f43f5e' },
  off:        { label: 'Off',         bg: 'rgba(255,255,255,0.05)',text: '#9ca3af',  dot: '#6b7280' },
} as const

type AvailabilityKey = keyof typeof AVAILABILITY_STATUS

const CERT_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  'TCA Certified':  { bg: 'rgba(246,200,16,0.1)',  text: '#f6c810', icon: '🏅' },
  'CPR Trained':    { bg: 'rgba(251,113,133,0.1)', text: '#fb7185', icon: '❤️' },
  'Test Admin':     { bg: 'rgba(56,189,248,0.1)',  text: '#38bdf8', icon: '📋' },
  'Security Clear': { bg: 'rgba(52,211,153,0.1)',  text: '#34d399', icon: '🔒' },
}

const ATTENDANCE_STATUS = {
  present:  { bg: 'rgba(52,211,153,0.1)',  text: '#34d399',  label: 'Present' },
  late:     { bg: 'rgba(251,146,60,0.1)',  text: '#fb923c',  label: 'Late' },
  absent:   { bg: 'rgba(251,113,133,0.1)', text: '#fb7185',  label: 'Absent' },
  half_day: { bg: 'rgba(168,85,247,0.1)',  text: '#a855f7',  label: 'Half Day' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getAvatarBg = (name: string) => {
  const colors = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#f97316']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

const getInitials = (name: string) =>
  name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

const formatTimeDisplay = (time?: string | null) => {
  if (!time) return '–'
  const [h, m] = time.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const disp = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${disp}:${m} ${ampm}`
}

// ─── Staff Profile Modal ──────────────────────────────────────────────────────
function StaffProfileModal({
  staff,
  schedules,
  attendance,
  onClose,
}: {
  staff: StaffProfile
  schedules: Schedule[]
  attendance: AttendanceRecord[]
  onClose: () => void
}) {
  const staffSchedules = schedules.filter(s => s.profile_id === staff.id)
  const weeklySummary = getWeeklyAttendanceSummary(attendance, staff.id)
  const todayStr = getCurrentISTDateString()
  const todayAtt = attendance.find(a => a.staff_id === staff.id && a.date === todayStr)
  const avatarColor = getAvatarBg(staff.full_name)

  const recentSchedules = staffSchedules
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6)

  const certifications: string[] = (staff as any).certificates || []

  const shiftCount = (code: string) => staffSchedules.filter(s => s.shift_code === code).length
  const totalDays = staffSchedules.length
  const onTimeDays = staffSchedules.filter(s => s.status === 'confirmed').length

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-2xl bg-[#0A0A0B] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="relative px-6 py-5 bg-[#121214] border-b border-white/10 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0 shadow-lg"
            style={{ backgroundColor: avatarColor }}>
            {(staff as any).avatar_url
              ? <img src={(staff as any).avatar_url} alt={staff.full_name} className="w-full h-full rounded-2xl object-cover" />
              : getInitials(staff.full_name)
            }
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-white tracking-wide">{staff.full_name}</h2>
            <p className="text-sm text-white/40 mt-0.5 uppercase tracking-widest">{staff.role || 'Staff Member'}</p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {staff.branch_assigned && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f6c810]/10 text-[#f6c810] border border-[#f6c810]/20 flex items-center gap-1 uppercase tracking-widest">
                  <MapPin size={9} /> {staff.branch_assigned}
                </span>
              )}
              {staff.department && (
                <span className="text-[10px] text-white/40 uppercase tracking-widest">{staff.department}</span>
              )}
            </div>
          </div>
          {/* Today's attendance quick badge */}
          {todayAtt && (
            <div className="text-right shrink-0">
              <div className="text-[10px] text-white/40 mb-1 uppercase tracking-widest">Today</div>
              <div className={`px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest`}
                style={{
                  backgroundColor: ATTENDANCE_STATUS[todayAtt.status]?.bg,
                  color: ATTENDANCE_STATUS[todayAtt.status]?.text
                }}>
                {ATTENDANCE_STATUS[todayAtt.status]?.label}
              </div>
              {todayAtt.check_in && (
                <div className="text-[10px] text-white/40 mt-1 uppercase tracking-widest font-bold">
                  In: {formatTimeDisplay(todayAtt.check_in)}
                </div>
              )}
            </div>
          )}
          <button onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:text-rose-400 hover:bg-white/10 transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Contact info */}
          <div className="grid grid-cols-2 gap-3">
            {staff.email && (
              <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl border border-white/10">
                <Mail size={13} className="text-[#f6c810] flex-shrink-0" />
                <span className="text-xs text-white/80 truncate">{staff.email}</span>
              </div>
            )}
            {(staff as any).contact_number && (
              <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl border border-white/10">
                <Phone size={13} className="text-[#f6c810] flex-shrink-0" />
                <span className="text-xs text-white/80">{(staff as any).contact_number}</span>
              </div>
            )}
          </div>

          {/* Certification badges */}
          {certifications.length > 0 && (
            <div>
              <h4 className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-2">Certifications</h4>
              <div className="flex flex-wrap gap-2">
                {certifications.map(cert => {
                  const c = CERT_COLORS[cert] || CERT_COLORS['TCA Certified']
                  return (
                    <span key={cert} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border uppercase tracking-widest"
                      style={{ backgroundColor: c.bg, color: c.text, borderColor: c.text + '30' }}>
                      {c.icon} {cert}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* Performance metrics */}
          <div>
            <h4 className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3">Performance Metrics</h4>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Total Days', value: totalDays, color: '#f6c810' },
                { label: 'Confirmed', value: onTimeDays, color: '#34d399' },
                { label: 'Week Present', value: weeklySummary.present, color: '#60a5fa' },
                { label: 'Week Late', value: weeklySummary.late, color: '#fb923c' },
              ].map(m => (
                <div key={m.label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold" style={{ color: m.color }}>{m.value}</div>
                  <div className="text-[9px] text-white/40 font-bold uppercase tracking-widest mt-1">{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Weekly attendance breakdown */}
          <div>
            <h4 className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3">This Week's Attendance</h4>
            <div className="grid grid-cols-4 gap-2">
              {(Object.entries(ATTENDANCE_STATUS) as [string, typeof ATTENDANCE_STATUS[keyof typeof ATTENDANCE_STATUS]][]).map(([k, v]) => {
                const count = k === 'present' ? weeklySummary.present
                  : k === 'late' ? weeklySummary.late
                  : k === 'absent' ? weeklySummary.absent
                  : weeklySummary.halfDay
                return (
                  <div key={k} className="rounded-xl border p-2 text-center"
                    style={{ backgroundColor: v.bg, borderColor: v.text + '30' }}>
                    <div className="text-lg font-bold" style={{ color: v.text }}>{count}</div>
                    <div className="text-[9px] font-bold uppercase tracking-widest mt-0.5" style={{ color: v.text + 'aa' }}>{v.label}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recent schedule history */}
          {recentSchedules.length > 0 && (
            <div>
              <h4 className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3">Recent Shifts</h4>
              <div className="space-y-2">
                {recentSchedules.map(sched => {
                  const sc = SHIFT_CODES[sched.shift_code as ShiftCode]
                  return (
                    <div key={sched.id} className="flex items-center justify-between px-3 py-2 bg-white/5 border border-white/10 rounded-xl">
                      <span className="text-xs text-white/60 font-medium tracking-widest">{sched.date}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md"
                          style={{
                            background: sc?.bgColor || 'rgba(255,255,255,0.1)',
                            color: sc?.textColor || '#9ca3af'
                          }}>
                          {sched.shift_code}
                        </span>
                        {sched.overtime_hours && sched.overtime_hours > 0 && (
                          <span className="text-[10px] text-[#f6c810] font-bold">+{sched.overtime_hours}h OT</span>
                        )}
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${sched.status === 'confirmed' ? 'text-emerald-400' : 'text-white/40'}`}>
                          {sched.status}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// ─── Staff Grid View ──────────────────────────────────────────────────────────
function StaffGridView({
  staffProfiles,
  schedules,
  attendance,
  searchQuery,
  onViewProfile,
}: {
  staffProfiles: StaffProfile[]
  schedules: Schedule[]
  attendance: AttendanceRecord[]
  searchQuery: string
  onViewProfile: (staff: StaffProfile) => void
}) {
  const todayStr = getCurrentISTDateString()

  const filtered = staffProfiles.filter(s =>
    s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.role || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getAvailability = (staff: StaffProfile): AvailabilityKey => {
    const todayAtt = attendance.find(a => a.staff_id === staff.id && a.date === todayStr)
    if (todayAtt?.status === 'absent') return 'off'
    const todaySched = schedules.find(s => s.profile_id === staff.id && s.date === todayStr)
    if (!todaySched) return 'available'
    if (['L', 'RD'].includes(todaySched.shift_code)) return 'on_leave'
    if (['D', 'E', 'HD', 'OT', 'T'].includes(todaySched.shift_code)) return 'on_duty'
    return 'available'
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {filtered.map(staff => {
        const avail = getAvailability(staff)
        const av = AVAILABILITY_STATUS[avail]
        const avatarColor = getAvatarBg(staff.full_name)
        const todayAtt = attendance.find(a => a.staff_id === staff.id && a.date === todayStr)
        const certifications: string[] = (staff as any).certificates || []
        const weekSummary = getWeeklyAttendanceSummary(attendance, staff.id)

        return (
          <motion.div
            key={staff.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#121214] border border-white/10 rounded-2xl p-4 cursor-pointer
              hover:border-[#f6c810]/50 hover:shadow-lg hover:shadow-[#f6c810]/10 transition-all group"
            onClick={() => onViewProfile(staff)}
          >
            {/* Top: Avatar + status */}
            <div className="flex items-start justify-between mb-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shadow-lg"
                  style={{ backgroundColor: avatarColor }}>
                  {(staff as any).avatar_url
                    ? <img src={(staff as any).avatar_url} alt={staff.full_name} className="w-full h-full rounded-xl object-cover" />
                    : getInitials(staff.full_name)
                  }
                </div>
                {/* Online indicator */}
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#121214]"
                  style={{ backgroundColor: av.dot }} />
              </div>
              <span className="text-[10px] font-bold px-3 py-2 rounded-lg border uppercase tracking-widest"
                style={{ backgroundColor: av.bg, color: av.text, borderColor: av.text + '30' }}>
                {av.label}
              </span>
            </div>

            {/* Name & Role */}
            <div className="mb-3">
              <h3 className="text-sm font-bold text-white group-hover:text-[#f6c810] transition-colors tracking-wide">{staff.full_name}</h3>
              <p className="text-xs text-white/40 mt-0.5 uppercase tracking-widest">{staff.role || 'Staff'}</p>
              {staff.branch_assigned && (
                <p className="text-[10px] text-white/40 mt-0.5 flex items-center gap-1 uppercase tracking-widest">
                  <MapPin size={9} />{staff.branch_assigned}
                </p>
              )}
            </div>

            {/* Today's check-in/out */}
            {todayAtt && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2.5 bg-white/5 rounded-lg border border-white/5">
                {todayAtt.check_in && (
                  <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold tracking-widest">
                    <LogIn size={10} />
                    <span>{formatTimeDisplay(todayAtt.check_in)}</span>
                  </div>
                )}
                {todayAtt.check_out && (
                  <div className="flex items-center gap-1 text-[10px] text-rose-400 ml-auto font-bold tracking-widest">
                    <LogOut size={10} />
                    <span>{formatTimeDisplay(todayAtt.check_out)}</span>
                  </div>
                )}
                {todayAtt.status === 'late' && (
                  <span className="ml-auto text-[9px] font-bold text-orange-400 px-1.5 py-0.5 rounded bg-orange-400/10 tracking-widest">LATE</span>
                )}
              </div>
            )}

            {/* Certification badges */}
            {certifications.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {certifications.slice(0, 2).map(cert => {
                  const c = CERT_COLORS[cert] || { bg: 'rgba(246,200,16,0.1)', text: '#f6c810', icon: '🏅' }
                  return (
                    <span key={cert} className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest"
                      style={{ backgroundColor: c.bg, color: c.text }}>
                      {c.icon} {cert.split(' ')[0]}
                    </span>
                  )
                })}
                {certifications.length > 2 && (
                  <span className="text-[9px] text-white/40 font-bold">+{certifications.length - 2}</span>
                )}
              </div>
            )}

            {/* Weekly summary mini bar */}
            <div className="flex items-center gap-1.5 text-[9px] text-white/40 pt-2 border-t border-white/10 font-bold tracking-widest">
              <div className="flex items-center gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>{weekSummary.present}</span>
              </div>
              <div className="flex items-center gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                <span>{weekSummary.late}</span>
              </div>
              <div className="flex items-center gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>{weekSummary.absent}</span>
              </div>
              <span className="ml-auto text-white/40 flex items-center gap-0.5 uppercase tracking-widest">
                <Eye size={9} className="group-hover:text-[#f6c810] transition-colors" /> Profile
              </span>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── Attendance Tracking View ─────────────────────────────────────────────────
function AttendanceView({
  staffProfiles,
  attendance,
  currentDate,
  onCheckIn,
  onCheckOut,
  onUpdateStatus,
  isUpdating,
}: {
  staffProfiles: StaffProfile[]
  attendance: AttendanceRecord[]
  currentDate: Date
  onCheckIn: (staffId: string) => void
  onCheckOut: (staffId: string) => void
  onUpdateStatus: (staffId: string, status: AttendanceRecord['status']) => void
  isUpdating: boolean
}) {
  const todayStr = formatDateForIST(currentDate)
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = staffProfiles.filter(s =>
    s.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const stats = useMemo(() => {
    const todayRecs = attendance.filter(a => a.date === todayStr)
    return {
      present: todayRecs.filter(a => a.status === 'present').length,
      late: todayRecs.filter(a => a.status === 'late').length,
      absent: todayRecs.filter(a => a.status === 'absent').length,
      total: staffProfiles.length,
    }
  }, [attendance, todayStr, staffProfiles])

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Staff', value: stats.total, color: '#f6c810', bg: 'rgba(246,200,16,0.1)' },
          { label: 'Present', value: stats.present, color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
          { label: 'Late', value: stats.late, color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
          { label: 'Absent', value: stats.absent, color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
        ].map(s => (
          <div key={s.label} className="bg-[#121214] border border-white/10 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 bg-[#121214] border border-white/10 rounded-xl px-4 py-3">
        <Search size={14} className="text-white/40" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search staff…"
          className="flex-1 bg-transparent text-sm text-white placeholder-white/40 outline-none"
        />
        <span className="text-xs text-white/40 font-bold tracking-widest uppercase">{todayStr}</span>
      </div>

      {/* Attendance table */}
      <div className="bg-[#121214] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="grid grid-cols-[1fr_120px_100px_100px_120px_auto] gap-3 px-4 py-3 bg-white/5 border-b border-white/10 text-[10px] font-bold text-white/40 uppercase tracking-widest">
          <span>Staff</span>
          <span>Status</span>
          <span>Check In</span>
          <span>Check Out</span>
          <span>Duration</span>
          <span>Actions</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-white/5">
          {filtered.map(staff => {
            const rec = attendance.find(a => a.staff_id === staff.id && a.date === todayStr)
            const avatarColor = getAvatarBg(staff.full_name)
            const isLate = rec?.status === 'late'

            // Calculate duration if both check in and out exist
            let duration = '–'
            if (rec?.check_in && rec?.check_out) {
              const [ih, im] = rec.check_in.split(':').map(Number)
              const [oh, om] = rec.check_out.split(':').map(Number)
              const mins = (oh * 60 + om) - (ih * 60 + im)
              if (mins > 0) duration = `${Math.floor(mins / 60)}h ${mins % 60}m`
            }

            return (
              <div
                key={staff.id}
                className={`grid grid-cols-[1fr_120px_100px_100px_120px_auto] gap-3 px-4 py-3 items-center
                  hover:bg-white/5 transition-colors
                  ${isLate ? 'border-l-2 border-l-orange-500' : ''}`}
              >
                {/* Staff info */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: avatarColor }}>
                    {getInitials(staff.full_name)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate tracking-wide">{staff.full_name}</div>
                    <div className="text-[10px] text-white/40 truncate uppercase tracking-widest">{staff.role}</div>
                  </div>
                </div>

                {/* Status */}
                <div>
                  {rec ? (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg uppercase tracking-widest"
                      style={{
                        backgroundColor: ATTENDANCE_STATUS[rec.status]?.bg,
                        color: ATTENDANCE_STATUS[rec.status]?.text
                      }}>
                      {ATTENDANCE_STATUS[rec.status]?.label}
                    </span>
                  ) : (
                    <select
                      defaultValue=""
                      onChange={e => e.target.value && onUpdateStatus(staff.id, e.target.value as AttendanceRecord['status'])}
                      className="bg-white/5 border border-white/10 rounded-lg text-[10px] text-white/80 px-3 py-2 outline-none cursor-pointer uppercase tracking-widest font-bold"
                      disabled={isUpdating}
                    >
                      <option value="">Mark…</option>
                      <option value="absent">Absent</option>
                      <option value="half_day">Half Day</option>
                    </select>
                  )}
                </div>

                {/* Check In */}
                <span className={`text-xs font-mono ${isLate ? 'text-orange-400' : 'text-slate-200'}`}>
                  {rec?.check_in ? formatTimeDisplay(rec.check_in) : '–'}
                </span>

                {/* Check Out */}
                <span className="text-xs font-mono text-slate-200">
                  {rec?.check_out ? formatTimeDisplay(rec.check_out) : '–'}
                </span>

                {/* Duration */}
                <span className="text-xs text-slate-400 font-mono">{duration}</span>

                {/* Actions */}
                <div className="flex items-center gap-1.5">
                  {!rec?.check_in ? (
                    <button
                      onClick={() => onCheckIn(staff.id)}
                      disabled={isUpdating}
                      className="flex items-center gap-1 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-sm font-bold hover:bg-emerald-500/20 transition-colors disabled:opacity-40">
                      <LogIn size={10} /> In
                    </button>
                  ) : !rec?.check_out ? (
                    <button
                      onClick={() => onCheckOut(staff.id)}
                      disabled={isUpdating}
                      className="flex items-center gap-1 px-4 py-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg text-sm font-bold hover:bg-rose-500/20 transition-colors disabled:opacity-40">
                      <LogOut size={10} /> Out
                    </button>
                  ) : (
                    <CheckCheck size={14} className="text-emerald-400" />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function FetsRosterPremium() {
  const { user, profile } = useAuth()
  const { activeBranch, setActiveBranch } = useBranch()
  const canSwitchCentre = canSwitchBranches(profile?.email, profile?.role)
  const centreOptions = getAvailableBranches(profile?.email, profile?.role)
  const isMobile = useIsMobile()

  // Core state
  const [currentDate, setCurrentDate] = useState(new Date())
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([])
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [mainView, setMainView] = useState<MainView>('roster')
  const [searchQuery, setSearchQuery] = useState('')

  // UI state
  const [selectedCell, setSelectedCell] = useState<{ profileId: string; date: string } | null>(null)
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('')
  const [showQuickAddModal, setShowQuickAddModal] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [showShiftCellPopup, setShowShiftCellPopup] = useState(false)
  const [showRequestsModal, setShowRequestsModal] = useState(false)
  const [selectedProfileForModal, setSelectedProfileForModal] = useState<StaffProfile | null>(null)
  const [selectedCellData, setSelectedCellData] = useState<{
    profileId: string; date: string; staffName: string; currentShift?: string; currentOvertimeHours?: number
  } | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null)

  const { hasPermission } = useAuth()
  const canEdit = hasPermission('can_edit_roster')

  // Attendance
  const todayStr = getCurrentISTDateString()
  const weekStart = useMemo(() => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() - d.getDay())
    return formatDateForIST(d)
  }, [currentDate])
  const { data: attendance = [] } = useAttendance(weekStart, todayStr, activeBranch)
  const { checkIn, checkOut, updateStatus, isChecking } = useAttendanceMutations()

  const showNotification = useCallback((type: 'success' | 'error' | 'warning', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000)
  }, [])

  const getViewDateRange = useCallback(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const startDate = new Date(Date.UTC(year, month, 1, 12, 0, 0))
    const endDate = new Date(Date.UTC(year, month + 1, 0, 12, 0, 0))
    return { startDate, endDate }
  }, [currentDate])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const { data: profiles, error: profilesError } = await supabase
        .from('staff_profiles')
        .select('id, user_id, full_name, role, email, department, branch_assigned, is_active, employment_end_date')
        .not('full_name', 'in', '("MITHUN","NIYAS","Mithun","Niyas")')
        .order('full_name')

      if (profilesError) throw profilesError

      const mappedProfiles: StaffProfile[] = (profiles || []).map(p => ({
        id: p.id, user_id: p.user_id, full_name: p.full_name,
        role: p.role, email: p.email || '', department: p.department, branch_assigned: p.branch_assigned,
        is_active: p.is_active, employment_end_date: p.employment_end_date
      } as StaffProfile))

      const { startDate, endDate } = getViewDateRange()
      const monthStartStr = startDate.toISOString().split('T')[0]
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('roster_schedules')
        .select('id, profile_id, date, shift_code, overtime_hours, status, created_at, updated_at')
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .order('date')
        
      if (scheduleError) throw scheduleError
      
      const sData = scheduleData || []

      const relevantProfiles = mappedProfiles.filter(p => {
        let branchOk = false
        if (activeBranch === 'global') branchOk = true
        else if (p.branch_assigned === activeBranch) branchOk = true
        else {
          const isUnassigned = !p.branch_assigned || p.branch_assigned.trim() === '' || p.branch_assigned === 'inactive'
          const hasShift = sData.some(s => s.profile_id === p.id)
          branchOk = isUnassigned && hasShift
        }
        if (!branchOk) return false

        // Archived staff: show for the month of employment_end_date (and earlier months), for salary/roster history.
        const isActive = p.is_active !== false
        if (isActive) return true
        const end = p.employment_end_date
        if (end && end >= monthStartStr) return true
        if (!end && sData.some(s => s.profile_id === p.id)) return true
        return false
      })

      setStaffProfiles(relevantProfiles)
      
      const relevantProfileIds = new Set(relevantProfiles.map(p => p.id))
      const relevantSchedules = sData.filter(s => relevantProfileIds.has(s.profile_id))
      setSchedules(relevantSchedules)

      const { data: requestData, error: requestError } = await supabase
        .from('leave_requests').select('*').order('created_at', { ascending: false })
      if (requestError) throw requestError
      setRequests(requestData || [])
    } catch (err) {
      console.error('Error loading data:', err)
      showNotification('error', `Failed to load data: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }, [activeBranch, getViewDateRange, showNotification])

  const getViewTitle = () => {
    const m = ['January','February','March','April','May','June','July','August','September','October','November','December']
    return `${m[currentDate.getMonth()]} ${currentDate.getFullYear()}`
  }

  const navigateDate = (dir: 'prev' | 'next') => {
    const d = new Date(currentDate)
    d.setMonth(d.getMonth() + (dir === 'next' ? 1 : -1))
    setCurrentDate(d)
  }

  const getStaffName = (profileId: string) =>
    staffProfiles.find(s => s.id === profileId)?.full_name || 'Unknown Staff'

  const updateVersionTracking = async (action: string) => {
    try {
      await supabase.from('roster_audit_log').insert({
        action, performed_by: profile?.id || user?.id, performed_at: new Date().toISOString()
      })
    } catch (err) { console.error('Version tracking error:', err) }
  }

  const handleCellClick = (profileId: string, date: Date) => {
    if (!canEdit) {
      showNotification('warning', 'Roster editing is restricted to Mithun super admin.')
      return
    }
    const dateStr = formatDateForIST(date)
    const staffMember = staffProfiles.find(s => s.id === profileId)
    const existing = schedules.find(s => s.profile_id === profileId && s.date === dateStr)
    setSelectedCellData({
      profileId, date: dateStr, staffName: staffMember?.full_name || 'Unknown',
      currentShift: existing?.shift_code || '', currentOvertimeHours: existing?.overtime_hours || 0
    })
    setShowShiftCellPopup(true)
  }

  const handleShiftCellSave = async (shiftData: { shift_code: string; overtime_hours: number }) => {
    if (!selectedCellData || !user || !canEdit || !profile) {
      showNotification('warning', 'Unable to save shift - permission or context issue')
      return
    }

    const scheduleData = {
      profile_id: selectedCellData.profileId, date: selectedCellData.date,
      shift_code: shiftData.shift_code, overtime_hours: shiftData.overtime_hours,
      status: 'confirmed', updated_at: new Date().toISOString()
    }
    const existingIndex = schedules.findIndex(s =>
      s.profile_id === selectedCellData.profileId && s.date === selectedCellData.date
    )
    const newSchedules = [...schedules]
    if (existingIndex > -1) {
      newSchedules[existingIndex] = { ...newSchedules[existingIndex], ...scheduleData }
    } else {
      newSchedules.push({ ...scheduleData, id: 'temp-' + Date.now(), created_at: new Date().toISOString() })
    }
    setSchedules(newSchedules)

    try {
      if (existingIndex > -1) {
        const { error } = await supabase.from('roster_schedules')
          .update(scheduleData).eq('id', schedules[existingIndex].id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('roster_schedules')
          .insert([{ ...scheduleData, created_at: new Date().toISOString() }])
        if (error) throw error
      }
      await updateVersionTracking(`Updated shift for ${selectedCellData.staffName}`)
      showNotification('success', 'Shift updated successfully!')
      loadData()
    } catch (err) {
      console.error('Error saving shift:', err)
      showNotification('error', `Failed to save shift: ${err instanceof Error ? err.message : 'Unknown error'}`)
      setSchedules(schedules)
    }
  }

  const handleShiftCellDelete = async () => {
    if (!selectedCellData || !user || !canEdit) {
      showNotification('warning', 'Unable to delete shift - permission or context issue')
      return
    }
    try {
      const existing = schedules.find(s =>
        s.profile_id === selectedCellData.profileId && s.date === selectedCellData.date
      )
      if (existing) {
        const { error } = await supabase.from('roster_schedules').delete().eq('id', existing.id)
        if (error) throw error
        await updateVersionTracking(`Deleted shift for ${selectedCellData.staffName} on ${selectedCellData.date}`)
        await loadData()
        showNotification('success', 'Shift deleted successfully!')
      }
    } catch (err) {
      showNotification('error', `Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const filteredStaff = useMemo(() =>
    staffProfiles.filter(s => !selectedStaffFilter || s.id === selectedStaffFilter),
    [staffProfiles, selectedStaffFilter]
  )

  // Attendance handlers
  const handleCheckIn = async (staffId: string) => {
    try {
      await checkIn({ staff_id: staffId, date: todayStr, branch_location: activeBranch || undefined })
    } catch (err) { console.error(err) }
  }

  const handleCheckOut = async (staffId: string) => {
    try {
      await checkOut({ staff_id: staffId, date: todayStr })
    } catch (err) { console.error(err) }
  }

  const handleUpdateAttStatus = async (staffId: string, status: AttendanceRecord['status']) => {
    try {
      await updateStatus({ staff_id: staffId, date: todayStr, status })
    } catch (err) { console.error(err) }
  }

  useEffect(() => { loadData() }, [activeBranch, currentDate, viewMode, loadData])

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-[#0A0A0B]">
      <div className="bg-[#121214] p-8 rounded-2xl border border-white/10 flex flex-col items-center gap-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-white/10" />
          <div className="absolute inset-0 rounded-full border-2 border-t-[#f6c810] animate-spin" />
        </div>
        <p className="text-white/60 font-medium uppercase tracking-widest text-sm">Loading roster data…</p>
      </div>
    </div>
  )

  // ── Mobile ───────────────────────────────────────────────────────────────
  if (isMobile) return (
    <div className={`min-h-screen bg-[#0A0A0B] pt-8 pb-32 px-4`}>
      <div className="flex justify-center w-full -mt-2 mb-2">
        <LocationSelectorThread
          activeBranch={activeBranch}
          setActiveBranch={setActiveBranch as (b: string) => void}
          availableBranches={centreOptions}
          canSwitch={canSwitchCentre}
        />
      </div>
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl bg-[#121214] border ${
          notification.type === 'success' ? 'border-emerald-500/50 text-emerald-400' :
          notification.type === 'error' ? 'border-rose-500/50 text-rose-400' : 'border-[#f6c810]/50 text-[#f6c810]'
        }`}>
          <div className="flex items-center gap-2 text-sm font-medium">
            {notification.type === 'success' && <CheckCircle className="h-4 w-4" />}
            {notification.type === 'error' && <XCircle className="h-4 w-4" />}
            {notification.type === 'warning' && <AlertTriangle className="h-4 w-4" />}
            {notification.message}
          </div>
        </div>
      )}
      <MobileRosterView
        staffProfiles={filteredStaff}
        schedules={schedules}
        currentDate={currentDate}
        onNavigate={navigateDate}
        onCellClick={handleCellClick}
      />
      <ShiftCellPopup
        isOpen={showShiftCellPopup}
        onClose={() => setShowShiftCellPopup(false)}
        onSave={handleShiftCellSave}
        onDelete={handleShiftCellDelete}
        currentShift={selectedCellData?.currentShift}
        currentOvertimeHours={selectedCellData?.currentOvertimeHours}
        staffName={selectedCellData?.staffName || ''}
        date={selectedCellData?.date || ''}
      />
    </div>
  )

  // ── Desktop ──────────────────────────────────────────────────────────────
  const NAV_ITEMS: { id: MainView; icon: React.ReactNode; label: string }[] = [
    { id: 'roster',      icon: <Calendar size={15} />,    label: 'Schedule' },
    { id: 'staff-grid',  icon: <LayoutGrid size={15} />,  label: 'Staff' },
    { id: 'attendance',  icon: <CheckCheck size={15} />,  label: 'Attendance' },
    { id: 'analysis',    icon: <BarChart3 size={15} />,   label: 'Analysis' },
  ]

  return (
    <div className={`min-h-screen bg-gradient-to-br from-[#0A0A0B] via-[#121214] to-[#0A0A0B] -mt-32 pt-56 px-6`}
      style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <div className="max-w-[1800px] mx-auto">

        {/* ── HEADER (same centre selector placement as FETS LIVE) ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-8 mt-4 relative z-50"
        >
          <div className="relative min-w-0">
            <div className="flex items-center gap-4 mb-3">
              <div className="h-[1px] w-12 bg-[#FACC15]" />
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#FACC15]">
                Roster {activeBranch !== 'global' && `// ${activeBranch.toUpperCase()}`}
              </span>
            </div>
            <div className="text-4xl md:text-6xl font-black text-[#FACC15] tracking-tighter leading-none">
              SCHEDULE
            </div>
          </div>

          <div className="hidden lg:block lg:flex-1" />

          <div className="flex items-center gap-4 flex-wrap justify-end w-full lg:w-auto">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white/60 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg">
              <Users size={14} className="text-[#f6c810]" />
              <span>{staffProfiles.length} staff members</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white/60 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg">
              <Calendar size={14} className="text-[#f6c810]" />
              <span>{new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
          </div>
        </motion.div>

        {/* ── NOTIFICATION ── */}
        {notification && (
          <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl bg-[#121214] shadow-xl border ${
            notification.type === 'success' ? 'border-emerald-500/40 text-emerald-400' :
            notification.type === 'error' ? 'border-rose-500/40 text-rose-400' : 'border-[#f6c810]/40 text-[#f6c810]'
          }`}>
            <div className="flex items-center gap-3">
              {notification.type === 'success' && <CheckCircle className="h-5 w-5" />}
              {notification.type === 'error' && <XCircle className="h-5 w-5" />}
              {notification.type === 'warning' && <AlertTriangle className="h-5 w-5" />}
              <span className="font-medium text-sm tracking-wide">{notification.message}</span>
            </div>
          </div>
        )}

        {/* ── CONTROL TOOLBAR ── */}
        <div className="bg-[#121214] border border-white/10 rounded-2xl p-4 mb-8 flex flex-wrap items-center justify-between gap-4 shadow-2xl">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Main view tabs */}
            <div className="flex items-center bg-white/5 rounded-xl border border-white/10 p-1 gap-1">
              {NAV_ITEMS.map(({ id, icon, label }) => (
                <button key={id}
                  onClick={() => setMainView(id)}
                  className={`flex items-center gap-1.5 px-5 py-3 rounded-lg text-sm font-bold uppercase tracking-widest transition-all ${
                    mainView === id
                      ? 'bg-[#f6c810] text-black shadow-[0_0_12px_rgba(246,200,16,0.4)]'
                      : 'text-white/40 hover:text-white/80 hover:bg-white/5'}`}>
                  {icon} {label}
                </button>
              ))}
            </div>

            {/* Date navigation (roster view only) */}
            {(mainView === 'roster' || mainView === 'attendance') && (
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-white/5 rounded-xl border border-white/10">
                  <button onClick={() => navigateDate('prev')}
                    className="p-2 hover:bg-white/10 rounded-l-xl transition-colors">
                    <ChevronLeft className="h-5 w-5 text-white/40" />
                  </button>
                  <h2 className="text-sm font-bold text-white min-w-[180px] text-center uppercase tracking-widest">{getViewTitle()}</h2>
                  <button onClick={() => navigateDate('next')}
                    className="p-2 hover:bg-white/10 rounded-r-xl transition-colors">
                    <ChevronRight className="h-5 w-5 text-white/40" />
                  </button>
                </div>
                <button onClick={() => setCurrentDate(new Date())}
                  className="px-4 py-2.5 text-sm font-bold text-white/60 bg-white/5 border border-white/10 rounded-xl hover:border-[#f6c810]/50 hover:text-[#f6c810] transition-colors uppercase tracking-widest">
                  Today
                </button>
              </div>
            )}

            {/* Search (staff grid) */}
            {mainView === 'staff-grid' && (
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search staff…"
                  className="pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#f6c810]/50 w-44 transition-all uppercase tracking-widest"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* View mode toggle (roster only) */}
            {mainView === 'roster' && (
              <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
                <button onClick={() => setViewMode('month')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${viewMode === 'month' ? 'bg-[#f6c810] text-black shadow-[0_0_12px_rgba(246,200,16,0.4)]' : 'text-white/40 hover:text-white/80 hover:bg-white/5'}`}>
                  Timeline
                </button>
                <button onClick={() => setViewMode('list')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${viewMode === 'list' ? 'bg-[#f6c810] text-black shadow-[0_0_12px_rgba(246,200,16,0.4)]' : 'text-white/40 hover:text-white/80 hover:bg-white/5'}`}>
                  List
                </button>
              </div>
            )}

            {/* Staff filter */}
            <div className="relative">
              <button onClick={() => setShowFilter(!showFilter)}
                className={`p-2 rounded-xl border transition-colors ${showFilter ? 'bg-[#f6c810]/10 border-[#f6c810]/40 text-[#f6c810]' : 'bg-[#0A0A0B] border-[rgba(255, 255, 255, 0.1)] text-slate-400 hover:text-slate-200'}`}>
                <Filter className="h-4 w-4" />
              </button>
              <AnimatePresence>
                {showFilter && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute right-0 mt-2 w-56 bg-[#121214] border border-[rgba(255, 255, 255, 0.1)] rounded-xl shadow-2xl z-20 max-h-80 overflow-y-auto"
                  >
                    <div className="p-3">
                      <div className="text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-wider">Filter by Staff</div>
                      <button onClick={() => { setSelectedStaffFilter(''); setShowFilter(false) }}
                        className="block w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-[rgba(255, 255, 255, 0.1)] rounded-lg mb-1 font-semibold transition-colors">
                        All Staff
                      </button>
                      {staffProfiles.map(s => (
                        <button key={s.id} onClick={() => { setSelectedStaffFilter(s.id); setShowFilter(false) }}
                          className={`block w-full text-left px-4 py-2.5 text-sm rounded-lg transition-colors ${selectedStaffFilter === s.id ? 'bg-[#f6c810]/10 text-[#f6c810]' : 'text-slate-300 hover:bg-[rgba(255, 255, 255, 0.1)]'}`}>
                          {s.full_name}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Quick Add */}
            {mainView === 'roster' && (
              <button onClick={() => setShowQuickAddModal(true)} disabled={!canEdit}
                className="flex items-center gap-2 px-4 py-2 bg-[#f6c810] hover:bg-[#eab308] text-black text-xs font-bold rounded-xl shadow transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Quick Add</span>
              </button>
            )}

            {/* Requests */}
            <button onClick={() => setShowRequestsModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[rgba(255, 255, 255, 0.1)] hover:bg-[rgba(255, 255, 255, 0.2)] text-white text-xs font-bold rounded-xl shadow transition-all">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Requests</span>
            </button>

            {/* Refresh */}
            <button onClick={loadData}
              className="p-2 bg-[#0A0A0B] border border-[rgba(255, 255, 255, 0.1)] rounded-xl text-slate-400 hover:text-slate-200 hover:border-zinc-600 transition-colors">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div className="bg-[#121214] border border-[rgba(255, 255, 255, 0.1)] rounded-2xl p-6 min-h-[600px]">
          <AnimatePresence mode="wait">
            {/* SCHEDULE TIMELINE / LIST */}
            {mainView === 'roster' && (
              <motion.div key="roster"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {viewMode === 'month' ? (
                  <MonthlyRosterTimeline
                    staffProfiles={filteredStaff}
                    schedules={schedules}
                    currentDate={currentDate}
                    onCellClick={handleCellClick}
                  />
                ) : (
                  <RosterListView schedules={schedules} staffProfiles={staffProfiles} />
                )}
              </motion.div>
            )}

            {/* STAFF GRID */}
            {mainView === 'staff-grid' && (
              <motion.div key="staff-grid"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-200">
                    {filteredStaff.length} Staff Members
                    {activeBranch && activeBranch !== 'global' ? ` · ${activeBranch}` : ' · All Branches'}
                  </h3>
                </div>
                <StaffGridView
                  staffProfiles={filteredStaff}
                  schedules={schedules}
                  attendance={attendance}
                  searchQuery={searchQuery}
                  onViewProfile={setSelectedProfileForModal}
                />
              </motion.div>
            )}

            {/* ATTENDANCE */}
            {mainView === 'attendance' && (
              <motion.div key="attendance"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <AttendanceView
                  staffProfiles={filteredStaff}
                  attendance={attendance}
                  currentDate={currentDate}
                  onCheckIn={handleCheckIn}
                  onCheckOut={handleCheckOut}
                  onUpdateStatus={handleUpdateAttStatus}
                  isUpdating={isChecking}
                />
              </motion.div>
            )}

            {/* ANALYSIS */}
            {mainView === 'analysis' && (
              <motion.div key="analysis"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <EnhancedAnalysisView
                  schedules={schedules}
                  staffProfiles={filteredStaff}
                  requests={requests}
                  currentDate={currentDate}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── MODALS ── */}
      <EnhancedQuickAddModal
        isOpen={showQuickAddModal}
        onClose={() => setShowQuickAddModal(false)}
        onSuccess={loadData}
        staffProfiles={staffProfiles}
        currentDate={currentDate}
      />
      <EnhancedRequestsModal
        isOpen={showRequestsModal}
        onClose={() => setShowRequestsModal(false)}
        onSuccess={loadData}
        staffProfiles={filteredStaff}
      />
      <ShiftCellPopup
        isOpen={showShiftCellPopup}
        onClose={() => setShowShiftCellPopup(false)}
        onSave={handleShiftCellSave}
        onDelete={handleShiftCellDelete}
        currentShift={selectedCellData?.currentShift}
        currentOvertimeHours={selectedCellData?.currentOvertimeHours}
        staffName={selectedCellData?.staffName || ''}
        date={selectedCellData?.date || ''}
      />
      <AnimatePresence>
        {selectedProfileForModal && (
          <StaffProfileModal
            staff={selectedProfileForModal}
            schedules={schedules}
            attendance={attendance}
            onClose={() => setSelectedProfileForModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default FetsRosterPremium
