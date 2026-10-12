package com.hackademy.server.content;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public class ContentValidation {
    private final Map<String, String> errors = new LinkedHashMap<>();
    public void text(String field, String value, int max, boolean required) {
        if (required && (value == null || value.isBlank())) errors.put(field, "To pole jest wymagane");
        else if (value != null && value.length() > max) errors.put(field, "Maksymalnie " + max + " znaków");
    }
    public void problem(String field, String message) { errors.putIfAbsent(field, message); }
    public void url(String value) {
        text("bannerUrl", value, 2048, false);
        if (value == null || value.isBlank()) return;
        try {
            URI uri = URI.create(value);
            if ((!"http".equals(uri.getScheme()) && !"https".equals(uri.getScheme())) || uri.getHost() == null) throw new IllegalArgumentException();
        } catch (IllegalArgumentException e) { problem("bannerUrl", "Podaj poprawny adres http:// lub https://"); }
    }
    public void finish() { if (!errors.isEmpty()) throw new InvalidContent(errors); }
    public static class InvalidContent extends ResponseStatusException {
        private final Map<String, String> fields;
        public InvalidContent(Map<String, String> fields) { super(HttpStatus.BAD_REQUEST, "Popraw zaznaczone pola"); this.fields = fields; }
        public Map<String, String> fields() { return fields; }
    }
}
