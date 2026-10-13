/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
/**
 * api-client unwrap / unwrapPaginated tests
 * Tests the response-envelope parsing without hitting real HTTP.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock axios and token-storage before importing api-client
vi.mock('axios', async (orig) => {
  const actual = await orig<typeof import('axios')>();
  return {
    ...actual,
    default: {
      ...actual.default,
      create: vi.fn(() => ({
        interceptors: {
          request:  { use: vi.fn() },
          response: { use: vi.fn() },
        },
        get:    vi.fn(),
        post:   vi.fn(),
        patch:  vi.fn(),
        put:    vi.fn(),
        delete: vi.fn(),
      })),
    },
  };
});

vi.mock('../lib/token-storage', () => ({
  tokenStorage: {
    getAccessToken:  vi.fn().mockReturnValue(null),
    setAccessToken:  vi.fn(),
    clear:           vi.fn(),
    getRefreshToken: vi.fn().mockReturnValue(null),
    setTokens:       vi.fn(),
  },
}));

import { unwrap, unwrapPaginated } from '../lib/api-client';
import { ApiError } from '../lib/api-error';
import { AxiosError } from 'axios';

// ── Helpers ───────────────────────────────────────────────────────────────────

function successResponse<T>(data: T, pagination?: object) {
  return Promise.resolve({
    data: { success: true as const, message: 'OK', data, ...(pagination ? { pagination } : {}) },
  });
}

function errorResponse(message: string, errorCode: string, statusCode = 400, details?: unknown) {
  return Promise.resolve({
    data: { success: false as const, message, errorCode, ...(details ? { details } : {}) },
  });
}

function axiosNetworkError(message = 'Network Error') {
  const err = new AxiosError(message);
  return Promise.reject(err);
}

function axiosHttpError(statusCode: number, body: object) {
  const err = new AxiosError('Request failed');
  (err as AxiosError & { response: unknown }).response = { status: statusCode, data: body };
  return Promise.reject(err);
}

// ── A. unwrap ─────────────────────────────────────────────────────────────────

describe('A. unwrap', () => {
  it('returns data when success:true', async () => {
    const result = await unwrap(successResponse({ userId: 1 }));
    expect(result).toEqual({ userId: 1 });
  });

  it('throws ApiError when success:false', async () => {
    await expect(
      unwrap(errorResponse('Not found', 'NOT_FOUND', 404))
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('ApiError has correct message and errorCode on success:false', async () => {
    try {
      await unwrap(errorResponse('Conflict', 'CONFLICT', 409));
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).message).toBe('Conflict');
      expect((e as ApiError).errorCode).toBe('CONFLICT');
    }
  });

  it('throws ApiError with NETWORK_ERROR on axios network failure', async () => {
    try {
      await unwrap(axiosNetworkError());
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).errorCode).toBe('NETWORK_ERROR');
    }
  });

  it('throws ApiError with server errorCode on 4xx HTTP error', async () => {
    try {
      await unwrap(axiosHttpError(422, { success: false, message: 'Invalid', errorCode: 'VALIDATION_ERROR' }));
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).errorCode).toBe('VALIDATION_ERROR');
      expect((e as ApiError).statusCode).toBe(422);
    }
  });

  it('unwraps string data', async () => {
    const result = await unwrap(successResponse('hello'));
    expect(result).toBe('hello');
  });

  it('unwraps null data', async () => {
    const result = await unwrap(successResponse(null));
    expect(result).toBeNull();
  });

  it('unwraps array data', async () => {
    const result = await unwrap(successResponse([1, 2, 3]));
    expect(result).toEqual([1, 2, 3]);
  });
});

// ── B. unwrapPaginated ────────────────────────────────────────────────────────

describe('B. unwrapPaginated', () => {
  const META = { page: 1, limit: 20, totalItems: 2, totalPages: 1 };

  it('returns items and meta when success:true', async () => {
    const result = await unwrapPaginated(successResponse([{ id: 1 }, { id: 2 }], META));
    expect(result.items).toEqual([{ id: 1 }, { id: 2 }]);
    expect(result.meta).toEqual(META);
  });

  it('synthesises meta when pagination field is absent', async () => {
    const result = await unwrapPaginated(successResponse([{ id: 1 }]));
    expect(result.items).toHaveLength(1);
    expect(result.meta.page).toBe(1);
    expect(result.meta.totalItems).toBe(1);
  });

  it('returns empty items array on empty response', async () => {
    const result = await unwrapPaginated(successResponse([], { ...META, totalItems: 0, totalPages: 1 }));
    expect(result.items).toHaveLength(0);
  });

  it('throws ApiError when success:false', async () => {
    await expect(
      unwrapPaginated(errorResponse('Unauthorized', 'UNAUTHORIZED', 401))
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('throws ApiError with NETWORK_ERROR on network failure', async () => {
    try {
      await unwrapPaginated(axiosNetworkError('Connection refused'));
    } catch (e) {
      expect((e as ApiError).errorCode).toBe('NETWORK_ERROR');
      expect((e as ApiError).message).toBe('Connection refused');
    }
  });

  it('throws ApiError with server body on HTTP 403', async () => {
    try {
      await unwrapPaginated(axiosHttpError(403, { message: 'Forbidden', errorCode: 'FORBIDDEN' }));
    } catch (e) {
      expect((e as ApiError).statusCode).toBe(403);
      expect((e as ApiError).errorCode).toBe('FORBIDDEN');
    }
  });

  it('includes details on validation errors from HTTP 422', async () => {
    try {
      await unwrapPaginated(axiosHttpError(422, {
        message: 'Validation failed',
        errorCode: 'VALIDATION_ERROR',
        details: { fieldErrors: { name: ['Required'] } },
      }));
    } catch (e) {
      expect((e as ApiError).details).toBeDefined();
    }
  });
});
