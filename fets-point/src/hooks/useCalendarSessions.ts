import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'
import { fetchCalendarRange } from '../seats/calendar-data'
import { Session } from '../types' // Assuming a shared Session type

const fetchCalendarSessions = async (currentDate: Date, activeBranch: string, applyFilter: (q: any) => any, isGlobalView: boolean) => {
  const year=currentDate.getFullYear(),month=currentDate.getMonth()+1;
  const startDateIST=`${year}-${String(month).padStart(2,'0')}-01`;
  const endDateIST=`${year}-${String(month).padStart(2,'0')}-${new Date(Date.UTC(year,month,0)).getUTCDate()}`;
  const data=await fetchCalendarRange(startDateIST,endDateIST,isGlobalView?'global':activeBranch,isGlobalView?undefined:applyFilter);

  const sessions = (data as Session[]) || []
  // Preserve source provider identity for both the Calendar and seat context.
  return sessions.map(s => ({ ...s, client_name: (s.client_name || '').trim() }));
}

export const useCalendarSessions = (currentDate: Date, activeBranch: string, applyFilter: (q: any) => any, isGlobalView: boolean) => {
  const queryKey = ['sessions', 'calendar', currentDate.getFullYear(), currentDate.getMonth(), activeBranch]

  return useQuery<Session[], Error>({
    queryKey,
    queryFn: () => fetchCalendarSessions(currentDate, activeBranch, applyFilter, isGlobalView),
    staleTime:10000, refetchInterval:60000, refetchOnWindowFocus:true,
  })
}

const addSession = async (sessionData: Omit<Session, 'id'>) => {
  const { error } = await supabase.from('calendar_sessions').insert([sessionData])
  if (error) throw error
}

const updateSession = async (sessionData: Partial<Session> & { id: number }) => {
  const { error } = await supabase.from('calendar_sessions').update(sessionData).eq('id', sessionData.id)
  if (error) throw error
}

const deleteSession = async (sessionId: number) => {
  const { error } = await supabase.from('calendar_sessions').delete().eq('id', sessionId)
  if (error) throw error
}

export const useSessionMutations = () => {
  const queryClient = useQueryClient()

  const invalidateSessions = () => {
    queryClient.invalidateQueries({ queryKey: ['sessions', 'calendar'] })
    queryClient.invalidateQueries({ queryKey: ['seat-context'] })
    queryClient.invalidateQueries({ queryKey: ['dashboardStats'] })
    queryClient.invalidateQueries({ queryKey: ['upcomingSchedule'] })
  }

  const addMutation = useMutation({
    mutationFn: addSession,
    onSuccess: () => {
      toast.success('Session created successfully!')
      invalidateSessions()
    },
    onError: (error: Error) => toast.error(`Failed to create session: ${error.message}`),
  })

  const updateMutation = useMutation({
    mutationFn: updateSession,
    onSuccess: () => {
      toast.success('Session updated successfully!')
      invalidateSessions()
    },
    onError: (error: Error) => toast.error(`Failed to update session: ${error.message}`),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSession,
    onSuccess: () => {
      toast.success('Session deleted successfully!')
      invalidateSessions()
    },
    onError: (error: Error) => toast.error(`Failed to delete session: ${error.message}`),
  })

  return {
    addSession: addMutation.mutateAsync,
    updateSession: updateMutation.mutateAsync,
    deleteSession: deleteMutation.mutateAsync,
    isMutating: addMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  }
}