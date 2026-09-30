import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabaseHelpers, supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'
import type { Tables, TablesInsert, TablesUpdate } from '../types/database.types'

// Local type definitions
interface CandidateMetrics {
  total: number;
  checkedIn: number;
  inProgress: number;
  completed: number;
}

interface IncidentStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
}
import {
  candidatesService,
  incidentsService,
  rosterService,
  sessionsService,
  staffService,
  postsService,
  chatService,
  // profilesService, // DEPRECATED: Use staffService instead
  vaultService,
  ApiError
} from '../services/api.service'
import { handleError, handleSuccess } from '../utils/errorHandler'

// Enhanced candidates query with real-time integration
export const useCandidates = (filters?: { date?: string; startDate?: string; endDate?: string; status?: string; branch_location?: string }) => {
  return useQuery<any[], Error>({
    queryKey: ['candidates', filters],
    queryFn: async () => {
      const { data, error } = await supabaseHelpers.getCandidates(filters)
      if (error) throw error
      return data?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) || []
    },
    staleTime: 10000, // Reduced to 10 seconds for better real-time experience
    gcTime: 300000, // 5 minutes cache time
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })
}

export const useTotalCandidatesCount = (branch?: string) => {
  return useQuery<number, Error>({
    queryKey: ['candidates', 'count', branch],
    queryFn: async () => {
      let query = supabase.from('candidates').select('*', { count: 'exact', head: true })
      if (branch && branch !== 'global') {
        query = query.eq('branch_location', branch)
      }
      const { count, error } = await query
      if (error) throw error
      return count || 0
    },
    staleTime: 60000,
  })
}

export const useCandidateMetrics = (date?: string, branch?: string): { data: CandidateMetrics | undefined; isLoading: boolean; error: Error | null } => {
  return useQuery({
    queryKey: ['candidates', 'metrics', date, branch],
    queryFn: async (): Promise<CandidateMetrics> => {
      const targetDate = date || new Date().toISOString().split('T')[0]

      let query = supabase
        .from('candidates')
        .select('*')
        .gte('exam_date', targetDate)
        .lte('exam_date', `${targetDate}T23:59:59.999Z`)

      // Apply branch filtering
      if (branch && branch !== 'global') {
        query = query.eq('branch_location', branch)
      }

      const { data, error } = await query.order('exam_date', { ascending: true })

      if (error) throw error

      return {
        total: data?.length || 0,
        checkedIn: data?.filter(c => c.status === 'checked_in').length || 0,
        inProgress: data?.filter(c => c.status === 'in_progress').length || 0,
        completed: data?.filter(c => c.status === 'completed').length || 0,
      }
    },
    staleTime: 10000, // Reduced for real-time updates
    gcTime: 300000,
    refetchOnWindowFocus: true,
  })
}

// Enhanced incidents query with real-time integration
export const useIncidents = (status?: string) => {
  return useQuery<any[], Error>({
    queryKey: ['incidents', status],
    queryFn: async () => {
      const { data, error } = await supabaseHelpers.getIncidents(status)
      if (error) throw error
      return data || []
    },
    staleTime: 15000, // 15 seconds for incidents
    gcTime: 300000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })
}

export const useIncidentStats = (branch?: string): { data: IncidentStats | undefined; isLoading: boolean; error: Error | null } => {
  return useQuery({
    queryKey: ['incidents', 'stats', branch],
    queryFn: async (): Promise<IncidentStats> => {
      let query = supabase
        .from('events')
        .select('*')

      // Apply branch filtering
      if (branch && branch !== 'global') {
        query = query.eq('branch_location', branch)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error

      return {
        total: data?.length || 0,
        open: data?.filter(i => i.status === 'open').length || 0,
        inProgress: data?.filter(i => i.status === 'in_progress').length || 0,
        resolved: data?.filter(i => ['rectified', 'closed'].includes(i.status)).length || 0,
      }
    },
    staleTime: 15000,
    gcTime: 300000,
    refetchOnWindowFocus: true,
  })
}

// Enhanced roster query with real-time integration
export const useRosterSchedules = (date?: string) => {
  return useQuery<any[], Error>({
    queryKey: ['roster', date],
    queryFn: async () => {
      const { data, error } = await supabaseHelpers.getRosterSchedules(date)
      if (error) throw error
      return data || []
    },
    staleTime: 30000, // 30 seconds for roster data
    gcTime: 600000, // 10 minutes cache time for roster
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })
}

export const useClients = () => {
  return useQuery<any[], Error>({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*')
      if (error) throw error
      return data || []
    },
  })
}

