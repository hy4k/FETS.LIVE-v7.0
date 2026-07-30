import React, { useState, useRef } from 'react';
import {
    Send, Paperclip, Calculator, Calendar as CalendarIcon, X,
    FileText, Loader2, Video as VideoIcon, Mic, Video, Radio
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

// ─── Standalone Floating Calculator App (Pastel Yellow & Teal Theme) ─────────
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
        <div className="fixed bottom-[300px] right-[410px] z-[9999] w-68 bg-[#FFF9EA] border-2 border-[#1BB5AC] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#1BB5AC] text-white">
                <div className="flex items-center gap-2">
                    <Radio size={13} className="animate-pulse" />
                    <span className="text-xs font-black tracking-wider uppercase">
                        {isPeer ? `Live · ${syncState.activeUserName}` : 'Calculator Live'}
                    </span>
                </div>
                <button onClick={onClose} className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                    <X size={13} />
                </button>
            </div>

            {/* Display */}
            <div className="px-4 pt-4 pb-2">
                {isPeer && (
                    <div className="text-[10px] font-bold text-[#1BB5AC] mb-1.5 bg-[#1BB5AC]/10 rounded-lg py-1 px-2 text-center animate-pulse border border-[#1BB5AC]/20">
                        ⚡ {syncState.activeUserName} is calculating...
                    </div>
                )}
                <div className="bg-[#FFF1C9] rounded-2xl px-4 py-3 text-right border-2 border-[#F3CD67] shadow-inner">
                    <div className="text-[11px] text-[#638288] font-mono h-4 font-bold">{prevVal !== null ? `${prevVal} ${op || ''}` : ''}</div>
                    <div className="text-2xl font-black font-mono text-[#133C44] truncate">{display}</div>
                </div>
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-4 gap-2 px-4 pb-4 text-xs font-black">
                {[
                    { label: 'C', span: 2, action: clear, style: 'bg-red-500 text-white hover:bg-red-600' },
                    { label: '⌫', action: () => push(display.slice(0, -1) || '0', prevVal, op, resetNext), style: 'bg-[#FFE9AF] text-[#133C44] border border-[#F1C454] hover:bg-[#FCE095]' },
                    { label: '÷', action: () => operator('/'), style: 'bg-[#1BB5AC] text-white hover:bg-[#159F98]' },
                ].map((btn, i) => (
                    <button key={i} onClick={btn.action}
                        className={`${btn.span === 2 ? 'col-span-2' : ''} p-3 rounded-2xl shadow-sm ${btn.style} active:scale-95 transition-all`}>
                        {btn.label}
                    </button>
                ))}
                {'789×456-123+'.split('').map((k, i) => {
                    const ops: Record<string, string> = { '×': '*', '+': '+', '-': '-' };
                    const isOp = Object.keys(ops).includes(k);
                    return (
                        <button key={i} onClick={() => isOp ? operator(ops[k]) : num(k)}
                            className={`p-3 rounded-2xl shadow-sm active:scale-95 transition-all ${
                                isOp ? 'bg-[#1BB5AC] text-white hover:bg-[#159F98]' : 'bg-[#FFFDF7] text-[#133C44] border border-[#EAC053] hover:bg-[#FFF5DC]'
                            }`}>
                            {k}
                        </button>
                    );
                })}
                <button onClick={() => num('0')} className="col-span-2 p-3 rounded-2xl bg-[#FFFDF7] text-[#133C44] border border-[#EAC053] hover:bg-[#FFF5DC] active:scale-95 transition-all shadow-sm">0</button>
                <button onClick={() => num('.')} className="p-3 rounded-2xl bg-[#FFFDF7] text-[#133C44] border border-[#EAC053] hover:bg-[#FFF5DC] active:scale-95 transition-all shadow-sm">.</button>
                <button onClick={equal} className="p-3 rounded-2xl bg-gradient-to-r from-[#F2994A] to-[#E2802D] text-white font-black hover:from-[#E28736] hover:to-[#D4711D] active:scale-95 transition-all shadow-[0_4px_12px_rgba(242,153,74,0.4)]">=</button>
            </div>
        </div>
    );
};

