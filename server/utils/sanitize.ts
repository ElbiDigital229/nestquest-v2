/**
 * Input sanitization utility.
 * Strips HTML tags and trims whitespace to prevent stored XSS.
 * React auto-escapes on render, but raw API responses don't —
 * sanitizing on write ensures safety regardless of consumer.
 */

const HTML_TAG_RE = /<[^>]*>/g;

export function sanitize(input: string): string {
  return input.replace(HTML_TAG_RE, "").trim();
}

export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  keys: (keyof T)[]
): T {
  const result = { ...obj };
  for (const key of keys) {
    if (typeof result[key] === "string") {
      (result as any)[key] = sanitize(result[key]);
    }
  }
  return result;
}
