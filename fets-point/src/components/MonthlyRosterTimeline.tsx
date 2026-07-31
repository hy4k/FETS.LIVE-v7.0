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

// Generate consistent refined colors for avatars
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

  // Filter out staff profiles that are explicitly marked inactive for the month
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

      <div className="bg-[#f4f3ef] rounded-3xl border border-[#d5d4ce] overflow-hidden flex flex-col h-full font-sans shadow-lg p-3">
        <div className="overflow-x-auto flex-1 premium-scrollbar pb-2">
          {/* border-spacing-y-4 creates a physical gap between every staff member row */}
          <table className="min-w-full border-separate border-spacing-y-4 border-spacing-x-0">
            <thead>
              <tr>
                {/* Sticky Staff Column Header */}
                <th className="sticky left-0 z-20 bg-[#f4f3ef] border-b-2 border-r border-[#d5d4ce] px-8 py-5 w-72 shadow-[2px_0_6px_rgba(0,0,0,0.05)] rounded-tl-2xl">
                  <div className="flex items-center gap-3 text-[#1a1a1a]">
                    <User className="w-5 h-5" />
                    <span className="text-sm font-black tracking-[0.2em] uppercase">Staff Member</span>
                  </div>
                </th>

                {/* Day Columns */}
                {days.map((d, idx) => {
                  const today = isToday(d);
                  return (
                    <th key={idx} className={`relative z-10 border-b-2 border-[#d5d4ce] px-2 py-4 min-w-[64px] text-center transition-colors hover:bg-black/5 ${today ? 'bg-[#1a1a1a]/5' : 'bg-[#f4f3ef]'}`}>
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
              {activeStaffProfiles.map((staff) => (
                /* Each staff member is rendered as a spacious card row with rounded corners & vertical gaps */
                <tr key={staff.id} className="group transition-all duration-200 hover:shadow-md">

                  {/* Sticky Name Cell with spacious padding */}
                  <td className="sticky left-0 z-10 bg-white group-hover:bg-[#FAF9F5] border-t border-b border-l border-[#D5D4CE] rounded-l-2xl px-6 py-6 transition-colors shadow-[2px_0_10px_rgba(0,0,0,0.06)]">
                    <div className="flex items-center gap-4">
                      {/* Initials Avatar */}
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br from-[#EAE9E4] to-[#F4F3EF] border border-[#D5D4CE] flex items-center justify-center font-black shrink-0 text-sm shadow-inner ${getAvatarColor(staff.full_name)}`}>
                        {staff.full_name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[#1A1A1A] font-black text-sm tracking-wide truncate leading-tight group-hover:text-black transition-colors">
                          {staff.full_name}
                        </span>
                        {staff.department && (
                          <span className="text-[9px] text-[#1A1A1A]/60 font-bold tracking-[0.2em] uppercase mt-1 truncate">
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
                        className={`bg-white group-hover:bg-[#FAF9F5] border-t border-b border-[#D5D4CE] ${isLastCol ? 'border-r rounded-r-2xl' : ''} px-1.5 py-4 text-center align-middle cursor-pointer relative transition-colors ${today ? 'bg-[#1A1A1A]/5' : ''
                          }`}
                      >
                        {/* Interactive Hover Area */}
                        <div className="w-full h-full flex items-center justify-center p-1">
                          {s ? (
                            <div className={`relative ${getShiftStyle(code)}`}>
                              <span>{getCodeLabel(code)}</span>
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-xl border border-dashed border-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:border-black/30 hover:bg-black/5">
                              <span className="text-black/30 text-xs font-bold">+</span>
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
      </div>
    </>
  )
}
