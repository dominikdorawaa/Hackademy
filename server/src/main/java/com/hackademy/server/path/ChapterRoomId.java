package com.hackademy.server.path;

import lombok.*;

import java.io.Serializable;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class ChapterRoomId implements Serializable {
    private Long roomId;
    private Long chapterId;
}
