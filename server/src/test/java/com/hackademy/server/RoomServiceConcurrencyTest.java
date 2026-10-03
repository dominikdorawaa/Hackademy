package com.hackademy.server;

import com.hackademy.server.model.DifficultyLevel;
import com.hackademy.server.model.Room;
import com.hackademy.server.model.RoomTask;
import com.hackademy.server.model.User;
import com.hackademy.server.repository.RoomRepository;
import com.hackademy.server.repository.RoomTaskRepository;
import com.hackademy.server.repository.UserCompletedTaskRepository;
import com.hackademy.server.repository.UserRepository;
import com.hackademy.server.service.RoomService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(properties = {
        "DB_URL=jdbc:h2:mem:hackademy_concurrency_test",
        "DB_USERNAME=sa",
        "DB_PASSWORD=",
        "JWT_SECRET=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class RoomServiceConcurrencyTest {
    @Autowired
    private RoomService roomService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private RoomTaskRepository roomTaskRepository;

    @Autowired
    private UserCompletedTaskRepository userCompletedTaskRepository;

    @Test
    void concurrentSolutionsCreateOneCompletion() throws Exception {
        User user = userRepository.save(User.builder()
                .username("concurrent")
                .email("concurrent@example.com")
                .password("unused")
                .build());
        Room room = roomRepository.save(Room.builder()
                .title("Concurrent room")
                .description("Concurrency test")
                .difficulty(DifficultyLevel.EASY)
                .category("Test")
                .points(10)
                .flag("unused")
                .build());
        RoomTask task = roomTaskRepository.save(RoomTask.builder()
                .room(room)
                .title("Task 1")
                .content("First task")
                .answer("correct")
                .sortOrder(0)
                .build());
        roomTaskRepository.save(RoomTask.builder()
                .room(room)
                .title("Task 2")
                .content("Second task")
                .answer("other")
                .sortOrder(1)
                .build());

        var start = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(2);
        try {
            var results = List.of(
                    pool.submit(() -> {
                        start.await();
                        return roomService.solveTask(room.getId(), task.getId(), "correct", user.getUsername());
                    }),
                    pool.submit(() -> {
                        start.await();
                        return roomService.solveTask(room.getId(), task.getId(), "correct", user.getUsername());
                    })
            );
            start.countDown();
            for (var result : results) {
                assertTrue(result.get(10, TimeUnit.SECONDS).isSuccess());
            }
        } finally {
            pool.shutdownNow();
        }

        assertEquals(1, userCompletedTaskRepository.countByUserIdAndTaskIdIn(user.getId(), List.of(task.getId())));
    }
}
