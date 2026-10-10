import DOMPurify from 'dompurify';

export function sanitizeTaskContent(content: string): string {
  return DOMPurify.sanitize(content.replace(/\n/g, '<br/>'), {
    ALLOWED_TAGS: ['p', 'br', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'code', 'pre', 'blockquote', 'h2', 'h3', 'h4', 'hr'],
    ALLOWED_ATTR: [],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  });
}
