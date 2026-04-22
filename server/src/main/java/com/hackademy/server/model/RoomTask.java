package com.hackademy.server.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "room_tasks")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoomTask {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(columnDefinition = "TEXT")
    private String question;

    @Column
    private String answer;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;
}
