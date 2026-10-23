import { useEffect, useState } from 'react';
import * as arenaApi from '../services/arenaApi';
import type { GameSession } from '../types/api';

export function useArenaSession(gameId: string | null, sessionKey: string | null, live: GameSession | null) {
  const [saved, setSaved] = useState<{ sessionKey: string; game: GameSession; live: boolean } | null>(null);
  const [gone, setGone] = useState<{ sessionKey: string; gameId: string } | null>(null);
  const isLive = live?.id === gameId;

  useEffect(() => {
    if (sessionKey && live && live.id === gameId) setSaved({ sessionKey, game: live, live: true });
  }, [gameId, sessionKey, live]);

  useEffect(() => {
    if (!gameId || !sessionKey || isLive) return;
    let disposed = false;
    void arenaApi.getGame(gameId, { sessionKey }).then(async response => {
      if (response.status === 404) {
        if (!disposed) setGone({ sessionKey, gameId });
        return;
      }
      if (!response.ok) return;
      const game = await response.json();
      if (disposed) return;
      setGone(null);
      setSaved(previous => previous?.sessionKey === sessionKey && previous.game.id === gameId && previous.live
        ? previous : { sessionKey, game, live: false });
    }).catch(() => {});
    return () => { disposed = true; };
  }, [gameId, sessionKey, isLive]);

  if (!sessionKey || !gameId) return { session: null, missing: false };
  if (isLive) return { session: live, missing: false };
  if (gone?.sessionKey === sessionKey && gone.gameId === gameId) return { session: null, missing: true };
  return { session: saved?.sessionKey === sessionKey && saved.game.id === gameId ? saved.game : null, missing: false };
}
