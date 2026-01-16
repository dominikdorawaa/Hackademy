package com.hackademy.server.service;

import com.hackademy.server.dto.AuthResponse;
import com.hackademy.server.dto.LoginRequest;
import com.hackademy.server.dto.RegisterRequest;
import org.springframework.http.ResponseEntity;

public interface AuthService {
    ResponseEntity<?> register(RegisterRequest registerRequest);
    AuthResponse login(LoginRequest loginRequest);
}
