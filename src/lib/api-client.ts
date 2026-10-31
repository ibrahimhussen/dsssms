import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { tokenStorage } from './token-storage';
import { ApiError } from './api-error';
import type { ApiResponse } from '../types/api';
import type { RefreshResponse } from '../types/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

/** Dispatched when a refresh attempt fails and the user must log in again. */
export const SESSION_EXPIRED_EVENT = 'dsssms:session-expired';

export const apiClient = axios.create({
  baseURL:         API_BASE_URL,
  headers:         { 'Content-Type': 'application/json' },
  withCredentials: true,   // send httpOnly refresh cookie on every request
});

apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  // Refresh token is in the httpOnly cookie — sent automatically.
  // No need to read it from storage or pass it in the body.
  const response = await axios.post<ApiResponse<RefreshResponse>>(
    `${API_BASE_URL}/auth/refresh`,
    {},
    { withCredentials: true }
  );

  if (!response.data.success) {
    throw new Error(response.data.message);
  }

  // Backend rotates the cookie automatically; we only need the new access token.
  const { accessToken } = response.data.data;
  tokenStorage.setAccessToken(accessToken);
  return accessToken;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;

    const isUnauthorized = error.response?.status === 401;
    const isAuthEndpoint =
      originalRequest?.url?.includes('/auth/login') || originalRequest?.url?.includes('/auth/refresh');

    if (!isUnauthorized || !originalRequest || originalRequest._retry || isAuthEndpoint) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      // Multiple requests can 401 around the same time; only refresh once and let the rest wait on it.
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });

      const newAccessToken = await refreshPromise;
      originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`);
      return apiClient(originalRequest);
    } catch (refreshError) {
      tokenStorage.clear();
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
      return Promise.reject(refreshError);
    }
  }
);

/**
 * Extracts the HTTP status code from an Axios response error.
 * Falls back to 0 when the request never reached the server (network error).
 */
function extractStatusCode(error: unknown): number {
  if (error instanceof AxiosError) return error.response?.status ?? 0;
  return 0;
}

/**
 * Unwraps the ApiResponse envelope for list endpoints.
 * Throws ApiError (not plain Error) on failure so callers get errorCode + field details.
 */
export async function unwrapPaginated<T>(
  promise: Promise<{ data: ApiResponse<T[]> }>
): Promise<{ items: T[]; meta: import('../types/api').PaginationMeta }> {
  let response: { data: ApiResponse<T[]> };
  try {
    response = await promise;
  } catch (err) {
    if (err instanceof AxiosError && err.response?.data) {
      const body = err.response.data as Record<string, unknown>;
      throw new ApiError({
        message: String(body.message ?? 'Request failed'),
        errorCode: String(body.errorCode ?? 'UNKNOWN_ERROR'),
        statusCode: err.response.status,
        details: body.details,
      });
    }
    throw new ApiError({
      message: err instanceof Error ? err.message : 'Network error — check your connection',
      errorCode: 'NETWORK_ERROR',
      statusCode: extractStatusCode(err),
    });
  }

  const { data } = response;
  if (!data.success) {
    throw new ApiError({
      message: data.message,
      errorCode: data.errorCode,
      statusCode: 200, // server returned 200 but success:false — treat as app-level error
      details: data.details,
    });
  }
  return {
    items: data.data,
    meta: data.pagination ?? {
      page: 1,
      limit: data.data.length,
      totalItems: data.data.length,
      totalPages: 1,
    },
  };
}

/**
 * Unwraps the ApiResponse envelope for single-resource endpoints.
 * Throws ApiError (not plain Error) on failure so callers get errorCode + field details.
 */
export async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  let response: { data: ApiResponse<T> };
  try {
    response = await promise;
  } catch (err) {
    if (err instanceof AxiosError && err.response?.data) {
      const body = err.response.data as Record<string, unknown>;
      // Extract Retry-After for 429 responses (express-rate-limit sends this header
      // when standardHeaders: true is set).
      const retryAfterRaw = err.response.headers?.['retry-after'];
      const retryAfterSeconds =
        err.response.status === 429 && retryAfterRaw && !isNaN(Number(retryAfterRaw))
          ? Math.max(1, Math.ceil(Number(retryAfterRaw)))
          : undefined;
      throw new ApiError({
        message: String(body.message ?? 'Request failed'),
        errorCode: String(body.errorCode ?? 'UNKNOWN_ERROR'),
        statusCode: err.response.status,
        details: body.details,
        retryAfterSeconds,
      });
    }
    throw new ApiError({
      message: err instanceof Error ? err.message : 'Network error — check your connection',
      errorCode: 'NETWORK_ERROR',
      statusCode: extractStatusCode(err),
    });
  }

  const { data } = response;
  if (!data.success) {
    throw new ApiError({
      message: data.message,
      errorCode: data.errorCode,
      statusCode: 200,
      details: data.details,
    });
  }
  return data.data;
}

export type { AxiosRequestConfig };
