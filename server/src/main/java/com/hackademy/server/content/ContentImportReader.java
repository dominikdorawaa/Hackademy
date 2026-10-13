package com.hackademy.server.content;

import java.io.IOException;
import java.util.Map;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.core.StreamReadFeature;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

public final class ContentImportReader {
    public static final int MAX_BYTES = 5 * 1024 * 1024;
    private static final JsonMapper JSON = JsonMapper.builder()
            .enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS).build();

    private ContentImportReader() {}

    public static JsonNode read(MultipartFile file) throws IOException {
        if (file.isEmpty() || file.getSize() > MAX_BYTES) throw invalid("Wybierz niepusty plik JSON do 5 MB");
        try {
            JsonNode root = JSON.readTree(file.getBytes());
            if (root == null) throw invalid("Plik nie zawiera dokumentu JSON");
            return root;
        } catch (tools.jackson.core.JacksonException error) {
            throw invalid("Niepoprawny JSON: sprawdź składnię, powtórzone klucze i dodatkową treść po dokumencie");
        }
    }

    private static ContentValidation.InvalidContent invalid(String message) {
        return new ContentValidation.InvalidContent(Map.of("plik", message));
    }
}
