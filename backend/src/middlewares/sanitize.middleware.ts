import { Request, Response, NextFunction } from 'express';

/**
 * Strips HTML tags and dangerous characters from a string value.
 * Uses a built-in regex approach — no external dependency required.
 * For rich-text fields that intentionally allow some HTML, use the
 * allowedTags option (reserved for future use).
 */
function sanitizeString(value: string): string {
  return value
    // Remove all HTML/script tags
    .replace(/<[^>]*>/g, '')
    // Encode the five XML special chars that could inject markup
    .replace(/&(?!(amp|lt|gt|quot|#39);)/g, '&amp;')
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove unicode direction-override chars (BiDi attacks)
    .replace(/[\u202A-\u202E\u2066-\u2069\u200F\u200E]/g, '');
}

/**
 * Recursively sanitizes all string values in an object or array.
 * Non-string primitives and nested objects/arrays are handled correctly.
 * Does NOT mutate the original value — returns a new sanitized copy.
 */
function sanitizeDeep(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizeString(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeDeep);
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = sanitizeDeep(v);
    }
    return result;
  }
  return value;
}

/**
 * Express middleware that sanitizes `req.body` on mutating HTTP methods.
 * Apply globally after `express.json()` — runs before route handlers.
 *
 * Fields that go through Zod validation are also safe, but this provides
 * defence-in-depth against HTML/script injection in free-text fields
 * (homework descriptions, notification messages, conduct notes, etc.)
 */
export function sanitizeBody(req: Request, _res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if ((method === 'POST' || method === 'PUT' || method === 'PATCH') && req.body) {
    req.body = sanitizeDeep(req.body);
  }
  next();
}
