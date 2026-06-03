import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const USER_ID = '48cb5f19-4de4-4f50-a8c8-561a1865be38'

export const useReminders = (year?: number, month?: number) => {
  return useQuery<any[], Error>({
    queryKey: ['reminders', year, month],
    queryFn: async () => {
      let query = supabase.from('reminders').select('*').eq('user_id', USER_ID)
      if (year && month != null) {
        const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
        const endMonth = month === 11 ? 0 : month + 1
        const endYear = month === 11 ? year + 1 : year
        const end = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-01`
        query = query.gte('event_date', start).lt('event_date', end)
      }
      const { data, error } = await query.order('event_date', { ascending: true })
      if (error) throw error
      return data || []
    },
    staleTime: 10000,
  })
}

export const useAddReminder = () => {
  const queryClient = useQueryClient()
  return useMutation<any, Error, any>({
    mutationFn: async (reminderData: any) => {
      const { data, error } = await supabase.from('reminders').insert({ ...reminderData, user_id: USER_ID }).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
    },
  })
}

export const useUpdateReminder = () => {
  const queryClient = useQueryClient()
  return useMutation<any, Error, { id: string; updates: any }>({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { data, error } = await supabase.from('reminders').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
    },
  })
}

export const useDeleteReminder = () => {
  const queryClient = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reminders').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
    },
  })
}
