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
import { currentRosterMonthKey } from '../utils/rosterVisibility'
import { ClientControl } from './ClientControl'
import { useAppModules } from '../hooks/useAppModules'

const PERMISSION_KEYS = [
    { key: 'is_roster_active', label: 'Include in Roster (Current Month)', icon: Users, description: 'Keep enabled for active staff. Disable to hide staff from the duty roster for the rest of the current month — they automatically return next month.' },
    { key: 'can_edit_roster', label: 'Roster Management Authority', icon: Users, description: 'Create and edit staff rosters' },
    { key: 'user_management_edit', label: 'User Management Authority', icon: Shield, description: 'Manage user profiles, roles and critical permissions' },
]

// Premium Classic Theme - Dark Slate with Gold Accents
const THEME = {
    bgPrimary: '#0f1419',
    bgSecondary: '#1a2332',
    bgTertiary: '#243044',
    bgCard: '#1e2a3a',
    bgHover: '#2a3a4d',
    gold: '#d4a853',
    goldLight: '#e8c47a',
    goldDark: '#b8923f',
    goldMuted: 'rgba(212, 168, 83, 0.15)',
    textPrimary: '#f8fafc',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    border: 'rgba(255, 255, 255, 0.08)',
    borderLight: 'rgba(255, 255, 255, 0.12)',
    shadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
    shadowGold: '0 0 30px rgba(212, 168, 83, 0.2)',
}

interface UserManagementProps {
    onNavigate?: (tab: string) => void;
}

