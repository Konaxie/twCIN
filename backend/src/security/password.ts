import crypto from "node:crypto";

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(":");
  if (parts.length !== 2) {
    return false;
  }
  const [salt, originalHex] = parts;
  if (!salt || !originalHex) {
    return false;
  }

  const originalBuf = Buffer.from(originalHex, "hex");
  const derivedBuf = crypto.scryptSync(password, salt, originalBuf.length);
  if (originalBuf.length !== derivedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(originalBuf, derivedBuf);
}
