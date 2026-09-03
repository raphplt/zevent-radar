function base64Url(bytes: ArrayBuffer | Uint8Array): string {
  return Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).toString("base64url");
}

async function main() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publicRaw = await crypto.subtle.exportKey("raw", pair.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  console.log(`VAPID_PUBLIC_KEY=${base64Url(publicRaw)}`);
  console.log(`VAPID_PRIVATE_KEY=${privateJwk.d}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
