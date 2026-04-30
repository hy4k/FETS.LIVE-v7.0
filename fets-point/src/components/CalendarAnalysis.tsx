import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Download,
    FileSpreadsheet,
    Calendar,
    Users,
    Clock,
    AlertTriangle,
    CheckCircle,
    TrendingUp,
    Building,
    ChevronLeft,
    ChevronRight,
    Layers,
    Timer,
    Zap,
    FileText,
    Globe,
    MapPin
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { formatDateForIST } from '../utils/dateUtils';
import { getBranchCapacity } from '../utils/sessionUtils';

interface CalendarAnalysisProps {
    onClose: () => void;
    activeBranch: string;
}

interface CalendarSession {
    id: number;
    date: string;
    start_time: string;
    end_time: string;
    client_name: string;
    candidate_count: number;
    exam_name: string;
    branch_location?: string;
}

interface ClientAnalysis {
    clientName: string;
    totalCandidates: number;
    sessionCount: number;
    branches: {
        [branch: string]: {
            candidates: number;
            sessions: number;
        };
    };
    weeklyBreakdown: {
        weekNumber: number;
        weekStart: string;
        weekEnd: string;
        candidates: number;
    }[];
}

interface OverlapInfo {
    date: string;
    branch: string;
    sessions: CalendarSession[];
    conflictPeriods: {
        start: string;
        end: string;
        candidates: number;
        capacity: number;
        excessCandidates: number;
        sessions: CalendarSession[];
    }[];
    totalCandidates: number;
    capacity: number;
    excessCandidates: number;
    suggestions: string[];
}

