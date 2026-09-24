import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Plus, X, Heart, MessageSquare, Send, CheckCircle2,
    AlertCircle, Sparkles, Filter, Search, Share2, Bookmark, Check,
    Clock, MapPin, Tag, Shield, Award, Users, Grid, List, Eye,
    FileText, Video, Image as ImageIcon, ExternalLink, Calendar,
    AlertTriangle, Megaphone, CheckSquare, RefreshCw, Trash2
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useBranch } from '../hooks/useBranch';
import { useSocialPosts, useCreatePost, useToggleLike, useAddComment, useDeletePost, useUploadImage, SocialPost } from '../hooks/useSocial';
import { StaffStories } from './StaffStories';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';

// Exam Center Categories
export type ExamNoticeCategory = 
    | 'Desk Notice' 
    | 'New Exam' 
    | 'Action Required' 
    | 'Test Drive' 
    | 'By The Way' 
    | 'Appreciation';

interface NoticeItem {
    id: string;
    title: string;
    category: ExamNoticeCategory;
    content: string;
    priority?: 'urgent' | 'high' | 'normal';
    effectiveDate?: string;
    eventWindow?: string;
    clientName?: string;
    branch_location?: string;
    authorName: string;
    authorRole: string;
    authorAvatar?: string;
    created_at: string;
    image_url?: string;
    video_url?: string;
    checklist?: string[];
    rules?: { label: string; value: string }[];
    likesCount: number;
    commentsCount: number;
    comments?: any[];
    isOfficial?: boolean;
    isCustomPost?: boolean;
}

// Built-in Exam Center Operational Notices (matching the attached documents)
const OFFICIAL_EXAM_NOTICES: NoticeItem[] = [
    {
        id: 'notice-uat-uk-2026',
        title: 'PVTC EVENT DESK NOTICE: UAT UK OCTOBER EVENT',
        category: 'New Exam',
        priority: 'urgent',
        eventWindow: '12 - 16 OCTOBER 2026',
        clientName: 'Pearson VUE / UAT UK',
        branch_location: 'global',
        authorName: 'FETS Operations Lead',
        authorRole: 'Head of Testing Services',
        created_at: '2026-10-01T08:00:00Z',
        isOfficial: true,
        content: 'Action Required for All Staff: Staff readiness notice for the upcoming UAT UK exam event window. Your site may test on some or all dates during this session.',
        checklist: [
            "Today's UAT UK bookings confirmed in Connect schedule",
            'Client Reference reviewed by assigned test administrator',
            'Note boards, booklets and pens verified and stocked',
            'Earplug rule understood by all check-in staff',
            'Only approved note materials will be issued (5 single sheets or 1 booklet)',
            'Extra materials ready for progression during active testing'
        ],
        rules: [
            { label: 'CANDIDATE MAY CALL IT', value: '"The entrance exam for Imperial / Cambridge / Durham / LSE / Warwick / UCL / Oxford"' },
            { label: 'CANDIDATE ITEM EXCEPTION', value: 'Personal earplugs are allowed. No approved accommodation required (Ref section 2.1).' },
            { label: 'APPROVED NOTE MATERIALS', value: 'Issue 5 single sheets or 1 booklet. NEVER issue plain paper or whiteboards.' }
        ],
        likesCount: 18,
        commentsCount: 4,
        comments: [
            { id: 'c1', authorName: 'Aysha K', content: 'Calicut lab supply of note boards verified. 45 booklets stocked.', created_at: '2026-10-02T09:30:00Z' },
            { id: 'c2', authorName: 'Niyas P', content: 'Connect Client Reference downloaded and printed at reception.', created_at: '2026-10-02T11:15:00Z' }
        ]
    },
    {
        id: 'notice-high-sec-logsheet',
        title: 'PVTC DESK NOTICE: USE THE HIGH SECURITY LOG SHEET (A4)',
        category: 'Desk Notice',
        priority: 'urgent',
        effectiveDate: 'EFFECTIVE IMMEDIATELY',
        clientName: 'Pearson VUE PVTC',
        branch_location: 'global',
        authorName: 'Mithun M',
        authorRole: 'Exam Centre Administrator',
        created_at: '2026-09-20T06:30:00Z',
        isOfficial: true,
        content: 'For every applicable Pearson exam delivery. The log sheet is the formal record of what was checked, issued, returned, and signed. It confirms manual ID checks and maintains strict candidate chain of custody.',
        checklist: [
            'Correct High Security (A4) sheet printed from Connect Portal Support Materials',
            'Administrator records Test Admin name, Primary ID & Secondary ID type and number',
            'Candidate enters full name, Exam Series Number, and signs Candidate Rules Agreement',
            'All erasable note boards and exam exhibits accounted for and returned at sign-out'
        ],
        rules: [
            { label: '1. GET CORRECT SHEET', value: 'Connect Portal → Resources → Support materials → Test Center Materials → Log sheets' },
            { label: '2. COMPLETE AT CHECK-IN', value: 'Admin completes right side (ID checks & admin name); Candidate completes left side (signature & time)' },
            { label: '3. CLOSE THE RECORD', value: 'Verify return of erasable note boards and exam materials before candidate departure' }
        ],
        likesCount: 24,
        commentsCount: 3,
        comments: [
            { id: 'c3', authorName: 'Linofer S', content: 'A4 sheets printed and pre-sorted at check-in desks 1 and 2.', created_at: '2026-09-21T07:45:00Z' }
        ]
    },
    {
        id: 'notice-test-drive',
        title: 'EXAM TEST DRIVE: ENHANCING EXAM-DAY CONFIDENCE',
        category: 'Test Drive',
        priority: 'high',
        clientName: 'FORUN Educational & Testing Services',
        branch_location: 'global',
        authorName: 'FETS Outreach',
        authorRole: 'Candidate Experience Team',
        created_at: '2026-09-15T10:00:00Z',
        isOfficial: true,
        content: 'Orientation program allowing candidates to experience the test center before actual exam day. Familiarizes candidates with security screening, locker assignment, biometric check-in, and the 4-hour real-time test interface.',
        checklist: [
            'Locker assignment & body screening walkthrough',
            'ID verification & biometric capture rehearsal',
            'Exposure to real exam-like question format & workstation orientation',
            'Reduce candidate stress and eliminate test-day surprises'
        ],
        rules: [
            { label: 'FACILITY BOOKING', value: 'Schedule Test Drive slots 48 hours prior to official exam windows.' },
            { label: 'CANDIDATE BRIEFING', value: 'Provide walkthrough of workstation layout, noise-canceling headsets, and timer display.' }
        ],
        likesCount: 15,
        commentsCount: 2,
        comments: [
            { id: 'c4', authorName: 'Anshitha K', content: 'Next test drive batch scheduled for Saturday 10:00 AM.', created_at: '2026-09-16T14:20:00Z' }
        ]
    }
];

