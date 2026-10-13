package com.hackademy.server.content;

import com.hackademy.server.path.PathRepository;
import com.hackademy.server.path.dto.PathAdminDetailDto;
import com.hackademy.server.path.dto.PathDetailDto;
import com.hackademy.server.room.RoomFileRepository;
import com.hackademy.server.room.dto.RoomDetailDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/content")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'EXPERT')")
public class ContentController {
    private final ContentService content;
    private final PathImportService pathImport;
    private final PathRepository paths;
    private final RoomFileRepository files;
    @PostMapping(value = "/paths/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public PathAdminDetailDto importPath(@RequestPart("file") MultipartFile file) throws IOException {
        return pathImport.importPath(file);
    }
    @PostMapping(value = "/paths", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public PathAdminDetailDto createPath(@RequestPart("content") ContentRequests.PathSave request,
        @RequestPart(value = "file", required = false) MultipartFile file, Authentication auth) {
        return content.savePath(null, request, file, admin(auth));
    }
    @PutMapping(value = "/paths/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public PathAdminDetailDto savePath(@PathVariable Long id, @RequestPart("content") ContentRequests.PathSave request,
        @RequestPart(value = "file", required = false) MultipartFile file, Authentication auth) {
        return content.savePath(id, request, file, admin(auth));
    }
    @GetMapping("/rooms/{id}")
    public ContentService.RoomEditor editor(@PathVariable Long id) { return content.roomEditor(id); }
    @PostMapping(value = "/rooms", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ContentService.RoomEditor createRoom(@RequestPart("content") ContentRequests.RoomSave request,
        @RequestPart(value = "file", required = false) MultipartFile file) throws IOException { return content.saveRoom(null, request, file); }
    @PutMapping(value = "/rooms/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ContentService.RoomEditor saveRoom(@PathVariable Long id, @RequestPart("content") ContentRequests.RoomSave request,
        @RequestPart(value = "file", required = false) MultipartFile file) throws IOException { return content.saveRoom(id, request, file); }
    @GetMapping("/rooms/{id}/preview")
    public RoomDetailDto roomPreview(@PathVariable Long id) { return content.previewRoom(id); }
    @GetMapping("/paths/{id}/preview")
    public PathDetailDto pathPreview(@PathVariable Long id) { return content.previewPath(id); }
    @GetMapping("/paths/{id}/banner")
    public ResponseEntity<byte[]> banner(@PathVariable Long id) {
        var p = paths.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (p.getBannerData() == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.parseMediaType(p.getBannerMime())).body(p.getBannerData());
    }
    @GetMapping("/rooms/{id}/file")
    public ResponseEntity<byte[]> file(@PathVariable Long id) {
        var f = files.findByRoomId(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(f.getFileName()).build().toString()).contentType(MediaType.APPLICATION_OCTET_STREAM).body(f.getData());
    }
    @ExceptionHandler(ContentValidation.InvalidContent.class)
    public ResponseEntity<?> invalid(ContentValidation.InvalidContent error) {
        return ResponseEntity.badRequest().body(Map.of("message", "Popraw zaznaczone pola", "fields", error.fields()));
    }
    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<?> conflict(org.springframework.dao.DataIntegrityViolationException error) {
        String cause = error.getMostSpecificCause().getMessage();
        if (cause != null && cause.contains("uq_rooms_ctf_title")) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", "Pokój CTF o tym tytule już istnieje", "fields", Map.of("title", "Pokój CTF o tym tytule już istnieje")));
        }
        if (cause != null && cause.contains("uq_chapter_rooms_title")) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", "Ten rozdział ma już pokój o tym tytule", "fields", Map.of("title", "Ten rozdział ma już pokój o tym tytule")));
        }
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", "Materiał zmienił się w międzyczasie. Sprawdź przypisania i spróbuj ponownie."));
    }
    private boolean admin(Authentication auth) { return auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN")); }
}
