import { FetsLogo } from './FetsLogo';
import './HeaderTheme.css'; // Import the new theme
import {
  Bell, ChevronDown, MapPin, LayoutDashboard,
  Brain, ShieldAlert, MessageSquare, ClipboardList,
  CalendarDays, UserSearch, UserCheck, Menu, LogOut,
  Server, Cpu, Shield, X, PackageSearch, AlertCircle, BookOpen, Briefcase,
  ChevronRight, Settings2, Layers, GraduationCap, Building2
} from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useBranch } from '../hooks/useBranch';
import { canSwitchBranches, formatBranchName, getAvailableBranches, isMithunEmail } from '../utils/authUtils';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppModules } from '../hooks/useAppModules';
import { LocationSelectorThread } from './LocationSelectorThread';
import { supabase } from '../lib/supabase';

interface HeaderProps {
  isMobile?: boolean;
  sidebarOpen?: boolean;
  setSidebarOpen?: (open: boolean) => void;
  setActiveTab?: (tab: string) => void;
  activeTab?: string;
  onQuickCapture?: () => void;
}

/**
 * Helper to wrap each character in a span with a CSS variable for animation delay
 */
const AnimatedLabel = ({ label }: { label: string }) => {
  return (
    <span className="flex gap-[0.05em]">
      {label.split('').map((char, index) => (
        <span
          key={index}
          style={{ '--char-index': index } as React.CSSProperties}
          className="inline-block"
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </span>
  );
};

export function Header({ isMobile = false, sidebarOpen = false, setSidebarOpen, setActiveTab, activeTab, onQuickCapture }: HeaderProps = {}) {
  const { profile, signOut } = useAuth();
  const { activeBranch, setActiveBranch } = useBranch();
  const { modules, toggleModule, isUpdating } = useAppModules();

  // Branch Switcher State
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const availableBranches = getAvailableBranches(profile?.email, profile?.role, profile?.branch_assigned);
  const [hasDelegation, setHasDelegation] = useState(false);
  const isSuperAdmin = profile?.role === 'super_admin';

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

  const canSwitch = true;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsBranchDropdownOpen(false);
      }
    }
    if (isBranchDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isBranchDropdownOpen]);

  // Handle Site-Wide Branch Theming
  useEffect(() => {
    const branchClass = `branch-${activeBranch || 'global'}`;

    // Remove all branch classes
    document.body.classList.remove('branch-calicut', 'branch-cochin', 'branch-global');

    // Add active branch class
    document.body.classList.add(branchClass);

    return () => {
      document.body.classList.remove(branchClass);
    };
  }, [activeBranch]);

  const currentBranchName = activeBranch === 'calicut' ? 'Calicut' : activeBranch === 'cochin' ? 'Cochin' : 'Global View';

  // Management dropdown state
  const [showManagementMenu, setShowManagementMenu] = useState(false);
  const managementRef = useRef<HTMLDivElement>(null);
  const isMithun = isMithunEmail(profile?.email);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (managementRef.current && !managementRef.current.contains(event.target as Node)) {
        setShowManagementMenu(false);
      }
    }
    if (showManagementMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showManagementMenu]);

  // --- NAVIGATION ITEMS ---
  const topNavItems = [
    { id: 'command-center', label: 'LIVE', icon: LayoutDashboard },
    { id: 'fets-calendar', label: 'CALENDAR', icon: CalendarDays },
    { id: 'fets-roster', label: 'ROSTER', icon: UserCheck },
  ];

  // Mithun-only nav items — hidden from all other users
  const mithunNavItems = [
    { id: 'fets-calendar-demo', label: 'CELPIP', icon: CalendarDays },
    { id: 'client-portal', label: 'CLIENTS', icon: Briefcase },
    { id: 'branch-delegation', label: 'BRANCH ACCESS', icon: Shield },
  ];

  const secondRowItems = [
    { id: 'system-manager', label: 'SYSTEM MANAGER', icon: Server },
    { id: 'lost-and-found', label: 'LOST & FOUND', icon: PackageSearch },
    { id: 'fets-intelligence', label: 'FETS AI', icon: Brain },
  ].filter(item => {
    const moduleState = modules.find(m => m.id === item.id);
    if (moduleState && !moduleState.is_enabled) return false;
    return true;
  });

  const handleSignOut = async () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      await signOut();
    }
  };

  const NavRow = ({ item, onClick }: { item: { id: string; label: string; icon: React.ElementType }; onClick: () => void }) => {
    const isActive = activeTab === item.id;
    return (
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all border ${
          isActive
            ? 'bg-[#FACC15]/10 border-[#FACC15]/20 text-[#FACC15]'
            : 'bg-white/[0.03] border-white/[0.06] text-white/60 active:bg-white/10'
        }`}
      >
        <div className={`p-2 rounded-xl ${isActive ? 'bg-[#FACC15]/20' : 'bg-white/5'}`}>
          <item.icon size={18} className={isActive ? 'text-[#FACC15]' : 'text-white/50'} />
        </div>
        <span className="text-[11px] font-black uppercase tracking-[0.2em] flex-1 text-left">{item.label}</span>
        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[#FACC15]" />}
      </button>
    );
  };

  const MobileMenu = () => (
    <motion.div
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 220 }}
      className="fixed inset-0 z-[100] bg-[#0A0A0B] flex flex-col"
    >
      {/* Top bar */}
      <div className="px-5 pt-12 pb-4 flex items-center justify-between">
        <FetsLogo />
        <button
          onClick={() => setSidebarOpen?.(false)}
          className="p-2.5 bg-white/5 rounded-xl text-white/50 active:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Profile card */}
      <div className="px-5 pb-5">
        <div className="flex items-center gap-3 p-4 bg-white/[0.04] border border-white/[0.07] rounded-2xl">
          <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-[#FACC15]/30 shrink-0">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-xl font-black">
                {profile?.full_name?.charAt(0)}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-white truncate">{profile?.full_name}</p>
            <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mt-0.5">{profile?.role?.replace('_', ' ')}</p>
          </div>
          {canSwitch && activeTab !== 'news-manager' && activeTab !== 'news' && (
            <button
              onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all text-[9px] font-bold uppercase tracking-widest ${
                isBranchDropdownOpen ? 'bg-[#FACC15]/10 border-[#FACC15]/40 text-[#FACC15]' : 'bg-white/5 border-white/10 text-white/50'
              }`}
            >
              <MapPin size={10} />
              {currentBranchName.split(' ')[0]}
              <ChevronDown size={10} className={`transition-transform ${isBranchDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>

        {/* Branch picker */}
        <AnimatePresence>
          {isBranchDropdownOpen && canSwitch && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-2 flex gap-2">
                {availableBranches.map((branch) => (
                  <button
                    key={branch}
                    onClick={() => { setActiveBranch(branch as any); setIsBranchDropdownOpen(false); }}
                    className={`flex-1 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all border ${
                      activeBranch === branch
                        ? 'bg-[#FACC15]/10 border-[#FACC15]/30 text-[#FACC15]'
                        : 'bg-white/[0.03] border-white/[0.06] text-white/40'
                    }`}
                  >
                    {formatBranchName(branch)}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Scrollable nav */}
      <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-6">

        {/* Core navigation */}
        <div>
          <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.35em] mb-2.5 pl-1">Navigation</p>
          <div className="space-y-1.5">
            {topNavItems.map((item) => (
              <NavRow
                key={item.id}
                item={item}
                onClick={() => { setActiveTab?.(item.id); setSidebarOpen?.(false); }}
              />
            ))}
          </div>
        </div>



        {/* Management tools (collapsible) */}
        <div>
          <button
            onClick={() => setShowManagementMenu(!showManagementMenu)}
            className="w-full flex items-center justify-between mb-2.5 pl-1 pr-2 group"
          >
            <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.35em] group-hover:text-white/50 transition-colors">Management</p>
            <ChevronDown size={12} className={`text-white/20 transition-transform group-hover:text-white/40 ${showManagementMenu ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {showManagementMenu && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-1.5">
                  {/* Raise a case — always visible */}
                  <button
                    onClick={() => { setActiveTab?.('incident-log'); setSidebarOpen?.(false); setShowManagementMenu(false); }}
                    className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all border ${
                      activeTab === 'incident-log'
                        ? 'bg-[#FACC15]/10 border-[#FACC15]/20 text-[#FACC15]'
                        : 'bg-white/[0.03] border-white/[0.06] text-white/60 active:bg-white/10'
                    }`}
                  >
                    <div className={`p-2 rounded-xl ${activeTab === 'incident-log' ? 'bg-[#FACC15]/20' : 'bg-white/5'}`}>
                      <AlertCircle size={18} className={activeTab === 'incident-log' ? 'text-[#FACC15]' : 'text-white/50'} />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] flex-1 text-left">Raise A Case</span>
                    {activeTab === 'incident-log' && <div className="w-1.5 h-1.5 rounded-full bg-[#FACC15]" />}
                  </button>

                  {/* Dynamic second-row items (system manager, lost & found, fets ai) */}
                  {secondRowItems.map((item) => (
                    <NavRow
                      key={item.id}
                      item={item}
                      onClick={() => { setActiveTab?.(item.id); setSidebarOpen?.(false); setShowManagementMenu(false); }}
                    />
                  ))}

                  {/* Mithun admin tools */}
                  {isMithun && (
                    <>
                      <div className="h-px bg-white/5 my-2" />
                      {modules.map(mod => (
                        <div
                          key={mod.id}
                          className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]"
                        >
                          <button
                            onClick={() => { setActiveTab?.(mod.id); setSidebarOpen?.(false); setShowManagementMenu(false); }}
                            className="flex items-center gap-3 flex-1 text-left"
                          >
                            <div className="p-2 rounded-xl bg-white/5">
                              <Layers size={16} className="text-white/40" />
                            </div>
                            <div>
                              <div className="text-[10px] font-black uppercase tracking-wider text-white/70">{mod.name}</div>
                              <div className="text-[8px] text-white/30 uppercase tracking-widest">{mod.id.replace(/-/g, ' ')}</div>
                            </div>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleModule(mod.id, !mod.is_enabled); }}
                            disabled={isUpdating}
                            className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all ${mod.is_enabled ? 'bg-[#FACC15] text-black' : 'bg-white/10 text-white/40'}`}
                          >
                            {mod.is_enabled ? 'ON' : 'OFF'}
                          </button>
                        </div>
                      ))}
                      <div className="h-px bg-white/5 my-1" />
                      <button
                        onClick={() => { setActiveTab?.('candidate-tracker'); setSidebarOpen?.(false); setShowManagementMenu(false); }}
                        className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all border ${
                          activeTab === 'candidate-tracker'
                            ? 'bg-[#FACC15]/10 border-[#FACC15]/20 text-[#FACC15]'
                            : 'bg-white/[0.03] border-white/[0.06] text-white/60 active:bg-white/10'
                        }`}
                      >
                        <div className={`p-2 rounded-xl ${activeTab === 'candidate-tracker' ? 'bg-[#FACC15]/20' : 'bg-white/5'}`}>
                          <ClipboardList size={18} className={activeTab === 'candidate-tracker' ? 'text-[#FACC15]' : 'text-cyan-400/70'} />
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] flex-1 text-left">Fets Register</span>
                        {activeTab === 'candidate-tracker' && <div className="w-1.5 h-1.5 rounded-full bg-[#FACC15]" />}
                      </button>
                      <button
                        onClick={() => { setActiveTab?.('user-management'); setSidebarOpen?.(false); setShowManagementMenu(false); }}
                        className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all border ${
                          activeTab === 'user-management'
                            ? 'bg-[#FACC15]/10 border-[#FACC15]/20 text-[#FACC15]'
                            : 'bg-white/[0.03] border-white/[0.06] text-white/60 active:bg-white/10'
                        }`}
                      >
                        <div className={`p-2 rounded-xl ${activeTab === 'user-management' ? 'bg-[#FACC15]/20' : 'bg-white/5'}`}>
                          <Shield size={18} className={activeTab === 'user-management' ? 'text-[#FACC15]' : 'text-white/40'} />
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] flex-1 text-left">User Management</span>
                        {activeTab === 'user-management' && <div className="w-1.5 h-1.5 rounded-full bg-[#FACC15]" />}
                      </button>
                      {mithunNavItems.map((item) => (
                        <NavRow
                          key={item.id}
                          item={item}
                          onClick={() => { setActiveTab?.(item.id); setSidebarOpen?.(false); setShowManagementMenu(false); }}
                        />
                      ))}
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2.5 py-4 bg-red-500/8 text-red-400 rounded-2xl border border-red-500/15 font-black uppercase tracking-widest text-[10px] active:bg-red-500/15 transition-colors"
        >
          <LogOut size={15} />
          <span>Terminate Session</span>
        </button>

        <div className="pb-2 text-center">
          <span className="text-[8px] font-black uppercase tracking-[0.5em] text-white/20">
            F.E.T.S | GLOBAL GRID v4.0.1
          </span>
        </div>
      </div>
    </motion.div>
  );

  return (
    <>
      <div className="relative z-40 fets-command-deck transition-all duration-300 w-full border-b border-white/5">
        {/* --- ROW 1: CORE MODULES (The Command Deck) — taller for breathing room --- */}
        <div className="max-w-[1920px] mx-auto px-4 md:px-8 min-h-[7.5rem] md:min-h-[9.5rem] py-4 md:py-5 relative z-20 flex items-center justify-between gap-4 md:gap-8">

          {/* LEFT: Branding */}
          <div className="flex items-center gap-4 md:gap-6 shrink-0 w-64">
            {isMobile && (
              <button
                onClick={() => setSidebarOpen?.(true)}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <Menu size={24} />
              </button>
            )}
          </div>

          {/* CENTER: CORE NAVIGATION */}
          <div className="hidden lg:flex flex-1 justify-center items-center">
            <div className="flex items-center">
              <div className="text-[#FACC15] font-black text-7xl md:text-8xl mr-5 md:mr-6 leading-none tracking-tighter">F</div>
              <div className="flex flex-col gap-3 md:gap-3.5 border-l-4 border-[#FACC15]/30 pl-5 md:pl-6 py-2">
                {topNavItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab && setActiveTab(item.id)}
                    className={`text-left text-base md:text-lg font-black tracking-[0.22em] transition-colors flex items-center gap-3 py-0.5 ${activeTab === item.id ? 'text-[#FACC15]' : 'text-white/60 hover:text-white'}`}
                  >
                    {item.label}
                  </button>
                ))}

              </div>
            </div>
          </div>

          {/* RIGHT: COMMAND CONTROLS */}
          <div className="flex items-center justify-end gap-3 md:gap-4 shrink-0 w-[360px]">
            {!isMobile && activeTab !== 'news-manager' && activeTab !== 'news' && (
              <LocationSelectorThread
                activeBranch={activeBranch}
                setActiveBranch={setActiveBranch as any}
                availableBranches={availableBranches}
                canSwitch={canSwitch}
              />
            )}

            {/* MANAGEMENT DROPDOWN (Desktop) - MOVED TO COMMAND CENTRE */}

            {/* EXIT Button (Desktop) */}
            {!isMobile && (
              <button
                onClick={handleSignOut}
                className="fets-pill-control exit-btn border border-white/10 hover:border-red-500/50 transition-all"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}

            {/* Profile Avatar (Mobile) */}
            {isMobile && (
              <button
                onClick={() => setSidebarOpen?.(true)}
                className="w-8 h-8 rounded-full overflow-hidden border border-[#FACC15]/30"
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#FACC15] flex items-center justify-center text-black font-bold text-[10px]">
                    {profile?.full_name?.charAt(0)}
                  </div>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* --- MOBILE SIDEBAR --- */}
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <MobileMenu key="mobile-menu" />
        )}
      </AnimatePresence>
    </>
  );
}
