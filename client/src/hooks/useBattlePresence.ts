import { useEffect } from 'react';
import * as arenaApi from '../services/arenaApi';
import { TOO_MANY_REQUESTS, readRetryAfter } from '../services/rateLimit';

export const LEAVE_DELAY_MS = 500;
export const RETRY_MS = 1000;
const RETRIES = 30;
const REQUEST_TIMEOUT = 408;

type View = 'return' | 'leave';

const leaving = new Map<string, ReturnType<typeof setTimeout>>();
const wanted = new Map<string, View>();
const delivering = new Set<string>();

async function send(view: View, gameId: string, sessionKey: string) {
  try {
    const call = view === 'leave' ? arenaApi.leaveBattle : arenaApi.returnToBattle;
    const response = await call(gameId, { sessionKey });
    if (response.status === TOO_MANY_REQUESTS) return Math.max(RETRY_MS, (await readRetryAfter(response)) * 1000);
    return response.status === REQUEST_TIMEOUT || response.status >= 500 ? RETRY_MS : null;
  } catch {
    return RETRY_MS;
  }
}

async function deliver(key: string, gameId: string, sessionKey: string) {
  delivering.add(key);
  let failures = 0;
  try {
    for (let view = wanted.get(key); view; view = wanted.get(key)) {
      const wait = await send(view, gameId, sessionKey);
      if (wanted.get(key) !== view) {
        failures = 0;
        continue;
      }
      if (wait === null || ++failures > RETRIES) {
        wanted.delete(key);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, wait));
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
