import { useEffect } from 'react';
import * as arenaApi from '../services/arenaApi';

export const LEAVE_DELAY_MS = 500;
export const RETRY_MS = 1000;
const RETRIES = 30;

type View = 'return' | 'leave';

const leaving = new Map<string, ReturnType<typeof setTimeout>>();
const wanted = new Map<string, View>();
const delivering = new Set<string>();

async function send(view: View, gameId: string, sessionKey: string) {
  try {
    const call = view === 'leave' ? arenaApi.leaveBattle : arenaApi.returnToBattle;
    return (await call(gameId, { sessionKey })).status < 500;
  } catch {
    return false;
  }
}

async function deliver(key: string, gameId: string, sessionKey: string) {
  delivering.add(key);
  let failures = 0;
  try {
    for (let view = wanted.get(key); view; view = wanted.get(key)) {
      const delivered = await send(view, gameId, sessionKey);
      if (wanted.get(key) !== view) {
        failures = 0;
        continue;
      }
      if (delivered || ++failures > RETRIES) {
        wanted.delete(key);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, RETRY_MS));
    }
  } finally {
    delivering.delete(key);
  }
}

function report(key: string, gameId: string, sessionKey: string, view: View) {
  wanted.set(key, view);
  if (!delivering.has(key)) void deliver(key, gameId, sessionKey);
}

export function useBattlePresence(gameId: string, sessionKey: string | null) {
  useEffect(() => {
    if (!gameId || !sessionKey) return;
    const key = `${sessionKey}:${gameId}`;
    clearTimeout(leaving.get(key));
    leaving.delete(key);
    report(key, gameId, sessionKey, 'return');
    return () => {
      leaving.set(key, setTimeout(() => {
        leaving.delete(key);
        report(key, gameId, sessionKey, 'leave');
      }, LEAVE_DELAY_MS));
    };
  }, [gameId, sessionKey]);
}
