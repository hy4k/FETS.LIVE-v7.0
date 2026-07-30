import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Send, Mic, Paperclip, X, Minus, Edit3, Trash2,
    Phone, Video, FileText, Square, UserPlus, Check, CheckCheck, Loader2, MoreVertical,
    Circle, Move, CornerDownRight
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useGlobalCall } from '../contexts/CallContext'
import { usePresence, useSendCallLog } from '../hooks/useChat'
import { format } from 'date-fns'
import { toast } from 'react-hot-toast'
import MessageInput from './Chat/MessageInput'
import Message from './Chat/Message'
import { StaffProfile } from '../types/shared'

interface FetsChatPopupProps {
    targetUser?: StaffProfile | any | null
    conversationId?: string | null
    onClose: () => void
    zIndex?: number
}

export const FetsChatPopup: React.FC<FetsChatPopupProps> = ({
    targetUser: initialTargetUser,
    conversationId,
    onClose,
    zIndex = 2000
}) => {
    const { profile: authProfile } = useAuth()
    const { startCall } = useGlobalCall()
    const sendCallLog = useSendCallLog()

    const [activeProfile, setActiveProfile] = useState<any>(authProfile)
    const [messages, setMessages] = useState<any[]>([])
    const [isMinimized, setIsMinimized] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isUploading, setIsUploading] = useState(false)

    // Dynamic Resizing & Dragging State
    const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 420, height: 560 })
    const [isResizing, setIsResizing] = useState(false)
    const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null)

    // Conversation State
    const [currentConvId, setCurrentConvId] = useState<string | null>(conversationId || null)
    const [targetUser, setTargetUser] = useState<StaffProfile | any | null>(initialTargetUser || null)
    const [isGroup, setIsGroup] = useState(false)
    const [currentName, setCurrentName] = useState('Chat')
    const [members, setMembers] = useState<any[]>([])

    // Add People Panel
    const [allStaff, setAllStaff] = useState<StaffProfile[]>([])
    const [showAddPeople, setShowAddPeople] = useState(false)

    // Options Menu
    const [showMenu, setShowMenu] = useState(false)

    // Voice Note Recording
    const [isRecording, setIsRecording] = useState<'audio' | 'video' | null>(null)
    const [recordingTime, setRecordingTime] = useState(0)
    const [recordedBlob, setRecordedBlob] = useState<{ blob: Blob; type: 'audio' | 'video'; url: string } | null>(null)

    const scrollRef = useRef<HTMLDivElement>(null)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const timerRef = useRef<any>(null)
    const channelRef = useRef<any>(null)

    // Online Presence
    const onlineUserIds = usePresence(currentConvId, activeProfile?.id)
    const otherMemberId = targetUser?.id || targetUser?.user_id || members.find(m => m.user_id !== activeProfile?.id)?.user_id
    const isTargetOnline = otherMemberId ? onlineUserIds.includes(otherMemberId) : false

    // Profile Resolution
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

            const fallbackName = (window as any).FETS?.user?.name || 'Staff'
            const fallbackId = (window as any).FETS?._meUserId || (window as any).FETS?._meId || '00000000-0000-0000-0000-000000000001'

            if (isMounted) {
                setActiveProfile({ id: fallbackId, full_name: fallbackName, role: 'Staff Member' })
            }
        }
        resolveProfile()
        return () => { isMounted = false }
    }, [authProfile])

    // Load Staff for Invites
    useEffect(() => {
        supabase.from('staff_profiles')
            .select('*')
            .order('full_name', { ascending: true })
            .then(({ data }) => { if (data) setAllStaff(data) })
    }, [])

    // Initialize Conversation & Realtime Sync with Message Deduplication
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
                const { data: convInfo } = await supabase.rpc('get_conversation_info', { p_conversation_id: id })

                if (convInfo && convInfo.length > 0) {
                    const conv = convInfo[0]
                    setIsGroup(conv.is_group)
                    const memberList = (conv.member_ids || []).map((uid: string, i: number) => ({
                        user_id: uid,
                        staff_profiles: {
                            id: uid,
                            full_name: (conv.member_names || [])[i] || 'Staff',
                            avatar_url: (conv.member_avatars || [])[i] || undefined
                        }
                    }))
                    setMembers(memberList)
                    if (conv.is_group) setCurrentName(conv.name || 'Group Chat')
                    else if (targetUser) setCurrentName(targetUser.full_name || 'Direct Chat')
                    else setCurrentName(memberList.find((m: any) => m.user_id !== activeProfile.id)?.staff_profiles?.full_name || 'Direct Chat')
                }

                // Load Messages
                const { data: msgs, error: msgsErr } = await supabase.rpc('get_conversation_messages', { p_conversation_id: id, p_limit: 200 })

                if (!msgsErr && msgs) {
                    setMessages(msgs)
                } else {
                    const { data: directMsgs } = await supabase.from('messages').select('*').eq('conversation_id', id).or('is_deleted.eq.false,is_deleted.is.null').order('created_at', { ascending: true })
                    setMessages(directMsgs || [])
                }

                // Realtime Channel with Deduplication
                const channel = supabase.channel(`fets_popup_realtime_${id}`)
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, payload => {
                        if (payload.eventType === 'INSERT') {
                            setMessages(prev => {
                                if (prev.some(m => m.id === payload.new.id)) return prev
                                // Remove optimistic match
                                const filtered = prev.filter(m => !(m.id.startsWith('temp_') && m.sender_id === payload.new.sender_id && m.content === payload.new.content))
                                return [...filtered, payload.new]
                            })
                        } else if (payload.eventType === 'UPDATE') {
                            setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m))
                        } else if (payload.eventType === 'DELETE') {
                            setMessages(prev => prev.filter(m => m.id !== payload.old.id))
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

    // Auto Scroll
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }, [messages, isMinimized])

    // Resize Handler
    const startResize = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsResizing(true)
        resizeRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startW: dimensions.width,
            startH: dimensions.height,
        }

        const onMouseMove = (moveEv: MouseEvent) => {
            if (!resizeRef.current) return
            const dx = moveEv.clientX - resizeRef.current.startX
            const dy = moveEv.clientY - resizeRef.current.startY
            const newW = Math.max(340, Math.min(800, resizeRef.current.startW + dx))
            const newH = Math.max(380, Math.min(850, resizeRef.current.startH + dy))
            setDimensions({ width: newW, height: newH })
        }

        const onMouseUp = () => {
            setIsResizing(false)
            window.removeEventListener('mousemove', onMouseMove)
            window.removeEventListener('mouseup', onMouseUp)
        }

        window.addEventListener('mousemove', onMouseMove)
        window.addEventListener('mouseup', onMouseUp)
    }

    // Send Message Handler with Optimistic Deduplication
    const handleSendMessage = async (content: string, type: 'text' | 'voice' | 'file' | 'image' | 'video' | 'call_log' = 'text', filePath?: string) => {
        if (!content || !currentConvId || !activeProfile?.id) return

        const tempId = 'temp_' + Date.now()
        const optMsg = {
            id: tempId,
            conversation_id: currentConvId,
            sender_id: activeProfile.id,
            content,
            type,
            file_path: filePath,
            created_at: new Date().toISOString(),
            status: 'sent'
        }
        setMessages(prev => [...prev, optMsg])

        try {
            await supabase.from('messages').insert({
                conversation_id: currentConvId,
                sender_id: activeProfile.id,
                content,
                type,
                file_path: filePath,
                status: 'sent'
            })
        } catch {
            toast.error('Failed to send message')
        }
    }

    // Upload File Function for MessageInput
    const handleUploadFile = async (file: File): Promise<string | null> => {
        if (!currentConvId || !activeProfile?.id) return null
        setIsUploading(true)
        try {
            const path = `chat/${currentConvId}/${Date.now()}_${file.name}`
            const { error: upErr } = await supabase.storage.from('chat-uploads').upload(path, file)
            if (!upErr) {
                const { data } = supabase.storage.from('chat-uploads').getPublicUrl(path)
                return data.publicUrl
            } else {
                return await new Promise<string>((resolve) => {
                    const reader = new FileReader()
                    reader.onloadend = () => resolve(reader.result as string)
                    reader.readAsDataURL(file)
                })
            }
        } catch {
            toast.error('Upload failed')
            return null
        } finally {
            setIsUploading(false)
        }
    }

    // Recording Voice/Video Notes
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
            toast.error('Microphone/Camera access denied')
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
        setRecordedBlob(null)

        const mediaUrl = await handleUploadFile(file)
        if (mediaUrl) {
            handleSendMessage(mediaUrl, type === 'audio' ? 'voice' : 'video')
            toast.success(type === 'audio' ? 'Voice note sent!' : 'Video note sent!')
        }
    }

    const handleVoiceCall = () => {
        const targets = members.map(m => m.user_id).filter(uid => uid !== activeProfile?.id)
        const targetList = targets.length > 0 ? targets : targetUser?.id ? [targetUser.id] : []
        if (targetList.length > 0) {
            startCall(targetList, 'audio')
            if (currentConvId) {
                sendCallLog({ conversationId: currentConvId, senderId: activeProfile.id, callType: 'audio', status: 'completed', durationSeconds: 0 })
            }
        } else {
            toast.error('No other participants to call')
        }
    }

    const handleVideoCall = () => {
        const targets = members.map(m => m.user_id).filter(uid => uid !== activeProfile?.id)
        const targetList = targets.length > 0 ? targets : targetUser?.id ? [targetUser.id] : []
        if (targetList.length > 0) {
            startCall(targetList, 'video')
            if (currentConvId) {
                sendCallLog({ conversationId: currentConvId, senderId: activeProfile.id, callType: 'video', status: 'completed', durationSeconds: 0 })
            }
        } else {
            toast.error('No other participants to call')
        }
    }

    const addableStaff = allStaff.filter(s => s.id !== activeProfile?.id && !members.map(m => m.user_id).includes(s.id))

    return (
        <motion.div
            drag
            dragMomentum={false}
            dragConstraints={{ left: -1000, right: 1000, top: -1000, bottom: 1000 }}
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ 
                opacity: 1, 
                scale: 1, 
                height: isMinimized ? 56 : dimensions.height, 
                width: dimensions.width 
            }}
            transition={{ duration: 0.2 }}
            style={{ zIndex }}
            className="fixed bottom-4 right-4 bg-[#0f172a] shadow-[0_20px_50px_rgba(0,0,0,0.7)] border border-slate-700 rounded-2xl overflow-hidden flex flex-col text-white"
        >
            {/* DRAGGABLE HEADER */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-4 py-3 flex items-center justify-between border-b border-white/10 select-none gap-2 shrink-0 cursor-grab active:cursor-grabbing">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Move size={14} className="text-amber-400 shrink-0" />
                    <div className="relative shrink-0">
                        <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center font-bold text-xs uppercase text-amber-300">
                            {currentName.charAt(0)}
                        </div>
                        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${isTargetOnline ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-slate-500'}`} />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="font-bold text-xs text-slate-100 truncate">{currentName}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{isTargetOnline ? 'Active Now' : 'Offline'}</span>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-1 shrink-0">
                    <button onClick={handleVoiceCall} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-emerald-400 transition-colors" title="Voice Call">
                        <Phone size={15} />
                    </button>
                    <button onClick={handleVideoCall} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-indigo-400 transition-colors" title="Video Call">
                        <Video size={15} />
                    </button>
                    <button onClick={() => setIsMinimized(!isMinimized)} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors" title="Minimize">
                        <Minus size={15} />
                    </button>
                    <button onClick={onClose} className="p-1.5 bg-red-600/25 hover:bg-red-600 text-red-300 hover:text-white rounded-lg transition-all shrink-0" title="Close">
                        <X size={15} />
                    </button>
                </div>
            </div>

            {!isMinimized && (
                <>
                    {/* MESSAGES FEED */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0b1329] custom-scrollbar">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
                                <Loader2 size={22} className="animate-spin text-amber-400" />
                                <span className="text-xs font-medium">Syncing messages...</span>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-slate-400 italic text-xs">
                                No messages yet. Send a message to start!
                            </div>
                        ) : (
                            messages.map((msg, idx) => <Message key={msg.id || idx} message={msg} />)
                        )}
                    </div>

                    {/* RECORDING PREVIEW BAR */}
                    {recordedBlob ? (
                        <div className="p-3 bg-slate-900 border-t border-white/10 flex items-center justify-between gap-3">
                            <span className="text-xs font-bold text-amber-400 uppercase">Voice Recording Ready</span>
                            <div className="flex gap-2">
                                <button onClick={() => setRecordedBlob(null)} className="px-3 py-1 bg-red-500/20 text-red-400 rounded-lg text-xs font-bold">Discard</button>
                                <button onClick={sendRecordedBlob} className="px-3 py-1 bg-amber-500 text-slate-950 rounded-lg text-xs font-bold">Send</button>
                            </div>
                        </div>
                    ) : isRecording ? (
                        <div className="p-3 bg-red-950/80 border-t border-red-500/40 flex items-center justify-between text-red-400 font-bold text-xs uppercase animate-pulse">
                            <span>Recording Voice Note... {recordingTime}s</span>
                            <button onClick={stopRecording} className="bg-red-600 text-white p-1.5 rounded-lg"><Square size={14} /></button>
                        </div>
                    ) : (
                        <MessageInput onSendMessage={handleSendMessage} onUploadFile={handleUploadFile} isUploading={isUploading} />
                    )}

                    {/* RESIZE CORNER HANDLE */}
                    <div
                        onMouseDown={startResize}
                        className="absolute bottom-0 right-0 p-1 cursor-nwse-resize text-slate-500 hover:text-amber-400 z-50"
                        title="Drag to Resize Window"
                    >
                        <CornerDownRight size={14} />
                    </div>
                </>
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 10px; }
            `}</style>
        </motion.div>
    )
}