// Mutations
export const useUpdateCandidateStatus = () => {
  const queryClient = useQueryClient()

  return useMutation<void, Error, { id: string; status: string }>({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('candidates')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['sessions', 'calendar'] })
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] })
      toast.success('Candidate status updated successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to update status: ${error.message}`)
    }
  })
}

export const useCreateCandidate = () => {
  const queryClient = useQueryClient()

  return useMutation<void, Error, any>({
    mutationFn: async (candidateData: any) => {
      const { error } = await supabase
        .from('candidates')
        .insert(candidateData)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['sessions', 'calendar'] })
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] })
      toast.success('Candidate created successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to create candidate: ${error.message}`)
    }
  })
}

export const useUpdateIncident = () => {
  const queryClient = useQueryClient()

  return useMutation<void, Error, { id: string; updates: any }>({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase
        .from('incidents')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
      toast.success('Incident updated successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to update incident: ${error.message}`)
    }
  })
}

export const useCreateIncident = () => {
  const queryClient = useQueryClient()

  return useMutation<void, Error, any>({
    mutationFn: async (incidentData: any) => {
      const { error } = await supabase
        .from('incidents')
        .insert(incidentData)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
      toast.success('Incident created successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to create incident: ${error.message}`)
    }
  })
}

// ============================================================================
// SESSIONS QUERIES & MUTATIONS
// ============================================================================

export const useSessions = (filters?: { date?: string }) => {
  return useQuery({
    queryKey: ['sessions', filters],
    queryFn: async () => {
      try {
        return await sessionsService.getAll(filters)
      } catch (error) {
        handleError(error, 'Fetching sessions')
        throw error
      }
    },
    staleTime: 30000,
    gcTime: 300000,
    refetchOnWindowFocus: true,
  })
}

export const useSession = (id: number) => {
  return useQuery({
    queryKey: ['sessions', id],
    queryFn: async () => {
      try {
        return await sessionsService.getById(id)
      } catch (error) {
        handleError(error, 'Fetching session')
        throw error
      }
    },
    enabled: !!id,
  })
}

export const useCreateSession = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (sessionData: TablesInsert<'calendar_sessions'>) => {
      try {
        return await sessionsService.create(sessionData)
      } catch (error) {
        handleError(error, 'Creating session')
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      handleSuccess('Session created successfully')
    }
  })
}

export const useUpdateSession = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: TablesUpdate<'calendar_sessions'> }) => {
      try {
        return await sessionsService.update(id, updates)
      } catch (error) {
        handleError(error, 'Updating session')
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      handleSuccess('Session updated successfully')
    }
  })
}

export const useDeleteSession = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      try {
        await sessionsService.delete(id)
      } catch (error) {
        handleError(error, 'Deleting session')
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      handleSuccess('Session deleted successfully')
    }
  })
}

// ============================================================================
// STAFF QUERIES & MUTATIONS
// ============================================================================

export const useStaff = (filters?: { department?: string; status?: string }) => {
  return useQuery({
    queryKey: ['staff', filters],
    queryFn: async () => {
      try {
        return await staffService.getAll(filters)
      } catch (error) {
        handleError(error, 'Fetching staff')
        throw error
      }
    },
    staleTime: 30000,
    gcTime: 600000,
  })
}

export const useStaffMember = (id: string) => {
  return useQuery({
    queryKey: ['staff', id],
    queryFn: async () => {
      try {
        return await staffService.getById(id)
      } catch (error) {
        handleError(error, 'Fetching staff member')
        throw error
      }
    },
    enabled: !!id,
  })
}

export const useCreateStaff = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (staffData: TablesInsert<'staff_profiles'>) => {
      try {
        return await staffService.create(staffData)
      } catch (error) {
        handleError(error, 'Creating staff member')
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      handleSuccess('Staff member added successfully')
    }
  })
}

export const useUpdateStaff = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TablesUpdate<'staff_profiles'> }) => {
      try {
        return await staffService.update(id, updates)
      } catch (error) {
        handleError(error, 'Updating staff member')
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      handleSuccess('Staff member updated successfully')
    }
  })
}

