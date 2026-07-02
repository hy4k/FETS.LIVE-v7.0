import React, { useMemo } from 'react'
import { Schedule, StaffProfile } from '../types/shared'
import { User, Clock, Calendar } from 'lucide-react'
import { formatDateForIST } from '../utils/dateUtils'

type Props = {
  staffProfiles: StaffProfile[]
  schedules: Schedule[]
  currentDate: Date
  onCellClick: (profileId: string, date: Date) => void
  viewType?: 'month' | '7day'
}

// Premium color palette for shifts
const getShiftStyle = (code: string) => {
  const base = "w-10 h-10 flex items-center justify-center rounded-xl font-black text-xs tracking-wider transition-all duration-300 border"

  switch (code) {
    case 'D':
      return `${base} text-white bg-gradient-to-br from-[#2563EB] to-[#3B82F6] border-[#2563EB]/30 shadow-[0_2px_6px_rgba(37,99,235,0.2)] hover:shadow-[0_4px_10px_rgba(37,99,235,0.3)] hover:-translate-y-0.5`
    case 'E':
      return `${base} text-white bg-gradient-to-br from-[#059669] to-[#10B981] border-[#059669]/30 shadow-[0_2px_6px_rgba(5,150,105,0.2)] hover:shadow-[0_4px_10px_rgba(5,150,105,0.3)] hover:-translate-y-0.5`
    case 'HD':
      return `${base} text-white bg-gradient-to-br from-[#D97706] to-[#F59E0B] border-[#D97706]/30 shadow-[0_2px_6px_rgba(217,119,6,0.2)] hover:shadow-[0_4px_10px_rgba(217,119,6,0.3)] hover:-translate-y-0.5`
    case 'RD':
      return `${base} text-[#1a1a1a] bg-gradient-to-br from-[#eae9e4] to-[#f4f3ef] border-[#d5d4ce] border-dashed hover:bg-[#e2e1db] hover:text-black`
    case 'L':
      return `${base} text-white bg-gradient-to-br from-[#DC2626] to-[#EF4444] border-[#DC2626]/30 shadow-[0_2px_6px_rgba(220,38,38,0.2)] hover:shadow-[0_4px_10px_rgba(220,38,38,0.3)] hover:-translate-y-0.5`
    case 'OT':
      return `${base} text-white bg-gradient-to-br from-[#DB2777] to-[#EC4899] border-[#DB2777]/30 shadow-[0_2px_6px_rgba(219,39,119,0.2)] hover:shadow-[0_4px_10px_rgba(219,39,119,0.3)] hover:-translate-y-0.5`
    case 'T':
      return `${base} text-white bg-gradient-to-br from-[#4F46E5] to-[#6366F1] border-[#4F46E5]/30 shadow-[0_2px_6px_rgba(79,70,229,0.2)] hover:shadow-[0_4px_10px_rgba(79,70,229,0.3)] hover:-translate-y-0.5`
    case 'TOIL':
      return `${base} text-white bg-gradient-to-br from-[#7C3AED] to-[#8B5CF6] border-[#7C3AED]/30 shadow-[0_2px_6px_rgba(124,58,237,0.2)] hover:shadow-[0_4px_10px_rgba(124,58,237,0.3)] hover:-translate-y-0.5`
    default:
      return `${base} text-black/30 bg-[#eae9e4]/30 border-[#d5d4ce] border-dashed hover:border-black/20 hover:text-black/60`
  }
}

const getCodeLabel = (code: string) => {
  if (code === 'OT') return 'OT'
  return code
}

