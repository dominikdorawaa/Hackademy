package com.hackademy.server.dto;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UpdateBioRequest {
    @Size(max = 500, message = "Bio cannot exceed 500 characters")
    private String bio;
}
