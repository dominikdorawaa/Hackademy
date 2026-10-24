package com.hackademy.server.arena;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public final class BattlePresence {

    public record Verdict(boolean changed, boolean finished, Long winnerId, String reason) {
        static Verdict of(boolean changed) {
            return new Verdict(changed, false, null, null);
        }
    }

    private BattlePresence() {}

    public static Verdict update(GameSession session, Map<Long, ArenaAbsence.Reason> absent, long now) {
        boolean changed = trackAbsences(session, absent, now);
        changed |= trackPause(session, now);
        return judge(session, now, changed);
    }

    private static boolean trackAbsences(GameSession session, Map<Long, ArenaAbsence.Reason> absent, long now) {
        boolean changed = false;
        for (Long player : players(session)) {
            ArenaAbsence.Reason reason = absent.get(player);
            ArenaAbsence current = session.getAbsences().get(player);
            if (reason == null) {
                changed |= session.getAbsences().remove(player) != null;
            } else if (current == null || current.reason() != reason) {
                session.getAbsences().put(player, new ArenaAbsence(reason, current == null ? now : current.since()));
                changed = true;
            }
        }
        return changed;
    }

    private static boolean trackPause(GameSession session, long now) {
        List<Long> waiting = players(session).stream()
                .filter(player -> session.getAbsences().containsKey(player) && !session.getPausesUsed().contains(player))
                .toList();
        ArenaPause pause = session.getPause();
        if (pause == null) {
            if (waiting.isEmpty()) return false;
            BattleEngine.pause(session, waiting, now);
            return true;
        }
        boolean changed = false;
        if (!waiting.isEmpty()) {
            var joined = new ArrayList<>(pause.players());
            joined.addAll(waiting);
            session.getPausesUsed().addAll(waiting);
            pause = new ArenaPause(List.copyOf(joined), pause.startedAt(), pause.endsAt());
            session.setPause(pause);
            changed = true;
        }
        if (now >= pause.endsAt() || pause.players().stream().noneMatch(session.getAbsences()::containsKey)) {
            BattleEngine.resume(session, now);
            changed = true;
        }
        return changed;
    }

    private static Verdict judge(GameSession session, long now, boolean changed) {
        for (Long player : players(session)) {
            ArenaAbsence absence = session.getAbsences().get(player);
            if (absence != null && now - absence.since() >= BattleEngine.DISCONNECT_MILLIS) session.getForfeited().add(player);
        }
        if (session.getForfeited().size() == 2) return new Verdict(true, true, null, "ABANDONED");
        for (Long player : session.getForfeited()) {
            Long rival = session.opponentOf(player);
            if (!session.getAbsences().containsKey(rival)) return new Verdict(true, true, rival, "DISCONNECT");
        }
        return Verdict.of(changed);
    }

    private static List<Long> players(GameSession session) {
        return List.of(session.getPlayer1Id(), session.getPlayer2Id());
    }
}
