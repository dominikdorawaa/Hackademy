package com.hackademy.server;

import com.hackademy.server.room.RoomFile;
import com.hackademy.server.user.Role;
import com.hackademy.server.user.User;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"spring.jpa.properties.hibernate.generate_statistics=true", "logging.level.org.hibernate.engine.internal.StatisticalLoggingSessionEventListener=ERROR"})
class RoomReadBudgetTest extends PostgresIntegrationTest {
    @Autowired EntityManagerFactory factory;

    @Test
    void roomDescriptionReadsFileNameWithoutLoadingItsBytes() throws Exception {
        var admin = account(Role.ADMIN);
        var learner = account(Role.USER);
        long room = createRoom(admin, uniqueTitle("Attachment"), "CTF");
        byte[] attachment = new byte[1_048_576];
        jdbcTemplate.update("INSERT INTO room_files(room_id, file_name, file_type, data) VALUES (?, 'capture.bin', 'application/octet-stream', ?)", room, attachment);
        var statistics = factory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        getAs(learner, "/api/rooms/" + room).andExpect(status().isOk())
                .andExpect(jsonPath("$.fileName").value("capture.bin"));
        assertEquals(0, statistics.getEntityStatistics(RoomFile.class.getName()).getLoadCount());
        getAs(learner, "/api/rooms/" + room + "/file").andExpect(status().isOk())
                .andExpect(content().bytes(attachment));
        assertEquals(1, statistics.getEntityStatistics(RoomFile.class.getName()).getLoadCount());
    }

    @Test
    void currentProfileUsesTheUserAlreadyResolvedByAuthentication() throws Exception {
        var learner = account(Role.USER);
        var statistics = factory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        getAs(learner, "/api/user/me").andExpect(status().isOk());
        assertEquals(1, statistics.getEntityStatistics(User.class.getName()).getLoadCount());
    }
}
