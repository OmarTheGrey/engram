// UUIDv7 (RFC 9562) for the ids the CLI injects into the Plane: 48 bits of
// Unix milliseconds, then random bits. Core draws no clock or randomness, so
// the surface does it here.
import { randomBytes } from "node:crypto";

export function uuidv7(ms: number = Date.now(), random: Uint8Array = randomBytes(10)): string {
  const b = new Uint8Array(16);
  let t = ms;
  for (let i = 5; i >= 0; i--) {
    b[i] = t % 256;
    t = Math.floor(t / 256);
  }
  b.set(random.subarray(0, 10), 6);
  b[6] = 0x70 | ((b[6] ?? 0) & 0x0f);
  b[8] = 0x80 | ((b[8] ?? 0) & 0x3f);
  const hex = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
