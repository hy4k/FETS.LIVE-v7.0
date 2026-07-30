import React, { useState, useRef } from 'react';
import { Send, Paperclip, Mic, Smile, Loader2 } from 'lucide-react';

interface MessageInputProps {
  onSendMessage: (content: string, type?: 'text' | 'voice' | 'file' | 'image' | 'video', filePath?: string) => void;
  onUploadFile?: (file: File) => Promise<void>;
  isUploading?: boolean;
}

const COMMON_EMOJIS = ['👍', '❤️', '🔥', '👏', '😊', '🚀', '🎉', '💯'];

const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, onUploadFile, isUploading = false }) => {
  const [content, setContent] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (content.trim()) {
      onSendMessage(content.trim(), 'text');
      setContent('');
      setShowEmojis(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadFile) {
      await onUploadFile(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="p-3 bg-slate-900 border-t border-white/10 relative">
      {/* Quick Emoji Bar */}
      {showEmojis && (
        <div className="absolute bottom-full left-3 mb-2 p-2 bg-slate-950 border border-white/15 rounded-xl shadow-2xl flex gap-1 z-30">
          {COMMON_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                setContent((prev) => prev + emoji);
                setShowEmojis(false);
              }}
              className="hover:bg-white/10 p-1.5 rounded-lg text-base transition-transform hover:scale-125"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowEmojis((v) => !v)}
          className="p-2 text-slate-400 hover:text-amber-400 hover:bg-white/5 rounded-xl transition-colors shrink-0"
          title="Add Emoji"
        >
          <Smile className="w-5 h-5" />
        </button>

        <input
          type="text"
          placeholder="Type a message..."
          className="flex-1 bg-slate-950 border border-white/10 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors shrink-0"
          title="Attach File"
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />

        <button
          type="button"
          onClick={handleSend}
          disabled={!content.trim() || isUploading}
          className="p-2.5 bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-30 rounded-xl transition-all shadow-md shrink-0 cursor-pointer"
          title="Send Message"
        >
          {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 fill-current" />}
        </button>
      </div>
    </div>
  );
};

export default MessageInput;
