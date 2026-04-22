import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import API_URL from '../apiConfig';

class WebSocketService {
    constructor() {
        this.client = null;
        this.subscriptions = new Map();
        this.connectionPromise = null;
    }

    connect(token) {
        if (this.client && this.client.active) {
            return Promise.resolve();
        }

        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        this.connectionPromise = new Promise((resolve, reject) => {
            const socketUrl = `${API_URL}/ws`;
            
            this.client = new Client({
                webSocketFactory: () => new SockJS(socketUrl),
                connectHeaders: {
                    Authorization: `Bearer ${token}`
                },
                debug: (str) => {
                    // console.log(str);
                },
                reconnectDelay: 5000,
                heartbeatIncoming: 4000,
                heartbeatOutgoing: 4000,
                onConnect: () => {
                    console.log('Connected to WebSocket');
                    resolve();
                },
                onStompError: (frame) => {
                    console.error('Broker reported error: ' + frame.headers['message']);
                    console.error('Additional details: ' + frame.body);
                    reject(frame);
                },
                onWebSocketClose: () => {
                    console.log('WebSocket connection closed');
                    this.connectionPromise = null;
                }
            });

            this.client.activate();
        });

        return this.connectionPromise;
    }

    subscribe(destination, callback) {
        if (!this.client || !this.client.active) {
            console.error('WebSocket is not connected. Call connect() first.');
            return null;
        }

        const subscription = this.client.subscribe(destination, (message) => {
            try {
                const parsedBody = JSON.parse(message.body);
                callback(parsedBody);
            } catch (e) {
                console.error('Error parsing message body:', e);
                callback(message.body);
            }
        });

        const subId = Math.random().toString(36).substr(2, 9);
        this.subscriptions.set(subId, subscription);
        return subId;
    }

    unsubscribe(subId) {
        const subscription = this.subscriptions.get(subId);
        if (subscription) {
            subscription.unsubscribe();
            this.subscriptions.delete(subId);
        }
    }

    send(destination, body = {}) {
        if (!this.client || !this.client.active) {
            console.error('WebSocket is not connected');
            return;
        }

        this.client.publish({
            destination: destination,
            body: JSON.stringify(body)
        });
    }

    disconnect() {
        if (this.client) {
            this.client.deactivate();
            this.client = null;
            this.subscriptions.clear();
            this.connectionPromise = null;
            console.log('Disconnected from WebSocket');
        }
    }
}

const webSocketService = new WebSocketService();
export default webSocketService;
