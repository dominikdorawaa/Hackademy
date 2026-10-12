package com.hackademy.server.content;
import com.hackademy.server.path.PathRepository;
import com.hackademy.server.room.RoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
@Service
@RequiredArgsConstructor
public class ContentVisibility {
    private final PathRepository paths;
    private final RoomRepository rooms;
    public void requirePath(Long id) {
        if (!paths.findById(id).map(p -> p.isPublished()).orElse(false)) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Ścieżka niedostępna");
    }
    public void requireRoom(Long id) {
        if (!rooms.isVisible(id)) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Pokój niedostępny");
    }
}
