package com.hackademy.server.content;

import tools.jackson.databind.JsonNode;
import com.hackademy.server.room.TaskContentSanitizer;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

public final class ContentImportValidation {
    private final ContentValidation errors = new ContentValidation();
    private int roomCount;

    public void validateCtfRooms(JsonNode root, Set<String> existingTitles) {
        if (!object(root, "plik", Set.of("rooms"))) {
            errors.finish();
            return;
        }
        var rooms = array(root, "rooms", "plik", 500, true);
        var titles = new HashSet<String>();
        for (int r = 0; r < rooms.size(); r++) {
            var item = rooms.get(r);
            String key = "pokój " + (r + 1);
            room(item, key, titles, true);
            if (item.path("title").isTextual() && existingTitles.contains(item.path("title").asText().trim())) {
                errors.problem(key + ": title", "Pokój CTF o tym tytule już istnieje w bazie");
            }
        }
        errors.finish();
    }

    public void validateRooms(JsonNode root, Set<String> existingTitles, int existingCount) {
        if (!object(root, "plik", Set.of("rooms"))) {
            errors.finish();
            return;
        }
        var rooms = array(root, "rooms", "plik", 500, true);
        if (existingCount + rooms.size() > 500) errors.problem("plik: rooms", "Rozdział może zawierać maksymalnie 500 pokoi, łącznie z istniejącymi");
        var titles = new HashSet<>(existingTitles);
        for (int r = 0; r < rooms.size(); r++) room(rooms.get(r), "pokój " + (r + 1), titles);
        errors.finish();
    }

    public void validate(JsonNode root) {
        if (!object(root, "plik", Set.of("title", "description", "unlockMode", "chapters"))) {
            errors.finish();
            return;
        }
        text(root, "title", "ścieżka", 120, true);
        text(root, "description", "ścieżka", 20000, true);
        choice(root, "unlockMode", "ścieżka", Set.of("OPEN", "CHAPTER", "ROOM"), false);
        var chapters = array(root, "chapters", "ścieżka", 100, true);
        for (int c = 0; c < chapters.size(); c++) {
            var chapter = chapters.get(c);
            String key = "rozdział " + (c + 1);
            if (!object(chapter, key, Set.of("title", "rooms"))) continue;
            text(chapter, "title", key, 120, true);
            var rooms = array(chapter, "rooms", key, 500, true);
            roomCount += rooms.size();
            var titles = new HashSet<String>();
            for (int r = 0; r < rooms.size(); r++) room(rooms.get(r), key + ", pokój " + (r + 1), titles);
        }
        if (roomCount > 500) errors.problem("ścieżka: chapters", "Maksymalnie 500 pokoi w całej ścieżce");
        errors.finish();
    }

    private void room(JsonNode room, String key, Set<String> titles) {
        room(room, key, titles, false);
    }

    private void room(JsonNode room, String key, Set<String> titles, boolean ctf) {
        var fields = ctf ? Set.of("title", "description", "shortDescription", "difficulty", "category", "flag", "requiresVpn", "hints")
                : Set.of("title", "description", "shortDescription", "difficulty", "category", "points", "flag", "requiresVpn", "hints", "tasks");
        if (!object(room, key, fields)) return;
        String title = text(room, "title", key, 255, true).trim();
        if (!title.isEmpty() && !titles.add(title)) errors.problem(key + ": title", ctf ? "Tytuł pokoju powtarza się w pliku" : "Tytuł pokoju powtarza się w tym rozdziale");
        if (Set.of("tutorial vm", "tutorial vpn").contains(title.toLowerCase(Locale.ROOT))) errors.problem(key + ": title", "Tytuł zarezerwowany dla samouczka");
        text(room, "description", key, 20000, true);
        text(room, "shortDescription", key, 100, false);
        text(room, "category", key, 255, true);
        choice(room, "difficulty", key, Set.of("EASY", "MEDIUM", "HARD", "INSANE"), true);
        if (!ctf) {
            var points = room.path("points");
            if (!points.isIntegralNumber() || !points.canConvertToInt() || points.intValue() < 0) errors.problem(key + ": points", "Podaj nieujemną liczbę całkowitą punktów (maksymalnie 2147483647)");
        }
        if (room.has("requiresVpn") && !room.path("requiresVpn").isBoolean()) errors.problem(key + ": requiresVpn", "Podaj true albo false");
        var hints = array(room, "hints", key, 100, false);
        for (int h = 0; h < hints.size(); h++) string(hints.get(h), key + ", podpowiedź " + (h + 1), 2000, true);
        if (ctf) {
            text(room, "flag", key, 255, true);
            return;
        }
        var tasks = array(room, "tasks", key, 100, false);
        text(room, "flag", key, 255, tasks.isEmpty());
        for (int t = 0; t < tasks.size(); t++) {
            var task = tasks.get(t);
            String taskKey = key + ", zadanie " + (t + 1);
            if (!object(task, taskKey, Set.of("title", "content", "question", "answer"))) continue;
            text(task, "title", taskKey, 255, true);
            String content = text(task, "content", taskKey, 20000, true);
            if (!content.isBlank() && TaskContentSanitizer.clean(content).isBlank()) errors.problem(taskKey + ": content", "Podaj treść po usunięciu niedozwolonego HTML");
            String question = text(task, "question", taskKey, 2000, false);
            String answer = text(task, "answer", taskKey, 255, !question.isBlank());
            if (question.isBlank() && !answer.isBlank()) errors.problem(taskKey + ": question", "Odpowiedź wymaga pytania");
        }
    }

    private boolean object(JsonNode node, String key, Set<String> allowed) {
        if (!node.isObject()) {
            errors.problem(key, "Oczekiwano obiektu JSON");
            return false;
        }
        node.propertyNames().forEach(field -> {
            if (!allowed.contains(field)) errors.problem(key + ": " + field, "Nieznane pole");
        });
        return true;
    }

    private JsonNode array(JsonNode node, String field, String key, int max, boolean required) {
        var value = node.path(field);
        if (!required && value.isMissingNode()) return tools.jackson.databind.node.JsonNodeFactory.instance.arrayNode();
        if (!value.isArray()) {
            errors.problem(key + ": " + field, "Oczekiwano listy JSON");
            return tools.jackson.databind.node.JsonNodeFactory.instance.arrayNode();
        }
        if (required && value.isEmpty()) errors.problem(key + ": " + field, "Lista nie może być pusta");
        if (value.size() > max) errors.problem(key + ": " + field, "Maksymalnie " + max + " elementów");
        return value;
    }

    private String text(JsonNode node, String field, String key, int max, boolean required) {
        return string(node.path(field), key + ": " + field, max, required);
    }

    private String string(JsonNode value, String key, int max, boolean required) {
        if (value.isMissingNode() || value.isNull()) {
            errors.text(key, null, max, required);
            return "";
        }
        if (!value.isTextual()) {
            errors.problem(key, "Oczekiwano tekstu");
            return "";
        }
        errors.text(key, value.textValue(), max, required);
        return value.textValue();
    }

    private void choice(JsonNode node, String field, String key, Set<String> allowed, boolean required) {
        var value = node.path(field);
        if (!required && value.isMissingNode()) return;
        if (!value.isTextual() || !allowed.contains(value.textValue())) errors.problem(key + ": " + field, "Dozwolone wartości: " + String.join(", ", allowed.stream().sorted().toList()));
    }
}
