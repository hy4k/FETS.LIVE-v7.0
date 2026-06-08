import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Users, Activity, CheckCircle, Sparkles,
    ChevronRight, ChevronDown, Bell, Shield, ClipboardList,
    AlertCircle, Star, MessageSquare, X,
    Globe, TrendingUp, Calendar, MapPin, Headphones,
    Building2, Clock, Zap, Lock, Unlock, Key,
    Eye, EyeOff, Trash2, Crown, Database, Briefcase,
    Server, ArrowUpRight, BookOpen, Phone,
    Layers, BarChart3, RefreshCw, Settings2, Brain, PackageSearch, ArrowRight,
    GraduationCap, CalendarDays,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useBranch } from '../hooks/useBranch'
import { toast } from 'react-hot-toast'
import { useDashboardStats, useUpcomingSchedule, useSevenDayRosterStaff } from '../hooks/useCommandCentre'
import { useNews } from '../hooks/useNewsManager'
import { AccessHub } from './AccessHub'
import { supabase } from '../lib/supabase'
import { NotificationBanner } from './NotificationBanner'
import { FetsChatPopup } from './FetsChatPopup'
import { canEditRoster, formatBranchName, isMithunEmail } from '../utils/authUtils'
import { useAppModules } from '../hooks/useAppModules'
import { useClients } from '../hooks/useClients'
import { SevenDayExamOutlook } from './SevenDayExamOutlook'
import { QuickAccessSection } from './QuickAccessSection'
import { LIVE_SUPPORT_CLIENTS } from '../constants/liveSupportClients'
import { format } from 'date-fns'
import { calculateDaysJoined, getMilestoneMessage } from '../utils/dateUtils'

// Exam type color map
const EXAM_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
    PROMETRIC: { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)', text: '#60a5fa', dot: '#3b82f6' },
    PEARSON:   { bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.4)', text: '#a78bfa', dot: '#8b5cf6' },
    PSI:       { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)', text: '#34d399', dot: '#10b981' },
    IELTS:     { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)', text: '#fbbf24', dot: '#f59e0b' },
    CELPIP:    { bg: 'rgba(20,184,166,0.15)', border: 'rgba(20,184,166,0.4)', text: '#2dd4bf', dot: '#14b8a6' },
    CMA:       { bg: 'rgba(236,72,153,0.15)', border: 'rgba(236,72,153,0.4)', text: '#f472b6', dot: '#ec4899' },
    DEFAULT:   { bg: 'rgba(100,116,139,0.15)', border: 'rgba(100,116,139,0.3)', text: '#94a3b8', dot: '#64748b' },
}

function getExamColor(clientName: string) {
    const upper = (clientName || '').toUpperCase()
    if (upper.includes('PROMETRIC')) return EXAM_COLORS.PROMETRIC
    if (upper.includes('PEARSON'))   return EXAM_COLORS.PEARSON
    if (upper.includes('PSI'))       return EXAM_COLORS.PSI
    if (upper.includes('IELTS'))     return EXAM_COLORS.IELTS
    if (upper.includes('CELPIP'))    return EXAM_COLORS.CELPIP
    if (upper.includes('CMA'))       return EXAM_COLORS.CMA
    return EXAM_COLORS.DEFAULT
}

const BRANCH_LABELS: Record<string, string> = { calicut: 'Calicut', cochin: 'Cochin', global: 'All Centres' }

