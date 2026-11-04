package com.hackademy.server.room;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.junit.jupiter.api.Assertions.assertEquals;

class RoomScoringTest {

    @ParameterizedTest(name = "{1} hints on {0} XP leave {2} XP")
    @CsvSource({"100,0,100", "100,1,90", "100,4,60", "100,5,50", "100,6,50", "100,100,50", "55,1,49", "15,5,7", "0,3,0"})
    void eachHintTakesATenthOfTheRoomUpToHalf(int points, long hints, int expected) {
        assertEquals(expected, RoomScoring.pointsAfterHints(points, hints));
    }
}
