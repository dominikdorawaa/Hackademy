import { useContext, useLayoutEffect } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { WebSocket } from 'ws';
import { RealtimeProvider, useRealtime } from '../src/context/RealtimeContext';
import { server } from '../src/test/mocks/server';
import type { RealtimeState } from '../src/types/realtime';

const { fixture, TokenContext } = await vi.hoisted(async () => {
  const { readFileSync } = await import('node:fs');
  const { createContext } = await import('react');
  return {
    fixture: (process.env.REALTIME_LOAD === 'true'
      ? JSON.parse(readFileSync('../server/target/realtime-load-fixtures.json', 'utf8')) : { port: 0, users: [] }) as {
      port: number; users: { username: string; token: string; id: number }[];
    },
    TokenContext: createContext(''),
  };
});
vi.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ token: useContext(TokenContext) }) }));
vi.mock('../src/apiConfig', () => ({ default: `http://localhost:${fixture.port}` }));
vi.mock('sockjs-client', () => ({ default: class {
  constructor() { return new WebSocket(`ws://localhost:${fixture.port}/ws/websocket`, { origin: 'https://frontend.example.com' }); }
} }));

it.runIf(process.env.REALTIME_LOAD === 'true')('measures action to React commit with 1000 queued users', async () => {
  server.close();
  const states = new Map<number, RealtimeState>();
  const started = new Map<number, number>();
  const samples: number[] = [];
  const requests: Record<string, number> = {};
  const originalFetch = globalThis.fetch;
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    const key = `${init?.method ?? 'GET'} ${path}`;
    requests[key] = (requests[key] ?? 0) + 1;
    return originalFetch(input, init);
  });
  function Consumer({ id }: { id: number }) {
    const { state } = useRealtime();
    useLayoutEffect(() => {
      if (!state) return;
      states.set(id, state);
      const begin = started.get(id);
      if (begin && (state.friendRequests.length > 0 || state.challenges.length > 0)) {
        samples.push(performance.now() - begin);
        started.delete(id);
      }
    }, [id, state]);
    return <output>{state?.revision ?? 0}:{state?.friendRequests.length ?? 0}:{state?.challenges.length ?? 0}</output>;
  }
  const mounts: ReturnType<typeof render>[] = [];
  try {
    for (let offset = 0; offset < fixture.users.length; offset += 20) {
      await act(async () => {
        for (let index = offset; index < Math.min(offset + 20, fixture.users.length); index++) {
          const user = fixture.users[index];
          mounts.push(render(<TokenContext.Provider value={user.token}><RealtimeProvider><Consumer id={user.id} /></RealtimeProvider></TokenContext.Provider>));
        }
      });
      await waitFor(() => expect(states.size).toBe(Math.min(offset + 20, fixture.users.length)), { timeout: 30000 });
    }
    expect([...states.values()].every(state => state.queued)).toBe(true);
    const beforeIdle = Object.values(requests).reduce((sum, count) => sum + count, 0);
    await new Promise(resolve => setTimeout(resolve, 11000));
    const afterIdle = Object.values(requests).reduce((sum, count) => sum + count, 0);
    expect(afterIdle - beforeIdle).toBe(0);
    const actionStart = performance.now();
    for (let offset = 0; offset < 200; offset += 10) {
      await act(async () => {
        await Promise.all(Array.from({ length: 10 }, async (_, position) => {
          const index = offset + position;
          const sender = fixture.users[index * 2];
          const receiver = fixture.users[index * 2 + 1];
          started.set(receiver.id, performance.now());
          const path = index % 2 === 0 ? `/api/friends/request/${receiver.username}` : '/api/arena/challenge/create';
          const response = await fetch(`http://localhost:${fixture.port}${path}`, {
            method: 'POST', headers: { Authorization: `Bearer ${sender.token}`, 'Content-Type': 'application/json' },
            ...(index % 2 === 0 ? {} : { body: JSON.stringify({ targetUsername: receiver.username, vpnEnabled: false }) }),
          });
          expect(response.ok).toBe(true);
        }));
      });
      await waitFor(() => expect(samples.length).toBe(offset + 10), { timeout: 30000 });
    }
    samples.sort((a, b) => a - b);
    const report = {
      users: states.size, queuedUsers: fixture.users.length, actions: samples.length, actionConcurrency: 10,
      elapsedActionSeconds: (performance.now() - actionStart) / 1000,
      p50Milliseconds: samples[Math.ceil(samples.length * 0.5) - 1],
      p95Milliseconds: samples[Math.ceil(samples.length * 0.95) - 1],
      maxMilliseconds: samples.at(-1), idleObservationSeconds: 11, idleHttpRequests: afterIdle - beforeIdle,
      initialStateRequests: requests['GET /api/realtime/state'], totalHttpRequests: Object.values(requests).reduce((sum, count) => sum + count, 0),
      requests, environment: 'Windows localhost, H2, real STOMP WebSockets, production RealtimeProvider, React DOM in jsdom',
    };
    writeFileSync('../server/target/realtime-load-client.json', JSON.stringify(report, null, 2));
    expect(report.p95Milliseconds).toBeLessThan(500);
  } finally {
    await act(async () => { mounts.forEach(mount => mount.unmount()); });
    writeFileSync('../server/target/realtime-load-done.json', '{}');
  }
}, 300000);
