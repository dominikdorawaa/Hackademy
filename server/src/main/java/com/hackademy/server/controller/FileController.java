package com.hackademy.server.controller;

import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/files")
@CrossOrigin(origins = "http://localhost:5173", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.OPTIONS})
public class FileController {

    // DEADCODE_CANDIDATE: frontend currently doesn't call this endpoint.
    @GetMapping("/mission-brief")
    public ResponseEntity<Resource> downloadMissionBrief() {
        // Tutaj normalnie pobierałbyś plik z dysku lub bazy danych
        String content = "TAJNE AKTA MISJI HACKADEMY\n\n" +
                "Cel: Przełamać zabezpieczenia i zdobyć flagę.\n" +
                "Zasady: Fair play, brak ataków DoS.\n\n" +
                "Powodzenia, Agent.";
        
        byte[] data = content.getBytes(StandardCharsets.UTF_8);
        ByteArrayResource resource = new ByteArrayResource(data);

        return ResponseEntity.ok()
                // Ten nagłówek mówi przeglądarce, że to plik do pobrania
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"misja.txt\"")
                .contentType(MediaType.TEXT_PLAIN)
                .contentLength(data.length)
                .body(resource);
    }
}
