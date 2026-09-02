import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
  Radio, Sparkles, Send, Settings, Volume2,
  Play, Square, RefreshCw, Bot, Shield,
  CheckCircle2, Info, ArrowUpRight, Cpu, Layers
} from 'lucide-react';
import {
  GeminiLiveClient,
  GeminiLiveVoice,
  LiveMessageTurn,
} from '../../lib/geminiLiveClient';
import { useAuth } from '../../hooks/useAuth';
import { useBranch } from '../../hooks/useBranch';
import { toast } from 'react-hot-toast';

interface GeminiLiveStudioProps {
  embedded?: boolean;
  onOpenTeamChat?: () => void;
  branch?: string;
}

const VOICES: { id: GeminiLiveVoice; label: string; desc: string }[] = [
  { id: 'Zephyr', label: 'Zephyr (Default)', desc: 'Smooth, clear operational cadence' },
  { id: 'Aoede', label: 'Aoede', desc: 'Warm & articulate' },
  { id: 'Puck', label: 'Puck', desc: 'Energetic & rapid' },
  { id: 'Charon', label: 'Charon', desc: 'Deep & authoritative' },
  { id: 'Fenrir', label: 'Fenrir', desc: 'Crisp & direct' },
  { id: 'Kore', label: 'Kore', desc: 'Calm & reassuring' },
];

