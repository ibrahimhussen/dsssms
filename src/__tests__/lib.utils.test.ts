/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
/**
 * Utility library tests — lib/, validation schemas, error handling
 */
import { describe, it, expect, vi } from 'vitest';

// ── A. clean-params ──────────────────────────────────────────────────────────

import { cleanParams } from '../lib/clean-params';

describe('A. cleanParams', () => {
  it('removes undefined values', () => {
    expect(cleanParams({ a: 1, b: undefined })).toEqual({ a: 1 });
  });

  it('removes empty string values', () => {
    expect(cleanParams({ a: 'hello', b: '' })).toEqual({ a: 'hello' });
  });

  it('keeps 0, false, and null', () => {
    expect(cleanParams({ a: 0, b: false, c: null })).toEqual({ a: 0, b: false, c: null });
  });

  it('keeps all valid values', () => {
    expect(cleanParams({ page: 1, limit: 20, search: 'Alice' }))
      .toEqual({ page: 1, limit: 20, search: 'Alice' });
  });

  it('returns empty object when all values are undefined or empty', () => {
    expect(cleanParams({ a: undefined, b: '' })).toEqual({});
  });
});

// ── B. api-error ─────────────────────────────────────────────────────────────

import { ApiError, getErrorMessage, getFieldErrors } from '../lib/api-error';

describe('B. ApiError', () => {
  it('stores statusCode, errorCode and message', () => {
    const e = new ApiError({ message: 'Not found', errorCode: 'NOT_FOUND', statusCode: 404 });
    expect(e.message).toBe('Not found');
    expect(e.statusCode).toBe(404);
    expect(e.errorCode).toBe('NOT_FOUND');
    expect(e.name).toBe('ApiError');
    expect(e instanceof Error).toBe(true);
  });

  it('isUnauthorized is true for 401', () => {
    const e = new ApiError({ message: 'Unauthorized', errorCode: 'UNAUTHORIZED', statusCode: 401 });
    expect(e.isUnauthorized).toBe(true);
    expect(e.isForbidden).toBe(false);
  });

  it('isForbidden is true for 403', () => {
    const e = new ApiError({ message: 'Forbidden', errorCode: 'FORBIDDEN', statusCode: 403 });
    expect(e.isForbidden).toBe(true);
    expect(e.isUnauthorized).toBe(false);
  });

  it('isValidation is true for VALIDATION_ERROR', () => {
    const e = new ApiError({ message: 'Invalid', errorCode: 'VALIDATION_ERROR', statusCode: 422 });
    expect(e.isValidation).toBe(true);
  });

  it('normalises Zod fieldErrors shape into details', () => {
    const e = new ApiError({
      message: 'Validation failed',
      errorCode: 'VALIDATION_ERROR',
      statusCode: 422,
      details: { fieldErrors: { username: ['Required'], password: ['Too short'] } },
    });
    expect(e.details?.username).toEqual(['Required']);
    expect(e.details?.password).toEqual(['Too short']);
  });

  it('fieldErrorSummary returns joined field messages', () => {
    const e = new ApiError({
      message: 'Validation failed',
      errorCode: 'VALIDATION_ERROR',
      statusCode: 422,
      details: { fieldErrors: { username: ['Required'] } },
    });
    expect(e.fieldErrorSummary()).toContain('username');
    expect(e.fieldErrorSummary()).toContain('Required');
  });

  it('fieldErrorSummary returns message when no details', () => {
    const e = new ApiError({ message: 'Bad request', errorCode: 'BAD_REQUEST', statusCode: 400 });
    expect(e.fieldErrorSummary()).toBe('Bad request');
  });
});

