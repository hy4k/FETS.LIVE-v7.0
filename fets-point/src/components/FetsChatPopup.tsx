import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
    Send, Mic, Paperclip, X, Minus, Edit3, Trash2,
    Phone, Video, FileText, Square, UserPlus, Check, CheckCheck, Loader2
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useGlobalCall } from '../contexts/CallContext'
import { format } from 'date-fns'
import { toast } from 'react-hot-toast'
import { StaffProfile } from '../types/shared'

interface Message {
    id: string
    conversation_id: string
    sender_id: string
    content: string
    type: 'text' | 'voice' | 'file' | 'image' | 'video'
    file_path?: string
    created_at: string
    status?: string
    is_deleted?: boolean
    is_edited?: boolean
}

interface ConvMember {
    user_id: string
    staff_profiles?: {
        id: string
        full_name: string
        avatar_url?: string
        role?: string
    }
}

interface FetsChatPopupProps {
    targetUser?: StaffProfile | null
    conversationId?: string | null
    onClose: () => void
    zIndex?: number
}

export const FetsChatPopup: React.FC<FetsChatPopupProps> = ({
    targetUser: initialTargetUser,
    conversationId,
    onClose,
    zIndex = 1000
}) => {
    const { profile } = useAuth()
    const { startCall } = useGlobalCall()

    const [messages, setMessages] = useState<Message[]>([])
    const [newMessage, setNewMessage] = useState('')
    const [isMinimized, setIsMinimized] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isUploading, setIsUploading] = useState(false)

    // Conversation state
    const [currentConvId, setCurrentConvId] = useState<string | null>(conversationId || null)
    const [targetUser, setTargetUser] = useState<StaffProfile | null>(initialTargetUser || null)
    const [isGroup, setIsGroup] = useState(false)
    const [currentName, setCurrentName] = useState('Chat')
    const [members, setMembers] = useState<ConvMember[]>([])

    // Add People
    const [allStaff, setAllStaff] = useState<StaffProfile[]>([])
    const [showAddPeople, setShowAddPeople] = useState(false)

    // Recording
    const [isRecording, setIsRecording] = useState<'audio' | 'video' | null>(null)
    const [recordingTime, setRecordingTime] = useState(0)

    // Edit
    const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
    const [editContent, setEditContent] = useState('')

    // Context menu
    const [contextMenuMsgId, setContextMenuMsgId] = useState<string | null>(null)

    const scrollRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const timerRef = useRef<any>(null)
    const channelRef = useRef<any>(null)

    // Load all staff
    useEffect(() => {
        supabase.from('staff_profiles')
            .select('*')
            .order('full_name', { ascending: true })
            .then(({ data }) => { if (data) setAllStaff(data) })
    }, [])

    // Init conversation + load messages using SECURITY DEFINER RPCs
    useEffect(() => {
        if (!profile?.id) return

        // Clean up previous subscription
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current)
            channelRef.current = null
        }

        const initChat = async () => {
            setIsLoading(true)
            try {
                let id = currentConvId

                // Create or find direct conversation
                if (!id && targetUser) {
                    const { data: convId, error } = await supabase.rpc('get_or_create_conversation', {
                        user_id_1: profile.id,
                        user_id_2: targetUser.id
                    })
                    if (error) throw error
                    id = convId
                    setCurrentConvId(id)
                }

                if (!id) return

                // Load conversation info via SECURITY DEFINER RPC
                const { data: convInfo, error: convErr } = await supabase.rpc('get_conversation_info', {
                    p_conversation_id: id
                })

                if (!convErr && convInfo && convInfo.length > 0) {
                    const conv = convInfo[0]
                    setIsGroup(conv.is_group)
                    // Build members list from arrays
                    const memberList: ConvMember[] = (conv.member_ids || []).map((uid: string, i: number) => ({
                        user_id: uid,
                        staff_profiles: {
                            id: uid,
                            full_name: (conv.member_names || [])[i] || 'Staff',
                            avatar_url: (conv.member_avatars || [])[i] || undefined
                        }
                    }))
                    setMembers(memberList)

                    if (conv.is_group) {
                        setCurrentName(conv.name || 'Group Chat')
                    } else if (targetUser) {
                        setCurrentName(targetUser.full_name)
                    } else {
                        const other = memberList.find(m => m.user_id !== profile.id)
                        setCurrentName(other?.staff_profiles?.full_name || 'Direct Chat')
                    }
                } else {
                    // Fallback: load members directly from conversation_members (no RLS)
                    const { data: rawMembers } = await supabase
                        .from('conversation_members')
                        .select('user_id, staff_profiles(id, full_name, avatar_url, role)')
                        .eq('conversation_id', id)
                    
                    if (rawMembers) {
                        setMembers(rawMembers as ConvMember[])
                        if (targetUser) {
                            setCurrentName(targetUser.full_name)
                        } else {
                            const other = rawMembers.find((m: any) => m.user_id !== profile.id)
                            setCurrentName((other as any)?.staff_profiles?.full_name || 'Direct Chat')
                        }
                    }
                }

                // Load messages via SECURITY DEFINER RPC
                const { data: msgs, error: msgsErr } = await supabase.rpc('get_conversation_messages', {
                    p_conversation_id: id,
                    p_limit: 200
                })

                if (!msgsErr && msgs) {
                    setMessages(msgs as Message[])
                } else {
                    // Fallback: try direct query (works if RLS is fixed)
                    const { data: directMsgs } = await supabase
                        .from('messages')
                        .select('*')
                        .eq('conversation_id', id)
                        .order('created_at', { ascending: true })
                    setMessages(directMsgs || [])
                }

                // Subscribe to realtime changes
                const channel = supabase.channel(`chat:${id}`)
                    .on('postgres_changes', {
                        event: '*',
                        schema: 'public',
                        table: 'messages',
                        filter: `conversation_id=eq.${id}`
                    }, payload => {
                        if (payload.eventType === 'INSERT') {
                            setMessages(prev => {
                                if (prev.some(m => m.id === payload.new.id)) return prev
                                return [...prev, payload.new as Message]
                            })
                        } else if (payload.eventType === 'UPDATE') {
                            setMessages(prev => prev.map(m =>
                                m.id === payload.new.id ? { ...m, ...payload.new } : m
                            ))
                        } else if (payload.eventType === 'DELETE') {
                            setMessages(prev => prev.filter(m => m.id !== payload.old.id))
                        }
                    })
                    .subscribe()

                channelRef.current = channel

            } catch (e) {
                console.error('Chat init error:', e)
                toast.error('Failed to load chat')
            } finally {
                setIsLoading(false)
            }
        }

        initChat()

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current)
                channelRef.current = null
            }
        }
    }, [currentConvId, targetUser?.id, profile?.id])

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages, isMinimized])

    const handleSendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        if (!newMessage.trim() || !currentConvId || !profile?.id) return

        const text = newMessage.trim()
        setNewMessage('')

        try {
            // Try via SECURITY DEFINER RPC first
            const { error: rpcErr } = await supabase.rpc('send_chat_message', {
                p_conversation_id: currentConvId,
                p_sender_id: profile.id,
                p_content: text,
                p_type: 'text'
            })

            if (rpcErr) {
                // Fallback: direct insert (works if RLS is fixed)
                await supabase.from('messages').insert({
                    conversation_id: currentConvId,
                    sender_id: profile.id,
                    content: text,
                    type: 'text',
                    status: 'sent'
                })
            }
        } catch (err) {
            setNewMessage(text) // Restore on error
            toast.error('Failed to send message')
        }
    }

    const handleEditMessage = async (msgId: string) => {
        if (!editContent.trim()) return
        try {
            const { error: rpcErr } = await supabase.rpc('update_chat_message', {
                p_message_id: msgId,
                p_content: editContent.trim()
            })
            if (rpcErr) {
                await supabase.from('messages').update({ content: editContent.trim(), is_edited: true }).eq('id', msgId)
            }
            setEditingMsgId(null)
            setEditContent('')
        } catch {
            toast.error('Failed to edit message')
        }
    }

    const handleDeleteMessage = async (msgId: string, forAll = false) => {
        try {
            const { error: rpcErr } = await supabase.rpc('delete_chat_message', {
                p_message_id: msgId,
                p_for_everyone: forAll
            })

            if (rpcErr) {
                // Fallback direct
                if (forAll) {
                    await supabase.from('messages').update({
                        status: 'deleted_for_all',
                        content: '🚫 Message deleted',
                        is_deleted: true
                    }).eq('id', msgId)
                    setMessages(prev => prev.map(m =>
                        m.id === msgId ? { ...m, status: 'deleted_for_all', content: '🚫 Message deleted' } : m
                    ))
                } else {
                    await supabase.from('messages').delete().eq('id', msgId)
                    setMessages(prev => prev.filter(m => m.id !== msgId))
                }
            } else {
                if (!forAll) setMessages(prev => prev.filter(m => m.id !== msgId))
            }
            setContextMenuMsgId(null)
            toast.success(forAll ? 'Deleted for everyone' : 'Message deleted')
        } catch {
            toast.error('Delete failed')
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !currentConvId || !profile?.id) return

        setIsUploading(true)
        try {
            const path = `chat/${currentConvId}/${Date.now()}_${file.name}`
            await supabase.storage.from('chat-uploads').upload(path, file)
            const { data } = supabase.storage.from('chat-uploads').getPublicUrl(path)

            let type: Message['type'] = 'file'
            if (file.type.startsWith('image/')) type = 'image'
            else if (file.type.startsWith('video/')) type = 'video'
            else if (file.type.startsWith('audio/')) type = 'voice'

            await supabase.rpc('send_chat_message', {
                p_conversation_id: currentConvId,
                p_sender_id: profile.id,
                p_content: data.publicUrl,
                p_type: type,
                p_file_path: file.name
            }).then(({ error }) => {
                if (error) {
                    return supabase.from('messages').insert({
                        conversation_id: currentConvId,
                        sender_id: profile.id,
                        content: data.publicUrl,
                        type,
                        file_path: file.name
                    })
                }
            })
        } catch {
            toast.error('Upload failed')
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const startRecording = async (type: 'audio' | 'video') => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia(
                type === 'audio' ? { audio: true } : { video: true, audio: true }
            )
            const recorder = new MediaRecorder(stream)
            mediaRecorderRef.current = recorder
            chunksRef.current = []

            recorder.ondataavailable = e => chunksRef.current.push(e.data)
            recorder.onstop = async () => {
                const blob = new Blob(chunksRef.current, { type: type === 'audio' ? 'audio/webm' : 'video/webm' })
                const file = new File([blob], 'recording.webm', { type: blob.type })
                setIsUploading(true)
                try {
                    const path = `chat/${currentConvId}/rec_${Date.now()}.webm`
                    await supabase.storage.from('chat-uploads').upload(path, file)
                    const { data } = supabase.storage.from('chat-uploads').getPublicUrl(path)
                    await supabase.rpc('send_chat_message', {
                        p_conversation_id: currentConvId,
                        p_sender_id: profile?.id,
                        p_content: data.publicUrl,
                        p_type: type === 'audio' ? 'voice' : 'video'
                    })
                } catch {
                    toast.error('Failed to send recording')
                } finally {
                    setIsUploading(false)
                }
                stream.getTracks().forEach(t => t.stop())
            }

            recorder.start()
            setIsRecording(type)
            setRecordingTime(0)
            timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000)
        } catch {
            toast.error('Microphone/Camera access denied')
        }
    }

    const stopRecording = () => {
        mediaRecorderRef.current?.stop()
        setIsRecording(null)
        clearInterval(timerRef.current)
    }

    // Call handlers via global context
    const handleVoiceCall = () => {
        const targets = members.map(m => m.user_id).filter(uid => uid !== profile?.id)
        if (targets.length > 0) startCall(targets, 'audio')
        else toast.error('No other participants to call')
    }

    const handleVideoCall = () => {
        const targets = members.map(m => m.user_id).filter(uid => uid !== profile?.id)
        if (targets.length > 0) startCall(targets, 'video')
        else toast.error('No other participants to call')
    }

    const handleAddMember = async (staff: StaffProfile) => {
        if (!profile?.id || !currentConvId) return
        try {
            if (isGroup) {
                await supabase.rpc('add_conversation_member', {
                    p_conversation_id: currentConvId,
                    p_user_id: staff.id
                })
                setMembers(prev => [...prev, {
                    user_id: staff.id,
                    staff_profiles: { id: staff.id, full_name: staff.full_name, avatar_url: staff.avatar_url }
                }])
                toast.success(`${staff.full_name} added!`)
            } else {
                // Upgrade 1:1 to group
                const otherMember = members.find(m => m.user_id !== profile.id)
                const allIds = [
                    profile.id,
                    staff.id,
                    ...(otherMember ? [otherMember.user_id] : targetUser ? [targetUser.id] : [])
                ]
                const { data: newConvId, error } = await supabase.rpc('create_group_conversation', {
                    p_name: 'Group Chat',
                    p_member_ids: allIds
                })
                if (error) throw error
                setCurrentConvId(newConvId)
                setTargetUser(null)
                toast.success('Converted to Group Chat!')
            }
            setShowAddPeople(false)
        } catch (e) {
            console.error(e)
            toast.error('Failed to add teammate')
        }
    }

    const currentMemberIds = members.map(m => m.user_id)
    const addableStaff = allStaff.filter(s => s.id !== profile?.id && !currentMemberIds.includes(s.id))

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0, height: isMinimized ? 48 : 520, width: 380 }}
            drag
            dragMomentum={false}
            style={{ zIndex }}
            className="fixed bottom-4 right-4 bg-[var(--glass)] rounded-2xl shadow-[var(--shadow-lift)] border border-[var(--hairline)] overflow-hidden flex flex-col"
        >
            {/* HEADER */}
            <div className="bg-[var(--accent)] text-[var(--accent-ink)] px-4 py-3 flex items-center justify-between border-b border-[var(--hairline)] cursor-move select-none">
                <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    </div>
                    <span className="font-black text-xs uppercase tracking-[0.18em] italic truncate max-w-[140px]">
                        FETSCHAT // <span className="opacity-70">{currentName}</span>
                    </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => setShowAddPeople(v => !v)} className="hover:scale-110 transition-transform p-1.5 hover:bg-[var(--accent-ink)]/10 rounded-lg" title="Add Teammates">
                        <UserPlus size={15} />
                    </button>
                    <button onClick={handleVoiceCall} className="hover:scale-110 transition-transform p-1.5 hover:bg-[var(--accent-ink)]/10 rounded-lg" title="Voice Call">
                        <Phone size={15} />
                    </button>
                    <button onClick={handleVideoCall} className="hover:scale-110 transition-transform p-1.5 hover:bg-[var(--accent-ink)]/10 rounded-lg" title="Video Call">
                        <Video size={15} />
                    </button>
                    <div className="w-px h-4 bg-[var(--accent-ink)]/20" />
                    <button onClick={() => setIsMinimized(!isMinimized)} className="hover:bg-[var(--accent-ink)]/10 p-1 rounded transition-colors">
                        <Minus size={15} />
                    </button>
                    <button onClick={onClose} className="hover:bg-[var(--accent-ink)]/10 p-1 rounded transition-colors">
                        <X size={15} />
                    </button>
                </div>
            </div>

            {!isMinimized && (
                <>
                    {/* ADD PEOPLE PANEL */}
                    {showAddPeople && (
                        <div className="absolute top-12 left-0 right-0 bg-[var(--glass)] border-b border-[var(--hairline)] p-3 z-30 max-h-52 overflow-y-auto">
                            <div className="flex justify-between items-center pb-2 border-b border-[var(--hairline)]">
                                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--ink-3)]">Add people to chat</span>
                                <button onClick={() => setShowAddPeople(false)} className="text-[var(--ink-4)] text-lg leading-none hover:text-[var(--ink)]">×</button>
                            </div>
                            {addableStaff.length === 0 ? (
                                <p className="text-[10px] text-[var(--ink-4)] text-center py-3 italic">No other staff to add</p>
                            ) : (
                                <div className="flex flex-col gap-1 pt-1">
                                    {addableStaff.map(staff => (
                                        <button key={staff.id} onClick={() => handleAddMember(staff)}
                                            className="flex items-center gap-2 p-1.5 hover:bg-[var(--glass-2)] rounded-lg text-left text-xs font-bold text-[var(--ink)] w-full">
                                            <img
                                                src={staff.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(staff.full_name)}&background=random`}
                                                className="w-6 h-6 rounded-full object-cover" alt=""
                                            />
                                            <span className="truncate">{staff.full_name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* MESSAGES */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar" onClick={() => setContextMenuMsgId(null)}>
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center h-full gap-2 text-[var(--ink-4)]">
                                <Loader2 size={20} className="animate-spin" />
                                <span className="text-xs font-bold uppercase tracking-widest">Loading...</span>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="flex items-center justify-center h-full">
                                <p className="text-xs text-[var(--ink-4)] italic">No messages yet. Start the conversation!</p>
                            </div>
                        ) : (
                            messages.map((msg, idx) => {
                                const isMe = msg.sender_id === profile?.id
                                const isDeleted = msg.status === 'deleted_for_all' || msg.is_deleted
                                const senderMember = members.find(m => m.user_id === msg.sender_id)
                                const senderName = senderMember?.staff_profiles?.full_name || 'Staff'

                                return (
                                    <div key={msg.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                                        <div className={`max-w-[85%] p-3 rounded-2xl border border-[var(--hairline)] relative
                                            ${isMe ? 'bg-[var(--accent)] text-[var(--accent-ink)] rounded-br-none' : 'bg-[var(--glass-2)] text-[var(--ink)] rounded-bl-none'}
                                            ${isDeleted ? 'opacity-50 italic' : ''}`}>

                                            {/* Group sender name */}
                                            {isGroup && !isMe && !isDeleted && (
                                                <div className="text-[10px] font-black uppercase text-[var(--accent)] mb-1 opacity-80">
                                                    {senderName}
                                                </div>
                                            )}

                                            {/* Hover actions for own messages */}
                                            {isMe && !isDeleted && (
                                                <div className="absolute -top-2 -right-2 hidden group-hover:flex gap-1">
                                                    <button onClick={() => { setEditingMsgId(msg.id); setEditContent(msg.content) }}
                                                        className="p-1 bg-[var(--glass)] border border-[var(--hairline)] rounded-full hover:bg-[var(--accent-soft)]" title="Edit">
                                                        <Edit3 size={10} />
                                                    </button>
                                                    <button onClick={() => setContextMenuMsgId(msg.id === contextMenuMsgId ? null : msg.id)}
                                                        className="p-1 bg-[var(--glass)] border border-[var(--hairline)] rounded-full hover:bg-red-100/10" title="Delete">
                                                        <Trash2 size={10} />
                                                    </button>
                                                </div>
                                            )}

                                            {/* Delete dropdown */}
                                            {contextMenuMsgId === msg.id && (
                                                <div className="absolute top-full right-0 mt-1 bg-[var(--glass)] border border-[var(--hairline)] rounded-xl shadow-[var(--shadow-lift)] z-20 overflow-hidden min-w-[140px]"
                                                    onClick={e => e.stopPropagation()}>
                                                    <button onClick={e => { e.stopPropagation(); handleDeleteMessage(msg.id, false) }}
                                                        className="w-full px-4 py-2 text-[10px] font-black uppercase text-left hover:bg-[var(--glass-2)] text-[var(--ink)]">
                                                        Delete for me
                                                    </button>
                                                    <button onClick={e => { e.stopPropagation(); handleDeleteMessage(msg.id, true) }}
                                                        className="w-full px-4 py-2 text-[10px] font-black uppercase text-left hover:bg-red-50/10 text-[var(--bad)] border-t border-[var(--hairline)]">
                                                        Delete for everyone
                                                    </button>
                                                </div>
                                            )}

                                            {/* Edit mode */}
                                            {editingMsgId === msg.id ? (
                                                <div className="flex flex-col gap-2">
                                                    <input type="text" value={editContent} onChange={e => setEditContent(e.target.value)}
                                                        className="w-full bg-[var(--glass)] border border-[var(--hairline)] rounded-lg px-2 py-1 text-sm font-bold outline-none text-[var(--ink)]"
                                                        autoFocus />
                                                    <div className="flex gap-2 justify-end">
                                                        <button onClick={() => setEditingMsgId(null)} className="text-[9px] font-black uppercase text-[var(--ink-4)] hover:text-[var(--ink)]">Cancel</button>
                                                        <button onClick={() => handleEditMessage(msg.id)} className="text-[9px] font-black uppercase text-[var(--accent)]">Save</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    {msg.type === 'text' && <p className="text-sm font-medium leading-snug break-words">{msg.content}</p>}
                                                    {msg.type === 'image' && <img src={msg.content} alt="Attachment" className="rounded-lg max-w-full border border-[var(--hairline)]" />}
                                                    {msg.type === 'video' && <video src={msg.content} controls className="rounded-lg max-w-full" />}
                                                    {msg.type === 'voice' && <audio src={msg.content} controls className="w-full h-8" />}
                                                    {msg.type === 'file' && (
                                                        <a href={msg.content} target="_blank" rel="noreferrer"
                                                            className={`flex items-center gap-2 text-xs font-bold underline ${isMe ? 'text-[var(--accent-ink)]' : 'text-[var(--ink)]'}`}>
                                                            <FileText size={14} /> {msg.file_path || 'Document'}
                                                        </a>
                                                    )}
                                                    {msg.is_edited && <span className="text-[9px] opacity-50 ml-1">(edited)</span>}
                                                </>
                                            )}

                                            {/* Timestamp + read receipts */}
                                            <div className={`flex items-center justify-end gap-1 mt-1 opacity-40 text-[9px] font-bold`}>
                                                {format(new Date(msg.created_at), 'HH:mm')}
                                                {isMe && (msg.status === 'seen' ? <CheckCheck size={10} /> : <Check size={10} />)}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>

                    {/* INPUT */}
                    <div className="p-3 border-t border-[var(--hairline)] bg-[var(--glass-2)]">
                        {isRecording ? (
                            <div className="flex items-center justify-between p-3 rounded-xl animate-pulse"
                                style={{ background: 'color-mix(in oklch, var(--bad) 15%, transparent)', border: '1px solid var(--bad)' }}>
                                <div className="flex items-center gap-3 text-[var(--bad)] font-black text-xs uppercase">
                                    <div className="w-2 h-2 rounded-full bg-[var(--bad)] animate-ping" />
                                    {isRecording === 'audio' ? 'Voice' : 'Video'} recording... {recordingTime}s
                                </div>
                                <button onClick={stopRecording} className="bg-[var(--bad)] text-white p-2 rounded-lg">
                                    <Square size={16} />
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSendMessage} className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={e => setNewMessage(e.target.value)}
                                        placeholder="Type a message..."
                                        className="flex-1 bg-[var(--inset)] border border-[var(--hairline)] rounded-xl px-4 py-2 text-sm font-bold outline-none focus:bg-[var(--glass)] transition-all text-[var(--ink)] placeholder-[var(--ink-4)]"
                                    />
                                    <button type="submit" disabled={!newMessage.trim()}
                                        className="bg-[var(--accent)] text-[var(--accent-ink)] p-2.5 rounded-xl border border-[var(--hairline)] hover:opacity-90 disabled:opacity-30 transition-all">
                                        <Send size={18} fill="currentColor" />
                                    </button>
                                </div>
                                <div className="flex items-center gap-1 px-1">
                                    <button type="button" onClick={() => fileInputRef.current?.click()}
                                        className="p-2 text-[var(--ink-4)] hover:text-[var(--ink)] hover:bg-[var(--glass-2)] rounded-lg transition-all" title="Attach Files">
                                        <Paperclip size={17} />
                                    </button>
                                    <button type="button" onClick={() => startRecording('audio')}
                                        className="p-2 text-[var(--ink-4)] hover:text-[var(--ink)] hover:bg-[var(--glass-2)] rounded-lg transition-all" title="Voice Message">
                                        <Mic size={17} />
                                    </button>
                                    <button type="button" onClick={() => startRecording('video')}
                                        className="p-2 text-[var(--ink-4)] hover:text-[var(--ink)] hover:bg-[var(--glass-2)] rounded-lg transition-all" title="Video Message">
                                        <Video size={17} />
                                    </button>
                                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                                    {isUploading && <span className="text-[10px] font-black text-[var(--accent)] animate-pulse uppercase tracking-widest ml-2">Uploading...</span>}
                                </div>
                            </form>
                        )}
                    </div>
                </>
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--ink-4); border-radius: 10px; }
            `}</style>
        </motion.div>
    )
}
