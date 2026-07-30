import React, { useState } from 'react';
import ConversationList from './ConversationList';
import UserList from './UserList';
import Conversation from './Conversation';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { Conversation as ConversationType } from '../../types';
import { BellRing, MessageSquare } from 'lucide-react';

const Chat: React.FC = () => {
  const [selectedConversation, setSelectedConversation] = useState<ConversationType | null>(null);
  const { subscribe } = usePushNotifications();

  return (
    <div className="flex h-screen bg-slate-950 text-white p-4 gap-4 overflow-hidden">
      {/* Conversations Sidebar */}
      <div className="w-full md:w-1/4 bg-slate-900 border border-white/10 rounded-2xl p-4 flex flex-col gap-3 shadow-xl overflow-y-auto custom-scrollbar">
        <div className="flex items-center gap-2 pb-2 border-b border-white/10">
          <MessageSquare className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold text-slate-100">Conversations</h2>
        </div>
        <ConversationList setSelectedConversation={setSelectedConversation} />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {selectedConversation ? (
          <Conversation conversation={selectedConversation} />
        ) : (
          <div className="flex-1 bg-slate-900/50 border border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-16 h-16 rounded-full bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
              <MessageSquare className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-200">FETS Real-Time Live Chat</h2>
            <p className="text-xs text-slate-400 max-w-sm">
              Select a conversation from the left sidebar or pick a user from the directory to start instant messaging.
            </p>
          </div>
        )}
      </div>

      {/* User Directory Sidebar */}
      <div className="hidden lg:flex w-1/4 bg-slate-900 border border-white/10 rounded-2xl p-4 flex-col gap-4 shadow-xl overflow-y-auto custom-scrollbar">
        <button
          className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer shrink-0"
          onClick={() => subscribe()}
        >
          <BellRing className="w-4 h-4" /> Enable Push Notifications
        </button>
        <div className="flex-1 flex flex-col gap-2">
          <h2 className="text-sm font-bold text-slate-200 border-b border-white/10 pb-2">Active Staff Directory</h2>
          <UserList />
        </div>
      </div>
    </div>
  );
};

export default Chat;
