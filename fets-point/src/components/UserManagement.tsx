import React, { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Users, Search, Settings2, Shield, ShieldCheck, ShieldAlert,
    Save, X, Plus, Lock, Calendar, ClipboardList, Newspaper,
    MessageSquare, AlertTriangle, ChevronRight, UserPlus,
    MapPin, Phone, Briefcase, GraduationCap, Award, FileText,
    Trash2, User, Mail, Star, History, TrendingUp, Megaphone, Building2, Crown, ChevronDown
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useStaff, useStaffMutations } from '../hooks/useStaffManagement'
import { toast } from 'react-hot-toast'
import { StaffProfile } from '../types/shared'
import { getAvailableBranches, formatBranchName, isMithunEmail } from '../utils/authUtils'
import { getCurrentISTDateString } from '../utils/dateUtils'
import { ClientControl } from './ClientControl'
import { useAppModules } from '../hooks/useAppModules'

const PERMISSION_KEYS = [
    { key: 'can_edit_roster', label: 'Roster Management', icon: Users, description: 'Create and edit staff rosters' },
    { key: 'user_management_edit', label: 'User Management Authority', icon: Shield, description: 'Manage user profiles, roles and critical permissions' },
]

// Premium Classic Theme - Dark Slate with Gold Accents
const THEME = {
    // Backgrounds
    bgPrimary: '#0f1419',         // Near black
    bgSecondary: '#1a2332',       // Dark navy slate
    bgTertiary: '#243044',        // Lighter slate
    bgCard: '#1e2a3a',            // Card background
    bgHover: '#2a3a4d',           // Hover state
    
    // Accent Colors - Gold/Amber
    gold: '#d4a853',              // Rich gold
    goldLight: '#e8c47a',         // Light gold
    goldDark: '#b8923f',          // Dark gold
    goldMuted: 'rgba(212, 168, 83, 0.15)', // Muted gold bg
    
    // Text Colors
    textPrimary: '#f8fafc',       // Near white
    textSecondary: '#94a3b8',     // Muted gray
    textMuted: '#64748b',         // More muted
    
    // Borders & Shadows
    border: 'rgba(255, 255, 255, 0.08)',
    borderLight: 'rgba(255, 255, 255, 0.12)',
    shadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
    shadowGold: '0 0 30px rgba(212, 168, 83, 0.2)',
}

interface UserManagementProps {
    onNavigate?: (tab: string) => void;
}

