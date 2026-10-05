package com.hackademy.server.path.dto;

import java.util.List;

public record UpdatePathRoomsRequest(
    List<Long> roomIds
) {}
