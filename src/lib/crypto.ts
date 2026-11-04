import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for OAuth tokens and API keys at rest. The key lives in
 * INTEGRATIONS_ENCRYPTION_KEY (32 bytes, base64). Ciphertext is
 * base64(iv || tag || data). Nothing here is ever logged.
 */
function key(): Buffer {
  const k = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!k) throw new Error("INTEGRATIONS_ENCRYPTION_KEY is not set");
  const buf = Buffer.from(k, "base64");
  if (buf.length !== 32) throw new Error("INTEGRATIONS_ENCRYPTION_KEY must be 32 bytes base64");
  return buf;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), data]).toString("base64");
}

export function decrypt(cipher: string): string {
  const buf = Buffer.from(cipher, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}
