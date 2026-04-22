package com.hackademy.server.model;

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
@Table(name = "path_rooms")
@IdClass(PathRoomId.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PathRoom {
    @Id
    @Column(name = "path_id", nullable = false)
    private Long pathId;

    @Id
    @Column(name = "room_id", nullable = false)
    private Long roomId;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;
}

