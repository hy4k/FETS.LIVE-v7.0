import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Send, Mic, Paperclip, X, Minus, Edit3, Trash2,
    MessageSquare, Phone, Video, MoreVertical,
    Check, CheckCheck, FileText, Square
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useWebRTC } from '../hooks/useWebRTC'
import { format } from 'date-fns'
import { toast } from 'react-hot-toast'
import { StaffProfile } from '../types/shared'
import { CallOverlay } from './CallOverlay'
import { IncomingCallModal } from './Chat/IncomingCallModal'

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
    targetUser: StaffProfile
    onClose: () => void
    zIndex?: number
}

export const FetsChatPopup: React.FC<FetsChatPopupProps> = ({ targetUser, onClose, zIndex = 1000 }) => {
    const { profile, user } = useAuth()
    const [messages, setMessages] = useState<Message[]>([])
    const [newMessage, setNewMessage] = useState('')
    const [isMinimized, setIsMinimized] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [convId, setConvId] = useState<string | null>(null)
    const [isRecording, setIsRecording] = useState<'audio' | 'video' | null>(null)
    const [recordingTime, setRecordingTime] = useState(0)
    
    // Edit Mode
    const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
    const [editContent, setEditContent] = useState('')
    
    // Context Menu
    const [contextMenuMsgId, setContextMenuMsgId] = useState<string | null>(null)

    // WebRTC
    const {
        callState,
        incomingCall,
        localVideoRef,
        remoteVideoRef,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleVideo
    } = useWebRTC(profile?.id || '', profile?.full_name || 'Unknown')

    const scrollRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const timerRef = useRef<any>(null)

    // Load/Create Conversation
    useEffect(() => {
        if (!targetUser || !profile?.id) return

        const initChat = async () => {
            setIsLoading(true)
            try {
                const { data: id, error } = await supabase.rpc('get_or_create_conversation', {
                    user_id_1: profile.id,
                    user_id_2: targetUser.id
                })
                if (error) throw error
                setConvId(id)

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
                                setMessages(prev => [...prev, payload.new as Message])
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

                return () => { channel.unsubscribe() }
            } catch (e) {
                console.error(e)
            } finally {
                setIsLoading(false)
            }
        }
        initChat()
    }, [targetUser, profile?.id])

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages, isMinimized])

    const handleSendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        if (!newMessage.trim() || !convId) return

        try {
            await supabase.from('messages').insert({
                conversation_id: convId,
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
                // Update message to show as deleted for everyone
                const { error } = await supabase.from('messages').update({ 
                    status: 'deleted_for_all', 
                    content: '🚫 Message deleted' 
                }).eq('id', msgId)
                
                if (error) throw error
                
                // Update local state immediately
                setMessages(prev => prev.map(m => 
                    m.id === msgId 
                        ? { ...m, status: 'deleted_for_all', content: '🚫 Message deleted' } 
                        : m
                ))
            } else {
                // Delete message from database
                const { error } = await supabase.from('messages').delete().eq('id', msgId)
                
                if (error) throw error
                
                // Remove from local state immediately
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
        if (!file || !convId) return

        setIsUploading(true)
        try {
            const path = `chat/${convId}/${Date.now()}_${file.name}`
            await supabase.storage.from('chat-uploads').upload(path, file)
            const { data } = supabase.storage.from('chat-uploads').getPublicUrl(path)

            let type: Message['type'] = 'file'
            if (file.type.startsWith('image/')) type = 'image'
            else if (file.type.startsWith('video/')) type = 'video'
            else if (file.type.startsWith('audio/')) type = 'voice'

            await supabase.from('messages').insert({
                conversation_id: convId,
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
                    const path = `chat/${convId}/recording_${Date.now()}.webm`
                    await supabase.storage.from('chat-uploads').upload(path, file)
                    const { data } = supabase.storage.from('chat-uploads').getPublicUrl(path)
                    
                    await supabase.from('messages').insert({
                        conversation_id: convId,
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

    // Voice/Video Call Handlers
    const handleVoiceCall = () => {
        startCall(targetUser.id, targetUser.full_name || 'Unknown', false)
    }

    const handleVideoCall = () => {
        startCall(targetUser.id, targetUser.full_name || 'Unknown', true)
    }

    return (
        <>
            {/* Incoming Call Modal */}
            <AnimatePresence>
                {incomingCall && (
                    <IncomingCallModal
                        callerName={incomingCall.fromName}
                        callType={incomingCall.isVideo ? 'video' : 'audio'}
                        onAccept={acceptCall}
                        onDecline={rejectCall}
                    />
                )}
            </AnimatePresence>

            {/* Active Call Overlay */}
            <AnimatePresence>
                {callState.status !== 'idle' && (
                    <CallOverlay
                        status={callState.status as 'calling' | 'ringing' | 'connected'}
                        isVideo={callState.isVideo}
                        isMuted={callState.isMuted}
                        isVideoOff={callState.isVideoOff}
                        remoteUserName={callState.remoteUserName || targetUser.full_name || 'Unknown'}
                        localVideoRef={localVideoRef}
                        remoteVideoRef={remoteVideoRef}
                        onEndCall={endCall}
                        onToggleMute={toggleMute}
                        onToggleVideo={toggleVideo}
                    />
                )}
            </AnimatePresence>

            {/* Chat Popup */}
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
                className="fixed bottom-4 right-4 bg-white rounded-2xl shadow-2xl border-2 border-black overflow-hidden flex flex-col"
            >
                {/* FETSCHAT BANNER */}
                <div className="bg-[#f4d03f] px-4 py-3 flex items-center justify-between border-b-2 border-black cursor-move">
                    <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500 border border-black/20" />
                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 border border-black/20" />
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500 border border-black/20" />
                        </div>
                        <span className="font-black text-xs uppercase tracking-[0.2em] text-black italic">FETSCHAT // <span className="text-black/60">{targetUser.full_name}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleVoiceCall} 
                            className="text-black hover:scale-110 transition-transform p-1.5 hover:bg-black/10 rounded-lg" 
                            title="Voice Call"
                        >
                            <Phone size={16} />
                        </button>
                        <button 
                            onClick={handleVideoCall} 
                            className="text-black hover:scale-110 transition-transform p-1.5 hover:bg-black/10 rounded-lg" 
                            title="Video Call"
                        >
                            <Video size={16} />
                        </button>
                        <div className="w-px h-4 bg-black/20 mx-1" />
                        <button onClick={() => setIsMinimized(!isMinimized)} className="text-black hover:bg-black/10 p-1 rounded transition-colors">
                            <Minus size={16} />
                        </button>
                        <button onClick={onClose} className="text-black hover:bg-black/10 p-1 rounded transition-colors">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {!isMinimized && (
                    <>
                        {/* CHAT AREA */}
                        <div 
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#fdfaf3] custom-scrollbar"
                            onClick={() => setContextMenuMsgId(null)}
                        >
                            {messages.map((msg, idx) => {
                                const isMe = msg.sender_id === profile.id
                                const isDeleted = msg.status === 'deleted_for_all'
                                
                                return (
                                    <div key={msg.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                                        <div className={`
                                            max-w-[85%] p-3 rounded-2xl border-2 border-black relative
                                            ${isMe 
                                                ? 'bg-amber-400 rounded-br-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' 
                                                : 'bg-white rounded-bl-none shadow-[4px_4px_0px_0px_rgba(200,200,200,1)]'}
                                            ${isDeleted ? 'opacity-50 italic' : ''}
                                        `}>
                                            {/* Context Menu for Own Messages */}
                                            {isMe && !isDeleted && (
                                                <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                                    <button 
                                                        onClick={() => { setEditingMsgId(msg.id); setEditContent(msg.content); }}
                                                        className="p-1 bg-white border border-black rounded-full hover:bg-amber-100 transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit3 size={10} />
                                                    </button>
                                                    <button 
                                                        onClick={() => setContextMenuMsgId(msg.id === contextMenuMsgId ? null : msg.id)}
                                                        className="p-1 bg-white border border-black rounded-full hover:bg-rose-100 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={10} />
                                                    </button>
                                                </div>
                                            )}
                                            
                                            {/* Delete Options Dropdown */}
                                            {contextMenuMsgId === msg.id && (
                                                <div 
                                                    className="absolute top-full right-0 mt-1 bg-white border-2 border-black rounded-xl shadow-lg z-20 overflow-hidden"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg.id, false); }} 
                                                        className="w-full px-4 py-2 text-[9px] font-black uppercase text-left hover:bg-slate-100 transition-colors"
                                                    >
                                                        Delete for me
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg.id, true); }} 
                                                        className="w-full px-4 py-2 text-[9px] font-black uppercase text-left hover:bg-rose-100 text-rose-600 transition-colors border-t border-black/10"
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
                                                        className="w-full bg-white border border-black rounded-lg px-2 py-1 text-sm font-bold outline-none"
                                                        autoFocus
                                                    />
                                                    <div className="flex gap-2 justify-end">
                                                        <button onClick={() => setEditingMsgId(null)} className="text-[9px] font-black uppercase text-slate-500 hover:text-black">Cancel</button>
                                                        <button onClick={() => handleEditMessage(msg.id)} className="text-[9px] font-black uppercase text-amber-700 hover:text-amber-900">Save</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    {msg.type === 'text' && (
                                                        <p className="text-sm font-bold text-black leading-snug">{msg.content}</p>
                                                    )}
                                                    {msg.type === 'image' && (
                                                        <img src={msg.content} alt="Attachment" className="rounded-lg max-w-full border border-black/10" />
                                                    )}
                                                    {msg.type === 'video' && (
                                                        <video src={msg.content} controls className="rounded-lg max-w-full" />
                                                    )}
                                                    {msg.type === 'voice' && (
                                                        <audio src={msg.content} controls className="w-full h-8" />
                                                    )}
                                                    {msg.type === 'file' && (
                                                        <a href={msg.content} target="_blank" className="flex items-center gap-2 text-xs font-black underline"><FileText size={14} /> {msg.file_path || 'Document'}</a>
                                                    )}
                                                </>
                                            )}
                                            
                                            <div className="flex items-center justify-end gap-1 mt-1 opacity-40">
                                                <span className="text-[9px] font-bold">{format(new Date(msg.created_at), 'HH:mm')}</span>
                                                {isMe && (msg.status === 'seen' ? <CheckCheck size={10} /> : <Check size={10} />)}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* INPUT AREA */}
                        <div className="p-3 border-t-2 border-black bg-white">
                            {isRecording ? (
                                <div className="flex items-center justify-between bg-rose-50 border-2 border-rose-500 p-3 rounded-xl animate-pulse">
                                    <div className="flex items-center gap-3 text-rose-600 font-black text-xs uppercase">
                                        <div className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                                        Recording {isRecording}... {recordingTime}s
                                    </div>
                                    <button onClick={stopRecording} className="bg-rose-600 text-white p-2 rounded-lg hover:bg-rose-700 transition-colors"><Square size={16} /></button>
                                </div>
                            ) : (
                                <form onSubmit={handleSendMessage} className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="text" 
                                            value={newMessage}
                                            onChange={e => setNewMessage(e.target.value)}
                                            placeholder="Type a secure message..."
                                            className="flex-1 bg-slate-50 border-2 border-black rounded-xl px-4 py-2 text-sm font-bold outline-none focus:bg-white transition-all shadow-inner"
                                        />
                                        <button 
                                            type="submit"
                                            disabled={!newMessage.trim()}
                                            className="bg-black text-white p-2.5 rounded-xl border-2 border-black hover:bg-slate-800 disabled:opacity-30 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                        >
                                            <Send size={18} fill="currentColor" />
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between px-1">
                                        <div className="flex items-center gap-1">
                                            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-black hover:bg-slate-100 rounded-lg transition-all" title="Attach Files"><Paperclip size={18} /></button>
                                            <button type="button" onClick={() => startRecording('audio')} className="p-2 text-slate-400 hover:text-black hover:bg-slate-100 rounded-lg transition-all" title="Voice Message"><Mic size={18} /></button>
                                            <button type="button" onClick={() => startRecording('video')} className="p-2 text-slate-400 hover:text-black hover:bg-slate-100 rounded-lg transition-all" title="Video Message"><Video size={18} /></button>
                                        </div>
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            className="hidden" 
                                            onChange={handleFileUpload}
                                        />
                                        {isUploading && <div className="text-[10px] font-black text-amber-600 animate-pulse uppercase tracking-widest">Encrypting...</div>}
                                    </div>
                                </form>
                            )}
                        </div>
                    </>
                )}

                <style>{`
                    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 10px; }
                `}</style>
            </motion.div>
        </>
    )
}
