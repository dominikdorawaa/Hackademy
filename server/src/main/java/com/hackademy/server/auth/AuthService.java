package com.hackademy.server.auth;

import org.springframework.http.ResponseEntity;

public interface AuthService {
    ResponseEntity<?> register(RegisterRequest registerRequest);
    AuthResponse login(LoginRequest loginRequest);
}
