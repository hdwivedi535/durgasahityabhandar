import type { ApiError, ApiSuccess } from '@dsb/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function parseResponse<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) {
    const err = body as ApiError;
    throw new ApiClientError(
      err.error?.code ?? 'UNKNOWN_ERROR',
      err.error?.message ?? 'Request failed',
      res.status,
    );
  }
  return (body as ApiSuccess<T>).data;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  return parseResponse<T>(res);
}

export async function apiFetchWithToken<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  return parseResponse<T>(res);
}
