import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';

// =====================================================
// CONVERSATIONS
// =====================================================

export const useConversations = (userId: string) => {
  return useQuery({
    queryKey: ['conversations', userId],
    queryFn: async () => {
      const { data: memberData, error: memberError } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', userId);

      if (memberError) throw new Error(memberError.message);

      const conversationIds = memberData?.map(m => m.conversation_id) || [];

      if (conversationIds.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          members:conversation_members(
            *,
            user:staff_profiles(id, full_name, avatar_url, role, department)
          )
        `)
        .in('id', conversationIds)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!userId,
  });
};

export const useConversation = (conversationId: string) => {
  return useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          members:conversation_members(
            id,
            user_id,
            is_admin,
            user:staff_profiles(id, full_name, avatar_url, role)
          )
        `)
        .eq('id', conversationId)
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!conversationId,
  });
};

// =====================================================
// MESSAGES
// =====================================================

export const useMessages = (conversationId: string) => {
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:staff_profiles(id, full_name, avatar_url),
          read_receipts:message_read_receipts(
            *,
            user:staff_profiles(id, full_name)
          )
        `)
        .eq('conversation_id', conversationId)
        .or('is_deleted.eq.false,is_deleted.is.null')
        .order('created_at', { ascending: true });

      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!conversationId,
  });
};

export const useSendMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      senderId,
      content,
      type = 'text',
      filePath,
    }: {
      conversationId: string;
      senderId: string;
      content: string;
      type?: 'text' | 'voice' | 'file' | 'image' | 'video' | 'call_log';
      filePath?: string;
    }) => {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('send_chat_message', {
        p_conversation_id: conversationId,
        p_sender_id: senderId,
        p_content: content,
        p_type: type,
        p_file_path: filePath || null,
      });

      if (!rpcErr && rpcData) {
        return rpcData;
      }

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          content,
          type,
          file_path: filePath,
          status: 'sent',
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      const previewText = type === 'text' ? content.substring(0, 100) : `[${type.toUpperCase()}] Attachment`;
      await supabase
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: previewText,
        })
        .eq('id', conversationId)
        .catch(() => {});

      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation', variables.conversationId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to send message: ${error.message}`);
    },
  });
};

export const useUpdateMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      messageId,
      content,
      conversationId,
    }: {
      messageId: string;
      content: string;
      conversationId: string;
    }) => {
      const { error: rpcErr } = await supabase.rpc('update_chat_message', {
        p_message_id: messageId,
        p_content: content,
      });

      if (rpcErr) {
        const { data, error } = await supabase
          .from('messages')
          .update({
            content,
            is_edited: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', messageId)
          .select()
          .single();

        if (error) throw new Error(error.message);
        return data;
      }
      return { id: messageId, content, is_edited: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.conversationId] });
      toast.success('Message edited');
    },
    onError: (error: Error) => {
      toast.error(`Failed to edit message: ${error.message}`);
    },
  });
};

export const useDeleteMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      messageId,
      conversationId,
      forEveryone = false,
    }: {
      messageId: string;
      conversationId: string;
      forEveryone?: boolean;
    }) => {
      const { error: rpcErr } = await supabase.rpc('delete_chat_message', {
        p_message_id: messageId,
        p_for_everyone: forEveryone,
      });

      if (rpcErr) {
        if (forEveryone) {
          const { data, error } = await supabase
            .from('messages')
            .update({
              is_deleted: true,
              status: 'deleted_for_all',
              content: '🚫 This message was deleted',
            })
            .eq('id', messageId)
            .select()
            .single();
          if (error) throw new Error(error.message);
          return data;
        } else {
          const { error } = await supabase.from('messages').delete().eq('id', messageId);
          if (error) throw new Error(error.message);
        }
      }
      return { id: messageId, forEveryone };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.conversationId] });
      toast.success(variables.forEveryone ? 'Message deleted for everyone' : 'Message deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete message: ${error.message}`);
    },
  });
};

// Log Voice/Video Call Events in Chat
export const useSendCallLog = () => {
  const sendMessage = useSendMessage();

  return useCallback(
    ({
      conversationId,
      senderId,
      callType,
      status,
      durationSeconds,
    }: {
      conversationId: string;
      senderId: string;
      callType: 'audio' | 'video';
      status: 'completed' | 'missed' | 'rejected';
      durationSeconds?: number;
    }) => {
      const payload = JSON.stringify({
        callType,
        status,
        durationSeconds: durationSeconds || 0,
      });

      return sendMessage.mutate({
        conversationId,
        senderId,
        content: payload,
        type: 'call_log',
      });
    },
    [sendMessage]
  );
};

// =====================================================
// CONVERSATION MANAGEMENT
// =====================================================

