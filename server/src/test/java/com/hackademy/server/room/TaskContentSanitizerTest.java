package com.hackademy.server.room;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TaskContentSanitizerTest {

    @ParameterizedTest
    @ValueSource(strings = {
            "<p>Akapit</p>",
            "<p>Linia<br>druga</p>",
            "<ul><li>jeden</li><li>dwa</li></ul>",
            "<ol><li>pierwszy</li></ol>",
            "<strong>mocno</strong> <em>kursywa</em> <b>b</b> <i>i</i>",
            "<pre><code>nmap -sV 10.0.0.1</code></pre>",
            "<blockquote>cytat</blockquote>",
            "<h2>Dwa</h2><h3>Trzy</h3><h4>Cztery</h4>",
            "<hr>"
    })
    void keepsAllowedFormatting(String html) {
        assertEquals(html, TaskContentSanitizer.clean(html));
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "<p>Tekst</p><script>alert(1)</script>                       | <p>Tekst</p>",
            "<p onclick=\"alert(1)\">Kliknij</p>                          | <p>Kliknij</p>",
            "<strong onmouseover=\"steal()\">x</strong>                    | <strong>x</strong>",
            "<p>Zobacz <a href=\"https://evil.example\">link</a></p>       | <p>Zobacz link</p>",
            "<a href=\"javascript:alert(1)\">kliknij</a>                   | kliknij",
            "<img src=\"x\" onerror=\"alert(1)\">obrazek                    | obrazek",
            "<iframe src=\"https://evil.example\"></iframe><p>ok</p>       | <p>ok</p>",
            "<p style=\"color:red\" class=\"x\">styl</p>                    | <p>styl</p>",
            "<div><span>bez tagów</span></div>                             | bez tagów"
    })
    void removesScriptsAttributesLinksAndImages(String html, String expected) {
        assertEquals(expected, TaskContentSanitizer.clean(html));
    }

    @Test
    void trimsAndDoesNotPrettyPrint() {
        assertEquals("<p>a</p><ul><li>b</li></ul>", TaskContentSanitizer.clean("  \n<p>a</p><ul><li>b</li></ul>\n  "));
    }
}
