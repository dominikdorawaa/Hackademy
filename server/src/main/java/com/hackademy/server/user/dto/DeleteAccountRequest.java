package com.hackademy.server.user.dto;

import jakarta.validation.constraints.Size;

public record DeleteAccountRequest(@Size(max = 256) String password) {}
