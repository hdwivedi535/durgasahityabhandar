const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB

export interface ImageUrlValidationResult {
  url: string;
  ok: boolean;
  message?: string;
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function hasImageExtension(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return SUPPORTED_EXTENSIONS.some((ext) => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

/**
 * Validate image URL format and, where practical, that the resource is an image.
 * Network checks are best-effort (timeout); format failures are hard errors.
 */
export async function validateImageUrl(
  url: string,
  options: { fetchRemote?: boolean; timeoutMs?: number } = {},
): Promise<ImageUrlValidationResult> {
  const trimmed = url.trim();
  if (!trimmed) {
    return { url: trimmed, ok: false, message: 'Image URL is empty' };
  }
  if (!isValidHttpUrl(trimmed)) {
    return { url: trimmed, ok: false, message: 'Invalid URL format (must be http/https)' };
  }

  const fetchRemote = options.fetchRemote ?? true;
  if (!fetchRemote) {
    if (!hasImageExtension(trimmed)) {
      return {
        url: trimmed,
        ok: false,
        message: 'URL must point to jpg, jpeg, png, webp, or gif',
      };
    }
    return { url: trimmed, ok: true };
  }

  const timeoutMs = options.timeoutMs ?? 4000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let res = await fetch(trimmed, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
    });

    // Some CDNs reject HEAD — fall back to GET
    if (!res.ok || res.status === 405) {
      res = await fetch(trimmed, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: { Range: 'bytes=0-0' },
      });
    }

    if (!res.ok && res.status !== 206) {
      return {
        url: trimmed,
        ok: false,
        message: `URL unreachable (HTTP ${res.status})`,
      };
    }

    const contentType = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    const contentLength = Number(res.headers.get('content-length') ?? '0');

    if (contentType && !SUPPORTED_IMAGE_TYPES.has(contentType) && !contentType.startsWith('image/')) {
      if (!hasImageExtension(trimmed)) {
        return {
          url: trimmed,
          ok: false,
          message: `Unsupported content type: ${contentType || 'unknown'}`,
        };
      }
    }

    if (contentLength > MAX_IMAGE_BYTES) {
      return {
        url: trimmed,
        ok: false,
        message: `Image too large (${Math.round(contentLength / 1024 / 1024)}MB, max 10MB)`,
      };
    }

    if (!contentType && !hasImageExtension(trimmed)) {
      return {
        url: trimmed,
        ok: false,
        message: 'Could not verify image type; use jpg/png/webp/gif URL',
      };
    }

    return { url: trimmed, ok: true };
  } catch (err) {
    const message =
      err instanceof Error && err.name === 'AbortError'
        ? 'Image URL validation timed out'
        : `Image URL unreachable: ${err instanceof Error ? err.message : 'network error'}`;
    return { url: trimmed, ok: false, message };
  } finally {
    clearTimeout(timer);
  }
}

export async function validateImageUrls(
  urls: string[],
  options?: { fetchRemote?: boolean },
): Promise<ImageUrlValidationResult[]> {
  const limited = urls.filter(Boolean).slice(0, 3);
  const results: ImageUrlValidationResult[] = [];
  for (const url of limited) {
    results.push(await validateImageUrl(url, options));
  }
  return results;
}
