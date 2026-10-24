import { useEffect } from 'react';
import * as arenaApi from '../services/arenaApi';

export const LEAVE_DELAY_MS = 500;

const leaving = new Map<string, ReturnType<typeof setTimeout>>();

export function useBattlePresence(gameId: string, sessionKey: string | null) {
  useEffect(() => {
    if (!gameId || !sessionKey) return;
    const key = `${sessionKey}:${gameId}`;
    clearTimeout(leaving.get(key));
    leaving.delete(key);
    void arenaApi.returnToBattle(gameId, { sessionKey }).catch(() => {});
    return () => {
      leaving.set(key, setTimeout(() => {
        leaving.delete(key);
        void arenaApi.leaveBattle(gameId, { sessionKey }).catch(() => {});
      }, LEAVE_DELAY_MS));
    };
  }, [gameId, sessionKey]);
}
