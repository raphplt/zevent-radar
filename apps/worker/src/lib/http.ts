export interface FetchOptions {
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export async function fetchWithRetry(url: string, options: FetchOptions = {}): Promise<Response> {
  const { timeoutMs = 5000, retries = 3, headers = {} } = options;
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers: { accept: "application/json", ...headers }, signal: controller.signal, cf: { cacheTtl: 0 } });
      if (res.status >= 500) throw new HttpError(res.status, `upstream ${res.status}`);
      return res;
    } catch (error) {
      lastError = error;
      if (attempt < retries - 1) await new Promise((r) => setTimeout(r, 250 * 2 ** attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("fetch failed");
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}
