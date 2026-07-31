/**
 * Sanitizes rich text / HTML content to prevent XSS and code injection.
 * Removes script tags, iframe, onload handlers, javascript: URIs, etc.
 */
export function sanitizeRichText(inputHtml: string): string {
  if (!inputHtml) return "";

  let cleaned = inputHtml;

  // 1. Remove <script>...</script>
  cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

  // 2. Remove <iframe>...</iframe>
  cleaned = cleaned.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");

  // 3. Remove inline event handlers (e.g. onload=, onclick=, onerror=)
  cleaned = cleaned.replace(/\s*on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  // 4. Remove javascript: URIs
  cleaned = cleaned.replace(/href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi, 'href="#"');

  return cleaned.trim();
}
