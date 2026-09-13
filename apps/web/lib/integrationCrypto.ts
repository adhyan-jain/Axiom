/**
 * Symmetric encryption for OAuth tokens at rest (Integration.accessTokenEnc /
 * refreshTokenEnc). AES-256-GCM, key from INTEGRATION_TOKEN_KEY (32 raw bytes, given as
 * a 64-char hex string or any string >=32 bytes after utf8 encoding — hex preferred).
 * Deliberately simple (no KMS/envelope encryption) per the assignment's own framing
 * ("encrypt at rest using a simple symmetric scheme with a key from env") — this is a
 * demo-grade control, not a production key-management story.
 *
 * Fails closed: if the key is missing or malformed, encrypt/decrypt throw rather than
 * silently storing plaintext or returning garbage.
 */
import crypto from "node:crypto";

export class IntegrationCryptoNotConfiguredError extends Error {
  constructor() {
    super("INTEGRATION_TOKEN_KEY is not set — cannot encrypt/decrypt integration tokens");
    this.name = "IntegrationCryptoNotConfiguredError";
  }
}

function getKey(): Buffer {
  const raw = process.env.INTEGRATION_TOKEN_KEY;
  if (!raw) throw new IntegrationCryptoNotConfiguredError();
  // Accept a 64-char hex string (32 bytes) or fall back to a SHA-256 digest of whatever
  // string was provided, so any non-empty secret still yields a valid 32-byte AES key.
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  return crypto.createHash("sha256").update(raw, "utf8").digest();
}

const ALGO = "aes-256-gcm";

/** Returns `iv:authTag:ciphertext`, all hex — a single string safe to store in one column. */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptToken(stored: string): string {
  const key = getKey();
  const [ivHex, tagHex, ciphertextHex] = stored.split(":");
  if (!ivHex || !tagHex || !ciphertextHex) {
    throw new Error("Malformed encrypted token payload");
  }
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