export const CalendarAnalysis: React.FC<CalendarAnalysisProps> = ({ onClose, activeBranch }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [sessions, setSessions] = useState<CalendarSession[]>([]);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedView, setSelectedView] = useState<'overview' | 'clients' | 'overlaps'>('overview');

    // Elegant Neumorphic Styles with Rich Colors
    const neumorphicBase = "bg-gradient-to-br from-[#1a3a3d] to-[#0d1d1f]";
    const neumorphicCard = "bg-gradient-to-br from-[#27575b] to-[#1a3a3d] shadow-[8px_8px_24px_rgba(0,0,0,0.4),-4px_-4px_16px_rgba(255,255,255,0.03)] rounded-2xl border border-white/5";
    const neumorphicCardLight = "bg-gradient-to-br from-[#388087] to-[#27575b] shadow-[6px_6px_20px_rgba(0,0,0,0.35),-3px_-3px_12px_rgba(255,255,255,0.02)] rounded-xl border border-white/5";
    const neumorphicBtn = "px-5 py-2.5 rounded-xl font-bold transition-all active:scale-95 shadow-[4px_4px_12px_rgba(0,0,0,0.3),-2px_-2px_8px_rgba(255,255,255,0.02)] bg-gradient-to-br from-[#388087] to-[#27575b] text-gray-300 flex items-center gap-2 hover:text-[#92cdb3] border border-white/5";
    const neumorphicBtnActive = "px-5 py-2.5 rounded-xl font-bold transition-all shadow-[inset_4px_4px_12px_rgba(0,0,0,0.4),inset_-2px_-2px_8px_rgba(255,255,255,0.02)] bg-gradient-to-br from-[#27575b] to-[#1a3a3d] text-[#92cdb3] flex items-center gap-2 border border-[#92cdb3]/20";
    const neumorphicInset = "shadow-[inset_4px_4px_12px_rgba(0,0,0,0.4),inset_-2px_-2px_8px_rgba(255,255,255,0.02)] bg-gradient-to-br from-[#1a3a3d] to-[#0d1d1f] rounded-xl border border-white/5";

    // Client color mapping
    const clientColors: { [key: string]: { bg: string; text: string; border: string } } = {
        'PEARSON': { bg: 'from-[#FFD633]/20 to-[#FFD633]/10', text: 'text-[#FFD633]', border: 'border-[#FFD633]/30' },
        'PSI': { bg: 'from-[#FFD633]/20 to-[#FFD633]/10', text: 'text-[#FFD633]', border: 'border-[#FFD633]/30' },
        'PROMETRIC': { bg: 'from-[#FFD633]/20 to-[#FFD633]/10', text: 'text-[#FFD633]', border: 'border-[#FFD633]/30' },
        'ITTS': { bg: 'from-[#FFD633]/20 to-[#FFD633]/10', text: 'text-[#FFD633]', border: 'border-[#FFD633]/30' },
        'OTHER': { bg: 'from-[#FFD633]/20 to-[#FFD633]/10', text: 'text-[#FFD633]', border: 'border-[#FFD633]/30' }
    };

    useEffect(() => {
        fetchSessionData();
    }, [currentMonth, activeBranch]);

    const isGlobalView = activeBranch === 'global' || !activeBranch;

    const fetchSessionData = async () => {
        setLoading(true);
        try {
            const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
            const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

            let query = supabase
                .from('calendar_sessions')
                .select('*')
                .gte('date', formatDateForIST(startOfMonth))
                .lte('date', formatDateForIST(endOfMonth))
                .order('date', { ascending: true })
                .order('start_time', { ascending: true });

            // Filter by branch if a specific center is selected (not global view)
            if (!isGlobalView) {
                query = query.eq('branch_location', activeBranch);
            }

            const { data, error } = await query;

            if (error) throw error;
            
            // For legacy data without branch_location, default to calicut
            let filteredData = (data as CalendarSession[]) || [];
            
            // If specific branch selected but no branch_location column exists, 
            // handle fallback for legacy Calicut data
            if (!isGlobalView && activeBranch === 'calicut' && filteredData.length === 0) {
                // Retry without branch filter for legacy data
                const fallbackQuery = supabase
                    .from('calendar_sessions')
                    .select('*')
                    .gte('date', formatDateForIST(startOfMonth))
                    .lte('date', formatDateForIST(endOfMonth))
                    .order('date', { ascending: true })
                    .order('start_time', { ascending: true });
                
                const { data: fallbackData } = await fallbackQuery;
                if (fallbackData) {
                    // Only include sessions without branch_location (legacy) or calicut
                    filteredData = (fallbackData as CalendarSession[]).filter(
                        s => !s.branch_location || s.branch_location === 'calicut'
                    );
                }
            }
            
            setSessions(filteredData);
        } catch (error) {
            console.error('Error fetching session data:', error);
            toast.error('Failed to load session data');
        } finally {
            setLoading(false);
        }
    };

    const normalizeClientName = (name: string): string => {
        const upper = name.toUpperCase();
        if (upper.includes('PEARSON') || upper.includes('VUE')) return 'PEARSON';
        if (upper.includes('PSI')) return 'PSI';
        if (upper.includes('PROMETRIC')) return 'PROMETRIC';
        if (upper.includes('ITTS')) return 'ITTS';
        return 'OTHER';
    };

    const getClientColor = (client: string) => {
        return clientColors[normalizeClientName(client)] || clientColors['OTHER'];
    };

    // Helper functions - must be defined before useMemo hooks
    const timeToMinutes = (time: string): number => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    };

    const minutesToTime = (minutes: number): string => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    };

    const getWeekNumber = (date: Date): number => {
        const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        const dayOfMonth = date.getDate();
        const firstDayWeekday = firstDayOfMonth.getDay();
        return Math.ceil((dayOfMonth + firstDayWeekday) / 7);
    };

    const getWeekRange = (date: Date): { start: string; end: string } => {
        const day = date.getDay();
        const start = new Date(date);
        start.setDate(date.getDate() - day);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);

        return {
            start: start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
            end: end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
        };
    };

    const formatDateLabel = (date: string): string => {
        return new Date(date).toLocaleDateString('en-IN', {
            weekday: 'short',
            day: '2-digit',
            month: 'short'
        });
    };

    const getBranchLabel = (branch: string): string => {
        return branch.charAt(0).toUpperCase() + branch.slice(1);
    };

    // Calculate client-wise analysis with center breakdown
    const clientAnalysis = useMemo((): ClientAnalysis[] => {
        const clientMap: { [key: string]: ClientAnalysis } = {};

        sessions.forEach(session => {
            const normalizedClient = normalizeClientName(session.client_name);
            const branch = session.branch_location || 'calicut';

            if (!clientMap[normalizedClient]) {
                clientMap[normalizedClient] = {
                    clientName: normalizedClient,
                    totalCandidates: 0,
                    sessionCount: 0,
                    branches: {},
                    weeklyBreakdown: []
                };
            }

            clientMap[normalizedClient].totalCandidates += session.candidate_count;
            clientMap[normalizedClient].sessionCount += 1;

            if (!clientMap[normalizedClient].branches[branch]) {
                clientMap[normalizedClient].branches[branch] = { candidates: 0, sessions: 0 };
            }
            clientMap[normalizedClient].branches[branch].candidates += session.candidate_count;
            clientMap[normalizedClient].branches[branch].sessions += 1;
        });

        // Calculate weekly breakdown for each client
        Object.keys(clientMap).forEach(clientKey => {
            const clientSessions = sessions.filter(s => normalizeClientName(s.client_name) === clientKey);
            const weeklyMap: { [key: number]: { candidates: number; weekStart: string; weekEnd: string } } = {};

            clientSessions.forEach(session => {
                const date = new Date(session.date);
                const weekNumber = getWeekNumber(date);
                const { start, end } = getWeekRange(date);

                if (!weeklyMap[weekNumber]) {
                    weeklyMap[weekNumber] = { candidates: 0, weekStart: start, weekEnd: end };
                }
                weeklyMap[weekNumber].candidates += session.candidate_count;
            });

            clientMap[clientKey].weeklyBreakdown = Object.entries(weeklyMap)
                .map(([week, data]) => ({
                    weekNumber: parseInt(week),
                    weekStart: data.weekStart,
                    weekEnd: data.weekEnd,
                    candidates: data.candidates
                }))
                .sort((a, b) => a.weekNumber - b.weekNumber);
        });

        return Object.values(clientMap).sort((a, b) => b.totalCandidates - a.totalCandidates);
    }, [sessions]);

    // Calculate overlap analysis from actual concurrent exam timings and branch seat capacity.
    const overlapAnalysis = useMemo((): OverlapInfo[] => {
        const branchDateMap: { [key: string]: CalendarSession[] } = {};

        sessions.forEach(session => {
            const branch = session.branch_location || 'calicut';
            const key = `${session.date}__${branch}`;
            if (!branchDateMap[key]) branchDateMap[key] = [];
            branchDateMap[key].push(session);
        });

        const overlaps: OverlapInfo[] = [];

        Object.entries(branchDateMap).forEach(([key, daySessions]) => {
            const [date, branch] = key.split('__');
            const capacity = getBranchCapacity(branch);
            const timePoints = Array.from(new Set(daySessions.flatMap(session => [
                timeToMinutes(session.start_time),
                timeToMinutes(session.end_time)
            ]))).sort((a, b) => a - b);

            const conflictPeriods: OverlapInfo['conflictPeriods'] = [];

            for (let i = 0; i < timePoints.length - 1; i++) {
                const start = timePoints[i];
                const end = timePoints[i + 1];
                if (start === end) continue;

                const activeSessions = daySessions.filter(session => {
                    const sessionStart = timeToMinutes(session.start_time);
                    const sessionEnd = timeToMinutes(session.end_time);
                    return sessionStart < end && sessionEnd > start;
                });

                const concurrentCandidates = activeSessions.reduce((sum, session) => sum + session.candidate_count, 0);
                if (concurrentCandidates > capacity) {
                    conflictPeriods.push({
                        start: minutesToTime(start),
                        end: minutesToTime(end),
                        candidates: concurrentCandidates,
                        capacity,
                        excessCandidates: concurrentCandidates - capacity,
                        sessions: activeSessions.sort((a, b) => a.start_time.localeCompare(b.start_time))
                    });
                }
            }

            if (conflictPeriods.length === 0) return;

            const maxLoad = Math.max(...conflictPeriods.map(period => period.candidates));
            const maxExcess = Math.max(...conflictPeriods.map(period => period.excessCandidates));
            const conflictingSessions = Array.from(
                new Map(conflictPeriods.flatMap(period => period.sessions).map(session => [session.id, session])).values()
            ).sort((a, b) => a.start_time.localeCompare(b.start_time));
            const firstConflict = conflictPeriods[0];

            overlaps.push({
                date,
                branch,
                sessions: conflictingSessions,
                conflictPeriods,
                totalCandidates: maxLoad,
                capacity,
                excessCandidates: maxExcess,
                suggestions: [
                    `${getBranchLabel(branch)} has ${capacity} seats. During ${firstConflict.start}-${firstConflict.end}, ${firstConflict.candidates} candidates are scheduled at the same time.`,
                    `Move or stagger at least ${maxExcess} candidate${maxExcess === 1 ? '' : 's'} from the highlighted overlapping time window.`,
                    'Check the listed exam timings before adding another session in the same interval.'
                ]
            });
        });

        return overlaps.sort((a, b) => {
            if (b.excessCandidates !== a.excessCandidates) return b.excessCandidates - a.excessCandidates;
            return a.date.localeCompare(b.date);
        });
    }, [sessions]);

    // Calculate totals
    const totals = useMemo(() => {
        const byBranch: { [branch: string]: { candidates: number; sessions: number } } = {};
        let totalCandidates = 0;
        const totalSessions = sessions.length;

        sessions.forEach(session => {
            const branch = session.branch_location || 'calicut';
            if (!byBranch[branch]) {
                byBranch[branch] = { candidates: 0, sessions: 0 };
            }
            byBranch[branch].candidates += session.candidate_count;
            byBranch[branch].sessions += 1;
            totalCandidates += session.candidate_count;
        });

        // Weekly totals
        const weeklyTotals: { week: number; weekStart: string; weekEnd: string; candidates: number; sessions: number }[] = [];
        const weekMap: { [week: number]: { candidates: number; sessions: number; weekStart: string; weekEnd: string } } = {};

        sessions.forEach(session => {
            const date = new Date(session.date);
            const week = getWeekNumber(date);
            const { start, end } = getWeekRange(date);
            if (!weekMap[week]) {
                weekMap[week] = { candidates: 0, sessions: 0, weekStart: start, weekEnd: end };
            }
            weekMap[week].candidates += session.candidate_count;
            weekMap[week].sessions += 1;
        });

        Object.entries(weekMap).forEach(([week, data]) => {
            weeklyTotals.push({ week: parseInt(week), ...data });
        });

        const dailyMap: {
            [date: string]: {
                booked: number;
                seats: number;
                sessions: number;
                branches: { [branch: string]: { booked: number; seats: number; sessions: number } };
            };
        } = {};

        sessions.forEach(session => {
            const branch = session.branch_location || 'calicut';
            if (!dailyMap[session.date]) {
                dailyMap[session.date] = { booked: 0, seats: 0, sessions: 0, branches: {} };
            }
            if (!dailyMap[session.date].branches[branch]) {
                dailyMap[session.date].branches[branch] = {
                    booked: 0,
                    seats: getBranchCapacity(branch),
                    sessions: 0
                };
                dailyMap[session.date].seats += getBranchCapacity(branch);
            }
            dailyMap[session.date].booked += session.candidate_count;
            dailyMap[session.date].sessions += 1;
            dailyMap[session.date].branches[branch].booked += session.candidate_count;
            dailyMap[session.date].branches[branch].sessions += 1;
        });

        const dailyBreakdown = Object.entries(dailyMap)
            .map(([date, data]) => ({ date, ...data }))
            .sort((a, b) => a.date.localeCompare(b.date));

        return {
            totalCandidates,
            totalSessions,
            byBranch,
            weeklyTotals: weeklyTotals.sort((a, b) => a.week - b.week),
            dailyBreakdown
        };
    }, [sessions]);

    // Export functions
    const exportAsCSV = () => {
        const headers = ['Client', 'Branch', 'Total Candidates', 'Sessions', 'Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];
        const rows: string[][] = [];

        clientAnalysis.forEach(client => {
            Object.entries(client.branches).forEach(([branch, data]) => {
                const weekData = [1, 2, 3, 4, 5].map(w => {
                    const week = client.weeklyBreakdown.find(wb => wb.weekNumber === w);
                    return week ? week.candidates.toString() : '0';
                });

                rows.push([
                    client.clientName,
                    branch.toUpperCase(),
                    data.candidates.toString(),
                    data.sessions.toString(),
                    ...weekData
                ]);
            });
        });

        // Add totals row
        rows.push([]);
        rows.push(['TOTALS', '', totals.totalCandidates.toString(), totals.totalSessions.toString(), ...totals.weeklyTotals.map(w => w.candidates.toString())]);

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `FETS_Invoice_${isGlobalView ? 'Global' : activeBranch.charAt(0).toUpperCase() + activeBranch.slice(1)}_${currentMonth.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }).replace(' ', '_')}.csv`;
        a.click();
        toast.success('CSV exported for invoice generation!');
    };

    const exportDetailedReport = () => {
        const monthName = currentMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        const centerName = isGlobalView ? 'ALL CENTERS (GLOBAL)' : activeBranch.toUpperCase();

        let report = `
╔══════════════════════════════════════════════════════════════════╗
║                    FETS EXAMINATION INVOICE REPORT                ║
║                         ${monthName.toUpperCase().padStart(20)}                        ║
║                    CENTER: ${centerName.padStart(20)}                        ║
╚══════════════════════════════════════════════════════════════════╝

Generated: ${new Date().toLocaleString('en-IN')}
Center:    ${isGlobalView ? 'All Centers (Combined)' : activeBranch.charAt(0).toUpperCase() + activeBranch.slice(1)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

                        EXECUTIVE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Candidates:     ${totals.totalCandidates}
Total Sessions:       ${totals.totalSessions}
Overlap Alerts:       ${overlapAnalysis.length}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

                     CLIENT-WISE BREAKDOWN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

        clientAnalysis.forEach(client => {
            report += `
┌─────────────────────────────────────────────────────────────────┐
│  ${client.clientName.padEnd(20)} Total: ${client.totalCandidates} Candidates (${client.sessionCount} Sessions)
├─────────────────────────────────────────────────────────────────┤
│  BY CENTER:
`;
            Object.entries(client.branches).forEach(([branch, data]) => {
                report += `│    ${branch.toUpperCase().padEnd(15)} │ ${data.candidates.toString().padStart(4)} Candidates │ ${data.sessions} Sessions
`;
            });

            report += `├─────────────────────────────────────────────────────────────────┤
│  WEEKLY BREAKDOWN:
`;
            client.weeklyBreakdown.forEach(week => {
                report += `│    ${week.weekStart} - ${week.weekEnd}: ${week.candidates} Candidates
`;
            });

            report += `└─────────────────────────────────────────────────────────────────┘
`;
        });

        report += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

                       DAILY BREAKDOWN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

        totals.dailyBreakdown.forEach(day => {
            report += `
  ${formatDateLabel(day.date).padEnd(12)}: ${day.booked.toString().padStart(5)} booked / ${day.seats} seats | ${day.sessions} Sessions`;
            Object.entries(day.branches).forEach(([branch, data]) => {
                report += `
      ${branch.toUpperCase().padEnd(10)} ${data.booked.toString().padStart(4)} / ${data.seats} seats`;
            });
        });

        report += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

                      WEEKLY TOTALS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

        totals.weeklyTotals.forEach(week => {
            report += `
  ${week.weekStart} - ${week.weekEnd}: ${week.candidates.toString().padStart(5)} Candidates | ${week.sessions} Sessions`;
        });

        if (overlapAnalysis.length > 0) {
            report += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

                     ⚠️ OVERLAP ALERTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
            overlapAnalysis.forEach(overlap => {
                const dateStr = new Date(overlap.date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
                report += `
  ${dateStr}:
    • Branch: ${getBranchLabel(overlap.branch)}
    • Peak Concurrent Candidates: ${overlap.totalCandidates} (Seats: ${overlap.capacity})
    • Peak Excess Load: ${overlap.excessCandidates} candidates
    • Conflict Windows:
${overlap.conflictPeriods.map(period => `      - ${period.start}-${period.end}: ${period.candidates}/${period.capacity} candidates (${period.excessCandidates} excess)`).join('\n')}
    • Recommendations:
${overlap.suggestions.map(s => `      → ${s}`).join('\n')}
`;
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
        a.download = `FETS_Report_${isGlobalView ? 'Global' : activeBranch.charAt(0).toUpperCase() + activeBranch.slice(1)}_${currentMonth.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }).replace(' ', '_')}.txt`;
        a.click();
        toast.success('Detailed report exported & copied to clipboard!');
    };

    const navigateMonth = (direction: 'prev' | 'next') => {
        const newDate = new Date(currentMonth);
        if (direction === 'prev') {
            newDate.setMonth(newDate.getMonth() - 1);
        } else {
            newDate.setMonth(newDate.getMonth() + 1);
        }
        setCurrentMonth(newDate);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-50 ${neumorphicBase} overflow-hidden`}
            style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
            {/* Ambient Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#92cdb3]/5 rounded-full blur-[150px] -mr-64 -mt-64" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] -ml-48 -mb-48" />
                <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-purple-500/3 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2" />
            </div>

            <div className="relative h-full flex flex-col max-w-[1800px] mx-auto px-8 py-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
                    <div className="flex items-center gap-6">
                        <button
                            onClick={onClose}
                            className="p-4 rounded-2xl bg-gradient-to-br from-[#388087] to-[#27575b] shadow-[6px_6px_16px_rgba(0,0,0,0.4),-3px_-3px_10px_rgba(255,255,255,0.02)] text-gray-400 hover:text-rose-400 transition-colors active:scale-95 border border-white/5"
                        >
                            <X size={24} />
                        </button>
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tight">
                                    Invoice <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#92cdb3] to-[#388087]">Analytics</span>
                                </h1>
                                {/* Center Badge */}
                                <div className={`px-4 py-2 rounded-xl font-bold text-sm uppercase tracking-widest ${
                                    isGlobalView 
                                        ? 'bg-gradient-to-br from-purple-500/20 to-purple-600/20 text-purple-400 border border-purple-500/30' 
                                        : 'bg-gradient-to-br from-[#92cdb3]/20 to-[#388087]/20 text-[#92cdb3] border border-[#92cdb3]/30'
                                }`}>
                                    <div className="flex items-center gap-2">
                                        {isGlobalView ? <Globe size={16} /> : <MapPin size={16} />}
                                        <span>{isGlobalView ? 'All Centers' : activeBranch.charAt(0).toUpperCase() + activeBranch.slice(1)}</span>
                                    </div>
                                </div>
                            </div>
                            <p className="text-gray-400 font-medium text-lg">
                                {isGlobalView 
                                    ? 'Combined analysis from all centers for invoice generation'
                                    : `${activeBranch.charAt(0).toUpperCase() + activeBranch.slice(1)} center analysis for invoice generation`
                                }
                            </p>
                        </div>
                    </div>

                    {/* Month Navigation & Export */}
                    <div className="flex items-center gap-4">
                        <div className={`${neumorphicInset} px-3 py-2 flex items-center gap-3`}>
                            <button
                                onClick={() => navigateMonth('prev')}
                                className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <span className="text-white font-bold min-w-[140px] text-center">
                                {currentMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                            </span>
                            <button
                                onClick={() => navigateMonth('next')}
                                className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>

                        <button onClick={exportAsCSV} className={neumorphicBtn}>
                            <FileSpreadsheet size={18} />
                            CSV
                        </button>
                        <button onClick={exportDetailedReport} className={neumorphicBtnActive}>
                            <Download size={18} />
                            Full Report
                        </button>
                    </div>
                </div>

                {/* View Tabs */}
                <div className={`${neumorphicCard} p-2 flex gap-2 mb-8 w-fit`}>
                    {[
                        { key: 'overview', label: 'Overview', icon: TrendingUp },
                        { key: 'clients', label: 'Client Details', icon: Users },
                        { key: 'overlaps', label: 'Overlap Analysis', icon: Layers }
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setSelectedView(tab.key as typeof selectedView)}
                            className={`px-5 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${
                                selectedView === tab.key
                                    ? 'bg-gradient-to-br from-[#92cdb3]/20 to-[#388087]/20 text-[#92cdb3] shadow-[inset_2px_2px_8px_rgba(0,0,0,0.3)]'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                            {tab.key === 'overlaps' && overlapAnalysis.length > 0 && (
                                <span className="px-2 py-0.5 bg-rose-500/30 text-rose-400 rounded-full text-xs font-bold">
                                    {overlapAnalysis.length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 flex-1">
                        <div className="relative">
                            <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-700"></div>
                            <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#92cdb3] border-t-transparent absolute inset-0"></div>
                        </div>
                        <p className="text-gray-400 font-bold mt-6 animate-pulse">Analyzing Session Data...</p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-4">
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
                                            <div className="absolute top-0 right-0 p-4 opacity-10 text-[#92cdb3] group-hover:opacity-20 transition-opacity">
                                                <Users size={80} />
                                            </div>
                                            <h3 className="text-gray-500 font-bold uppercase tracking-widest text-xs mb-2">Total Candidates</h3>
                                            <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#92cdb3] to-[#388087]">
                                                {totals.totalCandidates}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-2 font-medium">For Invoice Generation</p>
                                        </div>

                                        <div className={`${neumorphicCard} p-6 relative overflow-hidden group`}>
                                            <div className="absolute top-0 right-0 p-4 opacity-10 text-blue-500 group-hover:opacity-20 transition-opacity">
                                                <Calendar size={80} />
                                            </div>
                                            <h3 className="text-gray-500 font-bold uppercase tracking-widest text-xs mb-2">Total Sessions</h3>
                                            <div className="text-5xl font-black text-blue-400">
                                                {totals.totalSessions}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-2 font-medium">Exam Schedules</p>
                                        </div>

                                        <div className={`${neumorphicCard} p-6 relative overflow-hidden group`}>
                                            <div className="absolute top-0 right-0 p-4 opacity-10 text-emerald-500 group-hover:opacity-20 transition-opacity">
                                                <Building size={80} />
                                            </div>
                                            <h3 className="text-gray-500 font-bold uppercase tracking-widest text-xs mb-2">Active Centers</h3>
                                            <div className="text-5xl font-black text-emerald-400">
                                                {Object.keys(totals.byBranch).length}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-2 font-medium">Across Locations</p>
                                        </div>

                                        <div className={`${neumorphicCard} p-6 relative overflow-hidden group`}>
                                            <div className="absolute top-0 right-0 p-4 opacity-10 text-rose-500 group-hover:opacity-20 transition-opacity">
                                                <AlertTriangle size={80} />
                                            </div>
                                            <h3 className="text-rose-400 font-bold uppercase tracking-widest text-xs mb-2">Overlap Alerts</h3>
                                            <div className="text-5xl font-black text-rose-400">
                                                {overlapAnalysis.length}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-2 font-medium">Capacity Conflicts</p>
                                        </div>
                                    </div>

                                    {/* Branch & Weekly Summary */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        {/* Daily Breakdown */}
                                        <div className={`${neumorphicCard} p-8`}>
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="p-2 bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-lg text-blue-400">
                                                    <Calendar size={24} />
                                                </div>
                                                <div>
                                                    <h3 className="text-xl font-black text-white">Daily Breakdown</h3>
                                                    <p className="text-xs text-gray-500 font-medium">Booked candidates against actual seats for each day</p>
                                                </div>
                                            </div>
                                            <div className="space-y-4 max-h-[520px] overflow-y-auto custom-scrollbar pr-2">
                                                {totals.dailyBreakdown.length === 0 ? (
                                                    <div className={`${neumorphicCardLight} p-8 text-center text-gray-500 font-bold`}>
                                                        No session data for this month
                                                    </div>
                                                ) : totals.dailyBreakdown.map(day => {
                                                    const utilization = day.seats > 0 ? Math.min((day.booked / day.seats) * 100, 100) : 0;
                                                    return (
                                                        <div key={day.date} className={`${neumorphicCardLight} p-5`}>
                                                            <div className="flex items-start justify-between gap-4 mb-4">
                                                                <div>
                                                                    <h4 className="font-black text-white">{formatDateLabel(day.date)}</h4>
                                                                    <p className="text-xs text-gray-500">{day.sessions} session{day.sessions === 1 ? '' : 's'}</p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <div className="text-2xl font-black text-[#FFD633] tabular-nums">
                                                                        {day.booked} / {day.seats}
                                                                    </div>
                                                                    <p className="text-xs text-gray-500">booked / seats</p>
                                                                </div>
                                                            </div>
                                                            <div className="h-2 w-full bg-[#0d1d1f] rounded-full overflow-hidden mb-3">
                                                                <motion.div
                                                                    initial={{ width: 0 }}
                                                                    animate={{ width: `${utilization}%` }}
                                                                    transition={{ duration: 0.6 }}
                                                                    className="h-full bg-gradient-to-r from-[#FFD633] to-[#92cdb3] rounded-full"
                                                                />
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                {Object.entries(day.branches).map(([branch, data]) => (
                                                                    <div key={branch} className="rounded-lg bg-[#0d1d1f]/60 px-3 py-2 flex items-center justify-between">
                                                                        <span className="text-xs font-bold uppercase text-gray-400">{getBranchLabel(branch)}</span>
                                                                        <span className="text-sm font-black text-white tabular-nums">{data.booked} / {data.seats}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Weekly Summary */}
                                        <div className={`${neumorphicCard} p-8`}>
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="p-2 bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-lg text-purple-400">
                                                    <Calendar size={24} />
                                                </div>
                                                <h3 className="text-xl font-black text-white">Weekly Breakdown</h3>
                                            </div>
                                            <div className="space-y-4">
                                                {totals.weeklyTotals.map(week => (
                                                    <div key={week.week} className={`${neumorphicCardLight} p-5`}>
                                                        <div className="flex items-center justify-between mb-3">
                                                            <span className="font-bold text-white">{week.weekStart} - {week.weekEnd}</span>
                                                            <div className="flex items-center gap-4">
                                                                <span className="text-sm text-gray-400">{week.sessions} sessions</span>
                                                                <span className="text-xl font-black text-[#92cdb3]">{week.candidates}</span>
                                                            </div>
                                                        </div>
                                                        <div className="h-2 w-full bg-[#0d1d1f] rounded-full overflow-hidden">
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${(week.candidates / totals.totalCandidates) * 100}%` }}
                                                                transition={{ duration: 0.8, delay: week.week * 0.1 }}
                                                                className="h-full bg-gradient-to-r from-[#92cdb3] to-[#388087] rounded-full"
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {selectedView === 'clients' && (
                                <motion.div
                                    key="clients"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    className="grid grid-cols-1 lg:grid-cols-2 gap-8"
                                >
                                    {clientAnalysis.map(client => {
                                        const color = getClientColor(client.clientName);
                                        return (
                                            <div key={client.clientName} className={`${neumorphicCard} p-8 border-l-4 ${color.border}`}>
                                                <div className="flex items-center justify-between mb-6">
                                                    <div>
                                                        <h3 className={`text-2xl font-black ${color.text}`}>{client.clientName}</h3>
                                                        <p className="text-gray-500 text-sm">{client.sessionCount} Total Sessions</p>
                                                    </div>
                                                    <div className={`px-6 py-3 bg-gradient-to-br ${color.bg} rounded-2xl`}>
                                                        <span className="text-3xl font-black text-white">{client.totalCandidates}</span>
                                                        <span className="text-xs text-gray-400 ml-2">Candidates</span>
                                                    </div>
                                                </div>

                                                {/* Branch Breakdown */}
                                                <div className="mb-6">
                                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Center Breakdown</h4>
                                                    <div className="grid grid-cols-3 gap-3">
                                                        {Object.entries(client.branches).map(([branch, data]) => (
                                                            <div key={branch} className={`${neumorphicCardLight} p-4 text-center`}>
                                                                <p className="text-xs text-gray-500 uppercase mb-1">{branch}</p>
                                                                <p className="text-xl font-black text-white">{data.candidates}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Weekly Breakdown */}
                                                <div>
                                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Weekly Distribution</h4>
                                                    <div className="space-y-2">
                                                        {client.weeklyBreakdown.map(week => (
                                                            <div key={week.weekNumber} className="flex items-center gap-4">
                                                                <span className="text-xs text-gray-400 w-28">{week.weekStart} - {week.weekEnd}</span>
                                                                <div className="flex-1 h-3 bg-[#0d1d1f] rounded-full overflow-hidden">
                                                                    <motion.div
                                                                        initial={{ width: 0 }}
                                                                        animate={{ width: `${(week.candidates / client.totalCandidates) * 100}%` }}
                                                                        transition={{ duration: 0.6 }}
                                                                        className={`h-full bg-gradient-to-r ${color.bg.replace('/20', '')} rounded-full`}
                                                                        style={{ background: `linear-gradient(to right, ${color.text.replace('text-', '').replace('-400', '')}, ${color.text.replace('text-', '').replace('-400', '-600')})` }}
                                                                    />
                                                                </div>
                                                                <span className="text-sm font-bold text-white w-12 text-right">{week.candidates}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </motion.div>
                            )}

                            {selectedView === 'overlaps' && (
                                <motion.div
                                    key="overlaps"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    className="space-y-8"
                                >
                                    {overlapAnalysis.length === 0 ? (
                                        <div className={`${neumorphicCard} p-16 flex flex-col items-center justify-center`}>
                                            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 flex items-center justify-center mb-6">
                                                <CheckCircle size={48} className="text-emerald-400" />
                                            </div>
                                            <h3 className="text-2xl font-black text-white mb-2">No Overlap Conflicts</h3>
                                            <p className="text-gray-500 text-center max-w-md">
                                                All scheduled sessions are within capacity limits with no time conflicts detected.
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className={`${neumorphicCard} p-6`}>
                                                <div className="flex items-center gap-4 text-rose-400">
                                                    <AlertTriangle size={24} />
                                                    <div>
                                                        <h3 className="font-bold text-lg">Seat Capacity Conflicts Detected</h3>
                                                        <p className="text-gray-400 text-sm">Only time windows where concurrent candidates exceed actual branch seats are shown.</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {overlapAnalysis.map((overlap, idx) => (
                                                <div key={idx} className={`${neumorphicCard} p-8 border-l-4 border-rose-500/50`}>
                                                    <div className="flex items-start justify-between mb-6">
                                                        <div>
                                                            <h3 className="text-xl font-black text-white">
                                                                {new Date(overlap.date).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                                                            </h3>
                                                            <div className="flex items-center gap-4 mt-2">
                                                                <span className="px-3 py-1 bg-rose-500/20 text-rose-400 rounded-full text-xs font-bold">
                                                                    {getBranchLabel(overlap.branch)}
                                                                </span>
                                                                <span className="px-3 py-1 bg-[#92cdb3]/20 text-[#92cdb3] rounded-full text-xs font-bold">
                                                                    Peak {overlap.totalCandidates} / {overlap.capacity} seats
                                                                </span>
                                                                {overlap.excessCandidates > 0 && (
                                                                    <span className="px-3 py-1 bg-red-500/30 text-red-400 rounded-full text-xs font-bold">
                                                                        +{overlap.excessCandidates} excess
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Conflict Windows */}
                                                    <div className="mb-6">
                                                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Over-capacity Time Windows</h4>
                                                        <div className="space-y-3">
                                                            {overlap.conflictPeriods.map((period, pIdx) => (
                                                                <div key={`${period.start}-${period.end}-${pIdx}`} className="rounded-xl bg-rose-500/10 border border-rose-500/25 p-4">
                                                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                                                                        <div className="flex items-center gap-3">
                                                                            <Clock size={16} className="text-rose-300" />
                                                                            <span className="font-black text-white">{period.start} - {period.end}</span>
                                                                        </div>
                                                                        <div className="text-rose-300 font-black tabular-nums">
                                                                            {period.candidates} / {period.capacity} seats
                                                                            <span className="ml-2 text-xs text-rose-400">+{period.excessCandidates} excess</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                                        {period.sessions.map(session => (
                                                                            <div key={`${period.start}-${session.id}`} className="rounded-lg bg-[#0d1d1f]/70 px-3 py-2">
                                                                                <div className="flex items-center justify-between gap-3">
                                                                                    <span className="font-bold text-white truncate">{session.exam_name}</span>
                                                                                    <span className="text-[#FFD633] font-black tabular-nums">{session.candidate_count}</span>
                                                                                </div>
                                                                                <p className="text-xs text-gray-500 mt-1">
                                                                                    {session.client_name} · {session.start_time} - {session.end_time}
                                                                                </p>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Sessions Timeline */}
                                                    <div className="mb-6">
                                                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Conflicting Sessions</h4>
                                                        <div className="space-y-3">
                                                            {overlap.sessions.map((session, sIdx) => {
                                                                const color = getClientColor(session.client_name);
                                                                return (
                                                                    <div key={sIdx} className={`${neumorphicCardLight} p-4 flex items-center justify-between`}>
                                                                        <div className="flex items-center gap-4">
                                                                            <div className={`w-1 h-12 rounded-full ${color.border.replace('border-', 'bg-')}`} />
                                                                            <div>
                                                                                <p className={`font-bold ${color.text}`}>{session.client_name}</p>
                                                                                <p className="text-xs text-gray-500">{session.exam_name}</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-6">
                                                                            <div className="text-center">
                                                                                <p className="text-xs text-gray-500">Time</p>
                                                                                <p className="text-sm font-bold text-white">{session.start_time} - {session.end_time}</p>
                                                                            </div>
                                                                            <div className="text-center">
                                                                                <p className="text-xs text-gray-500">Candidates</p>
                                                                                <p className="text-lg font-black text-[#92cdb3]">{session.candidate_count}</p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Recommendations */}
                                                    <div>
                                                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                            <Zap size={14} className="text-[#92cdb3]" />
                                                            Recommendations
                                                        </h4>
                                                        <div className="space-y-3">
                                                            {overlap.suggestions.map((suggestion, sIdx) => (
                                                                <div key={sIdx} className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-br from-[#92cdb3]/10 to-[#388087]/10 border border-[#92cdb3]/20">
                                                                    <Timer size={16} className="text-[#92cdb3] mt-0.5 flex-shrink-0" />
                                                                    <p className="text-sm text-gray-300">{suggestion}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </motion.div>
    );
};
