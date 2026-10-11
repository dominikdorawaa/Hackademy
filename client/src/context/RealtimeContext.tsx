import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { useAuth } from './AuthContext';
import { RealtimeConnection } from '../services/RealtimeConnection';
import { request } from '../services/http';
import type { RealtimeState } from '../types/realtime';

interface RealtimeContextValue {
  state: RealtimeState | null;
  connected: boolean;
  synchronize: () => Promise<void>;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  state: null, connected: false, synchronize: async () => {},
});

export function RealtimeProvider({ children }: PropsWithChildren) {
  const { token } = useAuth();
  const [session, setSession] = useState<{ token: string | null; state: RealtimeState | null; connected: boolean }>({
    token: null, state: null, connected: false,
  });
  const synchronizeRef = useRef<() => Promise<void>>(async () => {});
  const synchronize = useCallback(() => synchronizeRef.current(), []);

  useEffect(() => {
    if (!token) return;
    let disposed = false;
    let ready = false;
    let latest: RealtimeState | null = null;
    let pending: Promise<void> | null = null;
    let controller = new AbortController();
    let retry: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const apply = (state: RealtimeState) => {
      if (disposed) return;
      if (latest?.streamId === state.streamId && latest.revision >= state.revision) return;
      latest = state;
      setSession({ token, state, connected: ready });
    };
    const sync = (): Promise<void> => {
      if (disposed || !ready) return Promise.resolve();
      if (pending) return pending;
      clearTimeout(retry);
      const currentController = controller;
      pending = (async () => {
        try {
          const response = await request<RealtimeState>('/api/realtime/state', {
            method: 'GET', headers: { Authorization: `Bearer ${token}` }, signal: currentController.signal,
          });
          if (!response.ok) throw new Error('Realtime synchronization failed');
          const state = await response.json();
          if (!currentController.signal.aborted) apply(state);
          failures = 0;
        } catch {
          if (!disposed && !currentController.signal.aborted && ready && failures < 5) {
            failures += 1;
            retry = setTimeout(() => { void sync(); }, Math.min(1000 * 2 ** failures, 30000));
          }
        } finally {
          if (controller === currentController) pending = null;
        }
      })();
      return pending;
    };
    synchronizeRef.current = sync;
    const connection = new RealtimeConnection(token, {
      ready: () => {
        if (disposed) return;
        controller.abort();
        controller = new AbortController();
        pending = null;
        ready = true;
        failures = 0;
        setSession(previous => ({ token, state: previous.token === token ? previous.state : null, connected: true }));
        void sync();
      },
      state: apply,
      disconnected: () => {
        if (disposed) return;
        ready = false;
        controller.abort();
        clearTimeout(retry);
        setSession(previous => ({ ...previous, connected: false }));
      },
    });
    const resume = () => { if (document.visibilityState === 'visible') void sync(); };
    document.addEventListener('visibilitychange', resume);
    connection.start();
    return () => {
      disposed = true;
      ready = false;
      controller.abort();
      clearTimeout(retry);
      synchronizeRef.current = async () => {};
      document.removeEventListener('visibilitychange', resume);
      void connection.stop();
    };
  }, [token]);

  const value: RealtimeContextValue = {
    state: session.token === token && token ? session.state : null,
    connected: session.token === token && !!token && session.connected,
    synchronize,
  };
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
