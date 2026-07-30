import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    X, Minus, Phone, Video, Loader2, Move, Square,
    UserPlus, ChevronDown, Smile
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useGlobalCall } from '../contexts/CallContext'
import { usePresence, useSendCallLog } from '../hooks/useChat'
import { toast } from 'react-hot-toast'
import MessageInput, { CalculatorSyncState } from './Chat/MessageInput'
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

    const [calcSyncState, setCalcSyncState] = useState<CalculatorSyncState>({
        isOpen: false,
        display: '0',
        prevVal: null,
        op: null,
        resetNext: false,
    })

    const [currentConvId, setCurrentConvId] = useState<string | null>(conversationId || null)
    const [targetUser] = useState<StaffProfile | any | null>(initialTargetUser || null)
    const [currentName, setCurrentName] = useState('Chat')
    const [members, setMembers] = useState<any[]>([])
    const [isGroup, setIsGroup] = useState(false)

    const [isRecording, setIsRecording] = useState<'audio' | 'video' | null>(null)
    const [recordingTime, setRecordingTime] = useState(0)
    const [recordedBlob, setRecordedBlob] = useState<{ blob: Blob; type: 'audio' | 'video' } | null>(null)

    const scrollRef = useRef<HTMLDivElement>(null)
    const channelRef = useRef<any>(null)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const timerRef = useRef<any>(null)

    const onlineUserIds = usePresence(currentConvId, activeProfile?.id)
    const otherMemberId = targetUser?.id || targetUser?.user_id || members.find(m => m.user_id !== activeProfile?.id)?.user_id
    const isTargetOnline = otherMemberId ? onlineUserIds.includes(otherMemberId) : false

    // Profile Resolution
    useEffect(() => {
        if (authProfile?.id) { setActiveProfile(authProfile); return }
        let isMounted = true
        const resolveProfile = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (user?.id && isMounted) {
                    const { data: sp } = await supabase.from('staff_profiles').select('*').eq('user_id', user.id).maybeSingle()
                    if (sp) { setActiveProfile(sp); return }
                    const { data: spId } = await supabase.from('staff_profiles').select('*').eq('id', user.id).maybeSingle()
                    if (spId) { setActiveProfile(spId); return }
                }
            } catch {}
            const fallbackName = (window as any).FETS?.user?.name || 'Staff'
            const fallbackId = (window as any).FETS?._meUserId || '00000000-0000-0000-0000-000000000001'
            if (isMounted) setActiveProfile({ id: fallbackId, full_name: fallbackName })
        }
        resolveProfile()
        return () => { isMounted = false }
    }, [authProfile])

    // Chat Init & Realtime
    useEffect(() => {
        if (!activeProfile?.id) return
        if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }

        const initChat = async () => {
            setIsLoading(true)
            try {
                let id = currentConvId
                const targetUserId = targetUser?.id || targetUser?.user_id

                if (!id && targetUser && targetUserId) {
                    try {
                        const { data: convId, error } = await supabase.rpc('get_or_create_conversation', { user_id_1: activeProfile.id, user_id_2: targetUserId })
                        if (!error && convId) id = convId
                    } catch {}
                    if (!id) {
                        const { data: newConv } = await supabase.from('conversations').insert({ name: `Direct: ${targetUser.full_name || 'Staff'}`, is_group: false }).select('id').single()
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
                if (!id) { setIsLoading(false); return }

                const { data: convInfo } = await supabase.rpc('get_conversation_info', { p_conversation_id: id })
                if (convInfo && convInfo.length > 0) {
                    const conv = convInfo[0]
                    setIsGroup(conv.is_group)
                    const memberList = (conv.member_ids || []).map((uid: string, i: number) => ({
                        user_id: uid,
                        staff_profiles: { id: uid, full_name: (conv.member_names || [])[i] || 'Staff', avatar_url: (conv.member_avatars || [])[i] }
                    }))
                    setMembers(memberList)
                    if (conv.is_group) setCurrentName(conv.name || 'Group Chat')
                    else if (targetUser) setCurrentName(targetUser.full_name || 'Direct Chat')
                    else setCurrentName(memberList.find((m: any) => m.user_id !== activeProfile.id)?.staff_profiles?.full_name || 'Chat')
                }

                const { data: msgs, error: msgsErr } = await supabase.rpc('get_conversation_messages', { p_conversation_id: id, p_limit: 200 })
                if (!msgsErr && msgs) setMessages(msgs)
                else {
                    const { data: directMsgs } = await supabase.from('messages').select('*').eq('conversation_id', id).or('is_deleted.eq.false,is_deleted.is.null').order('created_at', { ascending: true })
                    setMessages(directMsgs || [])
                }

                const channel = supabase.channel(`fets_popup_realtime_${id}`)
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, payload => {
                        if (payload.eventType === 'INSERT') {
                            setMessages(prev => {
                                if (prev.some(m => m.id === payload.new.id)) return prev
                                const filtered = prev.filter(m => !(m.id.startsWith('temp_') && m.sender_id === payload.new.sender_id && m.content === payload.new.content))
                                return [...filtered, payload.new]
                            })
                        } else if (payload.eventType === 'UPDATE') {
                            setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m))
                        } else if (payload.eventType === 'DELETE') {
                            setMessages(prev => prev.filter(m => m.id !== payload.old.id))
                        }
                    })
                    .on('broadcast', { event: 'calculator_sync' }, payload => {
                        if (payload.payload) setCalcSyncState(payload.payload)
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
        return () => { if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null } }
    }, [currentConvId, targetUser?.id, activeProfile?.id])

    const handleCalcSyncChange = (newState: CalculatorSyncState) => {
        setCalcSyncState(newState)
        channelRef.current?.send({ type: 'broadcast', event: 'calculator_sync', payload: newState }).catch(() => {})
    }

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }, [messages, isMinimized])

    const handleSendMessage = async (content: string, type: 'text' | 'voice' | 'file' | 'image' | 'video' | 'call_log' = 'text', filePath?: string) => {
        if (!content || !currentConvId || !activeProfile?.id) return
        const tempId = 'temp_' + Date.now()
        setMessages(prev => [...prev, { id: tempId, conversation_id: currentConvId, sender_id: activeProfile.id, content, type, file_path: filePath, created_at: new Date().toISOString(), status: 'sent' }])
        try {
            await supabase.from('messages').insert({ conversation_id: currentConvId, sender_id: activeProfile.id, content, type, file_path: filePath, status: 'sent' })
        } catch { toast.error('Failed to send message') }
    }

    const handleUploadFile = async (file: File): Promise<string | null> => {
        if (!currentConvId || !activeProfile?.id) return null
        setIsUploading(true)
        try {
            const path = `chat/${currentConvId}/${Date.now()}_${file.name}`
            const { error: upErr } = await supabase.storage.from('chat-uploads').upload(path, file)
            if (!upErr) { const { data } = supabase.storage.from('chat-uploads').getPublicUrl(path); return data.publicUrl }
            return await new Promise<string>(resolve => { const r = new FileReader(); r.onloadend = () => resolve(r.result as string); r.readAsDataURL(file) })
        } catch { toast.error('Upload failed'); return null }
        finally { setIsUploading(false) }
    }

    const startRecording = async (type: 'audio' | 'video') => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia(type === 'audio' ? { audio: true } : { video: true, audio: true })
            const recorder = new MediaRecorder(stream)
            mediaRecorderRef.current = recorder
            chunksRef.current = []
            recorder.ondataavailable = e => chunksRef.current.push(e.data)
            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: type === 'audio' ? 'audio/webm' : 'video/webm' })
                setRecordedBlob({ blob, type })
                stream.getTracks().forEach(t => t.stop())
            }
            recorder.start()
            setIsRecording(type)
            setRecordingTime(0)
            if (timerRef.current) clearInterval(timerRef.current)
            timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000)
        } catch { toast.error('Microphone/Camera access denied') }
    }

    const stopRecording = () => {
        mediaRecorderRef.current?.stop()
        setIsRecording(null)
        if (timerRef.current) clearInterval(timerRef.current)
    }

    const sendRecordedBlob = async () => {
        if (!recordedBlob) return
        const { blob, type } = recordedBlob
        const file = new File([blob], `rec_${Date.now()}.webm`, { type: blob.type })
        setRecordedBlob(null)
        const url = await handleUploadFile(file)
        if (url) { handleSendMessage(url, type === 'audio' ? 'voice' : 'video'); toast.success('Sent!') }
    }

    const getTargetIds = () => {
        const fromMembers = members.map(m => m.user_id).filter(uid => uid !== activeProfile?.id)
        return fromMembers.length > 0 ? fromMembers : targetUser?.id ? [targetUser.id] : []
    }

    const handleVoiceCall = () => {
        const targets = getTargetIds()
        if (!targets.length) { toast.error('No participants to call'); return }
        startCall(targets, 'audio')
        if (currentConvId) sendCallLog({ conversationId: currentConvId, senderId: activeProfile.id, callType: 'audio', status: 'completed', durationSeconds: 0 })
    }

    const handleVideoCall = () => {
        const targets = getTargetIds()
        if (!targets.length) { toast.error('No participants to call'); return }
        startCall(targets, 'video')
        if (currentConvId) sendCallLog({ conversationId: currentConvId, senderId: activeProfile.id, callType: 'video', status: 'completed', durationSeconds: 0 })
    }

    // Avatar initials
    const avatarLetter = currentName.charAt(0).toUpperCase()

    return (
        <motion.div
            drag
            dragMomentum={false}
            dragConstraints={{ left: -1200, right: 200, top: -600, bottom: 200 }}
            initial={{ opacity: 0, scale: 0.92, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0, height: isMinimized ? 62 : 600, width: 390 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
            style={{ zIndex, maxWidth: '95vw' }}
            className="fixed bottom-4 right-4 flex flex-col overflow-hidden rounded-3xl shadow-[0_30px_70px_rgba(0,0,0,0.5)] border border-white/10"
        >
            {/* ═══════════════ HEADER ═══════════════ */}
            <div className="shrink-0 bg-[#1a2236] cursor-grab active:cursor-grabbing px-4 py-3 flex items-center gap-2 border-b border-white/10 select-none">
                {/* Avatar + Name */}
                <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center font-black text-slate-950 text-sm shadow-lg">
                        {avatarLetter}
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#1a2236] ${isTargetOnline ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-slate-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm leading-tight truncate">{currentName}</p>
                    <p className="text-[10px] font-medium text-slate-400 leading-none mt-0.5">{isGroup ? `${members.length} members` : isTargetOnline ? '● Active now' : '○ Offline'}</p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1 shrink-0">
                    {/* Add Person */}
                    <button onClick={() => toast('Add person feature coming soon')} className="w-7 h-7 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-amber-400 transition-all" title="Add Person">
                        <UserPlus size={13} />
                    </button>
                    {/* Voice Call */}
                    <button onClick={handleVoiceCall} className="w-7 h-7 rounded-xl bg-white/10 hover:bg-emerald-500/30 flex items-center justify-center text-slate-300 hover:text-emerald-400 transition-all" title="Voice Call">
                        <Phone size={13} />
                    </button>
                    {/* Video Call */}
                    <button onClick={handleVideoCall} className="w-7 h-7 rounded-xl bg-white/10 hover:bg-indigo-500/30 flex items-center justify-center text-slate-300 hover:text-indigo-400 transition-all" title="Video Call">
                        <Video size={13} />
                    </button>
                    {/* Minimize */}
                    <button onClick={() => setIsMinimized(v => !v)} className="w-7 h-7 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-all" title="Minimize">
                        <Minus size={13} />
                    </button>
                    {/* Close */}
                    <button onClick={onClose} className="w-7 h-7 rounded-xl bg-red-500/20 hover:bg-red-500 flex items-center justify-center text-red-300 hover:text-white transition-all" title="Close">
                        <X size={13} />
                    </button>
                </div>
            </div>

            {/* ═══════════════ MESSAGES FEED ═══════════════ */}
            {!isMinimized && (
                <>
                    <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-scroll bg-[#111827] px-3 py-4 space-y-2"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                        <style>{`div::-webkit-scrollbar { display: none; }`}</style>
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
                                <Loader2 size={20} className="animate-spin text-amber-400" />
                                <span className="text-xs">Syncing messages...</span>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-600 text-xs">
                                <Smile size={28} className="opacity-30" />
                                <span>Start the conversation!</span>
                            </div>
                        ) : (
                            messages.map((msg, idx) => <Message key={msg.id || idx} message={msg} />)
                        )}
                    </div>

                    {/* ═══════════════ RECORDING BAR ═══════════════ */}
                    <AnimatePresence>
                        {recordedBlob && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                className="shrink-0 px-3 py-2 bg-amber-500/10 border-t border-amber-500/30 flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-amber-400 uppercase">✓ Recording Ready</span>
                                <div className="flex gap-2">
                                    <button onClick={() => setRecordedBlob(null)} className="px-3 py-1 bg-white/10 text-slate-300 rounded-xl text-xs font-bold hover:bg-red-500/20 hover:text-red-400 transition-colors">Discard</button>
                                    <button onClick={sendRecordedBlob} className="px-3 py-1 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold hover:bg-amber-400 transition-colors">Send</button>
                                </div>
                            </motion.div>
                        )}
                        {isRecording && !recordedBlob && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                className="shrink-0 px-3 py-2 bg-red-500/10 border-t border-red-500/30 flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-red-400 flex items-center gap-2 animate-pulse">
                                    <span className="w-2 h-2 bg-red-500 rounded-full" /> REC {isRecording.toUpperCase()} {recordingTime}s
                                </span>
                                <button onClick={stopRecording} className="px-3 py-1 bg-red-500 text-white rounded-xl text-xs font-bold hover:bg-red-600 transition-colors flex items-center gap-1">
                                    <Square size={11} /> Stop
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ═══════════════ INPUT AREA ═══════════════ */}
                    <MessageInput
                        onSendMessage={handleSendMessage}
                        onUploadFile={handleUploadFile}
                        onStartRecordVoice={() => startRecording('audio')}
                        onStartRecordVideo={() => startRecording('video')}
                        isUploading={isUploading}
                        calcSyncState={calcSyncState}
                        onCalcSyncChange={handleCalcSyncChange}
                        currentUserId={activeProfile?.id}
                        currentUserName={activeProfile?.full_name}
                    />
                </>
            )}
        </motion.div>
    )
}
