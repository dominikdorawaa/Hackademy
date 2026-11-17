import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getFriendsOutOfGames } from '../services/subscriptionApi';

export function useFriendsOutOfGames(friendIds: readonly number[]) {
  const { sessionKey } = useAuth();
  const [outOfGames, setOutOfGames] = useState<ReadonlySet<number>>(() => new Set());
  const [attempt, setAttempt] = useState(0);
  const key = friendIds.join(',');

  useEffect(() => {
    if (!sessionKey || !key) return;
    const controller = new AbortController();
    getFriendsOutOfGames({ sessionKey }, controller.signal)
      .then(response => { if (!response.ok) throw new Error('friends'); return response.json(); })
      .then(ids => setOutOfGames(new Set(ids)))
      .catch(() => undefined);
    return () => controller.abort();
  }, [sessionKey, key, attempt]);

  const refresh = useCallback(() => setAttempt(value => value + 1), []);
  return { outOfGames, refresh };
}
