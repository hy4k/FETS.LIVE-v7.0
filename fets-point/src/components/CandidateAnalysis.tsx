import React, { useState, useEffect, useMemo } from 'react';
import {
    Users,
    MapPin,
    TrendingUp,
    RefreshCw,
    Activity,
    Briefcase,
    UserCircle,
    Globe,
    FileSpreadsheet,
    ChevronLeft,
    ChevronRight,
    Download,
    AlertTriangle,
    CheckCircle,
    BookOpen,
    Target,
    X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useBranch } from '../hooks/useBranch';
import { useAuth } from '../hooks/useAuth';
import { formatDateForIST } from '../utils/dateUtils';

interface CandidateAnalysisProps {
    onClose?: () => void;
}

interface CalendarSession {
    id: number;
    date: string;
    client_name: string;
    exam_name: string;
    candidate_count: number;
    branch_location?: string;
}

interface DiscrepancyInfo {
    clientName: string;
    examName: string;
    calendarCount: number;
    registerCount: number;
    difference: number;
    status: 'match' | 'shortage' | 'excess';
}

export const CandidateAnalysis: React.FC<CandidateAnalysisProps> = ({ onClose }) => {
    const { profile } = useAuth();
    const { activeBranch } = useBranch();
    const [loading, setLoading] = useState(true);
    const [candidates, setCandidates] = useState<any[]>([]);
    const [calendarSessions, setCalendarSessions] = useState<CalendarSession[]>([]);
    const [selectedView, setSelectedView] = useState<'overview' | 'staff' | 'discrepancy'>('overview');
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const isGlobalView = activeBranch === 'global' || !activeBranch;

    // Elegant Teal/Cyan Neumorphic Theme
    const neumorphicBase = "bg-gradient-to-br from-[#0a2a2a] to-[#051a1a]";
    const neumorphicCard = "bg-gradient-to-br from-[#0f3535] to-[#082424] shadow-[8px_8px_24px_rgba(0,0,0,0.5),-4px_-4px_16px_rgba(50,150,150,0.02)] rounded-2xl border border-teal-500/10";
    const neumorphicCardLight = "bg-gradient-to-br from-[#134040] to-[#0a2a2a] shadow-[6px_6px_20px_rgba(0,0,0,0.4),-3px_-3px_12px_rgba(50,150,150,0.02)] rounded-xl border border-teal-500/10";
    const neumorphicBtn = "px-5 py-2.5 rounded-xl font-bold transition-all active:scale-95 shadow-[4px_4px_12px_rgba(0,0,0,0.4),-2px_-2px_8px_rgba(50,150,150,0.02)] bg-gradient-to-br from-[#134040] to-[#0a2a2a] text-gray-300 flex items-center gap-2 hover:text-teal-400 border border-teal-500/10";
    const neumorphicBtnActive = "px-5 py-2.5 rounded-xl font-bold transition-all shadow-[inset_4px_4px_12px_rgba(0,0,0,0.5),inset_-2px_-2px_8px_rgba(50,150,150,0.02)] bg-gradient-to-br from-[#0a2a2a] to-[#051a1a] text-teal-400 flex items-center gap-2 border border-teal-500/20";
    const neumorphicInset = "shadow-[inset_4px_4px_12px_rgba(0,0,0,0.5),inset_-2px_-2px_8px_rgba(50,150,150,0.02)] bg-gradient-to-br from-[#082424] to-[#051a1a] rounded-xl border border-teal-500/10";

    // Client color mapping for teal theme
    const clientColors: { [key: string]: { bg: string; text: string; border: string } } = {
        'PROMETRIC': { bg: 'from-rose-600/20 to-rose-800/20', text: 'text-rose-400', border: 'border-rose-500/30' },
        'PSI': { bg: 'from-emerald-600/20 to-emerald-800/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
        'PEARSON': { bg: 'from-sky-600/20 to-sky-800/20', text: 'text-sky-400', border: 'border-sky-500/30' },
        'CELPIP': { bg: 'from-rose-600/20 to-rose-800/20', text: 'text-rose-400', border: 'border-rose-500/30' },
        'ITTS': { bg: 'from-amber-600/20 to-amber-800/20', text: 'text-amber-400', border: 'border-amber-500/30' },
        'OTHER': { bg: 'from-slate-600/20 to-slate-800/20', text: 'text-slate-400', border: 'border-slate-500/30' }
    };

    useEffect(() => {
        fetchData();
    }, [currentMonth, activeBranch]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const monthStart = startOfMonth(currentMonth);
            const monthEnd = endOfMonth(currentMonth);

            // Fetch ALL candidates (from beginning to now) for the selected branch
            let candidateQuery = supabase.from('candidates').select('*');
            
            if (!isGlobalView) {
                candidateQuery = candidateQuery.eq('branch_location', activeBranch);
            }

            const { data: candidateData, error: candidateError } = await candidateQuery.order('created_at', { ascending: false });
            if (candidateError) throw candidateError;

            // Fetch staff profiles for name mapping
            const { data: profiles } = await supabase.from('staff_profiles').select('user_id, full_name');
            const profileMap = (profiles || []).reduce((acc: any, p) => {
                acc[p.user_id] = p.full_name;
                return acc;
            }, {});

            const enrichedCandidates = (candidateData || []).map((c: any) => ({
                ...c,
                staff_name: profileMap[c.user_id] || 'System/Legacy'
            }));

            setCandidates(enrichedCandidates);

            // Fetch calendar sessions for the selected month (for comparison)
            let calendarQuery = supabase
                .from('calendar_sessions')
                .select('*')
                .gte('date', formatDateForIST(monthStart))
                .lte('date', formatDateForIST(monthEnd));

            if (!isGlobalView) {
                calendarQuery = calendarQuery.eq('branch_location', activeBranch);
            }

            const { data: calendarData, error: calendarError } = await calendarQuery;
            if (calendarError) console.warn('Calendar fetch error:', calendarError);

            setCalendarSessions((calendarData as CalendarSession[]) || []);

        } catch (error) {
            console.error('Error fetching analysis data:', error);
            toast.error('Failed to load analysis data');
        } finally {
            setLoading(false);
        }
    };

    const normalizeClientName = (name: string, examName: string = ""): string => {
        const c = (name || '').toUpperCase().trim();
        const e = (examName || '').toUpperCase().trim();

        // 1. CELPIP: seen as CEL, only for CELPIP, no other exam
        if (c.includes('CELPIP') || e.includes('CELPIP') || c.includes('CEL') || e.includes('CEL')) {
            return 'CELPIP';
        }

        // 2. Prometric / PRO: only used for CMA US exam
        if (e.includes('CMA') || c.includes('CMA') || e.includes('IMA') || c.includes('IMA')) {
            return 'PROMETRIC';
        }

        // 3. PSI
        if (c.includes('PSI') || e.includes('PSI')) {
            return 'PSI';
        }

        // 4. Default: all rest of the exams are Pearson VUE
        return 'PEARSON';
    };

    const getClientColor = (client: string) => {
        return clientColors[normalizeClientName(client)] || clientColors['OTHER'];
    };

    const extractLocation = (address: string): string => {
        if (!address) return 'Not Specified';
        const parts = address.split(',');
        // Try to get city (usually second to last or last part)
        if (parts.length >= 2) {
            return parts[parts.length - 2]?.trim() || parts[parts.length - 1]?.trim() || 'Unknown';
        }
        return parts[0]?.trim() || 'Unknown';
    };

    // Filter candidates by current month for comparison
    const monthCandidates = useMemo(() => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);
        return candidates.filter(c => {
            const examDate = c.exam_date ? new Date(c.exam_date) : null;
            if (!examDate) return false;
            return examDate >= monthStart && examDate <= monthEnd;
        });
    }, [candidates, currentMonth]);

    // Calculate comprehensive metrics
    const metrics = useMemo(() => {
        const clientStats: Record<string, number> = {};
        const examStats: Record<string, { count: number; client: string }> = {};
        const locationStats: Record<string, number> = {};
        const staffStats: Record<string, number> = {};
        const monthlyStats: Record<string, { candidates: number; month: string }> = {};

        // Process ALL candidates for totals
        candidates.forEach(c => {
            // Client stats
            const client = normalizeClientName(c.client_name, c.exam_name);
            clientStats[client] = (clientStats[client] || 0) + 1;

            // Exam stats
            const exam = c.exam_name || 'Unknown Exam';
            if (!examStats[exam]) {
                examStats[exam] = { count: 0, client: c.client_name || 'Unknown' };
            }
            examStats[exam].count += 1;

            // Location/Address stats (extract city/district)
            const address = c.address || '';
            const location = extractLocation(address);
            locationStats[location] = (locationStats[location] || 0) + 1;

            // Staff contribution
            const staff = c.staff_name || 'Unknown';
            staffStats[staff] = (staffStats[staff] || 0) + 1;

            // Monthly breakdown
            if (c.exam_date) {
                const monthKey = format(new Date(c.exam_date), 'yyyy-MM');
                const monthLabel = format(new Date(c.exam_date), 'MMM yyyy');
                if (!monthlyStats[monthKey]) {
                    monthlyStats[monthKey] = { candidates: 0, month: monthLabel };
                }
                monthlyStats[monthKey].candidates += 1;
            }
        });

        return {
            clientStats,
            examStats,
            locationStats,
            staffStats,
            monthlyStats,
            totalCandidates: candidates.length,
            monthCandidates: monthCandidates.length
        };
    }, [candidates, monthCandidates]);

    // Calculate discrepancies between Calendar and Register
    const discrepancies = useMemo((): DiscrepancyInfo[] => {
        const calendarMap: Record<string, { client: string; exam: string; count: number }> = {};

        // Group calendar sessions by client + exam
        calendarSessions.forEach(session => {
            const key = `${normalizeClientName(session.client_name, session.exam_name)}_${session.exam_name || 'General'}`;
            if (!calendarMap[key]) {
                calendarMap[key] = {
                    client: normalizeClientName(session.client_name, session.exam_name),
                    exam: session.exam_name || 'General',
                    count: 0
                };
            }
            calendarMap[key].count += session.candidate_count;
        });

        // Group register candidates by client + exam for the same month
        const registerMap: Record<string, number> = {};
        monthCandidates.forEach(c => {
            const key = `${normalizeClientName(c.client_name, c.exam_name)}_${c.exam_name || 'General'}`;
            registerMap[key] = (registerMap[key] || 0) + 1;
        });

        // Build discrepancy list
        const result: DiscrepancyInfo[] = [];
        const allKeys = new Set([...Object.keys(calendarMap), ...Object.keys(registerMap)]);

        allKeys.forEach(key => {
            const calendarEntry = calendarMap[key];
            const registerCount = registerMap[key] || 0;
            const calendarCount = calendarEntry?.count || 0;
            const difference = registerCount - calendarCount;

            if (calendarEntry || registerCount > 0) {
                result.push({
                    clientName: calendarEntry?.client || key.split('_')[0],
                    examName: calendarEntry?.exam || key.split('_')[1] || 'General',
                    calendarCount,
                    registerCount,
                    difference,
                    status: difference === 0 ? 'match' : difference > 0 ? 'excess' : 'shortage'
                });
            }
        });

        return result.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
    }, [calendarSessions, monthCandidates]);



    const navigateMonth = (direction: 'prev' | 'next') => {
        const newDate = new Date(currentMonth);
        if (direction === 'prev') {
            newDate.setMonth(newDate.getMonth() - 1);
        } else {
            newDate.setMonth(newDate.getMonth() + 1);
        }
        setCurrentMonth(newDate);
    };

    const exportReport = () => {
        const monthName = format(currentMonth, 'MMMM yyyy');
        const centerName = isGlobalView ? 'ALL CENTERS' : activeBranch.toUpperCase();

        let report = `
╔══════════════════════════════════════════════════════════════════╗
║              FETS REGISTER ANALYSIS REPORT                        ║
║                    ${centerName.padEnd(20)}                        ║
╚══════════════════════════════════════════════════════════════════╝

Generated: ${new Date().toLocaleString('en-IN')}
Analysis Period: From Beginning to ${format(new Date(), 'dd MMM yyyy')}
Comparison Month: ${monthName}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

                        EXECUTIVE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Candidates (All Time): ${metrics.totalCandidates}
Candidates This Month:       ${metrics.monthCandidates}
Discrepancies Found:         ${discrepancies.filter(d => d.status !== 'match').length}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

                     CLIENT-WISE BREAKDOWN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

        Object.entries(metrics.clientStats)
            .sort(([, a], [, b]) => b - a)
            .forEach(([client, count]) => {
                report += `
  ${client.padEnd(20)}: ${count.toString().padStart(5)} Candidates`;
            });

        report += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

                      EXAM-WISE BREAKDOWN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

        Object.entries(metrics.examStats)
            .sort(([, a], [, b]) => b.count - a.count)
            .slice(0, 15)
            .forEach(([exam, data]) => {
                report += `
  ${exam.substring(0, 30).padEnd(30)}: ${data.count.toString().padStart(5)} (${data.client})`;
            });

        report += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

                    LOCATION-WISE BREAKDOWN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

        Object.entries(metrics.locationStats)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 20)
            .forEach(([location, count]) => {
                report += `
  ${location.substring(0, 25).padEnd(25)}: ${count.toString().padStart(5)} Candidates`;
            });

        if (discrepancies.filter(d => d.status !== 'match').length > 0) {
            report += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

          ⚠️ CALENDAR vs REGISTER DISCREPANCIES (${monthName})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
            discrepancies
                .filter(d => d.status !== 'match')
                .forEach(d => {
                    const status = d.status === 'shortage' ? '❌ SHORTAGE' : '⚠️ EXCESS';
                    report += `
  ${d.clientName} - ${d.examName}
    Calendar: ${d.calendarCount} | Register: ${d.registerCount} | Diff: ${d.difference > 0 ? '+' : ''}${d.difference} ${status}`;
                });
        }

        report += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                         END OF REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

        navigator.clipboard.writeText(report);
        const blob = new Blob([report], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `FETS_Register_Analysis_${isGlobalView ? 'Global' : activeBranch}_${format(currentMonth, 'MMM_yyyy')}.txt`;
        a.click();
        toast.success('Report exported & copied to clipboard!');
    };

    const exportCSV = () => {
        const headers = ['Client', 'Exam', 'Total Candidates', 'Location Distribution'];
        const rows: string[][] = [];

        Object.entries(metrics.examStats)
            .sort(([, a], [, b]) => b.count - a.count)
            .forEach(([exam, data]) => {
                rows.push([
                    normalizeClientName(data.client, exam),
                    exam,
                    data.count.toString(),
                    ''
                ]);
            });

        rows.push([]);
        rows.push(['TOTAL', '', metrics.totalCandidates.toString(), '']);

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `FETS_Register_${isGlobalView ? 'Global' : activeBranch}_Analysis.csv`;
        a.click();
        toast.success('CSV exported!');
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`min-h-[80vh] ${neumorphicBase} rounded-3xl p-8 overflow-hidden`}
            style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
            {/* Ambient Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[150px] -mr-48 -mt-48" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[120px] -ml-32 -mb-32" />
            </div>

            <div className="relative z-10">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
                    <div className="flex items-center gap-6">
                        <button
                            onClick={onClose}
                            className="p-4 rounded-2xl bg-gradient-to-br from-[#134040] to-[#0a2a2a] shadow-[6px_6px_16px_rgba(0,0,0,0.5),-3px_-3px_10px_rgba(50,150,150,0.02)] text-gray-400 hover:text-rose-400 transition-colors active:scale-95 border border-teal-500/10"
                        >
                            <X size={24} />
                        </button>
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight">
                                    Register <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">Analytics</span>
                                </h1>
                                {/* Center Badge */}
                                <div className={`px-4 py-2 rounded-xl font-bold text-sm uppercase tracking-widest ${
                                    isGlobalView 
                                        ? 'bg-gradient-to-br from-purple-500/20 to-purple-600/20 text-purple-400 border border-purple-500/30' 
                                        : 'bg-gradient-to-br from-teal-500/20 to-cyan-500/20 text-teal-400 border border-teal-500/30'
                                }`}>
                                    <div className="flex items-center gap-2">
                                        {isGlobalView ? <Globe size={16} /> : <MapPin size={16} />}
                                        <span>{isGlobalView ? 'All Centers' : activeBranch.charAt(0).toUpperCase() + activeBranch.slice(1)}</span>
                                    </div>
                                </div>
                            </div>
                            <p className="text-gray-400 font-medium">
                                Complete analysis from beginning • Comparison month: {format(currentMonth, 'MMMM yyyy')}
                            </p>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-4">
                        <div className={`${neumorphicInset} px-3 py-2 flex items-center gap-3`}>
                            <button
                                onClick={() => navigateMonth('prev')}
                                className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <span className="text-white font-bold min-w-[140px] text-center text-sm">
                                {format(currentMonth, 'MMMM yyyy')}
                            </span>
                            <button
                                onClick={() => navigateMonth('next')}
                                className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>

                        <button onClick={fetchData} className={`${neumorphicBtn}`}>
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button onClick={exportCSV} className={neumorphicBtn}>
                            <FileSpreadsheet size={18} />
                            CSV
                        </button>
                        <button onClick={exportReport} className={neumorphicBtnActive}>
                            <Download size={18} />
                            Export
                        </button>
                    </div>
                </div>

                {/* View Tabs */}
                <div className={`${neumorphicCard} p-2 flex gap-2 mb-8 w-fit`}>
                    {[
                        { key: 'overview', label: 'Overview', icon: Activity },
                        { key: 'staff', label: 'Staff Contribution', icon: Users },
                        { key: 'discrepancy', label: 'Calendar Match', icon: Target }
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setSelectedView(tab.key as typeof selectedView)}
                            className={`px-5 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${
                                selectedView === tab.key
                                    ? 'bg-gradient-to-br from-teal-500/20 to-cyan-500/20 text-teal-400 shadow-[inset_2px_2px_8px_rgba(0,0,0,0.4)]'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                            {tab.key === 'discrepancy' && discrepancies.filter(d => d.status !== 'match').length > 0 && (
                                <span className="px-2 py-0.5 bg-rose-500/30 text-rose-400 rounded-full text-xs font-bold">
                                    {discrepancies.filter(d => d.status !== 'match').length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32">
                        <div className="relative">
                            <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-700"></div>
                            <div className="animate-spin rounded-full h-16 w-16 border-4 border-teal-500 border-t-transparent absolute inset-0"></div>
                        </div>
                        <p className="text-gray-400 font-bold mt-6 animate-pulse">Analyzing Register Data...</p>
                    </div>
                ) : (
                    <AnimatePresence mode="wait">
                        {selectedView === 'overview' && (
                            <motion.div
                                key="overview"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-8"
                            >
                                {/* KPI Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                    <div className={`${neumorphicCard} p-6 relative overflow-hidden group`}>
                                        <div className="absolute top-0 right-0 p-4 opacity-10 text-teal-500 group-hover:opacity-20 transition-opacity">
                                            <Users size={80} />
                                        </div>
                                        <h3 className="text-gray-500 font-bold uppercase tracking-widest text-xs mb-2">Total Candidates</h3>
                                        <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">
                                            {metrics.totalCandidates}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2 font-medium">All Time Records</p>
                                    </div>

                                    <div className={`${neumorphicCard} p-6 relative overflow-hidden group`}>
                                        <div className="absolute top-0 right-0 p-4 opacity-10 text-cyan-500 group-hover:opacity-20 transition-opacity">
                                            <Briefcase size={80} />
                                        </div>
                                        <h3 className="text-gray-500 font-bold uppercase tracking-widest text-xs mb-2">This Month</h3>
                                        <div className="text-5xl font-black text-cyan-400">
                                            {metrics.monthCandidates}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2 font-medium">{format(currentMonth, 'MMMM yyyy')}</p>
                                    </div>

                                    <div className={`${neumorphicCard} p-6 relative overflow-hidden group`}>
                                        <div className="absolute top-0 right-0 p-4 opacity-10 text-emerald-500 group-hover:opacity-20 transition-opacity">
                                            <BookOpen size={80} />
                                        </div>
                                        <h3 className="text-gray-500 font-bold uppercase tracking-widest text-xs mb-2">Unique Exams</h3>
                                        <div className="text-5xl font-black text-emerald-400">
                                            {Object.keys(metrics.examStats).length}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2 font-medium">Exam Types</p>
                                    </div>

                                    <div className={`${neumorphicCard} p-6 relative overflow-hidden group`}>
                                        <div className="absolute top-0 right-0 p-4 opacity-10 text-amber-500 group-hover:opacity-20 transition-opacity">
                                            <MapPin size={80} />
                                        </div>
                                        <h3 className="text-gray-500 font-bold uppercase tracking-widest text-xs mb-2">Locations</h3>
                                        <div className="text-5xl font-black text-amber-400">
                                            {Object.keys(metrics.locationStats).length}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2 font-medium">Unique Places</p>
                                    </div>
                                </div>

                                {/* Client, Exam, Location Analysis */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    {/* Client Breakdown */}
                                    <div className={`${neumorphicCard} p-8`}>
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="p-2 bg-gradient-to-br from-teal-500/20 to-teal-600/20 rounded-lg text-teal-400">
                                                <Briefcase size={24} />
                                            </div>
                                            <h3 className="text-xl font-black text-white">By Client</h3>
                                        </div>
                                        <div className="space-y-4">
                                            {Object.entries(metrics.clientStats)
                                                .sort(([, a], [, b]) => b - a)
                                                .map(([client, count]) => {
                                                    const color = getClientColor(client);
                                                    return (
                                                        <div key={client} className={`${neumorphicCardLight} p-4`}>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className={`font-bold text-sm ${color.text}`}>{client}</span>
                                                                <span className="text-xl font-black text-white">{count}</span>
                                                            </div>
                                                            <div className="h-2 w-full bg-[#051a1a] rounded-full overflow-hidden">
                                                                <motion.div
                                                                    initial={{ width: 0 }}
                                                                    animate={{ width: `${(count / metrics.totalCandidates) * 100}%` }}
                                                                    transition={{ duration: 0.8 }}
                                                                    className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full"
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </div>

                                    {/* Exam Breakdown */}
                                    <div className={`${neumorphicCard} p-8`}>
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 rounded-lg text-cyan-400">
                                                <BookOpen size={24} />
                                            </div>
                                            <h3 className="text-xl font-black text-white">By Exam</h3>
                                        </div>
                                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                            {Object.entries(metrics.examStats)
                                                .sort(([, a], [, b]) => b.count - a.count)
                                                .slice(0, 10)
                                                .map(([exam, data], idx) => (
                                                    <div key={exam} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-bold text-white truncate">{exam}</p>
                                                            <p className="text-xs text-gray-500">{data.client}</p>
                                                        </div>
                                                        <span className="text-lg font-black text-teal-400 ml-4">{data.count}</span>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>

                                    {/* Location Breakdown */}
                                    <div className={`${neumorphicCard} p-8`}>
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="p-2 bg-gradient-to-br from-amber-500/20 to-amber-600/20 rounded-lg text-amber-400">
                                                <MapPin size={24} />
                                            </div>
                                            <h3 className="text-xl font-black text-white">By Location</h3>
                                        </div>
                                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                            {Object.entries(metrics.locationStats)
                                                .sort(([, a], [, b]) => b - a)
                                                .slice(0, 10)
                                                .map(([location, count], idx) => (
                                                    <div key={location} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                                                        <div className="flex items-center gap-3">
                                                            <span className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-xs font-bold text-amber-400">
                                                                {idx + 1}
                                                            </span>
                                                            <span className="text-sm font-bold text-white">{location}</span>
                                                        </div>
                                                        <span className="text-lg font-black text-amber-400">{count}</span>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Monthly Trend */}
                                <div className={`${neumorphicCard} p-8`}>
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2 bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-lg text-purple-400">
                                            <TrendingUp size={24} />
                                        </div>
                                        <h3 className="text-xl font-black text-white">Monthly Trend</h3>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                        {Object.entries(metrics.monthlyStats)
                                            .sort(([a], [b]) => a.localeCompare(b))
                                            .slice(-6)
                                            .map(([key, data]) => (
                                                <div key={key} className={`${neumorphicCardLight} p-4 text-center`}>
                                                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">{data.month}</p>
                                                    <p className="text-2xl font-black text-teal-400">{data.candidates}</p>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {selectedView === 'staff' && (
                            <motion.div
                                key="staff"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-8"
                            >
                                <div className={`${neumorphicCard} p-8`}>
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2 bg-gradient-to-br from-teal-500/20 to-teal-600/20 rounded-lg text-teal-400">
                                            <Users size={24} />
                                        </div>
                                        <h3 className="text-xl font-black text-white">Staff Data Entry Performance</h3>
                                    </div>
                                    <div className="space-y-4">
                                        {Object.entries(metrics.staffStats)
                                            .sort(([, a], [, b]) => b - a)
                                            .map(([name, count], idx) => (
                                                <div key={name} className={`${neumorphicCardLight} p-5 flex items-center gap-6`}>
                                                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20 flex items-center justify-center relative">
                                                        <UserCircle size={28} className="text-teal-400" />
                                                        {idx < 3 && (
                                                            <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-[#0a2a2a] ${
                                                                idx === 0 ? 'bg-amber-500 text-black' : idx === 1 ? 'bg-gray-300 text-black' : 'bg-amber-700 text-white'
                                                            }`}>
                                                                {idx + 1}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="font-black text-white uppercase text-sm tracking-wider">{name}</p>
                                                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-0.5">FETS Data Agent</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-3xl font-black text-teal-400">{count}</p>
                                                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">Entries</p>
                                                    </div>
                                                    <div className="w-32 h-3 bg-[#051a1a] rounded-full overflow-hidden">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${(count / metrics.totalCandidates) * 100}%` }}
                                                            transition={{ duration: 0.8, delay: idx * 0.1 }}
                                                            className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {selectedView === 'discrepancy' && (
                            <motion.div
                                key="discrepancy"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-8"
                            >
                                {/* Summary Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className={`${neumorphicCard} p-6`}>
                                        <div className="flex items-center gap-3 mb-4">
                                            <CheckCircle size={24} className="text-emerald-400" />
                                            <span className="text-gray-400 font-bold uppercase text-xs">Matched</span>
                                        </div>
                                        <p className="text-4xl font-black text-emerald-400">
                                            {discrepancies.filter(d => d.status === 'match').length}
                                        </p>
                                    </div>
                                    <div className={`${neumorphicCard} p-6`}>
                                        <div className="flex items-center gap-3 mb-4">
                                            <AlertTriangle size={24} className="text-rose-400" />
                                            <span className="text-gray-400 font-bold uppercase text-xs">Shortage</span>
                                        </div>
                                        <p className="text-4xl font-black text-rose-400">
                                            {discrepancies.filter(d => d.status === 'shortage').length}
                                        </p>
                                    </div>
                                    <div className={`${neumorphicCard} p-6`}>
                                        <div className="flex items-center gap-3 mb-4">
                                            <TrendingUp size={24} className="text-amber-400" />
                                            <span className="text-gray-400 font-bold uppercase text-xs">Excess</span>
                                        </div>
                                        <p className="text-4xl font-black text-amber-400">
                                            {discrepancies.filter(d => d.status === 'excess').length}
                                        </p>
                                    </div>
                                </div>

                                {/* Discrepancy Table */}
                                <div className={`${neumorphicCard} p-8`}>
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-gradient-to-br from-rose-500/20 to-rose-600/20 rounded-lg text-rose-400">
                                                <Target size={24} />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-white">Calendar vs Register Comparison</h3>
                                                <p className="text-xs text-gray-500">Comparing {format(currentMonth, 'MMMM yyyy')} data</p>
                                            </div>
                                        </div>
                                    </div>

                                    {discrepancies.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-16">
                                            <CheckCircle size={48} className="text-emerald-400 mb-4" />
                                            <p className="text-lg font-bold text-white">No data to compare</p>
                                            <p className="text-gray-500 text-sm">No calendar sessions or register entries found for this month</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="border-b border-white/10">
                                                        <th className="text-left py-4 px-4 font-bold text-gray-500 text-xs uppercase tracking-wider">Client</th>
                                                        <th className="text-left py-4 px-4 font-bold text-gray-500 text-xs uppercase tracking-wider">Exam</th>
                                                        <th className="text-center py-4 px-4 font-bold text-gray-500 text-xs uppercase tracking-wider">Calendar</th>
                                                        <th className="text-center py-4 px-4 font-bold text-gray-500 text-xs uppercase tracking-wider">Register</th>
                                                        <th className="text-center py-4 px-4 font-bold text-gray-500 text-xs uppercase tracking-wider">Difference</th>
                                                        <th className="text-center py-4 px-4 font-bold text-gray-500 text-xs uppercase tracking-wider">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {discrepancies.map((d, idx) => {
                                                        const color = getClientColor(d.clientName);
                                                        return (
                                                            <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                                <td className="py-4 px-4">
                                                                    <span className={`font-bold ${color.text}`}>{d.clientName}</span>
                                                                </td>
                                                                <td className="py-4 px-4 text-gray-300 text-sm">{d.examName}</td>
                                                                <td className="text-center py-4 px-4 text-gray-400 font-medium">{d.calendarCount}</td>
                                                                <td className="text-center py-4 px-4 text-gray-400 font-medium">{d.registerCount}</td>
                                                                <td className="text-center py-4 px-4">
                                                                    <span className={`font-black ${
                                                                        d.difference === 0 ? 'text-emerald-400' :
                                                                        d.difference > 0 ? 'text-amber-400' : 'text-rose-400'
                                                                    }`}>
                                                                        {d.difference > 0 ? '+' : ''}{d.difference}
                                                                    </span>
                                                                </td>
                                                                <td className="text-center py-4 px-4">
                                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                                                                        d.status === 'match' ? 'bg-emerald-500/20 text-emerald-400' :
                                                                        d.status === 'excess' ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'
                                                                    }`}>
                                                                        {d.status}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {/* Alert for mismatches */}
                                {discrepancies.filter(d => d.status === 'shortage').length > 0 && (
                                    <div className={`${neumorphicCard} p-6 border-l-4 border-rose-500`}>
                                        <div className="flex items-center gap-4">
                                            <AlertTriangle size={24} className="text-rose-400" />
                                            <div>
                                                <h4 className="font-bold text-rose-400">Action Required</h4>
                                                <p className="text-gray-400 text-sm">
                                                    {discrepancies.filter(d => d.status === 'shortage').length} exam(s) show fewer registered candidates than scheduled in the calendar. 
                                                    Please verify the register entries are complete.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}
            </div>
        </motion.div>
    );
};
