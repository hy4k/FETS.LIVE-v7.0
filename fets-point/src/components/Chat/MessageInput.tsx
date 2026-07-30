import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Send, Paperclip, Calculator, Clock as ClockIcon, X,
    FileText, Loader2, Mic, Video, Radio, Plus, Calendar as CalendarIcon, Zap
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, getYear, getDayOfYear, isLeapYear } from 'date-fns';

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
    showCalApp?: boolean;
    setShowCalApp?: React.Dispatch<React.SetStateAction<boolean>>;
    currentUserId?: string;
    currentUserName?: string;
}

// ─── Standalone Side-by-Side Calculator App Window ────────────────────────────
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
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute right-full mr-3.5 top-0 bottom-0 z-[9999] w-72 bg-[#FFF9EA] border-4 border-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col justify-between"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#1BB5AC] text-white shrink-0">
                <div className="flex items-center gap-2">
                    <Radio size={14} className="animate-pulse" />
                    <span className="text-xs font-black tracking-wider uppercase">
                        {isPeer ? `Live · ${syncState.activeUserName}` : 'Calculator Live'}
                    </span>
                </div>
                <button onClick={onClose} className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                    <X size={13} />
                </button>
            </div>

            {/* Display */}
            <div className="px-4 pt-4 pb-2 shrink-0">
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
            <div className="grid grid-cols-4 gap-2 px-4 pb-4 text-sm font-black flex-1 flex flex-col justify-end">
                {[
                    { label: 'C', span: 2, action: clear, style: 'bg-red-500 text-white hover:bg-red-600' },
                    { label: '⌫', action: () => push(display.slice(0, -1) || '0', prevVal, op, resetNext), style: 'bg-[#FFE9AF] text-[#133C44] border border-[#F1C454] hover:bg-[#FCE095]' },
                    { label: '÷', action: () => operator('/'), style: 'bg-[#1BB5AC] text-white hover:bg-[#159F98]' },
                ].map((btn, i) => (
                    <button key={i} onClick={btn.action}
                        className={`${btn.span === 2 ? 'col-span-2' : ''} p-2.5 rounded-2xl shadow-sm ${btn.style} active:scale-95 transition-all`}>
                        {btn.label}
                    </button>
                ))}
                {'789×456-123+'.split('').map((k, i) => {
                    const ops: Record<string, string> = { '×': '*', '+': '+', '-': '-' };
                    const isOp = Object.keys(ops).includes(k);
                    return (
                        <button key={i} onClick={() => isOp ? operator(ops[k]) : num(k)}
                            className={`p-2.5 rounded-2xl shadow-sm active:scale-95 transition-all ${
                                isOp ? 'bg-[#1BB5AC] text-white hover:bg-[#159F98]' : 'bg-[#FFFDF7] text-[#133C44] border border-[#EAC053] hover:bg-[#FFF5DC]'
                            }`}>
                            {k}
                        </button>
                    );
                })}
                <button onClick={() => num('0')} className="col-span-2 p-2.5 rounded-2xl bg-[#FFFDF7] text-[#133C44] border border-[#EAC053] hover:bg-[#FFF5DC] active:scale-95 transition-all shadow-sm">0</button>
                <button onClick={() => num('.')} className="p-2.5 rounded-2xl bg-[#FFFDF7] text-[#133C44] border border-[#EAC053] hover:bg-[#FFF5DC] active:scale-95 transition-all shadow-sm">.</button>
                <button onClick={equal} className="p-2.5 rounded-2xl bg-gradient-to-r from-[#F2994A] to-[#E2802D] text-white font-black hover:from-[#E28736] hover:to-[#D4711D] active:scale-95 transition-all shadow-[0_4px_12px_rgba(242,153,74,0.4)]">=</button>
            </div>
        </motion.div>
    );
};

