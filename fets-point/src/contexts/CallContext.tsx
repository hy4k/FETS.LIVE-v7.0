import { createContext, useContext, type ReactNode } from 'react';
import { toast } from 'react-hot-toast';
import { CallCenterProvider, useCallCenter } from '../components/Chat/calls/CallCenter';
import { callApi } from '../components/Chat/calls/chat-calls';

/**
 * The app's calls. Every call button, old or new, goes through the call
 * center: the conversation's members are rung, they answer or decline, and
 * the media runs on LiveKit. (The earlier peer-to-peer calls never rang the
 * other side; they only met if both pressed call at once.)
 */
interface CallContextType {
  /** Call a person (or the first of several) directly. */
  startCall: (targetUserIds: string | string[], type?: 'video' | 'audio') => Promise<void>;
}
const CallContext = createContext<CallContextType | undefined>(undefined);

function Bridge({ children }: { children: ReactNode }) {
  const { call, me } = useCallCenter();
  const startCall = async (targets: string | string[], type: 'video' | 'audio' = 'video') => {
    const target = Array.isArray(targets) ? targets[0] : targets;
    if (!target || !me) return;
    try { await call(await callApi.directWith(me, target), type); } catch (e) { toast.error(e instanceof Error ? e.message : 'The call could not be placed'); }
  };
  return <CallContext.Provider value={{ startCall }}>{children}</CallContext.Provider>;
}

export function CallProvider({ children }: { children: ReactNode }) {
  return <CallCenterProvider><Bridge>{children}</Bridge></CallCenterProvider>;
}

export function useGlobalCall() {
  const context = useContext(CallContext);
  if (context === undefined) throw new Error('useGlobalCall must be used within a CallProvider');
  return context;
}
