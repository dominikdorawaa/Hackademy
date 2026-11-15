package com.hackademy.server.room;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RoomDescriptionTest {

    private static RoomDescription.Merged merge(String shortDescription, String description) {
        return RoomDescription.merge(shortDescription, description);
    }

    @Test
    void keepsADescriptionThatFitsAndMovesNothing() {
        assertEquals(new RoomDescription.Merged("", ""), merge(null, null));
        assertEquals(new RoomDescription.Merged("", ""), merge(" ", " \n\t "));
        assertEquals(new RoomDescription.Merged("Opis", ""), merge(null, "  Opis \n"));
        assertEquals(new RoomDescription.Merged("z".repeat(200), ""), merge("", "z".repeat(200)));
    }

    @Test
    void takesTheShortDescriptionAndMovesTheOldDescriptionToTheFirstTask() {
        assertEquals(new RoomDescription.Merged("Twoje pierwsze polecenie", "<p>Przeczytaj materiał i odpowiedz na pytanie.</p>"),
                merge(" Twoje pierwsze polecenie ", "Przeczytaj materiał i odpowiedz na pytanie."));
        assertEquals(new RoomDescription.Merged("Sam krótki", ""), merge("Sam krótki", ""));
        assertEquals(new RoomDescription.Merged("Ten sam", ""), merge("Ten sam", " Ten sam "));
    }

    @Test
    void cutsALongDescriptionAtTheLastSentenceThatFits() {
        String head = "Pierwsze zdanie. " + "a".repeat(150) + "!";
        var merged = merge(null, head + " Trzecie <b>zdanie</b> & **markdown**.\r\nDruga linia.\rTrzecia linia.");
        assertEquals(head, merged.description());
        assertEquals("<p>Trzecie &lt;b&gt;zdanie&lt;/b&gt; &amp; **markdown**.<br>Druga linia.<br>Trzecia linia.</p>", merged.movedContent());
    }

    @Test
    void cutsAtALineBreakWhenItIsTheLastBoundary() {
        String head = "Bez kropki " + "b".repeat(150);
        var merged = merge(null, head + "  \nDruga linia " + "c".repeat(60));
        assertEquals(head, merged.description());
        assertEquals("<p>Druga linia " + "c".repeat(60) + "</p>", merged.movedContent());
    }

    @Test
    void cutsBetweenWordsWhenNoSentenceEndsInTheLimit() {
        String text = "słowo ".repeat(45) + "koniec";
        var merged = merge(null, text);
        assertEquals("słowo ".repeat(33).trim(), merged.description());
        assertEquals("<p>" + "słowo ".repeat(12) + "koniec</p>", merged.movedContent());
        assertEquals("a".repeat(200), merge(null, "a".repeat(200) + " ogon").description());
        assertEquals("a".repeat(199) + ".", merge(null, "a".repeat(199) + ". ogon").description());
    }

    @Test
    void cutsInsideAWordAtTheLimitWhenThereIsNoSpace() {
        var merged = merge(null, "x".repeat(250));
        assertEquals("x".repeat(200), merged.description());
        assertEquals("<p>" + "x".repeat(50) + "</p>", merged.movedContent());
    }

    @Test
    void neverSplitsACharacterMadeOfTwoUnits() {
        var merged = merge(null, "y".repeat(199) + "😀ogon");
        assertEquals("y".repeat(199), merged.description());
        assertEquals("<p>😀ogon</p>", merged.movedContent());
        assertEquals("y".repeat(198) + "😀", merge(null, "y".repeat(198) + "😀ogon").description());
    }

    @Test
    void movesTheRestOfAnOverlongShortDescriptionBeforeTheOldDescription() {
        var merged = merge("k".repeat(230), "Stary opis");
        assertEquals("k".repeat(200), merged.description());
        assertEquals("<p>" + "k".repeat(30) + "</p><p>Stary opis</p>", merged.movedContent());
    }

    @Test
    void keepsEveryCharacterOfALongDescription() {
        String text = ("Zdanie numer jeden ma kilka słów. Drugie zdanie? Tak! ").repeat(8).trim();
        var merged = merge(null, text);
        assertTrue(merged.description().length() <= RoomDescription.MAX_LENGTH);
        String moved = merged.movedContent().substring(3, merged.movedContent().length() - 4);
        assertEquals(text, merged.description() + " " + moved);
    }
}
