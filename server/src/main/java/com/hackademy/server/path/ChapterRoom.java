package com.hackademy.server.path;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "chapter_rooms")
@IdClass(ChapterRoomId.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ChapterRoom {
    @Id
    @Column(name = "room_id", nullable = false)
    private Long roomId;

    @Id
    @Column(name = "chapter_id", nullable = false)
    private Long chapterId;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;
}
