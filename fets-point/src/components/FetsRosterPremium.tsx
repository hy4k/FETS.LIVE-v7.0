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

  // New States for TE OP-XY Layout
  const [activeMenu, setActiveMenu] = useState<'roster' | 'check-in' | 'my-attendance' | 'leave' | 'shift-swap' | 'tool'>('roster')
  const [timelineViewMode, setTimelineViewMode] = useState<'month' | '7day'>('month')
  const [activeToolTab, setActiveToolTab] = useState<'staff-grid' | 'analysis' | 'list' | 'manage-requests'>('staff-grid')

  const [leaveDate, setLeaveDate] = useState('')
  const [leaveReason, setLeaveReason] = useState('')
  const [leaveSubmitting, setLeaveSubmitting] = useState(false)

  const [swapDate, setSwapDate] = useState('')
  const [swapTargetStaff, setSwapTargetStaff] = useState('')
  const [swapReason, setSwapReason] = useState('')
  const [swapSubmitting, setSwapSubmitting] = useState(false)

  const [myAttendanceLogs, setMyAttendanceLogs] = useState<any[]>([])
  const [myAttendanceLoading, setMyAttendanceLoading] = useState(false)

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
        .select('id, profile_id, date, shift_code, overtime_hours, status, created_at, updated_at, branch_location')
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .order('date')
        
      if (scheduleError) throw scheduleError
      
      const sData = scheduleData || []

      const relevantProfiles = mappedProfiles.filter(p => {
        let branchOk = false
        if (activeBranch === 'global') branchOk = true
        else if (p.branch_assigned === activeBranch) branchOk = true
        else if (p.branch_assigned === 'global') branchOk = true // Global admins show on all grids
        else {
          const isUnassigned = !p.branch_assigned || p.branch_assigned.trim() === '' || p.branch_assigned === 'inactive'
          const hasShiftAtBranch = sData.some(s => s.profile_id === p.id && s.branch_location === activeBranch)
          branchOk = (isUnassigned && sData.some(s => s.profile_id === p.id)) || hasShiftAtBranch
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
        .from('leave_requests')
        .select(`
          *,
          requestor:staff_profiles!leave_requests_user_id_fkey(full_name),
          target:staff_profiles!leave_requests_swap_with_user_id_fkey(full_name)
        `)
        .order('created_at', { ascending: false })

      if (requestError) throw requestError

      const mappedRequests: LeaveRequest[] = (requestData || []).map(req => ({
        id: req.id,
        user_id: req.user_id,
        request_type: req.request_type,
        requested_date: req.requested_date,
        swap_with_user_id: req.swap_with_user_id,
        reason: req.reason,
        status: req.status,
        created_at: req.created_at,
        approved_at: req.approved_at,
        approved_by: req.approved_by,
        swap_date: req.swap_date,
        updated_at: req.updated_at,
        requestor_name: (req.requestor as any)?.full_name || 'Unknown',
        target_name: (req.target as any)?.full_name || 'Unknown'
      }))

      setRequests(mappedRequests)
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
    if (timelineViewMode === '7day') {
      d.setDate(d.getDate() + (dir === 'next' ? 7 : -7))
    } else {
      d.setMonth(d.getMonth() + (dir === 'next' ? 1 : -1))
    }
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

    const staffMember = staffProfiles.find(s => s.id === selectedCellData.profileId)
    const scheduleBranch = activeBranch === 'global' ? (staffMember?.branch_assigned || 'calicut') : activeBranch
    const scheduleBranchFinal = scheduleBranch === 'global' ? 'calicut' : scheduleBranch

    const scheduleData = {
      profile_id: selectedCellData.profileId, date: selectedCellData.date,
      shift_code: shiftData.shift_code, overtime_hours: shiftData.overtime_hours,
      status: 'confirmed', updated_at: new Date().toISOString(),
      branch_location: scheduleBranchFinal
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

  const loadMyAttendance = useCallback(async () => {
    if (!profile?.id) return
    try {
      setMyAttendanceLoading(true)
      const { data, error } = await supabase
        .from('staff_attendance')
        .select('*')
        .eq('staff_id', profile.id)
        .order('date', { ascending: false })
        .limit(30)
      if (error) throw error
      setMyAttendanceLogs(data || [])
    } catch (e) {
      console.error('Error fetching personal attendance:', e)
    } finally {
      setMyAttendanceLoading(false)
    }
  }, [profile?.id])

  useEffect(() => {
    if (activeMenu === 'my-attendance') {
      loadMyAttendance()
    }
  }, [activeMenu, loadMyAttendance])

  const handleCreateLeave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!leaveDate || !profile?.id) return
    setLeaveSubmitting(true)
    try {
      const { error } = await supabase.from('leave_requests').insert({
        user_id: profile.id,
        request_type: 'leave',
        requested_date: leaveDate,
        reason: leaveReason || null,
        status: 'pending'
      })
      if (error) throw error
      showNotification('success', 'Leave request created successfully')
      setLeaveDate('')
      setLeaveReason('')
      loadData()
    } catch (err) {
      console.error(err)
      showNotification('error', 'Failed to create leave request')
    } finally {
      setLeaveSubmitting(false)
    }
  }

  const handleCreateSwap = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!swapDate || !swapTargetStaff || !profile?.id) return
    setSwapSubmitting(true)
    try {
      const { error } = await supabase.from('leave_requests').insert({
        user_id: profile.id,
        request_type: 'shift_swap',
        requested_date: swapDate,
        swap_with_user_id: swapTargetStaff,
        reason: swapReason || null,
        status: 'pending'
      })
      if (error) throw error
      showNotification('success', 'Shift swap request created successfully')
      setSwapDate('')
      setSwapTargetStaff('')
      setSwapReason('')
      loadData()
    } catch (err) {
      console.error(err)
      showNotification('error', 'Failed to create shift swap request')
    } finally {
      setSwapSubmitting(false)
    }
  }

  const performShiftSwap = async (user1Id: string, user2Id: string, date: string) => {
    const { data: shifts, error: fetchError } = await supabase
      .from('roster_schedules')
      .select('*')
      .in('profile_id', [user1Id, user2Id])
      .eq('date', date)

    if (fetchError) throw fetchError

    const user1Shift = shifts?.find(s => s.profile_id === user1Id)
    const user2Shift = shifts?.find(s => s.profile_id === user2Id)

    if (shifts && shifts.length > 0) {
      const { error: deleteError } = await supabase
        .from('roster_schedules')
        .delete()
        .in('id', shifts.map(s => s.id))

      if (deleteError) throw deleteError
    }

    const newShifts = []
    const scheduleBranch = activeBranch === 'global' ? 'calicut' : activeBranch
    if (user1Shift) {
      newShifts.push({
        profile_id: user2Id,
        date: date,
        shift_code: user1Shift.shift_code,
        overtime_hours: user1Shift.overtime_hours || 0,
        status: 'confirmed',
        branch_location: scheduleBranch
      })
    }
    if (user2Shift) {
      newShifts.push({
        profile_id: user1Id,
        date: date,
        shift_code: user2Shift.shift_code,
        overtime_hours: user2Shift.overtime_hours || 0,
        status: 'confirmed',
        branch_location: scheduleBranch
      })
    }
    if (newShifts.length > 0) {
      const { error: insertError } = await supabase
        .from('roster_schedules')
        .insert(newShifts)

      if (insertError) throw insertError
    }
  }

  const handleApproveRequest = async (req: LeaveRequest) => {
    try {
      const { error: updateError } = await supabase
        .from('leave_requests')
        .update({
          status: 'approved',
          approved_by: profile?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', req.id)

      if (updateError) throw updateError

      if (req.request_type === 'shift_swap' && req.swap_with_user_id) {
        await performShiftSwap(req.user_id, req.swap_with_user_id, req.requested_date)
      }
      showNotification('success', 'Request approved successfully')
      loadData()
    } catch (err) {
      console.error(err)
      showNotification('error', 'Failed to approve request')
    }
  }

  const handleRejectRequest = async (id: string) => {
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: 'rejected',
          approved_by: profile?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', id)
      if (error) throw error
      showNotification('success', 'Request rejected')
      loadData()
    } catch (err) {
      console.error(err)
      showNotification('error', 'Failed to reject request')
    }
  }

  const handleDeleteRequest = async (id: string) => {
    try {
      const { error } = await supabase.from('leave_requests').delete().eq('id', id)
      if (error) throw error
      showNotification('success', 'Request deleted successfully')
      loadData()
    } catch (err) {
      console.error(err)
      showNotification('error', 'Failed to delete request')
    }
  }

  useEffect(() => { loadData() }, [activeBranch, currentDate, loadData])

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
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm tracking-wide">{notification.message}</span>
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
    </div>
  )

  // ── Desktop ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#de5827] -mt-32 pt-56 px-6 pb-24"
      style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <div className="max-w-[1800px] mx-auto">

        {/* ── HEADER ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-6 mt-4 relative z-40"
        >
          <div className="relative min-w-0">
            <div className="flex items-center gap-4 mb-2">
              <div className="h-[2px] w-12 bg-black" />
              <span className="text-[11px] uppercase tracking-[0.2em] font-black text-black">
                Roster {activeBranch !== 'global' && `// ${activeBranch.toUpperCase()}`}
              </span>
            </div>
            <div className="text-5xl md:text-7xl font-black text-black tracking-tighter leading-none uppercase">
              Roster
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap justify-end w-full lg:w-auto">
            {/* Centre Selector Thread for Desktop */}
            <div className="bg-[#f4f3ef] border border-[#d5d4ce] rounded-2xl p-1 shadow-sm">
              <LocationSelectorThread
                activeBranch={activeBranch}
                setActiveBranch={setActiveBranch as (b: string) => void}
                availableBranches={centreOptions}
                canSwitch={canSwitchCentre}
              />
            </div>
            <div className="flex items-center gap-2 px-4 py-3 bg-[#f4f3ef] border border-[#d5d4ce] text-black font-bold rounded-2xl text-xs uppercase tracking-wider shadow-sm">
              <Users size={14} className="text-black" />
              <span>{staffProfiles.length} staff</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-3 bg-[#f4f3ef] border border-[#d5d4ce] text-black font-bold rounded-2xl text-xs uppercase tracking-wider shadow-sm">
              <Calendar size={14} className="text-black" />
              <span>{new Date().toLocaleDateString('en-GB', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
            </div>
          </div>
        </motion.div>

        {/* ── NOTIFICATION ── */}
        {notification && (
          <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl bg-[#f4f3ef] shadow-xl border ${
            notification.type === 'success' ? 'border-emerald-500 text-emerald-800' :
            notification.type === 'error' ? 'border-rose-500 text-rose-800' : 'border-amber-500 text-amber-800'
          }`}>
            <div className="flex items-center gap-3">
              {notification.type === 'success' && <CheckCircle className="h-5 w-5 text-emerald-600" />}
              {notification.type === 'error' && <XCircle className="h-5 w-5 text-rose-600" />}
              {notification.type === 'warning' && <AlertTriangle className="h-5 w-5 text-amber-600" />}
              <span className="font-bold text-sm tracking-wide">{notification.message}</span>
            </div>
          </div>
        )}

        {/* ── SUB-HEADER MENU HEADER ── */}
        <div className="flex items-center gap-2 bg-[#eae9e4] border border-[#d5d4ce] rounded-3xl p-2 mb-4 w-full justify-start overflow-x-auto no-scrollbar shadow-md">
          {[
            { id: 'roster', label: 'Roster Grid', icon: <Calendar size={15} /> },
            { id: 'check-in', label: 'Check-in', icon: <LogIn size={15} /> },
            { id: 'my-attendance', label: 'My Attendance', icon: <Clock size={15} /> },
            { id: 'leave', label: 'Leave', icon: <Calendar size={15} /> },
            { id: 'shift-swap', label: 'Shift Swap', icon: <RefreshCw size={15} /> },
            { id: 'tool', label: 'Tool', icon: <Shield size={15} />, adminOnly: true },
          ].map(item => {
            if (item.adminOnly && !canEdit) return null
            const isActive = activeMenu === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveMenu(item.id as any)}
                className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-black text-[#f4f3ef] shadow-sm'
                    : 'text-black/60 hover:text-black hover:bg-black/5'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            )
          })}
          {activeMenu !== 'roster' && (
            <button
              onClick={() => setActiveMenu('roster')}
              className="ml-auto flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[10px] font-black text-rose-700 hover:bg-rose-50 border border-rose-200/50 uppercase tracking-widest transition-colors"
            >
              <X size={12} /> Close
            </button>
          )}
        </div>

        {/* ── HELLO USER BANNER ── */}
        <div className="bg-[#f4f3ef] border border-[#d5d4ce] rounded-3xl p-6 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-md">
          <div>
            <h2 className="text-2xl font-black text-[#1a1a1a]">Hello, {profile?.full_name || 'User'}!</h2>
            <p className="text-sm text-black/60 font-bold mt-1">
              {profile?.role ? `${profile.role.replace('_', ' ').toUpperCase()} // ` : ''}Welcome back to your shift roster.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-black px-4 py-2 rounded-full bg-black text-[#f4f3ef] uppercase tracking-wider">
              {activeBranch.toUpperCase()} BRANCH
            </span>
          </div>
        </div>

        {/* ── MAIN CONTENT CONTAINER ── */}
        <div className="bg-[#f4f3ef] border border-[#d5d4ce] rounded-3xl p-6 min-h-[600px] shadow-lg">
          <AnimatePresence mode="wait">

            {/* DEFAULT ROSTER VIEW */}
            {activeMenu === 'roster' && (
              <motion.div
                key="roster"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Control bar for roster grid */}
                <div className="flex flex-wrap items-center justify-between gap-4 bg-[#eae9e4] border border-[#d5d4ce] rounded-2xl p-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    {/* 30 Days / 7 Days view switcher */}
                    <div className="flex items-center bg-[#f4f3ef] border border-[#d5d4ce] rounded-xl p-1 gap-1">
                      <button
                        onClick={() => setTimelineViewMode('month')}
                        className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                          timelineViewMode === 'month'
                            ? 'bg-black text-[#f4f3ef] shadow-sm'
                            : 'text-black/60 hover:text-black hover:bg-black/5'
                        }`}
                      >
                        30 Days
                      </button>
                      <button
                        onClick={() => setTimelineViewMode('7day')}
                        className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                          timelineViewMode === '7day'
                            ? 'bg-black text-[#f4f3ef] shadow-sm'
                            : 'text-black/60 hover:text-black hover:bg-black/5'
                        }`}
                      >
                        7 Days
                      </button>
                    </div>

                    {/* Date pager */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center bg-[#f4f3ef] border border-[#d5d4ce] rounded-xl">
                        <button onClick={() => navigateDate('prev')} className="p-2 hover:bg-black/5 rounded-l-xl transition-colors">
                          <ChevronLeft className="h-5 w-5 text-black/60" />
                        </button>
                        <h2 className="text-xs font-black text-[#1a1a1a] min-w-[180px] text-center uppercase tracking-wider">
                          {timelineViewMode === '7day' ? `Week of ${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : getViewTitle()}
                        </h2>
                        <button onClick={() => navigateDate('next')} className="p-2 hover:bg-black/5 rounded-r-xl transition-colors">
                          <ChevronRight className="h-5 w-5 text-black/60" />
                        </button>
                      </div>
                      <button
                        onClick={() => setCurrentDate(new Date())}
                        className="px-4 py-2.5 text-xs font-black text-black/60 bg-[#f4f3ef] border border-[#d5d4ce] rounded-xl hover:bg-black hover:text-white transition-all uppercase tracking-wider"
                      >
                        Today
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Staff filter */}
                    <div className="relative">
                      <button
                        onClick={() => setShowFilter(!showFilter)}
                        className={`p-2 rounded-xl border transition-colors ${
                          showFilter ? 'bg-black text-white border-black' : 'bg-[#f4f3ef] border-[#d5d4ce] text-black/60 hover:text-black'
                        }`}
                      >
                        <Filter className="h-4 w-4" />
                      </button>
                      <AnimatePresence>
                        {showFilter && (
                          <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="absolute right-0 mt-2 w-56 bg-[#f4f3ef] border border-[#d5d4ce] rounded-2xl shadow-xl z-20 max-h-80 overflow-y-auto"
                          >
                            <div className="p-3">
                              <div className="text-[10px] font-black text-black/40 uppercase mb-2 tracking-wider">Filter by Staff</div>
                              <button
                                onClick={() => { setSelectedStaffFilter(''); setShowFilter(false) }}
                                className="block w-full text-left px-4 py-2.5 text-xs text-black/80 hover:bg-black/5 rounded-lg mb-1 font-bold transition-colors uppercase tracking-wider"
                              >
                                All Staff
                              </button>
                              {staffProfiles.map(s => (
                                <button
                                  key={s.id}
                                  onClick={() => { setSelectedStaffFilter(s.id); setShowFilter(false) }}
                                  className={`block w-full text-left px-4 py-2.5 text-xs rounded-lg transition-colors uppercase tracking-wider font-bold ${
                                    selectedStaffFilter === s.id ? 'bg-black text-white' : 'text-black/80 hover:bg-black/5'
                                  }`}
                                >
                                  {s.full_name}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <button
                      onClick={loadData}
                      className="p-2 bg-[#f4f3ef] border border-[#d5d4ce] rounded-xl text-black/60 hover:text-black hover:bg-black/5 transition-colors"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <MonthlyRosterTimeline
                  staffProfiles={filteredStaff}
                  schedules={schedules}
                  currentDate={currentDate}
                  onCellClick={handleCellClick}
                  viewType={timelineViewMode}
                />
              </motion.div>
            )}

            {/* CHECK-IN VIEW */}
            {activeMenu === 'check-in' && (
              <motion.div
                key="check-in"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-black text-[#1a1a1a] uppercase tracking-tight">Staff Attendance Check-In</h3>
                  <button
                    onClick={() => setActiveMenu('roster')}
                    className="text-xs font-black text-rose-700 uppercase tracking-wider hover:underline"
                  >
                    Back to Roster
                  </button>
                </div>
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

            {/* MY ATTENDANCE VIEW */}
            {activeMenu === 'my-attendance' && (
              <motion.div
                key="my-attendance"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-lg font-black text-[#1a1a1a] uppercase tracking-tight">My Attendance Log</h3>
                  <button
                    onClick={() => setActiveMenu('roster')}
                    className="text-xs font-black text-rose-700 uppercase tracking-wider hover:underline"
                  >
                    Back to Roster
                  </button>
                </div>
                <MyAttendancePanel myLogs={myAttendanceLogs} loading={myAttendanceLoading} />
              </motion.div>
            )}

            {/* LEAVE REQUESTS VIEW */}
            {activeMenu === 'leave' && (
              <motion.div
                key="leave"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-[#1a1a1a] uppercase tracking-tight">Leave Management</h3>
                  <button
                    onClick={() => setActiveMenu('roster')}
                    className="text-xs font-black text-rose-700 uppercase tracking-wider hover:underline"
                  >
                    Back to Roster
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Form */}
                  <div className="bg-[#eae9e4] border border-[#d5d4ce] rounded-3xl p-6 h-fit space-y-4">
                    <h4 className="text-sm font-black uppercase tracking-wider">Request Leave</h4>
                    <form onSubmit={handleCreateLeave} className="space-y-4">
                      <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-black/60 mb-2">Leave Date</label>
                        <input
                          type="date"
                          required
                          value={leaveDate}
                          onChange={e => setLeaveDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          className="w-full px-4 py-3 bg-white border border-[#d5d4ce] rounded-xl outline-none text-black font-bold focus:ring-1 focus:ring-black"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-black/60 mb-2">Reason</label>
                        <textarea
                          value={leaveReason}
                          onChange={e => setLeaveReason(e.target.value)}
                          placeholder="Provide a brief reason for time off..."
                          rows={4}
                          className="w-full px-4 py-3 bg-white border border-[#d5d4ce] rounded-xl outline-none text-black font-medium focus:ring-1 focus:ring-black resize-none"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={leaveSubmitting || !leaveDate}
                        className="w-full py-3 bg-black hover:bg-zinc-800 disabled:bg-black/20 text-[#f4f3ef] font-black uppercase tracking-wider rounded-xl transition-colors text-xs"
                      >
                        {leaveSubmitting ? 'Submitting...' : 'Submit Leave Request'}
                      </button>
                    </form>
                  </div>

                  {/* History */}
                  <div className="lg:col-span-2 bg-white border border-[#d5d4ce] rounded-3xl overflow-hidden shadow-sm">
                    <div className="px-6 py-4 bg-[#eae9e4] border-b border-[#d5d4ce]">
                      <h4 className="text-sm font-black uppercase tracking-wider">My Leave Request History</h4>
                    </div>
                    <div className="divide-y divide-[#d5d4ce] max-h-[450px] overflow-y-auto">
                      {requests.filter(r => r.user_id === profile?.id && r.request_type === 'leave').length === 0 ? (
                        <div className="p-8 text-center text-black/40 font-medium">No leave requests found.</div>
                      ) : (
                        requests.filter(r => r.user_id === profile?.id && r.request_type === 'leave').map(req => (
                          <div key={req.id} className="p-5 flex items-center justify-between hover:bg-black/5 transition-colors">
                            <div>
                              <div className="text-sm font-bold">{new Date(req.requested_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>
                              {req.reason && <p className="text-xs text-black/60 mt-1 italic">"{req.reason}"</p>}
                              <span className="text-[10px] text-black/40 font-bold block mt-1">Submitted: {new Date(req.created_at || '').toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                                req.status === 'pending' ? 'bg-amber-100 text-amber-800 border border-amber-200/50' :
                                req.status === 'approved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200/50' :
                                'bg-rose-100 text-rose-800 border border-rose-200/50'
                              }`}>
                                {req.status}
                              </span>
                              {req.status === 'pending' && (
                                <button
                                  onClick={() => handleDeleteRequest(req.id)}
                                  className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200/20 transition-colors"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* SHIFT SWAP VIEW */}
            {activeMenu === 'shift-swap' && (
              <motion.div
                key="shift-swap"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-[#1a1a1a] uppercase tracking-tight">Shift Swap Requests</h3>
                  <button
                    onClick={() => setActiveMenu('roster')}
                    className="text-xs font-black text-rose-700 uppercase tracking-wider hover:underline"
                  >
                    Back to Roster
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Form */}
                  <div className="bg-[#eae9e4] border border-[#d5d4ce] rounded-3xl p-6 h-fit space-y-4">
                    <h4 className="text-sm font-black uppercase tracking-wider">Request Swap</h4>
                    <form onSubmit={handleCreateSwap} className="space-y-4">
                      <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-black/60 mb-2">Shift Date</label>
                        <input
                          type="date"
                          required
                          value={swapDate}
                          onChange={e => setSwapDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          className="w-full px-4 py-3 bg-white border border-[#d5d4ce] rounded-xl outline-none text-black font-bold focus:ring-1 focus:ring-black"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-black/60 mb-2">Swap With Colleague</label>
                        <select
                          required
                          value={swapTargetStaff}
                          onChange={e => setSwapTargetStaff(e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-[#d5d4ce] rounded-xl outline-none text-black font-bold focus:ring-1 focus:ring-black"
                        >
                          <option value="">Select colleague...</option>
                          {staffProfiles.filter(p => p.id !== profile?.id).map(p => (
                            <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-black/60 mb-2">Reason</label>
                        <textarea
                          value={swapReason}
                          onChange={e => setSwapReason(e.target.value)}
                          placeholder="Explain why you want to swap shifts..."
                          rows={3}
                          className="w-full px-4 py-3 bg-white border border-[#d5d4ce] rounded-xl outline-none text-black font-medium focus:ring-1 focus:ring-black resize-none"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={swapSubmitting || !swapDate || !swapTargetStaff}
                        className="w-full py-3 bg-black hover:bg-zinc-800 disabled:bg-black/20 text-[#f4f3ef] font-black uppercase tracking-wider rounded-xl transition-colors text-xs"
                      >
                        {swapSubmitting ? 'Submitting...' : 'Submit Swap Request'}
                      </button>
                    </form>
                  </div>

                  {/* History */}
                  <div className="lg:col-span-2 bg-white border border-[#d5d4ce] rounded-3xl overflow-hidden shadow-sm">
                    <div className="px-6 py-4 bg-[#eae9e4] border-b border-[#d5d4ce]">
                      <h4 className="text-sm font-black uppercase tracking-wider">My Swap History</h4>
                    </div>
                    <div className="divide-y divide-[#d5d4ce] max-h-[450px] overflow-y-auto">
                      {requests.filter(r => r.user_id === profile?.id && r.request_type === 'shift_swap').length === 0 ? (
                        <div className="p-8 text-center text-black/40 font-medium">No swap requests found.</div>
                      ) : (
                        requests.filter(r => r.user_id === profile?.id && r.request_type === 'shift_swap').map(req => (
                          <div key={req.id} className="p-5 flex items-center justify-between hover:bg-black/5 transition-colors">
                            <div>
                              <div className="text-sm font-bold">Swap for {new Date(req.requested_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                              <p className="text-xs text-black/60 font-bold mt-1">Colleague: {req.target_name}</p>
                              {req.reason && <p className="text-xs text-black/50 mt-0.5 italic">"{req.reason}"</p>}
                              <span className="text-[10px] text-black/40 font-bold block mt-1">Submitted: {new Date(req.created_at || '').toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                                req.status === 'pending' ? 'bg-amber-100 text-amber-800 border border-amber-200/50' :
                                req.status === 'approved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200/50' :
                                'bg-rose-100 text-rose-800 border border-rose-200/50'
                              }`}>
                                {req.status}
                              </span>
                              {req.status === 'pending' && (
                                <button
                                  onClick={() => handleDeleteRequest(req.id)}
                                  className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200/20 transition-colors"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ADMIN TOOL PANELS */}
            {activeMenu === 'tool' && canEdit && (
              <motion.div
                key="tool"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#d5d4ce] pb-4">
                  <h3 className="text-lg font-black text-[#1a1a1a] uppercase tracking-tight">Roster Administrative Tools</h3>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowQuickAddModal(true)}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-black hover:bg-zinc-800 text-[#f4f3ef] text-xs font-black uppercase tracking-wider rounded-xl shadow-sm"
                    >
                      <Plus className="h-4 w-4" /> Quick Add Shift
                    </button>
                    <button
                      onClick={() => setShowRequestsModal(true)}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-transparent border border-black/20 hover:bg-black/5 text-black text-xs font-black uppercase tracking-wider rounded-xl"
                    >
                      Requests Manager
                    </button>
                  </div>
                </div>

                {/* Sub tabs for Tools */}
                <div className="flex items-center bg-[#eae9e4] border border-[#d5d4ce] rounded-2xl p-1 gap-1 w-fit">
                  {[
                    { id: 'staff-grid', label: 'Staff Cards' },
                    { id: 'analysis', label: 'Analytics' },
                    { id: 'list', label: 'Schedule List' },
                    { id: 'manage-requests', label: `Pending Requests (${requests.filter(r => r.status === 'pending').length})` }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveToolTab(tab.id as any)}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                        activeToolTab === tab.id
                          ? 'bg-black text-[#f4f3ef]'
                          : 'text-black/60 hover:text-black hover:bg-black/5'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Sub tabs content panel */}
                <div className="pt-2">
                  {activeToolTab === 'staff-grid' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-black uppercase tracking-wider text-black/60">Staff profiles ({filteredStaff.length})</h4>
                        {/* Search bar inside tools */}
                        <div className="relative">
                          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search staff…"
                            className="pl-8 pr-3 py-2 bg-white border border-[#d5d4ce] rounded-xl text-xs text-black placeholder-black/40 focus:outline-none focus:border-black w-48 transition-all uppercase tracking-widest"
                          />
                        </div>
                      </div>
                      <StaffGridView
                        staffProfiles={filteredStaff}
                        schedules={schedules}
                        attendance={attendance}
                        searchQuery={searchQuery}
                        onViewProfile={setSelectedProfileForModal}
                      />
                    </div>
                  )}

                  {activeToolTab === 'analysis' && (
                    <EnhancedAnalysisView
                      schedules={schedules}
                      staffProfiles={filteredStaff}
                      requests={requests}
                      currentDate={currentDate}
                    />
                  )}

                  {activeToolTab === 'list' && (
                    <RosterListView schedules={schedules} staffProfiles={staffProfiles} />
                  )}

                  {activeToolTab === 'manage-requests' && (
                    <div className="bg-white border border-[#d5d4ce] rounded-3xl overflow-hidden shadow-sm">
                      <div className="px-6 py-4 bg-[#eae9e4] border-b border-[#d5d4ce]">
                        <h4 className="text-sm font-black uppercase tracking-wider">Pending Roster Approvals</h4>
                      </div>
                      <div className="divide-y divide-[#d5d4ce]">
                        {requests.filter(r => r.status === 'pending').length === 0 ? (
                          <div className="p-8 text-center text-black/40 font-medium">No pending requests awaiting approval.</div>
                        ) : (
                          requests.filter(r => r.status === 'pending').map(req => (
                            <div key={req.id} className="p-5 flex flex-col md:flex-row md:items-center md:justify-between hover:bg-black/5 transition-colors gap-4">
                              <div>
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest inline-block mb-1.5 ${
                                  req.request_type === 'leave' ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {req.request_type === 'leave' ? 'Leave' : 'Shift Swap'}
                                </span>
                                <div className="text-sm font-bold text-black">
                                  {req.requestor_name} requests {req.request_type === 'leave' ? 'leave' : 'swap'} for {new Date(req.requested_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                                </div>
                                {req.request_type === 'shift_swap' && (
                                  <p className="text-xs font-bold text-black/60 mt-1">Swap target colleague: {req.target_name}</p>
                                )}
                                {req.reason && <p className="text-xs text-black/50 mt-1 italic">"{req.reason}"</p>}
                                <span className="text-[9px] text-black/40 font-bold block mt-1.5">Submitted: {new Date(req.created_at || '').toLocaleDateString()}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleApproveRequest(req)}
                                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider rounded-xl text-[10px] transition-colors shadow-sm"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleRejectRequest(req.id)}
                                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black uppercase tracking-wider rounded-xl text-[10px] transition-colors shadow-sm"
                                >
                                  Reject
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
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

// Sub-component for personal attendance summary logs list
function MyAttendancePanel({
  myLogs,
  loading
}: {
  myLogs: any[]
  loading: boolean
}) {
  const stats = useMemo(() => {
    return {
      present: myLogs.filter(l => l.status === 'present').length,
      late: myLogs.filter(l => l.status === 'late').length,
      absent: myLogs.filter(l => l.status === 'absent').length,
      total: myLogs.length
    }
  }, [myLogs])

  return (
    <div className="space-y-6 text-[#1a1a1a]">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#eae9e4] border border-[#d5d4ce] rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-emerald-700">{stats.present}</div>
          <div className="text-[9px] text-black/50 font-black uppercase tracking-wider mt-1">Days Present</div>
        </div>
        <div className="bg-[#eae9e4] border border-[#d5d4ce] rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-amber-600">{stats.late}</div>
          <div className="text-[9px] text-black/50 font-black uppercase tracking-wider mt-1">Days Late</div>
        </div>
        <div className="bg-[#eae9e4] border border-[#d5d4ce] rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-rose-600">{stats.absent}</div>
          <div className="text-[9px] text-black/50 font-black uppercase tracking-wider mt-1">Days Absent</div>
        </div>
        <div className="bg-[#eae9e4] border border-[#d5d4ce] rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-black">{stats.total}</div>
          <div className="text-[9px] text-black/50 font-black uppercase tracking-wider mt-1">Total Logs</div>
        </div>
      </div>

      <div className="bg-white border border-[#d5d4ce] rounded-3xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 bg-[#eae9e4] border-b border-[#d5d4ce] flex items-center justify-between">
          <h4 className="text-sm font-black uppercase tracking-wider">My Attendance Logs</h4>
          <span className="text-xs text-black/50 font-bold">Last 30 Logs</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-black/50 font-medium">Loading logs...</div>
        ) : myLogs.length === 0 ? (
          <div className="p-8 text-center text-black/40 font-medium">No attendance logs found.</div>
        ) : (
          <div className="divide-y divide-[#d5d4ce] max-h-[400px] overflow-y-auto">
            {myLogs.map((log, index) => {
              const dateStr = new Date(log.date).toLocaleDateString('en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })
              return (
                <div key={index} className="px-6 py-4 flex items-center justify-between hover:bg-black/5 transition-colors">
                  <div>
                    <div className="text-sm font-bold">{dateStr}</div>
                    <div className="text-xs text-black/50 mt-0.5">
                      {log.branch_location ? `${log.branch_location.toUpperCase()} branch` : 'Global'}
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold">In: {log.check_in || '—'}</div>
                      <div className="text-xs font-mono text-black/50">Out: {log.check_out || '—'}</div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                      log.status === 'present' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200/50' :
                      log.status === 'late' ? 'bg-amber-100 text-amber-800 border border-amber-200/50' :
                      'bg-rose-100 text-rose-800 border border-rose-200/50'
                    }`}>
                      {log.status}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default FetsRosterPremium
