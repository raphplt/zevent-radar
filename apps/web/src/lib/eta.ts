export function liveEtaSeconds(etaSeconds: number | null, generatedAt: string, nowMs: number): number | null {
  if (etaSeconds === null) return null;
  const elapsed = Math.max(0, (nowMs - Date.parse(generatedAt)) / 1000);
  return Math.max(0, Math.round(etaSeconds - elapsed));
}

export function countdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
