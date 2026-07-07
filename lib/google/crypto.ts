import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Not `server-only`-guarded: holds no secret itself (the key lives in an env
// var read by `getKey()`), and needs to stay importable from plain Node
// contexts the same way `lib/auth/password.ts` does.

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12; // recommended for GCM
const DELIMITER = "."; // see lib/auth/password.ts — avoids dotenv-expand's `$` interpolation

function getKey(): Buffer {
  const secret = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "GOOGLE_TOKEN_ENCRYPTION_KEY is not set. Generate one with " +
        "`openssl rand -base64 32` — see docs/google-sync.md."
    );
  }
  const key = Buffer.from(secret, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `GOOGLE_TOKEN_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes ` +
        "(base64 of a 32-byte key, e.g. from `openssl rand -base64 32`)."
    );
  }
  return key;
}

/** Encrypts a token for storage. Output is `iv.ciphertext.authTag`, all base64. */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    ciphertext.toString("base64"),
    authTag.toString("base64"),
  ].join(DELIMITER);
}

/** Reverses {@link encryptToken}. Throws if the ciphertext was tampered with. */
export function decryptToken(encrypted: string): string {
  const [ivPart, ciphertextPart, authTagPart] = encrypted.split(DELIMITER);
  if (!ivPart || !ciphertextPart || !authTagPart) {
    throw new Error("Malformed encrypted token.");
  }

  const key = getKey();
  const iv = Buffer.from(ivPart, "base64");
  const ciphertext = Buffer.from(ciphertextPart, "base64");
  const authTag = Buffer.from(authTagPart, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
