import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
    Send, Mic, Paperclip, X, Minus, Edit3, Trash2,
    Phone, Video, FileText, Square, UserPlus, Check, CheckCheck
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
    status?: 'sent' | 'delivered' | 'seen' | 'deleted_for_me' | 'deleted_for_all'
}

interface FetsChatPopupProps {
    targetUser?: StaffProfile | null
    conversationId?: string | null
    onClose: () => void
    zIndex?: number
}

export const FetsChatPopup: React.FC<FetsChatPopupProps> = ({ targetUser: initialTargetUser, conversationId, onClose, zIndex = 1000 }) => {
    const { profile } = useAuth()
    const { startCall } = useGlobalCall()
    const [messages, setMessages] = useState<Message[]>([])
    const [newMessage, setNewMessage] = useState('')
    const [isMinimized, setIsMinimized] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [currentConvId, setCurrentConvId] = useState<string | null>(conversationId || null)
    const [targetUser, setTargetUser] = useState<StaffProfile | null>(initialTargetUser || null)
    
    const [isGroup, setIsGroup] = useState(false)
    const [currentName, setCurrentName] = useState('Chat')
    const [members, setMembers] = useState<any[]>([])
    const [allStaff, setAllStaff] = useState<StaffProfile[]>([])
    const [showAddPeople, setShowAddPeople] = useState(false)

    const [isRecording, setIsRecording] = useState<'audio' | 'video' | null>(null)
    const [recordingTime, setRecordingTime] = useState(0)
    
    // Edit Mode
    const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
    const [editContent, setEditContent] = useState('')
    
    // Context Menu
    const [contextMenuMsgId, setContextMenuMsgId] = useState<string | null>(null)

    const scrollRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const timerRef = useRef<any>(null)

    // Load all staff for "Add People" lookup
    useEffect(() => {
        const fetchAllStaff = async () => {
            const { data } = await supabase.from('staff_profiles').select('*').order('full_name', { ascending: true })
            if (data) setAllStaff(data)
        }
        fetchAllStaff()
    }, [])

    // Load/Create Conversation
    useEffect(() => {
        if (!profile?.id) return

        const initChat = async () => {
            setIsLoading(true)
            try {
                let id = currentConvId
                if (!id && targetUser) {
                    const { data: convData, error } = await supabase.rpc('get_or_create_conversation', {
                        user_id_1: profile.id,
                        user_id_2: targetUser.id
                    })
                    if (error) throw error
                    id = convData
                    setCurrentConvId(id)
                }

                if (!id) return

                // Load conversation details
                const { data: conv } = await supabase
                    .from('conversations')
                    .select('*, conversation_members(*, staff_profiles(id, full_name, avatar_url, role))')
                    .eq('id', id)
                    .single()
                
                if (conv) {
                    setIsGroup(!!conv.is_group)
                    setMembers(conv.conversation_members || [])
                    if (conv.is_group) {
                        setCurrentName(conv.name || 'Group Chat')
                    } else if (targetUser) {
                        setCurrentName(targetUser.full_name)
                    } else {
                        const otherMember = conv.conversation_members?.find((m: any) => m.user_id !== profile.id)
                        setCurrentName(otherMember?.staff_profiles?.full_name || 'Direct Chat')
                    }
                }

                const { data: msgs } = await supabase.from('messages')
                    .select('*')
                    .eq('conversation_id', id)
                    .order('created_at', { ascending: true })
                setMessages(msgs || [])

                // Subscription
                const channel = supabase.channel(`chat_popup:${id}`)
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
                        payload => {
                            if (payload.eventType === 'INSERT') {
                                setMessages(prev => {
                                    if (prev.some(m => m.id === payload.new.id)) return prev
                                    return [...prev, payload.new as Message]
                                })
                                if (payload.new.sender_id !== profile.id) {
                                    supabase.from('messages').update({ status: 'seen' }).eq('id', payload.new.id).then()
                                }
                            } else if (payload.eventType === 'UPDATE') {
                                setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m))
                            } else if (payload.eventType === 'DELETE') {
                                setMessages(prev => prev.filter(m => m.id !== payload.old.id))
                            }
                        })
                    .subscribe()

                return () => {
                    supabase.removeChannel(channel)
                }
            } catch (e) {
                console.error(e)
            } finally {
                setIsLoading(false)
            }
        }
        initChat()
    }, [currentConvId, targetUser, profile?.id])

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages, isMinimized])

    const handleSendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        if (!newMessage.trim() || !currentConvId) return

        try {
            await supabase.from('messages').insert({
                conversation_id: currentConvId,
                sender_id: profile.id,
                content: newMessage.trim(),
                type: 'text',
                status: 'sent'
            })
            setNewMessage('')
        } catch (err) {
            toast.error('Failed to send')
        }
    }

    const handleEditMessage = async (msgId: string) => {
        if (!editContent.trim()) return
        try {
            await supabase.from('messages').update({ content: editContent.trim() }).eq('id', msgId)
            setEditingMsgId(null)
            setEditContent('')
            toast.success('Message updated')
        } catch (err) {
            toast.error('Failed to edit message')
        }
    }

    const handleDeleteMessage = async (msgId: string, forAll: boolean = false) => {
        try {
            if (forAll) {
                const { error } = await supabase.from('messages').update({ 
                    status: 'deleted_for_all', 
                    content: '🚫 Message deleted' 
                }).eq('id', msgId)
                
                if (error) throw error
                
                setMessages(prev => prev.map(m => 
                    m.id === msgId 
                        ? { ...m, status: 'deleted_for_all', content: '🚫 Message deleted' } 
                        : m
                ))
            } else {
                const { error } = await supabase.from('messages').delete().eq('id', msgId)
                if (error) throw error
                setMessages(prev => prev.filter(m => m.id !== msgId))
            }
            setContextMenuMsgId(null)
            toast.success(forAll ? 'Deleted for everyone' : 'Message deleted')
        } catch (err: any) {
            console.error('Delete error:', err)
            toast.error(err.message || 'Delete failed')
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !currentConvId) return

        setIsUploading(true)
        try {
            const path = `chat/${currentConvId}/${Date.now()}_${file.name}`
            await supabase.storage.from('chat-uploads').upload(path, file)
            const { data } = supabase.storage.from('chat-uploads').getPublicUrl(path)

            let type: Message['type'] = 'file'
            if (file.type.startsWith('image/')) type = 'image'
            else if (file.type.startsWith('video/')) type = 'video'
            else if (file.type.startsWith('audio/')) type = 'voice'

            await supabase.from('messages').insert({
                conversation_id: currentConvId,
                sender_id: profile.id,
                content: data.publicUrl,
                type,
                file_path: file.name
            })
        } catch (err) {
            toast.error('Upload failed')
        } finally {
            setIsUploading(false)
        }
    }

    const startRecording = async (type: 'audio' | 'video') => {
        try {
            const constraints = type === 'audio' ? { audio: true } : { video: true, audio: true }
            const stream = await navigator.mediaDevices.getUserMedia(constraints)
            const recorder = new MediaRecorder(stream)
            mediaRecorderRef.current = recorder
            chunksRef.current = []

            recorder.ondataavailable = (e) => chunksRef.current.push(e.data)
            recorder.onstop = async () => {
                const blob = new Blob(chunksRef.current, { type: type === 'audio' ? 'audio/webm' : 'video/webm' })
                const file = new File([blob], `recording.webm`, { type: blob.type })
                
                setIsUploading(true)
                try {
                    const path = `chat/${currentConvId}/recording_${Date.now()}.webm`
                    await supabase.storage.from('chat-uploads').upload(path, file)
                    const { data } = supabase.storage.from('chat-uploads').getPublicUrl(path)
                    
                    await supabase.from('messages').insert({
                        conversation_id: currentConvId,
                        sender_id: profile.id,
                        content: data.publicUrl,
                        type: type === 'audio' ? 'voice' : 'video'
                    })
                } catch (e) {
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
        } catch (e) {
            toast.error('Microphone/Camera access denied')
        }
    }

    const stopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop()
            setIsRecording(null)
            clearInterval(timerRef.current)
        }
    }

    // Voice/Video Call Handlers via Global Context
    const getCallTargets = () => {
        return members.map(m => m.user_id).filter(uid => uid !== profile.id)
    }

    const handleVoiceCall = () => {
        const targets = getCallTargets()
        if (targets.length > 0) {
            startCall(targets, 'audio')
        } else {
            toast.error('No other participants to call')
        }
    }

    const handleVideoCall = () => {
        const targets = getCallTargets()
        if (targets.length > 0) {
            startCall(targets, 'video')
        } else {
            toast.error('No other participants to call')
        }
    }

    const handleAddMember = async (staff: StaffProfile) => {
        if (!profile?.id || !currentConvId) return
        try {
            if (isGroup) {
                // Add to existing group conversation
                const { error } = await supabase.from('conversation_members').insert({
                    conversation_id: currentConvId,
                    user_id: staff.id
                })
                if (error) throw error
                
                // Refresh members locally
                setMembers(prev => [...prev, { user_id: staff.id, staff_profiles: staff }])
                toast.success(`${staff.full_name} added!`)
            } else {
                // Direct message: convert to group chat
                const groupName = `Group Chat`
                const { data: convData, error: convError } = await supabase.from('conversations').insert({
                    name: groupName,
                    is_group: true,
                    created_by: profile.id
                }).select().single()
                if (convError) throw convError

                // Original members + new member
                const originalOtherMember = members.find(m => m.user_id !== profile.id)
                const newMembers = [
                    { conversation_id: convData.id, user_id: profile.id, is_admin: true },
                    { conversation_id: convData.id, user_id: staff.id }
                ]
                if (originalOtherMember) {
                    newMembers.push({ conversation_id: convData.id, user_id: originalOtherMember.user_id })
                } else if (targetUser) {
                    newMembers.push({ conversation_id: convData.id, user_id: targetUser.id })
                }

                const { error: membersError } = await supabase.from('conversation_members').insert(newMembers)
                if (membersError) throw membersError

                setTargetUser(null)
                setCurrentConvId(convData.id)
                toast.success('Converted to Group Chat!')
            }
            setShowAddPeople(false)
        } catch (e) {
            console.error(e)
            toast.error('Failed to add teammate')
        }
    }

    // Filter addable staff members
    const currentMemberIds = members.map(m => m.user_id)
    const addableStaff = allStaff.filter(s => s.id !== profile?.id && !currentMemberIds.includes(s.id))

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ 
                opacity: 1, 
                scale: 1, 
                y: 0,
                height: isMinimized ? 48 : 520,
                width: 380
            }}
            drag
            dragMomentum={false}
            style={{ zIndex }}
            className="fixed bottom-4 right-4 bg-[var(--glass)] rounded-2xl shadow-[var(--shadow-lift)] border border-[var(--hairline)] overflow-hidden flex flex-col"
        >
            {/* FETSCHAT BANNER */}
            <div className="bg-[var(--accent)] text-[var(--accent-ink)] px-4 py-3 flex items-center justify-between border-b border-[var(--hairline)] cursor-move">
                <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 border border-[var(--hairline)]" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 border border-[var(--hairline)]" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500 border border-[var(--hairline)]" />
                    </div>
                    <span className="font-black text-xs uppercase tracking-[0.2em] italic">FETSCHAT // <span className="opacity-60">{currentName}</span></span>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setShowAddPeople(v => !v)} 
                        className="text-[var(--accent-ink)] hover:scale-110 transition-transform p-1.5 hover:bg-[var(--accent-ink)]/10 rounded-lg" 
                        title="Add Teammates"
                    >
                        <UserPlus size={16} />
                    </button>
                    <button 
                        onClick={handleVoiceCall} 
                        className="text-[var(--accent-ink)] hover:scale-110 transition-transform p-1.5 hover:bg-[var(--accent-ink)]/10 rounded-lg" 
                        title="Voice Call"
                    >
                        <Phone size={16} />
                    </button>
                    <button 
                        onClick={handleVideoCall} 
                        className="text-[var(--accent-ink)] hover:scale-110 transition-transform p-1.5 hover:bg-[var(--accent-ink)]/10 rounded-lg" 
                        title="Video Call"
                    >
                        <Video size={16} />
                    </button>
                    <div className="w-px h-4 bg-[var(--accent-ink)]/20 mx-1" />
                    <button onClick={() => setIsMinimized(!isMinimized)} className="text-[var(--accent-ink)] hover:bg-[var(--accent-ink)]/10 p-1 rounded transition-colors">
                        <Minus size={16} />
                    </button>
                    <button onClick={onClose} className="text-[var(--accent-ink)] hover:bg-[var(--accent-ink)]/10 p-1 rounded transition-colors">
                        <X size={16} />
                    </button>
                </div>
            </div>

            {!isMinimized && (
                <>
                    {/* Add People Modal/Overlay */}
                    {showAddPeople && (
                        <div className="absolute top-12 left-0 right-0 bg-[var(--glass)] border-b border-[var(--hairline)] p-3 z-30 flex flex-col gap-2 max-h-60 overflow-y-auto">
                            <div className="flex justify-between items-center pb-2 border-b border-[var(--hairline)]">
                                <span className="text-xs font-black uppercase text-[var(--ink-2)]">Add people to chat</span>
                                <button onClick={() => setShowAddPeople(false)} className="text-[var(--ink-4)] hover:text-[var(--ink)]">×</button>
                            </div>
                            {addableStaff.length === 0 ? (
                                <span className="text-[10px] text-[var(--ink-4)] text-center py-2">No other staff available to add</span>
                            ) : (
                                <div className="flex flex-col gap-1">
                                    {addableStaff.map(staff => (
                                        <button 
                                            key={staff.id} 
                                            onClick={() => handleAddMember(staff)}
                                            className="flex items-center gap-2 p-1.5 hover:bg-[var(--glass-2)] rounded-lg text-left text-xs font-bold text-[var(--ink)]"
                                        >
                                            <img 
                                                src={staff.avatar_url || `https://ui-avatars.com/api/?name=${staff.full_name}&background=random`} 
                                                className="w-5 h-5 rounded-full" 
                                                alt="" 
                                            />
                                            <span>{staff.full_name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* CHAT AREA */}
                    <div 
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
                        style={{ background: 'transparent' }}
                        onClick={() => setContextMenuMsgId(null)}
                    >
                        {isLoading ? (
                            <div className="text-center text-xs text-[var(--ink-4)] py-10 uppercase tracking-widest animate-pulse">Decrypting Feed...</div>
                        ) : messages.length === 0 ? (
                            <div className="text-center text-xs text-[var(--ink-4)] py-10 italic">No messages yet. Start the conversation securely!</div>
                        ) : (
                            messages.map((msg, idx) => {
                                const isMe = msg.sender_id === profile.id
                                const isDeleted = msg.status === 'deleted_for_all'
                                
                                return (
                                    <div key={msg.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                                        <div className={`
                                            max-w-[85%] p-3 rounded-2xl border border-[var(--hairline)] relative
                                            ${isMe 
                                                ? 'bg-[var(--accent)] text-[var(--accent-ink)] rounded-br-none' 
                                                : 'bg-[var(--glass-2)] text-[var(--ink)] rounded-bl-none'}
                                            ${isDeleted ? 'opacity-50 italic' : ''}
                                        `}>
                                            {/* Sender Name for Group Chats */}
                                            {isGroup && !isMe && !isDeleted && (
                                                <div className="text-[10px] font-black uppercase text-[var(--accent)] mb-1">
                                                    {members.find(m => m.user_id === msg.sender_id)?.staff_profiles?.full_name || 'Staff'}
                                                </div>
                                            )}

                                            {/* Context Menu for Own Messages */}
                                            {isMe && !isDeleted && (
                                                <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                                    <button 
                                                        onClick={() => { setEditingMsgId(msg.id); setEditContent(msg.content); }}
                                                        className="p-1 bg-[var(--glass)] border border-[var(--hairline)] rounded-full hover:bg-[var(--accent-soft)] transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit3 size={10} />
                                                    </button>
                                                    <button 
                                                        onClick={() => setContextMenuMsgId(msg.id === contextMenuMsgId ? null : msg.id)}
                                                        className="p-1 bg-[var(--glass)] border border-[var(--hairline)] rounded-full hover:bg-[var(--bad)]/10 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={10} />
                                                    </button>
                                                </div>
                                            )}
                                            
                                            {/* Delete Options Dropdown */}
                                            {contextMenuMsgId === msg.id && (
                                                <div 
                                                    className="absolute top-full right-0 mt-1 bg-[var(--glass)] border border-[var(--hairline)] rounded-xl shadow-[var(--shadow-lift)] z-20 overflow-hidden"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg.id, false); }} 
                                                        className="w-full px-4 py-2 text-[9px] font-black uppercase text-left hover:bg-[var(--glass-2)] transition-colors text-[var(--ink)]"
                                                    >
                                                        Delete for me
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg.id, true); }} 
                                                        className="w-full px-4 py-2 text-[9px] font-black uppercase text-left hover:bg-[var(--bad)]/10 text-[var(--bad)] transition-colors border-t border-[var(--hairline)]"
                                                    >
                                                        Delete for everyone
                                                    </button>
                                                </div>
                                            )}

                                            {/* Edit Mode */}
                                            {editingMsgId === msg.id ? (
                                                <div className="flex flex-col gap-2">
                                                    <input 
                                                        type="text" 
                                                        value={editContent}
                                                        onChange={e => setEditContent(e.target.value)}
                                                        className="w-full bg-[var(--glass)] border border-[var(--hairline)] rounded-lg px-2 py-1 text-sm font-bold outline-none text-[var(--ink)]"
                                                        autoFocus
                                                    />
                                                    <div className="flex gap-2 justify-end">
                                                        <button onClick={() => setEditingMsgId(null)} className="text-[9px] font-black uppercase text-[var(--ink-4)] hover:text-[var(--ink)]">Cancel</button>
                                                        <button onClick={() => handleEditMessage(msg.id)} className="text-[9px] font-black uppercase text-[var(--accent)] hover:text-[var(--accent-ink)]">Save</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    {msg.type === 'text' && (
                                                        <p className={`text-sm font-bold leading-snug ${isMe ? 'text-[var(--accent-ink)]' : 'text-[var(--ink)]'}`}>{msg.content}</p>
                                                    )}
                                                    {msg.type === 'image' && (
                                                        <img src={msg.content} alt="Attachment" className="rounded-lg max-w-full border border-[var(--hairline)]" />
                                                    )}
                                                    {msg.type === 'video' && (
                                                        <video src={msg.content} controls className="rounded-lg max-w-full" />
                                                    )}
                                                    {msg.type === 'voice' && (
                                                        <audio src={msg.content} controls className="w-full h-8" />
                                                    )}
                                                    {msg.type === 'file' && (
                                                        <a href={msg.content} target="_blank" rel="noreferrer" className={`flex items-center gap-2 text-xs font-bold underline ${isMe ? 'text-[var(--accent-ink)]' : 'text-[var(--ink)]'}`}><FileText size={14} /> {msg.file_path || 'Document'}</a>
                                                    )}
                                                </>
                                            )}
                                            
                                            <div className={`flex items-center justify-end gap-1 mt-1 opacity-40 ${isMe ? 'text-[var(--accent-ink)]' : 'text-[var(--ink)]'}`}>
                                                <span className="text-[9px] font-bold">{format(new Date(msg.created_at), 'HH:mm')}</span>
                                                {isMe && (msg.status === 'seen' ? <CheckCheck size={10} /> : <Check size={10} />)}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>

                    {/* INPUT AREA */}
                    <div className="p-3 border-t border-[var(--hairline)] bg-[var(--glass-2)]">
                        {isRecording ? (
                            <div className="flex items-center justify-between p-3 rounded-xl animate-pulse" style={{ background: 'color-mix(in oklch, var(--bad) 15%, transparent)', border: '1px solid var(--bad)' }}>
                                <div className="flex items-center gap-3 text-[var(--bad)] font-black text-xs uppercase">
                                    <div className="w-2 h-2 rounded-full bg-[var(--bad)] animate-ping" />
                                    Recording {isRecording}... {recordingTime}s
                                </div>
                                <button onClick={stopRecording} className="bg-[var(--bad)] text-white p-2 rounded-lg hover:opacity-90 transition-colors"><Square size={16} /></button>
                            </div>
                        ) : (
                            <form onSubmit={handleSendMessage} className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="text" 
                                        value={newMessage}
                                        onChange={e => setNewMessage(e.target.value)}
                                        placeholder="Type a secure message..."
                                        className="flex-1 bg-[var(--inset)] border border-[var(--hairline)] rounded-xl px-4 py-2 text-sm font-bold outline-none focus:bg-[var(--glass)] transition-all text-[var(--ink)] placeholder-[var(--ink-4)]"
                                    />
                                    <button 
                                        type="submit"
                                        disabled={!newMessage.trim()}
                                        className="bg-[var(--accent)] text-[var(--accent-ink)] p-2.5 rounded-xl border border-[var(--hairline)] hover:opacity-90 disabled:opacity-30 transition-all"
                                    >
                                        <Send size={18} fill="currentColor" />
                                    </button>
                                </div>
                                <div className="flex items-center justify-between px-1">
                                    <div className="flex items-center gap-1">
                                        <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-[var(--ink-4)] hover:text-[var(--ink)] hover:bg-[var(--glass-2)] rounded-lg transition-all" title="Attach Files"><Paperclip size={18} /></button>
                                        <button type="button" onClick={() => startRecording('audio')} className="p-2 text-[var(--ink-4)] hover:text-[var(--ink)] hover:bg-[var(--glass-2)] rounded-lg transition-all" title="Voice Message"><Mic size={18} /></button>
                                        <button type="button" onClick={() => startRecording('video')} className="p-2 text-[var(--ink-4)] hover:text-[var(--ink)] hover:bg-[var(--glass-2)] rounded-lg transition-all" title="Video Message"><Video size={18} /></button>
                                    </div>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        className="hidden" 
                                        onChange={handleFileUpload}
                                    />
                                    {isUploading && <div className="text-[10px] font-black text-[var(--accent)] animate-pulse uppercase tracking-widest">Encrypting...</div>}
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
