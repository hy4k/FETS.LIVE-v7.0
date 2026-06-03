import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const USER_ID = '48cb5f19-4de4-4f50-a8c8-561a1865be38'

export const useTodos = (date?: string) => {
  const targetDate = date || new Date().toISOString().split('T')[0]
  return useQuery<any[], Error>({
    queryKey: ['todos', targetDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', USER_ID)
        .eq('status', 'done')
        .gte('updated_at', `${targetDate}T00:00:00`)
        .lte('updated_at', `${targetDate}T23:59:59`)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    staleTime: 30000,
  })
}
