import React, { useState, useRef } from 'react';
import { Send, Paperclip, Calculator, Calendar as CalendarIcon, X, FileText, Loader2, Image as ImageIcon, Video as VideoIcon, Radio, Mic, Video, Sparkles, CalendarDays } from 'lucide-react';
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
  // Real-time Collaborative Calculator Sync Props
  calcSyncState?: CalculatorSyncState;
  onCalcSyncChange?: (newState: CalculatorSyncState) => void;
  currentUserId?: string;
  currentUserName?: string;
}

// Standalone Floating Calculator App Window (Inspired by Reference Images 1 & 4)
export const StandaloneCalculatorApp: React.FC<{
  syncState: CalculatorSyncState;
  onChange: (newState: CalculatorSyncState) => void;
  onClose: () => void;
  currentUserId?: string;
  currentUserName?: string;
}> = ({ syncState, onChange, onClose, currentUserId, currentUserName }) => {
  const display = syncState.display || '0';
  const prevVal = syncState.prevVal;
  const op = syncState.op;
  const resetNext = syncState.resetNext;
  const isPeerCalculating = syncState.activeUserId && syncState.activeUserId !== currentUserId;
  const peerName = syncState.activeUserName || 'Teammate';

  const updateState = (newDisplay: string, newPrevVal: number | null, newOp: string | null, newResetNext: boolean) => {
    onChange({
      isOpen: true,
      display: newDisplay,
      prevVal: newPrevVal,
      op: newOp,
      resetNext: newResetNext,
      activeUserId: currentUserId,
      activeUserName: currentUserName || 'Staff',
    });
  };

  const handleNum = (num: string) => {
    if (display === '0' || resetNext) {
      updateState(num, prevVal, op, false);
    } else {
      updateState(display + num, prevVal, op, false);
    }
  };

  const handleOp = (operator: string) => {
    const current = parseFloat(display);
    updateState(display, current, operator, true);
  };

  const handleEqual = () => {
    if (prevVal === null || op === null) return;
    const current = parseFloat(display);
    let res = 0;
    if (op === '+') res = prevVal + current;
    if (op === '-') res = prevVal - current;
    if (op === '*') res = prevVal * current;
    if (op === '/') res = current !== 0 ? prevVal / current : 0;

    const resStr = Number.isInteger(res) ? String(res) : String(parseFloat(res.toFixed(6)));
    updateState(resStr, null, null, true);
  };

  const handleClear = () => {
    updateState('0', null, null, false);
  };

  return (
    <div className="fixed top-16 right-4 sm:right-[450px] z-[3000] p-4 bg-[#182035] border border-amber-500/40 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.8)] w-72 text-white select-none backdrop-blur-2xl">
      <div className="flex justify-between items-center pb-2.5 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
          <span className="text-xs font-black uppercase text-amber-400 tracking-wider">
            {isPeerCalculating ? `Live: ${peerName}` : 'Calculator App'}
          </span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      {isPeerCalculating && (
        <div className="text-[10px] font-bold text-amber-300 mb-2 text-center bg-amber-500/15 py-1 rounded-xl border border-amber-500/30 animate-pulse">
          ⚡ {peerName} is calculating live...
        </div>
      )}

      {/* Recessed Digital Display Screen (Reference Image 1) */}
      <div className="bg-[#0b1222] border border-slate-800 rounded-2xl p-3 mb-4 text-right shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)]">
        <div className="text-[10px] text-slate-400 font-mono h-4">{prevVal !== null ? `${prevVal} ${op || ''}` : ''}</div>
        <div className="text-2xl font-mono font-black text-amber-300 truncate tracking-tight">{display}</div>
      </div>

      {/* Tactile 3D Keypad (Reference Image 4) */}
      <div className="grid grid-cols-4 gap-2 font-bold text-sm">
        <button onClick={handleClear} className="col-span-2 p-3 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 rounded-2xl shadow-md active:translate-y-0.5 transition-all">C</button>
        <button onClick={() => updateState(display.slice(0, -1) || '0', prevVal, op, resetNext)} className="p-3 bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 rounded-2xl shadow-md active:translate-y-0.5 transition-all">⌫</button>
        <button onClick={() => handleOp('/')} className="p-3 bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 rounded-2xl shadow-md active:translate-y-0.5 transition-all">÷</button>

        <button onClick={() => handleNum('7')} className="p-3 bg-slate-900 border border-slate-800 text-slate-100 hover:bg-slate-800 rounded-2xl shadow-md active:translate-y-0.5 transition-all">7</button>
        <button onClick={() => handleNum('8')} className="p-3 bg-slate-900 border border-slate-800 text-slate-100 hover:bg-slate-800 rounded-2xl shadow-md active:translate-y-0.5 transition-all">8</button>
        <button onClick={() => handleNum('9')} className="p-3 bg-slate-900 border border-slate-800 text-slate-100 hover:bg-slate-800 rounded-2xl shadow-md active:translate-y-0.5 transition-all">9</button>
        <button onClick={() => handleOp('*')} className="p-3 bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 rounded-2xl shadow-md active:translate-y-0.5 transition-all">×</button>

        <button onClick={() => handleNum('4')} className="p-3 bg-slate-900 border border-slate-800 text-slate-100 hover:bg-slate-800 rounded-2xl shadow-md active:translate-y-0.5 transition-all">4</button>
        <button onClick={() => handleNum('5')} className="p-3 bg-slate-900 border border-slate-800 text-slate-100 hover:bg-slate-800 rounded-2xl shadow-md active:translate-y-0.5 transition-all">5</button>
        <button onClick={() => handleNum('6')} className="p-3 bg-slate-900 border border-slate-800 text-slate-100 hover:bg-slate-800 rounded-2xl shadow-md active:translate-y-0.5 transition-all">6</button>
        <button onClick={() => handleOp('-')} className="p-3 bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 rounded-2xl shadow-md active:translate-y-0.5 transition-all">-</button>

        <button onClick={() => handleNum('1')} className="p-3 bg-slate-900 border border-slate-800 text-slate-100 hover:bg-slate-800 rounded-2xl shadow-md active:translate-y-0.5 transition-all">1</button>
        <button onClick={() => handleNum('2')} className="p-3 bg-slate-900 border border-slate-800 text-slate-100 hover:bg-slate-800 rounded-2xl shadow-md active:translate-y-0.5 transition-all">2</button>
        <button onClick={() => handleNum('3')} className="p-3 bg-slate-900 border border-slate-800 text-slate-100 hover:bg-slate-800 rounded-2xl shadow-md active:translate-y-0.5 transition-all">3</button>
        <button onClick={() => handleOp('+')} className="p-3 bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 rounded-2xl shadow-md active:translate-y-0.5 transition-all">+</button>

        <button onClick={() => handleNum('0')} className="col-span-2 p-3 bg-slate-900 border border-slate-800 text-slate-100 hover:bg-slate-800 rounded-2xl shadow-md active:translate-y-0.5 transition-all">0</button>
        <button onClick={() => handleNum('.')} className="p-3 bg-slate-900 border border-slate-800 text-slate-100 hover:bg-slate-800 rounded-2xl shadow-md active:translate-y-0.5 transition-all">.</button>
        <button onClick={handleEqual} className="p-3 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black hover:from-amber-400 hover:to-amber-500 rounded-2xl shadow-[0_4px_15px_rgba(245,158,11,0.4)] active:translate-y-0.5 transition-all">=</button>
      </div>
    </div>
  );
};

