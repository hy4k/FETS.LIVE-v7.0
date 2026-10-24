import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'
import { StaffProfile } from '../types' // Assuming a shared types file

// --- Query Hook ---

const fetchStaff = async (): Promise<StaffProfile[]> => {
  const { data, error } = await supabase
    .from('staff_profiles')
    .select('*')
    .order('full_name')

  if (error) throw new Error(error.message)
  return data || []
}

export const useStaff = () => {
  return useQuery<StaffProfile[], Error>({
    queryKey: ['staff'],
    queryFn: fetchStaff,
  })
}

// --- Mutation Hooks ---

const addStaff = async (newStaffData: Omit<StaffProfile, 'id' | 'created_at'> & { password?: string }) => {
  const { data, error } = await supabase.functions.invoke('create-staff-user', {
    body: newStaffData,
  })

  if (error) {
    let message = error.message;
    if (error.context instanceof Response) {
      try { const body = await error.context.json(); if (typeof body?.error === 'string') message = body.error; } catch { /* Preserve the transport error. */ }
    }
    throw new Error(message || 'Could not add the staff member. Try again.');
  }

  // Check if the function returned an error in its response body
  if (data?.error) {
    throw new Error(data.error)
  }

  if (!data?.success) {
    throw new Error('Failed to create staff user - unknown error')
  }

  return data
}

const updateStaff = async ({ id, ...updatedData }: Partial<StaffProfile> & { id: string }) => {
  const { data, error } = await supabase
    .from('staff_profiles')
    .update(updatedData)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

/** Archives staff (soft delete): keeps the row for roster/salary history. */
const archiveStaff = async ({
  staffId,
  employmentEndDate,
}: {
  staffId: string
  employmentEndDate: string
}) => {
  const { error } = await supabase
    .from('staff_profiles')
    .update({
      is_active: false,
      employment_end_date: employmentEndDate,
    })
    .eq('id', staffId)

  if (error) throw new Error(error.message)
  return staffId
}

export const useStaffMutations = () => {
  const queryClient = useQueryClient()

  const addStaffMutation = useMutation({
    mutationFn: addStaff,
    onSuccess: () => {
      toast.success('Staff member added successfully!')
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      queryClient.invalidateQueries({ queryKey: ['roster'] })
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] })
    },
    onError: (error) => {
      toast.error(`Failed to add staff: ${error.message}`)
    },
  })

  const updateStaffMutation = useMutation({
    mutationFn: updateStaff,
    onSuccess: (data) => {
      toast.success(`Staff member ${data.full_name} updated!`)
      queryClient.invalidateQueries({ queryKey: ['staff'] })
    },
    onError: (error) => {
      toast.error(`Failed to update staff: ${error.message}`)
    },
  })

  const archiveStaffMutation = useMutation({
    mutationFn: archiveStaff,
    onSuccess: () => {
      toast.success('Staff archived — they remain on the roster for the month of their end date.')
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      queryClient.invalidateQueries({ queryKey: ['roster'] })
      queryClient.invalidateQueries({ queryKey: ['sevenDayRosterStaff'] })
    },
    onError: (error) => {
      toast.error(`Failed to archive staff: ${error.message}`)
    },
  })

  return {
    addStaff: addStaffMutation.mutateAsync,
    isAdding: addStaffMutation.isPending,
    updateStaff: updateStaffMutation.mutateAsync,
    isUpdating: updateStaffMutation.isPending,
    archiveStaff: archiveStaffMutation.mutateAsync,
    isArchiving: archiveStaffMutation.isPending,
  }
}