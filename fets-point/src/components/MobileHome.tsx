import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle, ExternalLink, ShieldCheck,
  ChevronRight, Globe,
  Users, LayoutGrid, Shield, ClipboardList,
  Calendar, Server, Newspaper, PackageSearch, Brain, UserCheck,
  ChevronDown, X, MapPin, Activity, CheckCircle2,
  MessageSquare, AlertCircle, ArrowUpRight, Settings2,
  Layers, Lock, Zap, GraduationCap, Briefcase, BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useBranch } from '../hooks/useBranch';
import { useAppModules } from '../hooks/useAppModules';
import { useDashboardStats, useUpcomingSchedule, useSevenDayRosterStaff } from '../hooks/useCommandCentre';
import { SevenDayExamOutlook } from './SevenDayExamOutlook';
import { canSwitchBranches, formatBranchName, getAvailableBranches } from '../utils/authUtils';
import { isMithunEmail } from '../utils/authUtils';
import { useAuth } from '../hooks/useAuth';
import { format } from 'date-fns';

interface MobileHomeProps {
  setActiveTab: (tab: string) => void;
  profile: any;
}

export function MobileHome({ setActiveTab, profile }: MobileHomeProps) {
  const { activeBranch, setActiveBranch } = useBranch();
  const { modules, toggleModule, isUpdating } = useAppModules();
  const { data: dashboardData } = useDashboardStats();
  const { data: examSchedule = [], isLoading: isLoadingSchedule } = useUpcomingSchedule();
  const { data: staffByDate = {}, isLoading: isLoadingRosterStaff } = useSevenDayRosterStaff();
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [showManagementSheet, setShowManagementSheet] = useState(false);
  const [staffPresent, setStaffPresent] = useState<any[]>([]);

  const isMithun = isMithunEmail(profile?.email);
  const availableBranches = getAvailableBranches(profile?.email, profile?.role);
  const canSwitch = canSwitchBranches(profile?.email, profile?.role);

  const branches = [
    { id: 'calicut', label: 'Calicut HQ', sub: 'Kerala, India' },
    { id: 'cochin', label: 'Cochin Center', sub: 'Kerala, India' },
    { id: 'global', label: 'Global View', sub: 'All Centres' }
  ];

  useEffect(() => {
    async function fetchStaff() {
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data } = await (supabase as any)
          .from('staff_attendance')
          .select('staff_id, check_in, branch_location')
          .eq('date', today)
          .not('check_in', 'is', null);
        setStaffPresent(data || []);
      } catch (e) { console.error(e); }
    }
    fetchStaff();
  }, [activeBranch]);

  // Stat cards data
  const totalSessions = dashboardData?.todaysExams?.length || 0;
  const totalCandidates = (dashboardData?.todaysExams || []).reduce((s: number, e: any) => s + (e.candidate_count || 0), 0);

  const statCards = [
    { label: 'Sessions', value: totalSessions, icon: Calendar, color: '#FACC15' },
    { label: 'Candidates', value: totalCandidates, icon: Users, color: '#BADFE7' },
    { label: 'Staff In', value: staffPresent.length, icon: CheckCircle2, color: '#C2EDCE' },
  ];

  const coreModules = [
    { id: 'command-center', label: 'LIVE', icon: Zap, gradient: 'from-amber-500 to-yellow-600' },
    { id: 'candidate-tracker', label: 'Register', icon: Users, gradient: 'from-blue-500 to-cyan-600' },
    { id: 'fets-calendar', label: 'Calendar', icon: Calendar, gradient: 'from-violet-500 to-purple-600' },
    { id: 'client-portal', label: 'Clients', icon: Briefcase, gradient: 'from-amber-500 to-orange-600' },
    { id: 'fets-roster', label: 'Roster', icon: UserCheck, gradient: 'from-indigo-500 to-blue-600' },
    { id: 'incident-log', label: 'Cases', icon: AlertCircle, gradient: 'from-orange-500 to-red-600' },
    { id: 'cma-availability', label: 'CMA US', icon: GraduationCap, gradient: 'from-teal-500 to-emerald-600' },
  ].filter(item => {
    const mod = modules.find(m => m.id === item.id);
    return !mod || mod.is_enabled;
  });

  const utilityModules = [
    { id: 'system-manager', label: 'System Manager', icon: Server, color: '#64748b' },
    { id: 'news-manager', label: 'News & Notices', icon: Newspaper, color: '#f59e0b' },
    { id: 'lost-and-found', label: 'Lost & Found', icon: PackageSearch, color: '#ef4444' },
    { id: 'fets-intelligence', label: 'FETS AI', icon: Brain, color: '#8b5cf6' },
  ].filter(item => {
    const mod = modules.find(m => m.id === item.id);
    return !mod || mod.is_enabled;
  });

  // Management items (accessible to all) from secondRowItems
  const managementItems = [
    { id: 'incident-log', label: 'Raise A Case', icon: AlertCircle },
    { id: 'client-portal', label: 'Client Portal', icon: Briefcase },
    { id: 'system-manager', label: 'System Manager', icon: Server },
    { id: 'lost-and-found', label: 'Lost & Found', icon: PackageSearch },
    { id: 'fets-intelligence', label: 'FETS AI', icon: Brain },
  ].filter(item => {
    const mod = modules.find(m => m.id === item.id);
    return !mod || mod.is_enabled;
  });

  return (
    <div className="flex flex-col min-h-screen sovereign-theme pb-[calc(8rem+env(safe-area-inset-bottom,0px))] touch-manipulation">

      {/* ═══════════════════════════════════════════════════════
          HERO HEADER — Matches Web's FETS LIVE sovereign style
      ═══════════════════════════════════════════════════════ */}
      <div className="relative px-6 pt-8 pb-10 overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#FACC15]/8 to-transparent blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-[#FACC15]/5 to-transparent blur-2xl pointer-events-none" />

        {/* Top row: Brand + branch */}
        <div className="relative z-10 flex justify-between items-start mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-[1px] w-6 bg-[#FACC15]" />
              <span className="text-[9px] font-bold text-[#FACC15] uppercase tracking-[0.3em]">
                Operational Intelligence
              </span>
            </div>
            <h1 className="text-5xl font-black text-[#FACC15] tracking-tighter leading-none">
              FETS LIVE
            </h1>
            <div className="mt-2 text-[#FACC15]/30 text-[8px] tracking-[0.3em] uppercase font-medium">v5.0</div>
          </div>

          <button
            onClick={() => setShowBranchPicker(true)}
            className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl border border-white/10 active:scale-95 transition-transform mt-2"
          >
            <MapPin size={12} className="text-[#FACC15]/60" />
            <span className="text-[#FACC15] font-bold text-[9px] uppercase tracking-widest">
              {activeBranch === 'calicut' ? 'CLT' : activeBranch === 'cochin' ? 'COK' : 'ALL'}
            </span>
            <ChevronDown size={10} className="text-[#FACC15]/30" />
          </button>
        </div>

        {/* Date */}
        <div className="relative z-10 flex items-center gap-2 mb-6">
          <div className="h-[1px] w-4 bg-[#FACC15]/40" />
          <span
            className="text-[#FACC15]/60 text-sm tracking-wide"
            style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic' }}
          >
            {format(new Date(), 'EEEE, MMMM do')}
          </span>
        </div>

        {/* Profile card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 sov-card flex items-center justify-between !p-4 !rounded-2xl"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-[#FACC15]/30 p-0.5 bg-black/40 shadow-inner">
                <img
                  src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.full_name || 'U')}&background=121214&color=FACC15&size=96`}
                  className="w-full h-full object-cover rounded-lg"
                  alt="Profile"
                />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#1a3a3d]" />
            </div>
            <div>
              <p className="text-white font-bold text-base leading-tight tracking-tight">{profile?.full_name || 'User'}</p>
              <p className="text-[8px] font-bold text-[#FACC15]/50 uppercase tracking-[0.2em] mt-0.5">
                {profile?.role?.replace('_', ' ') || 'Staff'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isMithun && (
              <button
                onClick={() => setShowManagementSheet(true)}
                className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#FACC15]/60 active:scale-90 transition-transform"
              >
                <Settings2 size={16} />
              </button>
            )}
            <button
              onClick={() => setActiveTab('profile')}
              className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 active:scale-90 transition-transform"
            >
              <Shield size={16} />
            </button>
          </div>
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          LIVE STATS — Mini stat cards
      ═══════════════════════════════════════════════════════ */}
      <div className="px-6 -mt-2 mb-6">
        <div className="grid grid-cols-3 gap-3">
          {statCards.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="sov-card !p-3 !rounded-2xl relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-[#FACC15]/5 to-transparent blur-2xl -mr-4 -mt-4 pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <stat.icon size={14} style={{ color: stat.color }} className="opacity-60" />
                  <ArrowUpRight size={10} className="text-white/10" />
                </div>
                <div className="text-2xl font-bold tracking-tighter text-white leading-none mb-0.5">{stat.value}</div>
                <div className="text-[7px] font-bold text-white/30 uppercase tracking-[0.15em]">{stat.label}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {isMithun && (
        <div className="px-6 mb-8">
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setActiveTab('my-desk')}
            className="w-full sov-card !rounded-2xl !p-5 flex items-center justify-between relative overflow-hidden active:border-[#FACC15]/40 transition-all"
          >
            <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-pink-500/10 to-transparent blur-2xl" />
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
                <BookOpen size={23} className="text-[#FACC15]" />
              </div>
              <div className="text-left">
                <span className="font-black text-white text-base uppercase tracking-tight block leading-none mb-1">My Desk</span>
                <span className="text-[#FACC15]/45 text-[9px] font-bold uppercase tracking-[0.2em]">Workbook, notes, to-do, accounting</span>
              </div>
            </div>
            <ChevronRight size={18} className="text-white/20 relative z-10" />
          </motion.button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          CLIENT WORKSPACE — prominent internal portal entry
      ═══════════════════════════════════════════════════════ */}
      <div className="px-6 mb-8">
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setActiveTab('client-portal')}
          className="w-full sov-card !rounded-2xl !p-5 flex items-center justify-between relative overflow-hidden active:border-[#FACC15]/40 transition-all"
        >
          <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-[#FACC15]/10 to-transparent blur-2xl" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-[#FACC15]/10 border border-[#FACC15]/25 flex items-center justify-center">
              <Briefcase size={23} className="text-[#FACC15]" />
            </div>
            <div className="text-left">
              <span className="font-black text-white text-base uppercase tracking-tight block leading-none mb-1">Client Portal</span>
              <span className="text-[#FACC15]/45 text-[9px] font-bold uppercase tracking-[0.2em]">Schedules, invoice counts, support</span>
            </div>
          </div>
          <ChevronRight size={18} className="text-white/20 relative z-10" />
        </motion.button>
      </div>

      {/* ═══════════════════════════════════════════════════════
          SAME 7-DAY OUTLOOK AS DESKTOP COMMAND CENTRE
      ═══════════════════════════════════════════════════════ */}
      <div className="px-4 sm:px-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-[1px] w-4 bg-[#FACC15]/30" />
          <span className="text-[10px] sm:text-xs font-bold text-[#FACC15]/70 uppercase tracking-[0.22em]">Schedule</span>
          <div className="h-[1px] flex-1 bg-white/5" />
        </div>
        <SevenDayExamOutlook
          sessions={examSchedule as any}
          isLoading={isLoadingSchedule}
          activeBranch={activeBranch}
          staffByDate={staffByDate}
          staffLoading={isLoadingRosterStaff}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════
          CORE MODULES — Primary operations grid
      ═══════════════════════════════════════════════════════ */}
      <div className="px-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-[1px] w-4 bg-[#FACC15]/30" />
          <span className="text-[9px] font-bold text-[#FACC15]/60 uppercase tracking-[0.3em]">Core Modules</span>
          <div className="h-[1px] flex-1 bg-white/5" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          {coreModules.map((module, i) => (
            <motion.button
              key={module.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 + i * 0.06 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => setActiveTab(module.id)}
              className="sov-card !p-4 !rounded-2xl flex flex-col items-center text-center gap-3 active:border-[#FACC15]/40 transition-all"
            >
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${module.gradient} flex items-center justify-center text-white shadow-lg`}>
                <module.icon size={20} />
              </div>
              <span className="text-[9px] font-bold text-white/70 uppercase tracking-[0.1em] leading-tight">{module.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          UTILITY MODULES — System utilities list
      ═══════════════════════════════════════════════════════ */}
      <div className="px-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-[1px] w-4 bg-[#FACC15]/30" />
          <span className="text-[9px] font-bold text-[#FACC15]/60 uppercase tracking-[0.3em]">System Utilities</span>
          <div className="h-[1px] flex-1 bg-white/5" />
        </div>

        <div className="space-y-2">
          {utilityModules.map((item, i) => (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.06 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab(item.id)}
              className="w-full sov-card !p-4 !rounded-2xl flex items-center justify-between active:border-[#FACC15]/30 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <item.icon size={18} style={{ color: item.color }} className="opacity-70" />
                </div>
                <span className="text-[11px] font-bold text-white/80 uppercase tracking-wider">{item.label}</span>
              </div>
              <ChevronRight size={16} className="text-white/15" />
            </motion.button>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          F-VAULT — Secure Access
      ═══════════════════════════════════════════════════════ */}
      <div className="px-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-[1px] w-4 bg-[#FACC15]/30" />
          <span className="text-[9px] font-bold text-[#FACC15]/60 uppercase tracking-[0.3em]">Secure Access</span>
          <div className="h-[1px] flex-1 bg-white/5" />
        </div>

        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setActiveTab('access-hub')}
          className="w-full sov-card !rounded-2xl !p-5 flex items-center justify-between relative overflow-hidden group active:border-[#FACC15]/40 transition-all"
        >
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-[#FACC15]/10 border border-[#FACC15]/20 flex items-center justify-center group-active:scale-110 transition-transform">
              <ShieldCheck size={24} className="text-[#FACC15]" />
            </div>
            <div className="text-left">
              <h3 className="text-white font-black text-lg tracking-tighter leading-none mb-1 uppercase">F-Vault</h3>
              <p className="text-[#FACC15]/40 text-[9px] font-bold uppercase tracking-[0.2em]">Global Credentials</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-white/15 relative z-10" />
          <div className="absolute right-0 bottom-0 opacity-[0.03] -mr-6 -mb-6">
            <Lock size={120} />
          </div>
        </motion.button>
      </div>

      {/* ═══════════════════════════════════════════════════════
          MANAGEMENT — mithun only
      ═══════════════════════════════════════════════════════ */}
      {isMithun && (
        <div className="px-6 mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-[1px] w-4 bg-[#FACC15]/30" />
            <span className="text-[9px] font-bold text-[#FACC15]/60 uppercase tracking-[0.3em]">Admin Console</span>
            <div className="h-[1px] flex-1 bg-white/5" />
          </div>

          <div className="space-y-3">
            <motion.button
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setActiveTab('candidate-tracker')}
              className="w-full sov-card !rounded-2xl !p-5 flex items-center justify-between relative overflow-hidden active:border-[#FACC15]/40 transition-all"
            >
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <ClipboardList size={22} className="text-cyan-400" />
                </div>
                <div className="text-left">
                  <span className="font-black text-white text-base uppercase tracking-tight block leading-none mb-1">Fets Register</span>
                  <span className="text-[#FACC15]/40 text-[9px] font-bold uppercase tracking-[0.2em]">Candidate Details</span>
                </div>
              </div>
              <ChevronRight size={18} className="text-white/15 relative z-10" />
              <div className="absolute right-0 top-0 p-3 opacity-[0.03] rotate-12">
                <ClipboardList size={80} />
              </div>
            </motion.button>

            <motion.button
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setActiveTab('user-management')}
              className="w-full sov-card !rounded-2xl !p-5 flex items-center justify-between relative overflow-hidden active:border-[#FACC15]/40 transition-all"
            >
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 rounded-xl bg-[#FACC15]/10 border border-[#FACC15]/20 flex items-center justify-center">
                  <Shield size={22} className="text-[#FACC15]" />
                </div>
                <div className="text-left">
                  <span className="font-black text-white text-base uppercase tracking-tight block leading-none mb-1">User Management</span>
                  <span className="text-[#FACC15]/40 text-[9px] font-bold uppercase tracking-[0.2em]">Global Permissions</span>
                </div>
              </div>
              <ChevronRight size={18} className="text-white/15 relative z-10" />
              <div className="absolute right-0 top-0 p-3 opacity-[0.03] rotate-12">
                <Shield size={80} />
              </div>
            </motion.button>
          </div>
        </div>
      )}


      {/* ═══════════════════════════════════════════════════════
          BRANCH PICKER SHEET
      ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showBranchPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-end justify-center"
            onClick={() => setShowBranchPicker(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="w-full max-w-md bg-[#1a3a3d] border-t border-[#FACC15]/20 rounded-t-[32px] p-6 pb-10 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Handle bar */}
              <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-6" />

              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">Switch Node</h3>
                  <p className="text-[9px] text-[#FACC15]/40 uppercase tracking-[0.2em] mt-0.5">Select operating centre</p>
                </div>
                <button onClick={() => setShowBranchPicker(false)} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-white/40">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2">
                {branches.map(b => (
                  <button
                    key={b.id}
                    onClick={() => { setActiveBranch(b.id as any); setShowBranchPicker(false); }}
                    className={`w-full p-4 rounded-2xl flex items-center justify-between border transition-all ${activeBranch === b.id
                      ? 'bg-[#FACC15]/10 border-[#FACC15]/40'
                      : 'bg-white/5 border-white/5 active:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeBranch === b.id ? 'bg-[#FACC15] text-[#1a3a3d]' : 'bg-white/10 text-white/40'}`}>
                        <MapPin size={18} />
                      </div>
                      <div className="text-left">
                        <span className={`font-bold text-sm uppercase tracking-wider block ${activeBranch === b.id ? 'text-[#FACC15]' : 'text-white/70'}`}>{b.label}</span>
                        <span className="text-[8px] text-white/30 uppercase tracking-widest">{b.sub}</span>
                      </div>
                    </div>
                    {activeBranch === b.id && <CheckCircle size={18} className="text-[#FACC15]" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════
          MANAGEMENT SHEET — mithun only module controls
      ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showManagementSheet && isMithun && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-end justify-center"
            onClick={() => setShowManagementSheet(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="w-full max-w-md bg-[#1a3a3d] border-t border-[#FACC15]/20 rounded-t-[32px] p-6 pb-10 shadow-2xl max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* Handle bar */}
              <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-6" />

              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">Management</h3>
                  <p className="text-[9px] text-[#FACC15]/40 uppercase tracking-[0.2em] mt-0.5">System Controls</p>
                </div>
                <button onClick={() => setShowManagementSheet(false)} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-white/40">
                  <X size={18} />
                </button>
              </div>

              {/* Navigation items */}
              <div className="space-y-1 mb-6">
                {managementItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => { setActiveTab(item.id); setShowManagementSheet(false); }}
                    className="w-full flex items-center justify-between p-3 rounded-xl transition-all active:bg-white/5 text-white/80"
                  >
                    <div className="flex items-center gap-3">
                      <item.icon size={16} className="text-white/40" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
                    </div>
                    <ChevronRight size={14} className="text-white/15" />
                  </button>
                ))}
              </div>

              {/* Module toggles */}
              <div className="border-t border-white/10 pt-4 mb-4">
                <span className="text-[8px] font-bold text-[#FACC15]/60 uppercase tracking-[0.3em] block mb-3">Module Controls</span>
                <div className="space-y-1">
                  {modules.map(mod => (
                    <div
                      key={mod.id}
                      className="flex items-center justify-between p-3 rounded-xl transition-all hover:bg-white/5"
                    >
                      <button
                        onClick={() => { setActiveTab(mod.id); setShowManagementSheet(false); }}
                        className="flex items-center gap-3 flex-1 text-left"
                      >
                        <div className="p-1.5 rounded-lg bg-white/5 text-white/40">
                          <Layers size={14} />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-white/80">{mod.name}</div>
                          <div className="text-[7px] text-white/25 uppercase tracking-widest">{mod.id.replace(/-/g, ' ')}</div>
                        </div>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleModule(mod.id, !mod.is_enabled); }}
                        disabled={isUpdating}
                        className={`px-2.5 py-1 rounded-lg text-[8px] font-bold uppercase transition-all ${mod.is_enabled
                          ? 'bg-[#FACC15] text-[#1a3a3d]'
                          : 'bg-white/10 text-white/40'
                        }`}
                      >
                        {mod.is_enabled ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Admin links */}
              <div className="border-t border-white/10 pt-4 space-y-1">
                <button
                  onClick={() => { setActiveTab('candidate-tracker'); setShowManagementSheet(false); }}
                  className="w-full flex items-center justify-between p-3 rounded-xl transition-all active:bg-white/5 text-white/80"
                >
                  <div className="flex items-center gap-3">
                    <ClipboardList size={16} className="text-cyan-400/60" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Fets Register</span>
                  </div>
                  <ChevronRight size={14} className="text-white/15" />
                </button>
                <button
                  onClick={() => { setActiveTab('user-management'); setShowManagementSheet(false); }}
                  className="w-full flex items-center justify-between p-3 rounded-xl transition-all active:bg-white/5 text-white/80"
                >
                  <div className="flex items-center gap-3">
                    <Shield size={16} className="text-[#FACC15]/60" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">User Management</span>
                  </div>
                  <ChevronRight size={14} className="text-white/15" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
