import React, { useEffect, useRef, useState } from 'react';
import { useMessages, useSendMessage, usePresence } from '../../hooks/useChat';
import { useAuth } from '../../hooks/useAuth';
import Message from './Message';
import MessageInput from './MessageInput';
import { supabase } from '../../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { Conversation as ConversationType } from '../../types';
import { useGlobalCall } from '../../contexts/CallContext';
import { Phone, Video, Loader2, Circle, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ConversationProps {
  conversation: ConversationType;
}

const Conversation: React.FC<ConversationProps> = ({ conversation }) => {
  const { user } = useAuth();
  const { startCall } = useGlobalCall();
  const { data: messages = [], isLoading } = useMessages(conversation.id);
  const sendMessage = useSendMessage();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);

  // Real-time Presence
  const onlineUserIds = usePresence(conversation.id, user?.id);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`full_chat:${conversation.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversation.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] });
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation.id, queryClient]);

  const handleSendMessage = (content: string, type: 'text' | 'voice' | 'file' | 'image' | 'video' = 'text', filePath?: string) => {
    if (user?.id) {
      sendMessage.mutate({ conversationId: conversation.id, senderId: user.id, content, type, filePath });
    }
  };

  const handleUploadFile = async (file: File): Promise<string | null> => {
    if (!user?.id || !conversation.id) return null;
    setIsUploading(true);
    try {
      const path = `chat/${conversation.id}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from('chat-uploads').upload(path, file);

      let mediaUrl = '';
      if (!upErr) {
        const { data } = supabase.storage.from('chat-uploads').getPublicUrl(path);
        mediaUrl = data.publicUrl;
      } else {
        mediaUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }
      return mediaUrl;
    } catch {
      toast.error('Failed to upload file');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const getRecipientUserIds = () => {
    if (!conversation.members) return [];
    return conversation.members.map((m: any) => m.user_id || m.user?.id || m.staff_profiles?.id).filter((id: string) => id && id !== user?.id);
  };

  const handleVoiceCall = () => {
    const targets = getRecipientUserIds();
    if (targets.length > 0) startCall(targets, 'audio');
    else toast.error('No other participants to call');
  };

  const handleVideoCall = () => {
    const targets = getRecipientUserIds();
    if (targets.length > 0) startCall(targets, 'video');
    else toast.error('No other participants to call');
  };

  // Determine header display name
  const otherMembers = conversation.members?.filter((m: any) => (m.user_id || m.user?.id || m.staff_profiles?.id) !== user?.id) || [];
  const firstOther = otherMembers[0] as any;
  const displayName = conversation.is_group
    ? conversation.name || 'Group Chat'
    : firstOther?.user?.full_name || firstOther?.staff_profiles?.full_name || conversation.name || 'Direct Chat';

  const isOnline = otherMembers.some((m: any) => onlineUserIds.includes(m.user_id || m.user?.id || m.staff_profiles?.id));

  return (
    <div className="flex flex-col h-full bg-slate-950 text-white rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
      {/* Top Header */}
      <div className="bg-slate-900/90 px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-indigo-600/40 border border-indigo-400/30 flex items-center justify-center font-bold text-sm uppercase">
              {displayName.charAt(0)}
            </div>
            <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-950 ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-slate-500'}`} />
          </div>

          <div>
            <h3 className="font-bold text-base text-white">{displayName}</h3>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              {conversation.is_group ? (
                <span className="flex items-center gap-1">
                  <Users size={12} /> {conversation.members?.length || 1} members
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Circle size={8} className={`fill-current ${isOnline ? 'text-emerald-400' : 'text-slate-500'}`} />
                  {isOnline ? 'Active Now' : 'Offline'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleVoiceCall}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-emerald-400 rounded-xl border border-white/10 transition-colors"
            title="Start Audio Call"
          >
            <Phone className="w-4 h-4" />
          </button>
          <button
            onClick={handleVideoCall}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-indigo-400 rounded-xl border border-white/10 transition-colors"
            title="Start Video Call"
          >
            <Video className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-950/60 custom-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
            <span className="text-xs font-medium">Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500 italic text-sm">
            No messages in this conversation yet. Send a message to start!
          </div>
        ) : (
          messages.map((msg) => <Message key={msg.id} message={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MessageInput onSendMessage={handleSendMessage} onUploadFile={handleUploadFile} isUploading={isUploading} />
    </div>
  );
};

export default Conversation;
