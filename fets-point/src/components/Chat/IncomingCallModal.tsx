import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, PhoneOff, Video, User, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface IncomingCallModalProps {
    callerName: string; // This is the user_id (UUID)
    callType?: 'video' | 'audio';
    onAccept: () => void;
    onDecline: () => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({ callerName: callerId, callType = 'video', onAccept, onDecline }) => {
    const [profile, setProfile] = useState<any>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            let { data } = await supabase.from('staff_profiles').select('*').eq('id', callerId).single();
            if (!data) {
                const res = await supabase.from('staff_profiles').select('*').eq('user_id', callerId).single();
                data = res.data;
            }
            if (data) setProfile(data);
        };
        fetchProfile();
    }, [callerId]);

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-md">
            <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className={`bg-[#0f172a] border-2 ${callType === 'audio' ? 'border-emerald-500' : 'border-[#ffbf00]'} p-10 rounded-[40px] shadow-[0_0_120px_rgba(0,0,0,0.8)] max-w-sm w-full text-center relative overflow-hidden`}
            >
                {/* Background Ambience */}
                <div className={`absolute inset-0 bg-gradient-to-br ${callType === 'audio' ? 'from-emerald-500/10' : 'from-[#ffbf00]/10'} to-transparent pointer-events-none`} />
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16" />

                <div className="relative z-10 flex flex-col items-center">
                    <div className="relative mb-8">
                        <div className={`w-24 h-24 rounded-full flex items-center justify-center border-2 p-1 ${callType === 'audio' ? 'border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.3)]' : 'border-[#ffbf00]/50 shadow-[0_0_30px_rgba(255,191,0,0.3)]'}`}>
                            <div className="w-full h-full rounded-full overflow-hidden bg-slate-800 flex items-center justify-center">
                                {profile?.avatar_url ? (
                                    <img src={profile.avatar_url} className="w-full h-full object-cover" alt="Caller" />
                                ) : (
                                    <User size={40} className="text-white/20" />
                                )}
                            </div>
                        </div>
                        <div className={`absolute -bottom-1 -right-1 p-2 rounded-full border-2 border-[#0f172a] ${callType === 'audio' ? 'bg-emerald-500 text-black' : 'bg-[#ffbf00] text-black'} animate-bounce`}>
                            {callType === 'audio' ? <Phone size={14} /> : <Video size={14} />}
                        </div>
                    </div>

                    <div className="space-y-1 mb-10">
                        <h3 className="text-white/40 text-[10px] font-black uppercase tracking-[0.4em] mb-2">
                            Incoming FETSIAN Uplink
                        </h3>
                        <h2 className="text-3xl font-black text-white uppercase tracking-tight">
                            {profile?.full_name || 'Identifying...'}
                        </h2>
                        {profile?.branch_assigned && (
                            <div className="flex items-center justify-center gap-1.5 text-white/40">
                                <MapPin size={10} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">{profile.branch_assigned} Branch</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-4 w-full">
                        <button
                            onClick={onDecline}
                            className="flex-1 py-5 rounded-2xl bg-white/5 hover:bg-rose-600/20 border border-white/10 hover:border-rose-500/50 text-white/50 hover:text-rose-400 font-black uppercase tracking-[0.2em] text-[10px] transition-all flex flex-col items-center gap-2 group"
                        >
                            <PhoneOff size={20} className="group-hover:scale-110 transition-transform" />
                            Decline
                        </button>

                        <button
                            onClick={onAccept}
                            className={`flex-1 py-5 rounded-2xl border font-black uppercase tracking-[0.2em] text-[10px] transition-all flex flex-col items-center gap-2 shadow-[0_0_40px_rgba(0,0,0,0.4)] hover:scale-105 active:scale-95
                                ${callType === 'audio'
                                    ? 'bg-emerald-500 border-emerald-400 text-black shadow-emerald-500/20'
                                    : 'bg-[#ffbf00] border-[#ffe16b] text-black shadow-[#ffbf00]/20'
                                }`}
                        >
                            {callType === 'audio' ? <Phone size={20} /> : <Video size={20} />}
                            Accept Link
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
