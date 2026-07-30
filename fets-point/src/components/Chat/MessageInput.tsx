import React, { useState, useRef } from 'react';
import { Send, Paperclip, Calculator, Calendar as CalendarIcon, X, FileText, Loader2, Image as ImageIcon, Video as VideoIcon } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns';

interface PendingFile {
  file: File;
  type: 'image' | 'video' | 'voice' | 'file';
  previewUrl?: string;
}

interface MessageInputProps {
  onSendMessage: (content: string, type?: 'text' | 'voice' | 'file' | 'image' | 'video', filePath?: string) => void;
  onUploadFile?: (file: File) => Promise<string | null>;
  isUploading?: boolean;
}

export const MiniCalculator: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [display, setDisplay] = useState('0');
  const [prevVal, setPrevVal] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [resetNext, setResetNext] = useState(false);

  const handleNum = (num: string) => {
    if (display === '0' || resetNext) {
      setDisplay(num);
      setResetNext(false);
    } else {
      setDisplay(prev => prev + num);
    }
  };

  const handleOp = (operator: string) => {
    setPrevVal(parseFloat(display));
    setOp(operator);
    setResetNext(true);
  };

  const handleEqual = () => {
    if (prevVal === null || op === null) return;
    const current = parseFloat(display);
    let res = 0;
    if (op === '+') res = prevVal + current;
    if (op === '-') res = prevVal - current;
    if (op === '*') res = prevVal * current;
    if (op === '/') res = current !== 0 ? prevVal / current : 0;

    setDisplay(String(res));
    setPrevVal(null);
    setOp(null);
    setResetNext(true);
  };

  const handleClear = () => {
    setDisplay('0');
    setPrevVal(null);
    setOp(null);
    setResetNext(false);
  };

  return (
    <div className="absolute bottom-full left-3 mb-3 p-3 bg-slate-950 border border-amber-500/40 rounded-2xl shadow-2xl z-50 w-56 text-white select-none backdrop-blur-xl">
      <div className="flex justify-between items-center pb-2 mb-2 border-b border-white/10">
        <span className="text-[11px] font-black uppercase text-amber-400 tracking-wider">Calculator</span>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-base">✕</button>
      </div>

      <div className="bg-slate-900 border border-white/10 rounded-xl p-2 mb-3 text-right text-lg font-mono font-bold text-amber-300 truncate">
        {display}
      </div>

      <div className="grid grid-cols-4 gap-1.5 font-bold text-xs">
        <button onClick={handleClear} className="col-span-2 p-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg">C</button>
        <button onClick={() => setDisplay(prev => prev.slice(0, -1) || '0')} className="p-2 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg">⌫</button>
        <button onClick={() => handleOp('/')} className="p-2 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 rounded-lg">÷</button>

        <button onClick={() => handleNum('7')} className="p-2 bg-slate-900 hover:bg-slate-800 rounded-lg">7</button>
        <button onClick={() => handleNum('8')} className="p-2 bg-slate-900 hover:bg-slate-800 rounded-lg">8</button>
        <button onClick={() => handleNum('9')} className="p-2 bg-slate-900 hover:bg-slate-800 rounded-lg">9</button>
        <button onClick={() => handleOp('*')} className="p-2 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 rounded-lg">×</button>

        <button onClick={() => handleNum('4')} className="p-2 bg-slate-900 hover:bg-slate-800 rounded-lg">4</button>
        <button onClick={() => handleNum('5')} className="p-2 bg-slate-900 hover:bg-slate-800 rounded-lg">5</button>
        <button onClick={() => handleNum('6')} className="p-2 bg-slate-900 hover:bg-slate-800 rounded-lg">6</button>
        <button onClick={() => handleOp('-')} className="p-2 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 rounded-lg">-</button>

        <button onClick={() => handleNum('1')} className="p-2 bg-slate-900 hover:bg-slate-800 rounded-lg">1</button>
        <button onClick={() => handleNum('2')} className="p-2 bg-slate-900 hover:bg-slate-800 rounded-lg">2</button>
        <button onClick={() => handleNum('3')} className="p-2 bg-slate-900 hover:bg-slate-800 rounded-lg">3</button>
        <button onClick={() => handleOp('+')} className="p-2 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 rounded-lg">+</button>

        <button onClick={() => handleNum('0')} className="col-span-2 p-2 bg-slate-900 hover:bg-slate-800 rounded-lg">0</button>
        <button onClick={() => handleNum('.')} className="p-2 bg-slate-900 hover:bg-slate-800 rounded-lg">.</button>
        <button onClick={handleEqual} className="p-2 bg-amber-500 text-slate-950 font-black hover:bg-amber-400 rounded-lg">=</button>
      </div>
    </div>
  );
};

