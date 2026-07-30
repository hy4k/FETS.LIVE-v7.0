import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { format } from 'date-fns';
import { useInView } from 'react-intersection-observer';
import { useMarkMessagesAsRead, useUpdateMessage, useDeleteMessage } from '../../hooks/useChat';
import { ChatMessage } from '../../types';
import { Check, CheckCheck, Edit3, Trash2, FileText } from 'lucide-react';

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

  const handleDelete = (forEveryone: boolean) => {
    deleteMessage.mutate({ messageId, conversationId: conversation_id, forEveryone });
    setShowDeleteMenu(false);
  };

  const isDeletedMessage = is_deleted || status === 'deleted_for_all';

  return (
    <div ref={ref} className={`flex items-start gap-3 my-3 group relative ${isYou ? 'flex-row-reverse' : ''}`}>
      <img
        src={author.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(author.full_name || 'Staff')}&background=random`}
        alt={author.full_name}
        className="w-8 h-8 rounded-full border border-white/10 shrink-0 object-cover"
      />

      <div className={`flex flex-col max-w-[78%] ${isYou ? 'items-end' : 'items-start'}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-slate-300">{isYou ? 'You' : author.full_name}</span>
          <span className="text-[10px] text-slate-400 font-medium">{format(new Date(created_at || Date.now()), 'p')}</span>
        </div>

        <div
          className={`p-3 rounded-2xl relative shadow-md text-sm border transition-all ${
            isYou
              ? 'bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-800 text-white border-indigo-500/30 rounded-br-xs'
              : 'bg-slate-900 text-slate-100 border-white/10 rounded-bl-xs'
          } ${isDeletedMessage ? 'opacity-50 italic' : ''}`}
        >
          {/* Edit / Delete Hover Action Menu */}
          {isYou && !isDeletedMessage && (
            <div className="absolute -top-2 -right-2 hidden group-hover:flex items-center gap-1 bg-slate-950 border border-white/15 rounded-full px-1.5 py-0.5 shadow-xl z-20">
              <button onClick={() => setIsEditing(true)} className="p-1 hover:text-indigo-400 text-slate-300" title="Edit">
                <Edit3 size={11} />
              </button>
              <button onClick={() => setShowDeleteMenu((v) => !v)} className="p-1 hover:text-red-400 text-slate-300" title="Delete">
                <Trash2 size={11} />
              </button>
            </div>
          )}

          {/* Delete Dropdown Menu */}
          {showDeleteMenu && (
            <div className="absolute top-full right-0 mt-1 bg-slate-950 border border-white/15 rounded-xl shadow-2xl z-30 overflow-hidden min-w-[150px]">
              <button onClick={() => handleDelete(false)} className="w-full px-3 py-2 text-[11px] font-medium text-left hover:bg-white/5 text-slate-200">
                Delete for me
              </button>
              <button onClick={() => handleDelete(true)} className="w-full px-3 py-2 text-[11px] font-medium text-left hover:bg-red-500/20 text-red-400 border-t border-white/5">
                Delete for everyone
              </button>
            </div>
          )}

          {isEditing ? (
            <div className="flex flex-col gap-2 min-w-[200px]">
              <input
                type="text"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full bg-slate-950 border border-white/20 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-indigo-400"
                autoFocus
              />
              <div className="flex justify-end gap-2 text-[10px]">
                <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-white">
                  Cancel
                </button>
                <button onClick={handleSaveEdit} className="text-indigo-300 font-bold hover:text-white">
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              {type === 'text' && <p className="leading-relaxed break-words">{content}</p>}
              {type === 'image' && <img src={content} alt="Attachment" className="rounded-xl max-w-full max-h-60 border border-white/10 my-1" />}
              {type === 'video' && <video src={content} controls className="rounded-xl max-w-full max-h-60 border border-white/10 my-1" />}
              {type === 'voice' && <audio src={content} controls className="w-full h-8 max-w-[240px] my-1" />}
              {type === 'file' && (
                <a href={content} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs font-semibold underline text-indigo-200 hover:text-white my-1">
                  <FileText size={15} /> {file_path || 'Document Attachment'}
                </a>
              )}
              {is_edited && <span className="text-[9px] opacity-60 ml-1">(edited)</span>}
            </>
          )}

          {/* Timestamp & Read Receipt */}
          <div className="flex items-center justify-end gap-1 mt-1 opacity-60 text-[9px] font-medium">
            {isYou && (read_receipts.length > 0 ? <CheckCheck size={11} className="text-emerald-300" /> : <Check size={11} />)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Message;
