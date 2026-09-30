import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Room, RoomEvent, Track, type Participant } from 'livekit-client';
import { supabase } from '../../lib/supabase';
function Tile({participant,revision}:{participant:Participant;revision:number}){
 const video=useRef<HTMLVideoElement>(null),audio=useRef<HTMLAudioElement>(null);
 useEffect(()=>{
  const v=participant.getTrackPublication(Track.Source.ScreenShare)?.track||participant.getTrackPublication(Track.Source.Camera)?.track;
  const a=participant.getTrackPublication(Track.Source.Microphone)?.track;
  const ve=video.current,ae=audio.current;if(v&&ve)v.attach(ve);if(a&&ae&&!participant.isLocal)a.attach(ae);
  return()=>{if(v&&ve)v.detach(ve);if(a&&ae)a.detach(ae);};
 },[participant,revision]);
 return <div className="relative min-h-48 rounded-2xl bg-slate-800 overflow-hidden"><video ref={video} autoPlay playsInline muted={participant.isLocal} className="w-full h-full object-contain"/><audio ref={audio} autoPlay/><p className="absolute bottom-3 left-3 bg-black/70 px-3 py-1 rounded-lg text-white">{participant.isLocal?'You':participant.name||'Teammate'}</p></div>;
}
export function LiveKitGroupCall({conversationId,mode,onClose}:{conversationId:string;mode:'audio'|'video';onClose:()=>void}){
 const [room]=useState(()=>new Room({adaptiveStream:true,dynacast:true}));const [revision,setRevision]=useState(0),[status,setStatus]=useState('Connecting…'),[error,setError]=useState('');
 const [mic,setMic]=useState(true),[camera,setCamera]=useState(mode==='video'),[screen,setScreen]=useState(false);
 useEffect(()=>{
  let cancelled=false;
  const refresh=()=>setRevision(n=>n+1);
  [RoomEvent.ParticipantConnected,RoomEvent.ParticipantDisconnected,RoomEvent.TrackSubscribed,RoomEvent.TrackUnsubscribed,RoomEvent.LocalTrackPublished,RoomEvent.LocalTrackUnpublished,RoomEvent.TrackMuted,RoomEvent.TrackUnmuted].forEach(event=>room.on(event,refresh));
  room.on(RoomEvent.Disconnected,()=>setStatus('Call ended'));
  (async()=>{const {data,error:err}=await supabase.functions.invoke('livekit-token',{body:{conversationId}});if(err||!data?.token)throw Error(data?.error||'Could not authorize the team call');if(cancelled)return;await room.connect(data.url,data.token);if(cancelled){await room.disconnect();return;}await room.localParticipant.setMicrophoneEnabled(true);if(cancelled)return;if(mode==='video')await room.localParticipant.setCameraEnabled(true);if(cancelled){await room.disconnect();return;}setStatus('Connected');refresh();})().catch(e=>{if(!cancelled){setError(e.message);void room.disconnect();}});
  return()=>{cancelled=true;void room.disconnect();room.removeAllListeners();};
 },[room,conversationId,mode]);
 const change=async(kind:'mic'|'camera'|'screen')=>{try{if(kind==='mic'){await room.localParticipant.setMicrophoneEnabled(!mic);setMic(!mic);}if(kind==='camera'){await room.localParticipant.setCameraEnabled(!camera);setCamera(!camera);}if(kind==='screen'){await room.localParticipant.setScreenShareEnabled(!screen);setScreen(!screen);}}catch(e){setError(e instanceof Error?e.message:'Permission was not granted');}};
 return createPortal(<section role="dialog" aria-modal="true" aria-label="Team call" className="fixed inset-0 z-[10000] bg-slate-950 text-white p-5 flex flex-col gap-4"><header className="flex justify-between"><div><h2 className="text-2xl font-bold">Team {mode==='video'?'video':'voice'} room</h2><p>{status} · Members can join using the call button in this conversation.</p></div><button onClick={onClose} className="bg-red-600 px-5 rounded-xl">Leave call</button></header>{error&&<p role="alert" className="text-amber-200">{error}</p>}<div className="flex-1 overflow-auto grid grid-cols-1 md:grid-cols-2 gap-3">{[room.localParticipant,...room.remoteParticipants.values()].map(p=><Tile key={p.identity||'local'} participant={p} revision={revision}/>)}</div><footer className="flex gap-3 justify-center">{(['mic','camera','screen'] as const).map(k=><button key={k} disabled={status!=='Connected'} onClick={()=>void change(k)} className="bg-slate-700 rounded-xl p-3">{k==='mic'?(mic?'Mute microphone':'Unmute microphone'):k==='camera'?(camera?'Stop camera':'Start camera'):(screen?'Stop sharing':'Share screen')}</button>)}</footer></section>,document.body);
}
