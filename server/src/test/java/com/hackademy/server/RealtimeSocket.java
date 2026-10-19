package com.hackademy.server;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.time.Duration;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

final class RealtimeSocket implements WebSocket.Listener, AutoCloseable {
    record Frame(String text, long receivedAt) {}
    private final BlockingQueue<Frame> messages = new LinkedBlockingQueue<>();
    private final StringBuilder fragments = new StringBuilder();
    private final CompletableFuture<Integer> closedByServer = new CompletableFuture<>();
    private WebSocket socket;

    static RealtimeSocket open(HttpClient client, int port, String token) throws Exception {
        var listener = new RealtimeSocket();
        listener.socket = client.newWebSocketBuilder().connectTimeout(Duration.ofSeconds(30))
                .header("Origin", "https://frontend.example.com").subprotocols("v12.stomp")
                .buildAsync(URI.create("ws://localhost:" + port + "/ws/websocket"), listener)
                .get(30, TimeUnit.SECONDS);
        listener.send("CONNECT\naccept-version:1.2\nhost:localhost\nheart-beat:0,0\nAuthorization:Bearer " + token + "\n\n\0");
        assertTrue(listener.receive().text().startsWith("CONNECTED\n"));
        return listener;
    }

    void subscribe() throws Exception {
        send("SUBSCRIBE\nid:state\ndestination:/user/queue/realtime\n\n\0");
        assertTrue(receive().text().contains("\"type\":\"READY\""));
    }

    void send(String frame) { socket.sendText(frame, true).join(); }

    Frame receive() throws InterruptedException {
        var frame = messages.poll(30, TimeUnit.SECONDS);
        assertNotNull(frame, "Expected a STOMP frame");
        return frame;
    }

    Frame poll(long milliseconds) throws InterruptedException { return messages.poll(milliseconds, TimeUnit.MILLISECONDS); }

    int awaitServerClose() throws Exception { return closedByServer.get(30, TimeUnit.SECONDS); }

    static String body(Frame frame) {
        String text = frame.text();
        return text.substring(text.indexOf("\n\n") + 2, text.indexOf('\0'));
    }

    @Override
    public void onOpen(WebSocket webSocket) { webSocket.request(1); }

    @Override
    public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
        fragments.append(data);
        if (last) {
            String message = fragments.toString();
            fragments.setLength(0);
            if (!message.isBlank()) messages.add(new Frame(message, System.nanoTime()));
        }
        webSocket.request(1);
        return null;
    }

    @Override
    public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
        closedByServer.complete(statusCode);
        return null;
    }

    @Override
    public void onError(WebSocket webSocket, Throwable error) { closedByServer.completeExceptionally(error); }

    @Override
    public void close() { socket.abort(); }
}
