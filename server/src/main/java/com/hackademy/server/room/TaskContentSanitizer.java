package com.hackademy.server.room;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.safety.Safelist;

final class TaskContentSanitizer {
    // Task content supports formatting only: no attributes, links or embedded resources.
    private static final Safelist FORMATTING = new Safelist().addTags(
            "p", "br", "ul", "ol", "li", "strong", "em", "b", "i", "code", "pre", "blockquote", "h2", "h3", "h4", "hr");

    private TaskContentSanitizer() {}

    static String clean(String content) {
        return Jsoup.clean(content.trim(), "", FORMATTING, new Document.OutputSettings().prettyPrint(false));
    }
}