export const useGetOrCreateDM = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId1,
      userId2,
    }: {
      userId1: string;
      userId2: string;
    }) => {
      const { data: existing, error: searchError } = await supabase.rpc('get_or_create_conversation', {
        user_id_1: userId1,
        user_id_2: userId2,
      });

      if (!searchError && existing) {
        return { id: existing };
      }

      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          is_group: false,
          created_by: userId1,
        })
        .select()
        .single();

      if (convError) throw new Error(convError.message);

      const { error: membersError } = await supabase.from('conversation_members').insert([
        { conversation_id: conversation.id, user_id: userId1 },
        { conversation_id: conversation.id, user_id: userId2 },
      ]);

      if (membersError) throw new Error(membersError.message);

      return conversation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to create conversation: ${error.message}`);
    },
  });
};

export const useCreateGroupConversation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      name,
      memberIds,
      createdBy,
    }: {
      name: string;
      memberIds: string[];
      createdBy: string;
    }) => {
      const allIds = Array.from(new Set([createdBy, ...memberIds]));
      
      const { data: rpcConvId, error: rpcErr } = await supabase.rpc('create_group_conversation', {
        p_name: name,
        p_member_ids: allIds,
      });

      if (!rpcErr && rpcConvId) {
        return { id: rpcConvId, name, is_group: true };
      }

      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          name,
          is_group: true,
          created_by: createdBy,
        })
        .select()
        .single();

      if (convError) throw new Error(convError.message);

      const members = allIds.map((userId) => ({
        conversation_id: conversation.id,
        user_id: userId,
        is_admin: userId === createdBy,
      }));

      const { error: membersError } = await supabase.from('conversation_members').insert(members);

      if (membersError) throw new Error(membersError.message);

      return conversation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Group chat created!');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create group: ${error.message}`);
    },
  });
};

export const useAddMemberToConversation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      userId,
    }: {
      conversationId: string;
      userId: string;
    }) => {
      const { data, error } = await supabase
        .from('conversation_members')
        .insert({
          conversation_id: conversationId,
          user_id: userId,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['conversation', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Member added!');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add member: ${error.message}`);
    },
  });
};

// =====================================================
// READ RECEIPTS
// =====================================================

export const useMarkMessagesAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      messageIds,
      userId,
      conversationId,
    }: {
      messageIds: string[];
      userId: string;
      conversationId: string;
    }) => {
      if (messageIds.length === 0) return;
      const receipts = messageIds.map(msgId => ({
        message_id: msgId,
        user_id: userId,
      }));

      await supabase
        .from('message_read_receipts')
        .upsert(receipts, { onConflict: 'message_id,user_id', ignoreDuplicates: true })
        .catch(() => {});

      await supabase
        .from('messages')
        .update({ status: 'seen' })
        .in('id', messageIds)
        .neq('sender_id', userId)
        .catch(() => {});

      await supabase
        .from('conversation_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .catch(() => {});
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.conversationId] });
    },
  });
};

// =====================================================
// REAL-TIME PRESENCE & ONLINE STATUS
// =====================================================

export const usePresence = (conversationId?: string | null, currentUserId?: string | null) => {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!currentUserId) return;

    const channelName = conversationId ? `presence:${conversationId}` : 'presence:global';
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: currentUserId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users: string[] = [];
        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[];
          if (presences && presences[0]?.user_id) {
            users.push(presences[0].user_id);
          }
        });
        setOnlineUsers(Array.from(new Set(users)));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: currentUserId,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId]);

  return onlineUsers;
};

export const useGlobalPresence = (currentUserId?: string | null) => {
  return usePresence(null, currentUserId);
};

// =====================================================
// REAL-TIME MESSAGES SUBSCRIPTION
// =====================================================

export const useMessagesSubscription = (
  conversationId: string,
  onNewMessage?: (message: any) => void
) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`chat_sub:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
          if (payload.eventType === 'INSERT' && onNewMessage) {
            onNewMessage(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient, onNewMessage]);
};

// =====================================================
// TYPING INDICATORS
// =====================================================

export const useSetTyping = () => {
  return useMutation({
    mutationFn: async ({
      conversationId,
      userId,
    }: {
      conversationId: string;
      userId: string;
    }) => {
      const { error } = await supabase
        .from('typing_indicators')
        .upsert(
          {
            conversation_id: conversationId,
            user_id: userId,
            started_at: new Date().toISOString(),
          },
          { onConflict: 'conversation_id,user_id' }
        );

      if (error) throw new Error(error.message);
    },
  });
};

export const useClearTyping = () => {
  return useMutation({
    mutationFn: async ({
      conversationId,
      userId,
    }: {
      conversationId: string;
      userId: string;
    }) => {
      const { error } = await supabase
        .from('typing_indicators')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);

      if (error) throw new Error(error.message);
    },
  });
};

export const useTypingIndicators = (conversationId: string, currentUserId: string) => {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`typing:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async () => {
          const { data } = await supabase
            .from('typing_indicators')
            .select('user_id, started_at')
            .eq('conversation_id', conversationId);

          if (data) {
            const now = Date.now();
            const active = data
              .filter((t) => {
                const isRecent = now - new Date(t.started_at).getTime() < 4000;
                return isRecent && t.user_id !== currentUserId;
              })
              .map((t) => t.user_id);

            setTypingUsers(active);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId]);

  return typingUsers;
};
