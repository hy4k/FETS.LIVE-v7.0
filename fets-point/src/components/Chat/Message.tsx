import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { format } from 'date-fns';
import { useInView } from 'react-intersection-observer';
import { useMarkMessagesAsRead, useUpdateMessage, useDeleteMessage } from '../../hooks/useChat';
import { ChatMessage } from '../../types';
import { CheckCheck, Edit3, Trash2, FileText, Play, Pause, Circle, Sparkles, Phone, Video, PhoneOff, VideoOff } from 'lucide-react';

interface MessageProps {
  message: ChatMessage & {
    conversation?: { members: any[] };
    sender_id?: string;
    type?: string;
    file_path?: string;
    is_edited?: boolean;
    is_deleted?: boolean;
    status?: string;
  };
}

// Custom Sleek Voice Note Audio Player matching Pastel Teal & Warm Yellow Theme
const CustomVoicePlayer: React.FC<{ src: string; isYou?: boolean }> = ({ src, isYou }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<number>(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) setDuration(audio.duration);
    };

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
    };

    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [src]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.playbackRate = speed;
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleSpeedChange = () => {
    const nextSpeed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(nextSpeed);
    if (audioRef.current) audioRef.current.playbackRate = nextSpeed;
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-xl my-1 min-w-[240px] ${
      isYou
        ? 'bg-white/20 border border-white/30 text-white'
        : 'bg-[#FFF2D0] border border-[#F3CA59] text-[#133C44]'
    }`}>
      <button
        type="button"
        onClick={togglePlay}
        className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-transform hover:scale-105 shrink-0 ${
          isYou
            ? 'bg-white text-[#1BB5AC] hover:bg-slate-100'
            : 'bg-[#1BB5AC] text-white hover:bg-[#179F97]'
        }`}
      >
        {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
      </button>

      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        {/* Animated Waveform */}
        <div className="relative w-full h-3 flex items-center gap-0.5 cursor-pointer" onClick={(e) => {
          if (!audioRef.current || !duration) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const newTime = (clickX / rect.width) * duration;
          audioRef.current.currentTime = newTime;
          setCurrentTime(newTime);
        }}>
          {[40, 70, 30, 90, 60, 100, 45, 80, 50, 95, 35, 75, 65, 85, 40, 70].map((h, i) => {
            const barProgress = (i / 16) * 100;
            const isFilled = progressPercent >= barProgress;
            return (
              <div
                key={i}
                className={`flex-1 rounded-full transition-all duration-150 ${
                  isFilled
                    ? isYou ? 'bg-white shadow-[0_0_6px_#ffffff]' : 'bg-[#1BB5AC] shadow-[0_0_6px_#1BB5AC]'
                    : isYou ? 'bg-white/40' : 'bg-[#E3C579]'
                } ${isPlaying && isFilled ? 'animate-pulse' : ''}`}
                style={{ height: `${h}%` }}
              />
            );
          })}
        </div>

        <div className={`flex justify-between items-center text-[10px] font-bold ${isYou ? 'text-white/80' : 'text-[#56767C]'}`}>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSpeedChange}
        className={`px-1.5 py-0.5 rounded text-[9px] font-black transition-colors shrink-0 ${
          isYou
            ? 'bg-white/20 hover:bg-white/30 text-white border border-white/30'
            : 'bg-[#1BB5AC]/15 hover:bg-[#1BB5AC]/30 text-[#133C44] border border-[#1BB5AC]/30'
        }`}
      >
        {speed}x
      </button>
    </div>
  );
};

