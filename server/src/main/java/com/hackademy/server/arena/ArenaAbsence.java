package com.hackademy.server.arena;

public record ArenaAbsence(Reason reason, long since) {
    public enum Reason { LEFT, DISCONNECTED }
}
