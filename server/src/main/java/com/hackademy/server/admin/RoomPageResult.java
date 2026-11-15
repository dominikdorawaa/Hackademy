package com.hackademy.server.admin;

import com.hackademy.server.room.RoomType;
import com.hackademy.server.room.dto.RoomAdminSummaryDto;
import org.springframework.data.domain.Slice;

import java.util.List;
import java.util.Map;

public record RoomPageResult(List<RoomAdminSummaryDto> items, int page, int size, boolean hasNext, Map<RoomType, Long> counts) {
    public static RoomPageResult of(Slice<RoomAdminSummaryDto> slice, Map<RoomType, Long> counts) {
        return new RoomPageResult(slice.getContent(), slice.getNumber(), slice.getSize(), slice.hasNext(), counts);
    }
}
