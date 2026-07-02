import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCalendarSessions } from '../hooks/useCalendarSessions'

// Mock the supabase client
const mockFrom = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}))

// Test QueryClient wrapper
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

describe('useCalendarSessions mapping logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should map Prometric clients correctly based on the exam name', async () => {
    const mockSessions = [
      { id: 1, client_name: 'PROMETRIC', exam_name: 'CMA US Part 1', date: '2026-06-12', start_time: '09:00', end_time: '12:00' },
      { id: 2, client_name: 'PROMETRIC', exam_name: 'CELPIP General', date: '2026-06-12', start_time: '13:00', end_time: '16:00' },
      { id: 3, client_name: 'PROMETRIC', exam_name: 'USMLE Step 1', date: '2026-06-12', start_time: '09:00', end_time: '17:00' },
      { id: 4, client_name: 'PEARSON VUE', exam_name: 'CELPIP General', date: '2026-06-12', start_time: '09:00', end_time: '12:00' }
    ]

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      // Final mock resolver
      then: vi.fn().mockImplementation((resolve) => {
        return Promise.resolve(resolve({ data: mockSessions, error: null }))
      })
    }
    mockFrom.mockReturnValue(mockQuery)

    const applyFilter = (q: any) => q
    const { result } = renderHook(() => useCalendarSessions(new Date('2026-06-12'), 'calicut', applyFilter, false), { wrapper })

    await waitFor(() => {
      expect(result.current.data).toBeDefined()
      expect(result.current.data!.length).toBe(4)
    })

    const data = result.current.data!
    
    // CMA US exam under Prometric gets mapped to CMA US client
    expect(data[0].client_name).toBe('CMA US')
    expect(data[0].exam_name).toBe('CMA US Part 1')

    // CELPIP exam under Prometric gets mapped to CELPIP client
    expect(data[1].client_name).toBe('CELPIP')
    expect(data[1].exam_name).toBe('CELPIP General')

    // Other exams under Prometric retain Prometric client name
    expect(data[2].client_name).toBe('PROMETRIC')
    expect(data[2].exam_name).toBe('USMLE Step 1')

    // Exams under other clients (e.g. Pearson Vue) retain their original client name
    expect(data[3].client_name).toBe('PEARSON VUE')
    expect(data[3].exam_name).toBe('CELPIP General')
  })
})
