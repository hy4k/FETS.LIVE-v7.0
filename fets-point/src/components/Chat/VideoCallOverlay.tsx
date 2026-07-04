import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Maximize2, Minimize2, User, Clock, MoreVertical } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface VideoCallOverlayProps {
    localStream: MediaStream | null;
    remoteStreams: Record<string, MediaStream>; // Keyed by User ID
    onEndCall: () => void;
    isMinimized?: boolean;
    onToggleMinimize?: () => void;
    callType?: 'video' | 'audio';
    startTime?: number | null;
}

const RemoteVideoTile = ({ stream, userId, callType }: { stream: MediaStream, userId: string, callType: 'video' | 'audio' }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [userName, setUserName] = useState('Loading...');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    useEffect(() => {
        const fetchName = async () => {
            let { data } = await supabase.from('staff_profiles').select('full_name, avatar_url').eq('id', userId).single();
            if (!data) {
                const res = await supabase.from('staff_profiles').select('full_name, avatar_url').eq('user_id', userId).single();
                data = res.data;
            }
            if (data) {
                setUserName(data.full_name);
                setAvatarUrl(data.avatar_url);
            }
        };
        fetchName();
    }, [userId]);

    const isVideoRenderable = callType === 'video' && stream?.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled;

    return (
        <div className="relative w-full h-full bg-slate-900 rounded-2xl overflow-hidden border border-white/5 shadow-inner group">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${!isVideoRenderable ? 'hidden' : ''}`}
            />

            {/* Audio/Avatar Placeholder */}
            {!isVideoRenderable && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0f172a] gap-4">
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-500 via-transparent to-transparent animate-pulse" />
                    <div className="w-24 h-24 rounded-full border-2 border-white/10 overflow-hidden shadow-2xl relative z-10 p-1">
                        <div className="w-full h-full rounded-full overflow-hidden bg-slate-800 flex items-center justify-center">
                            {avatarUrl ? (
                                <img src={avatarUrl} className="w-full h-full object-cover" alt="User" />
                            ) : (
                                <User className="text-white/20 w-10 h-10" />
                            )}
                        </div>
                        {/* Audio Indicator Pulse */}
                        <motion.div
                            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className="absolute inset-0 border-4 border-emerald-500/30 rounded-full"
                        />
                    </div>
                    <div className="flex flex-col items-center gap-1 z-10">
                        <span className="text-white font-black text-xs uppercase tracking-[0.2em]">{userName}</span>
                        <span className="text-emerald-400/60 text-[8px] font-bold uppercase tracking-widest">Voice Uplink Only</span>
                    </div>
                </div>
            )}

            <div className="absolute bottom-4 left-4 flex items-center gap-2 z-20">
                <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg text-[10px] font-black text-white uppercase tracking-wider flex items-center gap-3 border border-white/10">
                    <div className={`w-1.5 h-1.5 rounded-full ${isVideoRenderable ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                    {userName}
                    {callType === 'audio' && <Mic size={10} className="text-emerald-400" />}
                </div>
            </div>
        </div>
    );
};

export const VideoCallOverlay: React.FC<VideoCallOverlayProps> = ({
    localStream,
    remoteStreams,
    onEndCall,
    isMinimized = false,
    onToggleMinimize,
    callType = 'video',
    startTime
}) => {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
    const [duration, setDuration] = useState('00:00');

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    useEffect(() => {
        if (!startTime) return;
        const interval = setInterval(() => {
            const diff = Date.now() - startTime;
            const mins = Math.floor(diff / 60000).toString().padStart(2, '0');
            const secs = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
            setDuration(`${mins}:${secs}`);
        }, 1000);
        return () => clearInterval(interval);
    }, [startTime]);

    const toggleMute = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (localStream && callType === 'video') {
            localStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
            setIsVideoEnabled(!isVideoEnabled);
        }
    };

    const participantsCount = Object.keys(remoteStreams).length;
    const gridCols = participantsCount <= 1 ? 'grid-cols-1' : participantsCount <= 4 ? 'grid-cols-2' : 'grid-cols-3';

    return (
        <motion.div
            drag
            dragConstraints={{ left: -1000, right: 1000, top: -1000, bottom: 1000 }} // Large bounds
            dragMomentum={false}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`
                fixed z-[1000] overflow-hidden bg-[#0f172a] rounded-[32px] border-2 shadow-[0_40px_100px_rgba(0,0,0,0.8)]
                ${callType === 'audio' ? 'border-emerald-500/30' : 'border-[#ffbf00]/30'}
                ${isMinimized
                    ? 'w-64 h-40 bottom-8 right-8 cursor-move'
                    : 'w-[90vw] sm:w-[80vw] max-w-[1000px] h-[75vh] top-[12.5vh] left-[5vw] sm:left-[10vw] cursor-move'}
            `}
            style={{
                boxShadow: callType === 'audio' ? '0 0 50px rgba(16,185,129,0.1)' : '0 0 50px rgba(255,191,0,0.1)'
            }}
        >
            {/* Drag Handle Overlay (invisible but indicates area) */}
            <div className="absolute top-0 left-0 right-0 h-20 z-[100] cursor-move" />

            {/* Header / Info Bar */}
            <div className="absolute top-0 left-0 right-0 p-6 z-50 flex justify-between items-center bg-gradient-to-b from-slate-950/80 to-transparent pointer-events-none">
                <div className="flex items-center gap-4 pointer-events-auto">
                    <div className="relative">
                        <div className={`w-3 h-3 rounded-full ${callType === 'audio' ? 'bg-emerald-500' : 'bg-[#ffbf00]'} animate-pulse`} />
                        <div className={`absolute inset-0 w-3 h-3 rounded-full ${callType === 'audio' ? 'bg-emerald-500' : 'bg-[#ffbf00]'} animate-ping opacity-50`} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em] leading-none mb-1">
                            {callType === 'audio' ? 'Voice Uplink Active' : 'Mesh Video Link Active'}
                        </span>
                        <div className="flex items-center gap-2">
                            <Clock size={12} className="text-white/20" />
                            <span className="text-xs font-black text-white font-mono tracking-wider tabular-nums">{duration}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {onToggleMinimize && (
                        <button onClick={onToggleMinimize} className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all border border-white/5">
                            {isMinimized ? <Maximize2 size={18} /> : <Minimize2 size={18} />}
                        </button>
                    )}
                </div>
            </div>

            {/* Main Video Area (Remote Grid) */}
            <div className={`
                absolute inset-0 p-6 pt-24 pb-32 grid gap-4 overflow-hidden
                ${isMinimized ? 'hidden' : gridCols}
            `}>
                <AnimatePresence>
                    {Object.entries(remoteStreams).map(([uid, stream]) => (
                        <motion.div
                            key={uid}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="w-full h-full"
                        >
                            <RemoteVideoTile userId={uid} stream={stream} callType={callType} />
                        </motion.div>
                    ))}
                </AnimatePresence>

                {participantsCount === 0 && (
                    <div className="col-span-full h-full flex flex-col items-center justify-center text-white/10 border-2 border-dashed border-white/5 rounded-3xl">
                        <User size={64} className="mb-4 animate-pulse opacity-20" />
                        <p className="font-black text-xs uppercase tracking-[0.5em] opacity-40">Synchronizing Uplink...</p>
                    </div>
                )}
            </div>

            {/* Local Video (PIP or Main if Minimized) */}
            <div className={`
                absolute transition-all duration-700 overflow-hidden rounded-[24px] border-2 border-white/10 shadow-2xl bg-slate-950 z-[60]
                ${isMinimized ? 'inset-0 border-0 rounded-none' : 'w-48 h-32 bottom-8 right-8'}
            `}>
                {callType === 'video' ? (
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-500"
                        style={{ opacity: isVideoEnabled ? 1 : 0 }}
                    />
                ) : null}

                {/* Local Placeholder */}
                {(!isVideoEnabled || callType === 'audio') && (
                    <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center gap-2">
                        <User size={24} className="text-white/20" />
                        {!isMinimized && <span className="text-[8px] font-black uppercase text-white/30 tracking-[0.2em]">Local Feed Off</span>}
                    </div>
                )}

                {!isMinimized && (
                    <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg text-[9px] font-black text-amber-500 uppercase tracking-widest border border-amber-500/20">
                        Agent (You)
                    </div>
                )}

                {/* Mute Overlay */}
                {isMuted && (
                    <div className="absolute top-3 left-3 p-1.5 bg-rose-500 rounded-lg text-white shadow-lg">
                        <MicOff size={10} />
                    </div>
                )}
            </div>

            {/* Controls Float Bar */}
            {!isMinimized && (
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center p-2 bg-slate-950/40 backdrop-blur-2xl rounded-3xl border border-white/10 z-[70] shadow-2xl">
                    <div className="flex items-center gap-2 px-4">
                        <button
                            onClick={toggleMute}
                            className={`p-4 rounded-2xl transition-all duration-300 flex items-center justify-center
                                ${isMuted ? 'bg-rose-500 text-white' : 'hover:bg-white/10 text-white/70 hover:text-white'}`}
                        >
                            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                        </button>

                        <button
                            onClick={onEndCall}
                            className="mx-4 p-6 rounded-3xl bg-rose-600 border border-rose-500 text-white hover:bg-rose-700 transition-all shadow-[0_0_50px_rgba(225,29,72,0.4)] hover:scale-105 active:scale-95 group"
                        >
                            <PhoneOff size={32} className="group-hover:rotate-[135deg] transition-transform duration-500" />
                        </button>

                        {callType === 'video' && (
                            <button
                                onClick={toggleVideo}
                                className={`p-4 rounded-2xl transition-all duration-300 flex items-center justify-center
                                    ${!isVideoEnabled ? 'bg-rose-500 text-white' : 'hover:bg-white/10 text-white/70 hover:text-white'}`}
                            >
                                {!isVideoEnabled ? <VideoOff size={24} /> : <Video size={24} />}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </motion.div>
    );
};
