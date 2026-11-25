export interface HttpRequestOptions {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  maxRetries?: number;
}

export interface HttpResponseData {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  text: string;
}

export class RateLimitError extends Error {
  public readonly retryAfterMs: number;
  public readonly host: string;

  constructor(host: string, retryAfterMs: number, message?: string) {
    super(message ?? `Rate limited by ${host} (HTTP 429). Retry after ${Math.ceil(retryAfterMs / 1000)}s.`);
    this.name = 'RateLimitError';
    this.host = host;
    this.retryAfterMs = retryAfterMs;
  }
}

const hostCooldownUntil = new Map<string, number>();

export function clearHostCooldowns(): void {
  hostCooldownUntil.clear();
}

export function parseRetryAfterMs(headerValue?: string): number {
  if (!headerValue) return 5000;
  const trimmed = headerValue.trim();
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(Math.max(seconds * 1000, 1000), 60000);
  }
  const parsedDate = Date.parse(trimmed);
  if (!Number.isNaN(parsedDate)) {
    return Math.min(Math.max(parsedDate - Date.now(), 1000), 60000);
  }
  return 5000;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function rawFetch(options: HttpRequestOptions): Promise<HttpResponseData> {
  if (options.signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  if (typeof window !== 'undefined' && window.electronAPI?.fetchUrl) {
    return window.electronAPI.fetchUrl({
      url: options.url,
      method: options.method,
      headers: options.headers,
      body: options.body,
      timeoutMs: options.timeoutMs,
    });
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 15000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onParentAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onParentAbort, { once: true });

  try {
    const res = await fetch(options.url, {
      method: options.method ?? 'GET',
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
    });
    const text = await res.text();
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });
    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      headers,
      text,
    };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onParentAbort);
  }
}

export async function fetchWithRateLimit(
  options: HttpRequestOptions
): Promise<HttpResponseData> {
  const host = new URL(options.url).hostname.toLowerCase();
  const maxRetries = Math.min(Math.max(options.maxRetries ?? 2, 0), 3);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const cooldownUntil = hostCooldownUntil.get(host) ?? 0;
    const waitMs = cooldownUntil - Date.now();
    if (waitMs > 0) {
      if (waitMs > 15000) {
        throw new RateLimitError(host, waitMs);
      }
      await sleep(waitMs, options.signal);
    }

    const res = await rawFetch(options);

    if (res.status === 429) {
      const retryAfterMs = parseRetryAfterMs(res.headers['retry-after']);
      const backoffMs = Math.max(retryAfterMs, 1500 * Math.pow(2, attempt));
      hostCooldownUntil.set(host, Date.now() + backoffMs);

      if (attempt === maxRetries || backoffMs > 15000) {
        throw new RateLimitError(host, backoffMs);
      }
      await sleep(backoffMs, options.signal);
      continue;
    }

    if (res.status >= 500 && res.status < 600 && attempt < maxRetries) {
      await sleep(1000 * (attempt + 1), options.signal);
      continue;
    }

    return res;
  }

  throw new Error(`Request to ${host} failed after retries.`);
}
