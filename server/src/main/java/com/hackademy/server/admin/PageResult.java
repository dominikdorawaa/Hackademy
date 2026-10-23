package com.hackademy.server.admin;

import org.springframework.data.domain.Slice;
import java.util.List;

public record PageResult<T>(List<T> items, int page, int size, boolean hasNext) {
    public static <T> PageResult<T> from(Slice<T> slice) {
        return new PageResult<>(slice.getContent(), slice.getNumber(), slice.getSize(), slice.hasNext());
    }
}