export function UserManagement({ onNavigate }: UserManagementProps = {}) {
    const { profile: currentUser } = useAuth()
    const { data: staff = [] } = useStaff()
    const { updateStaff, archiveStaff } = useStaffMutations()

    const [searchTerm, setSearchTerm] = useState('')
    const [branchFilter, setBranchFilter] = useState<string>('all')
    const [mainTab] = useState<'users' | 'clients' | 'modules'>('users')

    const [selectedUser, setSelectedUser] = useState<StaffProfile | null>(null)
    const [activeTab, setActiveTab] = useState<'profile' | 'employment' | 'growth' | 'permissions'>('profile')
    const [isSaving, setIsSaving] = useState(false)

    const [formData, setFormData] = useState<Partial<StaffProfile>>({})
    const [permissions, setPermissions] = useState<Record<string, boolean>>({})

    useEffect(() => {
        if (selectedUser) {
            setFormData({ ...selectedUser })
            const currentPerms = (selectedUser.permissions as Record<string, boolean>) || {}
            if (currentPerms.is_roster_active === undefined) {
                currentPerms.is_roster_active = true
            }
            setPermissions(currentPerms)
            setActiveTab('profile')
        }
    }, [selectedUser])

    const filteredStaff = useMemo(() => {
        return staff.filter(s => {
            if (s.is_active === false) return false
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

    const isSuperAdmin = currentUser?.email ? isMithunEmail(currentUser.email) || (currentUser?.role === 'super_admin') : false;

    if (!isSuperAdmin) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-8" style={{ background: THEME.bgPrimary }}>
                <h2 className="text-xl font-bold text-white">Super Admin Access Only</h2>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex flex-col p-6" style={{ background: THEME.bgPrimary }}>
            <div className="max-w-[1600px] w-full mx-auto flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-3xl font-black text-white" style={{ fontFamily: "'Playfair Display', serif" }}>User Management & Roster Authority</h1>
                        <p className="text-xs text-slate-400 mt-1">Manage staff profiles, permissions, and temporary monthly roster exclusions.</p>
                    </div>
                </div>

                <div className="flex-1 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 min-h-0">
                    {/* Staff List Sidebar */}
                    <aside className="flex flex-col rounded-2xl overflow-hidden border" style={{ background: THEME.bgSecondary, borderColor: THEME.border }}>
                        <div className="p-4 border-b space-y-3" style={{ borderColor: THEME.border }}>
                            <div className="relative">
                                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: THEME.textMuted }} />
                                <input
                                    type="text"
                                    placeholder="Search staff..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm focus:outline-none"
                                    style={{ background: THEME.bgTertiary, color: THEME.textPrimary, border: `1px solid ${THEME.border}` }}
                                />
                            </div>

                            <div className="flex gap-1 flex-wrap">
                                {['all', 'calicut', 'cochin', 'kannur'].map(branch => (
                                    <button
                                        key={branch}
                                        onClick={() => setBranchFilter(branch)}
                                        className="px-3 py-1.5 rounded-md text-xs font-semibold uppercase transition-all"
                                        style={{
                                            background: branchFilter === branch ? THEME.gold : THEME.bgTertiary,
                                            color: branchFilter === branch ? THEME.bgPrimary : THEME.textSecondary
                                        }}
                                    >
                                        {branch}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {filteredStaff.map(user => {
                                const isRosterActive = (user.permissions as any)?.is_roster_active !== false && (user as any).is_roster_active !== false;
                                return (
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
                                            <div className="flex items-center justify-between gap-1">
                                                <p className="font-semibold text-sm truncate" style={{ color: THEME.textPrimary }}>
                                                    {user.full_name}
                                                </p>
                                                {!isRosterActive && (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                                        Off Roster
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs truncate" style={{ color: THEME.textMuted }}>{user.email}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded uppercase" style={{ background: THEME.bgCard, color: THEME.textSecondary }}>
                                                    {formatBranchName(user.branch_assigned || 'global')}
                                                </span>
                                            </div>
                                        </div>
                                    </motion.button>
                                )
                            })}
                        </div>
                    </aside>

                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col min-w-0">
                        {selectedUser ? (
                            <motion.div
                                key={selectedUser.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="h-full flex flex-col rounded-2xl overflow-hidden border"
                                style={{ background: THEME.bgSecondary, borderColor: THEME.border }}
                            >
                                {/* Header */}
                                <div className="p-6 flex items-center gap-6 border-b" style={{ borderColor: THEME.border, background: THEME.bgCard }}>
                                    <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold shrink-0" style={{ background: THEME.gold, color: THEME.bgPrimary }}>
                                        {selectedUser.full_name.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h2 className="text-2xl font-bold truncate" style={{ color: THEME.textPrimary }}>{formData.full_name}</h2>
                                        <div className="flex flex-wrap items-center gap-4 mt-2" style={{ color: THEME.textSecondary }}>
                                            <span className="flex items-center gap-1.5 text-sm"><Mail size={14} /> {formData.email}</span>
                                            <span className="flex items-center gap-1.5 text-sm"><Briefcase size={14} /> {(formData.role || '').toUpperCase()}</span>
                                            <span className="flex items-center gap-1.5 text-sm"><MapPin size={14} /> {formatBranchName(formData.branch_assigned || 'global')}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button onClick={handleSave} disabled={isSaving} className="px-5 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2" style={{ background: THEME.gold, color: THEME.bgPrimary }}>
                                            <Save size={16} /> {isSaving ? 'Saving...' : 'Save Changes'}
                                        </button>
                                        <button onClick={handleDeleteUser} className="p-2.5 rounded-lg text-red-400 bg-red-500/10">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                {/* Tabs */}
                                <div className="flex px-6 border-b" style={{ borderColor: THEME.border }}>
                                    {['profile', 'employment', 'permissions'].map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(tab as any)}
                                            className="px-5 py-4 font-semibold text-sm capitalize transition-all"
                                            style={{ color: activeTab === tab ? THEME.gold : THEME.textSecondary }}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                </div>

                                {/* Tab Body */}
                                <div className="flex-1 overflow-y-auto p-6">
                                    <div className="max-w-3xl space-y-5">
                                        {activeTab === 'profile' && (
                                            <div className="grid grid-cols-2 gap-5">
                                                <div>
                                                    <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Full Name</label>
                                                    <input value={formData.full_name || ''} onChange={e => setFormData({ ...formData, full_name: e.target.value })} className="w-full p-3 rounded-lg bg-slate-800 text-white border border-slate-700" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Contact Number</label>
                                                    <input value={formData.contact_number || ''} onChange={e => setFormData({ ...formData, contact_number: e.target.value })} className="w-full p-3 rounded-lg bg-slate-800 text-white border border-slate-700" />
                                                </div>
                                            </div>
                                        )}

                                        {activeTab === 'employment' && (
                                            <div className="space-y-5">
                                                <div className="grid grid-cols-2 gap-5">
                                                    <div>
                                                        <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Role</label>
                                                        <select value={formData.role || 'fetsian'} onChange={e => setFormData({ ...formData, role: e.target.value })} className="w-full p-3 rounded-lg bg-slate-800 text-white border border-slate-700">
                                                            <option value="fetsian">Fetsian</option>
                                                            <option value="admin">Admin</option>
                                                            <option value="super_admin">Super Admin</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Branch</label>
                                                        <select value={formData.branch_assigned || 'calicut'} onChange={e => setFormData({ ...formData, branch_assigned: e.target.value })} className="w-full p-3 rounded-lg bg-slate-800 text-white border border-slate-700">
                                                            <option value="calicut">Calicut</option>
                                                            <option value="cochin">Cochin</option>
                                                            <option value="kannur">Kannur</option>
                                                            <option value="global">Global</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* Temporary Monthly Roster Exclusion Toggle */}
                                                <div className="p-4 rounded-xl border flex items-center justify-between bg-slate-800/80 border-slate-700">
                                                    <div>
                                                        <p className="text-sm font-semibold text-white">Include in Roster (Current Month)</p>
                                                        <p className="text-xs text-slate-400 mt-0.5">Toggle off to hide this staff member from the duty roster for the rest of the current month — they automatically return next month, or re-enable anytime.</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const currentVal = permissions['is_roster_active'] !== false;
                                                            const updatedPerms: Record<string, any> = { ...permissions, is_roster_active: !currentVal };
                                                            if (currentVal) {
                                                                // Turning OFF — stamp the exclusion with the current month so it auto-expires next month
                                                                updatedPerms.roster_excluded_month = currentRosterMonthKey();
                                                            } else {
                                                                // Turning ON — clear any month stamp
                                                                delete updatedPerms.roster_excluded_month;
                                                            }
                                                            setPermissions(updatedPerms);
                                                            setFormData({ ...formData, permissions: updatedPerms });
                                                        }}
                                                        className={`w-12 h-6 rounded-full p-1 transition-colors relative ${
                                                            (permissions['is_roster_active'] !== false) ? 'bg-amber-500' : 'bg-slate-700'
                                                        }`}
                                                    >
                                                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                                                            (permissions['is_roster_active'] !== false) ? 'translate-x-6' : 'translate-x-0'
                                                        }`} />
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {activeTab === 'permissions' && (
                                            <div className="space-y-3">
                                                {PERMISSION_KEYS.map((perm) => {
                                                    const isEnabled = permissions[perm.key] !== false;
                                                    return (
                                                        <button
                                                            key={perm.key}
                                                            onClick={() => setPermissions(prev => {
                                                                const next: Record<string, any> = { ...prev, [perm.key]: !prev[perm.key] };
                                                                if (perm.key === 'is_roster_active') {
                                                                    if (next.is_roster_active === false) next.roster_excluded_month = currentRosterMonthKey();
                                                                    else delete next.roster_excluded_month;
                                                                }
                                                                return next;
                                                            })}
                                                            className="w-full p-4 rounded-xl text-left transition-all flex items-center gap-4 bg-slate-800/80 border border-slate-700"
                                                        >
                                                            <div className="flex-1">
                                                                <p className="font-semibold text-white">{perm.label}</p>
                                                                <p className="text-xs text-slate-400 mt-0.5">{perm.description}</p>
                                                            </div>
                                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isEnabled ? 'border-amber-400 bg-amber-400' : 'border-slate-500'}`}>
                                                                {isEnabled && <div className="w-2 h-2 rounded-full bg-slate-900" />}
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
                            <div className="h-full flex items-center justify-center text-slate-500 font-bold">Select a staff member to view profile and roster settings.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
