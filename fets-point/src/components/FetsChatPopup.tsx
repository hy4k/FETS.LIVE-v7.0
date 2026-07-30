import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Send, Mic, Paperclip, X, Minus, Edit3, Trash2,
    Phone, Video, FileText, Square, UserPlus, Check, CheckCheck, Loader2, MoreVertical,
    Smile, Circle
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useGlobalCall } from '../contexts/CallContext'
import { usePresence } from '../hooks/useChat'
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
    targetUser?: StaffProfile | any | null
    conversationId?: string | null
    onClose: () => void
    zIndex?: number
}

const COMMON_EMOJIS = ['👍', '❤️', '🔥', '👏', '😊', '🚀', '🎉', '💯']

export const FetsChatPopup: React.FC<FetsChatPopupProps> = ({
    targetUser: initialTargetUser,
    conversationId,
    onClose,
    zIndex = 2000
}) => {
    const { profile: authProfile } = useAuth()
    const { startCall } = useGlobalCall()

    // Resolved active profile state
    const [activeProfile, setActiveProfile] = useState<any>(authProfile)

    const [messages, setMessages] = useState<Message[]>([])
    const [newMessage, setNewMessage] = useState('')
    const [isMinimized, setIsMinimized] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isUploading, setIsUploading] = useState(false)

    // Conversation state
    const [currentConvId, setCurrentConvId] = useState<string | null>(conversationId || null)
    const [targetUser, setTargetUser] = useState<StaffProfile | any | null>(initialTargetUser || null)
    const [isGroup, setIsGroup] = useState(false)
    const [currentName, setCurrentName] = useState('Chat')
    const [members, setMembers] = useState<ConvMember[]>([])

    // Add People Panel
    const [allStaff, setAllStaff] = useState<StaffProfile[]>([])
    const [showAddPeople, setShowAddPeople] = useState(false)

    // Emoji Picker Quick Drawer
    const [showEmojiPicker, setShowEmojiPicker] = useState(false)

    // Recording State
    const [isRecording, setIsRecording] = useState<'audio' | 'video' | null>(null)
    const [recordingTime, setRecordingTime] = useState(0)
    const [recordedBlob, setRecordedBlob] = useState<{ blob: Blob; type: 'audio' | 'video'; url: string } | null>(null)

    // Options Menu
    const [showMenu, setShowMenu] = useState(false)

    // Edit State
    const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
    const [editContent, setEditContent] = useState('')

    // Context Menu for message deletion
    const [contextMenuMsgId, setContextMenuMsgId] = useState<string | null>(null)

    // Typing State
    const [isPeerTyping, setIsPeerTyping] = useState(false)
    const typingTimeoutRef = useRef<any>(null)

    const scrollRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const timerRef = useRef<any>(null)
    const channelRef = useRef<any>(null)

    // Real-time Online Presence
    const onlineUserIds = usePresence(currentConvId, activeProfile?.id)
    const otherMemberId = targetUser?.id || targetUser?.user_id || members.find(m => m.user_id !== activeProfile?.id)?.user_id
    const isTargetOnline = otherMemberId ? onlineUserIds.includes(otherMemberId) : false

    // Profile Resolution Fallback
    useEffect(() => {
        if (authProfile?.id) {
            setActiveProfile(authProfile)
            return
        }

        let isMounted = true
        const resolveProfile = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (user?.id && isMounted) {
                    const { data: sp } = await supabase.from('staff_profiles').select('*').eq('user_id', user.id).maybeSingle()
                    if (sp) { setActiveProfile(sp); return; }
                    const { data: spId } = await supabase.from('staff_profiles').select('*').eq('id', user.id).maybeSingle()
                    if (spId) { setActiveProfile(spId); return; }
                }
            } catch {}

            const fallbackName = (window as any).FETS?.user?.name || 'Duty Staff'
            const fallbackId = (window as any).FETS?._meUserId || (window as any).FETS?._meId || '00000000-0000-0000-0000-000000000001'

            if (isMounted) {
                setActiveProfile({
                    id: fallbackId,
                    full_name: fallbackName,
                    role: 'Staff Member'
                })
            }
        }
        resolveProfile()
        return () => { isMounted = false }
    }, [authProfile])

    // Load staff list for inviting
    useEffect(() => {
        supabase.from('staff_profiles')
            .select('*')
            .order('full_name', { ascending: true })
            .then(({ data }) => { if (data) setAllStaff(data) })
    }, [])

    // Initialize Conversation & Messages
    useEffect(() => {
        if (!activeProfile?.id) return

        if (channelRef.current) {
            supabase.removeChannel(channelRef.current)
            channelRef.current = null
        }

        const initChat = async () => {
            setIsLoading(true)
            try {
                let id = currentConvId
                const targetUserId = targetUser?.id || targetUser?.user_id

                if (!id && targetUser && targetUserId) {
                    try {
                        const { data: convId, error } = await supabase.rpc('get_or_create_conversation', {
                            user_id_1: activeProfile.id,
                            user_id_2: targetUserId
                        })
                        if (!error && convId) id = convId
                    } catch {}

                    if (!id) {
                        const { data: newConv } = await supabase.from('conversations').insert({
                            name: `Direct: ${targetUser.full_name || 'Staff'}`,
                            is_group: false
                        }).select('id').single()

                        if (newConv) {
                            id = newConv.id
                            await supabase.from('conversation_members').insert([
                                { conversation_id: id, user_id: activeProfile.id },
                                { conversation_id: id, user_id: targetUserId }
                            ]).catch(() => {})
                        }
                    }
                    if (id) setCurrentConvId(id)
                }

                if (!id) {
                    setIsLoading(false)
                    return
                }

                // Load Info
                const { data: convInfo, error: convErr } = await supabase.rpc('get_conversation_info', {
                    p_conversation_id: id
                })

                if (!convErr && convInfo && convInfo.length > 0) {
                    const conv = convInfo[0]
                    setIsGroup(conv.is_group)
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
                        setCurrentName(targetUser.full_name || 'Direct Chat')
                    } else {
                        const other = memberList.find(m => m.user_id !== activeProfile.id)
                        setCurrentName(other?.staff_profiles?.full_name || 'Direct Chat')
                    }
                } else {
                    const { data: rawMembers } = await supabase
                        .from('conversation_members')
                        .select('user_id, staff_profiles(id, full_name, avatar_url, role)')
                        .eq('conversation_id', id)
                    
                    if (rawMembers) {
                        setMembers(rawMembers as ConvMember[])
                        if (targetUser) {
                            setCurrentName(targetUser.full_name || 'Direct Chat')
                        } else {
                            const other = rawMembers.find((m: any) => m.user_id !== activeProfile.id)
                            setCurrentName((other as any)?.staff_profiles?.full_name || 'Direct Chat')
                        }
                    }
                }

                // Fetch Initial Messages
                const { data: msgs, error: msgsErr } = await supabase.rpc('get_conversation_messages', {
                    p_conversation_id: id,
                    p_limit: 200
                })

                if (!msgsErr && msgs) {
                    setMessages(msgs as Message[])
                } else {
                    const { data: directMsgs } = await supabase
                        .from('messages')
                        .select('*')
                        .eq('conversation_id', id)
                        .or('is_deleted.eq.false,is_deleted.is.null')
                        .order('created_at', { ascending: true })
                    setMessages(directMsgs || [])
                }

                // Subscriptions for Realtime Sync
                const channel = supabase.channel(`realtime_chat_${id}`)
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
                            setIsPeerTyping(false)
                        } else if (payload.eventType === 'UPDATE') {
                            setMessages(prev => prev.map(m =>
                                m.id === payload.new.id ? { ...m, ...payload.new } : m
                            ))
                        } else if (payload.eventType === 'DELETE') {
                            setMessages(prev => prev.filter(m => m.id !== payload.old.id))
                        }
                    })
                    .on('broadcast', { event: 'typing' }, payload => {
                        if (payload.user_id !== activeProfile.id) {
                            setIsPeerTyping(true)
                            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
                            typingTimeoutRef.current = setTimeout(() => setIsPeerTyping(false), 3500)
                        }
                    })
                    .subscribe()

                channelRef.current = channel

            } catch (e) {
                console.error('Chat init error:', e)
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
    }, [currentConvId, targetUser?.id, activeProfile?.id])

    // Auto-scroll on new message
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages, isPeerTyping, isMinimized])

    // Broadcast typing indicator
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewMessage(e.target.value)
        if (channelRef.current && activeProfile?.id) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'typing',
                payload: { user_id: activeProfile.id }
            }).catch(() => {})
        }
    }

    // Send Text Message
    const handleSendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        if (!newMessage.trim() || !currentConvId || !activeProfile?.id) return

        const text = newMessage.trim()
        setNewMessage('')
        setShowEmojiPicker(false)

        const tempId = 'temp_' + Date.now()
        const optMsg: Message = {
            id: tempId,
            conversation_id: currentConvId,
            sender_id: activeProfile.id,
            content: text,
            type: 'text',
            created_at: new Date().toISOString(),
            status: 'sent'
        }
        setMessages(prev => [...prev, optMsg])

        try {
            const { error: rpcErr } = await supabase.rpc('send_chat_message', {
                p_conversation_id: currentConvId,
                p_sender_id: activeProfile.id,
                p_content: text,
                p_type: 'text'
            })

            if (rpcErr) {
                await supabase.from('messages').insert({
                    conversation_id: currentConvId,
                    sender_id: activeProfile.id,
                    content: text,
                    type: 'text',
                    status: 'sent'
                })
            }
        } catch {
            await supabase.from('messages').insert({
                conversation_id: currentConvId,
                sender_id: activeProfile.id,
                content: text,
                type: 'text',
                status: 'sent'
            }).catch(() => {})
        }
    }

    // Edit Message
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
            setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: editContent.trim(), is_edited: true } : m))
            setEditingMsgId(null)
            setEditContent('')
            toast.success('Message updated')
        } catch {
            toast.error('Failed to edit message')
        }
    }

    // Delete Message
    const handleDeleteMessage = async (msgId: string, forAll = false) => {
        try {
            const { error: rpcErr } = await supabase.rpc('delete_chat_message', {
                p_message_id: msgId,
                p_for_everyone: forAll
            })

            if (rpcErr) {
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

    // Upload Files
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !currentConvId || !activeProfile?.id) return

        setIsUploading(true)
        try {
            let fileUrl = ''
            const path = `chat/${currentConvId}/${Date.now()}_${file.name}`
            const { error: upErr } = await supabase.storage.from('chat-uploads').upload(path, file)
            
            if (!upErr) {
                const { data } = supabase.storage.from('chat-uploads').getPublicUrl(path)
                fileUrl = data.publicUrl
            } else {
                fileUrl = await new Promise<string>((resolve) => {
                    const reader = new FileReader()
                    reader.onloadend = () => resolve(reader.result as string)
                    reader.readAsDataURL(file)
                })
            }

            let msgType: Message['type'] = 'file'
            if (file.type.startsWith('image/')) msgType = 'image'
            else if (file.type.startsWith('video/')) msgType = 'video'
            else if (file.type.startsWith('audio/')) msgType = 'voice'

            await supabase.from('messages').insert({
                conversation_id: currentConvId,
                sender_id: activeProfile.id,
                content: fileUrl,
                type: msgType,
                file_path: file.name
            })
            toast.success('Attachment sent!')
        } catch {
            toast.error('Upload failed')
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    // Voice & Video Recording
    const startRecording = async (type: 'audio' | 'video') => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia(
                type === 'audio' ? { audio: true } : { video: true, audio: true }
            )
            const recorder = new MediaRecorder(stream)
            mediaRecorderRef.current = recorder
            chunksRef.current = []

            recorder.ondataavailable = e => chunksRef.current.push(e.data)
            recorder.onstop = () => {
                const mime = type === 'audio' ? 'audio/webm' : 'video/webm'
                const blob = new Blob(chunksRef.current, { type: mime })
                const url = URL.createObjectURL(blob)
                setRecordedBlob({ blob, type, url })
                stream.getTracks().forEach(t => t.stop())
            }

            recorder.start()
            setIsRecording(type)
            setRecordingTime(0)
            if (timerRef.current) clearInterval(timerRef.current)
            timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000)
        } catch {
            toast.error('Microphone/Camera access denied or unavailable')
        }
    }

    const stopRecording = () => {
        mediaRecorderRef.current?.stop()
        setIsRecording(null)
        if (timerRef.current) clearInterval(timerRef.current)
    }

    const sendRecordedBlob = async () => {
        if (!recordedBlob || !currentConvId || !activeProfile?.id) return
        const { blob, type } = recordedBlob
        const ext = 'webm'
        const file = new File([blob], `rec_${Date.now()}.${ext}`, { type: blob.type })
        setIsUploading(true)
        setRecordedBlob(null)

        try {
            let mediaUrl = ''
            const path = `chat/${currentConvId}/rec_${Date.now()}.${ext}`
            const { error: upErr } = await supabase.storage.from('chat-uploads').upload(path, file)
            if (!upErr) {
                const { data } = supabase.storage.from('chat-uploads').getPublicUrl(path)
                mediaUrl = data.publicUrl
            } else {
                mediaUrl = await new Promise<string>((resolve) => {
                    const reader = new FileReader()
                    reader.onloadend = () => resolve(reader.result as string)
                    reader.readAsDataURL(file)
                })
            }

            const msgType = type === 'audio' ? 'voice' : 'video'
            await supabase.from('messages').insert({
                conversation_id: currentConvId,
                sender_id: activeProfile.id,
                content: mediaUrl,
                type: msgType
            })
            toast.success(type === 'audio' ? 'Voice note sent!' : 'Video message sent!')
        } catch {
            toast.error('Failed to send recording')
        } finally {
            setIsUploading(false)
        }
    }

    const cancelRecordedBlob = () => {
        if (recordedBlob) {
            URL.revokeObjectURL(recordedBlob.url)
            setRecordedBlob(null)
        }
    }

    const handleVoiceCall = () => {
        const targets = members.map(m => m.user_id).filter(uid => uid !== activeProfile?.id)
        if (targets.length > 0) startCall(targets, 'audio')
        else if (targetUser?.id) startCall([targetUser.id], 'audio')
        else toast.error('No other participants to call')
    }

    const handleVideoCall = () => {
        const targets = members.map(m => m.user_id).filter(uid => uid !== activeProfile?.id)
        if (targets.length > 0) startCall(targets, 'video')
        else if (targetUser?.id) startCall([targetUser.id], 'video')
        else toast.error('No other participants to call')
    }

    const handleAddMember = async (staff: StaffProfile) => {
        if (!activeProfile?.id || !currentConvId) return
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
                const otherMember = members.find(m => m.user_id !== activeProfile.id)
                const allIds = [
                    activeProfile.id,
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
        } catch {
            toast.error('Failed to add teammate')
        }
    }

    const currentMemberIds = members.map(m => m.user_id)
    const addableStaff = allStaff.filter(s => s.id !== activeProfile?.id && !currentMemberIds.includes(s.id))

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ 
                opacity: 1, 
                scale: 1, 
                y: 0, 
                height: isMinimized ? 56 : "min(560px, 86vh)", 
                width: "min(420px, calc(100vw - 24px))" 
            }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            style={{ zIndex }}
            className="fixed bottom-3 right-3 sm:bottom-5 sm:right-5 bg-slate-950/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col max-w-[calc(100vw-24px)] text-white"
        >
            {/* TOP BAR */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-3.5 sm:px-4 py-3 flex items-center justify-between border-b border-white/10 select-none gap-2 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {/* User / Group Avatar + Presence */}
                    <div className="relative shrink-0">
                        <div className="w-8 h-8 rounded-full bg-indigo-600/40 border border-indigo-400/30 flex items-center justify-center font-bold text-xs uppercase overflow-hidden">
                            {targetUser?.avatar_url ? (
                                <img src={targetUser.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                                currentName.charAt(0)
                            )}
                        </div>
                        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${isTargetOnline ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-slate-500'}`} />
                    </div>

                    <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-bold text-xs tracking-tight text-slate-100 truncate">
                                {currentName}
                            </span>
                            {isGroup && (
                                <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 rounded-md shrink-0">
                                    {members.length} members
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                            <Circle size={6} className={`fill-current ${isTargetOnline ? 'text-emerald-400' : 'text-slate-500'}`} />
                            <span>{isTargetOnline ? 'Active Online' : 'Offline'}</span>
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setShowAddPeople(v => !v)} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors" title="Add Teammate">
                        <UserPlus size={15} />
                    </button>
                    <button onClick={handleVoiceCall} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-emerald-400 transition-colors" title="Voice Call">
                        <Phone size={15} />
                    </button>
                    <button onClick={handleVideoCall} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-indigo-400 transition-colors" title="Video Call">
                        <Video size={15} />
                    </button>
                    <button onClick={() => setShowMenu(v => !v)} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors" title="Menu">
                        <MoreVertical size={15} />
                    </button>
                    <div className="w-px h-4 bg-white/15 mx-0.5" />
                    <button onClick={() => setIsMinimized(!isMinimized)} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors" title="Minimize">
                        <Minus size={15} />
                    </button>
                    <button onClick={onClose} className="p-1.5 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white rounded-lg border border-red-500/30 transition-all ml-0.5 shrink-0" title="Close">
                        <X size={15} strokeWidth={2.5} />
                    </button>
                </div>
            </div>

            {/* OPTIONS DROPDOWN */}
            {showMenu && (
                <div className="absolute top-14 right-4 bg-slate-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden min-w-[160px]" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setShowAddPeople(true); setShowMenu(false); }} className="w-full px-4 py-2.5 text-xs font-semibold text-left hover:bg-white/5 text-slate-200 flex items-center gap-2">
                        <UserPlus size={13} /> Add Teammate
                    </button>
                    <button onClick={() => { setMessages([]); setShowMenu(false); toast.success('Cleared local view'); }} className="w-full px-4 py-2.5 text-xs font-semibold text-left hover:bg-white/5 text-slate-200 border-t border-white/5 flex items-center gap-2">
                        <Trash2 size={13} /> Clear View
                    </button>
                </div>
            )}

            {!isMinimized && (
                <>
                    {/* ADD TEAMMATE DRAWER */}
                    {showAddPeople && (
                        <div className="absolute top-14 left-0 right-0 bg-slate-900/95 border-b border-white/10 p-3 z-30 max-h-56 overflow-y-auto backdrop-blur-md">
                            <div className="flex justify-between items-center pb-2 border-b border-white/10 mb-2">
                                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Add to Chat</span>
                                <button onClick={() => setShowAddPeople(false)} className="text-slate-400 hover:text-white text-base">✕</button>
                            </div>
                            {addableStaff.length === 0 ? (
                                <p className="text-xs text-slate-400 text-center py-4 italic">No other teammates available</p>
                            ) : (
                                <div className="flex flex-col gap-1">
                                    {addableStaff.map(staff => (
                                        <button key={staff.id} onClick={() => handleAddMember(staff)}
                                            className="flex items-center gap-2.5 p-2 hover:bg-white/5 rounded-lg text-left text-xs font-medium text-slate-200 w-full transition-colors">
                                            <div className="w-6 h-6 rounded-full bg-indigo-500/30 flex items-center justify-center font-bold text-[10px]">
                                                {staff.full_name.charAt(0)}
                                            </div>
                                            <span className="truncate">{staff.full_name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* MESSAGES CHAT FEED */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-950/40" onClick={() => { setContextMenuMsgId(null); setShowEmojiPicker(false); }}>
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
                                <Loader2 size={22} className="animate-spin text-indigo-400" />
                                <span className="text-xs font-medium">Syncing conversation...</span>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-500 text-center px-4">
                                <p className="text-xs font-medium">No messages yet. Send a message to get started!</p>
                            </div>
                        ) : (
                            messages.map((msg, idx) => {
                                const isMe = msg.sender_id === activeProfile?.id
                                const isDeleted = msg.status === 'deleted_for_all' || msg.is_deleted
                                const senderMember = members.find(m => m.user_id === msg.sender_id)
                                const senderName = senderMember?.staff_profiles?.full_name || 'Teammate'

                                return (
                                    <div key={msg.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                                        <div className={`max-w-[85%] p-3 rounded-2xl relative shadow-md transition-all border
                                            ${isMe 
                                                ? 'bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-800 text-white border-indigo-500/30 rounded-br-xs' 
                                                : 'bg-slate-900/90 text-slate-100 border-white/10 rounded-bl-xs'}
                                            ${isDeleted ? 'opacity-50 italic' : ''}`}>

                                            {/* Group Sender Label */}
                                            {isGroup && !isMe && !isDeleted && (
                                                <div className="text-[10px] font-bold text-indigo-400 mb-1">
                                                    {senderName}
                                                </div>
                                            )}

                                            {/* Action Hover Buttons for Sender */}
                                            {isMe && !isDeleted && (
                                                <div className="absolute -top-2.5 -right-2 hidden group-hover:flex items-center gap-1 bg-slate-900 border border-white/15 rounded-full px-1.5 py-0.5 shadow-lg z-10">
                                                    <button onClick={() => { setEditingMsgId(msg.id); setEditContent(msg.content) }} className="p-1 hover:text-indigo-400 text-slate-300" title="Edit">
                                                        <Edit3 size={11} />
                                                    </button>
                                                    <button onClick={() => setContextMenuMsgId(msg.id === contextMenuMsgId ? null : msg.id)} className="p-1 hover:text-red-400 text-slate-300" title="Delete">
                                                        <Trash2 size={11} />
                                                    </button>
                                                </div>
                                            )}

                                            {/* Delete Menu */}
                                            {contextMenuMsgId === msg.id && (
                                                <div className="absolute top-full right-0 mt-1 bg-slate-900 border border-white/15 rounded-xl shadow-2xl z-30 overflow-hidden min-w-[150px]" onClick={e => e.stopPropagation()}>
                                                    <button onClick={e => { e.stopPropagation(); handleDeleteMessage(msg.id, false) }} className="w-full px-3 py-2 text-[11px] font-medium text-left hover:bg-white/5 text-slate-200">
                                                        Delete for me
                                                    </button>
                                                    <button onClick={e => { e.stopPropagation(); handleDeleteMessage(msg.id, true) }} className="w-full px-3 py-2 text-[11px] font-medium text-left hover:bg-red-500/20 text-red-400 border-t border-white/5">
                                                        Delete for everyone
                                                    </button>
                                                </div>
                                            )}

                                            {/* Inline Editing */}
                                            {editingMsgId === msg.id ? (
                                                <div className="flex flex-col gap-2 min-w-[200px]">
                                                    <input 
                                                        type="text" 
                                                        value={editContent} 
                                                        onChange={e => setEditContent(e.target.value)} 
                                                        className="w-full bg-slate-950/80 border border-white/20 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-indigo-400"
                                                        autoFocus 
                                                    />
                                                    <div className="flex justify-end gap-2 text-[10px]">
                                                        <button onClick={() => setEditingMsgId(null)} className="text-slate-400 hover:text-white">Cancel</button>
                                                        <button onClick={() => handleEditMessage(msg.id)} className="text-indigo-300 font-bold hover:text-white">Save</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    {msg.type === 'text' && <p className="text-xs sm:text-sm font-normal leading-relaxed break-words">{msg.content}</p>}
                                                    {msg.type === 'image' && (
                                                        <img src={msg.content} alt="Attachment" className="rounded-xl max-w-full max-h-60 object-cover border border-white/10 my-1" />
                                                    )}
                                                    {msg.type === 'video' && (
                                                        <video src={msg.content} controls className="rounded-xl max-w-full max-h-60 border border-white/10 my-1" />
                                                    )}
                                                    {msg.type === 'voice' && (
                                                        <div className="my-1">
                                                            <audio src={msg.content} controls className="w-full h-8 max-w-[240px]" />
                                                        </div>
                                                    )}
                                                    {msg.type === 'file' && (
                                                        <a href={msg.content} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs font-semibold underline text-indigo-200 hover:text-white my-1">
                                                            <FileText size={15} /> {msg.file_path || 'Document Attachment'}
                                                        </a>
                                                    )}
                                                    {msg.is_edited && <span className="text-[9px] opacity-60 ml-1">(edited)</span>}
                                                </>
                                            )}

                                            {/* Timestamp & Read Status */}
                                            <div className="flex items-center justify-end gap-1 mt-1 opacity-60 text-[9px] font-medium">
                                                <span>{format(new Date(msg.created_at), 'HH:mm')}</span>
                                                {isMe && (msg.status === 'seen' ? <CheckCheck size={11} className="text-emerald-300" /> : <Check size={11} />)}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}

                        {/* Peer Typing Indicator */}
                        {isPeerTyping && (
                            <div className="flex items-center gap-2 text-xs text-indigo-300 font-medium py-1 px-2 italic animate-pulse">
                                <div className="flex gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                                <span>Teammate is typing...</span>
                            </div>
                        )}
                    </div>

                    {/* INPUT & CONTROLS */}
                    <div className="p-3 border-t border-white/10 bg-slate-900/90 relative shrink-0">
                        {/* Quick Emoji Picker */}
                        <AnimatePresence>
                            {showEmojiPicker && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="absolute bottom-full left-3 mb-2 p-2 bg-slate-900 border border-white/15 rounded-xl shadow-2xl flex gap-1 z-30"
                                >
                                    {COMMON_EMOJIS.map(emoji => (
                                        <button 
                                            key={emoji} 
                                            type="button" 
                                            onClick={() => { setNewMessage(prev => prev + emoji); setShowEmojiPicker(false); }}
                                            className="hover:bg-white/10 p-1.5 rounded-lg text-base transition-transform hover:scale-125"
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Recording Preview Bar */}
                        {recordedBlob ? (
                            <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-slate-950 border border-indigo-500/30">
                                <span className="text-[10px] font-bold uppercase text-indigo-400 tracking-wider">Preview Voice/Video Note</span>
                                <div className="flex items-center gap-2">
                                    {recordedBlob.type === 'audio' ? (
                                        <audio src={recordedBlob.url} controls className="flex-1 h-8" />
                                    ) : (
                                        <video src={recordedBlob.url} controls className="max-h-[140px] rounded-lg w-full bg-black border border-white/10" />
                                    )}
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button type="button" onClick={cancelRecordedBlob} className="px-3 py-1 bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded-lg text-[10px] font-bold uppercase transition-colors">
                                        Discard
                                    </button>
                                    <button type="button" onClick={sendRecordedBlob} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold uppercase transition-colors">
                                        Send
                                    </button>
                                </div>
                            </div>
                        ) : isRecording ? (
                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-red-950/60 border border-red-500/40">
                                <div className="flex items-center gap-2 text-red-400 font-bold text-xs uppercase animate-pulse">
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                                    <span>Recording {isRecording}... {recordingTime}s</span>
                                </div>
                                <button type="button" onClick={stopRecording} className="bg-red-600 text-white p-1.5 rounded-lg hover:bg-red-500 transition-colors">
                                    <Square size={15} />
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSendMessage} className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <button type="button" onClick={() => setShowEmojiPicker(v => !v)} className="p-2 text-slate-400 hover:text-amber-400 hover:bg-white/5 rounded-xl transition-colors" title="Emojis">
                                        <Smile size={18} />
                                    </button>
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={handleInputChange}
                                        placeholder="Type your message..."
                                        className="flex-1 bg-slate-950 border border-white/10 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-slate-500 outline-none transition-all"
                                    />
                                    <button type="submit" disabled={!newMessage.trim()} className="bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-30 text-white p-2.5 rounded-xl transition-all shadow-md shrink-0">
                                        <Send size={16} fill="currentColor" />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between px-1 text-slate-400">
                                    <div className="flex items-center gap-1">
                                        <button type="button" onClick={() => fileInputRef.current?.click()} className="p-1.5 hover:text-white hover:bg-white/5 rounded-lg transition-colors" title="Attach Document/Media">
                                            <Paperclip size={16} />
                                        </button>
                                        <button type="button" onClick={() => startRecording('audio')} className="p-1.5 hover:text-emerald-400 hover:bg-white/5 rounded-lg transition-colors" title="Record Voice Message">
                                            <Mic size={16} />
                                        </button>
                                        <button type="button" onClick={() => startRecording('video')} className="p-1.5 hover:text-indigo-400 hover:bg-white/5 rounded-lg transition-colors" title="Record Video Message">
                                            <Video size={16} />
                                        </button>
                                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                                    </div>
                                    {isUploading && <span className="text-[10px] font-bold text-indigo-400 animate-pulse uppercase tracking-wider">Uploading...</span>}
                                </div>
                            </form>
                        )}
                    </div>
                </>
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 10px; }
            `}</style>
        </motion.div>
    )
}
