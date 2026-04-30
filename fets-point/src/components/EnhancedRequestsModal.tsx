import React, { useState, useEffect } from 'react'
import { X, Calendar, Users, FileText, Send, CheckCircle, XCircle, Clock, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useBranch } from '../hooks/useBranch'
import { isMithunEmail } from '../utils/authUtils'
import toast from 'react-hot-toast'

import { LeaveRequest } from '../types/shared'

interface RequestsModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  staffProfiles: any[]
}

export const EnhancedRequestsModal: React.FC<RequestsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  staffProfiles
}) => {
  const { profile, user } = useAuth()
  const { activeBranch } = useBranch()
  const [activeTab, setActiveTab] = useState<'create' | 'my-requests' | 'manage'>('create')
  const [requestType, setRequestType] = useState<'leave' | 'shift_swap'>('leave')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTargetStaff, setSelectedTargetStaff] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [requests, setRequests] = useState<LeaveRequest[]>([])

  // Filter staff profiles (exclude super admins and current user)
  const availableStaff = staffProfiles.filter(staff =>
    !['MITHUN', 'NIYAS', 'Mithun', 'Niyas'].includes(staff.full_name) &&
    staff.id !== profile?.id
  )

  useEffect(() => {
    if (isOpen) {
      loadRequests()
      resetForm()
    }
  }, [isOpen])

  const resetForm = () => {
    setRequestType('leave')
    setSelectedDate('')
    setSelectedTargetStaff('')
    setReason('')
  }

  const loadRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select(`
          *,
          requestor:staff_profiles!leave_requests_user_id_fkey(full_name),
          target:staff_profiles!leave_requests_swap_with_user_id_fkey(full_name)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      const mappedRequests: LeaveRequest[] = (data || []).map(req => ({
        id: req.id,
        user_id: req.user_id,
        request_type: req.request_type,
        requested_date: req.requested_date,
        swap_with_user_id: req.swap_with_user_id,
        reason: req.reason,
        status: req.status,
        created_at: req.created_at,
        approved_at: req.approved_at,
        approved_by: req.approved_by,
        swap_date: req.swap_date,
        updated_at: req.updated_at,
        requestor_name: (req.requestor as any)?.full_name || 'Unknown',
        target_name: (req.target as any)?.full_name || 'Unknown'
      }))

      setRequests(mappedRequests)
    } catch (error) {
      console.error('Error loading requests:', error)
      toast.error('Failed to load requests')
    }
  }

  const createRequest = async () => {
    if (!selectedDate) {
      toast.error('Please select a date')
      return
    }

    if (requestType === 'shift_swap' && !selectedTargetStaff) {
      toast.error('Please select a staff member to swap with')
      return
    }

    setLoading(true)

    try {
      const requestData = {
        user_id: profile?.id,
        request_type: requestType,
        requested_date: selectedDate,
        reason: reason || null,
        status: 'pending',
        ...(requestType === 'shift_swap' && { swap_with_user_id: selectedTargetStaff })
      }

      const { error } = await supabase
        .from('leave_requests')
        .insert(requestData)

      if (error) throw error

      toast.success(`${requestType === 'leave' ? 'Leave' : 'Shift swap'} request created successfully`)
      resetForm()
      loadRequests()
      setActiveTab('my-requests')
    } catch (error) {
      console.error('Error creating request:', error)
      toast.error('Failed to create request')
    } finally {
      setLoading(false)
    }
  }

  const updateRequestStatus = async (requestId: string, status: 'approved' | 'rejected') => {
    setLoading(true)

    try {
      const request = requests.find(r => r.id === requestId)
      if (!request) return

      // Update request status
      const { error: updateError } = await supabase
        .from('leave_requests')
        .update({
          status,
          approved_by: profile?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', requestId)

      if (updateError) throw updateError

      // If shift swap approved, perform the swap
      if (status === 'approved' && request.request_type === 'shift_swap' && request.swap_with_user_id) {
        await performShiftSwap(request.user_id, request.swap_with_user_id, request.requested_date)

        // Log audit trail
        // await supabase
        //   .from('roster_audit_log')
        //   .insert({
        //     action: 'shift_swap_approved',
        //     details: `Automatic swap between ${request.requestor_name} and ${request.target_name} for ${request.requested_date}`,
        //     performed_by: profile?.id,
        //     affected_date: request.requested_date
        //   })
      }

      toast.success(`Request ${status} successfully`)
      loadRequests()
      onSuccess()
    } catch (error) {
      console.error('Error updating request:', error)
      toast.error('Failed to update request')
    } finally {
      setLoading(false)
    }
  }

  const deleteRequest = async (requestId: string) => {
    // We use a custom modal or just a simple confirm for now, but since we can't use window.confirm in iframe easily,
    // we'll just delete it directly or use a toast to confirm.
    // Actually, the prompt says "not able to delte", so they probably want a delete button.
    setLoading(true)
    try {
      const { error } = await supabase
        .from('leave_requests')
        .delete()
        .eq('id', requestId)

      if (error) throw error

      toast.success('Request deleted successfully')
      loadRequests()
      onSuccess()
    } catch (error) {
      console.error('Error deleting request:', error)
      toast.error('Failed to delete request')
    } finally {
      setLoading(false)
    }
  }

  const performShiftSwap = async (user1Id: string, user2Id: string, date: string) => {
    // Get current shifts for both users on the specified date
    const { data: shifts, error: fetchError } = await supabase
      .from('roster_schedules')
      .select('*')
      .in('profile_id', [user1Id, user2Id])
      .eq('date', date)

    if (fetchError) throw fetchError

    const user1Shift = shifts?.find(s => s.profile_id === user1Id)
    const user2Shift = shifts?.find(s => s.profile_id === user2Id)

    // Delete existing shifts
    if (shifts && shifts.length > 0) {
      const { error: deleteError } = await supabase
        .from('roster_schedules')
        .delete()
        .in('id', shifts.map(s => s.id))

      if (deleteError) throw deleteError
    }

    // Create swapped shifts
    const newShifts = []

    if (user1Shift) {
      newShifts.push({
        profile_id: user2Id,
        date: date,
        shift_code: user1Shift.shift_code,
        overtime_hours: user1Shift.overtime_hours || 0,
        status: 'confirmed'
      })
    }

    if (user2Shift) {
      newShifts.push({
        profile_id: user1Id,
        date: date,
        shift_code: user2Shift.shift_code,
        overtime_hours: user2Shift.overtime_hours || 0,
        status: 'confirmed'
      })
    }

    if (newShifts.length > 0) {
      const { error: insertError } = await supabase
        .from('roster_schedules')
        .insert(newShifts)

      if (insertError) throw insertError
    }
  }

  // Filter requests based on user role and tab
  const getFilteredRequests = () => {
    const isAdmin = profile?.role === 'super_admin' || isMithunEmail(profile?.email);

    if (activeTab === 'my-requests') {
      return requests.filter(r => r.user_id === profile?.id)
    } else if (activeTab === 'manage' && isAdmin) {
      return requests.filter(r => r.status === 'pending')
    }
    return []
  }

  if (!isOpen) return null

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-sm bg-black/20"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl bg-[#1a3a3d] rounded-3xl shadow-2xl border border-[#388087] overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#388087] bg-[#0d1d1f]">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-white flex items-center">
              <FileText className="h-5 w-5 mr-2 text-[#92cdb3]" />
              Requests Management
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#388087] rounded-full transition-colors"
            >
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex mt-4 space-x-1 bg-[#0d1d1f] rounded-xl p-1 border border-[#388087]">
            <button
              onClick={() => setActiveTab('create')}
              className={`flex-1 py-2 px-4 rounded-lg font-bold transition-colors ${activeTab === 'create'
                ? 'bg-[#92cdb3] shadow-sm text-black'
                : 'text-slate-400 hover:text-white'
                }`}
            >
              Create Request
            </button>
            <button
              onClick={() => setActiveTab('my-requests')}
              className={`flex-1 py-2 px-4 rounded-lg font-bold transition-colors ${activeTab === 'my-requests'
                ? 'bg-[#92cdb3] shadow-sm text-black'
                : 'text-slate-400 hover:text-white'
                }`}
            >
              My Requests
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab('manage')}
                className={`flex-1 py-2 px-4 rounded-lg font-bold transition-colors ${activeTab === 'manage'
                  ? 'bg-[#92cdb3] shadow-sm text-black'
                  : 'text-slate-400 hover:text-white'
                  }`}
              >
                Manage Requests
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {activeTab === 'create' && (
            <div className="space-y-4">
              {/* Request Type Selection */}
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-3 uppercase tracking-wide">Request Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setRequestType('leave')}
                    className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${requestType === 'leave'
                      ? 'border-[#FFD633] bg-[#FFD633]/10 text-[#FFD633]'
                      : 'border-[#388087] bg-[#0d1d1f] text-slate-400 hover:border-zinc-600'
                      }`}
                  >
                    <Calendar className={`h-5 w-5 mb-2 ${requestType === 'leave' ? 'text-[#FFD633]' : 'text-slate-500'}`} />
                    <div className="font-bold">Leave Request</div>
                    <div className="text-sm opacity-75">Request time off</div>
                  </button>

                  <button
                    onClick={() => setRequestType('shift_swap')}
                    className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${requestType === 'shift_swap'
                      ? 'border-[#FFD633] bg-[#FFD633]/10 text-[#FFD633]'
                      : 'border-[#388087] bg-[#0d1d1f] text-slate-400 hover:border-zinc-600'
                      }`}
                  >
                    <Users className={`h-5 w-5 mb-2 ${requestType === 'shift_swap' ? 'text-[#FFD633]' : 'text-slate-500'}`} />
                    <div className="font-bold">Shift Swap</div>
                    <div className="text-sm opacity-75">Swap with colleague</div>
                  </button>
                </div>
              </div>

              {/* Date Selection */}
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2 uppercase tracking-wide">
                  {requestType === 'leave' ? 'Leave Date' : 'Swap Date'}
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 bg-[#0d1d1f] border border-[#388087] rounded-xl focus:ring-2 focus:ring-[#92cdb3]/50 focus:border-[#92cdb3] outline-none text-white"
                />
              </div>

              {/* Target Staff Selection (for shift swap) */}
              {requestType === 'shift_swap' && (
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2 uppercase tracking-wide">Swap With</label>
                  <select
                    value={selectedTargetStaff}
                    onChange={(e) => setSelectedTargetStaff(e.target.value)}
                    className="w-full px-4 py-3 bg-[#0d1d1f] border border-[#388087] rounded-xl focus:ring-2 focus:ring-[#92cdb3]/50 focus:border-[#92cdb3] outline-none text-white"
                  >
                    <option value="" className="text-slate-400">Select staff member to swap with</option>
                    {availableStaff.map(staff => (
                      <option key={staff.id} value={staff.id}>
                        {staff.full_name} - {staff.role}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2 uppercase tracking-wide">Reason (Optional)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={`Please provide a reason for the ${requestType === 'leave' ? 'leave' : 'shift swap'}...`}
                  rows={3}
                  className="w-full px-4 py-3 bg-[#0d1d1f] border border-[#388087] rounded-xl focus:ring-2 focus:ring-[#92cdb3]/50 focus:border-[#92cdb3] outline-none resize-none text-white placeholder-slate-500"
                />
              </div>

              {/* Submit Button */}
              <button
                onClick={createRequest}
                disabled={loading || !selectedDate || (requestType === 'shift_swap' && !selectedTargetStaff)}
                className="w-full py-3 bg-[#92cdb3] hover:bg-[#7ab89f] disabled:bg-[#388087] disabled:text-slate-400 text-black font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center space-x-2"
              >
                <Send className="h-4 w-4" />
                <span>{loading ? 'Creating...' : `Create ${requestType === 'leave' ? 'Leave' : 'Swap'} Request`}</span>
              </button>
            </div>
          )}

          {(activeTab === 'my-requests' || activeTab === 'manage') && (
            <div className="space-y-3">
              {getFilteredRequests().length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">
                    {activeTab === 'my-requests' ? 'No requests found' : 'No pending requests'}
                  </p>
                </div>
              ) : (
                getFilteredRequests().map(request => (
                  <div key={request.id} className="p-4 bg-[#0d1d1f] rounded-xl border border-[#388087]">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          {request.request_type === 'leave' ? (
                            <Calendar className="h-4 w-4 text-[#FFD633]" />
                          ) : (
                            <Users className="h-4 w-4 text-[#92cdb3]" />
                          )}
                          <span className="font-bold text-white uppercase tracking-wide text-sm">
                            {request.request_type === 'leave' ? 'Leave Request' : `Shift Swap with ${request.target_name}`}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${request.status === 'pending' ? 'bg-[#FFD633]/20 text-[#FFD633]' :
                            request.status === 'approved' ? 'bg-[#92cdb3]/20 text-[#92cdb3]' :
                              'bg-rose-500/20 text-rose-400'
                            }`}>
                            {request.status}
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 text-xs text-slate-400 font-medium">
                          <span>By: {request.requestor_name}</span>
                          <span>•</span>
                          <span>Date: {new Date(request.requested_date).toLocaleDateString()}</span>
                          <span>•</span>
                          <span>Created: {new Date(request.created_at).toLocaleDateString()}</span>
                        </div>
                        {request.reason && (
                          <p className="text-sm text-slate-300 mt-2 italic">{request.reason}</p>
                        )}
                      </div>

                      {activeTab === 'manage' && request.status === 'pending' && (
                        <div className="flex space-x-2 ml-4">
                          <button
                            onClick={() => updateRequestStatus(request.id, 'approved')}
                            disabled={loading}
                            className="p-2 bg-[#92cdb3]/20 hover:bg-[#92cdb3]/30 text-[#92cdb3] rounded-lg transition-colors"
                            title="Approve"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => updateRequestStatus(request.id, 'rejected')}
                            disabled={loading}
                            className="p-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 rounded-lg transition-colors"
                            title="Reject"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              deleteRequest(request.id)
                            }}
                            disabled={loading}
                            className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                      {activeTab === 'my-requests' && request.status === 'pending' && (
                        <div className="flex space-x-2 ml-4">
                          <button
                            onClick={() => {
                              deleteRequest(request.id)
                            }}
                            disabled={loading}
                            className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
