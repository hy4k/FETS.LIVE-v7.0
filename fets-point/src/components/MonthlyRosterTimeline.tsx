import React, { useMemo } from 'react'
import { Schedule, StaffProfile } from '../types/shared'
import { User, Clock, Calendar, Sparkles } from 'lucide-react'
import { formatDateForIST } from '../utils/dateUtils'

type Props = {
  staffProfiles: StaffProfile[]
  schedules: Schedule[]
  currentDate: Date
  onCellClick: (profileId: string, date: Date) => void
  viewType?: 'month' | '7day'
}

// Warm Yellow & Teal Pastel Theme Shift Styles (matching reference images)
const getShiftStyle = (code: string) => {
  const base = "w-10 h-10 flex items-center justify-center rounded-2xl font-black text-xs tracking-wider transition-all duration-300 border shadow-sm"

  switch (code) {
    case 'D':
      return `${base} text-white bg-gradient-to-br from-[#1BB5AC] to-[#148F87] border-[#1BB5AC]/40 shadow-[0_4px_12px_rgba(27,181,172,0.25)] hover:scale-105`
    case 'E':
      return `${base} text-white bg-gradient-to-br from-[#F2994A] to-[#D97706] border-[#F2994A]/40 shadow-[0_4px_12px_rgba(242,153,74,0.25)] hover:scale-105`
    case 'HD':
      return `${base} text-[#133C44] bg-gradient-to-br from-[#FCD872] to-[#E5B83A] border-[#FCD872]/50 shadow-[0_4px_12px_rgba(252,216,114,0.3)] hover:scale-105`
    case 'RD':
      return `${base} text-[#718096] bg-[#F7F4EA] border-[#E2DDD0] hover:bg-[#EFECE0] hover:text-[#2D3748]`
    case 'L':
      return `${base} text-white bg-gradient-to-br from-[#E53E3E] to-[#C53030] border-[#E53E3E]/40 shadow-[0_4px_12px_rgba(229,62,62,0.25)] hover:scale-105`
    case 'OT':
      return `${base} text-white bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] border-[#8B5CF6]/40 shadow-[0_4px_12px_rgba(139,92,246,0.25)] hover:scale-105`
    case 'T':
      return `${base} text-white bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] border-[#3B82F6]/40 shadow-[0_4px_12px_rgba(59,130,246,0.25)] hover:scale-105`
    case 'TOIL':
      return `${base} text-white bg-gradient-to-br from-[#10B981] to-[#047857] border-[#10B981]/40 shadow-[0_4px_12px_rgba(16,185,129,0.25)] hover:scale-105`
    default:
      return `${base} text-slate-400 bg-[#F7F4EA]/40 border-[#E2DDD0] border-dashed hover:border-[#1BB5AC] hover:text-[#1BB5AC]`
  }
}

const getCodeLabel = (code: string) => {
  if (code === 'OT') return 'OT'
  return code
}

