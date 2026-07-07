import {
  randomBytes,
  scrypt,
  scryptSync,
  timingSafeEqual,
  type BinaryLike,
  type ScryptOptions,
} from "node:crypto";
import { promisify } from "node:util";

// Not `server-only`-guarded on purpose: this module holds no secrets (the
// hash lives in an env var read elsewhere) and must stay importable from
// plain Node contexts — `scripts/hash-password.ts` and `playwright.config.ts`
// both use it. Importing `node:crypto` already makes it impossible to bundle
// into client code.

// promisify() picks the options-less overload, so re-type it explicitly.
const scryptAsync = promisify(scrypt) as (
  password: BinaryLike,
  salt: BinaryLike,
  keylen: number,
  options: ScryptOptions
) => Promise<Buffer>;

// scrypt parameters, encoded into every hash so they can evolve without
// invalidating existing hashes.
const SCRYPT_COST = 16384; // N
const SCRYPT_BLOCK_SIZE = 8; // r
const SCRYPT_PARALLELIZATION = 1; // p
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

interface ParsedHash {
  cost: number;
  blockSize: number;
  parallelization: number;
  salt: Buffer;
  key: Buffer;
}

function encode(params: ParsedHash): string {
  return [
    "scrypt",
    params.cost,
    params.blockSize,
    params.parallelization,
    params.salt.toString("base64"),
    params.key.toString("base64"),
  ].join("$");
}

function parse(stored: string): ParsedHash | null {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;

  const cost = Number(parts[1]);
  const blockSize = Number(parts[2]);
  const parallelization = Number(parts[3]);
  if (
    !Number.isInteger(cost) ||
    !Number.isInteger(blockSize) ||
    !Number.isInteger(parallelization) ||
    cost <= 1 ||
    blockSize <= 0 ||
    parallelization <= 0
  ) {
    return null;
  }

  const salt = Buffer.from(parts[4], "base64");
  const key = Buffer.from(parts[5], "base64");
  if (salt.length === 0 || key.length === 0) return null;

  return { cost, blockSize, parallelization, salt, key };
}

/** Hashes a password into a self-describing `scrypt$N$r$p$salt$key` string. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await scryptAsync(password, salt, KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
  });

  return encode({
    cost: SCRYPT_COST,
    blockSize: SCRYPT_BLOCK_SIZE,
    parallelization: SCRYPT_PARALLELIZATION,
    salt,
    key,
  });
}

/** Synchronous variant for CLI/config contexts (e2e credential setup). */
export function hashPasswordSync(password: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const key = scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
  });

  return encode({
    cost: SCRYPT_COST,
    blockSize: SCRYPT_BLOCK_SIZE,
    parallelization: SCRYPT_PARALLELIZATION,
    salt,
    key,
  });
}

/**
 * Verifies a password against a stored hash in constant time.
 * Malformed hashes verify as `false` rather than throwing.
 */
export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const parsed = parse(stored);
  if (!parsed) return false;

  try {
    const key = await scryptAsync(password, parsed.salt, parsed.key.length, {
      N: parsed.cost,
      r: parsed.blockSize,
      p: parsed.parallelization,
    });
    return timingSafeEqual(key, parsed.key);
  } catch {
    // e.g. parameter combinations scrypt rejects (memory limit)
    return false;
  }
}