export default function CommandCentre({ onNavigate, onAiQuery }: { onNavigate?: (tab: string) => void; onAiQuery?: (query: string) => void }) {
    const { profile, user } = useAuth()
    const { activeBranch } = useBranch()
    const { modules, toggleModule, isUpdating } = useAppModules()

    const isMithun = isMithunEmail(profile?.email)

    const [showManagementMenu, setShowManagementMenu] = useState(false)
    const managementRef = React.useRef<HTMLDivElement>(null)

    const secondRowItems = [
        { id: 'system-manager', label: 'SYSTEM MANAGER', icon: Server },
        { id: 'lost-and-found', label: 'LOST & FOUND', icon: PackageSearch },
        { id: 'fets-intelligence', label: 'FETS AI', icon: Brain },
    ].filter(item => {
        const moduleState = modules.find(m => m.id === item.id);
        if (moduleState && !moduleState.is_enabled) return false;
        return true;
    });

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (managementRef.current && !managementRef.current.contains(event.target as Node)) {
                setShowManagementMenu(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const { data: dashboardData, isLoading: isLoadingStats } = useDashboardStats()
    const { data: examSchedule = [], isLoading: isLoadingSchedule } = useUpcomingSchedule()
    const { data: staffByDate = {}, isLoading: isLoadingRosterStaff } = useSevenDayRosterStaff()
    const { data: newsItems = [] } = useNews()
    const { data: clients = [] } = useClients()

    const [opsMetrics, setOpsMetrics] = useState({ healthScore: 100, critical: 0, open: 0, topIssue: 'Stable' })
    const [loadingAnalysis, setLoadingAnalysis] = useState(true)
    const [activeCenter, setActiveCenter] = useState<string>('all')
    const [pendingRequests, setPendingRequests] = useState<any[]>([])

    const notices = useMemo(() => {
        return newsItems
            .filter((item: any) => {
                if (!item.is_active) return false
                return (item.branch_location === 'global' || !item.branch_location) || (item.branch_location === activeBranch)
            })
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 5)
    }, [newsItems, activeBranch])

    const fetchPendingRequests = React.useCallback(async () => {
        if (!isMithun) return;
        try {
            const { data } = await supabase
                .from('leave_requests')
                .select(`
                    *,
                    requestor:staff_profiles!leave_requests_user_id_fkey(full_name),
                    target:staff_profiles!leave_requests_swap_with_user_id_fkey(full_name)
                `)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
            setPendingRequests(data || [])
        } catch (e) {
            console.error('Pending requests load failed', e)
        }
    }, [isMithun])

    const fetchAnalysis = React.useCallback(async () => {
        try {
            const { data: events } = await (supabase as any).from('incidents').select('*').gte('created_at', new Date(new Date().setDate(1)).toISOString())
            const openEvents = events?.filter((e: any) => e.status !== 'closed') || []
            const critical = openEvents.filter((e: any) => e.severity === 'critical').length
            const major = openEvents.filter((e: any) => e.severity === 'high' || e.severity === 'medium').length
            const health = Math.max(0, 100 - (critical * 15) - (major * 5) - openEvents.length)
            const categories: Record<string, number> = {}
            events?.forEach((e: any) => { categories[e.category || 'Other'] = (categories[e.category || 'Other'] || 0) + 1 })
            const topCat = Object.entries(categories).sort((a, b) => b[1] - a[1])[0]
            setOpsMetrics({ healthScore: health, critical, open: openEvents.length, topIssue: topCat ? topCat[0] : 'Stable' })
        } catch (e) {
            console.error('Analysis load failed', e)
        } finally {
            setLoadingAnalysis(false)
        }
    }, [activeBranch])

    useEffect(() => {
        if (user?.id) {
            fetchAnalysis()
            if (isMithun) fetchPendingRequests()
        }
    }, [user?.id, fetchAnalysis, fetchPendingRequests, isMithun])

    // Today's exams grouped by center
    const examsByCenter = useMemo(() => {
        const map: Record<string, any[]> = { calicut: [], cochin: [], global: [] }
        ;(dashboardData?.todaysExams || []).forEach((exam: any) => {
            const loc = exam.branch_location || exam.location || 'global'
            if (map[loc]) map[loc].push(exam)
            else map.global.push(exam)
        })
        return map
    }, [dashboardData])

    const filteredTodaysExams = useMemo(() => {
        return (dashboardData?.todaysExams || []).filter((exam: any) => {
            if (activeBranch === 'global') return true;
            // Handle legacy Calicut data with no branch, assume Calicut
            const loc = (exam.branch_location || exam.location || 'calicut').toLowerCase();
            return loc === activeBranch.toLowerCase();
        });
    }, [dashboardData?.todaysExams, activeBranch]);

    const totalCandidates = filteredTodaysExams.reduce((s: number, e: any) => s + (e.candidate_count || 0), 0)
    const clientWorkspaceStats = useMemo(() => {
        const activeClients = new Set((examSchedule as any[]).map((s) => (s.client_name || '').trim()).filter(Boolean))
        const upcomingClientSessions = (examSchedule as any[]).slice(0, 14).length
        const upcomingCandidates = (examSchedule as any[]).slice(0, 14).reduce((sum, s) => sum + (s.candidate_count || 0), 0)
        return {
            totalClients: clients.length,
            activeClients: activeClients.size,
            upcomingClientSessions,
            upcomingCandidates,
        }
    }, [clients.length, examSchedule])
    const healthColor = opsMetrics.healthScore >= 80 ? '#10b981' : opsMetrics.healthScore >= 50 ? '#f59e0b' : '#ef4444'
    const activeBranchLabel = BRANCH_LABELS[activeBranch] || formatBranchName(activeBranch)
    const scrollToQuickAccess = () => {
        document.getElementById('quick-access-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    if (isLoadingStats) {
        return (
            <div className="flex items-center justify-center h-screen sovereign-theme">
                <div className="flex flex-col items-center gap-6">
                    <div className="relative w-20 h-20">
                        <div className="absolute inset-0 rounded-full border border-white/5" />
                        <div className="absolute inset-0 rounded-full border-t-2 border-[#FACC15] animate-spin" />
                        <div className="absolute inset-4 rounded-full border border-[#FACC15]/20 animate-pulse" />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <span className="sov-label text-[#FACC15]">Initializing FETS.LIVE Deck</span>
                        <span className="text-[8px] text-white/20 uppercase tracking-[0.4em]">Secure Connection Established</span>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen sovereign-theme pb-16 overflow-x-hidden">

            <NotificationBanner onNavigate={onNavigate} />

            <div className="max-w-[1800px] mx-auto px-4 md:px-8 pt-8">

                {/* ═══════════════════════════════════════════════════════
                    COMMAND HEADER
                ═══════════════════════════════════════════════════════ */}
                <motion.div
                    initial={{ opacity: 0, y: -16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-12 gap-8 mt-24"
                >
                    {/* Left branding */}
                    <div className="relative">
                        <div className="flex items-center gap-4 mb-3">
                            <div className="h-[1px] w-12 bg-[#FACC15]" />
                            <span className="sov-label text-[#FACC15]">
                                Operational Intelligence {activeBranch !== 'global' && `// ${activeBranch.toUpperCase()}`}
                            </span>
                        </div>
                        <div className="relative inline-flex flex-col items-end">
                            <div className="text-6xl md:text-8xl font-black text-[#FACC15] tracking-tighter leading-none" role="heading" aria-level={1}>
                                FETS LIVE
                            </div>
                            <div className="mt-2 text-[#FACC15]/40 text-[10px] tracking-[0.3em] uppercase font-medium">v5.0</div>
                        </div>
                        <div className="mt-6 flex items-center gap-3">
                            <div className="h-[1px] w-8 bg-[#FACC15]/50" />
                            <span 
                                className="text-[#FACC15] text-xl md:text-2xl tracking-wide" 
                                style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic' }}
                            >
                                {format(new Date(), 'EEEE, MMMM do, yyyy')}
                            </span>
                        </div>
                    </div>

                    <div className="hidden lg:block lg:flex-1" />

                    {/* Officer plate */}
                    <div className="flex items-center gap-4 sov-neuromorphic-yellow p-2 pr-6 rounded-2xl border-[#FACC15]/20 shadow-2xl group transition-all duration-500 hover:border-[#FACC15]/50">
                        {/* Avatar */}
                        <div className="relative p-1">
                            <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-[#FACC15]/40 p-0.5 bg-black/40 shadow-inner">
                                <img
                                    src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.full_name || 'User')}&background=121214&color=FACC15&size=128`}
                                    className="w-full h-full object-cover rounded-lg transition-transform duration-700 group-hover:scale-110"
                                    alt="Profile"
                                />
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#121214] shadow-lg" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="text-xl md:text-2xl font-black text-white tracking-tighter transition-all duration-500 leading-none">{profile?.full_name || 'Authorized User'}</div>
                            
                            {profile?.joining_date && (
                                <div className="mt-1 flex items-center">
                                    <div 
                                        title={getMilestoneMessage(calculateDaysJoined(profile.joining_date))}
                                        className="relative overflow-hidden rounded bg-gradient-to-r from-[#FACC15]/10 via-[#FACC15]/20 to-[#E2A80D]/10 px-2.5 py-0.5 border border-[#FACC15]/30 shadow-[0_0_12px_rgba(250,204,21,0.15)] flex items-center gap-1.5 hover:shadow-[0_0_16px_rgba(250,204,21,0.3)] transition-all duration-300 cursor-help"
                                    >
                                        <Sparkles size={10} className="text-[#FACC15] animate-pulse shrink-0" />
                                        <span className="text-[9px] font-black uppercase tracking-wider text-[#FACC15]">
                                            DAY {calculateDaysJoined(profile.joining_date)} IN FETS
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Controls inside Officer Plate */}
                            <div className="flex items-center gap-2 mt-1.5">
                                {isMithun && (
                                    <button
                                        onClick={() => onNavigate?.('my-desk')}
                                        className="group relative flex items-center gap-1.5 px-2 py-1 transition-all duration-300 rounded-sm border border-[#FACC15]/25 bg-[#FACC15]/10 hover:border-[#FACC15]/60 text-[#FACC15]"
                                    >
                                        <BookOpen size={10} />
                                        <span className="text-[9px] font-bold uppercase tracking-[0.2em]">MY DESK</span>
                                        <ArrowUpRight size={10} className="opacity-60" />
                                    </button>
                                )}
                                {/* MANAGEMENT DROPDOWN */}
                                <div ref={managementRef} className="relative shrink-0">
                                    <button
                                        onClick={() => setShowManagementMenu(!showManagementMenu)}
                                        className={`
                                            group relative flex items-center gap-1.5 px-2 py-1 transition-all duration-300
                                            rounded-sm border border-white/10 hover:border-[#FACC15]/50
                                            ${showManagementMenu ? 'bg-[#FACC15]/10 border-[#FACC15]/50' : 'bg-white/5'}
                                        `}
                                    >
                                        <Settings2 size={10} className="opacity-40" />
                                        <span className="text-[9px] font-bold text-white uppercase tracking-[0.2em]">MGMT</span>
                                        <ChevronDown size={10} className={`opacity-30 transition-transform duration-300 ${showManagementMenu ? 'rotate-180' : ''}`} />
                                    </button>

                                    <AnimatePresence>
                                        {showManagementMenu && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 8 }}
                                                className="absolute top-full right-0 mt-2 w-56 bg-[#121214] border border-white/10 shadow-2xl z-[80] p-1"
                                            >
                                                <div className="px-3 py-1.5 mb-1 border-b border-white/5">
                                                    <span className="text-[8px] font-bold text-[#FACC15] uppercase tracking-[0.3em]">System Controls</span>
                                                </div>
                                                <div className="p-1.5 space-y-1">
                                                    {/* Second Row Items */}
                                                    {secondRowItems.map((item) => (
                                                        <button
                                                            key={item.id}
                                                            onClick={() => { onNavigate?.(item.id); setShowManagementMenu(false); }}
                                                            className="w-full flex items-center justify-between p-2 rounded-sm transition-all hover:bg-white/5 text-white/80"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <item.icon size={12} className="text-white/40" />
                                                                <span className="text-[9px] font-bold uppercase tracking-wider">{item.label}</span>
                                                            </div>
                                                            <ChevronRight size={10} className="opacity-20" />
                                                        </button>
                                                    ))}

                                                    <div className="h-px bg-white/5 my-1.5" />
                                                    
                                                    {/* Modules (Mithun Only) */}
                                                    {isMithun && modules.map(mod => (
                                                        <div
                                                            key={mod.id}
                                                            className="flex items-center justify-between p-2 rounded-sm transition-all hover:bg-white/5"
                                                        >
                                                            <button
                                                                onClick={() => { onNavigate?.(mod.id); setShowManagementMenu(false); }}
                                                                className="flex items-center gap-2 flex-1 text-left"
                                                            >
                                                                <div className="p-1 rounded-sm text-white/40">
                                                                    <Layers size={12} />
                                                                </div>
                                                                <div>
                                                                    <div className="text-[9px] font-bold uppercase tracking-wider text-white/80">{mod.name}</div>
                                                                    <div className="text-[7px] text-white/30 uppercase tracking-widest">{mod.id.replace(/-/g, ' ')}</div>
                                                                </div>
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); toggleModule(mod.id, !mod.is_enabled); }}
                                                                disabled={isUpdating}
                                                                className={`px-1.5 py-0.5 rounded-sm text-[7px] font-bold uppercase transition-all ${mod.is_enabled ? 'bg-[#FACC15] text-black' : 'bg-white/10 text-white/40'}`}
                                                            >
                                                                {mod.is_enabled ? 'ON' : 'OFF'}
                                                            </button>
                                                        </div>
                                                    ))}

                                                    {isMithun && (
                                                        <>
                                                            <div className="h-px bg-white/5 my-1.5" />
                                                            <button
                                                                onClick={() => { onNavigate?.('candidate-tracker'); setShowManagementMenu(false); }}
                                                                className="w-full flex items-center justify-between p-2 rounded-sm transition-all hover:bg-white/5 text-white/80"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <ClipboardList size={12} className="text-cyan-400" />
                                                                    <span className="text-[9px] font-bold uppercase tracking-wider">Fets Register</span>
                                                                </div>
                                                                <ChevronRight size={10} className="opacity-20" />
                                                            </button>
                                                            <button
                                                                onClick={() => { onNavigate?.('user-management'); setShowManagementMenu(false); }}
                                                                className="w-full flex items-center justify-between p-2 rounded-sm transition-all hover:bg-white/5 text-white/80"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <Shield size={12} className="text-white/40" />
                                                                    <span className="text-[9px] font-bold uppercase tracking-wider">User Management</span>
                                                                </div>
                                                                <ChevronRight size={10} className="opacity-20" />
                                                            </button>
                                                            <div className="h-px bg-white/5 my-1" />
                                                            <button
                                                                onClick={() => { onNavigate?.('fets-calendar-demo'); setShowManagementMenu(false); }}
                                                                className="w-full flex items-center justify-between p-2 rounded-sm transition-all hover:bg-white/5 text-white/80"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <CalendarDays size={12} className="text-amber-400" />
                                                                    <span className="text-[9px] font-bold uppercase tracking-wider">CELPIP</span>
                                                                </div>
                                                                <ChevronRight size={10} className="opacity-20" />
                                                            </button>
                                                            <button
                                                                onClick={() => { onNavigate?.('client-portal'); setShowManagementMenu(false); }}
                                                                className="w-full flex items-center justify-between p-2 rounded-sm transition-all hover:bg-white/5 text-white/80"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <Briefcase size={12} className="text-amber-400" />
                                                                    <span className="text-[9px] font-bold uppercase tracking-wider">CLIENTS</span>
                                                                </div>
                                                                <ChevronRight size={10} className="opacity-20" />
                                                            </button>
                                                            <button
                                                                onClick={() => { onNavigate?.('branch-delegation'); setShowManagementMenu(false); }}
                                                                className="w-full flex items-center justify-between p-2 rounded-sm transition-all hover:bg-white/5 text-white/80"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <Shield size={12} className="text-amber-400" />
                                                                    <span className="text-[9px] font-bold uppercase tracking-wider">Branch Access</span>
                                                                </div>
                                                                <ChevronRight size={10} className="opacity-20" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* ═══════════════════════════════════════════════════════
                    PENDING REQUESTS (MITHUN ONLY)
                ═══════════════════════════════════════════════════════ */}
                {isMithun && pendingRequests.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-12"
                    >
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-8 h-8 rounded-sm bg-[#FACC15]/10 border border-[#FACC15]/30 flex items-center justify-center">
                                <AlertCircle size={14} className="text-[#FACC15]" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-white uppercase tracking-widest">Pending Requests</h3>
                                <p className="text-[10px] text-[#FACC15]/60 uppercase tracking-[0.2em]">{pendingRequests.length} actions required</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {pendingRequests.map(req => (
                                <div key={req.id} className="sov-card relative overflow-hidden group cursor-pointer" onClick={() => onNavigate?.('fets-roster')}>
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        {req.request_type === 'leave' ? <Calendar size={40} className="text-[#FACC15]" /> : <Users size={40} className="text-[#FACC15]" />}
                                    </div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className={`px-2 py-1 rounded-sm text-[8px] font-bold uppercase tracking-widest ${req.request_type === 'leave' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
                                            {req.request_type === 'leave' ? 'Leave Request' : 'Shift Swap'}
                                        </span>
                                        <span className="text-[10px] text-white/40 font-medium">{new Date(req.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <div className="mb-4">
                                        <div className="text-sm font-bold text-white mb-1">{req.requestor?.full_name || 'Unknown Staff'}</div>
                                        <div className="text-[11px] text-[#FACC15] font-medium">
                                            {req.request_type === 'leave' 
                                                ? `Requested Date: ${new Date(req.requested_date).toLocaleDateString()}`
                                                : `Swap with ${req.target?.full_name || 'Unknown'} on ${new Date(req.requested_date).toLocaleDateString()}`
                                            }
                                        </div>
                                    </div>
                                    {req.reason && (
                                        <div className="text-[10px] text-white/60 italic border-l-2 border-white/10 pl-2 mb-4 line-clamp-2">
                                            "{req.reason}"
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                                        <span className="text-[9px] text-white/40 uppercase tracking-widest">Click to manage in Roster</span>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    // Using direct delete since window.confirm doesn't work in iframe
                                                    supabase.from('leave_requests').delete().eq('id', req.id).then(() => {
                                                        toast.success('Request deleted');
                                                        fetchPendingRequests();
                                                    });
                                                }}
                                                className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                                                title="Delete Request"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                            <ArrowRight size={12} className="text-[#FACC15] group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* ═══════════════════════════════════════════════════════
                    SYSTEM STATUS & QUICK ACTIONS
                ═══════════════════════════════════════════════════════ */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="mb-8 p-6 rounded-[24px] border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl shadow-xl flex flex-col xl:flex-row xl:items-center justify-between gap-6"
                >
                    {/* Stats Group */}
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-3 pr-6 border-r border-white/10">
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)] animate-pulse" />
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FACC15]/80">Active Center</div>
                                <div className="text-sm font-bold text-white uppercase">{activeBranchLabel}</div>
                            </div>
                        </div>

                        {/* Candidates Stat */}
                        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-black/20 border border-white/[0.06]">
                            <Users size={16} className="text-cyan-400" />
                            <div>
                                <div className="text-[9px] font-black uppercase tracking-wider text-white/30">Candidates Today</div>
                                <div className="text-sm font-black text-white">{totalCandidates} <span className="text-[10px] font-medium text-white/50">({filteredTodaysExams.length} sessions)</span></div>
                            </div>
                        </div>

                        {/* Open Cases Stat */}
                        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-black/20 border border-white/[0.06]">
                            <AlertCircle size={16} className="text-rose-400" />
                            <div>
                                <div className="text-[9px] font-black uppercase tracking-wider text-white/30">Open Cases</div>
                                <div className="text-sm font-black text-white">{dashboardData?.openEvents ?? 0} <span className="text-[10px] font-medium text-white/50">needs focus</span></div>
                            </div>
                        </div>

                        {/* Centre Health Stat */}
                        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-black/20 border border-white/[0.06]">
                            <Activity size={16} style={{ color: healthColor }} />
                            <div>
                                <div className="text-[9px] font-black uppercase tracking-wider text-white/30">Centre Health</div>
                                <div className="text-sm font-black text-white">{opsMetrics.healthScore}% <span className="text-[10px] font-medium text-white/50">{opsMetrics.topIssue}</span></div>
                            </div>
                        </div>
                    </div>

                    {/* Actions Group */}
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={() => onNavigate?.('incident-log')}
                            className="flex items-center gap-2 px-4 py-3 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold uppercase tracking-wider transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <AlertCircle size={14} />
                            Raise a Case
                        </button>
                        
                        <button
                            onClick={() => onNavigate?.('fets-roster')}
                            className="flex items-center gap-2 px-4 py-3 rounded-xl border border-[#FACC15]/30 bg-[#FACC15]/10 hover:bg-[#FACC15]/20 text-[#FACC15] text-xs font-bold uppercase tracking-wider transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <Calendar size={14} />
                            Roster
                        </button>

                        {isMithun && (
                            <button
                                onClick={() => onNavigate?.('client-portal')}
                                className="flex items-center gap-2 px-4 py-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-wider transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <Briefcase size={14} />
                                Client Workspace
                            </button>
                        )}
                    </div>
                </motion.div>

                {/* ═══════════════════════════════════════════════════════
                    7-DAY EXAM OUTLOOK (syncs with centre selector)
                ═══════════════════════════════════════════════════════ */}
                <div className="mb-10">
                    <SevenDayExamOutlook
                        sessions={examSchedule as any}
                        isLoading={isLoadingSchedule}
                        activeBranch={activeBranch}
                        staffByDate={staffByDate}
                        staffLoading={isLoadingRosterStaff}
                    />
                </div>

                {/* ═══════════════════════════════════════════════════════
                    REFERENCE UTILITIES (Quick Access + Live Support)
                ═══════════════════════════════════════════════════════ */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    
                    {/* Quick Access Section - Left 2/3 */}
                    <div className="lg:col-span-2">
                        <QuickAccessSection profile={profile} authUserId={user?.id} />
                    </div>

                    {/* Help Desk Live Support - Right 1/3 */}
                    <div className="lg:col-span-1">
                        <motion.section
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.18 }}
                            className="sov-card !p-0 overflow-hidden rounded-[24px] border border-[#FACC15]/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                            aria-label="Test centre live support portals"
                        >
                            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2.5 bg-black/[0.12]">
                                <div className="w-10 h-10 rounded-xl bg-[#FACC15]/10 border border-[#FACC15]/25 flex items-center justify-center shrink-0 shadow-[3px_3px_10px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.08)]">
                                    <Headphones size={18} className="text-[#FACC15]" aria-hidden />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-[0.12em] leading-none">Help Desk Support</h3>
                                    <p className="text-[9px] text-[#FACC15]/50 uppercase tracking-widest font-bold mt-1">Live support portals</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 p-4 bg-gradient-to-b from-black/[0.18] to-transparent">
                                {LIVE_SUPPORT_CLIENTS.map((p) => (
                                    <a
                                        key={p.slug}
                                        href={p.supportUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={`${p.name} — opens in a new tab`}
                                        className="group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl min-h-[92px] px-2 py-3
                                            border border-white/[0.12] bg-white/[0.06] backdrop-blur-xl
                                            shadow-[8px_10px_22px_rgba(0,0,0,0.42),-6px_-6px_16px_rgba(39,87,91,0.15),inset_0_1px_0_rgba(255,255,255,0.14)]
                                            transition-all duration-300 ease-out
                                            hover:-translate-y-0.5 hover:border-[#FACC15]/35 hover:bg-white/[0.1]
                                            hover:shadow-[10px_14px_28px_rgba(0,0,0,0.48),-4px_-6px_18px_rgba(250,204,21,0.08),inset_0_1px_0_rgba(255,255,255,0.2)]
                                            focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FACC15]/45 active:translate-y-0"
                                    >
                                        <span className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.12] via-transparent to-[#1a3a3d]/40 opacity-70 group-hover:opacity-90" aria-hidden />
                                        <div className="relative z-[1] w-full max-w-[140px] h-9 flex items-center justify-center px-1">
                                            <img
                                                src={p.image}
                                                alt={p.name}
                                                className="max-h-full max-w-full w-auto h-auto object-contain object-center opacity-[0.94] group-hover:opacity-100 transition-opacity duration-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
                                                loading="lazy"
                                                decoding="async"
                                            />
                                        </div>
                                        <span className="sr-only">{p.name}</span>
                                    </a>
                                ))}
                            </div>
                        </motion.section>
                    </div>

                </div>

            </div>
        </div>
    )
}
