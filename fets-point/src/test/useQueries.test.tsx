import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCandidateMetrics, useIncidentStats } from '../hooks/useQueries'

// Mock the supabase client and helpers
const mockFrom = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
  supabaseHelpers: {
    getCandidates: vi.fn(),
    getIncidents: vi.fn(),
  },
}))

// Test QueryClient
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
    },
  },
})

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createTestQueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('useQueries hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useCandidateMetrics', () => {
    it('should return candidate metrics', async () => {
      const mockCandidates = [
        { id: '1', status: 'checked_in', exam_date: '2025-09-19T10:00:00Z' },
        { id: '2', status: 'in_progress', exam_date: '2025-09-19T10:00:00Z' },
        { id: '3', status: 'completed', exam_date: '2025-09-19T10:00:00Z' },
        { id: '4', status: 'registered', exam_date: '2025-09-19T10:00:00Z' },
      ]

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockCandidates, error: null }),
      }
      mockFrom.mockReturnValue(mockQuery)

      const { result } = renderHook(() => useCandidateMetrics('2025-09-19'), { wrapper })

      await waitFor(() => {
        expect(result.current.data).toEqual({
          total: 4,
          checkedIn: 1,
          inProgress: 1,
          completed: 1,
        })
      })

      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe(null)
    })

    it('should handle empty candidates', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }
      mockFrom.mockReturnValue(mockQuery)

      const { result } = renderHook(() => useCandidateMetrics('2025-09-19'), { wrapper })

      await waitFor(() => {
        expect(result.current.data).toEqual({
          total: 0,
          checkedIn: 0,
          inProgress: 0,
          completed: 0,
        })
      })
    })

    it('should handle errors', async () => {
      const mockError = { 
        name: 'PostgrestError',
        message: 'Database connection failed',
        details: 'Connection timeout',
        hint: 'Check your network connection',
        code: '500'
      }
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      }
      mockFrom.mockReturnValue(mockQuery)

      const { result } = renderHook(() => useCandidateMetrics('2025-09-19'), { wrapper })

      await waitFor(() => {
        expect(result.current.error).toEqual(mockError)
      })
    })
  })

  describe('useIncidentStats', () => {
    it('should return incident statistics', async () => {
      const mockIncidents = [
        { id: '1', status: 'open', priority: 'high' },
        { id: '2', status: 'in_progress', priority: 'medium' },
        { id: '3', status: 'rectified', priority: 'low' },
        { id: '4', status: 'closed', priority: 'medium' },
      ]

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockIncidents, error: null }),
      }
      mockFrom.mockReturnValue(mockQuery)

      const { result } = renderHook(() => useIncidentStats(), { wrapper })

      await waitFor(() => {
        expect(result.current.data).toEqual({
          total: 4,
          open: 1,
          inProgress: 1,
          resolved: 2,
        })
      })
    })

    it('should handle no incidents', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }
      mockFrom.mockReturnValue(mockQuery)

      const { result } = renderHook(() => useIncidentStats(), { wrapper })

      await waitFor(() => {
        expect(result.current.data).toEqual({
          total: 0,
          open: 0,
          inProgress: 0,
          resolved: 0,
        })
      })
    })
  })
})
