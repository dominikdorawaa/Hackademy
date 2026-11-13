import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { useAuth } from './AuthContext';
import { getShop } from '../services/shopApi';
import type { ShopState } from '../types/api';

export interface ShopContextValue {
  shop: ShopState | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  refresh: () => void;
  replace: (shop: ShopState) => void;
}

const ShopContext = createContext<ShopContextValue | null>(null);

export function ShopProvider({ children }: PropsWithChildren) {
  const { sessionKey, isAuthenticated } = useAuth();
  const [state, setState] = useState<{ key: string | null; shop: ShopState | null; status: ShopContextValue['status'] }>({ key: null, shop: null, status: 'idle' });
  const [revision, setRevision] = useState(0);
  const active = isAuthenticated && !!sessionKey;

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    setState(current => ({ key: sessionKey, shop: current.key === sessionKey ? current.shop : null, status: 'loading' }));
    getShop({ sessionKey }, controller.signal).then(async response => {
      if (controller.signal.aborted) return;
      if (!response.ok) { setState(current => ({ ...current, status: 'error' })); return; }
      const shop = await response.json();
      if (!controller.signal.aborted) setState({ key: sessionKey, shop, status: 'ready' });
    }).catch(() => { if (!controller.signal.aborted) setState(current => ({ ...current, status: 'error' })); });
    return () => controller.abort();
  }, [active, sessionKey, revision]);

  const refresh = useCallback(() => setRevision(value => value + 1), []);
  const replace = useCallback((shop: ShopState) => setState({ key: sessionKey, shop, status: 'ready' }), [sessionKey]);
  const value = useMemo<ShopContextValue>(() => active && state.key === sessionKey
    ? { shop: state.shop, status: state.status, refresh, replace }
    : { shop: null, status: active ? 'loading' : 'idle', refresh, replace }, [active, state, sessionKey, refresh, replace]);
  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

const OUTSIDE: ShopContextValue = { shop: null, status: 'idle', refresh: () => {}, replace: () => {} };

export function useShop() {
  return useContext(ShopContext) ?? OUTSIDE;
}
