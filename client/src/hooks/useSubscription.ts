import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSubscription } from '../services/subscriptionApi';
import type { SubscriptionState } from '../types/api';

export function useSubscription(refreshKey?: unknown) {
  const { sessionKey } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!sessionKey) return;
    const controller = new AbortController();
    getSubscription({ sessionKey }, controller.signal)
      .then(response => { if (!response.ok) throw new Error('subscription'); return response.json(); })
      .then(data => { setSubscription(data); setStatus('ready'); })
      .catch(() => { if (!controller.signal.aborted) setStatus('error'); });
    return () => controller.abort();
  }, [sessionKey, attempt, refreshKey]);

  const refresh = useCallback(() => setAttempt(value => value + 1), []);
  const replace = useCallback((next: SubscriptionState) => { setSubscription(next); setStatus('ready'); }, []);
  return { subscription, status, refresh, replace };
}
