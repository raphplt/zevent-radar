import type { Env } from "../env";

interface AccessKey {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
}

let certsCache: { fetchedAt: number; keys: AccessKey[] } | null = null;

function base64UrlToBytes(input: string): Uint8Array {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function loadAccessKeys(teamDomain: string): Promise<AccessKey[]> {
  if (certsCache && Date.now() - certsCache.fetchedAt < 6 * 60 * 60 * 1000) return certsCache.keys;
  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error("access certs unavailable");
  const data = (await res.json()) as { keys: AccessKey[] };
  certsCache = { fetchedAt: Date.now(), keys: data.keys };
  return data.keys;
}

export async function verifyAccessJwt(token: string, teamDomain: string, aud: string): Promise<string | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];
  const header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(headerB64))) as { kid: string; alg: string };
  if (header.alg !== "RS256") return null;
  const keys = await loadAccessKeys(teamDomain);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey("jwk", { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, base64UrlToBytes(signatureB64), new TextEncoder().encode(`${headerB64}.${payloadB64}`));
  if (!valid) return null;
  const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadB64))) as { aud: string | string[]; exp: number; email?: string; sub?: string };
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(aud)) return null;
  if (payload.exp * 1000 < Date.now()) return null;
  return payload.email ?? payload.sub ?? "access-user";
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export async function authenticateAdmin(request: Request, env: Env): Promise<string | null> {
  if (env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD) {
    const jwt = request.headers.get("cf-access-jwt-assertion");
    if (jwt) {
      const identity = await verifyAccessJwt(jwt, env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD);
      if (identity) return identity;
    }
  }
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (env.ADMIN_TOKEN && token && timingSafeEqual(token, env.ADMIN_TOKEN)) return "admin-token";
  return null;
}
