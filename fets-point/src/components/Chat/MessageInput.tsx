import React, { useState, useRef } from 'react';
import {
    Send, Paperclip, Calculator, Calendar as CalendarIcon, X,
    FileText, Loader2, Video as VideoIcon, Mic, Video, CalendarDays, Radio
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday } from 'date-fns';

interface PendingFile {
    file: File;
    type: 'image' | 'video' | 'voice' | 'file';
    previewUrl?: string;
}

export interface CalculatorSyncState {
    isOpen: boolean;
    display: string;
    prevVal: number | null;
    op: string | null;
    resetNext: boolean;
    activeUserId?: string;
    activeUserName?: string;
}

interface MessageInputProps {
    onSendMessage: (content: string, type?: 'text' | 'voice' | 'file' | 'image' | 'video', filePath?: string) => void;
    onUploadFile?: (file: File) => Promise<string | null>;
    onStartRecordVoice?: () => void;
    onStartRecordVideo?: () => void;
    isUploading?: boolean;
    calcSyncState?: CalculatorSyncState;
    onCalcSyncChange?: (newState: CalculatorSyncState) => void;
    currentUserId?: string;
    currentUserName?: string;
}

// ─── Standalone Floating Calculator App ──────────────────────────────────────
export const StandaloneCalculatorApp: React.FC<{
    syncState: CalculatorSyncState;
    onChange: (s: CalculatorSyncState) => void;
    onClose: () => void;
    currentUserId?: string;
    currentUserName?: string;
}> = ({ syncState, onChange, onClose, currentUserId, currentUserName }) => {
    const { display, prevVal, op, resetNext } = syncState;
    const isPeer = syncState.activeUserId && syncState.activeUserId !== currentUserId;

    const push = (newDisplay: string, newPrev: number | null, newOp: string | null, newReset: boolean) =>
        onChange({ isOpen: true, display: newDisplay, prevVal: newPrev, op: newOp, resetNext: newReset, activeUserId: currentUserId, activeUserName: currentUserName || 'Staff' });

    const num = (n: string) => (display === '0' || resetNext) ? push(n, prevVal, op, false) : push(display + n, prevVal, op, false);
    const operator = (o: string) => push(display, parseFloat(display), o, true);
    const equal = () => {
        if (prevVal === null || !op) return;
        const cur = parseFloat(display);
        let res = op === '+' ? prevVal + cur : op === '-' ? prevVal - cur : op === '*' ? prevVal * cur : cur !== 0 ? prevVal / cur : 0;
        const resStr = Number.isInteger(res) ? String(res) : String(parseFloat(res.toFixed(6)));
        push(resStr, null, null, true);
    };
    const clear = () => push('0', null, null, false);

    return (
        <div className="fixed bottom-[300px] right-[410px] z-[9999] w-64 bg-[#151e2e] border border-amber-500/40 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-amber-500/10 border-b border-amber-500/20">
                <div className="flex items-center gap-1.5">
                    <Radio size={11} className="text-amber-400 animate-pulse" />
                    <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
                        {isPeer ? `Live · ${syncState.activeUserName}` : 'Calculator Live'}
                    </span>
                </div>
                <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={14} /></button>
            </div>

            {/* Display */}
            <div className="px-3 pt-3 pb-2">
                {isPeer && (
                    <div className="text-[9px] font-bold text-amber-300 mb-1 bg-amber-500/10 rounded-lg py-0.5 px-2 text-center animate-pulse">
                        ⚡ {syncState.activeUserName} is typing...
                    </div>
                )}
                <div className="bg-[#0a0f1d] rounded-xl px-3 py-2 text-right shadow-inner border border-white/5">
                    <div className="text-[10px] text-slate-500 font-mono h-3.5">{prevVal !== null ? `${prevVal} ${op || ''}` : ''}</div>
                    <div className="text-xl font-black font-mono text-amber-300 truncate">{display}</div>
                </div>
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-4 gap-1.5 px-3 pb-3 text-xs font-bold">
                {[
                    { label: 'C', span: 2, action: clear, style: 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30' },
                    { label: '⌫', action: () => push(display.slice(0, -1) || '0', prevVal, op, resetNext), style: 'bg-slate-800 text-slate-300 border-slate-700' },
                    { label: '÷', action: () => operator('/'), style: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
                ].map((btn, i) => (
                    <button key={i} onClick={btn.action}
                        className={`${btn.span === 2 ? 'col-span-2' : ''} p-2.5 rounded-xl border ${btn.style} active:scale-95 transition-all shadow-sm`}>
                        {btn.label}
                    </button>
                ))}
                {'789×456-123+'.split('').map((k, i) => {
                    const ops: Record<string, string> = { '×': '*', '+': '+', '-': '-' };
                    const isOp = Object.keys(ops).includes(k);
                    return (
                        <button key={i} onClick={() => isOp ? operator(ops[k]) : num(k)}
                            className={`p-2.5 rounded-xl border active:scale-95 transition-all shadow-sm ${isOp ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-slate-900 border-slate-800 text-slate-100 hover:bg-slate-800'}`}>
                            {k}
                        </button>
                    );
                })}
                <button onClick={() => num('0')} className="col-span-2 p-2.5 rounded-xl border bg-slate-900 border-slate-800 text-slate-100 hover:bg-slate-800 active:scale-95 transition-all shadow-sm">0</button>
                <button onClick={() => num('.')} className="p-2.5 rounded-xl border bg-slate-900 border-slate-800 text-slate-100 hover:bg-slate-800 active:scale-95 transition-all shadow-sm">.</button>
                <button onClick={equal} className="p-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black hover:from-amber-400 hover:to-amber-500 active:scale-95 transition-all shadow-[0_4px_12px_rgba(245,158,11,0.4)]">=</button>
            </div>
        </div>
    );
};

// ─── Standalone Floating Calendar App ────────────────────────────────────────
export const StandaloneCalendarApp: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const today = new Date();
    const days = eachDayOfInterval({ start: startOfMonth(today), end: endOfMonth(today) });
    const firstDayOffset = startOfMonth(today).getDay();

    return (
        <div className="fixed bottom-[300px] right-[410px] z-[9999] w-72 bg-[#0f1a0f] border border-lime-500/40 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3">
                <div>
                    <p className="text-[10px] font-bold text-lime-400/70 lowercase italic">live schedule</p>
                    <h2 className="text-2xl font-black text-white tracking-tight lowercase leading-tight">
                        {format(today, 'MMMM')} <span className="text-lg text-slate-400 font-bold">{format(today, 'yyyy')}</span>
                    </h2>
                </div>
                <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white transition-colors">
                    <X size={13} />
                </button>
            </div>

            {/* Calendar Grid */}
            <div className="mx-3 mb-3 bg-[#0a1208] border border-white/10 rounded-xl overflow-hidden">
                {/* Day headers */}
                <div className="grid grid-cols-7 border-b border-white/10">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                        <div key={i} className="py-2 text-center text-[10px] font-black text-lime-400/70">{d}</div>
                    ))}
                </div>
                {/* Days */}
                <div className="grid grid-cols-7 p-2 gap-1">
                    {Array(firstDayOffset).fill(null).map((_, i) => <div key={`empty-${i}`} />)}
                    {days.map(day => {
                        const isNow = isToday(day);
                        return (
                            <div key={day.toISOString()}
                                className={`aspect-square flex items-center justify-center rounded-lg text-xs font-bold transition-all cursor-default ${
                                    isNow
                                        ? 'bg-transparent border-2 border-lime-400 text-lime-400 shadow-[0_0_10px_rgba(163,230,53,0.4)]'
                                        : 'hover:bg-white/5 text-slate-400'
                                }`}
                            >
                                {format(day, 'd')}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Today pill */}
            <div className="px-3 pb-3">
                <div className="flex items-center gap-2 px-3 py-2 bg-lime-500/10 border border-lime-500/30 rounded-xl">
                    <span className="w-2 h-2 rounded-full bg-lime-400 shadow-[0_0_6px_#a3e635]" />
                    <span className="text-xs font-bold text-lime-300">Today · {format(today, 'EEEE, MMM d')}</span>
                </div>
            </div>
        </div>
    );
};

// ─── Main MessageInput Component ──────────────────────────────────────────────
const MessageInput: React.FC<MessageInputProps> = ({
    onSendMessage, onUploadFile, onStartRecordVoice, onStartRecordVideo,
    isUploading = false, calcSyncState, onCalcSyncChange, currentUserId, currentUserName,
}) => {
    const [content, setContent] = useState('');
    const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
    const [showCalApp, setShowCalApp] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const localCalc: CalculatorSyncState = calcSyncState || { isOpen: false, display: '0', prevVal: null, op: null, resetNext: false };

    const toggleCalc = () => {
        onCalcSyncChange?.({ ...localCalc, isOpen: !localCalc.isOpen, activeUserId: currentUserId, activeUserName: currentUserName });
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        let type: PendingFile['type'] = 'file';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('video/')) type = 'video';
        else if (file.type.startsWith('audio/')) type = 'voice';
        const previewUrl = (type === 'image' || type === 'video') ? URL.createObjectURL(file) : undefined;
        setPendingFile({ file, type, previewUrl });
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const clearFile = () => {
        if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
        setPendingFile(null);
    };

    const handleSend = async () => {
        if (!content.trim() && !pendingFile) return;
        if (pendingFile && onUploadFile) {
            const url = await onUploadFile(pendingFile.file);
            if (url) onSendMessage(content.trim() || url, pendingFile.type, pendingFile.file.name);
            clearFile();
            setContent('');
            return;
        }
        if (content.trim()) { onSendMessage(content.trim(), 'text'); setContent(''); }
    };

    const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    // Auto-grow textarea
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setContent(e.target.value);
        const ta = e.target;
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 100) + 'px';
    };

    const canSend = (!!content.trim() || !!pendingFile) && !isUploading;

    return (
        <div className="shrink-0 bg-[#0f1620] border-t border-white/[0.07]">
            {/* Standalone app windows */}
            {localCalc.isOpen && (
                <StandaloneCalculatorApp syncState={localCalc} onChange={s => onCalcSyncChange?.(s)}
                    onClose={() => onCalcSyncChange?.({ ...localCalc, isOpen: false })}
                    currentUserId={currentUserId} currentUserName={currentUserName} />
            )}
            {showCalApp && <StandaloneCalendarApp onClose={() => setShowCalApp(false)} />}

            {/* Staged File Preview */}
            {pendingFile && (
                <div className="mx-3 mt-3 flex items-center gap-2.5 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
                    {pendingFile.type === 'image' && pendingFile.previewUrl
                        ? <img src={pendingFile.previewUrl} alt="" className="w-8 h-8 rounded-lg object-cover border border-white/10" />
                        : <FileText size={18} className="text-amber-400 shrink-0" />}
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-100 truncate">{pendingFile.file.name}</p>
                        <p className="text-[10px] text-amber-400/80">{(pendingFile.file.size / 1024).toFixed(1)} KB · Press send to attach</p>
                    </div>
                    <button onClick={clearFile} className="shrink-0 text-slate-500 hover:text-red-400 transition-colors"><X size={14} /></button>
                </div>
            )}

            {/* ── ROW 1: [Calc] [Cal] [Text Input] [Send] ── */}
            <div className="flex items-end gap-2 px-3 pt-3 pb-2">
                {/* Live Broadcast Icons (left of input) */}
                <div className="flex flex-col gap-1.5 shrink-0 pb-0.5">
                    <button onClick={toggleCalc}
                        title="Live Calculator"
                        className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all shadow-md active:scale-90 ${
                            localCalc.isOpen
                                ? 'bg-amber-500 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                                : 'bg-slate-800 border border-slate-700/80 text-amber-400 hover:bg-slate-700'
                        }`}>
                        <Calculator size={17} />
                    </button>
                    <button onClick={() => setShowCalApp(v => !v)}
                        title="Live Calendar"
                        className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all shadow-md active:scale-90 ${
                            showCalApp
                                ? 'bg-lime-500 text-slate-950 shadow-[0_0_12px_rgba(163,230,53,0.5)]'
                                : 'bg-slate-800 border border-slate-700/80 text-lime-400 hover:bg-slate-700'
                        }`}>
                        <CalendarIcon size={17} />
                    </button>
                </div>

                {/* Text Input */}
                <div className="flex-1 bg-[#1e2a3a] border border-white/10 rounded-2xl px-3.5 py-2 focus-within:border-amber-500/50 transition-colors">
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        value={content}
                        onChange={handleChange}
                        onKeyDown={handleKey}
                        placeholder="Type a message..."
                        className="w-full bg-transparent text-sm text-white placeholder-slate-500 outline-none resize-none leading-relaxed"
                        style={{ maxHeight: 100, scrollbarWidth: 'none' }}
                    />
                </div>

                {/* Send Button */}
                <button
                    onClick={handleSend}
                    disabled={!canSend}
                    className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center transition-all active:scale-90 shadow-lg ${
                        canSend
                            ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-slate-950 shadow-[0_4px_14px_rgba(245,158,11,0.4)] hover:from-amber-400 hover:to-orange-400'
                            : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                    }`}
                    title="Send"
                >
                    {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="fill-current" />}
                </button>
            </div>

            {/* ── ROW 2: [Attach] [Voice] [Video] ── */}
            <div className="flex items-center gap-2 px-3 pb-3">
                {/* Attach */}
                <button onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 h-8 px-3 bg-slate-800/80 border border-slate-700/60 rounded-xl text-slate-300 hover:text-amber-400 hover:bg-slate-700 transition-all text-xs font-semibold active:scale-95 shadow-sm">
                    <Paperclip size={13} />
                    <span>Attach</span>
                </button>
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />

                {/* Voice Message */}
                <button
                    onClick={onStartRecordVoice}
                    disabled={!onStartRecordVoice}
                    className="flex items-center gap-1.5 h-8 px-3 bg-slate-800/80 border border-slate-700/60 rounded-xl text-slate-300 hover:text-emerald-400 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs font-semibold active:scale-95 shadow-sm">
                    <Mic size={13} className="text-emerald-400" />
                    <span>Voice</span>
                </button>

                {/* Video Message */}
                <button
                    onClick={onStartRecordVideo}
                    disabled={!onStartRecordVideo}
                    className="flex items-center gap-1.5 h-8 px-3 bg-slate-800/80 border border-slate-700/60 rounded-xl text-slate-300 hover:text-indigo-400 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs font-semibold active:scale-95 shadow-sm">
                    <Video size={13} className="text-indigo-400" />
                    <span>Video</span>
                </button>
            </div>
        </div>
    );
};

export default MessageInput;