// ─── Standalone Floating Calendar App (Matching Image Style) ─────────────────
export const StandaloneCalendarApp: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const today = new Date();
    const days = eachDayOfInterval({ start: startOfMonth(today), end: endOfMonth(today) });
    const firstDayOffset = startOfMonth(today).getDay();

    return (
        <div className="fixed bottom-[300px] right-[410px] z-[9999] w-76 bg-[#FFF9EA] border-2 border-[#1BB5AC] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] overflow-hidden">
            {/* Header in Image Style */}
            <div className="px-5 pt-5 pb-3 bg-gradient-to-r from-[#1BB5AC] to-[#149E97] text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold text-white/80 tracking-widest uppercase">live schedule</p>
                        <h2 className="text-3xl font-black tracking-tight leading-none mt-0.5">
                            {format(today, 'MMM').toLowerCase()} <span className="text-lg text-white/80 font-bold">{format(today, 'yyyy')}, {format(today, 'EEE dd')}</span>
                        </h2>
                    </div>
                    <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors">
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="m-4 bg-[#FFF1C9] border-2 border-[#F3CD67] rounded-2xl overflow-hidden shadow-inner">
                {/* Day headers */}
                <div className="grid grid-cols-7 border-b border-[#F3CD67] bg-[#FCE39E]">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                        <div key={i} className="py-2 text-center text-[10px] font-black text-[#154E57]">{d}</div>
                    ))}
                </div>
                {/* Days */}
                <div className="grid grid-cols-7 p-2.5 gap-1.5">
                    {Array(firstDayOffset).fill(null).map((_, i) => <div key={`empty-${i}`} />)}
                    {days.map(day => {
                        const isNow = isToday(day);
                        return (
                            <div key={day.toISOString()}
                                className={`aspect-square flex items-center justify-center rounded-xl text-xs font-bold transition-all cursor-default ${
                                    isNow
                                        ? 'bg-[#1BB5AC] text-white shadow-[0_4px_10px_rgba(27,181,172,0.4)] scale-105'
                                        : 'hover:bg-[#FCE095] text-[#133C44]'
                                }`}
                            >
                                {format(day, 'd')}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Today pill */}
            <div className="px-4 pb-4">
                <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[#FFF2D0] border border-[#F3CA59] rounded-2xl shadow-sm">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#1BB5AC] shadow-[0_0_8px_#1BB5AC]" />
                    <span className="text-xs font-bold text-[#133C44]">Today · {format(today, 'EEEE, MMM d')}</span>
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

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setContent(e.target.value);
        const ta = e.target;
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 100) + 'px';
    };

    const canSend = (!!content.trim() || !!pendingFile) && !isUploading;

    return (
        <div className="shrink-0 bg-[#FAD980] border-t-2 border-[#F1C250]">
            {/* Standalone app windows */}
            {localCalc.isOpen && (
                <StandaloneCalculatorApp syncState={localCalc} onChange={s => onCalcSyncChange?.(s)}
                    onClose={() => onCalcSyncChange?.({ ...localCalc, isOpen: false })}
                    currentUserId={currentUserId} currentUserName={currentUserName} />
            )}
            {showCalApp && <StandaloneCalendarApp onClose={() => setShowCalApp(false)} />}

            {/* Staged File Preview */}
            {pendingFile && (
                <div className="mx-3 mt-3 flex items-center gap-2.5 px-3 py-2 bg-[#FFF4D4] border border-[#F2C957] rounded-2xl">
                    {pendingFile.type === 'image' && pendingFile.previewUrl
                        ? <img src={pendingFile.previewUrl} alt="" className="w-8 h-8 rounded-lg object-cover border border-[#1BB5AC]/40" />
                        : <FileText size={18} className="text-[#1BB5AC] shrink-0" />}
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[#133C44] truncate">{pendingFile.file.name}</p>
                        <p className="text-[10px] text-[#168D87] font-semibold">{(pendingFile.file.size / 1024).toFixed(1)} KB · Press send to attach</p>
                    </div>
                    <button onClick={clearFile} className="shrink-0 text-[#67888E] hover:text-red-500 transition-colors"><X size={14} /></button>
                </div>
            )}

            {/* ── ROW 1: [Calc] [Cal] [Text Input] [Send] ── */}
            <div className="flex items-end gap-2 px-3 pt-3 pb-2">
                {/* Live Broadcast Icons */}
                <div className="flex flex-col gap-1.5 shrink-0 pb-0.5">
                    <button onClick={toggleCalc}
                        title="Live Calculator"
                        className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all shadow-sm active:scale-90 ${
                            localCalc.isOpen
                                ? 'bg-[#1BB5AC] text-white shadow-[0_0_12px_rgba(27,181,172,0.5)] scale-105'
                                : 'bg-[#FFF8E7] border border-[#EBC053] text-[#168D87] hover:bg-[#1BB5AC] hover:text-white'
                        }`}>
                        <Calculator size={17} />
                    </button>
                    <button onClick={() => setShowCalApp(v => !v)}
                        title="Live Calendar"
                        className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all shadow-sm active:scale-90 ${
                            showCalApp
                                ? 'bg-[#F2994A] text-white shadow-[0_0_12px_rgba(242,153,74,0.5)] scale-105'
                                : 'bg-[#FFF8E7] border border-[#EBC053] text-[#D97706] hover:bg-[#F2994A] hover:text-white'
                        }`}>
                        <CalendarIcon size={17} />
                    </button>
                </div>

                {/* Text Input Box */}
                <div className="flex-1 bg-[#FFFDF7] border-2 border-[#E9BF50] rounded-2xl px-3.5 py-2 focus-within:border-[#1BB5AC] shadow-inner transition-colors">
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        value={content}
                        onChange={handleChange}
                        onKeyDown={handleKey}
                        placeholder="Type a message..."
                        className="w-full bg-transparent text-sm text-[#133C44] font-medium placeholder-[#5B7F86] outline-none resize-none leading-relaxed"
                        style={{ maxHeight: 100, scrollbarWidth: 'none' }}
                    />
                </div>

                {/* Send Button */}
                <button
                    onClick={handleSend}
                    disabled={!canSend}
                    className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center transition-all active:scale-90 shadow-md ${
                        canSend
                            ? 'bg-gradient-to-br from-[#1BB5AC] to-[#149E97] text-white shadow-[0_4px_14px_rgba(27,181,172,0.4)] hover:from-[#17A59D] hover:to-[#128E87]'
                            : 'bg-[#FFF1C9] text-[#9CB5BA] border border-[#E9C363] cursor-not-allowed'
                    }`}
                    title="Send"
                >
                    {isUploading ? <Loader2 size={16} className="animate-spin text-white" /> : <Send size={16} className="fill-current" />}
                </button>
            </div>

            {/* ── ROW 2: [Attach] [Voice] [Video] ── */}
            <div className="flex items-center gap-2 px-3 pb-3">
                {/* Attach */}
                <button onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 h-8 px-3 bg-[#FFFDF7] border border-[#EAC053] rounded-xl text-[#15464F] hover:text-white hover:bg-[#1BB5AC] hover:border-[#1BB5AC] transition-all text-xs font-bold active:scale-95 shadow-sm">
                    <Paperclip size={13} />
                    <span>Attach</span>
                </button>
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />

                {/* Voice Message */}
                <button
                    onClick={onStartRecordVoice}
                    disabled={!onStartRecordVoice}
                    className="flex items-center gap-1.5 h-8 px-3 bg-[#FFFDF7] border border-[#EAC053] rounded-xl text-[#15464F] hover:text-white hover:bg-[#1BB5AC] hover:border-[#1BB5AC] disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs font-bold active:scale-95 shadow-sm">
                    <Mic size={13} className="text-[#1BB5AC] group-hover:text-white" />
                    <span>Voice</span>
                </button>

                {/* Video Message */}
                <button
                    onClick={onStartRecordVideo}
                    disabled={!onStartRecordVideo}
                    className="flex items-center gap-1.5 h-8 px-3 bg-[#FFFDF7] border border-[#EAC053] rounded-xl text-[#15464F] hover:text-white hover:bg-[#1BB5AC] hover:border-[#1BB5AC] disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs font-bold active:scale-95 shadow-sm">
                    <Video size={13} className="text-[#F2994A] group-hover:text-white" />
                    <span>Video</span>
                </button>
            </div>
        </div>
    );
};

export default MessageInput;