// Standalone Floating Calendar App Window (Inspired by Reference Image 5 - MAY 2025 Style)
export const StandaloneCalendarApp: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const today = new Date();
  const days = eachDayOfInterval({ start: startOfMonth(today), end: endOfMonth(today) });

  return (
    <div className="fixed top-16 right-4 sm:right-[450px] z-[3000] p-5 bg-[#121927] border border-lime-500/40 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.8)] w-80 text-white select-none backdrop-blur-2xl">
      <div className="flex justify-between items-center pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-lime-400" />
          <span className="text-xs font-black uppercase text-lime-400 tracking-wider">Calendar App</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Styled Header like Reference Image 5 */}
      <div className="flex justify-between items-end mb-4 px-1">
        <div>
          <span className="text-[11px] font-bold text-lime-400/80 lowercase italic block">live date schedule</span>
          <h2 className="text-3xl font-black text-white tracking-tight lowercase">{format(today, 'MMMM')}</h2>
        </div>
        <span className="text-xl font-bold text-slate-400">{format(today, 'yyyy')}</span>
      </div>

      {/* Days Grid */}
      <div className="bg-[#0a0f1d] border border-white/10 rounded-2xl p-3 mb-4 shadow-inner">
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-lime-400 mb-2">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <span key={d}>{d}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {days.map(day => {
            const isCurrentToday = isToday(day);
            return (
              <div
                key={day.toISOString()}
                className={`p-2 rounded-xl font-bold transition-all ${
                  isCurrentToday
                    ? 'bg-transparent border-2 border-lime-400 text-lime-400 shadow-[0_0_12px_#a3e635]'
                    : 'hover:bg-white/5 text-slate-300'
                }`}
              >
                {format(day, 'd')}
              </div>
            );
          })}
        </div>
      </div>

      {/* Event Pills (Reference Image 5) */}
      <div className="flex gap-2">
        <div className="flex-1 px-3 py-2 bg-slate-900 border border-white/10 rounded-xl flex items-center justify-between text-xs">
          <span className="w-2 h-2 rounded-full bg-lime-400" />
          <span className="font-bold text-slate-200">Today Active</span>
          <span className="text-[10px] font-bold text-lime-400">{format(today, 'd MMM')}</span>
        </div>
      </div>
    </div>
  );
};