export const GeminiLiveStudio: React.FC<GeminiLiveStudioProps> = ({
  embedded = false,
  onOpenTeamChat,
  branch: propBranch,
}) => {
  const { profile } = useAuth();
  const { activeBranch } = useBranch();
  const currentBranch = propBranch || activeBranch || 'calicut';

  // Live state
  const [client, setClient] = useState<GeminiLiveClient | null>(null);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'speaking' | 'listening' | 'error'>('disconnected');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [turns, setTurns] = useState<LiveMessageTurn[]>([]);
  const [textInput, setTextInput] = useState('');

  // Audio / Video stream states
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isScreenOn, setIsScreenOn] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<GeminiLiveVoice>('Zephyr');

  // Visualizer levels
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
  const [frequencies, setFrequencies] = useState<number[]>(new Array(16).fill(0));

  // Settings
  const [showSettings, setShowSettings] = useState(false);

  // Media references
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Stable ref for system prompt values (avoids recreating client on profile load)
  const branchRef = useRef(currentBranch);
  const nameRef = useRef(profile?.full_name || 'Staff');
  branchRef.current = currentBranch;
  nameRef.current = profile?.full_name || 'Staff';

  // Initialize client once on mount
  useEffect(() => {
    const buildSystemPrompt = () =>
      `You are FETS LIVE OMNI, the real-time AI multimodal assistant for FETS (Frontline Examination & Testing Services). ` +
      `Current Centre: ${branchRef.current.toUpperCase()}. User: ${nameRef.current}. ` +
      `You provide instant, real-time voice, vision, and text intelligence for exam sessions (Pearson VUE, Prometric, IELTS, CELPIP, PSI, CMA), ` +
      `incident escalation, invigilation rules, candidate verification, and daily staff handovers. ` +
      `Keep voice responses concise, conversational, and direct.`;

    const liveClient = new GeminiLiveClient({
      voiceName: selectedVoice,
      model: 'models/gemini-3.1-flash-live-preview',
      systemPrompt: buildSystemPrompt(),
      onTurnUpdate: (updatedTurn) => {
        setTurns((prev) => {
          const index = prev.findIndex((t) => t.id === updatedTurn.id);
          if (index !== -1) {
            const next = [...prev];
            next[index] = updatedTurn;
            return next;
          }
          return [...prev, updatedTurn];
        });
      },
      onStatusChange: (newStatus, msg) => {
        setStatus(newStatus);
        if (msg) setErrorMsg(msg);
        else if (newStatus === 'connected') setErrorMsg(null);
      },
      onAudioVisualizerData: (inLvl, outLvl, freqData) => {
        setInputLevel(inLvl);
        setOutputLevel(outLvl);
        const sampled: number[] = [];
        const step = Math.floor(freqData.length / 16);
        for (let i = 0; i < 16; i++) {
          sampled.push(freqData[i * step] || 0);
        }
        setFrequencies(sampled);
      },
    });

    setClient(liveClient);

    return () => {
      liveClient.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update system prompt when branch or profile changes (without recreating client)
  useEffect(() => {
    if (client) {
      client.setSystemPrompt(
        `You are FETS LIVE OMNI, the real-time AI multimodal assistant for FETS (Frontline Examination & Testing Services). ` +
        `Current Centre: ${currentBranch.toUpperCase()}. User: ${profile?.full_name || 'Staff'}. ` +
        `You provide instant, real-time voice, vision, and text intelligence for exam sessions (Pearson VUE, Prometric, IELTS, CELPIP, PSI, CMA), ` +
        `incident escalation, invigilation rules, candidate verification, and daily staff handovers. ` +
        `Keep voice responses concise, conversational, and direct.`
      );
    }
  }, [currentBranch, profile?.full_name, client]);

  // Auto-scroll conversation
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns, status]);

  const handleConnectToggle = async () => {
    if (!client) return;

    if (status === 'connected' || status === 'speaking' || status === 'listening') {
      client.disconnect();
      setIsMicOn(false);
      setIsCameraOn(false);
      setIsScreenOn(false);
      toast('Gemini Live session ended');
    } else {
      try {
        setErrorMsg(null);
        await client.connect();
        toast.success('Connected to Gemini 3.1 Flash Live');
        // Auto-start microphone for instant voice experience
        try {
          await client.startAudioInput();
          setIsMicOn(true);
        } catch {}
      } catch (err: any) {
        toast.error(err?.message || 'Connection failed');
      }
    }
  };

  const handleMicToggle = async () => {
    if (!client || !client.isConnected()) {
      toast.error('Connect to Gemini Live first');
      return;
    }

    if (isMicOn) {
      client.stopAudioInput();
      setIsMicOn(false);
    } else {
      await client.startAudioInput();
      setIsMicOn(true);
    }
  };

  const handleCameraToggle = async () => {
    if (!client || !client.isConnected()) {
      toast.error('Connect to Gemini Live first');
      return;
    }

    if (isCameraOn) {
      client.stopCameraStream();
      setIsCameraOn(false);
      if (videoRef.current) videoRef.current.srcObject = null;
    } else {
      try {
        const stream = await client.startCameraStream();
        setIsCameraOn(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        toast.success('Camera streaming active at 1 FPS');
      } catch (err: any) {
        toast.error('Camera access failed');
      }
    }
  };

  const handleScreenToggle = async () => {
    if (!client || !client.isConnected()) {
      toast.error('Connect to Gemini Live first');
      return;
    }

    if (isScreenOn) {
      client.stopScreenStream();
      setIsScreenOn(false);
      if (screenRef.current) screenRef.current.srcObject = null;
    } else {
      try {
        const stream = await client.startScreenStream();
        setIsScreenOn(true);
        if (screenRef.current) {
          screenRef.current.srcObject = stream;
        }
        toast.success('Screen share streaming active');
      } catch (err: any) {
        toast.error('Screen share cancelled');
      }
    }
  };

  const handleSendText = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!textInput.trim() || !client) return;

    if (!client.isConnected()) {
      toast.error('Connect to Gemini Live to send messages');
      return;
    }

    client.sendText(textInput);
    setTextInput('');
  };

  const handleVoiceChange = (voice: GeminiLiveVoice) => {
    setSelectedVoice(voice);
    if (client) client.setVoice(voice);
    toast.success(`Voice set to ${voice}`);
  };

  const quickPrompts = [
    "Check today's Pearson & Prometric exam session schedule",
    "Candidate verification checklist for IELTS exam",
    "How do I escalate a workstation network disconnection?",
    "Generate a summary for the current shift handover",
  ];

  return (
    <div className={`flex flex-col h-full w-full bg-[#0B1120] text-slate-100 rounded-2xl border border-white/10 overflow-hidden shadow-2xl ${embedded ? 'min-h-[620px]' : 'h-screen'}`}>
      {/* TOP DECK HEADER */}
      <header className="px-5 py-3.5 bg-[#0F172A]/90 backdrop-blur-xl border-b border-white/10 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 shadow-lg ${
              status === 'speaking'
                ? 'bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-500 shadow-amber-500/30 animate-pulse'
                : status === 'listening'
                ? 'bg-gradient-to-tr from-emerald-500 to-cyan-500 shadow-emerald-500/30'
                : status === 'connected'
                ? 'bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-indigo-500/20'
                : 'bg-slate-800 border border-white/10'
            }`}>
              <Bot size={20} className="text-white" />
            </div>
            {status !== 'disconnected' && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#0F172A] animate-ping" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black tracking-wider uppercase text-white flex items-center gap-2">
                Gemini 3.1 Flash Live
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[9px] font-black tracking-widest uppercase">
                  Multimodal AI
                </span>
              </h2>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Radio size={12} className={status === 'connected' || status === 'speaking' || status === 'listening' ? 'text-emerald-400 animate-pulse' : 'text-slate-500'} />
                {status === 'speaking' ? 'Gemini Speaking (24kHz)' : status === 'listening' ? 'Listening (16kHz PCM)' : status === 'connected' ? 'Live Session Active' : status === 'connecting' ? 'Connecting...' : 'Ready to Connect'}
              </span>
              <span>•</span>
              <span className="text-amber-300/80 font-bold uppercase tracking-wider">{currentBranch} Centre</span>
              <span>•</span>
              <span className="text-slate-400">Voice: {selectedVoice}</span>
            </div>
          </div>
        </div>

        {/* Action Pills */}
        <div className="flex items-center gap-2">
          {onOpenTeamChat && (
            <button
              onClick={onOpenTeamChat}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 transition-all flex items-center gap-1.5"
              title="Open Staff Team Chat"
            >
              <Layers size={13} className="text-indigo-400" />
              <span>Team Mesh</span>
            </button>
          )}

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-all"
            title="Voice Settings"
          >
            <Settings size={15} />
          </button>

          <button
            onClick={handleConnectToggle}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-md flex items-center gap-2 ${
              status === 'connected' || status === 'speaking' || status === 'listening'
                ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20'
                : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold shadow-emerald-500/20'
            }`}
          >
            {status === 'connected' || status === 'speaking' || status === 'listening' ? (
              <>
                <Square size={13} fill="currentColor" /> Disconnect
              </>
            ) : (
              <>
                <Play size={13} fill="currentColor" /> Start Live
              </>
            )}
          </button>
        </div>
      </header>

      {/* SETTINGS DRAWER */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-[#0c1322] border-b border-white/10 px-5 py-4 flex flex-col gap-4 text-xs"
          >
            {/* Voice Picker */}
            <div>
              <label className="block text-slate-300 font-bold mb-1.5 text-[11px] uppercase tracking-wider">
                Select Prebuilt Voice Persona
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {VOICES.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => handleVoiceChange(v.id)}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      selectedVoice === v.id
                        ? 'bg-indigo-600/30 border-indigo-400 text-white font-bold'
                        : 'bg-slate-900/50 border-white/5 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-[11px] font-bold">{v.label}</div>
                    <div className="text-[9px] text-slate-400 line-clamp-1">{v.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ERROR BANNER */}
      {errorMsg && (
        <div className="bg-rose-500/10 border-b border-rose-500/20 px-5 py-2.5 flex items-center justify-between text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <Info size={14} className="text-rose-400" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-[10px] uppercase font-bold underline">
            Dismiss
          </button>
        </div>
      )}

      {/* MAIN STUDIO GRID */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* LEFT / CENTER: INTERACTIVE LIVE CONSOLE & MEDIA STREAMS */}
        <div className="flex-1 flex flex-col min-w-0 border-b lg:border-b-0 lg:border-r border-white/10 bg-[#090E1A]">
          {/* MULTIMODAL VIDEO & SCREEN TILES */}
          {(isCameraOn || isScreenOn) && (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-black/40 border-b border-white/10">
              {isCameraOn && (
                <div className="relative aspect-video rounded-xl bg-slate-950 border border-emerald-500/30 overflow-hidden shadow-lg">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-emerald-400 text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Webcam (1 FPS)
                  </div>
                </div>
              )}

              {isScreenOn && (
                <div className="relative aspect-video rounded-xl bg-slate-950 border border-indigo-500/30 overflow-hidden shadow-lg">
                  <video ref={screenRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-indigo-400 text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 border border-indigo-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                    Screen Share Stream
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AUDIO VISUALIZER HUD */}
          <div className="p-6 flex flex-col items-center justify-center relative overflow-hidden bg-gradient-to-b from-[#0F172A]/50 to-transparent border-b border-white/5 min-h-[160px]">
            {/* Ambient visualizer glow */}
            <div
              className="absolute w-72 h-72 rounded-full blur-[90px] pointer-events-none transition-all duration-300"
              style={{
                background:
                  status === 'speaking'
                    ? `radial-gradient(circle, rgba(245, 158, 11, ${outputLevel * 0.5 + 0.1}) 0%, transparent 70%)`
                    : status === 'listening'
                    ? `radial-gradient(circle, rgba(16, 185, 129, ${inputLevel * 0.5 + 0.1}) 0%, transparent 70%)`
                    : 'radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 70%)',
              }}
            />

            {/* Dynamic Waveform Spectrum */}
            <div className="flex items-center gap-1.5 h-16 z-10">
              {frequencies.map((val, idx) => {
                const heightPct = status === 'speaking' ? Math.max(12, (val / 255) * 100) : status === 'listening' ? Math.max(8, inputLevel * 80 * Math.sin((idx / 15) * Math.PI)) : 8;
                return (
                  <motion.div
                    key={idx}
                    animate={{ height: `${heightPct}%` }}
                    transition={{ duration: 0.08, ease: 'easeOut' }}
                    className={`w-1.5 rounded-full transition-colors duration-200 ${
                      status === 'speaking'
                        ? 'bg-gradient-to-t from-amber-500 to-rose-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                        : status === 'listening'
                        ? 'bg-gradient-to-t from-emerald-500 to-cyan-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                        : 'bg-slate-700/60'
                    }`}
                  />
                );
              })}
            </div>

            {/* HUD Status Badge */}
            <div className="mt-3 flex items-center gap-2 z-10">
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                status === 'speaking'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                  : status === 'listening'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                  : status === 'connected'
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                  : 'bg-slate-800 border-white/10 text-slate-400'
              }`}>
                {status === 'speaking' ? '🔊 Gemini Streaming Voice' : status === 'listening' ? '🎙️ Mic Active (Speaking permitted)' : status === 'connected' ? '⚡ Multimodal Live Ready' : '💤 Idle'}
              </span>
            </div>
          </div>

          {/* REALTIME CONVERSATION TRANSCRIPT FEED */}
          <div ref={scrollRef} className="flex-1 p-5 overflow-y-auto space-y-3.5 custom-scrollbar">
            {turns.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-400/20 flex items-center justify-center text-indigo-400 mb-3 shadow-inner">
                  <Sparkles size={24} />
                </div>
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-1">
                  Multimodal Real-Time Live Assistant
                </h3>
                <p className="text-xs text-slate-400 max-w-md mb-4">
                  Speak naturally through your microphone, stream your camera or screen, or type below. Gemini 3.1 Flash responds in real-time with sub-second audio.
                </p>

                {/* Quick Prompts */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                  {quickPrompts.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setTextInput(p);
                        if (client && client.isConnected()) {
                          client.sendText(p);
                        }
                      }}
                      className="p-2.5 text-left rounded-xl bg-slate-900/80 hover:bg-indigo-950/40 border border-white/5 hover:border-indigo-500/30 text-[11px] text-slate-300 transition-all flex items-center justify-between group"
                    >
                      <span className="line-clamp-1">{p}</span>
                      <ArrowUpRight size={12} className="text-slate-500 group-hover:text-indigo-400 shrink-0 ml-1.5" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              turns.map((turn) => (
                <motion.div
                  key={turn.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col ${turn.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <span>{turn.sender === 'user' ? 'You' : 'Gemini 3.1 Flash Live'}</span>
                    <span>•</span>
                    <span>{turn.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </div>

                  <div className={`p-3.5 rounded-2xl max-w-[85%] text-xs leading-relaxed shadow-md ${
                    turn.sender === 'user'
                      ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-tr-none'
                      : 'bg-slate-900/90 border border-white/10 text-slate-100 rounded-tl-none'
                  }`}>
                    <p className="whitespace-pre-wrap">{turn.text || '(Transcribing audio...)'}</p>
                    {turn.hasAudio && (
                      <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-1.5 text-[10px] text-amber-300/90 font-bold">
                        <Volume2 size={12} className="animate-pulse" />
                        <span>Voice Streamed (Zephyr 24kHz)</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>

          {/* BOTTOM CONTROLS & INPUT BAR */}
          <div className="p-4 bg-[#0F172A]/90 border-t border-white/10 flex flex-col gap-3">
            {/* Stream Action Buttons */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleMicToggle}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    isMicOn
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                      : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'
                  }`}
                  title={isMicOn ? 'Mute Microphone' : 'Activate 16kHz Microphone Stream'}
                >
                  {isMicOn ? <Mic size={15} /> : <MicOff size={15} />}
                  <span>{isMicOn ? 'Mic Streaming' : 'Mic Muted'}</span>
                </button>

                <button
                  onClick={handleCameraToggle}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    isCameraOn
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                      : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'
                  }`}
                  title={isCameraOn ? 'Stop Camera' : 'Stream Camera (1 FPS RGB)'}
                >
                  {isCameraOn ? <Video size={15} /> : <VideoOff size={15} />}
                  <span>{isCameraOn ? 'Camera Active' : 'Camera'}</span>
                </button>

                <button
                  onClick={handleScreenToggle}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    isScreenOn
                      ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 shadow-[0_0_10px_rgba(99,102,241,0.2)]'
                      : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'
                  }`}
                  title={isScreenOn ? 'Stop Screen Share' : 'Stream Screen (1 FPS)'}
                >
                  {isScreenOn ? <Monitor size={15} /> : <MonitorOff size={15} />}
                  <span>{isScreenOn ? 'Sharing Screen' : 'Screen Share'}</span>
                </button>
              </div>

              {/* Status Info */}
              <div className="hidden sm:flex items-center gap-2 text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Cpu size={12} className="text-indigo-400" /> Thinking: MINIMAL
                </span>
                <span>•</span>
                <span>104K Window Compression</span>
              </div>
            </div>

            {/* Text input form */}
            <form onSubmit={handleSendText} className="flex items-center gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={
                  status === 'connected' || status === 'speaking' || status === 'listening'
                    ? 'Ask Gemini or describe what you need (Enter to send)...'
                    : 'Click "Start Live" above to connect to Gemini 3.1 Flash...'
                }
                className="flex-1 px-4 py-3 rounded-xl bg-slate-900 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-400 shadow-inner"
              />
              <button
                type="submit"
                disabled={!textInput.trim() || status === 'disconnected'}
                className="p-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md cursor-pointer"
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
