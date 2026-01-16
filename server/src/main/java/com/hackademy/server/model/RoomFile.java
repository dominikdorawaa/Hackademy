package com.hackademy.server.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "room_files")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class RoomFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String fileName;

    private String fileType;

    @Lob
    // Removed MySQL specific columnDefinition. Hibernate + PostgreSQL dialect should handle byte[] as bytea or OID.
    private byte[] data;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id")
    private Room room;

    public RoomFile(String fileName, String fileType, byte[] data, Room room) {
        this.fileName = fileName;
        this.fileType = fileType;
        this.data = data;
        this.room = room;
    }
}
