import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Search, Plus, Send, Clock, User, CheckCircle, AlertTriangle,
    Monitor, MessageSquare, ChevronRight, Activity, Filter, Eye,
    Calendar, Users, UserX, Globe, Building, Wrench, X, Hash,
    Phone, CheckSquare, StickyNote, Settings, Check, Wifi,
    ClipboardCheck, Package, UserCog, Briefcase, Building2, Edit3
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useBranch } from '../hooks/useBranch'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'
import RaiseACaseModal, { CaseFormData } from './RaiseACaseModal'
import { CASE_CATEGORIES, getCategoryById, getCategoryColor } from '../config/caseCategories.config'

// --- Types ---
interface Incident {
    id: string
    title: string
    description: string
    category: string
    status: 'open' | 'in_progress' | 'closed'
    severity?: 'critical' | 'major' | 'minor' // Legacy field - no longer used
    reporter?: string
    created_at: string
    branch_location: string
    // Using metadata for flexible data like follow-up answers, vendor info etc
    metadata?: {
        follow_up_data?: Record<string, string>
        vendor_info?: {
            shopName?: string
            contactNumber?: string
            externalCompany?: string
        }
    }
}

interface Comment {
    id: string
    created_at: string
    body: string
    type: 'text' | 'contact' | 'task' | 'asset' | 'system'
    data?: any // JSON for specific widget data
    author_id: string
    author_full_name: string
}

// --- Menu Config ---
const SOURCES = [
    { id: 'all', label: 'All Cases', icon: Activity },
    { id: 'roster', label: 'Roster', icon: Users },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'facility', label: 'Facility', icon: Building },
    { id: 'systems', label: 'Systems', icon: Monitor },
    { id: 'network', label: 'Network', icon: Wifi },
    { id: 'exam', label: 'Exam Ops', icon: ClipboardCheck },
    { id: 'assets', label: 'Assets', icon: Package },
    { id: 'vendor', label: 'Vendor', icon: Wrench },
    { id: 'staff', label: 'Staff/Admin', icon: UserCog },
]

const STATUS_OPTIONS = [
    { value: 'open', label: 'OPEN', color: '#3b82f6', bg: '#eff6ff' },
    { value: 'in_progress', label: 'IN PROGRESS', color: '#f59e0b', bg: '#fffbeb' },
    { value: 'closed', label: 'CLOSED', color: '#10b981', bg: '#ecfdf5' },
]

// Map legacy statuses to new simplified statuses
const getDisplayStatus = (status: string) => {
    if (status === 'assigned' || status === 'escalated') return 'in_progress'
    return status
}

