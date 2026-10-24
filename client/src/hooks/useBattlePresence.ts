import { useEffect } from 'react';
import * as arenaApi from '../services/arenaApi';

export const LEAVE_DELAY_MS = 500;

const leaving = new Map<string, ReturnType<typeof setTimeout>>();
const sending = new Map<string, Promise<unknown>>();

function inOrder(key: string, call: () => Promise<unknown>) {
  const next = (sending.get(key) ?? Promise.resolve()).then(call).catch(() => {});
  sending.set(key, next);
  void next.then(() => { if (sending.get(key) === next) sending.delete(key); });
}

export function useBattlePresence(gameId: string, sessionKey: string | null) {
  useEffect(() => {
    if (!gameId || !sessionKey) return;
    const key = `${sessionKey}:${gameId}`;
    clearTimeout(leaving.get(key));
    leaving.delete(key);
    inOrder(key, () => arenaApi.returnToBattle(gameId, { sessionKey }));
    return () => {
      leaving.set(key, setTimeout(() => {
        leaving.delete(key);
        inOrder(key, () => arenaApi.leaveBattle(gameId, { sessionKey }));
      }, LEAVE_DELAY_MS));
    };
  }, [gameId, sessionKey]);
}
