package com.hackademy.server.room;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "hints")
@Getter
@Setter
@NoArgsConstructor
public class Hint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id", nullable = false)
    private RoomTask task;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    public Hint(String description, RoomTask task, int sortOrder) {
        this.description = description;
        this.task = task;
        this.sortOrder = sortOrder;
    }
}