// Generate consistent warm pastel avatar colors
const getAvatarStyle = (name: string) => {
  const styles = [
    { bg: 'bg-[#1BB5AC]/15 border-[#1BB5AC]/30 text-[#1BB5AC]' },
    { bg: 'bg-[#F2994A]/15 border-[#F2994A]/30 text-[#F2994A]' },
    { bg: 'bg-[#FCD872]/20 border-[#FCD872]/40 text-[#B45309]' },
    { bg: 'bg-[#8B5CF6]/15 border-[#8B5CF6]/30 text-[#8B5CF6]' },
    { bg: 'bg-[#10B981]/15 border-[#10B981]/30 text-[#10B981]' },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return styles[Math.abs(hash) % styles.length];
}

export const MonthlyRosterTimeline: React.FC<Props> = ({
  staffProfiles,
  schedules,
  currentDate,
  onCellClick,
  viewType = 'month'
}) => {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const daysInMonth = useMemo(() => new Date(year, month + 1, 0).getDate(), [year, month])

  // Filter out staff profiles explicitly marked inactive for the month
  const activeStaffProfiles = useMemo(() => {
    return staffProfiles.filter(s => {
      const isRosterActive = (s as any).permissions?.is_roster_active !== false && (s as any).is_roster_active !== false;
      return isRosterActive;
    });
  }, [staffProfiles]);

  const scheduleMap = useMemo(() => {
    const map = new Map<string, Schedule>()
    for (const s of schedules) {
      map.set(`${s.profile_id}-${s.date}`, s)
    }
    return map
  }, [schedules])

  const days: Date[] = useMemo(() => {
    if (viewType === '7day') {
      const start = new Date(currentDate)
      const day = start.getDay()
      const diff = start.getDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(start.setDate(diff))

      return Array.from({ length: 7 }, (_, i) => {
        return new Date(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate() + i))
      })
    } else {
      return Array.from({ length: daysInMonth }, (_, i) => new Date(Date.UTC(year, month, i + 1)))
    }
  }, [viewType, daysInMonth, month, year, currentDate])

  const isToday = (d: Date) => new Date().toDateString() === d.toDateString()

  return (
    <>
      <style>{`
      .warm-roster-scrollbar::-webkit-scrollbar {
        height: 8px;
        background-color: #FFF9EA;
        border-radius: 4px;
      }
      .warm-roster-scrollbar::-webkit-scrollbar-track {
        background-color: #FFF9EA;
        border-radius: 4px;
      }
      .warm-roster-scrollbar::-webkit-scrollbar-thumb {
        background-color: rgba(27, 181, 172, 0.3);
        border-radius: 4px;
      }
      .warm-roster-scrollbar::-webkit-scrollbar-thumb:hover {
        background-color: rgba(27, 181, 172, 0.6);
      }
    `}</style>

      {/* Main Warm Pastel Card Container */}
      <div className="bg-[#FFFDF5] rounded-3xl border border-[#FCD872]/40 overflow-hidden flex flex-col h-full font-sans shadow-[0_10px_30px_rgba(27,181,172,0.08)] p-4">
        {/* Header Legend Bar */}
        <div className="flex items-center justify-between gap-3 mb-4 px-2">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[#1BB5AC]" />
            <span className="text-xs font-black uppercase tracking-wider text-[#133C44]">Duty Roster Matrix</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-bold text-[#133C44]/70">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#1BB5AC]" /> D (Day)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#F2994A]" /> E (Eve)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#FCD872]" /> HD (Half)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#E2DDD0]" /> RD (Rest)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#E53E3E]" /> L (Leave)</span>
          </div>
        </div>

        <div className="overflow-x-auto flex-1 warm-roster-scrollbar pb-2">
          <table className="min-w-full border-separate border-spacing-y-3 border-spacing-x-0">
            <thead>
              <tr>
                {/* Sticky Staff Column Header */}
                <th className="sticky left-0 z-20 bg-[#FFFDF5] border-b-2 border-r border-[#FCD872]/30 px-6 py-4 w-72 rounded-tl-2xl">
                  <div className="flex items-center gap-2.5 text-[#133C44]">
                    <User className="w-4 h-4 text-[#1BB5AC]" />
                    <span className="text-xs font-black tracking-[0.18em] uppercase">Personnel ({activeStaffProfiles.length})</span>
                  </div>
                </th>

                {/* Day Columns */}
                {days.map((d, idx) => {
                  const today = isToday(d);
                  return (
                    <th key={idx} className={`relative z-10 border-b-2 border-[#FCD872]/30 px-2 py-3 min-w-[60px] text-center transition-colors ${today ? 'bg-[#1BB5AC]/10' : 'bg-[#FFFDF5]'}`}>
                      <div className="flex flex-col items-center gap-1.5">
                        <span className={`text-[10px] uppercase font-black tracking-wider ${today ? 'text-[#1BB5AC]' : 'text-[#133C44]/50'}`}>
                          {d.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}
                        </span>
                        <div className={`w-9 h-9 flex items-center justify-center rounded-xl text-xs font-black transition-all ${today
                          ? 'bg-[#1BB5AC] text-white shadow-[0_4px_10px_rgba(27,181,172,0.3)]'
                          : 'bg-[#FFF9EA] border border-[#FCD872]/40 text-[#133C44]'
                          }`}>
                          {d.getDate()}
                        </div>
                      </div>
                      {today && <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#1BB5AC] mx-2 rounded-t-full"></div>}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {activeStaffProfiles.map((staff) => {
                const avatarStyle = getAvatarStyle(staff.full_name);
                return (
                  <tr key={staff.id} className="group transition-all duration-200 hover:scale-[1.002]">
                    {/* Sticky Staff Name Cell with Neumorphic Card Styling */}
                    <td className="sticky left-0 z-10 bg-white group-hover:bg-[#FFF9EA] border-t border-b border-l border-[#FCD872]/40 rounded-l-2xl px-5 py-5 transition-colors shadow-[2px_0_10px_rgba(27,181,172,0.05)]">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center font-black shrink-0 text-xs shadow-sm ${avatarStyle.bg}`}>
                          {staff.full_name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[#133C44] font-black text-sm tracking-wide truncate group-hover:text-[#1BB5AC] transition-colors">
                            {staff.full_name}
                          </span>
                          {staff.department && (
                            <span className="text-[9px] text-[#133C44]/50 font-bold tracking-wider uppercase mt-0.5 truncate">
                              {staff.department}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Shift Cells */}
                    {days.map((d, cIdx) => {
                      const iso = formatDateForIST(d)
                      const key = `${staff.id}-${iso}`
                      const s = scheduleMap.get(key)
                      const code = s?.shift_code || ''
                      const today = isToday(d)
                      const isLastCol = cIdx === days.length - 1

                      return (
                        <td
                          key={cIdx}
                          onClick={() => onCellClick(staff.id, d)}
                          className={`bg-white group-hover:bg-[#FFF9EA] border-t border-b border-[#FCD872]/40 ${isLastCol ? 'border-r rounded-r-2xl' : ''} px-1.5 py-3 text-center align-middle cursor-pointer relative transition-colors ${today ? 'bg-[#1BB5AC]/5' : ''
                            }`}
                        >
                          <div className="w-full h-full flex items-center justify-center p-0.5">
                            {s ? (
                              <div className={`relative ${getShiftStyle(code)}`}>
                                <span>{getCodeLabel(code)}</span>
                              </div>
                            ) : (
                              <div className="w-9 h-9 rounded-2xl border border-dashed border-[#FCD872]/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:border-[#1BB5AC] hover:bg-[#1BB5AC]/10">
                                <span className="text-[#1BB5AC] text-xs font-bold">+</span>
                              </div>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
