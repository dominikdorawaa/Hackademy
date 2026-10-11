import { useEffect, useState } from 'react';
import * as arenaApi from '../services/arenaApi';
import type { GameSession } from '../types/api';

export function useArenaSession(gameId: string | null, token: string | null, live: GameSession | null) {
  const [saved, setSaved] = useState<{ token: string; game: GameSession; live: boolean } | null>(null);

  useEffect(() => {
    if (token && live && live.id === gameId) setSaved({ token, game: live, live: true });
  }, [gameId, token, live]);

  useEffect(() => {
    if (!gameId || !token) return;
    let disposed = false;
    void arenaApi.getGame(gameId, { Authorization: `Bearer ${token}` }).then(async response => {
      if (!response.ok) return;
      const game = await response.json();
      if (!disposed) setSaved(previous => previous?.token === token && previous.game.id === gameId && previous.live
        ? previous : { token, game, live: false });
    }).catch(() => {});
    return () => { disposed = true; };
  }, [gameId, token]);

  if (!token || !gameId) return null;
  if (live?.id === gameId) return live;
  return saved?.token === token && saved.game.id === gameId ? saved.game : null;
}
