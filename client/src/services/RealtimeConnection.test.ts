import { describe, expect, it, vi } from 'vitest';
import type { IFrame, IMessage, StompConfig } from '@stomp/stompjs';
import { RealtimeConnection } from './RealtimeConnection';

const clients = vi.hoisted(() => [] as {
  config: StompConfig; subscribe: ReturnType<typeof vi.fn>; activate: ReturnType<typeof vi.fn>; deactivate: ReturnType<typeof vi.fn>;
}[]);
vi.mock('@stomp/stompjs', () => ({ Client: class {
  subscribe = vi.fn(); activate = vi.fn(); deactivate = vi.fn();
  constructor(public config: StompConfig) { clients.push(this); }
} }));
vi.mock('sockjs-client', () => ({ default: class {} }));

describe('realtime transport', () => {
  it('authenticates and subscribes again on every connection without publishing client events', async () => {
    const callbacks = { ready: vi.fn(), state: vi.fn(), disconnected: vi.fn() };
    const connection = new RealtimeConnection('token', callbacks);
    const client = clients.at(-1)!;
    connection.start();
    expect(client.activate).toHaveBeenCalledOnce();
    expect(client.config.connectHeaders).toEqual({ Authorization: 'Bearer token' });
    expect(client.config.reconnectDelay).toBe(5000);
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
    receive({ body: JSON.stringify({ type: 'STATE', state }) } as IMessage);
    client.config.onConnect?.({} as IFrame);
    client.config.onWebSocketClose?.({} as CloseEvent);
    expect(callbacks.state).toHaveBeenCalledOnce();
    expect(client.subscribe).toHaveBeenCalledTimes(2);
    expect(callbacks.disconnected).toHaveBeenCalledOnce();
  });
});
