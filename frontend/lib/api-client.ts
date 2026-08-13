import type { ApiError, ApiSuccess } from '@dsb/shared';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === 'production'
    ? '/api/backend/api/v1'
    : 'http://localhost:4000/api/v1');

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
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiClientError(
      'PARSE_ERROR',
      `API returned invalid response (${res.status}). Check backend is running.`,
      res.status,
    );
  }
  if (!res.ok) {
    const err = body as ApiError;
    throw new ApiClientError(
      err.error?.code ?? 'UNKNOWN_ERROR',
      err.error?.message ?? `Request failed (${res.status})`,
      res.status,
    );
  }
  return (body as ApiSuccess<T>).data;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    return parseResponse<T>(res);
  } catch (err) {
    if (err instanceof ApiClientError) throw err;
    throw new ApiClientError(
      'NETWORK_ERROR',
      `Cannot reach API at ${API_BASE}. Start backend with: npm run dev -w backend`,
      0,
    );
  }
}

export async function apiFetchWithToken<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  try {
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
  } catch (err) {
    if (err instanceof ApiClientError) throw err;
    throw new ApiClientError(
      'NETWORK_ERROR',
      `Cannot reach API at ${API_BASE}. Start backend with: npm run dev -w backend`,
      0,
    );
  }
}
