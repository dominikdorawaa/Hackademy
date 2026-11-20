package com.hackademy.server.arena;

import com.hackademy.server.user.UserAvatarRepository;
import com.hackademy.server.user.UserRepository;
import com.hackademy.server.user.UserServiceImpl;
import com.hackademy.server.user.dto.UserAvatarDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.LongStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class ArenaMatchHistoryTest {
    private static final UserAvatarDto BOB = avatar("bluza");
    private static final UserAvatarDto BOB_NOW = avatar("plaszcz");

    private final ArenaMatchRepository matches = mock(ArenaMatchRepository.class);
    private final UserAvatarRepository avatars = mock(UserAvatarRepository.class);
    private final ArenaHistory history = new ArenaHistory(matches, mock(UserRepository.class), mock(UserServiceImpl.class), avatars);
    private GameSession session;

    @BeforeEach
    void startDuel() {
        session = new GameSession();
        session.setId("g1");
        session.setPlayer1Id(1L);
        session.setPlayer1Username("alice");
        session.setPlayer1Elo(1198);
        session.setPlayer2Id(2L);
        session.setPlayer2Username("bob");
        session.setPlayer2Elo(1231);
        session.setPlayer2Avatar(BOB);
        session.setStartTime(LocalDateTime.now().minusSeconds(95));
        BattleEngine.start(session, BattleEngineTest.questions(10), 0, AnswerOrder.correctAt(2));
    }

    private void play(Integer alice, long aliceMillis, Integer bob, long bobMillis) {
        long opened = session.getRoundEndsAt() - BattleEngine.ROUND_MILLIS;
        if (alice != null) BattleEngine.answer(session, 1L, session.getRound(), alice, opened + aliceMillis);
        if (bob != null) BattleEngine.answer(session, 2L, session.getRound(), bob, opened + bobMillis);
        long end = session.getRoundEndsAt();
        boolean over = BattleEngine.resolve(session, end);
        if (!over) BattleEngine.nextRound(session, end + BattleEngine.REVEAL_MILLIS);
    }

    private List<ArenaMatch> recorded() {
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ArenaMatch>> saved = ArgumentCaptor.forClass(List.class);
        verify(matches).saveAll(saved.capture());
        return saved.getValue();
    }

    private static ArenaMatch of(List<ArenaMatch> saved, long userId) {
        return saved.stream().filter(match -> match.getUserId() == userId).findFirst().orElseThrow();
    }

    @Test
    void keepsEveryRoundWithBothAnswersFromEachPlayersSide() {
        play(2, 1_500, 0, 4_000);
        play(1, 9_000, 2, 3_200);
        play(null, 0, null, 0);
        session.setWinnerId(1L);
        session.setFinishReason("SURRENDER");
        session.setPlayer1EloChange(16);
        session.setPlayer2EloChange(-16);

        history.record(session);

        List<ArenaMatch> saved = recorded();
        ArenaMatch alice = of(saved, 1L);
        assertEquals("WIN", alice.getResult());
        assertEquals("SURRENDER", alice.getFinishReason());
        assertEquals(2L, alice.getOpponentId());
        assertFalse(alice.isOpponentBot());
        assertEquals(BOB, alice.getOpponentAvatar());
        assertEquals(1198, alice.getEloBefore());
        assertEquals(1231, alice.getOpponentElo());
        assertEquals(session.getHp().get(1L), alice.getHp());
        assertEquals(session.getHp().get(2L), alice.getOpponentHp());
        assertTrue(alice.getDurationSeconds() >= 95);
        assertEquals(3, alice.getRounds().size());

        ArenaMatchRound first = alice.getRounds().get(0);
        assertEquals(1, first.getRoundNumber());
        assertEquals("Pytanie 1", first.getContent());
        assertEquals("SIECI", first.getCategory());
        assertEquals("MEDIUM", first.getDifficulty());
        assertEquals(2, first.getCorrectAnswer());
        assertEquals("C", first.answers().get(2));
        assertEquals(2, first.getChoice());
        assertEquals(1_500, first.getAnswerMillis());
        assertEquals(0, first.getOpponentChoice());
        assertEquals(4_000, first.getOpponentAnswerMillis());
        assertEquals(100, first.getHpAfter());
        assertEquals(81, first.getOpponentHpAfter());

        ArenaMatchRound mirrored = of(saved, 2L).getRounds().get(1);
        assertEquals(2, mirrored.getChoice());
        assertEquals(3_200, mirrored.getAnswerMillis());
        assertEquals(1, mirrored.getOpponentChoice());
        assertEquals(9_000, mirrored.getOpponentAnswerMillis());
        assertSame(of(saved, 2L), mirrored.getMatch());

        ArenaMatchRound silent = alice.getRounds().get(2);
        assertNull(silent.getChoice());
        assertNull(silent.getAnswerMillis());
        assertNull(silent.getOpponentChoice());
    }

    @Test
    void keepsBotDuelsWithoutLinkingTheBotToAnAccount() {
        session.setBotId(2L);
        session.setWinnerId(2L);
        session.setFinishReason("KNOCKOUT");

        history.record(session);

        List<ArenaMatch> saved = recorded();
        assertEquals(1, saved.size());
        assertTrue(saved.get(0).isOpponentBot());
        assertNull(saved.get(0).getOpponentId());
        assertEquals("bob", saved.get(0).getOpponentName());
        assertEquals(BOB, saved.get(0).getOpponentAvatar());
    }

    @Test
    void recordsADrawAndAnAbsenceForBothSidesButNotAnAbandonedDuel() {
        session.setFinishReason("ROUNDS");
        history.record(session);
        assertEquals(List.of("DRAW", "DRAW"), recorded().stream().map(ArenaMatch::getResult).toList());

        clearInvocations(matches);
        session.setFinishReason("DISCONNECT");
        session.setWinnerId(2L);
        session.setPlayer1EloChange(-15);
        history.record(session);
        List<ArenaMatch> saved = recorded();
        assertEquals("LOSS", of(saved, 1L).getResult());
        assertEquals(-15, of(saved, 1L).getEloChange());
        assertEquals("DISCONNECT", of(saved, 2L).getFinishReason());

        clearInvocations(matches);
        session.setFinishReason("ABANDONED");
        history.record(session);
        verify(matches, never()).saveAll(any());
    }

    @Test
    void listsOnePageNewestFirstAndSaysWhetherMoreRemain() {
        List<ArenaMatch> stored = LongStream.rangeClosed(1, 3).mapToObj(id -> match(id, 2L)).toList();
        when(matches.findByUserIdOrderByFinishedAtDescIdDesc(eq(1L), any(Pageable.class))).thenReturn(stored);
        when(avatars.findDtosByUserIds(anyCollection())).thenReturn(Map.of(2L, BOB_NOW));

        var page = history.page(1L, 0, 2);

        assertTrue(page.hasMore());
        assertEquals(List.of(1L, 2L), page.items().stream().map(item -> item.id()).toList());
        assertEquals(BOB_NOW, page.items().get(0).opponentAvatar());
        ArgumentCaptor<Pageable> asked = ArgumentCaptor.forClass(Pageable.class);
        verify(matches).findByUserIdOrderByFinishedAtDescIdDesc(eq(1L), asked.capture());
        assertEquals(3, asked.getValue().getPageSize());
    }

    @Test
    void capsThePageSizeAndFallsBackToTheSavedAvatarWhenTheOpponentIsGone() {
        when(matches.findByUserIdOrderByFinishedAtDescIdDesc(eq(1L), any(Pageable.class))).thenReturn(List.of(match(7L, null)));
        when(avatars.findDtosByUserIds(anyCollection())).thenReturn(Map.of());

        var page = history.page(1L, -3, 500);

        assertFalse(page.hasMore());
        assertEquals(BOB, page.items().get(0).opponentAvatar());
        ArgumentCaptor<Pageable> asked = ArgumentCaptor.forClass(Pageable.class);
        verify(matches).findByUserIdOrderByFinishedAtDescIdDesc(eq(1L), asked.capture());
        assertEquals(0, asked.getValue().getPageNumber());
        assertEquals(ArenaHistory.MAX_PAGE_SIZE + 1, asked.getValue().getPageSize());
    }

    @Test
    void showsTheDetailsOnlyToThePlayerWhoFoughtTheDuel() {
        ArenaMatch match = match(5L, 2L);
        match.setFinishReason("ROUNDS");
        match.setHp(12);
        match.setOpponentHp(30);
        PlayedRound played = new PlayedRound(1, QuestionSnapshot.shuffled(BattleEngineTest.questions(1).get(0), AnswerOrder.correctAt(1)),
                Map.of(1L, 3, 2L, 1), Map.of(1L, 8_700L, 2L, 3_200L), Map.of(1L, 83, 2L, 100));
        match.getRounds().add(ArenaMatchRound.of(match, played, 1L, 2L));
        when(matches.findByIdAndUserId(5L, 1L)).thenReturn(Optional.of(match));
        when(matches.findByIdAndUserId(5L, 2L)).thenReturn(Optional.empty());
        when(avatars.findDtosByUserIds(List.of(2L))).thenReturn(Map.of(2L, BOB_NOW));

        var detail = history.detail(1L, 5L).orElseThrow();

        assertEquals("ROUNDS", detail.finishReason());
        assertEquals(12, detail.hp());
        assertEquals(30, detail.opponentHp());
        assertEquals(BOB_NOW, detail.summary().opponentAvatar());
        var round = detail.rounds().get(0);
        assertEquals(List.of("A", "C", "B", "D"), round.answers());
        assertEquals(1, round.correctAnswer());
        assertEquals(3, round.choice());
        assertEquals(8_700, round.answerMillis());
        assertEquals(1, round.opponentChoice());
        assertEquals(83, round.hpAfter());
        assertTrue(history.detail(2L, 5L).isEmpty());
    }

    @Test
    void findsTheDuelThatJustEndedByItsGame() {
        ArenaMatch match = match(9L, 2L);
        when(matches.findByGameIdAndUserId("g1", 1L)).thenReturn(Optional.of(match));
        when(matches.findByGameIdAndUserId("g1", 3L)).thenReturn(Optional.empty());
        when(avatars.findDtosByUserIds(List.of(2L))).thenReturn(Map.of());

        assertEquals(9L, history.detailOfGame(1L, "g1").orElseThrow().summary().id());
        assertTrue(history.detailOfGame(3L, "g1").isEmpty());
    }

    private static ArenaMatch match(long id, Long opponent) {
        ArenaMatch match = new ArenaMatch();
        match.setId(id);
        match.setUserId(1L);
        match.setOpponentId(opponent);
        match.setOpponentName("bob");
        match.setOpponentAvatar(BOB);
        match.setResult("LOSS");
        match.setEloChange(-14);
        match.setFinishedAt(LocalDateTime.of(2026, 11, 18, 21, 14));
        return match;
    }

    private static UserAvatarDto avatar(String outfit) {
        return new UserAvatarDto(outfit, "krotkie", "brak", "jasna", "czarne", "granatowy", "grafitowy", "bialy", "czerwony", null, null, null);
    }
}
