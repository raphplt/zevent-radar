const euroInt = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const euroDec = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("fr-FR");

export function euros(cents: number, options: { decimals?: boolean } = {}): string {
  const value = cents / 100;
  if (options.decimals || (!Number.isInteger(value) && Math.abs(value) < 1000)) return euroDec.format(value);
  return euroInt.format(Math.round(value));
}

export function compactNumber(value: number): string {
  return compact.format(value);
}

export function count(value: number): string {
  return integer.format(value);
}

export function duration(seconds: number): string {
  if (seconds <= 0) return "maintenant";
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${String(minutes % 60).padStart(2, "0")}`;
}

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = Math.round((now - Date.parse(iso)) / 1000);
  if (Number.isNaN(diff)) return "";
  if (diff < 10) return "à l'instant";
  if (diff < 60) return `il y a ${diff} s`;
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

export function percent(value: number): string {
  return `${Math.round(Math.min(1, Math.max(0, value)) * 100)} %`;
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