export default function IncidentManager() {
    const { profile } = useAuth()
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

    // Data
    const [incidents, setIncidents] = useState<Incident[]>([])
    const [selectedId, setSelectedId] = useState<string | null>(null)

    // UI State
    const [filterSource, setFilterSource] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [showCreate, setShowCreate] = useState(false)
    const [toolMode, setToolMode] = useState<'text' | 'contact' | 'task'>('text')

    // Thread State
    const [comments, setComments] = useState<Comment[]>([])
    const [inputValue, setInputValue] = useState('')
    // For specialized inputs
    const [inputData, setInputData] = useState<any>({})
    const [editMode, setEditMode] = useState(false)
    const [editData, setEditData] = useState({ title: '', description: '' })

    const messagesEndRef = useRef<HTMLDivElement>(null)

    // --- Initial Load ---
    const loadIncidents = useCallback(async () => {
        let query = supabase.from('incidents').select('*').order('created_at', { ascending: false })
        if (activeBranch !== 'global') {
            query = query.eq('branch_location', activeBranch)
        }
        const { data } = await query
        setIncidents(data || [])
    }, [activeBranch])

    useEffect(() => { loadIncidents() }, [loadIncidents])

    // --- Realtime ---
    useEffect(() => {
        const channel = supabase.channel('playground-live')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, loadIncidents)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'incident_comments' }, payload => {
                if (payload.new.incident_id === selectedId) fetchComments(selectedId!)
            })
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [loadIncidents, selectedId])

    // --- Case Selection ---
    const activeIncident = incidents.find(i => i.id === selectedId)

    const fetchComments = async (id: string) => {
        const { data } = await supabase.from('incident_comments').select('*').eq('incident_id', id).order('created_at', { ascending: true })
        setComments((data || []).map(c => ({
            ...c,
            // Try to parse 'body' as JSON if it looks like it, or treat as text if fails? 
            // Actually, let's assume 'body' is text and we might add a 'data' column in future.
            // For now, I will store JSON string in body for special types, and try parse.
            data: tryParse(c.body) // Helper below
        })))
        setTimeout(scrollToBottom, 100)
    }

    const tryParse = (str: string) => {
        try { return JSON.parse(str) } catch { return null }
    }

    useEffect(() => {
        if (selectedId) {
            fetchComments(selectedId)
            setEditMode(false)
        }
    }, [selectedId])

    useEffect(() => {
        if (activeIncident && !editMode) {
            setEditData({ title: activeIncident.title, description: activeIncident.description })
        }
    }, [activeIncident, editMode])

    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })

    // --- Actions ---
    const handleEditCase = async (id: string, updates: Partial<Incident>) => {
        const { error } = await supabase.from('incidents').update(updates).eq('id', id)
        if (error) {
            toast.error('Failed to update case')
        } else {
            toast.success('Case updated')
            loadIncidents()
        }
    }

    const handleDeleteCase = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this case?')) return
        const { error } = await supabase.from('incidents').delete().eq('id', id)
        if (error) {
            toast.error('Failed to delete case')
        } else {
            toast.success('Case deleted')
            if (selectedId === id) setSelectedId(null)
            loadIncidents()
        }
    }

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!activeIncident || !profile) return

        let payloadBody = inputValue
        let payloadType = 'text'

        // Construct payload based on tool mode
        if (toolMode === 'contact') {
            payloadType = 'contact'
            if (!inputData.name || !inputData.phone) return toast.error('Name & Phone required')
            payloadBody = JSON.stringify({ name: inputData.name, phone: inputData.phone, role: inputData.role || 'Contact' })
        }
        else if (toolMode === 'task') {
            payloadType = 'task'
            if (!inputData.task) return toast.error('Task description required')
            payloadBody = JSON.stringify({ task: inputData.task, assignee: inputData.assignee || 'Unassigned', completed: false })
        }
        else {
            if (!inputValue.trim()) return
        }

        const { error } = await supabase.from('incident_comments').insert({
            incident_id: activeIncident.id,
            author_id: profile.id, // FIX: Use profile.id instead of user_id
            author_full_name: profile.full_name || 'Staff',
            body: payloadBody,
        })

        if (payloadType !== 'text') {
            await supabase.from('incident_comments').insert({
                incident_id: activeIncident.id,
                author_id: profile.id, // FIX: Use profile.id instead of user_id
                author_full_name: profile.full_name || 'Staff',
                body: `WIDGET:${payloadType}:${payloadBody}`
            })
        } else {
            await supabase.from('incident_comments').insert({
                incident_id: activeIncident.id,
                author_id: profile.id, // FIX: Use profile.id instead of user_id
                author_full_name: profile.full_name || 'Staff',
                body: inputValue
            })
        }

        setInputValue('')
        setInputData({})
        setToolMode('text')
    }

    const handleStatusUpdate = async (val: string) => {
        if (!activeIncident) return
        await supabase.from('incidents').update({ status: val }).eq('id', activeIncident.id)
        toast.success('Case Status Updated')
    }

    // Handle new case creation from RaiseACaseModal
    const handleCreateCase = async (caseData: CaseFormData) => {
        const metadata: any = {}

        if (Object.keys(caseData.followUpData).length > 0) {
            metadata.follow_up_data = caseData.followUpData
        }

        if (caseData.vendorInfo) {
            metadata.vendor_info = caseData.vendorInfo
        }

        const targetBranch = (isSuperAdmin || hasDelegation)
            ? (activeBranch === 'global' ? 'calicut' : activeBranch)
            : userProfileBranch;

        const { error } = await supabase.from('incidents').insert({
            title: caseData.title,
            description: caseData.description,
            category: caseData.category,
            status: 'open',
            severity: 'minor',
            user_id: profile?.id,
            reporter: profile?.full_name || 'Staff',
            branch_location: targetBranch,
            metadata: Object.keys(metadata).length > 0 ? metadata : null
        })

        if (error) {
            console.error('Failed to create case:', error)
            toast.error('Failed to create case')
            throw error
        }

        toast.success('Case Opened Successfully')
        loadIncidents()
    }

    // --- Filtering ---
    const filtered = incidents.filter(i => {
        const matchSrc = filterSource === 'all' || i.category === filterSource
        const matchTxt = i.title.toLowerCase().includes(searchQuery.toLowerCase())
        return matchSrc && matchTxt
    })

    // --- Render Parsed Comment ---
    const renderComment = (c: Comment) => {
        const content = c.body
        let type = 'text'
        let data: any = null

        if (content.startsWith('WIDGET:')) {
            const parts = content.split(':', 3) // limit split
            if (parts.length >= 3) {
                type = parts[1]
                // recombine rest in case JSON had colons
                const jsonStr = content.substring(parts[0].length + parts[1].length + 2)
                try { data = JSON.parse(jsonStr) } catch (err) {
                    console.error('Failed to parse widget data:', err)
                }
            }
        }

        if (type === 'contact') {
            return (
                <div className="ip-widget-card ip-widget-contact">
                    <div className="ip-widget-header">
                        <span>CONTACT INFO LOGGED</span>
                        <Phone className="w-4 h-4" />
                    </div>
                    <div className="ip-contact-details">
                        <div className="text-lg font-bold text-green-800">{data?.name}</div>
                        <div className="ip-contact-row"><Phone className="w-3 h-3" /> {data?.phone}</div>
                        <div className="ip-contact-row"><User className="w-3 h-3" /> {data?.role}</div>
                    </div>
                </div>
            )
        }

        if (type === 'task') {
            return (
                <div className="ip-widget-card ip-widget-task">
                    <div className="ip-widget-header">
                        <span>TASK ASSIGNED</span>
                        <CheckSquare className="w-4 h-4" />
                    </div>
                    <div className="ip-task-body">
                        <div className="ip-task-check" />
                        <div>
                            <div className="font-bold text-amber-900">{data?.task}</div>
                            <div className="text-xs text-amber-700 uppercase mt-1">Assignee: {data?.assignee}</div>
                        </div>
                    </div>
                </div>
            )
        }

        if (c.author_full_name === 'SYSTEM') {
            return (
                <div className="flex justify-center my-4">
                    <span className="text-[10px] uppercase font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                        {content}
                    </span>
                </div>
            )
        }

        // Default text note
        return (
            <div className="ip-widget-card ip-widget-note">
                <div className="ip-widget-body">{content}</div>
            </div>
        )
    }

    return (
        <div className="rac-page-container">
            {/* ========== TOP HEADER BAR ========== */}
            <div className="rac-top-header">
                {/* Brand Logo - Custom Image */}
                <div className="rac-brand">
                    <img
                        src="/assets/raise-a-case-logo.jpg"
                        alt="Raise A Case"
                        className="rac-brand-logo-img"
                    />
                    <div className="rac-brand-badge">
                        <span className="rac-badge-dot" />
                        <span>LIVE</span>
                    </div>
                </div>

                {/* Raise A Case Button - Top Right */}
                <motion.button
                    whileHover={canCreateHere ? { scale: 1.05 } : {}}
                    whileTap={canCreateHere ? { scale: 0.95 } : {}}
                    className={`rac-create-btn ${!canCreateHere ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => {
                        if (!canCreateHere) {
                            toast.error(`You can only raise cases for your home branch (${userProfileBranch.toUpperCase()})`);
                            return;
                        }
                        setShowCreate(true);
                    }}
                    title={!canCreateHere ? `Switch back to ${userProfileBranch.toUpperCase()} to raise a case` : undefined}
                >
                    <div className="rac-create-btn-glow" />
                    <Plus className="w-5 h-5" />
                    <span>Raise A Case</span>
                </motion.button>
            </div>

            {/* ========== MAIN CONTENT AREA ========== */}
            <div className="rac-main-layout">
                {/* LEFT MENU - Sidebar showing Case IDs */}
                <div className="rac-sidebar">
                    <div className="rac-filter-title">
                        <Activity className="w-4 h-4" />
                        <span>Active Cases</span>
                    </div>
                    <div className="rac-category-list">
                        {incidents.slice(0, 15).map((inc) => {
                            const isActive = selectedId === inc.id
                            const categoryColors = getCategoryColor(inc.category)
                            return (
                                <motion.button
                                    key={inc.id}
                                    whileHover={{ x: 4 }}
                                    whileTap={{ scale: 0.98 }}
                                    className={`rac-category-item ${isActive ? 'active' : ''}`}
                                    onClick={() => setSelectedId(inc.id)}
                                >
                                    <div
                                        className="rac-category-icon"
                                        style={{ background: categoryColors.color }}
                                    >
                                        <Hash className="w-4 h-4 text-white" />
                                    </div>
                                    <span className="rac-category-label">CASE-{inc.id.slice(0, 6).toUpperCase()}</span>
                                    {isActive && (
                                        <motion.div
                                            layoutId="activeIndicator"
                                            className="rac-active-indicator"
                                        />
                                    )}
                                </motion.button>
                            )
                        })}
                        {incidents.length === 0 && (
                            <div className="p-4 text-xs text-gray-400 italic">No active cases</div>
                        )}
                    </div>
                </div>

                {/* MIDDLE LIST - Cases */}
                <div className="rac-list-panel">
                    <div className="rac-list-header">
                        <div className="rac-search-box">
                            <Search className="w-4 h-4 text-slate-400" />
                            <input
                                className="rac-search-input"
                                placeholder="Search cases..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="rac-list-count">
                            <span className="rac-count-number">{filtered.length}</span>
                            <span className="rac-count-label">cases</span>
                        </div>
                    </div>

                    <div className="rac-cases-scroll">
                        {filtered.map(inc => {
                            const categoryConfig = getCategoryById(inc.category)
                            const CategoryIcon = categoryConfig?.icon || Activity
                            const categoryColors = getCategoryColor(inc.category)
                            const displayStatus = getDisplayStatus(inc.status)
                            const statusConfig = STATUS_OPTIONS.find(s => s.value === displayStatus)

                            return (
                                <motion.div
                                    key={inc.id}
                                    whileHover={{ x: 2 }}
                                    className={`rac-case-card ${selectedId === inc.id ? 'selected' : ''}`}
                                    onClick={() => setSelectedId(inc.id)}
                                >
                                    <div className="rac-case-card-header">
                                        <div className="rac-case-category">
                                            <div
                                                className="rac-case-category-icon"
                                                style={{ background: `linear-gradient(135deg, ${categoryColors.color}, ${categoryColors.color}dd)` }}
                                            >
                                                <CategoryIcon size={12} className="text-white" />
                                            </div>
                                            <span style={{ color: categoryColors.color }}>
                                                {categoryConfig?.label || inc.category}
                                            </span>
                                        </div>
                                        <span className="rac-case-date">{new Date(inc.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <div className="rac-case-title">{inc.title}</div>
                                    <div className="rac-case-footer">
                                        <div
                                            className="rac-case-status"
                                            style={{ background: statusConfig?.bg, color: statusConfig?.color }}
                                        >
                                            <div className="rac-status-dot" style={{ background: statusConfig?.color }} />
                                            {statusConfig?.label}
                                        </div>
                                        <span className="rac-case-id">CASE-{inc.id.slice(0, 6).toUpperCase()}</span>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </div>
                </div>

                {/* RIGHT PLAYGROUND */}
                <div className="rac-playground">
                    {activeIncident ? (
                        (() => {
                            const activeCategoryConfig = getCategoryById(activeIncident.category)
                            const ActiveCategoryIcon = activeCategoryConfig?.icon || Activity
                            const activeCategoryColors = getCategoryColor(activeIncident.category)
                            const activeDisplayStatus = getDisplayStatus(activeIncident.status)
                            const activeStatusConfig = STATUS_OPTIONS.find(s => s.value === activeDisplayStatus)
                            const vendorInfo = activeIncident.metadata?.vendor_info

                            return (
                                <>
                                    {/* Colorful Case Header */}
                                    <div className="rac-case-header-detail">
                                        <div className="rac-case-header-top">
                                            <div className="rac-case-header-info">
                                                <div
                                                    className="rac-case-icon-large"
                                                    style={{ background: `linear-gradient(135deg, ${activeCategoryColors.color}, ${activeCategoryColors.color}cc)` }}
                                                >
                                                    <ActiveCategoryIcon size={24} className="text-white" />
                                                </div>
                                                <div>
                                                    <div
                                                        className="rac-case-category-badge"
                                                        style={{ background: activeCategoryColors.bgColor, color: activeCategoryColors.color }}
                                                    >
                                                        {activeCategoryConfig?.label || activeIncident.category}
                                                    </div>
                                                    {editMode ? (
                                                        <input
                                                            value={editData.title}
                                                            onChange={e => setEditData({ ...editData, title: e.target.value })}
                                                            className="rac-case-title-input"
                                                            style={{
                                                                fontSize: '1.25rem',
                                                                fontWeight: 'bold',
                                                                border: 'none',
                                                                borderBottom: '2px solid var(--deep-gold)',
                                                                background: 'transparent',
                                                                width: '100%',
                                                                outline: 'none'
                                                            }}
                                                        />
                                                    ) : (
                                                        <h2 className="rac-case-title-large">{activeIncident.title}</h2>
                                                    )}
                                                    <div className="rac-case-meta-row">
                                                        <span className="rac-meta-tag">
                                                            <User className="w-3 h-3" />
                                                            {activeIncident.reporter || 'System'}
                                                        </span>
                                                        <span className="rac-meta-tag rac-meta-id">
                                                            <Hash className="w-3 h-3" />
                                                            CASE-{activeIncident.id.slice(0, 6).toUpperCase()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {editMode ? (
                                                    <>
                                                        <button
                                                            onClick={() => {
                                                                handleEditCase(activeIncident.id, editData)
                                                                setEditMode(false)
                                                            }}
                                                            className="px-3 py-1 bg-green-500 text-white rounded-lg text-xs font-bold"
                                                        >
                                                            SAVE
                                                        </button>
                                                        <button
                                                            onClick={() => setEditMode(false)}
                                                            className="px-3 py-1 bg-gray-200 text-gray-600 rounded-lg text-xs font-bold"
                                                        >
                                                            CANCEL
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => setEditMode(true)}
                                                        className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                                                        title="Edit Case"
                                                    >
                                                        <Edit3 className="w-5 h-5" />
                                                    </button>
                                                )}

                                                <select
                                                    className="rac-status-dropdown"
                                                    value={activeDisplayStatus}
                                                    onChange={(e) => handleStatusUpdate(e.target.value)}
                                                    style={{
                                                        background: activeStatusConfig?.bg,
                                                        color: activeStatusConfig?.color,
                                                        borderColor: activeStatusConfig?.color
                                                    }}
                                                >
                                                    {STATUS_OPTIONS.map(o => (
                                                        <option key={o.value} value={o.value}>{o.label}</option>
                                                    ))}
                                                </select>

                                                <button
                                                    onClick={() => handleDeleteCase(activeIncident.id)}
                                                    className="p-2 text-gray-400 hover:text-rose-500 transition-colors"
                                                    title="Delete Case"
                                                >
                                                    <X className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Vendor Info Section - Colorful */}
                                    {vendorInfo && (vendorInfo.shopName || vendorInfo.contactNumber || vendorInfo.externalCompany) && (
                                        <div className="rac-vendor-card">
                                            <div className="rac-vendor-header">
                                                <Briefcase size={16} />
                                                <span>External Vendor</span>
                                            </div>
                                            <div className="rac-vendor-details">
                                                {vendorInfo.shopName && (
                                                    <div className="rac-vendor-item">
                                                        <Building2 size={14} />
                                                        <span>{vendorInfo.shopName}</span>
                                                    </div>
                                                )}
                                                {vendorInfo.contactNumber && (
                                                    <div className="rac-vendor-item">
                                                        <Phone size={14} />
                                                        <span>{vendorInfo.contactNumber}</span>
                                                    </div>
                                                )}
                                                {vendorInfo.externalCompany && (
                                                    <div className="rac-vendor-item">
                                                        <Briefcase size={14} />
                                                        <span>{vendorInfo.externalCompany}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="ip-canvas custom-scrollbar">
                                        {/* Original Issue Card */}
                                        <div className="ip-widget-row">
                                            <div className="ip-avatar bg-slate-800">OP</div>
                                            <div className="ip-widget-card" style={{ borderLeft: '4px solid #334155' }}>
                                                <div className="ip-widget-header">INITIAL REPORT</div>
                                                <div className="p-4 text-sm leading-relaxed whitespace-pre-wrap">
                                                    {editMode ? (
                                                        <textarea
                                                            value={editData.description}
                                                            onChange={e => setEditData({ ...editData, description: e.target.value })}
                                                            className="ip-description-textarea"
                                                        />
                                                    ) : (
                                                        activeIncident.description
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="ip-widget-date-divider">
                                            <span>CASE HISTORY</span>
                                        </div>

                                        {/* Stream */}
                                        {comments.map(comment => {
                                            const isMe = comment.author_id === profile?.id
                                            return (
                                                <div key={comment.id} className={`ip-widget-row ${isMe ? 'right' : ''}`}>
                                                    {!isMe && (
                                                        <div className="ip-avatar" title={comment.author_full_name}>
                                                            {comment.author_full_name[0]}
                                                        </div>
                                                    )}

                                                    {renderComment(comment)}

                                                    {isMe && (
                                                        <div className="ip-avatar" style={{ background: 'var(--ip-primary)' }}>
                                                            ME
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                        <div ref={messagesEndRef} />
                                    </div>

                                    {/* Creation Dock */}
                                    {activeIncident.status !== 'closed' && (
                                        <div className="ip-dock">
                                            <div className="ip-dock-tools">
                                                <button
                                                    onClick={() => setToolMode('text')}
                                                    className={`ip-tool-btn ${toolMode === 'text' ? 'active' : ''}`}
                                                >
                                                    <StickyNote className="w-4 h-4" /> Note
                                                </button>
                                                <button
                                                    onClick={() => setToolMode('contact')}
                                                    className={`ip-tool-btn ${toolMode === 'contact' ? 'active' : ''}`}
                                                >
                                                    <Phone className="w-4 h-4" /> Contact
                                                </button>
                                                <button
                                                    onClick={() => setToolMode('task')}
                                                    className={`ip-tool-btn ${toolMode === 'task' ? 'active' : ''}`}
                                                >
                                                    <CheckSquare className="w-4 h-4" /> Task
                                                </button>
                                            </div>

                                            {toolMode === 'text' && (
                                                <div className="ip-dock-input-wrapper">
                                                    <input
                                                        className="ip-dock-input"
                                                        placeholder="Type your playground note..."
                                                        value={inputValue}
                                                        onChange={e => setInputValue(e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                                                    />
                                                    <button onClick={() => handleSend()} className="ip-send-btn"><Send className="w-5 h-5" /></button>
                                                </div>
                                            )}

                                            {toolMode === 'contact' && (
                                                <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                                    <input placeholder="Name (e.g. Repair Shop)" className="p-2 border rounded" onChange={e => setInputData({ ...inputData, name: e.target.value })} />
                                                    <input placeholder="Phone / Details" className="p-2 border rounded" onChange={e => setInputData({ ...inputData, phone: e.target.value })} />
                                                    <button onClick={() => handleSend()} className="bg-green-600 text-white rounded font-bold">Add Contact Card</button>
                                                </div>
                                            )}

                                            {toolMode === 'task' && (
                                                <div className="grid grid-cols-3 gap-3 bg-amber-50 p-4 rounded-xl border border-amber-200">
                                                    <input placeholder="Task Description" className="col-span-2 p-2 border rounded" onChange={e => setInputData({ ...inputData, task: e.target.value })} />
                                                    <div className="flex gap-2">
                                                        <input placeholder="Assignee Name" className="flex-1 p-2 border rounded" onChange={e => setInputData({ ...inputData, assignee: e.target.value })} />
                                                        <button onClick={() => handleSend()} className="bg-amber-600 text-white rounded px-4 font-bold">Assign</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )
                        })()
                    ) : (
                        <div className="rac-empty-state">
                            <div className="rac-empty-icon">
                                <div className="rac-empty-icon-ring" />
                                <div className="rac-empty-icon-ring delay-1" />
                                <div className="rac-empty-icon-ring delay-2" />
                                <Activity className="w-12 h-12 text-violet-400" />
                            </div>
                            <h2 className="rac-empty-title">Select a Case</h2>
                            <p className="rac-empty-subtitle">Choose a case from the list to view details and collaborate</p>
                        </div>
                    )}
                </div>
            </div>

            {/* CREATE MODAL - New Multi-Step RaiseACaseModal */}
            <RaiseACaseModal
                isOpen={showCreate}
                onClose={() => setShowCreate(false)}
                onSubmit={handleCreateCase}
            />
        </div>
    )
}

// Old CreateCaseModal removed - now using RaiseACaseModal component