export const useDeleteStaff = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, employmentEndDate }: { id: string; employmentEndDate: string }) => {
      try {
        await staffService.archive(id, employmentEndDate)
      } catch (error) {
        handleError(error, 'Archiving staff member')
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      handleSuccess('Staff member archived')
    }
  })
}

// ============================================================================
// POSTS QUERIES & MUTATIONS (for FetsConnect)
// ============================================================================

export const usePosts = (filters?: { centre?: string; visibility?: string }) => {
  return useQuery({
    queryKey: ['posts', filters],
    queryFn: async () => {
      try {
        return await postsService.getAll(filters)
      } catch (error) {
        handleError(error, 'Fetching posts')
        throw error
      }
    },
    staleTime: 10000,
    gcTime: 300000,
    refetchOnWindowFocus: true,
  })
}

export const useCreatePost = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (postData: TablesInsert<'social_posts'> & { author_id: string; content: string }) => {
      try {
        return await postsService.create(postData)
      } catch (error) {
        handleError(error, 'Creating post')
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      handleSuccess('Post created successfully')
    }
  })
}

export const useUpdatePost = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TablesUpdate<'social_posts'> }) => {
      try {
        return await postsService.update(id, updates)
      } catch (error) {
        handleError(error, 'Updating post')
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      handleSuccess('Post updated successfully')
    }
  })
}

export const useDeletePost = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        await postsService.delete(id)
      } catch (error) {
        handleError(error, 'Deleting post')
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      handleSuccess('Post deleted successfully')
    }
  })
}

// ============================================================================
// CHAT QUERIES & MUTATIONS
// ============================================================================

export const useChatRooms = () => {
  return useQuery({
    queryKey: ['chatRooms'],
    queryFn: async () => {
      try {
        return await chatService.getRooms()
      } catch (error) {
        handleError(error, 'Fetching chat rooms')
        throw error
      }
    },
    staleTime: 60000,
  })
}

export const useChatMessages = (roomId: string) => {
  return useQuery({
    queryKey: ['chatMessages', roomId],
    queryFn: async () => {
      try {
        return await chatService.getMessages(roomId)
      } catch (error) {
        handleError(error, 'Fetching messages')
        throw error
      }
    },
    enabled: !!roomId,
    staleTime: 5000,
    refetchInterval: 10000, // Poll every 10 seconds for new messages
  })
}

export const useSendMessage = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (message: TablesInsert<'messages'>) => {
      try {
        return await chatService.sendMessage(message)
      } catch (error) {
        handleError(error, 'Sending message')
        throw error
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chatMessages', variables.conversation_id] })
    }
  })
}

// ============================================================================
// PROFILES QUERIES & MUTATIONS
// ============================================================================

export const useProfiles = () => {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      try {
        return await staffService.getAll()
      } catch (error) {
        handleError(error, 'Fetching profiles')
        throw error
      }
    },
    staleTime: 60000,
  })
}

export const useProfile = (id: string) => {
  return useQuery({
    queryKey: ['profiles', id],
    queryFn: async () => {
      try {
        return await staffService.getById(id)
      } catch (error) {
        handleError(error, 'Fetching profile')
        throw error
      }
    },
    enabled: !!id,
  })
}

export const useUpdateProfile = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TablesUpdate<'staff_profiles'> }) => {
      try {
        return await staffService.update(id, updates)
      } catch (error) {
        handleError(error, 'Updating profile')
        throw error
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      queryClient.invalidateQueries({ queryKey: ['profiles', variables.id] })
      handleSuccess('Profile updated successfully')
    }
  })
}

// ============================================================================
// ROSTER MUTATIONS (extending existing queries)
// ============================================================================

export const useCreateRosterSchedule = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (schedule: TablesInsert<'roster_schedules'>) => {
      try {
        return await rosterService.create(schedule)
      } catch (error) {
        handleError(error, 'Creating roster schedule')
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roster'] })
      handleSuccess('Schedule created successfully')
    }
  })
}

export const useUpdateRosterSchedule = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TablesUpdate<'roster_schedules'> }) => {
      try {
        return await rosterService.update(id, updates)
      } catch (error) {
        handleError(error, 'Updating roster schedule')
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roster'] })
      handleSuccess('Schedule updated successfully')
    }
  })
}

export const useDeleteRosterSchedule = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        await rosterService.delete(id)
      } catch (error) {
        handleError(error, 'Deleting roster schedule')
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roster'] })
      handleSuccess('Schedule deleted successfully')
    }
  })
}

