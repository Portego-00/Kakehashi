import { useIsFocused } from '@react-navigation/native';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Keyboard } from 'react-native';
import { useConversation, type ConversationState } from './use-conversation';

export interface ConversationRuntime {
  controller: ConversationState;
  exiting: boolean;
  exit: (() => Promise<void>) | undefined;
  exitError: string | null;
  clearExitError(): void;
}
const Runtime = createContext<ConversationRuntime | null>(null);

/** Owned by the parent stack screen, so changing a child tab never stops a call. */
export function ConversationRuntimeProvider({ accountId, onExit, children }: { accountId: string; onExit?: () => void | Promise<void>; children: React.ReactNode }) {
  const focused = useIsFocused();
  const [applicationState, setApplicationState] = useState(AppState.currentState);
  const [exiting, setExiting] = useState(false);
  const [exitError, setExitError] = useState<string | null>(null);
  const exitInProgress = useRef(false);
  const mounted = useRef(true);
  const c = useConversation({ accountId, active: focused && applicationState !== 'background' && !exiting });
  const stop = c.stop;
  useEffect(() => {
    mounted.current = true;
    const listener = AppState.addEventListener('change', setApplicationState);
    return () => { mounted.current = false; listener.remove(); Keyboard.dismiss(); };
  }, []);
  const exit = useCallback(async () => {
    if (!onExit || exitInProgress.current) return;
    Keyboard.dismiss(); exitInProgress.current = true; setExiting(true); setExitError(null);
    try { await stop('Returned to Home'); }
    catch { /* Controller unmount also disconnects if graceful closing fails. */ }
    if (!mounted.current) return;
    try { await onExit(); }
    catch (error) { if (mounted.current) setExitError(error instanceof Error ? error.message : 'Could not return to Home. Please try again.'); }
    finally { if (mounted.current) { exitInProgress.current = false; setExiting(false); } }
  }, [stop, onExit]);
  const clearExitError = useCallback(() => setExitError(null), []);
  return <Runtime.Provider value={{ controller: c, exiting, exit: onExit ? exit : undefined, exitError, clearExitError }}>{children}</Runtime.Provider>;
}

export const useConversationRuntime = () => useContext(Runtime);
