import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, MessageSquare, Users, Radio,
  Bot, Phone, Video, Send, ChevronRight,
  Shield, Activity, Zap, Layers, RefreshCw
} from 'lucide-react';
import { GeminiLiveStudio } from './GeminiLiveStudio';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { StaffProfile } from '../../types/shared';

interface EnhancedChatDeckProps {
  branch?: string;
  onOpenDirectChat?: (staff: any) => void;
  defaultMode?: 'gemini-live' | 'team-chat';
}

export const EnhancedChatDeck: React.FC<EnhancedChatDeckProps> = ({
  branch = 'calicut',
  onOpenDirectChat,
  defaultMode = 'gemini-live',
}) => {
  const { profile } = useAuth();
  const [activeMode, setActiveMode] = useState<'gemini-live' | 'team-chat'>(defaultMode);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [searchStaff, setSearchStaff] = useState('');

  useEffect(() => {
    const fetchStaff = async () => {
      setLoadingStaff(true);
      try {
        const { data } = await supabase
          .from('staff_profiles')
          .select('id, full_name, role, branch_assigned, is_online, avatar_url')
          .order('full_name', { ascending: true });

        if (data && data.length > 0) {
          setStaffList(data);
        } else {
          // Fallback mock
          setStaffList([
            { id: '1', full_name: 'Mithun Mohan', role: 'Super Admin', branch_assigned: 'calicut', is_online: true },
            { id: '2', full_name: 'Duty Lead Cochin', role: 'Centre Lead', branch_assigned: 'cochin', is_online: true },
            { id: '3', full_name: 'Test Administrator', role: 'TCA Invigilator', branch_assigned: 'calicut', is_online: false },
          ]);
        }
      } catch {
        // Safe fallback
      } finally {
        setLoadingStaff(false);
      }
    };

    fetchStaff();
  }, [branch]);

  const filteredStaff = staffList.filter((s) => {
    const matchesBranch = branch === 'all' || branch === 'global' || !s.branch_assigned || (s.branch_assigned || '').toLowerCase().includes(branch.toLowerCase());
    const matchesSearch = !searchStaff || (s.full_name || '').toLowerCase().includes(searchStaff.toLowerCase()) || (s.role || '').toLowerCase().includes(searchStaff.toLowerCase());
    return matchesBranch && matchesSearch;
  });

  const onlineCount = filteredStaff.filter((s) => s.is_online).length;

  return (
    <div className="w-full rounded-[24px] border border-white/[0.08] bg-slate-950/70 backdrop-blur-2xl shadow-2xl overflow-hidden flex flex-col">
      {/* DECK HEADER / MODE TOGGLE */}
      <div className="px-6 py-4 border-b border-white/10 bg-slate-900/80 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 p-0.5 shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full rounded-[10px] bg-slate-950 flex items-center justify-center">
              {activeMode === 'gemini-live' ? (
                <Sparkles size={18} className="text-amber-400 animate-pulse" />
              ) : (
                <MessageSquare size={18} className="text-indigo-400" />
              )}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black tracking-wider uppercase text-white">
                FETS AI & Chat Deck
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[9px] font-black uppercase tracking-widest">
                FETS AI
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {activeMode === 'gemini-live'
                ? 'Gemini 3.1 Flash Multimodal Live Intelligence (Voice, Vision & Screen streaming)'
                : `Chat Deck — Instant Team Roster Messenger (${onlineCount} staff online)`}
            </p>
          </div>
        </div>

        {/* MODE SWITCHER PILLS */}
        <div className="flex items-center p-1 rounded-xl bg-slate-950/80 border border-white/10 shadow-inner">
          <button
            onClick={() => setActiveMode('gemini-live')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              activeMode === 'gemini-live'
                ? 'bg-gradient-to-r from-amber-500/20 to-indigo-500/20 text-amber-300 border border-amber-500/40 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles size={14} className={activeMode === 'gemini-live' ? 'text-amber-400' : ''} />
            <span>Gemini 3.1 Live AI</span>
          </button>

          <button
            onClick={() => setActiveMode('team-chat')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              activeMode === 'team-chat'
                ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-300 border border-indigo-500/40 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users size={14} className={activeMode === 'team-chat' ? 'text-indigo-400' : ''} />
            <span>Chat Deck ({onlineCount})</span>
          </button>
        </div>
      </div>

      {/* BODY CONTENT BASED ON ACTIVE MODE */}
      <div className="p-4 sm:p-6">
        {activeMode === 'gemini-live' ? (
          <GeminiLiveStudio
            embedded={true}
            branch={branch}
            onOpenTeamChat={() => setActiveMode('team-chat')}
          />
        ) : (
          <div className="flex flex-col gap-5">
            {/* SEARCH & FILTERS */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <input
                type="text"
                value={searchStaff}
                onChange={(e) => setSearchStaff(e.target.value)}
                placeholder="Search active duty staff or invigilators..."
                className="flex-1 min-w-[260px] px-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 shadow-inner"
              />

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold text-white">{onlineCount} Online</span>
                <span>•</span>
                <span>{filteredStaff.length} Total Duty Profiles</span>
              </div>
            </div>

            {/* STAFF ROSTER CHAT TILES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
              {filteredStaff.map((staff) => (
                <div
                  key={staff.id}
                  onClick={() => {
                    if (onOpenDirectChat) onOpenDirectChat(staff);
                    else window.dispatchEvent(new CustomEvent('fets-open-chat', { detail: staff }));
                  }}
                  className="p-4 rounded-2xl bg-slate-900/60 hover:bg-indigo-950/40 border border-white/5 hover:border-indigo-500/30 transition-all duration-300 cursor-pointer flex flex-col justify-between gap-3 group shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-black text-white text-sm shadow-md uppercase">
                          {staff.full_name?.charAt(0) || 'S'}
                        </div>
                        {staff.is_online && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900" />
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                          {staff.full_name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {staff.role || 'Staff Member'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px] text-slate-400">
                    <span className="uppercase font-bold tracking-wider text-amber-300/80">
                      📍 {staff.branch_assigned || 'Global'}
                    </span>
                    <span className="text-indigo-400 font-bold group-hover:translate-x-1 transition-transform flex items-center gap-0.5">
                      Chat <ChevronRight size={12} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