// ============================================================================
// CANDIDATE MUTATIONS (extending existing queries with new service)
// ============================================================================

export const useDeleteCandidate = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        await candidatesService.delete(id)
      } catch (error) {
        handleError(error, 'Deleting candidate')
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['sessions', 'calendar'] })
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] })
      handleSuccess('Candidate deleted successfully')
    }
  })
}

export const useUpdateCandidate = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TablesUpdate<'candidates'> }) => {
      try {
        return await candidatesService.update(id, updates)
      } catch (error) {
        handleError(error, 'Updating candidate')
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['sessions', 'calendar'] })
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] })
      handleSuccess('Candidate updated successfully')
    }
  })
}

// ============================================================================
// INCIDENT MUTATIONS (extending existing queries with new service)
// ============================================================================

export const useDeleteIncident = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        await incidentsService.delete(id)
      } catch (error) {
        handleError(error, 'Deleting incident')
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
      handleSuccess('Incident deleted successfully')
    }
  })
}

// ============================================================================
// VAULT QUERIES & MUTATIONS (Resource Centre)
// ============================================================================

export const useVaultCategories = () => {
  return useQuery({
    queryKey: ['vault', 'categories'],
    queryFn: async () => {
      try {
        return await vaultService.getCategories()
      } catch (error) {
        handleError(error, 'Fetching vault categories')
        throw error
      }
    },
    staleTime: 300000, // 5 minutes - categories don't change often
  })
}

export const useVaultItems = (filters?: { category_id?: string; type?: string; searchQuery?: string }) => {
  return useQuery({
    queryKey: ['vault', 'items', filters],
    queryFn: async () => {
      try {
        return await vaultService.getItems(filters)
      } catch (error) {
        handleError(error, 'Fetching vault items')
        throw error
      }
    },
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  })
}

export const useVaultItem = (id: string) => {
  return useQuery({
    queryKey: ['vault', 'items', id],
    queryFn: async () => {
      try {
        return await vaultService.getItemById(id)
      } catch (error) {
        handleError(error, 'Fetching vault item')
        throw error
      }
    },
    enabled: !!id,
  })
}

export const useVaultPins = (userId: string) => {
  return useQuery({
    queryKey: ['vault', 'pins', userId],
    queryFn: async () => {
      try {
        return await vaultService.getPins(userId)
      } catch (error) {
        handleError(error, 'Fetching vault pins')
        throw error
      }
    },
    enabled: !!userId,
    staleTime: 60000, // 1 minute
  })
}

export const useCreateVaultItem = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (item: any) => {
      try {
        return await vaultService.createItem(item)
      } catch (error) {
        handleError(error, 'Creating vault item')
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vault', 'items'] })
      handleSuccess('Resource created successfully')
    }
  })
}

export const useUpdateVaultItem = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      try {
        return await vaultService.updateItem(id, updates)
      } catch (error) {
        handleError(error, 'Updating vault item')
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vault', 'items'] })
      handleSuccess('Resource updated successfully')
    }
  })
}

export const useDeleteVaultItem = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        await vaultService.deleteItem(id)
      } catch (error) {
        handleError(error, 'Deleting vault item')
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vault', 'items'] })
      handleSuccess('Resource deleted successfully')
    }
  })
}

export const useToggleVaultPin = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ itemId, userId }: { itemId: string; userId: string }) => {
      try {
        return await vaultService.togglePin(itemId, userId)
      } catch (error) {
        handleError(error, 'Toggling vault pin')
        throw error
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vault', 'pins', variables.userId] })
      handleSuccess(data.pinned ? 'Pinned to Quick Access' : 'Unpinned from Quick Access')
    }
  })
}

export const useCreateVaultCategory = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (category: any) => {
      try {
        return await vaultService.createCategory(category)
      } catch (error) {
        handleError(error, 'Creating vault category')
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vault', 'categories'] })
      handleSuccess('Category created successfully')
    }
  })
}

export const useUpdateVaultCategory = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      try {
        return await vaultService.updateCategory(id, updates)
      } catch (error) {
        handleError(error, 'Updating vault category')
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vault', 'categories'] })
      handleSuccess('Category updated successfully')
    }
  })
}

export const useDeleteVaultCategory = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        await vaultService.deleteCategory(id)
      } catch (error) {
        handleError(error, 'Deleting vault category')
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vault', 'categories'] })
      handleSuccess('Category deleted successfully')
    }
  })
}
