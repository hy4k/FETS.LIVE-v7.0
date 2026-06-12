import { Schedule, StaffProfile } from '../types/shared';

interface RosterListViewProps {
  schedules: Schedule[];
  staffProfiles: StaffProfile[];
}

export function RosterListView({ schedules, staffProfiles }: RosterListViewProps) {
  const getStaffName = (profileId: string): string => {
    const staff = staffProfiles.find(s => s.id === profileId);
    return staff?.full_name || 'Unknown Staff';
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-[#f4f3ef] shadow-sm rounded-2xl border border-[#d5d4ce]">
        <thead className="bg-[#eae9e4]">
          <tr>
            <th className="py-4 px-6 text-left text-xs font-black uppercase tracking-wider text-black/60">Date</th>
            <th className="py-4 px-6 text-left text-xs font-black uppercase tracking-wider text-black/60">Staff Name</th>
            <th className="py-4 px-6 text-left text-xs font-black uppercase tracking-wider text-black/60">Shift</th>
            <th className="py-4 px-6 text-left text-xs font-black uppercase tracking-wider text-black/60">Overtime</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#d5d4ce]">
          {schedules.map(schedule => (
            <tr key={schedule.id} className="hover:bg-black/5 transition-colors">
              <td className="py-4 px-6 text-sm font-medium text-[#1a1a1a]">{schedule.date}</td>
              <td className="py-4 px-6 text-sm font-bold text-[#1a1a1a]">{getStaffName(schedule.profile_id)}</td>
              <td className="py-4 px-6 text-sm font-mono font-black text-[#1a1a1a]">{schedule.shift_code}</td>
              <td className="py-4 px-6 text-sm font-mono text-[#1a1a1a]">{schedule.overtime_hours || 0} hrs</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

