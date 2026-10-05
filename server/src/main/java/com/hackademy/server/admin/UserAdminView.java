package com.hackademy.server.admin;

import com.hackademy.server.user.Role;
import java.time.LocalDateTime;

public record UserAdminView(
    Long id,
    String username,
    String email,
    Role role,
    LocalDateTime createdAt
) {}
