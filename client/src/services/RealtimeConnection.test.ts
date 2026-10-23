import { registerSession } from './http';
import { describe, expect, it, vi } from 'vitest';
import type { IFrame, IMessage, StompConfig } from '@stomp/stompjs';
import { RealtimeConnection } from './RealtimeConnection';

const clients = vi.hoisted(() => [] as {
  config: StompConfig; subscribe: ReturnType<typeof vi.fn>; activate: ReturnType<typeof vi.fn>; deactivate: ReturnType<typeof vi.fn>;
}[]);
vi.mock('@stomp/stompjs', () => ({ TickerStrategy: { Worker: 'worker' }, ReconnectionTimeMode: { EXPONENTIAL: 1 }, Client: class {
  subscribe = vi.fn(); activate = vi.fn(); deactivate = vi.fn();
  constructor(public config: StompConfig) { clients.push(this); }
} }));
vi.mock('sockjs-client', () => ({ default: class {} }));

describe('realtime transport', () => {
  it('authenticates and subscribes again on every connection without publishing client events', async () => {
    const callbacks = { ready: vi.fn(), state: vi.fn(), disconnected: vi.fn() };
    const getToken = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');
    const cleanup = registerSession({ sessionKey: 'sessionKey', getToken, expired: vi.fn() });
    const connection = new RealtimeConnection('sessionKey', callbacks);
    const client = clients.at(-1)!;
    connection.start();
    expect(client.activate).toHaveBeenCalledOnce();
    await client.config.beforeConnect?.(client as never);
    expect((client as unknown as { connectHeaders: unknown }).connectHeaders).toEqual({ Authorization: 'Bearer first' });
    await client.config.beforeConnect?.(client as never);
    expect((client as unknown as { connectHeaders: unknown }).connectHeaders).toEqual({ Authorization: 'Bearer second' });
    cleanup();
    expect(client.config.reconnectDelay).toBeGreaterThanOrEqual(1000);
    expect(client.config.reconnectDelay).toBeLessThan(5000);
    expect(client.config.reconnectTimeMode).toBe(1);
    expect(client.config.heartbeatStrategy).toBe('worker');
    expect(client.config.heartbeatIncoming).toBe(10_000);
    expect(client.config.heartbeatToleranceMultiplier).toBe(7);
    expect(Math.max(client.config.heartbeatIncoming!, 10_000)).toBeLessThan(55_000);
    expect(client.config.discardWebsocketOnCommFailure).toBe(true);
    client.config.onConnect?.({} as IFrame);
    expect(client.subscribe.mock.calls[0][0]).toBe('/user/queue/realtime');
    const receive = client.subscribe.mock.calls[0][1] as (message: IMessage) => void;
    receive({ body: JSON.stringify({ type: 'READY', state: null }) } as IMessage);
    expect(callbacks.ready).toHaveBeenCalledOnce();
    const state = { streamId: 'server', revision: 2 };
    receive({ body: JSON.stringify({ type: 'STATE', state }) } as IMessage);
    expect(callbacks.state).toHaveBeenCalledWith(state);
    client.config.onWebSocketClose?.({} as CloseEvent);
    expect(callbacks.disconnected).toHaveBeenCalledOnce();
    client.config.onConnect?.({} as IFrame);
    expect(client.subscribe).toHaveBeenCalledTimes(2);
    await connection.stop();
    expect(client.deactivate).toHaveBeenCalledOnce();
    expect(client.deactivate).toHaveBeenCalledWith({ force: true });
    receive({ body: JSON.stringify({ type: 'STATE', state }) } as IMessage);
    client.config.onConnect?.({} as IFrame);
    client.config.onWebSocketClose?.({} as CloseEvent);
    expect(callbacks.state).toHaveBeenCalledOnce();
    expect(client.subscribe).toHaveBeenCalledTimes(2);
    expect(callbacks.disconnected).toHaveBeenCalledOnce();
  });
  it('stops reconnecting when the session cannot provide credentials', async () => {
    const callbacks = { ready: vi.fn(), state: vi.fn(), disconnected: vi.fn() };
    new RealtimeConnection('missing-session', callbacks);
    const client = clients.at(-1)!;
    await client.config.beforeConnect?.(client as never);
    expect(callbacks.disconnected).toHaveBeenCalledOnce();
    expect(client.deactivate).toHaveBeenCalledOnce();
  });

  it('reports malformed server frames and broker authentication errors', () => {
    const callbacks = { ready: vi.fn(), state: vi.fn(), disconnected: vi.fn() };
    new RealtimeConnection('sessionKey', callbacks);
    const client = clients.at(-1)!;
    client.config.onConnect?.({} as IFrame);
    const receive = client.subscribe.mock.calls[0][1] as (message: IMessage) => void;
    receive({ body: 'broken JSON' } as IMessage);
    client.config.onStompError?.({} as IFrame);
    expect(callbacks.disconnected).toHaveBeenCalledTimes(2);
  });

});
