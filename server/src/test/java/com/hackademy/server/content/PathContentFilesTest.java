package com.hackademy.server.content;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.mock.web.MockMultipartFile;

class PathContentFilesTest {
    private static final Path CONTENT = Path.of("..", "content", "paths");

    static List<Path> files() throws IOException {
        assertThat(CONTENT).isDirectory();
        try (Stream<Path> paths = Files.list(CONTENT)) {
            return paths.filter(path -> path.toString().endsWith(".json")).sorted().toList();
        }
    }

    @ParameterizedTest
    @MethodSource("files")
    void pathFilePassesImportValidation(Path file) throws IOException {
        var upload = new MockMultipartFile("file", file.getFileName().toString(), "application/json", Files.readAllBytes(file));
        var root = ContentImportReader.read(upload);

        assertThatCode(() -> new ContentImportValidation().validate(root)).doesNotThrowAnyException();
    }
}
