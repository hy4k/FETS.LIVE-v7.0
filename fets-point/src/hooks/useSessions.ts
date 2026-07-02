import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Session } from '../types' // Assuming types are defined in src/types.ts
import { SessionFilters } from '../types/filters'

/**
 * Fetches sessions from the database based on a set of filters.
 * @param {SessionFilters} filters - The filters to apply to the query.
 */
const fetchSessions = async (filters: SessionFilters = {}) => {
  let query: any = supabase.from('calendar_sessions').select('*')

  // Apply filters dynamically
  if (filters.date) {
    query = query.eq('date', filters.date)
  }
  if (filters.startDate) {
    query = query.gte('date', filters.startDate)
  }
  if (filters.endDate) {
    query = query.lte('date', filters.endDate)
  }
  if (filters.branch) {
    query = query.eq('branch_location', filters.branch)
  }
  if (filters.clientName) {
    // Use 'ilike' for case-insensitive partial matching
    query = query.ilike('client_name', `%${filters.clientName}%`)
  }
  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query.order('date').order('start_time')

  if (error) throw new Error(error.message)

  const sessions = (data as Session[]) || []
  return sessions.map(s => {
    const clientUpper = (s.client_name || '').toUpperCase().trim();
    const examUpper = (s.exam_name || '').toUpperCase().trim();
    if (clientUpper === 'PROMETRIC') {
      if (examUpper.includes('CMA US') || examUpper.includes('CMA')) {
        return { ...s, client_name: 'CMA US' };
      }
      if (examUpper.includes('CELPIP')) {
        return { ...s, client_name: 'CELPIP' };
      }
    }
    return s;
  });
}

export function useSessions(filters: SessionFilters = {}): UseQueryResult<Session[], Error> {
  return useQuery({
    // The query key now includes the filters object to ensure unique caching.
    queryKey: ['sessions', filters],
    queryFn: () => fetchSessions(filters),
  })
}