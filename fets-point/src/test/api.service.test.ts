/**
 * Comprehensive Unit Tests for API Services
 * Tests all CRUD operations for each service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  candidatesService,
  incidentsService,
  rosterService,
  sessionsService,
  staffService,
  postsService,
  chatService,
  ApiError
} from '../services/api.service'
import { supabase } from '../lib/supabase'

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn()
  }
}))

describe('Candidates Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch all candidates', async () => {
    const mockData = [
      { id: '1', full_name: 'John Doe', status: 'registered' },
      { id: '2', full_name: 'Jane Smith', status: 'checked_in' }
    ]

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockData, error: null })
    }

    vi.mocked(supabase.from).mockReturnValue(mockQuery as any)

    const result = await candidatesService.getAll()

    expect(supabase.from).toHaveBeenCalledWith('candidates')
    expect(result).toEqual(mockData)
  })

  it('should fetch candidates with filters', async () => {
    const mockData = [{ id: '1', full_name: 'John Doe', status: 'registered' }]

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockData, error: null })
    }

    vi.mocked(supabase.from).mockReturnValue(mockQuery as any)

    const result = await candidatesService.getAll({
      date: '2025-01-01',
      status: 'registered',
      branch_location: 'calicut'
    })

    expect(mockQuery.gte).toHaveBeenCalled()
    expect(mockQuery.lte).toHaveBeenCalled()
    expect(mockQuery.eq).toHaveBeenCalledWith('status', 'registered')
    expect(mockQuery.eq).toHaveBeenCalledWith('branch_location', 'calicut')
    expect(result).toEqual(mockData)
  })

  it('should create a candidate', async () => {
    const candidateData = {
      full_name: 'John Doe',
      email: 'john@example.com',
      status: 'registered',
      confirmation_number: 'EXAM2025-001'
    }

    const mockQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: candidateData, error: null })
    }

    vi.mocked(supabase.from).mockReturnValue(mockQuery as any)

    const result = await candidatesService.create(candidateData)

    expect(supabase.from).toHaveBeenCalledWith('candidates')
    expect(mockQuery.insert).toHaveBeenCalledWith(candidateData)
    expect(result).toEqual(candidateData)
  })

  it('should update a candidate', async () => {
    const updates = { status: 'checked_in' }
    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updates, error: null })
    }

    vi.mocked(supabase.from).mockReturnValue(mockQuery as any)

    const result = await candidatesService.update('1', updates)

    expect(mockQuery.update).toHaveBeenCalled()
    expect(mockQuery.eq).toHaveBeenCalledWith('id', '1')
    expect(result).toEqual(updates)
  })

  it('should delete a candidate', async () => {
    const mockQuery = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null })
    }

    vi.mocked(supabase.from).mockReturnValue(mockQuery as any)

    await candidatesService.delete('1')

    expect(mockQuery.delete).toHaveBeenCalled()
    expect(mockQuery.eq).toHaveBeenCalledWith('id', '1')
  })

  it('should throw ApiError on failure', async () => {
    const mockError = { message: 'Database error', code: '500' }
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: mockError })
    }

    vi.mocked(supabase.from).mockReturnValue(mockQuery as any)

    await expect(candidatesService.getAll()).rejects.toThrow(ApiError)
  })
})

describe('Sessions Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch all sessions', async () => {
    const mockData = [
      { id: 1, client_name: 'ETS', exam_name: 'TOEFL', date: '2025-01-15' }
    ]

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockData, error: null })
    }

    vi.mocked(supabase.from).mockReturnValue(mockQuery as any)

    const result = await sessionsService.getAll()

    expect(supabase.from).toHaveBeenCalledWith('calendar_sessions')
    expect(result).toEqual(mockData)
  })

  it('should create a session', async () => {
    const sessionData = {
      client_name: 'ETS',
      exam_name: 'TOEFL',
      date: '2025-01-15',
      start_time: '09:00',
      end_time: '12:00',
      candidate_count: 0
    }

    const mockQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: sessionData, error: null })
    }

    vi.mocked(supabase.from).mockReturnValue(mockQuery as any)

    const result = await sessionsService.create(sessionData)

    expect(result).toEqual(sessionData)
  })
})

describe('Staff Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch all staff with filters', async () => {
    const mockData = [
      { id: '1', full_name: 'Alice Johnson', department: 'Operations', status: 'active' }
    ]

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockData, error: null })
    }

    vi.mocked(supabase.from).mockReturnValue(mockQuery as any)

    const result = await staffService.getAll({ department: 'Operations', status: 'active' })

    expect(mockQuery.eq).toHaveBeenCalledWith('department', 'Operations')
    expect(mockQuery.eq).toHaveBeenCalledWith('status', 'active')
    expect(result).toEqual(mockData)
  })
})

describe('Posts Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch posts with relations', async () => {
    const mockData = [
      {
        id: '1',
        content: 'Hello world',
        profiles: { full_name: 'John Doe' },
        post_media: [],
        post_likes: { count: 5 },
        post_comments: { count: 2 }
      }
    ]

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockData, error: null })
    }

    vi.mocked(supabase.from).mockReturnValue(mockQuery as any)

    const result = await postsService.getAll()

    expect(mockQuery.select).toHaveBeenCalledWith(expect.stringContaining('profiles'))
    expect(result).toEqual(mockData)
  })
})

describe('Chat Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch messages for a room', async () => {
    const mockData = [
      { id: '1', text: 'Hello', room_id: 'room1', profiles: { full_name: 'John' } }
    ]

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockData, error: null })
    }

    vi.mocked(supabase.from).mockReturnValue(mockQuery as any)

    const result = await chatService.getMessages('room1')

    expect(mockQuery.eq).toHaveBeenCalledWith('room_id', 'room1')
    expect(result).toEqual(mockData)
  })

  it('should send a message', async () => {
    const message = {
      conversation_id: 'room1',
      sender_id: 'user1',
      content: 'Hello'
    }

    const mockQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: message, error: null })
    }

    vi.mocked(supabase.from).mockReturnValue(mockQuery as any)

    const result = await chatService.sendMessage(message)

    expect(result).toEqual(message)
  })
})

describe('Incidents Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch incidents with profile relation', async () => {
    const mockData = [
      {
        id: '1',
        title: 'System Down',
        status: 'open',
        profiles: { full_name: 'John Doe' }
      }
    ]

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockData, error: null })
    }

    vi.mocked(supabase.from).mockReturnValue(mockQuery as any)

    const result = await incidentsService.getAll({ status: 'open' })

    expect(mockQuery.eq).toHaveBeenCalledWith('status', 'open')
    expect(result).toEqual(mockData)
  })
})

describe('Roster Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch schedules with profile relation', async () => {
    const mockData = [
      {
        id: '1',
        date: '2025-01-15',
        shift_code: 'D',
        profiles: { full_name: 'John Doe', role: 'staff' }
      }
    ]

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockData, error: null })
    }

    vi.mocked(supabase.from).mockReturnValue(mockQuery as any)

    const result = await rosterService.getSchedules({ date: '2025-01-15' })

    expect(mockQuery.eq).toHaveBeenCalledWith('date', '2025-01-15')
    expect(result).toEqual(mockData)
  })
})

