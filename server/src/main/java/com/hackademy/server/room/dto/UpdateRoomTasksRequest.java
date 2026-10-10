package com.hackademy.server.room.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record UpdateRoomTasksRequest(
    @NotNull(message = "Lista zadań jest wymagana") List<@NotNull(message = "Zadanie nie może być puste") @Valid RoomTaskRequest> tasks
) {}
