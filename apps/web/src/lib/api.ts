import { API_BASE_URL, DATA_BASE_URL } from "./config";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export async function getData<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${DATA_BASE_URL}${path}`, { signal, headers: { accept: "application/json" } });
  if (!res.ok) throw new ApiError(res.status, `data ${res.status}`);
  return res.json() as Promise<T>;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message = (data as { error?: string } | null)?.error ?? `api ${res.status}`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}