export const MiniCalendar: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const today = new Date();
  const days = eachDayOfInterval({ start: startOfMonth(today), end: endOfMonth(today) });

  return (
    <div className="absolute bottom-full left-12 mb-3 p-3 bg-slate-950 border border-indigo-500/40 rounded-2xl shadow-2xl z-50 w-64 text-white select-none backdrop-blur-xl">
      <div className="flex justify-between items-center pb-2 mb-2 border-b border-white/10">
        <span className="text-[11px] font-black uppercase text-indigo-400 tracking-wider">
          {format(today, 'MMMM yyyy')}
        </span>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-base">✕</button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-1">
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
              className={`p-1.5 rounded-lg font-bold transition-all ${
                isCurrentToday
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-[0_0_10px_#f59e0b]'
                  : 'hover:bg-slate-900 text-slate-300'
              }`}
            >
              {format(day, 'd')}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, onUploadFile, isUploading = false }) => {
  const [content, setContent] = useState('');
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [showCalc, setShowCalc] = useState(false);
  const [showCal, setShowCal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    <div className="p-3 bg-slate-900/90 border-t border-white/10 relative shrink-0">
      {/* Popups */}
      {showCalc && <MiniCalculator onClose={() => setShowCalc(false)} />}
      {showCal && <MiniCalendar onClose={() => setShowCal(false)} />}

      {/* Staged Attachment Preview Bar */}
      {pendingFile && (
        <div className="flex items-center justify-between p-2.5 mb-2.5 bg-slate-950 border border-amber-500/40 rounded-xl">
          <div className="flex items-center gap-2.5 min-w-0">
            {pendingFile.type === 'image' && pendingFile.previewUrl ? (
              <img src={pendingFile.previewUrl} alt="" className="w-9 h-9 rounded-lg object-cover border border-white/10 shrink-0" />
            ) : pendingFile.type === 'video' ? (
              <VideoIcon className="w-6 h-6 text-amber-400 shrink-0" />
            ) : (
              <FileText className="w-6 h-6 text-amber-400 shrink-0" />
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-slate-100 truncate">{pendingFile.file.name}</span>
              <span className="text-[10px] text-slate-400 font-semibold">{(pendingFile.file.size / 1024).toFixed(1)} KB • Staged (Click Send)</span>
            </div>
          </div>
          <button type="button" onClick={clearPendingFile} className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => { setShowCalc(v => !v); setShowCal(false); }}
          className="p-2 text-slate-400 hover:text-amber-400 hover:bg-white/5 rounded-xl transition-colors shrink-0"
          title="Open Calculator"
        >
          <Calculator className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => { setShowCal(v => !v); setShowCalc(false); }}
          className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-white/5 rounded-xl transition-colors shrink-0"
          title="Open Calendar"
        >
          <CalendarIcon className="w-5 h-5" />
        </button>

        <input
          type="text"
          placeholder={pendingFile ? "Add a message with attachment..." : "Type a message..."}
          className="flex-1 bg-slate-950 border border-white/10 focus:border-amber-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors shrink-0"
          title="Stage Attachment"
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />

        <button
          type="button"
          onClick={handleSend}
          disabled={(!content.trim() && !pendingFile) || isUploading}
          className="p-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-30 text-slate-950 font-black rounded-xl transition-all shadow-md shrink-0 cursor-pointer"
          title="Send Message"
        >
          {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 fill-current" />}
        </button>
      </div>
    </div>
  );
};

export default MessageInput;
