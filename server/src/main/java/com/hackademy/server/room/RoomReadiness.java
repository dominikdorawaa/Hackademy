package com.hackademy.server.room;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

// What a room needs before players see it through a published path. A room outside published paths may stay unfinished.
public final class RoomReadiness {
    private RoomReadiness() {}

    public static List<String> problems(Room room) {
        var problems = new ArrayList<String>();
        if (room.getDescription() == null || room.getDescription().isBlank()) problems.add("uzupełnij opis");
        var tasks = room.getTasks().stream()
                .sorted(Comparator.comparingInt(RoomTask::getSortOrder).thenComparing(RoomTask::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        for (int i = 0; i < tasks.size(); i++) {
            if (TaskContentSanitizer.clean(tasks.get(i).getContent() == null ? "" : tasks.get(i).getContent()).isBlank()) {
                problems.add("zadanie " + (i + 1) + ": podaj treść");
            }
        }
        problems.addAll(taskProblems(room.getRoomType(), tasks));
        return problems;
    }

    // Every task can be completed: a CTF task has a flag and a theory answer belongs to a question.
    public static List<String> taskProblems(RoomType roomType, List<RoomTask> tasks) {
        if (tasks.isEmpty()) return List.of("dodaj przynajmniej jedno zadanie");
        var problems = new ArrayList<String>();
        for (int i = 0; i < tasks.size(); i++) {
            String question = tasks.get(i).getQuestion();
            String answer = tasks.get(i).getAnswer();
            if (roomType == RoomType.CTF && answer == null) problems.add("zadanie " + (i + 1) + ": podaj flagę");
            else if (question != null && answer == null) problems.add("zadanie " + (i + 1) + ": podaj odpowiedź na pytanie");
            else if (roomType == RoomType.PATH && question == null && answer != null) problems.add("zadanie " + (i + 1) + ": odpowiedź wymaga pytania");
        }
        return problems;
    }
}
