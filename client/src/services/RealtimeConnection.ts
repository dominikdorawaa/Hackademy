import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import API_URL from '../apiConfig';
import type { RealtimeEnvelope, RealtimeState } from '../types/realtime';

export interface RealtimeCallbacks {
  ready: () => void;
  state: (state: RealtimeState) => void;
  disconnected: () => void;
}

export class RealtimeConnection {
  private readonly client: Client;
  private stopped = false;

  constructor(token: string, callbacks: RealtimeCallbacks) {
    this.client = new Client({
      webSocketFactory: () => new SockJS(`${API_URL}/ws`),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      connectionTimeout: 10000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        if (this.stopped) return;
        this.client.subscribe('/user/queue/realtime', message => {
          if (this.stopped) return;
          try {
            const event = JSON.parse(message.body) as RealtimeEnvelope;
            if (event.type === 'READY') callbacks.ready();
            else if (event.type === 'STATE' && event.state) callbacks.state(event.state);
          } catch {
            callbacks.disconnected();
          }
        });
      },
      onWebSocketClose: () => { if (!this.stopped) callbacks.disconnected(); },
      onStompError: () => { if (!this.stopped) callbacks.disconnected(); },
    });
  }

  start() {
    this.client.activate();
  }

  stop() {
    this.stopped = true;
    return this.client.deactivate();
  }
}
