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
    const headers = new Headers(options.headers);

    if (options.body !== undefined && options.body !== null) {
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers,
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
    const headers = new Headers(options.headers);

    if (options.body !== undefined && options.body !== null) {
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
    }

    headers.set('Authorization', `Bearer ${token}`);

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers,
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

/** Upload multipart file (do not set Content-Type — browser sets boundary). */
export async function apiUploadWithToken<T>(
  path: string,
  token: string,
  formData: FormData,
): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
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

/** Download a binary file with auth and trigger browser save. */
export async function apiDownloadWithToken(
  path: string,
  token: string,
  fallbackFilename: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new ApiClientError('DOWNLOAD_FAILED', `Download failed (${res.status})`, res.status);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') ?? '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] ?? fallbackFilename;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function getApiBase(): string {
  return API_BASE;
}
