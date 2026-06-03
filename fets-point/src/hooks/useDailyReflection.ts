import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const USER_ID = '48cb5f19-4de4-4f50-a8c8-561a1865be38'

export const useDailyReflection = (date?: string) => {
  const targetDate = date || new Date().toISOString().split('T')[0]
  return useQuery<any | null, Error>({
    queryKey: ['daily_reflections', targetDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_reflections')
        .select('*')
        .eq('user_id', USER_ID)
        .eq('date', targetDate)
        .maybeSingle()
      if (error) {
        if (error.code === '42P01') return null
        throw error
      }
      return data
    },
    staleTime: 30000,
    retry: false,
  })
}

export const useUpsertDailyReflection = () => {
  const queryClient = useQueryClient()
  return useMutation<any, Error, { date: string; one_line?: string; tomorrows_star?: string }>({
    mutationFn: async ({ date, one_line, tomorrows_star }) => {
      const { data: existing } = await supabase
        .from('daily_reflections')
        .select('id')
        .eq('user_id', USER_ID)
        .eq('date', date)
        .maybeSingle()

      if (existing?.id) {
        const { data, error } = await supabase
          .from('daily_reflections')
          .update({ one_line, tomorrows_star, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select()
          .single()
        if (error) throw error
        return data
      } else {
        const { data, error } = await supabase
          .from('daily_reflections')
          .insert({ user_id: USER_ID, date, one_line, tomorrows_star })
          .select()
          .single()
        if (error) throw error
        return data
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['daily_reflections', variables.date] })
    },
  })
}
