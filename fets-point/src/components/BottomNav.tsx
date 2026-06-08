import React, { useState } from 'react';
import { LayoutDashboard, CalendarDays, AlertCircle, Brain, Globe, X, MapPin, CheckCircle2, GraduationCap, Briefcase, Building2, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBranch } from '../hooks/useBranch';
import { useAppModules } from '../hooks/useAppModules';
import { useAuth } from '../hooks/useAuth';
import { isMithunEmail } from '../utils/authUtils';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  const { profile } = useAuth();
  const { activeBranch, setActiveBranch } = useBranch();
  const { modules } = useAppModules();
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const isMithun = isMithunEmail(profile?.email);

  const branches = [
    { id: 'calicut', label: 'Calicut HQ', sub: 'Kerala, India' },
    { id: 'cochin', label: 'Cochin Center', sub: 'Kerala, India' },
    { id: 'global', label: 'Global View', sub: 'All Centres' }
  ];

  const navItems = [
    { id: 'command-center', label: 'Home', icon: LayoutDashboard },
    { id: 'fets-calendar', label: 'Calendar', icon: CalendarDays },
    { id: 'client-portal', label: 'Clients', icon: Briefcase, restricted: true },
    { id: 'incident-log', label: 'Cases', icon: AlertCircle },
    { id: 'fets-intelligence', label: 'AI', icon: Brain },
    { id: 'branch-delegation', label: 'Branch Access', icon: Shield, restricted: true },
    { id: 'gbp', label: 'GBP', icon: Building2 },
  ].filter(item => {
    if (item.restricted && !isMithun) return false;
    const mod = modules.find(m => m.id === item.id);
    return !mod || mod.is_enabled;
  });

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-[60] lg:hidden pb-safe">
        {/* Sovereign dark bottom bar */}
        <div className="mx-3 mb-3 bg-[#1a3a3d]/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-[#FACC15]/10 flex items-center justify-around px-1 py-1.5"
          style={{
            boxShadow: '0 -4px 30px rgba(0,0,0,0.4), 0 0 20px rgba(250,204,21,0.06)'
          }}
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="relative flex flex-col items-center justify-center w-14 h-14 transition-all duration-300"
              >
                {/* Active indicator glow */}
                {isActive && (
                  <motion.div
                    layoutId="navActiveGlow"
                    className="absolute inset-1 rounded-xl bg-[#FACC15]/10 border border-[#FACC15]/20"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <div className={`relative z-10 p-2 rounded-xl transition-all duration-300 ${isActive
                  ? 'text-[#FACC15]'
                  : 'text-white/30'
                }`}>
                  <item.icon size={20} />
                </div>
                <span className={`relative z-10 text-[7px] font-bold uppercase tracking-wider mt-0.5 transition-all duration-300 ${isActive
                  ? 'text-[#FACC15]'
                  : 'text-white/20'
                }`}>
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* BRANCH SELECTOR BUTTON */}
          <button
            onClick={() => setShowBranchPicker(true)}
            className="relative flex flex-col items-center justify-center w-14 h-14"
          >
            <div className="p-2 rounded-xl bg-[#FACC15]/10 border border-[#FACC15]/20 text-[#FACC15]">
              <Globe size={20} />
            </div>
            <span className="text-[7px] font-bold uppercase tracking-wider mt-0.5 text-[#FACC15]/60">
              Node
            </span>
          </button>
        </div>
      </div>

      {/* BRANCH PICKER BOTTOM SHEET */}
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
                    {activeBranch === b.id && <CheckCircle2 size={18} className="text-[#FACC15]" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
