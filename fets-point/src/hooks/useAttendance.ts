import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'
import { clockParts } from '../roster-workspace/model'

export interface AttendanceRecord {
  id?: string
  staff_id: string
  staff_name?: string
  date: string
  check_in?: string | null
  check_out?: string | null
  status: 'present' | 'absent' | 'late' | 'half_day'
  notes?: string
  branch_location?: string
  created_at?: string
  updated_at?: string
}

// ── Fetch ────────────────────────────────────────────────────────────────────

const fetchAttendance = async (
  dateFrom: string,
  dateTo: string,
  branch?: string
): Promise<AttendanceRecord[]> => {
  try {
    let query = supabase
      .from('staff_attendance')
      .select('*')
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .order('date', { ascending: false })

    if (branch && branch !== 'global' && branch !== 'all') {
      query = query.eq('branch_location', branch)
    }

    const { data, error } = await query

    // Graceful fallback if table doesn't exist yet
    if (error && (error as any).code === '42P01') {
      console.warn('staff_attendance table not yet created. Run the migration SQL.')
      return []
    }
    if (error) throw new Error(error.message)
    return (data as AttendanceRecord[]) || []
  } catch {
    return []
  }
}

export const useAttendance = (dateFrom: string, dateTo: string, branch?: string) => {
  return useQuery<AttendanceRecord[], Error>({
    queryKey: ['attendance', dateFrom, dateTo, branch],
    queryFn: () => fetchAttendance(dateFrom, dateTo, branch),
    staleTime: 60_000,
  })
}

// ── Check In ──────────────────────────────────────────────────────────────────

const checkIn = async (payload: {
  staff_id: string
  date: string
  branch_location?: string
  notes?: string
}) => {
  if (payload.date !== clockParts().day) throw new Error('Check-in is for today only.')
  const { data, error } = await (supabase as any).rpc('roster_attendance_action', { p_action: 'in', p_staff: payload.staff_id })
  if (error) throw new Error(error.message)
  return data as AttendanceRecord
}

const checkOut = async (payload: { staff_id: string; date: string }) => {
  if (payload.date !== clockParts().day) throw new Error('Check-out is for today only.')
  const { error } = await (supabase as any).rpc('roster_attendance_action', { p_action: 'out', p_staff: payload.staff_id })
  if (error) throw new Error(error.message)
}

// ── Update status ─────────────────────────────────────────────────────────────

const updateAttendanceStatus = async (payload: {
  staff_id: string
  date: string
  status: AttendanceRecord['status']
  notes?: string
}) => {
  const { error } = await supabase
    .from('staff_attendance')
    .upsert([{
      ...payload,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }], { onConflict: 'staff_id,date' })

  if (error) throw new Error(error.message)
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export const useAttendanceMutations = () => {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['attendance'] })

  const checkInMut = useMutation({
    mutationFn: checkIn,
    onSuccess: () => { toast.success('Check-in recorded ✓'); invalidate() },
    onError: (e: Error) => toast.error(`Check-in failed: ${e.message}`),
  })

  const checkOutMut = useMutation({
    mutationFn: checkOut,
    onSuccess: () => { toast.success('Check-out recorded ✓'); invalidate() },
    onError: (e: Error) => toast.error(`Check-out failed: ${e.message}`),
  })

  const updateStatusMut = useMutation({
    mutationFn: updateAttendanceStatus,
    onSuccess: () => { toast.success('Attendance updated'); invalidate() },
    onError: (e: Error) => toast.error(`Update failed: ${e.message}`),
  })

  return {
    checkIn: checkInMut.mutateAsync,
    checkOut: checkOutMut.mutateAsync,
    updateStatus: updateStatusMut.mutateAsync,
    isChecking: checkInMut.isPending || checkOutMut.isPending,
  }
}

// ── Weekly Summary ────────────────────────────────────────────────────────────

export const getWeeklyAttendanceSummary = (
  records: AttendanceRecord[],
  staffId: string
) => {
  const staffRecords = records.filter(r => r.staff_id === staffId)
  return {
    present: staffRecords.filter(r => r.status === 'present').length,
    late: staffRecords.filter(r => r.status === 'late').length,
    absent: staffRecords.filter(r => r.status === 'absent').length,
    halfDay: staffRecords.filter(r => r.status === 'half_day').length,
    total: staffRecords.length,
  }
}
