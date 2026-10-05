package com.hackademy.server.path;

import lombok.*;

import java.io.Serializable;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class PathEnrollmentId implements Serializable {
    private Long userId;
    private Long pathId;
}
