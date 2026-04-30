import { FetsLogo } from './FetsLogo';
import './HeaderTheme.css'; // Import the new theme
import {
  Bell, ChevronDown, MapPin, LayoutDashboard,
  Brain, ShieldAlert, MessageSquare, ClipboardList,
  CalendarDays, UserSearch, UserCheck, Menu, LogOut,
  Server, Cpu, Shield, X, PackageSearch, AlertCircle, BookOpen, Briefcase,
  ChevronRight, Settings2, Layers, GraduationCap
} from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useBranch } from '../hooks/useBranch';
import { canSwitchBranches, formatBranchName, getAvailableBranches, isMithunEmail } from '../utils/authUtils';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppModules } from '../hooks/useAppModules';
import { LocationSelectorThread } from './LocationSelectorThread';

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

  const availableBranches = getAvailableBranches(profile?.email, profile?.role);
  const canSwitch = canSwitchBranches(profile?.email, profile?.role);

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
    { id: 'fets-calendar-demo', label: 'CELPIP', icon: CalendarDays },
    { id: 'client-portal', label: 'CLIENTS', icon: Briefcase },
    { id: 'fets-roster', label: 'ROSTER', icon: UserCheck },
    { id: 'cma-availability', label: 'CMA US', icon: GraduationCap },
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

  const MobileMenu = () => (
    <motion.div
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-[100] bg-[#0A0A0B] flex flex-col pt-safe"
    >
      {/* Header of Mobile Menu */}
      <div className="p-6 flex items-center justify-between border-b border-white/10">
        <FetsLogo />
        <button
          onClick={() => setSidebarOpen?.(false)}
          className="p-3 bg-white/5 rounded-xl text-white/60 active:bg-white/10"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Profile Section */}
      <div className="px-6 py-8">
        <div className="flex flex-col gap-4 p-5 bg-white/5 border border-white/10 rounded-2xl">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl overflow-hidden shadow-lg border-2 border-[#FACC15]/40 p-0.5 bg-black/40">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover rounded-lg" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-2xl font-black rounded-lg">
                  {profile?.full_name?.charAt(0)}
                </div>
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-black text-white tracking-tight leading-tight">{profile?.full_name}</h2>
              <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mt-0.5">{profile?.role?.replace('_', ' ')}</p>
            </div>
          </div>
          
          {/* Controls inside Profile Section */}
          <div className="flex items-center gap-2 pt-2 border-t border-white/10">
            {canSwitch && (
              <button
                onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
                className={`
                  flex-1 flex items-center justify-between px-3 py-2 transition-all duration-300
                  rounded-lg border border-white/10
                  ${isBranchDropdownOpen ? 'bg-[#FACC15]/10 border-[#FACC15]/50' : 'bg-white/5'}
                `}
              >
                <div className="flex items-center gap-2">
                  <MapPin size={12} className="text-[#FACC15]" />
                  <span className="text-[10px] font-bold text-white uppercase tracking-widest">
                    {currentBranchName}
                  </span>
                </div>
                <ChevronDown size={12} className={`text-white/30 transition-transform duration-300 ${isBranchDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
            )}

            <button
              onClick={() => setShowManagementMenu(!showManagementMenu)}
              className={`
                flex-1 flex items-center justify-between px-3 py-2 transition-all duration-300
                rounded-lg border border-white/10
                ${showManagementMenu ? 'bg-[#FACC15]/10 border-[#FACC15]/50' : 'bg-white/5'}
              `}
            >
              <div className="flex items-center gap-2">
                <Settings2 size={12} className="text-[#FACC15]" />
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">MGMT</span>
              </div>
              <ChevronDown size={12} className={`text-white/30 transition-transform duration-300 ${showManagementMenu ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Branch Dropdown Content */}
          <AnimatePresence>
            {isBranchDropdownOpen && canSwitch && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-2 space-y-1">
                  {availableBranches.map((branch) => (
                    <button
                      key={branch}
                      onClick={() => { setActiveBranch(branch as any); setIsBranchDropdownOpen(false); }}
                      className={`
                        w-full flex items-center justify-between px-3 py-2 text-[10px] font-medium uppercase tracking-widest transition-all rounded-lg
                        ${activeBranch === branch
                          ? 'bg-[#FACC15]/10 text-[#FACC15]'
                          : 'text-white/60 hover:bg-white/5 hover:text-white'
                        }
                      `}
                    >
                      <span>{formatBranchName(branch)}</span>
                      {activeBranch === branch && <div className="w-1.5 h-1.5 bg-[#FACC15] rounded-full" />}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Management Dropdown Content */}
          <AnimatePresence>
            {showManagementMenu && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-2 space-y-1">
                  <button
                    onClick={() => { setActiveTab?.('incident-log'); setSidebarOpen?.(false); setShowManagementMenu(false); }}
                    className="w-full flex items-center justify-between p-2 rounded-lg transition-all hover:bg-white/5 text-white/80"
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle size={14} className="text-white/40" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Raise A Case</span>
                    </div>
                    <ChevronRight size={12} className="opacity-20" />
                  </button>

                  {secondRowItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => { setActiveTab?.(item.id); setSidebarOpen?.(false); setShowManagementMenu(false); }}
                      className="w-full flex items-center justify-between p-2 rounded-lg transition-all hover:bg-white/5 text-white/80"
                    >
                      <div className="flex items-center gap-2">
                        <item.icon size={14} className="text-white/40" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
                      </div>
                      <ChevronRight size={12} className="opacity-20" />
                    </button>
                  ))}

                  {isMithun && modules.map(mod => (
                    <div
                      key={mod.id}
                      className="flex items-center justify-between p-2 rounded-lg transition-all hover:bg-white/5"
                    >
                      <button
                        onClick={() => { setActiveTab?.(mod.id); setSidebarOpen?.(false); setShowManagementMenu(false); }}
                        className="flex items-center gap-2 flex-1 text-left"
                      >
                        <div className="p-1.5 rounded-md bg-white/5 text-white/40">
                          <Layers size={14} />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-white/80">{mod.name}</div>
                          <div className="text-[8px] text-white/30 uppercase tracking-widest">{mod.id.replace(/-/g, ' ')}</div>
                        </div>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleModule(mod.id, !mod.is_enabled); }}
                        disabled={isUpdating}
                        className={`px-2 py-1 rounded-md text-[8px] font-bold uppercase transition-all ${mod.is_enabled ? 'bg-[#FACC15] text-black' : 'bg-white/10 text-white/40'}`}
                      >
                        {mod.is_enabled ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  ))}

                  {isMithun && (
                    <>
                      <div className="h-px bg-white/5 my-1.5" />
                      <button
                        onClick={() => { setActiveTab?.('candidate-tracker'); setSidebarOpen?.(false); setShowManagementMenu(false); }}
                        className="w-full flex items-center justify-between p-2 rounded-lg transition-all hover:bg-white/5 text-white/80"
                      >
                        <div className="flex items-center gap-2">
                          <ClipboardList size={14} className="text-cyan-400" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Fets Register</span>
                        </div>
                        <ChevronRight size={12} className="opacity-20" />
                      </button>
                      <button
                        onClick={() => { setActiveTab?.('user-management'); setSidebarOpen?.(false); setShowManagementMenu(false); }}
                        className="w-full flex items-center justify-between p-2 rounded-lg transition-all hover:bg-white/5 text-white/80"
                      >
                        <div className="flex items-center gap-2">
                          <Shield size={14} className="text-white/40" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">User Management</span>
                        </div>
                        <ChevronRight size={12} className="opacity-20" />
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-6 pb-10 space-y-6">
        <div>
          <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-3 pl-2">Core Command</h3>
          <div className="grid grid-cols-2 gap-3">
            {topNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => { setActiveTab?.(item.id); setSidebarOpen?.(false); }}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl transition-all border ${activeTab === item.id
                  ? 'bg-[#FACC15]/10 border-[#FACC15]/30 text-[#FACC15]'
                  : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                  }`}
              >
                <item.icon size={24} />
                <span className="text-[9px] font-black uppercase tracking-wider text-center leading-tight">
                  {item.label.split(' ').join('\n')}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 space-y-3">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 p-4 bg-red-500/10 text-red-500 rounded-2xl border border-red-500/20 font-black uppercase tracking-widest text-[10px]"
          >
            <LogOut size={16} />
            <span>Terminate Session</span>
          </button>
        </div>

        {/* Version Info */}
        <div className="p-6 text-center opacity-30">
          <span className="text-[8px] font-black uppercase tracking-[0.5em] text-white/60">
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
            {!isMobile && (
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