export function FetsLiveBoard({ branch, onNavigate }: { branch?: string; onNavigate?: (page: string) => void }) {
    const { user, profile } = useAuth();
    const { activeBranch } = useBranch();
    const currentBranch = branch || activeBranch || 'global';

    // Filters and view modes
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [branchFilter, setBranchFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'notices' | 'media'>('notices');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedNotice, setSelectedNotice] = useState<NoticeItem | null>(null);

    // Social Posts Hook
    const { data: rawPosts, isLoading, refetch } = useSocialPosts();
    const toggleLike = useToggleLike();
    const deletePost = useDeletePost();

    // Local acknowledgments / fast reactions
    const [acknowledgedPosts, setAcknowledgedPosts] = useState<Record<string, boolean>>({});

    // Map database posts into NoticeItem format
    const dbNotices: NoticeItem[] = useMemo(() => {
        if (!rawPosts) return [];
        return rawPosts.map((p: SocialPost) => {
            let cat: ExamNoticeCategory = 'By The Way';
            const typeStr = (p.post_type || '').toLowerCase();
            if (typeStr.includes('notice') || typeStr.includes('bulletin')) cat = 'Desk Notice';
            else if (typeStr.includes('exam') || typeStr.includes('session')) cat = 'New Exam';
            else if (typeStr.includes('task') || typeStr.includes('action')) cat = 'Action Required';
            else if (typeStr.includes('drive') || typeStr.includes('prep')) cat = 'Test Drive';
            else if (typeStr.includes('appreciation')) cat = 'Appreciation';

            // Extract lines or checklists if content has markdown bullets
            const lines = (p.content || '').split('\n').filter(Boolean);
            const bullets = lines.filter(l => l.trim().startsWith('-') || l.trim().startsWith('•') || l.trim().startsWith('✓'));
            const checklist = bullets.map(b => b.replace(/^[-•✓*]\s*/, ''));

            return {
                id: p.id,
                title: lines[0]?.slice(0, 80) || 'Staff Notice',
                category: cat,
                content: p.content,
                priority: p.pinned ? 'urgent' : 'normal',
                branch_location: p.branch_location || 'global',
                authorName: p.user?.full_name || 'Staff Member',
                authorRole: p.user?.role || 'Testing Staff',
                authorAvatar: p.user?.avatar_url,
                created_at: p.created_at,
                image_url: p.image_url,
                video_url: p.video_url,
                checklist: checklist.length > 0 ? checklist : undefined,
                likesCount: p._count?.likes || 0,
                commentsCount: p._count?.comments || 0,
                comments: p.comments?.map(c => ({
                    id: c.id,
                    authorName: c.user?.full_name || 'Staff Member',
                    authorAvatar: c.user?.avatar_url,
                    content: c.content,
                    created_at: c.created_at
                })),
                isCustomPost: true
            };
        });
    }, [rawPosts]);

    // Combined list: custom DB posts first, then official notices
    const allNotices: NoticeItem[] = useMemo(() => {
        return [...dbNotices, ...OFFICIAL_EXAM_NOTICES];
    }, [dbNotices]);

    // Filtered notices
    const filteredNotices = useMemo(() => {
        return allNotices.filter(item => {
            const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
            const matchesBranch = branchFilter === 'all' || 
                item.branch_location === 'global' || 
                (item.branch_location || '').toLowerCase() === branchFilter.toLowerCase();
            const matchesSearch = !searchQuery || 
                item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.authorName.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCategory && matchesBranch && matchesSearch;
        });
    }, [allNotices, selectedCategory, branchFilter, searchQuery]);

    const handleAcknowledge = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setAcknowledgedPosts(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
        toast.success(acknowledgedPosts[id] ? 'Acknowledgment removed' : 'Notice acknowledged & signed! ✓');
    };

    const handleLike = (item: NoticeItem, e: React.MouseEvent) => {
        e.stopPropagation();
        if (item.isCustomPost && user?.id) {
            toggleLike.mutate({
                post_id: item.id,
                user_id: user.id,
                isLiked: false
            });
        } else {
            toast.success('Appreciated! ❤️');
        }
    };

    const getCategoryBadge = (cat: ExamNoticeCategory) => {
        switch (cat) {
            case 'Desk Notice':
                return { bg: 'bg-rose-500/15 text-rose-300 border-rose-500/30', icon: Megaphone, label: 'PVTC DESK NOTICE' };
            case 'New Exam':
                return { bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', icon: Calendar, label: 'EXAM EVENT' };
            case 'Action Required':
                return { bg: 'bg-amber-500/15 text-amber-300 border-amber-500/30', icon: AlertTriangle, label: 'ACTION REQUIRED' };
            case 'Test Drive':
                return { bg: 'bg-sky-500/15 text-sky-300 border-sky-500/30', icon: Award, label: 'TEST DRIVE' };
            case 'Appreciation':
                return { bg: 'bg-purple-500/15 text-purple-300 border-purple-500/30', icon: Heart, label: 'STAFF KUDOS' };
            case 'By The Way':
            default:
                return { bg: 'bg-slate-500/15 text-slate-300 border-slate-500/30', icon: Sparkles, label: 'BY THE WAY' };
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-24 selection:bg-amber-500 selection:text-black">
            {/* Ambient Background Glow */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-30">
                <div className="absolute top-10 left-1/4 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-3xl" />
                <div className="absolute top-60 right-1/4 w-[600px] h-[600px] bg-sky-500/10 rounded-full blur-3xl" />
            </div>

            {/* Top Bar Header */}
            <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-8 py-3.5 shadow-md">
                <div className="max-w-[1500px] mx-auto flex items-center justify-between gap-4">
                    {/* Back button & Brand Title */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => onNavigate ? onNavigate('live') : window.history.back()}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 text-slate-300 hover:text-white hover:border-slate-500 transition-all text-xs font-bold"
                            title="Return to Command Centre"
                        >
                            <ArrowLeft size={16} />
                            <span>Command Centre</span>
                        </button>

                        <div className="h-5 w-px bg-slate-800 hidden sm:block" />

                        <div className="flex items-center gap-2.5">
                            <span className="flex h-2.5 w-2.5 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                            </span>
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                                        FETS <span className="text-amber-400">LIVE</span>
                                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                                            OPERATIONS BOARD
                                        </span>
                                    </h1>
                                </div>
                                <span className="text-[11px] text-slate-400 hidden md:inline">
                                    Exam Updates, Desk Notices, Task Broadcasts &amp; Staff Pulse
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-2.5">
                        {/* View Switch */}
                        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 hidden sm:flex">
                            <button
                                onClick={() => setViewMode('notices')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                                    viewMode === 'notices'
                                        ? 'bg-slate-800 text-white shadow'
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                                title="Desk Notice View"
                            >
                                <List size={13} />
                                <span>Notices</span>
                            </button>
                            <button
                                onClick={() => setViewMode('media')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                                    viewMode === 'media'
                                        ? 'bg-slate-800 text-white shadow'
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                                title="Visual Media Grid View"
                            >
                                <Grid size={13} />
                                <span>Media</span>
                            </button>
                        </div>

                        {/* Publish / Post Button */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all"
                        >
                            <Plus size={16} />
                            <span>Post Notice / BTW</span>
                        </motion.button>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="max-w-[1500px] mx-auto px-4 sm:px-8 pt-6 space-y-6">
                {/* Staff Duty & Presence Capsule Bar (Replaced repetitive round story bubbles) */}
                <section>
                    <StaffStories onSelectStaff={(s) => setSearchQuery(s.full_name || '')} />
                </section>

                {/* Filter and Search Bar */}
                <section className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
                    {/* Category Tabs */}
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full md:w-auto pb-1 md:pb-0">
                        {[
                            { id: 'all', label: 'All Updates', icon: Sparkles },
                            { id: 'Desk Notice', label: '📢 Desk Notices', icon: Megaphone },
                            { id: 'New Exam', label: '🎓 New Exams', icon: Calendar },
                            { id: 'Action Required', label: '⚡ Action Tasks', icon: AlertTriangle },
                            { id: 'Test Drive', label: '🚗 Test Drive', icon: Award },
                            { id: 'By The Way', label: '💬 By The Way', icon: MessageSquare }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setSelectedCategory(tab.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                                    selectedCategory === tab.id
                                        ? 'bg-amber-400 text-slate-950 shadow-md font-extrabold'
                                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                                }`}
                            >
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Search & Branch Pill */}
                    <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
                        {/* Branch Selector */}
                        <select
                            value={branchFilter}
                            onChange={(e) => setBranchFilter(e.target.value)}
                            aria-label="Filter by center"
                            className="bg-slate-800 text-slate-200 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold outline-none focus:border-amber-400"
                        >
                            <option value="all">🏢 All Centres</option>
                            <option value="calicut">Calicut Centre</option>
                            <option value="cochin">Cochin Centre</option>
                        </select>

                        {/* Search Input */}
                        <div className="relative flex-1 sm:w-60">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search notices, exams, tasks..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-800/90 text-slate-100 placeholder-slate-400 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs outline-none focus:border-amber-400 transition-colors"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    </div>
                </section>

                {/* Notices Feed / Grid */}
                {viewMode === 'notices' ? (
                    <section className="space-y-4">
                        {filteredNotices.length === 0 ? (
                            <div className="py-20 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/30">
                                <Megaphone size={36} className="mx-auto text-slate-500 mb-3" />
                                <h3 className="text-base font-bold text-slate-300">No notices found</h3>
                                <p className="text-xs text-slate-500 mt-1">Try selecting a different filter or search term</p>
                            </div>
                        ) : (
                            filteredNotices.map((notice) => {
                                const catMeta = getCategoryBadge(notice.category);
                                const isAcked = acknowledgedPosts[notice.id];

                                return (
                                    <motion.article
                                        key={notice.id}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        onClick={() => setSelectedNotice(notice)}
                                        className={`rounded-2xl border transition-all cursor-pointer overflow-hidden ${
                                            notice.priority === 'urgent'
                                                ? 'bg-slate-900/90 border-rose-500/40 hover:border-rose-400 shadow-lg shadow-rose-950/20'
                                                : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 shadow-md'
                                        }`}
                                    >
                                        {/* Colored Header Strip */}
                                        <div className={`px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b ${
                                            notice.priority === 'urgent'
                                                ? 'bg-gradient-to-r from-rose-950/60 via-slate-900 to-slate-900 border-rose-500/30'
                                                : 'bg-slate-900/90 border-slate-800/80'
                                        }`}>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-md border flex items-center gap-1.5 ${catMeta.bg}`}>
                                                    <catMeta.icon size={11} />
                                                    {catMeta.label}
                                                </span>
                                                {notice.eventWindow && (
                                                    <span className="text-[11px] font-mono font-bold text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                                                        🗓️ {notice.eventWindow}
                                                    </span>
                                                )}
                                                {notice.effectiveDate && (
                                                    <span className="text-[10px] font-mono font-bold text-rose-300 bg-rose-500/15 px-2 py-0.5 rounded border border-rose-500/30 animate-pulse">
                                                        ⚠️ {notice.effectiveDate}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-3 text-xs text-slate-400">
                                                <span className="font-mono text-[11px]">
                                                    {notice.created_at ? format(new Date(notice.created_at), 'MMM dd, yyyy') : 'Today'}
                                                </span>
                                                <span className="text-[10px] bg-slate-800 font-mono px-1.5 py-0.5 rounded text-slate-300 border border-slate-700">
                                                    {(notice.branch_location || 'GLOBAL').toUpperCase()}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Notice Body */}
                                        <div className="p-4 sm:p-6 space-y-4">
                                            {/* Title & Author */}
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <h2 className="text-lg sm:text-xl font-black text-white tracking-tight leading-snug">
                                                        {notice.title}
                                                    </h2>
                                                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                                                        <span className="font-bold text-amber-400">{notice.authorName}</span>
                                                        <span>·</span>
                                                        <span>{notice.authorRole}</span>
                                                        {notice.clientName && (
                                                            <>
                                                                <span>·</span>
                                                                <span className="text-slate-300 font-semibold">{notice.clientName}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Priority Badge */}
                                                {notice.priority === 'urgent' && (
                                                    <span className="flex-shrink-0 text-[10px] font-black bg-rose-600 text-white px-2 py-1 rounded-lg tracking-wider uppercase shadow">
                                                        ACTION REQUIRED
                                                    </span>
                                                )}
                                            </div>

                                            {/* Description Text */}
                                            <p className="text-sm text-slate-300 leading-relaxed font-normal whitespace-pre-line">
                                                {notice.content}
                                            </p>

                                            {/* Structured Rules Boxes (if present, like PVTC Desk Notice) */}
                                            {notice.rules && notice.rules.length > 0 && (
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                                                    {notice.rules.map((rule, idx) => (
                                                        <div key={idx} className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                                                            <div className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider mb-1">
                                                                {rule.label}
                                                            </div>
                                                            <div className="text-xs text-slate-200 font-medium">
                                                                {rule.value}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Checklist Box (if present) */}
                                            {notice.checklist && notice.checklist.length > 0 && (
                                                <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3.5 space-y-2">
                                                    <div className="text-[11px] font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                                                        <CheckSquare size={13} />
                                                        <span>Ready = Programme-Ready Checklist</span>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                                                        {notice.checklist.map((item, idx) => (
                                                            <div key={idx} className="flex items-start gap-2">
                                                                <Check size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                                                                <span>{item}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Media Banner (Image or Video) */}
                                            {notice.image_url && (
                                                <div className="rounded-xl overflow-hidden max-h-96 border border-slate-800 bg-slate-950">
                                                    <img
                                                        src={notice.image_url}
                                                        alt={notice.title}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            )}

                                            {/* Footer Actions: Responses, Acknowledge, Share */}
                                            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-3">
                                                <div className="flex items-center gap-2">
                                                    {/* Sign / Acknowledge Button */}
                                                    <button
                                                        onClick={(e) => handleAcknowledge(notice.id, e)}
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                                            isAcked
                                                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                                                        }`}
                                                    >
                                                        <CheckCircle2 size={14} className={isAcked ? 'text-emerald-400' : 'text-slate-400'} />
                                                        <span>{isAcked ? 'Signed & Acknowledged' : 'Sign & Acknowledge'}</span>
                                                    </button>

                                                    {/* Like Button */}
                                                    <button
                                                        onClick={(e) => handleLike(notice, e)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-rose-400 transition-all text-xs font-bold border border-slate-700"
                                                    >
                                                        <Heart size={14} />
                                                        <span>{notice.likesCount}</span>
                                                    </button>

                                                    {/* Comments Count */}
                                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/60 text-slate-400 text-xs font-medium border border-slate-800">
                                                        <MessageSquare size={14} />
                                                        <span>{notice.commentsCount} staff replies</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                                                    <span>Click to view full notice &amp; reply</span>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.article>
                                );
                            })
                        )}
                    </section>
                ) : (
                    /* Visual Media Grid View (Flyers, Photos, Visual Updates) */
                    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filteredNotices.map((notice) => {
                            const catMeta = getCategoryBadge(notice.category);
                            return (
                                <motion.div
                                    key={notice.id}
                                    whileHover={{ y: -3 }}
                                    onClick={() => setSelectedNotice(notice)}
                                    className="bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-2xl overflow-hidden cursor-pointer shadow-md flex flex-col justify-between"
                                >
                                    <div className="p-4 space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <span className={`text-[9.5px] font-black uppercase px-2 py-0.5 rounded border ${catMeta.bg}`}>
                                                {catMeta.label}
                                            </span>
                                            <span className="text-[10px] font-mono text-slate-400">
                                                {(notice.branch_location || 'GLOBAL').toUpperCase()}
                                            </span>
                                        </div>
                                        <h3 className="text-base font-bold text-white leading-snug line-clamp-2">
                                            {notice.title}
                                        </h3>
                                        <p className="text-xs text-slate-400 line-clamp-3">
                                            {notice.content}
                                        </p>
                                    </div>

                                    {notice.image_url ? (
                                        <div className="aspect-video bg-slate-950 overflow-hidden border-t border-slate-800">
                                            <img
                                                src={notice.image_url}
                                                alt={notice.title}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    ) : (
                                        <div className="aspect-video bg-gradient-to-br from-slate-950 via-slate-900 to-slate-850 p-4 border-t border-slate-800 flex flex-col justify-center items-center text-center">
                                            <FileText size={28} className="text-slate-600 mb-2" />
                                            <span className="text-xs font-bold text-slate-400">{notice.authorName}</span>
                                            <span className="text-[10px] text-slate-500">{notice.authorRole}</span>
                                        </div>
                                    )}

                                    <div className="p-3 bg-slate-950/70 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                                        <span className="flex items-center gap-1 font-bold">
                                            <Heart size={12} className="text-rose-400" /> {notice.likesCount}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <MessageSquare size={12} /> {notice.commentsCount}
                                        </span>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </section>
                )}
            </main>

            {/* Notice Detail & Staff Discussion Modal */}
            <AnimatePresence>
                {selectedNotice && (
                    <NoticeDetailModal
                        notice={selectedNotice}
                        onClose={() => setSelectedNotice(null)}
                        currentUser={user}
                        profile={profile}
                        onRefetch={refetch}
                    />
                )}
            </AnimatePresence>

            {/* Create Post / Notice Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <CreateNoticeModal
                        onClose={() => setShowCreateModal(false)}
                        onSuccess={() => {
                            setShowCreateModal(false);
                            refetch();
                        }}
                        currentUser={user}
                        profile={profile}
                        activeBranch={currentBranch}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// Notice Detail & Staff Discussion Modal
function NoticeDetailModal({
    notice,
    onClose,
    currentUser,
    profile,
    onRefetch
}: {
    notice: NoticeItem;
    onClose: () => void;
    currentUser: any;
    profile: any;
    onRefetch: () => void;
}) {
    const [replyText, setReplyText] = useState('');
    const addComment = useAddComment();

    const handleSendComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyText.trim()) return;

        if (notice.isCustomPost) {
            await addComment.mutateAsync({
                post_id: notice.id,
                user_id: currentUser?.id,
                author_id: profile?.id || currentUser?.id,
                content: replyText.trim()
            });
            setReplyText('');
            onRefetch();
        } else {
            // For built-in official notice, append local reply
            notice.comments = notice.comments || [];
            notice.comments.push({
                id: `local-${Date.now()}`,
                authorName: profile?.full_name || currentUser?.user_metadata?.full_name || 'You',
                content: replyText.trim(),
                created_at: new Date().toISOString()
            });
            notice.commentsCount += 1;
            setReplyText('');
            toast.success('Response logged for shift! 💬');
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            >
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                            {notice.category}
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                            {(notice.branch_location || 'GLOBAL').toUpperCase()}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Scrollable Notice Content */}
                <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
                    <h2 className="text-xl font-black text-white">{notice.title}</h2>
                    <div className="flex items-center gap-2 text-xs text-slate-400 pb-2 border-b border-slate-800">
                        <span className="font-bold text-amber-400">{notice.authorName}</span>
                        <span>·</span>
                        <span>{notice.authorRole}</span>
                        <span>·</span>
                        <span>{notice.created_at ? format(new Date(notice.created_at), 'PPP') : 'Today'}</span>
                    </div>

                    <p className="text-sm text-slate-200 whitespace-pre-line leading-relaxed">
                        {notice.content}
                    </p>

                    {notice.rules && notice.rules.length > 0 && (
                        <div className="space-y-2 pt-2">
                            <span className="text-xs font-mono font-bold text-amber-400 uppercase">Specific Rules &amp; Directives</span>
                            <div className="space-y-2">
                                {notice.rules.map((rule, idx) => (
                                    <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                                        <div className="text-[10px] font-mono text-amber-400 font-bold">{rule.label}</div>
                                        <div className="text-xs text-slate-300 mt-0.5">{rule.value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {notice.checklist && notice.checklist.length > 0 && (
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                            <span className="text-xs font-mono font-bold text-emerald-400 uppercase flex items-center gap-1.5">
                                <CheckSquare size={13} />
                                <span>Checklist Requirements</span>
                            </span>
                            <div className="space-y-1.5 text-xs text-slate-300">
                                {notice.checklist.map((item, idx) => (
                                    <div key={idx} className="flex items-start gap-2">
                                        <Check size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                                        <span>{item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {notice.image_url && (
                        <div className="rounded-xl overflow-hidden border border-slate-800">
                            <img src={notice.image_url} alt="" className="w-full object-cover" />
                        </div>
                    )}

                    {/* Staff Comments Section */}
                    <div className="pt-4 border-t border-slate-800 space-y-3">
                        <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                            <MessageSquare size={13} className="text-amber-400" />
                            <span>Staff Discussions &amp; Acknowledgments ({notice.comments?.length || 0})</span>
                        </span>

                        <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                            {(notice.comments || []).length === 0 ? (
                                <p className="text-xs text-slate-500 italic">No responses yet. Be the first to acknowledge.</p>
                            ) : (
                                notice.comments?.map((comment: any, idx: number) => (
                                    <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 flex flex-col gap-1">
                                        <div className="flex items-center justify-between text-[11px]">
                                            <span className="font-bold text-amber-300">{comment.authorName}</span>
                                            <span className="text-slate-500 font-mono text-[10px]">
                                                {comment.created_at ? format(new Date(comment.created_at), 'hh:mm a') : 'Now'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-200">{comment.content}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Reply Form */}
                <form onSubmit={handleSendComment} className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 flex gap-2">
                    <input
                        type="text"
                        placeholder="Reply, confirm readiness, or ask a question..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400"
                    />
                    <button
                        type="submit"
                        disabled={!replyText.trim() || addComment.isPending}
                        className="px-4 py-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow"
                    >
                        <Send size={13} />
                        <span>Reply</span>
                    </button>
                </form>
            </motion.div>
        </div>
    );
}

// Create Notice Modal
function CreateNoticeModal({
    onClose,
    onSuccess,
    currentUser,
    profile,
    activeBranch
}: {
    onClose: () => void;
    onSuccess: () => void;
    currentUser: any;
    profile: any;
    activeBranch: string;
}) {
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState<ExamNoticeCategory>('Desk Notice');
    const [content, setContent] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [isUrgent, setIsUrgent] = useState(false);
    const [targetBranch, setTargetBranch] = useState(activeBranch || 'global');
    const [uploading, setUploading] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const createPost = useCreatePost();
    const uploadImage = useUploadImage();

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setUploading(true);
            const url = await uploadImage.mutateAsync(file);
            setImageUrl(url);
        } catch (err) {
            // If storage fails, convert to base64 data url for preview
            const reader = new FileReader();
            reader.onload = () => {
                setImageUrl(reader.result as string);
                toast.success('Image ready! 📸');
            };
            reader.readAsDataURL(file);
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() && !title.trim()) {
            toast.error('Please enter notice content');
            return;
        }

        const fullContent = title.trim() 
            ? `${title.trim()}\n\n${content.trim()}`
            : content.trim();

        try {
            await createPost.mutateAsync({
                content: fullContent,
                image_url: imageUrl || undefined,
                user_id: currentUser?.id,
                author_id: profile?.id || currentUser?.id,
                post_type: category,
                branch_location: targetBranch,
                pinned: isUrgent,
                visibility: targetBranch === 'global' ? 'all' : 'branch'
            });
            onSuccess();
        } catch (err: any) {
            console.error('Failed to post notice:', err);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-4"
            >
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                        <Megaphone size={18} className="text-amber-400" />
                        <h2 className="text-lg font-black text-white">Broadcast Exam Center Notice</h2>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-white">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Category Selector */}
                    <div>
                        <label className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                            Notice Category
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                'Desk Notice',
                                'New Exam',
                                'Action Required',
                                'Test Drive',
                                'By The Way',
                                'Appreciation'
                            ].map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setCategory(cat as ExamNoticeCategory)}
                                    className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all border text-center ${
                                        category === cat
                                            ? 'bg-amber-400 text-slate-950 border-amber-300 font-extrabold shadow'
                                            : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Notice Subject / Title */}
                    <div>
                        <label className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Notice Headline / Title
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. PVTC Desk Notice: New Calculator Policy for Pearson"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400"
                        />
                    </div>

                    {/* Notice Content / Description */}
                    <div>
                        <label className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Details, Instructions &amp; Checklists
                        </label>
                        <textarea
                            rows={4}
                            placeholder="Enter the official details, guidelines, rules, or anything new you want to tell staff..."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400 resize-none"
                        />
                    </div>

                    {/* Image / Attachment Upload */}
                    <div>
                        <label className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Attachment (Notice Flyer, Photo or Reference Image)
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="file"
                                accept="image/*"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 flex items-center gap-1.5 transition-all"
                            >
                                <ImageIcon size={14} />
                                <span>{uploading ? 'Uploading...' : 'Upload Image / Flyer'}</span>
                            </button>
                            <input
                                type="text"
                                placeholder="Or paste image URL..."
                                value={imageUrl}
                                onChange={(e) => setImageUrl(e.target.value)}
                                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400"
                            />
                        </div>
                        {imageUrl && (
                            <div className="mt-2 relative w-20 h-20 rounded-xl overflow-hidden border border-slate-700">
                                <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                                <button
                                    type="button"
                                    onClick={() => setImageUrl('')}
                                    className="absolute top-1 right-1 p-0.5 bg-black/80 rounded-full text-white"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Target Branch & Urgent Flag */}
                    <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-slate-300 font-bold">Target Center:</label>
                            <select
                                value={targetBranch}
                                onChange={(e) => setTargetBranch(e.target.value)}
                                className="bg-slate-950 text-slate-200 border border-slate-700 rounded-xl px-2.5 py-1 text-xs font-bold outline-none"
                            >
                                <option value="global">All Centres (Global)</option>
                                <option value="calicut">Calicut Centre</option>
                                <option value="cochin">Cochin Centre</option>
                            </select>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isUrgent}
                                onChange={(e) => setIsUrgent(e.target.checked)}
                                className="w-4 h-4 rounded text-rose-500 focus:ring-0 bg-slate-950 border-slate-700"
                            />
                            <span className="text-xs font-bold text-rose-400">Mark Action Required</span>
                        </label>
                    </div>

                    {/* Submit Button */}
                    <div className="pt-2 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={createPost.isPending || uploading}
                            className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
                        >
                            <Send size={14} />
                            <span>{createPost.isPending ? 'Publishing...' : 'Broadcast Notice'}</span>
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}

export default FetsLiveBoard;
