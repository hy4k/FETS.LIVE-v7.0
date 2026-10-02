import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Mic, MicOff, Minimize2, Maximize2, MonitorUp, Phone, PhoneOff, Video, VideoOff, Users } from 'lucide-react';
import { Room, RoomEvent, Track, type Participant } from 'livekit-client';
import { toast } from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { RING_FOR, callApi, inCall, notifyCall, ringer, ringsFor, type CallKind, type CallPeer, type ChatCall } from './chat-calls';
import './calls.css';

type CallCenterValue = {
  /** Ring everyone in a conversation (or join the call already running there). */
  call: (conversationId: string, kind: CallKind) => Promise<void>;
  /** Join a call that is ringing or running. */
  join: (call: ChatCall) => Promise<void>;
  /** Live calls by conversation, for "join" banners. */
  live: Record<string, ChatCall>;
  /** The call I am in, if any. */
  current: ChatCall | null;
  me: string;
};
const Ctx = createContext<CallCenterValue | null>(null);
export const useCallCenter = () => {
  const value = useContext(Ctx);
  if (!value) throw new Error('useCallCenter must be used inside CallCenterProvider');
  return value;
};
const message = (e: unknown) => (e instanceof Error ? e.message : 'The call could not be placed');
const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();

export function CallCenterProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const me: string = profile?.id || '';
  const [calls, setCalls] = useState<Record<string, ChatCall>>({});
  const [peers, setPeers] = useState<Record<string, CallPeer>>({});
  const [dismissed, setDismissed] = useState<Record<string, true>>({});
  const [, tick] = useState(0);

  const upsert = useCallback((c: ChatCall) => setCalls(old => ({ ...old, [c.id]: c })), []);

  // Every call in my conversations, as it changes. A slow poll covers a dropped connection.
  useEffect(() => {
    if (!me) return;
    let live = true;
    const load = () => callApi.live().then(rows => {
      if (!live) return;
      setCalls(old => {
        const next: Record<string, ChatCall> = {};
        for (const c of Object.values(old)) if (c.status === 'ringing' || c.status === 'active') next[c.id] = { ...c, status: 'ended' };
        for (const c of rows) next[c.id] = c;
        return next;
      });
    }).catch(() => undefined);
    void load();
    const channel = supabase.channel(`chat-calls-${me}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_calls' }, (payload: any) => { if (payload.new?.id) upsert(payload.new as ChatCall); })
      .subscribe();
    const poll = window.setInterval(load, 15000);
    const clock = window.setInterval(() => tick(n => n + 1), 5000);
    const wake = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', wake);
    return () => { live = false; void supabase.removeChannel(channel); window.clearInterval(poll); window.clearInterval(clock); document.removeEventListener('visibilitychange', wake); };
  }, [me, upsert]);

  // Who is calling, for the screen.
  useEffect(() => {
    for (const c of Object.values(calls)) {
      if ((c.status === 'ringing' || c.status === 'active') && !peers[c.id]) {
        setPeers(old => ({ ...old, [c.id]: { conversationName: 'Connecting…', isGroup: false, callerName: 'A teammate' } }));
        callApi.peer(c, me).then(p => setPeers(old => ({ ...old, [c.id]: p }))).catch(() => undefined);
      }
    }
  }, [calls, peers, me]);

  const liveCalls = Object.values(calls).filter(c => c.status === 'ringing' || c.status === 'active');
  const current = liveCalls.find(c => inCall(c, me)) ?? null;
  const incoming = !current ? liveCalls.find(c => !dismissed[c.id] && ringsFor(c, me, peers[c.id]?.isGroup ?? false)) ?? null : null;
  const live = useMemo(() => Object.fromEntries(liveCalls.map(c => [c.conversation_id, c])), [liveCalls]);

  const call = useCallback(async (conversationId: string, kind: CallKind) => {
    if (current && current.conversation_id !== conversationId) { toast.error('Finish your current call first'); return; }
    try { upsert(await callApi.start(conversationId, kind)); } catch (e) { toast.error(message(e)); }
  }, [current, upsert]);
  const join = useCallback(async (c: ChatCall) => {
    try { upsert(await callApi.join(c.id)); } catch (e) { toast.error(message(e)); }
  }, [upsert]);
  const decline = useCallback(async (c: ChatCall) => {
    setDismissed(old => ({ ...old, [c.id]: true }));
    try { upsert(await callApi.decline(c.id)); } catch { /* Ringing stops locally either way. */ }
  }, [upsert]);
  const leave = useCallback(async (c: ChatCall) => {
    upsert({ ...c, participants: c.participants.filter(p => p !== me) });
    try { upsert(await callApi.leave(c.id)); } catch { /* The server settles calls nobody is in. */ }
  }, [me, upsert]);

  // A call I started that nobody answered stops ringing after a minute.
  useEffect(() => {
    if (!current || current.status !== 'ringing' || current.started_by !== me) return;
    const left = RING_FOR - (Date.now() - new Date(current.created_at).getTime());
    const t = window.setTimeout(() => { callApi.settle(current.id).then(upsert).catch(() => undefined); }, Math.max(1000, left + 500));
    return () => window.clearTimeout(t);
  }, [current, me, upsert]);

  return <Ctx.Provider value={{ call, join, live, current, me }}>
    {children}
    {incoming && <IncomingCall key={incoming.id} call={incoming} peer={peers[incoming.id]} onAccept={() => void join(incoming)} onDecline={() => void decline(incoming)} />}
    {current && <CallScreen key={current.id} call={current} peer={peers[current.id]} me={me} onLeave={() => void leave(current)} />}
  </Ctx.Provider>;
}

function IncomingCall({ call, peer, onAccept, onDecline }: { call: ChatCall; peer?: CallPeer; onAccept: () => void; onDecline: () => void }) {
  const who = peer?.isGroup ? `${peer.callerName} · ${peer.conversationName}` : peer?.callerName || 'A teammate';
  useEffect(() => {
    const ring = ringer('incoming'); ring.start();
    const n = notifyCall(`Incoming ${call.kind === 'video' ? 'video' : 'voice'} call`, who, () => undefined);
    const title = document.title; let flip = false;
    const flash = window.setInterval(() => { flip = !flip; document.title = flip ? '📞 Incoming call' : title; }, 1000);
    return () => { ring.stop(); n?.close(); window.clearInterval(flash); document.title = title; };
  }, [call.id, call.kind, who]);
  return createPortal(<div className="cc-incoming" role="alertdialog" aria-modal="true" aria-label={`Incoming call from ${who}`}>
    <div className="cc-incoming-card">
      <div className="cc-pulse"><span className="cc-avatar big">{peer?.isGroup ? <Users size={30} /> : initials(peer?.callerName)}</span></div>
      <span className="cc-kicker">INCOMING {call.kind === 'video' ? 'VIDEO' : 'VOICE'} CALL</span>
      <h2>{peer?.isGroup ? peer.conversationName : peer?.callerName || 'A teammate'}</h2>
      {peer?.isGroup && <p>{peer.callerName} started a group call{call.participants.length > 1 ? ` · ${call.participants.length} in the call` : ''}</p>}
      <div className="cc-incoming-actions">
        <button className="cc-round decline" onClick={onDecline} aria-label="Decline"><PhoneOff size={24} /></button>
        <button className="cc-round accept" onClick={onAccept} aria-label="Answer">{call.kind === 'video' ? <Video size={24} /> : <Phone size={24} />}</button>
      </div>
      <div className="cc-incoming-labels"><span>Decline</span><span>Answer</span></div>
    </div>
  </div>, document.body);
}

function Tile({ participant, revision, kind }: { participant: Participant; revision: number; kind: CallKind }) {
  const video = useRef<HTMLVideoElement>(null), audio = useRef<HTMLAudioElement>(null);
  const cam = participant.getTrackPublication(Track.Source.ScreenShare)?.track || participant.getTrackPublication(Track.Source.Camera)?.track;
  const hasVideo = Boolean(cam && !participant.getTrackPublication(Track.Source.Camera)?.isMuted) || Boolean(participant.getTrackPublication(Track.Source.ScreenShare)?.track);
  useEffect(() => {
    const a = participant.getTrackPublication(Track.Source.Microphone)?.track;
    const ve = video.current, ae = audio.current;
    if (cam && ve) cam.attach(ve);
    if (a && ae && !participant.isLocal) a.attach(ae);
    return () => { if (cam && ve) cam.detach(ve); if (a && ae) a.detach(ae); };
  }, [participant, revision, cam]);
  const muted = participant.getTrackPublication(Track.Source.Microphone)?.isMuted ?? true;
  return <div className={`cc-tile ${participant.isSpeaking ? 'speaking' : ''} ${hasVideo ? 'has-video' : ''}`}>
    <video ref={video} autoPlay playsInline muted={participant.isLocal} className={participant.isLocal && !participant.getTrackPublication(Track.Source.ScreenShare)?.track ? 'mirror' : ''} />
    <audio ref={audio} autoPlay />
    {!hasVideo && <span className="cc-avatar big">{initials(participant.isLocal ? 'You' : participant.name || 'Teammate')}</span>}
    <span className="cc-name">{muted && <MicOff size={12} />}{participant.isLocal ? 'You' : participant.name || 'Teammate'}{kind === 'audio' && participant.isSpeaking ? ' · speaking' : ''}</span>
  </div>;
}

function CallScreen({ call, peer, me, onLeave }: { call: ChatCall; peer?: CallPeer; me: string; onLeave: () => void }) {
  const [room] = useState(() => new Room({ adaptiveStream: true, dynacast: true }));
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'failed'>('connecting');
  const [error, setError] = useState('');
  const [mic, setMic] = useState(true), [camera, setCamera] = useState(call.kind === 'video'), [screen, setScreen] = useState(false);
  const [small, setSmall] = useState(false);
  const [now, setNow] = useState(Date.now());
  const ringing = call.status === 'ringing' && call.started_by === me;
  const remotes = [...room.remoteParticipants.values()];
  const hadRemote = useRef(false);

  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);
  useEffect(() => { if (!ringing) return; const r = ringer('outgoing'); r.start(); return () => r.stop(); }, [ringing]);
  useEffect(() => {
    let cancelled = false;
    const refresh = () => setRevision(n => n + 1);
    [RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed, RoomEvent.LocalTrackPublished,
      RoomEvent.LocalTrackUnpublished, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.ActiveSpeakersChanged].forEach(event => room.on(event, refresh));
    room.on(RoomEvent.Reconnecting, () => setError('Reconnecting…'));
    room.on(RoomEvent.Reconnected, () => setError(''));
    (async () => {
      const { data, error: err } = await supabase.functions.invoke('livekit-token', { body: { conversationId: call.conversation_id } });
      if (err || !data?.token) {
        const detail = await (err as any)?.context?.json?.().catch(() => null);
        throw Error(detail?.error || data?.error || 'Could not authorise the call');
      }
      if (cancelled) return;
      await room.connect(data.url, data.token);
      if (cancelled) { await room.disconnect(); return; }
      await room.localParticipant.setMicrophoneEnabled(true).catch(() => { setMic(false); setError('Microphone permission was not given'); });
      if (call.kind === 'video') await room.localParticipant.setCameraEnabled(true).catch(() => { setCamera(false); setError('Camera permission was not given'); });
      if (!cancelled) { setStatus('connected'); refresh(); }
    })().catch(e => { if (!cancelled) { setStatus('failed'); setError(message(e)); } });
    return () => { cancelled = true; void room.disconnect(); room.removeAllListeners(); };
  }, [room, call.conversation_id, call.kind]);

  // In a one-to-one call, the other person hanging up ends it here too.
  useEffect(() => {
    if (remotes.length) hadRemote.current = true;
    if (!peer?.isGroup && hadRemote.current && remotes.length === 0 && status === 'connected') {
      const t = window.setTimeout(onLeave, 2500);
      return () => window.clearTimeout(t);
    }
  }, [remotes.length, peer?.isGroup, status, onLeave]);

  const toggle = async (what: 'mic' | 'camera' | 'screen') => {
    try {
      if (what === 'mic') { await room.localParticipant.setMicrophoneEnabled(!mic); setMic(!mic); }
      if (what === 'camera') { await room.localParticipant.setCameraEnabled(!camera); setCamera(!camera); }
      if (what === 'screen') { await room.localParticipant.setScreenShareEnabled(!screen); setScreen(!screen); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Permission was not given'); }
  };
  const since = call.answered_at ? Math.max(0, Math.floor((now - new Date(call.answered_at).getTime()) / 1000)) : 0;
  const timer = `${String(Math.floor(since / 60)).padStart(2, '0')}:${String(since % 60).padStart(2, '0')}`;
  const title = peer?.conversationName || 'Call';
  const state = status === 'failed' ? 'Could not connect' : ringing ? (peer?.isGroup ? 'Ringing the group…' : 'Ringing…') : status === 'connecting' ? 'Connecting…' : remotes.length ? timer : 'Waiting for others to join…';

  return createPortal(<section className={`cc-screen ${small ? 'small' : ''}`} role="dialog" aria-label={`${call.kind === 'video' ? 'Video' : 'Voice'} call with ${title}`}>
    <header className="cc-head">
      <div><span className="cc-kicker">{call.kind === 'video' ? 'VIDEO CALL' : 'VOICE CALL'}</span><h2>{title}</h2><p>{state}</p></div>
      <button className="cc-icon" onClick={() => setSmall(!small)} aria-label={small ? 'Expand call' : 'Minimise call'}>{small ? <Maximize2 size={18} /> : <Minimize2 size={18} />}</button>
    </header>
    {error && <p className="cc-error" role="status">{error}</p>}
    <div className={`cc-grid n${Math.min(remotes.length + 1, 6)}`}>
      {ringing && !remotes.length ? <div className="cc-ringing"><div className="cc-pulse"><span className="cc-avatar big">{peer?.isGroup ? <Users size={32} /> : initials(title)}</span></div><p>{peer?.isGroup ? 'Everyone in the group is being called' : `Calling ${title}`}</p></div> : null}
      {[room.localParticipant, ...remotes].map(p => <Tile key={p.identity || 'me'} participant={p} revision={revision} kind={call.kind} />)}
    </div>
    <footer className="cc-controls">
      <button className={`cc-round ${mic ? '' : 'off'}`} disabled={status !== 'connected'} onClick={() => void toggle('mic')} aria-label={mic ? 'Mute' : 'Unmute'}>{mic ? <Mic size={20} /> : <MicOff size={20} />}</button>
      <button className={`cc-round ${camera ? '' : 'off'}`} disabled={status !== 'connected'} onClick={() => void toggle('camera')} aria-label={camera ? 'Turn camera off' : 'Turn camera on'}>{camera ? <Video size={20} /> : <VideoOff size={20} />}</button>
      <button className={`cc-round ${screen ? 'on' : ''}`} disabled={status !== 'connected'} onClick={() => void toggle('screen')} aria-label={screen ? 'Stop sharing' : 'Share screen'}><MonitorUp size={20} /></button>
      <button className="cc-round decline" onClick={onLeave} aria-label="Hang up"><PhoneOff size={22} /></button>
    </footer>
  </section>, document.body);
}
