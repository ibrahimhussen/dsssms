import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { tokenStorage } from './token-storage';
import type { ApiResponse } from '../types/api';
import type { RefreshResponse } from '../types/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

/** Dispatched when a refresh attempt fails and the user must log in again. */
export const SESSION_EXPIRED_EVENT = 'dsssms:session-expired';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
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
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  // A plain axios call (not `apiClient`) avoids re-triggering these same interceptors.
  const response = await axios.post<ApiResponse<RefreshResponse>>(`${API_BASE_URL}/auth/refresh`, {
    refreshToken,
  });

  if (!response.data.success) {
    throw new Error(response.data.message);
  }

  const { accessToken, refreshToken: newRefreshToken } = response.data.data;
  tokenStorage.setTokens(accessToken, newRefreshToken);
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

/** Same as `unwrap`, but also returns the pagination metadata for list endpoints. */
export async function unwrapPaginated<T>(
  promise: Promise<{ data: ApiResponse<T[]> }>
): Promise<{ items: T[]; meta: import('../types/api').PaginationMeta }> {
  const { data } = await promise;
  if (!data.success) {
    throw new Error(data.message);
  }
  return { items: data.data, meta: data.pagination ?? { page: 1, limit: data.data.length, totalItems: data.data.length, totalPages: 1 } };
}

/** Unwraps the ApiResponse envelope, throwing a plain Error with the server's message on failure. */
export async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const { data } = await promise;
  if (!data.success) {
    throw new Error(data.message);
  }
  return data.data;
}

export type { AxiosRequestConfig };