const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  onUploadFile,
  onStartRecordVoice,
  onStartRecordVideo,
  isUploading = false,
  calcSyncState,
  onCalcSyncChange,
  currentUserId,
  currentUserName,
}) => {
  const [content, setContent] = useState('');
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [showCalApp, setShowCalApp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const localCalcState: CalculatorSyncState = calcSyncState || {
    isOpen: false,
    display: '0',
    prevVal: null,
    op: null,
    resetNext: false,
  };

  const handleCalcToggle = () => {
    const nextIsOpen = !localCalcState.isOpen;
    if (onCalcSyncChange) {
      onCalcSyncChange({
        ...localCalcState,
        isOpen: nextIsOpen,
        activeUserId: currentUserId,
        activeUserName: currentUserName,
      });
    }
  };

  const handleCalcChange = (newState: CalculatorSyncState) => {
    if (onCalcSyncChange) {
      onCalcSyncChange(newState);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let type: PendingFile['type'] = 'file';
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type.startsWith('video/')) type = 'video';
    else if (file.type.startsWith('audio/')) type = 'voice';

    const previewUrl = type === 'image' || type === 'video' ? URL.createObjectURL(file) : undefined;
    setPendingFile({ file, type, previewUrl });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearPendingFile = () => {
    if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
    setPendingFile(null);
  };

  const handleSend = async () => {
    if (!content.trim() && !pendingFile) return;

    if (pendingFile && onUploadFile) {
      const fileUrl = await onUploadFile(pendingFile.file);
      if (fileUrl) {
        onSendMessage(content.trim() || fileUrl, pendingFile.type, pendingFile.file.name);
      }
      clearPendingFile();
      setContent('');
      return;
    }

    if (content.trim()) {
      onSendMessage(content.trim(), 'text');
      setContent('');
    }
  };

  return (
    <div className="p-3.5 bg-[#0e1626] border-t border-slate-800 relative shrink-0">
      {/* Standalone Calculator App (Opens beside chat) */}
      {localCalcState.isOpen && (
        <StandaloneCalculatorApp
          syncState={localCalcState}
          onChange={handleCalcChange}
          onClose={() => {
            if (onCalcSyncChange) onCalcSyncChange({ ...localCalcState, isOpen: false });
          }}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
        />
      )}

      {/* Standalone Calendar App (Opens beside chat) */}
      {showCalApp && <StandaloneCalendarApp onClose={() => setShowCalApp(false)} />}

      {/* Staged Attachment Preview Bar */}
      {pendingFile && (
        <div className="flex items-center justify-between p-3 mb-3 bg-slate-950 border border-amber-500/40 rounded-2xl shadow-xl">
          <div className="flex items-center gap-3 min-w-0">
            {pendingFile.type === 'image' && pendingFile.previewUrl ? (
              <img src={pendingFile.previewUrl} alt="" className="w-10 h-10 rounded-xl object-cover border border-white/10 shrink-0" />
            ) : pendingFile.type === 'video' ? (
              <VideoIcon className="w-6 h-6 text-amber-400 shrink-0" />
            ) : (
              <FileText className="w-6 h-6 text-amber-400 shrink-0" />
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-slate-100 truncate">{pendingFile.file.name}</span>
              <span className="text-[10px] text-amber-400 font-semibold">{(pendingFile.file.size / 1024).toFixed(1)} KB • Staged (Click Send)</span>
            </div>
          </div>
          <button type="button" onClick={clearPendingFile} className="p-1.5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Textarea Input Line */}
      <div className="flex items-center gap-2 mb-2.5">
        <input
          type="text"
          placeholder={pendingFile ? "Add message with attachment..." : "Type your message..."}
          className="flex-1 bg-[#070c17] border border-slate-700/80 focus:border-amber-500 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all shadow-inner"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={(!content.trim() && !pendingFile) || isUploading}
          className="px-4 py-2.5 bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-30 text-slate-950 font-black rounded-2xl transition-all shadow-[0_4px_15px_rgba(245,158,11,0.4)] shrink-0 flex items-center gap-2 cursor-pointer active:translate-y-0.5"
          title="Send Message"
        >
          {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Send</span><Send className="w-4 h-4 fill-current" /></>}
        </button>
      </div>

      {/* High Contrast 3D Tactile Control Pills (Reference Image 2 & 4 Style) */}
      <div className="flex items-center justify-between gap-1.5 px-1 pt-1 overflow-x-auto custom-scrollbar">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/90 border border-slate-700 text-slate-200 hover:text-amber-400 hover:bg-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm active:translate-y-0.5 shrink-0"
            title="Attach Document/Media"
          >
            <Paperclip size={14} /> <span>Attach</span>
          </button>
          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />

          {onStartRecordVoice && (
            <button
              type="button"
              onClick={onStartRecordVoice}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/90 border border-slate-700 text-slate-200 hover:text-emerald-400 hover:bg-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm active:translate-y-0.5 shrink-0"
              title="Voice Message"
            >
              <Mic size={14} className="text-emerald-400" /> <span>Voice</span>
            </button>
          )}

          {onStartRecordVideo && (
            <button
              type="button"
              onClick={onStartRecordVideo}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/90 border border-slate-700 text-slate-200 hover:text-indigo-400 hover:bg-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm active:translate-y-0.5 shrink-0"
              title="Video Message"
            >
              <Video size={14} className="text-indigo-400" /> <span>Video</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCalcToggle}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm active:translate-y-0.5 shrink-0 ${
              localCalcState.isOpen
                ? 'bg-amber-500 text-slate-950 font-black shadow-[0_0_10px_#f59e0b]'
                : 'bg-slate-800/90 border border-slate-700 text-slate-200 hover:text-amber-400 hover:bg-slate-700'
            }`}
            title="Calculator App"
          >
            <Calculator size={14} /> <span>Calc</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCalApp(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm active:translate-y-0.5 shrink-0 ${
              showCalApp
                ? 'bg-lime-400 text-slate-950 font-black shadow-[0_0_10px_#a3e635]'
                : 'bg-slate-800/90 border border-slate-700 text-slate-200 hover:text-lime-400 hover:bg-slate-700'
            }`}
            title="Calendar App"
          >
            <CalendarIcon size={14} /> <span>Calendar</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageInput;