const Message: React.FC<MessageProps> = ({ message }) => {
  const { user } = useAuth();
  const {
    content,
    created_at,
    id: messageId,
    read_receipts = [],
    conversation_id,
    type = 'text',
    file_path,
    is_edited,
    is_deleted,
    status,
  } = message;

  const author = message.author || {
    id: message.sender_id || '',
    full_name: 'Staff',
    avatar_url: undefined,
  };

  const isYou = author.id === user?.id || message.sender_id === user?.id;
  const markAsRead = useMarkMessagesAsRead();
  const updateMessage = useUpdateMessage();
  const deleteMessage = useDeleteMessage();

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);

  const { ref, inView } = useInView({ threshold: 0.8 });

  useEffect(() => {
    if (inView && !isYou && user?.id) {
      const isRead = read_receipts.some((receipt) => receipt.user_id === user.id);
      if (!isRead) {
        markAsRead.mutate({ messageIds: [messageId], userId: user.id, conversationId: conversation_id });
      }
    }
  }, [inView, isYou, messageId, user?.id, read_receipts, markAsRead, conversation_id]);

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== content) {
      updateMessage.mutate({ messageId, content: editContent.trim(), conversationId: conversation_id });
    }
    setIsEditing(false);
  };

  const handleDelete = (e: React.MouseEvent, forEveryone: boolean) => {
    e.stopPropagation();
    deleteMessage.mutate({ messageId, conversationId: conversation_id, forEveryone });
    setShowDeleteMenu(false);
  };

  const isDeletedMessage = is_deleted || status === 'deleted_for_all';

  let callLogData: { callType?: 'audio' | 'video'; status?: string; durationSeconds?: number } | null = null;
  if (type === 'call_log') {
    try {
      callLogData = JSON.parse(content);
    } catch {
      callLogData = null;
    }
  }

  const formatCallDuration = (secs?: number) => {
    if (!secs) return '';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m > 0 ? `${m}m ` : ''}${s}s`;
  };

  return (
    <div ref={ref} className={`flex items-start gap-2.5 my-3 group relative ${isYou ? 'flex-row-reverse' : ''}`}>
      <img
        src={author.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(author.full_name || 'Staff')}&background=1BB5AC&color=fff`}
        alt={author.full_name}
        className="w-8 h-8 rounded-full border-2 border-white shrink-0 object-cover shadow-sm"
      />

      <div className={`flex flex-col max-w-[82%] ${isYou ? 'items-end' : 'items-start'}`}>
        <div className="flex items-center gap-2 mb-1 px-0.5">
          <span className="text-[11px] font-bold text-[#14424B]">{isYou ? 'You' : author.full_name}</span>
          <span className="text-[10px] text-[#618086] font-medium">{format(new Date(created_at || Date.now()), 'p')}</span>
        </div>

        <div
          className={`p-3.5 rounded-2xl relative shadow-md text-sm transition-all ${
            isYou
              ? 'bg-gradient-to-br from-[#1BB5AC] to-[#159F98] text-white border border-[#138C86] rounded-br-xs font-medium'
              : 'bg-[#FFF8E7] text-[#133C44] border border-[#F3CD67] rounded-bl-xs font-medium shadow-sm'
          } ${isDeletedMessage ? 'opacity-50 italic' : ''}`}
        >
          {/* Action Menu for Sender */}
          {isYou && !isDeletedMessage && (
            <div className="absolute -top-2.5 -right-2 hidden group-hover:flex items-center gap-1 bg-[#133C44] border border-white/20 rounded-full px-1.5 py-0.5 shadow-lg z-30">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="p-1 hover:text-[#20CDC4] text-white transition-colors"
                title="Edit Message"
              >
                <Edit3 size={11} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteMenu((v) => !v);
                }}
                className="p-1 hover:text-red-300 text-white transition-colors"
                title="Delete Message"
              >
                <Trash2 size={11} />
              </button>
            </div>
          )}

          {/* Delete Dropdown Menu */}
          {showDeleteMenu && (
            <div
              className="absolute top-full right-0 mt-1.5 bg-[#133C44] border border-white/20 rounded-xl shadow-2xl z-40 overflow-hidden min-w-[160px]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={(e) => handleDelete(e, false)}
                className="w-full px-3.5 py-2.5 text-[11px] font-bold text-left hover:bg-white/10 text-white flex items-center justify-between"
              >
                Delete for me
              </button>
              <button
                type="button"
                onClick={(e) => handleDelete(e, true)}
                className="w-full px-3.5 py-2.5 text-[11px] font-bold text-left hover:bg-red-500/30 text-red-300 border-t border-white/10 flex items-center justify-between"
              >
                Delete for everyone
              </button>
            </div>
          )}

          {/* Edit Mode */}
          {isEditing ? (
            <div className="flex flex-col gap-2 min-w-[220px]">
              <input
                type="text"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full bg-[#103239] border border-white/30 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-[#20CDC4]"
                autoFocus
              />
              <div className="flex justify-end gap-2 text-[10px]">
                <button type="button" onClick={() => setIsEditing(false)} className="text-white/80 hover:text-white">
                  Cancel
                </button>
                <button type="button" onClick={handleSaveEdit} className="text-[#20CDC4] font-bold hover:text-white">
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              {type === 'text' && <p className="leading-relaxed break-words">{content}</p>}
              {type === 'voice' && <CustomVoicePlayer src={content} isYou={isYou} />}
              {type === 'image' && <img src={content} alt="Attachment" className="rounded-xl max-w-full max-h-64 object-cover border border-white/20 my-1" />}
              {type === 'video' && <video src={content} controls className="rounded-xl max-w-full max-h-64 border border-white/20 my-1" />}
              {type === 'file' && (
                <a
                  href={content}
                  target="_blank"
                  rel="noreferrer"
                  className={`flex items-center gap-2 text-xs font-bold underline my-1 ${isYou ? 'text-white hover:text-white/80' : 'text-[#168D87] hover:text-[#137671]'}`}
                >
                  <FileText size={16} /> {file_path || 'Document Attachment'}
                </a>
              )}
              {type === 'call_log' && callLogData && (
                <div className={`flex items-center gap-2.5 p-2 rounded-xl my-0.5 border ${
                  isYou ? 'bg-white/20 border-white/30 text-white' : 'bg-[#FFF2D0] border-[#F3CA59] text-[#133C44]'
                }`}>
                  <div className={`p-2 rounded-full ${callLogData.status === 'completed' ? 'bg-emerald-500/20 text-emerald-600' : 'bg-red-500/20 text-red-500'}`}>
                    {callLogData.callType === 'video' ? (
                      callLogData.status === 'completed' ? <Video size={16} /> : <VideoOff size={16} />
                    ) : (
                      callLogData.status === 'completed' ? <Phone size={16} /> : <PhoneOff size={16} />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold">
                      {callLogData.status === 'completed'
                        ? `${callLogData.callType === 'video' ? 'Video Call' : 'Voice Call'}`
                        : `Missed ${callLogData.callType === 'video' ? 'Video' : 'Voice'} Call`}
                    </span>
                    {callLogData.status === 'completed' && callLogData.durationSeconds ? (
                      <span className={`text-[10px] font-semibold ${isYou ? 'text-white/90' : 'text-emerald-700'}`}>{formatCallDuration(callLogData.durationSeconds)}</span>
                    ) : (
                      <span className={`text-[10px] font-semibold ${isYou ? 'text-red-200' : 'text-red-600'}`}>No Answer</span>
                    )}
                  </div>
                </div>
              )}
              {is_edited && <span className="text-[9px] opacity-70 ml-1 italic">(edited)</span>}
            </>
          )}

          {/* Status Ticks */}
          <div className="flex items-center justify-end gap-1 mt-1 opacity-90 text-[10px]">
            {isYou && (
              status === 'seen' || read_receipts.length > 0 ? (
                <div className="flex items-center gap-0.5 text-white font-black" title="Read / Seen">
                  <Sparkles size={11} className="text-white animate-pulse fill-current" />
                  <CheckCheck size={12} className="text-white stroke-[3]" />
                </div>
              ) : status === 'delivered' ? (
                <div className="flex items-center gap-0.5 text-white/80" title="Delivered">
                  <Circle size={8} className="fill-white" />
                  <Circle size={8} className="fill-white" />
                </div>
              ) : (
                <div className="flex items-center text-white/80" title="Sent">
                  <Circle size={8} className="fill-white" />
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Message;
