export const KEYS = {
  latest: "latest.json",
  goals: "goals.json",
  status: "status.json",
  eventTotal: "event-total.json",
  internalStatus: "internal/status.json",
  history: "internal/history.json",
  state: "internal/state.json",
  snapshot: (ts: string) => `snapshots/${ts}.json`
} as const;

export async function readJson<T>(bucket: R2Bucket, key: string): Promise<T | null> {
  const object = await bucket.get(key);
  if (!object) return null;
  try {
    return (await object.json()) as T;
  } catch {
    return null;
  }
}

export async function writeJson(bucket: R2Bucket, key: string, value: unknown, cacheControl?: string): Promise<void> {
  await bucket.put(key, JSON.stringify(value), {
    httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl }
  });
}