// ─── Neumorphic Time & Schedule Dashboard App (Inspired by Attached Image) ──
export const StandaloneTimeCalendarDashboardApp: React.FC<{
    onClose: () => void;
    onSendMessage?: (content: string, type?: 'text' | 'voice' | 'file' | 'image' | 'video') => void;
    currentUserName?: string;
}> = ({ onClose, onSendMessage, currentUserName }) => {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const daysInYear = isLeapYear(now) ? 366 : 365;
    const currentDay = getDayOfYear(now);
    const yearRemainingPct = Math.round(((daysInYear - currentDay) / daysInYear) * 100);

    const secondsToday = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const dayRemainingPct = Math.round(((86400 - secondsToday) / 86400) * 100);

    const hours = now.getHours() % 12;
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    const hourDeg = (hours + minutes / 60) * 30;
    const minuteDeg = (minutes + seconds / 60) * 6;
    const secondDeg = seconds * 6;

    const days = eachDayOfInterval({ start: startOfMonth(now), end: endOfMonth(now) });
    const firstDayOffset = startOfMonth(now).getDay();

    const handleShareDayRemaining = () => {
        if (onSendMessage) {
            onSendMessage(`⚡ ${currentUserName || 'Staff'} shared live day status: ${dayRemainingPct}% remaining today!`, 'text');
        }
    };

    const handleShareEnergy = () => {
        if (onSendMessage) {
            onSendMessage(`⚡ ${currentUserName || 'Staff'} shared energy status: 88% active sync power!`, 'text');
        }
    };

    const handleSelectDate = (d: Date) => {
        if (onSendMessage) {
            onSendMessage(`📅 Scheduled meeting invite for ${format(d, 'EEEE, MMM d, yyyy')} at ${format(now, 'hh:mm a')}`, 'text');
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute right-full mr-3.5 top-0 bottom-0 z-[9999] w-[310px] bg-[#FFF9EA] border-4 border-white rounded-3xl shadow-[0_30px_70px_rgba(0,0,0,0.3)] overflow-y-auto p-4 flex flex-col justify-between select-none"
            style={{ scrollbarWidth: 'none' }}
        >
            <style>{`div::-webkit-scrollbar { display: none; }`}</style>

            {/* Header / Close */}
            <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-black text-[#133C44] tracking-wide uppercase flex items-center gap-1.5">
                    <ClockIcon size={14} className="text-[#1BB5AC]" /> Time & Schedule Hub
                </span>
                <button onClick={onClose} className="w-6 h-6 rounded-full bg-[#1BB5AC]/20 hover:bg-[#1BB5AC] text-[#133C44] hover:text-white flex items-center justify-center transition-colors">
                    <X size={13} />
                </button>
            </div>

            {/* 1. Neumorphic Analog Clock & Greeting */}
            <div className="flex items-center gap-4 bg-[#FFF1C9] border-2 border-[#F3CD67] rounded-3xl p-3 shadow-inner">
                {/* Analog Clock Dial */}
                <div className="relative w-20 h-20 rounded-full bg-[#FFF9EA] border-2 border-[#F3CD67] shadow-md flex items-center justify-center shrink-0">
                    <span className="absolute top-1 text-[9px] font-black text-[#133C44]">12</span>
                    <span className="absolute right-1 text-[9px] font-black text-[#133C44]">3</span>
                    <span className="absolute bottom-1 text-[9px] font-black text-[#133C44]">6</span>
                    <span className="absolute left-1 text-[9px] font-black text-[#133C44]">9</span>

                    {/* Hour Hand */}
                    <div className="absolute w-1 bg-[#133C44] rounded-full origin-bottom" style={{ height: '22px', transform: `rotate(${hourDeg}deg)`, bottom: '50%' }} />
                    {/* Minute Hand */}
                    <div className="absolute w-0.5 bg-[#1BB5AC] rounded-full origin-bottom" style={{ height: '28px', transform: `rotate(${minuteDeg}deg)`, bottom: '50%' }} />
                    {/* Second Hand */}
                    <div className="absolute w-0.5 bg-[#F2994A] rounded-full origin-bottom" style={{ height: '32px', transform: `rotate(${secondDeg}deg)`, bottom: '50%' }} />
                    {/* Center Dot */}
                    <div className="absolute w-2 h-2 rounded-full bg-[#F2994A] z-10 border border-white" />
                </div>

                {/* Greeting Text */}
                <div className="flex flex-col min-w-0">
                    <h4 className="text-base font-black text-[#133C44] leading-tight">Hello, {format(now, 'MMM')}</h4>
                    <p className="text-[10px] font-bold text-[#64848A] leading-tight mt-1 italic">Live every day with ease!</p>
                </div>
            </div>

            {/* 2. Digital Clock & Date Recessed Card */}
            <div className="bg-[#FFF1C9] border-2 border-[#F3CD67] rounded-3xl p-3.5 shadow-inner flex items-center justify-between mt-2.5">
                <div className="bg-[#FFFDF7] border-2 border-[#E9BF50] rounded-2xl px-3 py-1.5 text-center shadow-inner">
                    <span className="text-xl font-black font-mono text-[#133C44] tracking-wider">{format(now, 'HH:mm')}</span>
                </div>
                <div className="text-right">
                    <p className="text-sm font-black text-[#133C44] leading-tight">{format(now, 'EEEE')}</p>
                    <p className="text-[10px] font-bold text-[#64848A] font-mono mt-0.5">{format(now, 'yyyy/MM/dd')}</p>
                </div>
            </div>

            {/* 3. Year Progress Bar */}
            <div className="mt-2.5 px-1">
                <div className="flex justify-between items-center text-[10px] font-bold text-[#133C44] mb-1">
                    <span>The rest of the year</span>
                    <span className="font-black text-[#F2994A]">{yearRemainingPct}%</span>
                </div>
                <div className="w-full h-3 bg-[#FFF1C9] border border-[#F3CD67] rounded-full overflow-hidden p-0.5 shadow-inner">
                    <div className="h-full bg-gradient-to-r from-[#1BB5AC] to-[#F2994A] rounded-full transition-all duration-500" style={{ width: `${100 - yearRemainingPct}%` }} />
                </div>
            </div>

            {/* 4. Bottom Interactive Cards Row */}
            <div className="grid grid-cols-3 gap-2 mt-2.5">
                {/* Remaining Today Capsule */}
                <button
                    onClick={handleShareDayRemaining}
                    title="Click to share Day Progress into chat!"
                    className="bg-[#FFF1C9] border-2 border-[#F3CD67] rounded-2xl p-2 flex flex-col items-center justify-between hover:border-[#1BB5AC] transition-all active:scale-95 shadow-sm group"
                >
                    <span className="text-[8px] font-bold text-[#64848A] text-center leading-tight">The remaining today</span>
                    <div className="w-full h-12 bg-[#FFFDF7] rounded-xl border border-[#E9BF50] overflow-hidden flex flex-col justify-end p-0.5 my-1">
                        <div className="w-full bg-[#1BB5AC]/30 group-hover:bg-[#1BB5AC] rounded-lg transition-all" style={{ height: `${dayRemainingPct}%` }} />
                    </div>
                    <span className="text-[10px] font-black text-[#133C44]">{dayRemainingPct}%</span>
                </button>

                {/* Energy Sync Capsule */}
                <button
                    onClick={handleShareEnergy}
                    title="Click to share Energy Status into chat!"
                    className="bg-[#FFF1C9] border-2 border-[#F3CD67] rounded-2xl p-2 flex flex-col items-center justify-between hover:border-[#F2994A] transition-all active:scale-95 shadow-sm group"
                >
                    <span className="text-[8px] font-bold text-[#64848A] text-center leading-tight">Live Energy</span>
                    <div className="w-full h-12 bg-[#FFFDF7] rounded-xl border border-[#E9BF50] overflow-hidden flex flex-col justify-end p-0.5 my-1">
                        <div className="w-full bg-[#F2994A]/30 group-hover:bg-[#F2994A] rounded-lg transition-all" style={{ height: '88%' }} />
                    </div>
                    <span className="text-[10px] font-black text-[#133C44]">88%</span>
                </button>

                {/* Mini Calendar Card */}
                <div className="bg-[#FFF1C9] border-2 border-[#F3CD67] rounded-2xl p-2 flex flex-col justify-between shadow-sm">
                    <div className="flex items-center justify-between text-[8px] font-black text-[#133C44]">
                        <span>{format(now, 'M')}</span>
                        <span className="uppercase tracking-tighter text-[7px] text-[#64848A]">CALENDAR</span>
                    </div>
                    {/* Days grid */}
                    <div className="grid grid-cols-7 gap-0.5 my-1 text-[7px] text-center font-bold text-[#133C44]">
                        {days.slice(0, 14).map(d => {
                            const isNow = isToday(d);
                            return (
                                <button
                                    key={d.toISOString()}
                                    onClick={() => handleSelectDate(d)}
                                    title={`Schedule meeting for ${format(d, 'MMM d')}`}
                                    className={`rounded-md py-0.5 transition-all ${
                                        isNow ? 'bg-[#F2994A] text-white font-black scale-105 shadow-sm' : 'hover:bg-[#1BB5AC] hover:text-white'
                                    }`}
                                >
                                    {format(d, 'd')}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

// ─── Main MessageInput Component ──────────────────────────────────────────────
const MessageInput: React.FC<MessageInputProps> = ({
    onSendMessage, onUploadFile, onStartRecordVoice, onStartRecordVideo,
    isUploading = false, calcSyncState, onCalcSyncChange,
    showCalApp: propsShowCalApp, setShowCalApp: propsSetShowCalApp,
    currentUserId, currentUserName,
}) => {
    const [content, setContent] = useState('');
    const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
    const [showMediaTooltip, setShowMediaTooltip] = useState(false);
    const [internalCalApp, setInternalCalApp] = useState(false);

    const isCalOpen = propsShowCalApp !== undefined ? propsShowCalApp : internalCalApp;
    const toggleCal = () => {
        if (propsSetShowCalApp) propsSetShowCalApp(v => !v);
        else setInternalCalApp(v => !v);
    };

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
        setShowMediaTooltip(false);
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
        ta.style.height = Math.min(ta.scrollHeight, 80) + 'px';
    };

    const canSend = (!!content.trim() || !!pendingFile) && !isUploading;

    return (
        <div className="shrink-0 bg-[#FAD980] border-t-2 border-[#F1C250] relative">
            {/* Staged File Preview */}
            {pendingFile && (
                <div className="mx-3 mt-2 flex items-center gap-2 px-2.5 py-1.5 bg-[#FFF4D4] border border-[#F2C957] rounded-xl">
                    {pendingFile.type === 'image' && pendingFile.previewUrl
                        ? <img src={pendingFile.previewUrl} alt="" className="w-7 h-7 rounded-lg object-cover border border-[#1BB5AC]/40" />
                        : <FileText size={16} className="text-[#1BB5AC] shrink-0" />}
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-[#133C44] truncate">{pendingFile.file.name}</p>
                        <p className="text-[9px] text-[#168D87] font-semibold">{(pendingFile.file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button onClick={clearFile} className="shrink-0 text-[#67888E] hover:text-red-500 transition-colors"><X size={13} /></button>
                </div>
            )}

            {/* ── ROW: [🧮 Calc] [🕒 Clock Hub] [Type a message...] [➕ Media] [Send ➤] ── */}
            <div className="flex items-center gap-1.5 px-3 py-2.5 relative">
                {/* 1. Calculator Icon */}
                <button onClick={toggleCalc}
                    title="Live Calculator"
                    className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center transition-all shrink-0 active:scale-90 ${
                        localCalc.isOpen
                            ? 'bg-[#1BB5AC] text-white shadow-md scale-105'
                            : 'bg-[#FFF8E7] border border-[#EBC053] text-[#168D87] hover:bg-[#1BB5AC] hover:text-white'
                    }`}>
                    <Calculator size={16} />
                </button>

                {/* 2. Neumorphic Time & Schedule Hub Icon */}
                <button onClick={toggleCal}
                    title="Time & Schedule Hub"
                    className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center transition-all shrink-0 active:scale-90 ${
                        isCalOpen
                            ? 'bg-[#F2994A] text-white shadow-md scale-105'
                            : 'bg-[#FFF8E7] border border-[#EBC053] text-[#D97706] hover:bg-[#F2994A] hover:text-white'
                    }`}>
                    <ClockIcon size={16} />
                </button>

                {/* 3. Textarea Input Box */}
                <div className="flex-1 min-w-0 bg-[#FFFDF7] border-2 border-[#E9BF50] rounded-2xl px-3 py-1.5 focus-within:border-[#1BB5AC] shadow-inner transition-colors">
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        value={content}
                        onChange={handleChange}
                        onKeyDown={handleKey}
                        placeholder="Type a message..."
                        className="w-full bg-transparent text-xs text-[#133C44] font-medium placeholder-[#5B7F86] outline-none resize-none leading-normal pt-0.5"
                        style={{ maxHeight: 80, scrollbarWidth: 'none' }}
                    />
                </div>

                {/* 4. Media Plus Button */}
                <div className="relative shrink-0">
                    <button onClick={() => setShowMediaTooltip(v => !v)}
                        title="Attach Media"
                        className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
                            showMediaTooltip
                                ? 'bg-[#1BB5AC] text-white'
                                : 'bg-[#FFF8E7] border border-[#EBC053] text-[#133C44] hover:bg-[#1BB5AC] hover:text-white'
                        }`}>
                        <Plus size={17} />
                    </button>

                    {/* Clean Popover Tooltip for Media */}
                    <AnimatePresence>
                        {showMediaTooltip && (
                            <motion.div
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 6 }}
                                transition={{ duration: 0.15 }}
                                className="absolute bottom-full right-0 mb-2 bg-[#FFF9EA] border-2 border-[#1BB5AC] rounded-2xl shadow-xl p-1.5 z-50 flex flex-col gap-1 min-w-[120px]"
                            >
                                <button onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-2 px-2.5 py-1.5 bg-[#FFFDF7] hover:bg-[#1BB5AC] hover:text-white rounded-xl text-xs font-bold text-[#133C44] transition-colors">
                                    <Paperclip size={13} />
                                    <span>Attach File</span>
                                </button>
                                <button onClick={() => { onStartRecordVoice?.(); setShowMediaTooltip(false); }}
                                    className="flex items-center gap-2 px-2.5 py-1.5 bg-[#FFFDF7] hover:bg-[#1BB5AC] hover:text-white rounded-xl text-xs font-bold text-[#1BB5AC] transition-colors">
                                    <Mic size={13} />
                                    <span>Voice Note</span>
                                </button>
                                <button onClick={() => { onStartRecordVideo?.(); setShowMediaTooltip(false); }}
                                    className="flex items-center gap-2 px-2.5 py-1.5 bg-[#FFFDF7] hover:bg-[#1BB5AC] hover:text-white rounded-xl text-xs font-bold text-[#F2994A] transition-colors">
                                    <Video size={13} />
                                    <span>Video Note</span>
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />

                {/* 5. Send Button */}
                <button
                    onClick={handleSend}
                    disabled={!canSend}
                    className={`shrink-0 w-8.5 h-8.5 rounded-2xl flex items-center justify-center transition-all active:scale-90 shadow-md ${
                        canSend
                            ? 'bg-gradient-to-br from-[#1BB5AC] to-[#149E97] text-white shadow-[0_3px_10px_rgba(27,181,172,0.4)] hover:from-[#17A59D] hover:to-[#128E87]'
                            : 'bg-[#FFF1C9] text-[#9CB5BA] border border-[#E9C363] cursor-not-allowed'
                    }`}
                    title="Send"
                >
                    {isUploading ? <Loader2 size={15} className="animate-spin text-white" /> : <Send size={15} className="fill-current" />}
                </button>
            </div>
        </div>
    );
};

export default MessageInput;
