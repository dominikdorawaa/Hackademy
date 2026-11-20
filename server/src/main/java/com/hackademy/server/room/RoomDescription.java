package com.hackademy.server.room;

import java.util.List;
import java.util.regex.Pattern;

public final class RoomDescription {
    public static final int MAX_LENGTH = 200;
    private static final String SPACE = " \\t\\n\\r\\f\\u000B";
    private static final Pattern EDGES = Pattern.compile("^[" + SPACE + "]+|[" + SPACE + "]+$");
    private static final List<Pattern> BOUNDARIES = List.of(
            Pattern.compile("^(.*(?:[.!?](?=[" + SPACE + "])|[^" + SPACE + "](?=[ \\t]*[\\r\\n])))", Pattern.DOTALL),
            Pattern.compile("^(.*[^" + SPACE + "])(?=[" + SPACE + "])", Pattern.DOTALL));

    private RoomDescription() {}

    public record Merged(String description, String movedContent) {}

    public static Merged merge(String shortDescription, String description) {
        String shortText = trim(shortDescription);
        String fullText = trim(description);
        String lead = shortText.isEmpty() ? fullText : shortText;
        String head = head(lead);
        String rest = trim(lead.substring(head.length()));
        var moved = new StringBuilder();
        if (!rest.isEmpty()) moved.append(paragraph(rest));
        if (!shortText.isEmpty() && !fullText.isEmpty() && !fullText.equals(shortText)) moved.append(paragraph(fullText));
        return new Merged(head, moved.toString());
    }

    static String head(String value) {
        if (value.length() <= MAX_LENGTH) return value;
        String window = prefix(value, MAX_LENGTH + 1);
        for (var boundary : BOUNDARIES) {
            var matcher = boundary.matcher(window);
            if (matcher.find()) return matcher.group(1);
        }
        return prefix(value, MAX_LENGTH);
    }

    static String paragraph(String value) {
        return "<p>" + value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\r\n", "\n").replace("\r", "\n").replace("\n", "<br>") + "</p>";
    }

    private static String prefix(String value, int units) {
        int end = Math.min(units, value.length());
        if (end < value.length() && Character.isHighSurrogate(value.charAt(end - 1))) end--;
        return value.substring(0, end);
    }

    private static String trim(String value) {
        return value == null ? "" : EDGES.matcher(value).replaceAll("");
    }
}
