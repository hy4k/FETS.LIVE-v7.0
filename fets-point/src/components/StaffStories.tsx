import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { FetsChatPopup } from './FetsChatPopup'
import { StaffProfile } from '../types/shared'

export function StaffStories() {
    const { user } = useAuth()
    const [staff, setStaff] = useState<StaffProfile[]>([])
    const [presence, setPresence] = useState<Record<string, { status: string, last_seen: string }>>({})
    const [openChats, setOpenChats] = useState<StaffProfile[]>([])

    useEffect(() => {
        const fetchStaff = async () => {
            const { data: staffData } = await supabase
                .from('staff_profiles')
                .select('*')
                .neq('user_id', user?.id)

            if (staffData) {
                // Sort: Online first, then alphabetical
                setStaff(staffData)
            }
        }

        fetchStaff()

        const presenceChannel = supabase.channel('online-users-stories')
        presenceChannel
            .on('presence', { event: 'sync' }, () => {
                const state = presenceChannel.presenceState()
                const newPresence: Record<string, { status: string, last_seen: string }> = {}
                Object.keys(state).forEach(key => {
                    const presences = state[key] as any[]
                    if (presences.length > 0) {
                        newPresence[key] = {
                            status: 'online',
                            last_seen: new Date().toISOString()
                        }
                    }
                })
                setPresence(newPresence)
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED' && user?.id) {
                    await presenceChannel.track({ user_id: user.id })
                }
            })

        return () => {
            presenceChannel.unsubscribe()
        }
    }, [user?.id])

    const sortedStaff = [...staff].sort((a, b) => {
        const aOnline = presence[a.user_id]?.status === 'online'
        const bOnline = presence[b.user_id]?.status === 'online'
        if (aOnline === bOnline) return 0
        return aOnline ? -1 : 1
    })

    return (
        <div className="w-full overflow-x-auto no-scrollbar py-4 mb-6">
            <div className="flex items-center justify-center gap-4 px-2 min-w-full">
                {/* Your Story (Static for now) */}
                <div className="flex flex-col items-center gap-2 cursor-pointer group">
                    <div className="relative">
                        <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-amber-400 to-amber-600">
                            <div className="w-full h-full rounded-full bg-slate-100 border-2 border-white overflow-hidden p-1">
                                <img
                                    src={user?.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${user?.user_metadata?.full_name}&background=0F172A&color=EAB308`}
                                    className="w-full h-full object-cover rounded-full"
                                />
                            </div>
                        </div>
                        <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-1 border-2 border-white text-white">
                            <Plus size={10} />
                        </div>
                    </div>
                    <span className="text-xs font-medium text-slate-600">Your Story</span>
                </div>

                {/* Staff Stories */}
                {sortedStaff.map((s) => {
                    const isOnline = presence[s.user_id]?.status === 'online'
                    return (
                        <div
                            key={s.id}
                            className="flex flex-col items-center gap-2 cursor-pointer group min-w-[70px]"
                            onClick={() => setOpenChats(prev => [...prev, s])}
                        >
                            <motion.div whileHover={{ scale: 1.05 }} className="relative">
                                <div className={`w-16 h-16 rounded-full p-[2px] ${isOnline ? 'bg-gradient-to-tr from-rose-500 via-amber-500 to-purple-600 animate-spin-slow' : 'bg-slate-200'}`}>
                                    <div className="w-full h-full rounded-full bg-white border-2 border-white overflow-hidden">
                                        <img
                                            src={s.avatar_url || `https://ui-avatars.com/api/?name=${s.full_name}`}
                                            className={`w-full h-full object-cover transition-opacity ${isOnline ? 'opacity-100' : 'opacity-60'}`}
                                            alt={s.full_name}
                                        />
                                    </div>
                                </div>
                                {isOnline && (
                                    <div className="absolute bottom-0 right-1 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
                                )}
                            </motion.div>
                            <span className="text-xs font-medium text-slate-600 truncate w-16 text-center">
                                {s.full_name?.split(' ')[0]}
                            </span>
                        </div>
                    )
                })}
            </div>

            {/* Chat Popups */}
            {openChats.map((targetUser, idx) => (
                <FetsChatPopup
                    key={targetUser.id}
                    targetUser={targetUser}
                    onClose={() => setOpenChats(prev => prev.filter(c => c.id !== targetUser.id))}
                    zIndex={2000 + idx}
                />
            ))}
        </div>
    )
}
