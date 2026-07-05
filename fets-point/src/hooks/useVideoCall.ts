import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { toast } from 'react-hot-toast';

interface CallState {
    isInCall: boolean;
    isCalling: boolean;
    isReceivingCall: boolean;
    callerId: string | null;
    participants: string[]; // List of users we are trying to connect with
    localStream: MediaStream | null;
    remoteStreams: Record<string, MediaStream>; // Keyed by User ID
    callType: 'video' | 'audio';
    startTime: number | null;
}

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

export function useVideoCall() {
    const { user, profile } = useAuth();
    const myId = profile?.id || user?.id;
    const [callState, setCallState] = useState<CallState>({
        isInCall: false,
        isCalling: false,
        isReceivingCall: false,
        callerId: null,
        participants: [],
        localStream: null,
        remoteStreams: {},
        callType: 'video',
        startTime: null,
    });

    const stateRef = useRef(callState);
    useEffect(() => {
        stateRef.current = callState;
    }, [callState]);

    const pcs = useRef<Record<string, RTCPeerConnection>>({});
    const localStreamRef = useRef<MediaStream | null>(null);
    const channelRef = useRef<any>(null);

    // --- Cleanup ---
    const cleanup = useCallback(() => {
        Object.values(pcs.current).forEach(pc => {
            pc.onicecandidate = null;
            pc.ontrack = null;
            pc.onconnectionstatechange = null;
            pc.close();
        });
        pcs.current = {};

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                track.stop();
                track.enabled = false;
            });
            localStreamRef.current = null;
        }
        setCallState({
            isInCall: false,
            isCalling: false,
            isReceivingCall: false,
            callerId: null,
            participants: [],
            localStream: null,
            remoteStreams: {},
            callType: 'video',
            startTime: null,
        });
    }, []);

    // --- Signaling logic ---
    const sendSignal = useCallback((targetUserId: string, payload: any) => {
        if (!channelRef.current) return;
        channelRef.current.send({
            type: 'broadcast',
            event: 'video-signal',
            payload: {
                from: myId,
                to: targetUserId,
                ...payload
            }
        });
    }, [myId]);

    // --- Create Peer Connection ---
    const createPC = useCallback((targetUserId: string) => {
        if (pcs.current[targetUserId]) return pcs.current[targetUserId];

        const pc = new RTCPeerConnection(ICE_SERVERS);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignal(targetUserId, { type: 'ice-candidate', candidate: event.candidate });
            }
        };

        pc.ontrack = (event) => {
            console.log(`[useVideoCall] Track received from ${targetUserId}:`, event.track.kind);

            setCallState(prev => {
                const existingStream = prev.remoteStreams[targetUserId];
                const stream = event.streams[0] || (existingStream ? existingStream : new MediaStream());

                if (!stream.getTracks().find(t => t.id === event.track.id)) {
                    stream.addTrack(event.track);
                }

                return {
                    ...prev,
                    remoteStreams: {
                        ...prev.remoteStreams,
                        [targetUserId]: stream
                    }
                };
            });
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                setCallState(prev => {
                    const newStreams = { ...prev.remoteStreams };
                    delete newStreams[targetUserId];
                    return { ...prev, remoteStreams: newStreams };
                });
            }
        };

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current!);
            });
        }

        pcs.current[targetUserId] = pc;
        return pc;
    }, [sendSignal]);

    // --- Handlers ---
    const startCall = async (targetUserIds: string | string[], type: 'video' | 'audio' = 'video') => {
        const targets = Array.isArray(targetUserIds) ? targetUserIds : [targetUserIds];
        if (targets.length === 0) return;

        try {
            const constraints = {
                audio: true,
                video: type === 'video'
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            localStreamRef.current = stream;

            setCallState(prev => ({
                ...prev,
                isCalling: true,
                localStream: stream,
                participants: targets,
                callType: type
            }));

            // In Mesh, we send an offer to EACH participant
            for (const targetId of targets) {
                const pc = createPC(targetId);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                sendSignal(targetId, { type: 'offer', offer, callType: type });
            }
        } catch (err) {
            console.error('Failed to start call:', err);
            toast.error('Could not access camera/microphone');
            cleanup();
        }
    };

    const answerCall = async () => {
        const offer = (window as any)._pendingOffer;
        const callType = (window as any)._pendingCallType || 'video';
        const from = stateRef.current.callerId;
        if (!offer || !from) return;

        try {
            const constraints = {
                audio: true,
                video: callType === 'video'
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            localStreamRef.current = stream;

            const pc = createPC(from);
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendSignal(from, { type: 'answer', answer });

            setCallState(prev => ({
                ...prev,
                isReceivingCall: false,
                isInCall: true,
                localStream: stream,
                startTime: Date.now()
            }));
            delete (window as any)._pendingOffer;
            delete (window as any)._pendingCallType;
        } catch (err) {
            console.error('Answer failed:', err);
            cleanup();
        }
    };

    const endCall = () => {
        Object.keys(pcs.current).forEach(targetId => {
            sendSignal(targetId, { type: 'end-call' });
        });
        cleanup();
    };

    const rejectCall = () => {
        if (callState.callerId) {
            sendSignal(callState.callerId, { type: 'reject-call' });
        }
        setCallState(prev => ({ ...prev, isReceivingCall: false, callerId: null }));
    };

    // --- Signaling Subscription ---
    useEffect(() => {
        if (!myId) return;

        // Use a global signaling channel so users can message each other
        const channel = supabase.channel('fets-global-signaling');
        channelRef.current = channel;

        channel.on('broadcast', { event: 'video-signal' }, async ({ payload }) => {
            const { from, to, type, offer, answer, candidate } = payload;
            if (to !== myId) return; // Not for me

            switch (type) {
                case 'offer':
                    if (stateRef.current.isInCall || stateRef.current.isCalling || stateRef.current.isReceivingCall) {
                        sendSignal(from, { type: 'reject-call', reason: 'busy' });
                        return;
                    }
                    setCallState(prev => ({ ...prev, isReceivingCall: true, callerId: from, callType: (payload as any).callType || 'video' }));
                    (window as any)._pendingOffer = offer;
                    (window as any)._pendingCallType = (payload as any).callType || 'video';
                    break;

                case 'answer':
                    if (pcs.current[from]) {
                        await pcs.current[from].setRemoteDescription(new RTCSessionDescription(answer));
                        setCallState(prev => ({ ...prev, isCalling: false, isInCall: true, startTime: prev.startTime || Date.now() }));
                    }
                    break;

                case 'ice-candidate':
                    if (pcs.current[from]) {
                        try {
                            await pcs.current[from].addIceCandidate(new RTCIceCandidate(candidate));
                        } catch (e) {
                            // Suppress candidate error logged during cleanup/disconnect
                        }
                    }
                    break;

                case 'reject-call':
                    toast.error('Agent rejected call or is busy');
                    cleanup();
                    break;

                case 'end-call':
                    setCallState(prev => {
                        const newStreams = { ...prev.remoteStreams };
                        delete newStreams[from];
                        const stillInCall = Object.keys(newStreams).length > 0 || prev.isCalling;
                        if (!stillInCall) {
                            setTimeout(cleanup, 0);
                            return prev;
                        }
                        return { ...prev, remoteStreams: newStreams };
                    });
                    if (pcs.current[from]) {
                        pcs.current[from].close();
                        delete pcs.current[from];
                    }
                    break;
            }
        }).subscribe();

        return () => {
            channel.unsubscribe();
            channelRef.current = null;
        };
    }, [myId, cleanup]);

    return {
        callState,
        startCall,
        endCall,
        answerCall,
        rejectCall
    };
}