describe('B. getErrorMessage', () => {
  it('returns ApiError message for non-validation ApiError', () => {
    const e = new ApiError({ message: 'Not found', errorCode: 'NOT_FOUND', statusCode: 404 });
    expect(getErrorMessage(e)).toBe('Not found');
  });

  it('returns fieldErrorSummary for validation ApiError', () => {
    const e = new ApiError({
      message: 'Validation failed', errorCode: 'VALIDATION_ERROR', statusCode: 422,
      details: { fieldErrors: { name: ['Required'] } },
    });
    expect(getErrorMessage(e)).toContain('name');
  });

  it('returns Error.message for plain Error', () => {
    expect(getErrorMessage(new Error('something broke'))).toBe('something broke');
  });

  it('returns generic message for non-Error', () => {
    expect(getErrorMessage('unexpected string')).toBe('An unexpected error occurred. Please try again.');
    expect(getErrorMessage(null)).toBe('An unexpected error occurred. Please try again.');
  });
});

describe('B. getFieldErrors', () => {
  it('returns field errors for matching field', () => {
    const e = new ApiError({
      message: 'Validation failed', errorCode: 'VALIDATION_ERROR', statusCode: 422,
      details: { fieldErrors: { email: ['Invalid email'] } },
    });
    expect(getFieldErrors(e, 'email')).toEqual(['Invalid email']);
  });

  it('returns empty array when field not present', () => {
    const e = new ApiError({
      message: 'Validation failed', errorCode: 'VALIDATION_ERROR', statusCode: 422,
      details: { fieldErrors: { email: ['Invalid email'] } },
    });
    expect(getFieldErrors(e, 'username')).toEqual([]);
  });

  it('returns empty array for non-ApiError', () => {
    expect(getFieldErrors(new Error('generic'), 'email')).toEqual([]);
    expect(getFieldErrors(null, 'email')).toEqual([]);
  });
});

// ── C. download-file ─────────────────────────────────────────────────────────

import { triggerBlobDownload } from '../lib/download-file';

describe('C. triggerBlobDownload', () => {
  it('creates an anchor, sets href and download, clicks it, then removes it', () => {
    const mockUrl = 'blob:mock-url';
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue(mockUrl),
      revokeObjectURL: vi.fn(),
    });

    const clicks: string[] = [];
    const appendedLinks: HTMLAnchorElement[] = [];

    const origAppend = document.body.appendChild.bind(document.body);
    vi.spyOn(document.body, 'appendChild').mockImplementation((el: Node) => {
      const a = el as HTMLAnchorElement;
      appendedLinks.push(a);
      vi.spyOn(a, 'click').mockImplementation(() => { clicks.push(a.download); });
      return el as HTMLElement;
    });
    vi.spyOn(document.body, 'removeChild').mockReturnValue({} as HTMLElement);

    const blob = new Blob(['content'], { type: 'text/plain' });
    triggerBlobDownload(blob, 'test-file.txt');

    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(appendedLinks[0].download).toBe('test-file.txt');
    expect(appendedLinks[0].href).toBe(mockUrl);
    expect(clicks[0]).toBe('test-file.txt');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockUrl);

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
});

// ── D. role-redirect (extended) ───────────────────────────────────────────────

import { getRoleDashboardPath, getPostLoginRedirect } from '../lib/role-redirect';

describe('D. role-redirect (extended)', () => {
  it('all 6 roles return "/"', () => {
    const roles = ['ADMIN','DIRECTOR','VICE_DIRECTOR','TEACHER','STUDENT','PARENT'] as const;
    for (const r of roles) expect(getRoleDashboardPath(r)).toBe('/');
  });

  it('deep nested "from" paths are honoured', () => {
    expect(getPostLoginRedirect('TEACHER', '/students/101/grades')).toBe('/students/101/grades');
    expect(getPostLoginRedirect('ADMIN', '/audit-logs?page=2')).toBe('/audit-logs?page=2');
  });

  it('blocked "from" always falls back to "/"', () => {
    expect(getPostLoginRedirect('DIRECTOR', '/login')).toBe('/');
    expect(getPostLoginRedirect('DIRECTOR', '/unauthorized')).toBe('/');
    expect(getPostLoginRedirect('DIRECTOR', '/')).toBe('/');
  });
});
