package com.hackademy.server.room.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import jakarta.validation.constraints.PositiveOrZero;

public record UpdateRoomTasksRequest(
    @NotNull @PositiveOrZero Long revision,
    @NotNull(message = "Lista zadań jest wymagana") List<@NotNull(message = "Zadanie nie może być puste") @Valid RoomTaskRequest> tasks
) {}