// Generate consistent refined colors for avatars (darker text for white/grey backgrounds)
const getAvatarColor = (name: string) => {
  const colors = [
    'text-rose-700',
    'text-blue-700',
    'text-amber-800',
    'text-emerald-700',
    'text-purple-700',
    'text-cyan-700',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
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

  const scheduleMap = useMemo(() => {
    const map = new Map<string, Schedule>()
    for (const s of schedules) {
      map.set(`${s.profile_id}-${s.date}`, s)
    }
    return map
  }, [schedules])

  const days: Date[] = useMemo(() => {
    if (viewType === '7day') {
      // Find start of week (Monday) based on currentDate in UTC
      const start = new Date(currentDate)
      const day = start.getDay() // 0 is Sunday, 1 is Monday
      const diff = start.getDate() - day + (day === 0 ? -6 : 1) // Monday
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
      .premium-scrollbar::-webkit-scrollbar {
        height: 8px;
        background-color: #f4f3ef;
        border-radius: 4px;
      }
      .premium-scrollbar::-webkit-scrollbar-track {
        background-color: #f4f3ef;
        border-radius: 4px;
      }
      .premium-scrollbar::-webkit-scrollbar-thumb {
        background-color: rgba(26, 26, 26, 0.2);
        border-radius: 4px;
      }
      .premium-scrollbar::-webkit-scrollbar-thumb:hover {
        background-color: rgba(26, 26, 26, 0.5);
      }
    `}</style>

      <div className="bg-[#f4f3ef] rounded-3xl border border-[#d5d4ce] overflow-hidden flex flex-col h-full font-sans shadow-lg">
        <div className="overflow-x-auto flex-1 premium-scrollbar pb-2">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr>
                {/* Sticky Staff Column Header */}
                <th className="sticky left-0 z-20 bg-[#f4f3ef] border-b border-r border-[#d5d4ce] px-8 py-6 w-72 shadow-[2px_0_6px_rgba(0,0,0,0.05)]">
                  <div className="flex items-center gap-3 text-[#1a1a1a]">
                    <User className="w-5 h-5" />
                    <span className="text-sm font-black tracking-[0.2em] uppercase">Staff Member</span>
                  </div>
                </th>

                {/* Day Columns */}
                {days.map((d, idx) => {
                  const today = isToday(d);
                  return (
                    <th key={idx} className={`relative z-10 border-b border-[#d5d4ce] px-2 py-4 min-w-[64px] text-center transition-colors hover:bg-black/5 ${today ? 'bg-[#1a1a1a]/5' : 'bg-[#f4f3ef]'}`}>
                      <div className="flex flex-col items-center gap-2">
                        <span className={`text-[10px] uppercase font-black tracking-[0.2em] ${today ? 'text-[#1a1a1a]' : 'text-black/40'}`}>
                          {d.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}
                        </span>
                        <div className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-black shadow-sm transition-all ${today
                          ? 'bg-[#1a1a1a] text-[#f4f3ef] shadow-[0_0_10px_rgba(26,26,26,0.3)]'
                          : 'bg-black/5 border border-[#d5d4ce] text-black/80'
                          }`}>
                          {d.getDate()}
                        </div>
                      </div>
                      {/* Active Day Indicator Line */}
                      {today && <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#1a1a1a] mx-2 rounded-t-full shadow-[0_-1px_4px_rgba(26,26,26,0.2)]"></div>}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {staffProfiles.map((staff, rIdx) => (
                <tr key={staff.id} className="group hover:bg-black/5 transition-colors duration-200">

                  {/* Sticky Name Cell */}
                  <td className="sticky left-0 z-10 bg-[#f4f3ef] group-hover:bg-[#eae9e4] border-b border-r border-[#d5d4ce] px-8 py-5 transition-colors shadow-[2px_0_6px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center gap-4">
                      {/* Initials Avatar */}
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br from-[#eae9e4] to-[#f4f3ef] border border-[#d5d4ce] flex items-center justify-center font-black shrink-0 text-sm shadow-inner ${getAvatarColor(staff.full_name)}`}>
                        {staff.full_name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[#1a1a1a] font-black text-sm tracking-wide truncate leading-tight group-hover:text-black transition-colors">
                          {staff.full_name}
                        </span>
                        {staff.department && (
                          <span className="text-[9px] text-[#1a1a1a]/60 font-bold tracking-[0.2em] uppercase mt-1 truncate">
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

                    return (
                      <td
                        key={cIdx}
                        onClick={() => onCellClick(staff.id, d)}
                        className={`border-b border-[#d5d4ce] px-1 py-2 text-center align-middle cursor-pointer relative transition-colors ${today ? 'bg-[#1a1a1a]/5' : ''
                          }`}
                      >
                        {/* Interactive Hover Area */}
                        <div className="w-full h-full flex items-center justify-center p-1">
                          {s ? (
                            <div className={`relative ${getShiftStyle(code)}`}>
                              <span>{getCodeLabel(code)}</span>
                              {(s.overtime_hours || 0) > 0 && (
                                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#1a1a1a] text-white text-[9px] flex items-center justify-center rounded-full border border-white/50 shadow-sm font-black z-10" title={`Overtime: ${s.overtime_hours} hrs`}>
                                  OT
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-transparent border border-transparent hover:border-black/10 hover:bg-black/5 transition-all duration-300 flex items-center justify-center group-hover/cell:scale-110">
                              <div className="w-1.5 h-1.5 rounded-full bg-black/10"></div>
                            </div>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Color Legend */}
        <div className="bg-[#eae9e4] p-4 border-t border-[#d5d4ce]">
          <div className="flex flex-wrap items-center justify-center gap-6">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded-md bg-gradient-to-br from-[#2563EB] to-[#3B82F6] border border-[#2563EB]/30"></div>
              <span className="text-xs font-bold text-[#1a1a1a]">D (Day)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded-md bg-gradient-to-br from-[#059669] to-[#10B981] border border-[#059669]/30"></div>
              <span className="text-xs font-bold text-[#1a1a1a]">E (Evening)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded-md bg-gradient-to-br from-[#D97706] to-[#F59E0B] border border-[#D97706]/30"></div>
              <span className="text-xs font-bold text-[#1a1a1a]">HD (Half Day)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded-md bg-gradient-to-br from-[#eae9e4] to-[#f4f3ef] border border-[#d5d4ce] border-dashed"></div>
              <span className="text-xs font-bold text-[#1a1a1a]">RD (Rest Day)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded-md bg-gradient-to-br from-[#DC2626] to-[#EF4444] border border-[#DC2626]/30"></div>
              <span className="text-xs font-bold text-[#1a1a1a]">L (Leave)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded-md bg-gradient-to-br from-[#DB2777] to-[#EC4899] border border-[#DB2777]/30"></div>
              <span className="text-xs font-bold text-[#1a1a1a]">OT (Overtime)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded-md bg-gradient-to-br from-[#4F46E5] to-[#6366F1] border border-[#4F46E5]/30"></div>
              <span className="text-xs font-bold text-[#1a1a1a]">T (Training)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded-md bg-gradient-to-br from-[#7C3AED] to-[#8B5CF6] border border-[#7C3AED]/30"></div>
              <span className="text-xs font-bold text-[#1a1a1a]">TOIL</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default MonthlyRosterTimeline



