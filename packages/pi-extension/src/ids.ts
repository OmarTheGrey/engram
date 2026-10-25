// Default id source and clock for the extension. The extension is a surface,
// so it may read the clock and draw randomness; packages/core never does, and
// tests inject both (docs/conventions/testing.md, "Time is injected").
import { randomBytes } from "node:crypto";

/** A UUIDv7 (RFC 9562): 48 bits of Unix milliseconds, then version, variant and random bits. */
export function uuidv7(nowMs: number = Date.now()): string {
  const bytes = randomBytes(16);
  let ms = BigInt(nowMs);
  for (let i = 5; i >= 0; i--) {
    bytes[i] = Number(ms & 0xffn);
    ms >>= 8n;
  }
  bytes[6] = 0x70 | ((bytes[6] ?? 0) & 0x0f);
  bytes[8] = 0x80 | ((bytes[8] ?? 0) & 0x3f);
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The wall clock as an ISO 8601 UTC timestamp. */
export const systemClock = (): string => new Date().toISOString();