export function UserManagement({ onNavigate }: UserManagementProps = {}) {
    const { profile: currentUser, hasPermission } = useAuth()
    const { data: staff = [], isLoading } = useStaff()
    const { updateStaff, archiveStaff, addStaff } = useStaffMutations()

    const [searchTerm, setSearchTerm] = useState('')
    const [branchFilter, setBranchFilter] = useState<string>('all')
    const [mainTab, setMainTab] = useState<'users' | 'clients' | 'modules'>('users')

    const [selectedUser, setSelectedUser] = useState<StaffProfile | null>(null)
    const [activeTab, setActiveTab] = useState<'profile' | 'employment' | 'growth' | 'permissions'>('profile')
    const [isSaving, setIsSaving] = useState(false)
    const [showAddUserModal, setShowAddUserModal] = useState(false)

    const [formData, setFormData] = useState<Partial<StaffProfile>>({})
    const [permissions, setPermissions] = useState<Record<string, boolean>>({})

    useEffect(() => {
        if (selectedUser) {
            setFormData({ ...selectedUser })
            setPermissions((selectedUser.permissions as Record<string, boolean>) || {})
            setActiveTab('profile')
        }
    }, [selectedUser])

    const filteredStaff = useMemo(() => {
        return staff.filter(s => {
            const matchesSearch = s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.email.toLowerCase().includes(searchTerm.toLowerCase())
            const matchesBranch = branchFilter === 'all' || s.branch_assigned === branchFilter
            return matchesSearch && matchesBranch
        })
    }, [staff, searchTerm, branchFilter])

    const handleSave = async () => {
        if (!selectedUser || !formData) return
        setIsSaving(true)
        try {
            await updateStaff({ id: selectedUser.id, ...formData, permissions: permissions as any })
            toast.success(`Profile updated for ${formData.full_name}`)
            setSelectedUser(prev => prev ? { ...prev, ...formData, permissions } : null)
        } catch (error: any) {
            toast.error(`Failed to update profile: ${error.message}`)
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteUser = async () => {
        if (!selectedUser) return
        const dateStr = window.prompt(
            `Archive ${selectedUser.full_name} — last working day for roster/payroll (YYYY-MM-DD). They stay on the roster for that calendar month.`,
            getCurrentISTDateString()
        )
        if (dateStr === null) return
        const trimmed = dateStr.trim()
        if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            toast.error('Invalid date. Use YYYY-MM-DD.')
            return
        }
        if (!window.confirm(`Archive ${selectedUser.full_name} with end date ${trimmed}?`)) return
        try {
            await archiveStaff({ staffId: selectedUser.id, employmentEndDate: trimmed })
            setSelectedUser(null)
        } catch (error: any) {
            console.error(error)
        }
    }

    const handleArrayItemAdd = (field: 'certificates' | 'trainings_attended' | 'future_trainings', value: string) => {
        if (!value.trim()) return
        const currentArray = (formData[field] as any[]) || []
        setFormData({ ...formData, [field]: [...currentArray, { id: Date.now(), title: value, date: new Date().toISOString() }] })
    }

    const handleArrayItemRemove = (field: 'certificates' | 'trainings_attended' | 'future_trainings', index: number) => {
        const currentArray = (formData[field] as any[]) || []
        const newArray = [...currentArray]
        newArray.splice(index, 1)
        setFormData({ ...formData, [field]: newArray })
    }

    const isSuperAdmin = isMithunEmail(currentUser?.email);

    // Access Denied Screen
    if (!isSuperAdmin) {
        return (
            <div 
                className="flex flex-col items-center justify-center min-h-screen p-8"
                style={{ background: THEME.bgPrimary }}
            >
                <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700;800&display=swap');`}</style>
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center p-16 rounded-3xl max-w-lg"
                    style={{ background: THEME.bgSecondary, border: `1px solid ${THEME.border}`, boxShadow: THEME.shadow }}
                >
                    <div 
                        className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-8"
                        style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
                    >
                        <ShieldAlert size={40} className="text-white" />
                    </div>
                    <h2 
                        className="text-4xl font-bold mb-4"
                        style={{ fontFamily: "'Playfair Display', serif", color: THEME.textPrimary }}
                    >
                        Access Restricted
                    </h2>
                    <p className="text-lg" style={{ color: THEME.textSecondary, fontFamily: "'Inter', sans-serif" }}>
                        Super Admin privileges required
                    </p>
                </motion.div>
            </div>
        )
    }

    return (
        <div className="min-h-screen -mt-32 pt-48 px-6 md:px-8 pb-8" style={{ background: THEME.bgPrimary }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700;800&display=swap');
                
                .premium-scrollbar::-webkit-scrollbar { width: 5px; }
                .premium-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .premium-scrollbar::-webkit-scrollbar-thumb { background: ${THEME.bgTertiary}; border-radius: 10px; }
                .premium-scrollbar::-webkit-scrollbar-thumb:hover { background: ${THEME.gold}; }
            `}</style>

            {/* Page Header - Not sticky, flows with content */}
            <header className="mb-8">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    {/* Left: Title & Tabs */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                        {/* Logo/Title */}
                        <div className="flex items-center gap-4">
                            <div 
                                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                                style={{ 
                                    background: `linear-gradient(135deg, ${THEME.gold}, ${THEME.goldDark})`,
                                    boxShadow: THEME.shadowGold
                                }}
                            >
                                <Crown size={28} className="text-white" />
                            </div>
                            <div>
                                <h1 
                                    className="text-3xl font-bold tracking-tight"
                                    style={{ fontFamily: "'Playfair Display', serif", color: THEME.textPrimary }}
                                >
                                    Management Console
                                </h1>
                                <p className="text-sm font-medium mt-0.5" style={{ color: THEME.gold, fontFamily: "'Inter', sans-serif" }}>
                                    Super Admin Dashboard
                                </p>
                            </div>
                        </div>

                        {/* Tab Navigation */}
                        <div 
                            className="flex p-1 rounded-xl sm:ml-6"
                            style={{ background: THEME.bgSecondary, border: `1px solid ${THEME.border}` }}
                        >
                            {[
                                { id: 'users', label: 'Personnel', icon: Users },
                                { id: 'clients', label: 'Clients', icon: Building2 }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setMainTab(tab.id as any)}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all"
                                    style={{
                                        fontFamily: "'Inter', sans-serif",
                                        background: mainTab === tab.id ? THEME.gold : 'transparent',
                                        color: mainTab === tab.id ? THEME.bgPrimary : THEME.textSecondary
                                    }}
                                >
                                    <tab.icon size={16} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Right: Admin Profile */}
                    <div 
                        className="flex items-center gap-3 px-5 py-3 rounded-xl"
                        style={{ background: THEME.bgSecondary, border: `1px solid ${THEME.border}` }}
                    >
                        <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
                            style={{ background: `linear-gradient(135deg, ${THEME.gold}, ${THEME.goldDark})`, color: THEME.bgPrimary }}
                        >
                            {currentUser?.full_name?.charAt(0) || 'A'}
                        </div>
                        <div>
                            <p className="text-sm font-semibold" style={{ color: THEME.textPrimary, fontFamily: "'Inter', sans-serif" }}>
                                {currentUser?.full_name}
                            </p>
                            <p className="text-xs flex items-center gap-1" style={{ color: THEME.gold }}>
                                <Crown size={10} /> Super Admin
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <div>
                {mainTab === 'users' ? (
                    <div className="flex gap-6" style={{ minHeight: '600px', maxHeight: 'calc(100vh - 280px)' }}>
                        {/* Left Sidebar - User List */}
                        <aside 
                            className="w-96 flex flex-col rounded-2xl overflow-hidden shrink-0"
                            style={{ background: THEME.bgSecondary, border: `1px solid ${THEME.border}` }}
                        >
                            {/* Sidebar Header */}
                            <div className="p-5 border-b" style={{ borderColor: THEME.border }}>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 
                                        className="text-lg font-bold"
                                        style={{ fontFamily: "'Playfair Display', serif", color: THEME.textPrimary }}
                                    >
                                        Personnel
                                    </h2>
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setShowAddUserModal(true)}
                                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                                        style={{ background: THEME.gold, color: THEME.bgPrimary }}
                                    >
                                        <Plus size={18} />
                                    </motion.button>
                                </div>
                                
                                {/* Search */}
                                <div className="relative mb-4">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: THEME.textMuted }} />
                                    <input
                                        type="text"
                                        placeholder="Search..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm font-medium focus:outline-none"
                                        style={{
                                            fontFamily: "'Inter', sans-serif",
                                            background: THEME.bgTertiary,
                                            color: THEME.textPrimary,
                                            border: `1px solid ${THEME.border}`
                                        }}
                                    />
                                </div>

                                {/* Branch Filter */}
                                <div className="flex gap-1 flex-wrap">
                                    {['all', 'calicut', 'cochin', 'kannur'].map(branch => (
                                        <button
                                            key={branch}
                                            onClick={() => setBranchFilter(branch)}
                                            className="px-3 py-1.5 rounded-md text-xs font-semibold uppercase transition-all"
                                            style={{
                                                fontFamily: "'Inter', sans-serif",
                                                background: branchFilter === branch ? THEME.gold : THEME.bgTertiary,
                                                color: branchFilter === branch ? THEME.bgPrimary : THEME.textSecondary
                                            }}
                                        >
                                            {branch}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* User List */}
                            <div className="flex-1 overflow-y-auto p-3 premium-scrollbar">
                                <div className="space-y-2">
                                    {filteredStaff.map(user => (
                                        <motion.button
                                            key={user.id}
                                            onClick={() => setSelectedUser(user)}
                                            whileHover={{ x: 4 }}
                                            className="w-full p-4 rounded-xl text-left transition-all flex items-center gap-4"
                                            style={{
                                                background: selectedUser?.id === user.id ? THEME.bgTertiary : 'transparent',
                                                border: selectedUser?.id === user.id ? `1px solid ${THEME.gold}40` : `1px solid transparent`
                                            }}
                                        >
                                            <div 
                                                className="w-11 h-11 rounded-lg flex items-center justify-center font-bold text-sm shrink-0"
                                                style={{
                                                    background: selectedUser?.id === user.id ? THEME.gold : THEME.bgTertiary,
                                                    color: selectedUser?.id === user.id ? THEME.bgPrimary : THEME.textSecondary
                                                }}
                                            >
                                                {user.full_name.charAt(0)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p 
                                                    className="font-semibold text-sm truncate"
                                                    style={{ fontFamily: "'Inter', sans-serif", color: THEME.textPrimary }}
                                                >
                                                    {user.full_name}
                                                </p>
                                                <p className="text-xs truncate" style={{ color: THEME.textMuted }}>{user.email}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span 
                                                        className="text-[10px] font-semibold px-2 py-0.5 rounded uppercase"
                                                        style={{ background: THEME.bgCard, color: THEME.textSecondary }}
                                                    >
                                                        {formatBranchName(user.branch_assigned || 'global')}
                                                    </span>
                                                    {user.role === 'super_admin' && (
                                                        <Crown size={12} style={{ color: THEME.gold }} />
                                                    )}
                                                </div>
                                            </div>
                                        </motion.button>
                                    ))}
                                </div>
                            </div>

                            {/* Sidebar Footer */}
                            <div className="p-4 border-t" style={{ borderColor: THEME.border }}>
                                <p className="text-xs text-center" style={{ color: THEME.textMuted }}>
                                    {filteredStaff.length} of {staff.length} personnel
                                </p>
                            </div>
                        </aside>

                        {/* Main Content Area */}
                        <div className="flex-1 flex flex-col min-w-0">
                            {selectedUser ? (
                                <motion.div
                                    key={selectedUser.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="h-full flex flex-col rounded-2xl overflow-hidden"
                                    style={{ background: THEME.bgSecondary, border: `1px solid ${THEME.border}` }}
                                >
                                    {/* Profile Header */}
                                    <div 
                                        className="p-6 flex items-center gap-6 border-b"
                                        style={{ borderColor: THEME.border, background: THEME.bgCard }}
                                    >
                                        <div 
                                            className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold shrink-0"
                                            style={{ 
                                                background: `linear-gradient(135deg, ${THEME.gold}, ${THEME.goldDark})`,
                                                color: THEME.bgPrimary,
                                                boxShadow: THEME.shadowGold
                                            }}
                                        >
                                            {selectedUser.full_name.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h2 
                                                className="text-2xl font-bold truncate"
                                                style={{ fontFamily: "'Playfair Display', serif", color: THEME.textPrimary }}
                                            >
                                                {formData.full_name}
                                            </h2>
                                            <div className="flex flex-wrap items-center gap-4 mt-2" style={{ color: THEME.textSecondary }}>
                                                <span className="flex items-center gap-1.5 text-sm">
                                                    <Mail size={14} /> {formData.email}
                                                </span>
                                                <span className="flex items-center gap-1.5 text-sm">
                                                    <Briefcase size={14} /> {(formData.role || '').toUpperCase()}
                                                </span>
                                                <span className="flex items-center gap-1.5 text-sm">
                                                    <MapPin size={14} /> {formatBranchName(formData.branch_assigned || 'global')}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <motion.button
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={handleSave}
                                                disabled={isSaving}
                                                className="px-5 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2 disabled:opacity-50"
                                                style={{ 
                                                    fontFamily: "'Inter', sans-serif",
                                                    background: THEME.gold, 
                                                    color: THEME.bgPrimary 
                                                }}
                                            >
                                                <Save size={16} /> {isSaving ? 'Saving...' : 'Save Changes'}
                                            </motion.button>
                                            <button
                                                onClick={handleDeleteUser}
                                                className="p-2.5 rounded-lg transition-colors"
                                                style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Tab Navigation */}
                                    <div className="flex px-6 border-b" style={{ borderColor: THEME.border }}>
                                        {['profile', 'employment', 'growth', 'permissions'].map(tab => (
                                            <button
                                                key={tab}
                                                onClick={() => setActiveTab(tab as any)}
                                                className="px-5 py-4 font-semibold text-sm capitalize transition-all relative"
                                                style={{
                                                    fontFamily: "'Inter', sans-serif",
                                                    color: activeTab === tab ? THEME.gold : THEME.textSecondary
                                                }}
                                            >
                                                {tab}
                                                {activeTab === tab && (
                                                    <motion.div
                                                        layoutId="activeTab"
                                                        className="absolute bottom-0 left-0 right-0 h-0.5"
                                                        style={{ background: THEME.gold }}
                                                    />
                                                )}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Tab Content */}
                                    <div className="flex-1 overflow-y-auto p-6 premium-scrollbar">
                                        <div className="max-w-3xl">
                                            {activeTab === 'profile' && (
                                                <div className="grid grid-cols-2 gap-5">
                                                    <InputField label="Full Name" value={formData.full_name || ''} onChange={v => setFormData({ ...formData, full_name: v })} />
                                                    <InputField label="Contact Number" value={formData.contact_number || ''} onChange={v => setFormData({ ...formData, contact_number: v })} placeholder="+91..." />
                                                    <div className="col-span-2">
                                                        <InputField label="Email" value={formData.email || ''} onChange={() => {}} disabled />
                                                    </div>
                                                </div>
                                            )}

                                            {activeTab === 'employment' && (
                                                <div className="grid grid-cols-2 gap-5">
                                                    <InputField label="Position" value={formData.position || ''} onChange={v => setFormData({ ...formData, position: v })} placeholder="e.g. Senior Invigilator" />
                                                    <InputField label="Joining Date" value={formData.joining_date || ''} onChange={v => setFormData({ ...formData, joining_date: v })} type="date" />
                                                    <SelectField label="Role" value={formData.role || 'fetsian'} onChange={v => setFormData({ ...formData, role: v })} 
                                                        options={[{ value: 'fetsian', label: 'Fetsian' }, { value: 'admin', label: 'Admin' }, { value: 'super_admin', label: 'Super Admin' }]} />
                                                    <SelectField label="Branch" value={formData.branch_assigned || 'calicut'} onChange={v => setFormData({ ...formData, branch_assigned: v })} 
                                                        options={[{ value: 'calicut', label: 'Calicut' }, { value: 'cochin', label: 'Cochin' }, { value: 'kannur', label: 'Kannur' }, { value: 'global', label: 'Global' }]} />
                                                </div>
                                            )}

                                            {activeTab === 'growth' && (
                                                <div className="space-y-6">
                                                    {[
                                                        { field: 'certificates', label: 'Certificates', icon: Award },
                                                        { field: 'trainings_attended', label: 'Trainings Attended', icon: History },
                                                        { field: 'future_trainings', label: 'Future Plans', icon: TrendingUp },
                                                    ].map(section => (
                                                        <GrowthCard
                                                            key={section.field}
                                                            label={section.label}
                                                            icon={section.icon}
                                                            items={(formData as any)[section.field] || []}
                                                            onAdd={(v) => handleArrayItemAdd(section.field as any, v)}
                                                            onRemove={(idx) => handleArrayItemRemove(section.field as any, idx)}
                                                        />
                                                    ))}
                                                    
                                                    <div className="p-5 rounded-xl" style={{ background: THEME.bgTertiary }}>
                                                        <label className="block text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: THEME.textMuted }}>
                                                            Remarks
                                                        </label>
                                                        <textarea
                                                            rows={3}
                                                            value={formData.remarks || ''}
                                                            onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                                                            className="w-full p-4 rounded-lg focus:outline-none text-sm"
                                                            placeholder="Performance notes..."
                                                            style={{ background: THEME.bgCard, color: THEME.textPrimary, border: `1px solid ${THEME.border}` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {activeTab === 'permissions' && (
                                                <div className="space-y-3">
                                                    {PERMISSION_KEYS.map((perm) => {
                                                        const Icon = perm.icon
                                                        const isEnabled = permissions[perm.key]
                                                        return (
                                                            <button
                                                                key={perm.key}
                                                                onClick={() => setPermissions(prev => ({ ...prev, [perm.key]: !prev[perm.key] }))}
                                                                className="w-full p-5 rounded-xl text-left transition-all flex items-center gap-4"
                                                                style={{
                                                                    background: isEnabled ? THEME.goldMuted : THEME.bgTertiary,
                                                                    border: `1px solid ${isEnabled ? THEME.gold + '40' : THEME.border}`
                                                                }}
                                                            >
                                                                <div 
                                                                    className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
                                                                    style={{ background: isEnabled ? THEME.gold : THEME.bgCard, color: isEnabled ? THEME.bgPrimary : THEME.textSecondary }}
                                                                >
                                                                    <Icon size={20} />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <p className="font-semibold" style={{ color: isEnabled ? THEME.gold : THEME.textPrimary }}>{perm.label}</p>
                                                                    <p className="text-xs mt-0.5" style={{ color: THEME.textMuted }}>{perm.description}</p>
                                                                </div>
                                                                <div 
                                                                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                                                                    style={{ borderColor: isEnabled ? THEME.gold : THEME.textMuted, background: isEnabled ? THEME.gold : 'transparent' }}
                                                                >
                                                                    {isEnabled && <div className="w-2 h-2 rounded-full" style={{ background: THEME.bgPrimary }} />}
                                                                </div>
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            ) : (
                                <div 
                                    className="h-full flex flex-col items-center justify-center rounded-2xl"
                                    style={{ background: THEME.bgSecondary, border: `1px solid ${THEME.border}` }}
                                >
                                    <Users size={64} style={{ color: THEME.bgTertiary }} />
                                    <h3 className="text-xl font-bold mt-6" style={{ fontFamily: "'Playfair Display', serif", color: THEME.textPrimary }}>
                                        Select Personnel
                                    </h3>
                                    <p className="text-sm mt-2" style={{ color: THEME.textMuted }}>
                                        Choose from the list to view details
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div style={{ minHeight: '600px' }}>
                        <ClientControl />
                    </div>
                )}
            </div>

            {/* Add User Modal */}
            <AnimatePresence>
                {showAddUserModal && (
                    <AddUserModal
                        onClose={() => setShowAddUserModal(false)}
                        onAdd={async (data) => { await addStaff(data); setShowAddUserModal(false) }}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}

// Reusable Input Field
function InputField({ label, value, onChange, placeholder, type = 'text', disabled = false }: any) {
    return (
        <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: THEME.textMuted, fontFamily: "'Inter', sans-serif" }}>
                {label}
            </label>
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                className="w-full p-4 rounded-xl focus:outline-none text-sm font-medium disabled:opacity-50"
                style={{ 
                    fontFamily: "'Inter', sans-serif",
                    background: THEME.bgTertiary, 
                    color: THEME.textPrimary, 
                    border: `1px solid ${THEME.border}` 
                }}
            />
        </div>
    )
}

// Reusable Select Field
function SelectField({ label, value, onChange, options }: any) {
    return (
        <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: THEME.textMuted, fontFamily: "'Inter', sans-serif" }}>
                {label}
            </label>
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full p-4 rounded-xl focus:outline-none text-sm font-medium"
                style={{ 
                    fontFamily: "'Inter', sans-serif",
                    background: THEME.bgTertiary, 
                    color: THEME.textPrimary, 
                    border: `1px solid ${THEME.border}` 
                }}
            >
                {options.map((opt: any) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
        </div>
    )
}

// Growth Card Component
function GrowthCard({ label, icon: Icon, items, onAdd, onRemove }: any) {
    return (
        <div className="p-5 rounded-xl" style={{ background: THEME.bgTertiary }}>
            <div className="flex items-center gap-2 mb-4">
                <Icon size={18} style={{ color: THEME.gold }} />
                <span className="font-semibold text-sm" style={{ color: THEME.textPrimary }}>{label}</span>
            </div>
            <div className="space-y-2 mb-4">
                {items.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg" style={{ background: THEME.bgCard }}>
                        <span className="text-sm" style={{ color: THEME.textPrimary }}>{item.title}</span>
                        <button onClick={() => onRemove(idx)} className="text-red-400 hover:text-red-300"><X size={14} /></button>
                    </div>
                ))}
                {items.length === 0 && <p className="text-xs italic" style={{ color: THEME.textMuted }}>No entries yet</p>}
            </div>
            <input
                type="text"
                placeholder="Add item and press Enter..."
                className="w-full p-3 rounded-lg text-sm focus:outline-none"
                style={{ background: THEME.bgCard, color: THEME.textPrimary, border: `1px solid ${THEME.border}` }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') { onAdd(e.currentTarget.value); e.currentTarget.value = '' }
                }}
            />
        </div>
    )
}

// Add User Modal
function AddUserModal({ onClose, onAdd }: { onClose: () => void, onAdd: (data: any) => Promise<void> }) {
    const [formData, setFormData] = useState({ email: '', password: '', full_name: '', branch_assigned: 'calicut', role: 'fetsian' })
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        await onAdd(formData)
        setLoading(false)
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }}
        >
            <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="w-full max-w-lg rounded-2xl overflow-hidden"
                style={{ background: THEME.bgSecondary, border: `1px solid ${THEME.border}`, boxShadow: THEME.shadow }}
            >
                <div className="p-6 flex justify-between items-center border-b" style={{ borderColor: THEME.border, background: THEME.bgCard }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: THEME.gold }}>
                            <UserPlus size={20} style={{ color: THEME.bgPrimary }} />
                        </div>
                        <h3 className="text-xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: THEME.textPrimary }}>
                            Add Personnel
                        </h3>
                    </div>
                    <button onClick={onClose} style={{ color: THEME.textMuted }}><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <InputField label="Full Name" value={formData.full_name} onChange={(v: string) => setFormData({ ...formData, full_name: v })} />
                    <InputField label="Email" value={formData.email} onChange={(v: string) => setFormData({ ...formData, email: v })} type="email" />
                    <InputField label="Password" value={formData.password} onChange={(v: string) => setFormData({ ...formData, password: v })} placeholder="Min. 6 characters" />
                    
                    <div className="grid grid-cols-2 gap-4">
                        <SelectField label="Branch" value={formData.branch_assigned} onChange={(v: string) => setFormData({ ...formData, branch_assigned: v })} 
                            options={[{ value: 'calicut', label: 'Calicut' }, { value: 'cochin', label: 'Cochin' }, { value: 'kannur', label: 'Kannur' }, { value: 'global', label: 'Global' }]} />
                        <SelectField label="Role" value={formData.role} onChange={(v: string) => setFormData({ ...formData, role: v })} 
                            options={[{ value: 'fetsian', label: 'Fetsian' }, { value: 'admin', label: 'Admin' }, { value: 'super_admin', label: 'Super Admin' }]} />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={onClose} className="flex-1 py-3.5 rounded-xl font-semibold" style={{ background: THEME.bgTertiary, color: THEME.textSecondary }}>
                            Cancel
                        </button>
                        <button type="submit" disabled={loading} className="flex-1 py-3.5 rounded-xl font-semibold disabled:opacity-50" style={{ background: THEME.gold, color: THEME.bgPrimary }}>
                            {loading ? 'Creating...' : 'Create Account'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    )
}
