const KEY = "zr:installation";

export function getInstallationId(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const id = crypto.randomUUID().replace(/-/g, "");
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return "anonymous-installation";
  }
}
