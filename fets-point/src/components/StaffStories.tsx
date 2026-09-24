import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { MessageSquare, Shield, Sparkles, MapPin, Radio, CheckCircle, Zap } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { FetsChatPopup } from './FetsChatPopup'
import { StaffProfile } from '../types/shared'

export function StaffStories({ onSelectStaff }: { onSelectStaff?: (staff: StaffProfile) => void }) {
    const { user, profile } = useAuth()
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
                setStaff(staffData)
            }
        }

        fetchStaff()

        const presenceChannel = supabase.channel('online-users-duty-bar')
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
        if (aOnline === bOnline) return (a.full_name || '').localeCompare(b.full_name || '')
        return aOnline ? -1 : 1
    })

    const getBranchShort = (branch?: string) => {
        if (!branch) return 'ALL';
        const b = branch.toLowerCase();
        if (b.includes('calicut')) return 'CAL';
        if (b.includes('cochin')) return 'COK';
        return branch.toUpperCase().slice(0, 3);
    };

    const getRoleTitle = (role?: string) => {
        if (!role) return 'Proctor';
        if (role.toLowerCase().includes('admin')) return 'Lead TCA';
        if (role.toLowerCase().includes('manager')) return 'Operations';
        return 'Test Admin';
    };

    return (
        <div className="w-full bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-2xl p-3 shadow-lg">
            <div className="flex items-center justify-between mb-2.5 px-1">
                <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-[11px] font-bold tracking-wider uppercase text-slate-300">
                        Exam Center Staff Duty &amp; Live Presence
                    </span>
                    <span className="text-[10px] bg-slate-800 text-slate-400 font-mono px-1.5 py-0.5 rounded border border-slate-700">
                        {sortedStaff.filter(s => presence[s.user_id]?.status === 'online').length + 1} Active
                    </span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                    Click staff card to message or view notices
                </span>
            </div>

            <div className="w-full overflow-x-auto no-scrollbar py-1">
                <div className="flex items-center gap-2.5 min-w-max">
                    {/* Your Duty Card */}
                    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500/15 via-amber-600/10 to-transparent border border-amber-500/30 flex-shrink-0 cursor-default">
                        <div className="relative">
                            <div className="w-10 h-10 rounded-xl overflow-hidden bg-amber-500/20 border border-amber-400/40 p-0.5 shadow-sm">
                                <img
                                    src={profile?.avatar_url || user?.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.full_name || user?.user_metadata?.full_name || 'Staff')}&background=F59E0B&color=111827`}
                                    className="w-full h-full object-cover rounded-[10px]"
                                    alt="You"
                                />
                            </div>
                            <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full"></span>
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-amber-200">You (On Duty)</span>
                                <span className="text-[9px] px-1 py-0.2 rounded bg-amber-400/20 text-amber-300 font-mono uppercase font-bold">
                                    {getBranchShort(profile?.branch_assigned)}
                                </span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium">
                                Ready for Candidate Intake
                            </span>
                        </div>
                    </div>

                    {/* Staff Presence Capsules */}
                    {sortedStaff.map((s) => {
                        const isOnline = presence[s.user_id]?.status === 'online';
                        const branchTag = getBranchShort(s.branch_assigned);
                        const roleTitle = getRoleTitle(s.role);

                        return (
                            <motion.button
                                key={s.id}
                                whileHover={{ scale: 1.02, y: -1 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                    if (onSelectStaff) onSelectStaff(s);
                                    setOpenChats(prev => prev.some(c => c.id === s.id) ? prev : [...prev, s]);
                                }}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all border text-left flex-shrink-0 group ${
                                    isOnline
                                        ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 hover:border-slate-500 shadow-sm'
                                        : 'bg-slate-900/50 hover:bg-slate-850 border-slate-800/60 opacity-75 hover:opacity-100'
                                }`}
                            >
                                <div className="relative">
                                    <div className={`w-10 h-10 rounded-xl overflow-hidden p-0.5 border transition-all ${
                                        isOnline 
                                            ? 'border-emerald-400/50 bg-slate-800 group-hover:border-emerald-400 shadow-sm' 
                                            : 'border-slate-700 bg-slate-900'
                                    }`}>
                                        <img
                                            src={s.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.full_name || 'Staff')}&background=1E293B&color=94A3B8`}
                                            className={`w-full h-full object-cover rounded-[10px] transition-opacity ${isOnline ? 'opacity-100' : 'opacity-65'}`}
                                            alt={s.full_name}
                                        />
                                    </div>
                                    {isOnline && (
                                        <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full animate-pulse" />
                                    )}
                                </div>
                                <div className="flex flex-col min-w-[80px] max-w-[130px]">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-semibold text-slate-100 truncate group-hover:text-amber-300 transition-colors">
                                            {s.full_name?.split(' ')[0]}
                                        </span>
                                        <span className={`text-[8.5px] font-mono px-1 py-0.2 rounded font-bold ${
                                            branchTag === 'CAL' ? 'bg-amber-500/20 text-amber-300' :
                                            branchTag === 'COK' ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-700 text-slate-300'
                                        }`}>
                                            {branchTag}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 mt-0.5">
                                        <span className="text-[10px] text-slate-400 truncate">
                                            {roleTitle}
                                        </span>
                                        {isOnline && (
                                            <span className="text-[9px] text-emerald-400 font-medium">· Live</span>
                                        )}
                                    </div>
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity pl-1 text-slate-400 hover:text-white">
                                    <MessageSquare size={13} />
                                </div>
                            </motion.button>
                        );
                    })}
                </div>
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

export default StaffStories;
