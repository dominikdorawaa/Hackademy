import { useEffect, useState } from 'react';
import * as arenaApi from '../services/arenaApi';
import type { GameSession } from '../types/api';

export function useArenaSession(gameId: string | null, token: string | null, live: GameSession | null) {
  const [saved, setSaved] = useState<{ token: string; game: GameSession; live: boolean } | null>(null);
  const [gone, setGone] = useState<{ token: string; gameId: string } | null>(null);
  const isLive = live?.id === gameId;

  useEffect(() => {
    if (token && live && live.id === gameId) setSaved({ token, game: live, live: true });
  }, [gameId, token, live]);

  useEffect(() => {
    if (!gameId || !token) return;
    let disposed = false;
    void arenaApi.getGame(gameId, { Authorization: `Bearer ${token}` }).then(async response => {
      if (response.status === 404) {
        if (!disposed) setGone({ token, gameId });
        return;
      }
      if (!response.ok) return;
      const game = await response.json();
      if (disposed) return;
      setGone(null);
      setSaved(previous => previous?.token === token && previous.game.id === gameId && previous.live
        ? previous : { token, game, live: false });
    }).catch(() => {});
    return () => { disposed = true; };
  }, [gameId, token, isLive]);

  if (!token || !gameId) return { session: null, missing: false };
  if (isLive) return { session: live, missing: false };
  if (gone?.token === token && gone.gameId === gameId) return { session: null, missing: true };
  return { session: saved?.token === token && saved.game.id === gameId ? saved.game : null, missing: false };
}
