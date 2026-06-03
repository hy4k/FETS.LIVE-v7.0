import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const USER_ID = '48cb5f19-4de4-4f50-a8c8-561a1865be38'

export const useGoals = (period?: string) => {
  return useQuery<any[], Error>({
    queryKey: ['goals', period],
    queryFn: async () => {
      let query = supabase.from('goals').select('*').eq('user_id', USER_ID)
      if (period) query = query.eq('period', period)
      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    staleTime: 10000,
  })
}

export const useAddGoal = () => {
  const queryClient = useQueryClient()
  return useMutation<any, Error, any>({
    mutationFn: async (goalData: any) => {
      const { data, error } = await supabase.from('goals').insert({ ...goalData, user_id: USER_ID }).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
    },
  })
}

export const useUpdateGoal = () => {
  const queryClient = useQueryClient()
  return useMutation<any, Error, { id: string; updates: any }>({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { data, error } = await supabase.from('goals').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
    },
  })
}

export const useDeleteGoal = () => {
  const queryClient = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('goals').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
    },
  })
}
