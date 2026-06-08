import React, { useState, useEffect, useCallback } from 'react'
import { 
  Search, Plus, Send, Clock, User, CheckCircle, AlertTriangle,
  ChevronRight, Activity, Filter, Eye, X, Hash, ChevronLeft
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../hooks/useAuth'
import { useBranch } from '../hooks/useBranch'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'
import RaiseACaseModal, { CaseFormData } from './RaiseACaseModal'
import { getCategoryById, getCategoryColor } from '../config/caseCategories.config'
import { formatDistanceToNow } from 'date-fns'

export function MobileIncidentManager() {
    const { profile, user } = useAuth()
    const { activeBranch } = useBranch()

    const isSuperAdmin = profile?.role === 'super_admin';
    const [hasDelegation, setHasDelegation] = useState(false);

    useEffect(() => {
        if (profile?.id && !isSuperAdmin) {
            const checkDelegation = async () => {
                try {
                    const nowIso = new Date().toISOString();
                    const { data } = await supabase
                        .from('staff_branch_delegations')
                        .select('id')
                        .eq('profile_id', profile.id)
                        .lte('start_date', nowIso)
                        .gte('end_date', nowIso);
                    setHasDelegation(data && data.length > 0);
                } catch (e) {
                    setHasDelegation(false);
                }
            };
            checkDelegation();
        } else {
            setHasDelegation(false);
        }
    }, [profile?.id, isSuperAdmin]);

    const userProfileBranch = profile?.branch_assigned || 'cochin';
    const canCreateHere = isSuperAdmin || hasDelegation || activeBranch === userProfileBranch;
    const [incidents, setIncidents] = useState<any[]>([])
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [showCreate, setShowCreate] = useState(false)
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')

    const loadIncidents = useCallback(async () => {
        setLoading(true)
        try {
            let query = supabase.from('incidents').select('*').order('created_at', { ascending: false })
            if (activeBranch !== 'global') {
                query = query.eq('branch_location', activeBranch)
            }
            const { data, error } = await query
            if (error) throw error
            setIncidents(data || [])
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [activeBranch])

    useEffect(() => { loadIncidents() }, [loadIncidents])

    const handleCreateCase = async (caseData: CaseFormData) => {
        try {
            const metadata: any = {}
            if (Object.keys(caseData.followUpData).length > 0) metadata.follow_up_data = caseData.followUpData
            if (caseData.vendorInfo) metadata.vendor_info = caseData.vendorInfo

            const targetBranch = (isSuperAdmin || hasDelegation)
                ? (activeBranch === 'global' ? 'calicut' : activeBranch)
                : userProfileBranch;

            // CRITICAL FIX: Ensure user_id matches Supabase Auth and branch is correctly set
            const { error } = await supabase.from('incidents').insert({
                title: caseData.title,
                description: caseData.description,
                category: caseData.category,
                status: 'open',
                severity: 'minor',
                user_id: user?.id, 
                reporter: profile?.full_name || 'Staff',
                branch_location: targetBranch,
                metadata: Object.keys(metadata).length > 0 ? metadata : null
            });

            if (error) {
                console.error('Insert error:', error);
                throw error;
            }
            
            toast.success('Case Logged in Backend');
            loadIncidents();
        } catch (error: any) {
            toast.error(`Sync Error: ${error.message}`);
            throw error;
        }
    }

    const filtered = incidents.filter(i => 
        i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.id.toLowerCase().includes(searchQuery.toLowerCase())
    )

    if (selectedId) {
        const incident = incidents.find(i => i.id === selectedId)
        return (
            <div className="flex flex-col min-h-screen bg-slate-50">
                <div className="px-6 pt-12 pb-6 bg-white border-b border-slate-100 flex items-center gap-4">
                    <button onClick={() => setSelectedId(null)} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center">
                        <ChevronLeft size={24} />
                    </button>
                    <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Case Details</h2>
                </div>
                
                <div className="p-6 space-y-6">
                    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 space-y-6">
                        <div className="flex justify-between items-start">
                            <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest`} 
                                 style={{ backgroundColor: getCategoryColor(incident.category).bgColor, color: getCategoryColor(incident.category).color }}>
                                {getCategoryById(incident.category)?.label || incident.category}
                            </div>
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                                {formatDistanceToNow(new Date(incident.created_at))} ago
                            </span>
                        </div>
                        
                        <h1 className="text-2xl font-black text-slate-900 leading-tight uppercase tracking-tight">{incident.title}</h1>
                        <p className="text-slate-600 font-medium leading-relaxed">{incident.description}</p>
                        
                        <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                                    <User size={14} />
                                </div>
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{incident.reporter}</span>
                            </div>
                            <div className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest">
                                {incident.status}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex flex-col items-center justify-center py-10 text-center opacity-30">
                        <Activity size={40} className="text-slate-300 mb-4" />
                        <p className="text-xs font-black uppercase tracking-[0.3em]">Full Thread on Desktop</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 pb-32">
            <div className="px-6 pt-12 pb-8 bg-white rounded-b-[45px] shadow-sm">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Cases</h1>
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] mt-2 px-1">Operations Log</p>
                    </div>
                    <button 
                        onClick={() => {
                            if (!canCreateHere) {
                                toast.error(`You can only raise cases for your home branch (${userProfileBranch.toUpperCase()})`);
                                return;
                            }
                            setShowCreate(true);
                        }}
                        className={`w-14 h-14 rounded-2xl bg-[#3E2723] text-amber-500 shadow-xl flex items-center justify-center transition-transform ${
                            canCreateHere ? 'active:scale-90' : 'opacity-50 cursor-not-allowed'
                        }`}
                        title={!canCreateHere ? `Switch back to ${userProfileBranch.toUpperCase()} to raise a case` : undefined}
                    >
                        <Plus size={28} />
                    </button>
                </div>

                <div className="relative">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search IDs or Titles..."
                        className="w-full bg-slate-50 border-none rounded-[25px] py-4 pl-14 pr-6 font-bold text-slate-800 focus:ring-2 focus:ring-amber-500/20 outline-none"
                    />
                </div>
            </div>

            <div className="p-6 space-y-4">
                {loading ? (
                    [1, 2, 3].map(i => <div key={i} className="h-28 bg-white rounded-[35px] animate-pulse" />)
                ) : filtered.length === 0 ? (
                    <div className="py-20 text-center space-y-4">
                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-200 mx-auto">
                            <Activity size={40} />
                        </div>
                        <p className="text-slate-400 font-black uppercase text-xs tracking-widest">No cases found</p>
                    </div>
                ) : filtered.map(inc => (
                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        key={inc.id}
                        onClick={() => setSelectedId(inc.id)}
                        className="w-full bg-white p-6 rounded-[35px] shadow-sm border border-slate-100 text-left flex items-center justify-between active:bg-slate-50 transition-colors"
                    >
                        <div className="flex items-center gap-5">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg`} 
                                 style={{ backgroundColor: getCategoryColor(inc.category).color }}>
                                <Activity size={24} className="text-white" />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-900 uppercase tracking-tighter leading-tight mb-1 truncate max-w-[180px]">{inc.title}</h3>
                                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">CASE-{inc.id.slice(0,6).toUpperCase()} • {inc.status}</p>
                            </div>
                        </div>
                        <ChevronRight size={18} className="text-slate-200" />
                    </motion.button>
                ))}
            </div>

            <RaiseACaseModal 
                isOpen={showCreate}
                onClose={() => setShowCreate(false)}
                onSubmit={handleCreateCase}
            />
        </div>
    )
}
