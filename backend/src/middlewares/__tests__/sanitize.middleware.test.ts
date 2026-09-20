import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { sanitizeBody } from '../sanitize.middleware';

/**
 * sanitizeBody middleware tests.
 *
 * Verifies that HTML/script injection is stripped from request bodies on
 * mutating HTTP methods (POST, PUT, PATCH), and that GET/DELETE are left
 * untouched.
 *
 * DATABASE SAFETY: pure unit test — no Prisma, no database, no network.
 */

function makeReq(method: string, body: unknown): Request {
  return { method, body } as unknown as Request;
}

const mockRes = {} as Response;
const next: NextFunction = vi.fn();

describe('sanitizeBody middleware', () => {
  describe('POST/PUT/PATCH bodies are sanitized', () => {
    it('strips bold tags keeping inner text', () => {
      const req = makeReq('POST', { message: '<b>Hello</b>' });
      sanitizeBody(req, mockRes, next);
      expect((req.body as { message: string }).message).toBe('Hello');
    });

    it('strips script tags — tag removed, inner text retained (documents current behavior)', () => {
      const req = makeReq('POST', { message: '<script>xss</script>Safe' });
      sanitizeBody(req, mockRes, next);
      const msg = (req.body as { message: string }).message;
      expect(msg).not.toContain('<script>');
      expect(msg).not.toContain('</script>');
      expect(msg).toContain('Safe');
    });

    it('strips HTML from nested objects', () => {
      const req = makeReq('PUT', { user: { bio: '<b>bold</b>text' } });
      sanitizeBody(req, mockRes, next);
      expect((req.body as { user: { bio: string } }).user.bio).toBe('boldtext');
    });

    it('strips HTML from array string values', () => {
      const req = makeReq('PATCH', { tags: ['<em>tag1</em>', 'normal'] });
      sanitizeBody(req, mockRes, next);
      expect((req.body as { tags: string[] }).tags).toEqual(['tag1', 'normal']);
    });

    it('removes null bytes', () => {
      const req = makeReq('POST', { name: 'test\0value' });
      sanitizeBody(req, mockRes, next);
      expect((req.body as { name: string }).name).toBe('testvalue');
    });

    it('does not alter numbers or booleans', () => {
      const req = makeReq('POST', { count: 42, active: true });
      sanitizeBody(req, mockRes, next);
      const body = req.body as { count: number; active: boolean };
      expect(body.count).toBe(42);
      expect(body.active).toBe(true);
    });

    it('does not alter clean strings', () => {
      const req = makeReq('POST', { title: 'Annual Report 2026/27' });
      sanitizeBody(req, mockRes, next);
      expect((req.body as { title: string }).title).toBe('Annual Report 2026/27');
    });

    it('calls next() after sanitizing', () => {
      const req = makeReq('POST', { x: 'clean' });
      sanitizeBody(req, mockRes, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('GET and DELETE bodies are NOT touched', () => {
    it('does not process GET request body', () => {
      const req = makeReq('GET', { q: '<script>xss</script>' });
      sanitizeBody(req, mockRes, next);
      // Body untouched on GET
      expect((req.body as { q: string }).q).toBe('<script>xss</script>');
    });

    it('does not process DELETE request body', () => {
      const req = makeReq('DELETE', { reason: '<img src=x>' });
      sanitizeBody(req, mockRes, next);
      expect((req.body as { reason: string }).reason).toBe('<img src=x>');
    });
  });
});
