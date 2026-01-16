package com.hackademy.server.dto;

import com.hackademy.server.model.Role;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UserAdminView {
    private Long id;
    private String username;
    private String email;
    private Role role;
    private LocalDateTime createdAt;

}
