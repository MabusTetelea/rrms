import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

// Hand-rolled rather than promisify: the promisified overload drops the
// options argument, and the cost parameters are the whole point here.
function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  });
}

/**
 * Password hashing on Node's built-in scrypt — a real memory-hard KDF, and no
 * native dependency to fight with on Windows.
 *
 * Encoded as `scrypt$N$r$p$salt$hash`, all base64url, so the cost parameters
 * travel with the hash and can be raised later without invalidating old rows.
 */

const N = 32768; // 2^15 — roughly 32 MB and ~100 ms per hash.
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALT_BYTES = 16;

// Node caps scrypt memory at 32 MB by default; N=32768,r=8 needs a little more.
const MAX_MEM = 64 * 1024 * 1024;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scrypt(password.normalize("NFKC"), salt, KEYLEN, {
    N,
    r: R,
    p: P,
    maxmem: MAX_MEM,
  });

  return [
    "scrypt",
    N,
    R,
    P,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, n, r, p, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64, "base64url");
  const expected = Buffer.from(hashB64, "base64url");

  let derived: Buffer;
  try {
    derived = await scrypt(password.normalize("NFKC"), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: MAX_MEM,
    });
  } catch {
    return false;
  }

  // Length check first: timingSafeEqual throws on a mismatch.
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/** Readable, high-entropy password for bootstrapping an account. */
export function generatePassword(): string {
  // No look-alike characters — these get read off a screen and typed by hand.
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(20);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
    if (i === 4 || i === 9 || i === 14) out += "-";
  }
  return out;
}
