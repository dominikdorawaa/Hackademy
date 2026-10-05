package com.hackademy.server.admin;

import com.hackademy.server.user.Role;
import jakarta.validation.constraints.NotNull;

public record UpdateUserRoleRequest(
    @NotNull(message = "Rola nie może być pusta") Role role
) {}
