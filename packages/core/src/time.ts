// Timestamps at full precision (decision D7 of the review fix pass). Every
// timestamp in the contract is a UTC ISO 8601 string with a Z (schema.ts,
// Timestamp). Date.parse truncates to the millisecond, so 12:00:00.0001Z and
// 12:00:00.0009Z would compare equal; here they do not. The evaluator and the
// invariants' oracle both compare through this one helper.

const TIMESTAMP = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?Z$/;

function split(ts: string): [whole: string, fraction: string] {
  const m = TIMESTAMP.exec(ts);
  if (!m?.[1]) throw new Error(`not a UTC ISO 8601 timestamp with a Z: ${JSON.stringify(ts)}`);
  return [m[1], m[2] ?? ""];
}

/**
 * The timestamp with its fractional seconds written to nine digits (more when
 * it has more), for example `2026-10-25T12:00:00.000100000Z`. Two timestamps
 * of at most nanosecond precision name the same instant exactly when their
 * normal forms are equal. Throws on anything but a UTC timestamp with a Z.
 */
export function normalTimestamp(ts: string): string {
  const [whole, fraction] = split(ts);
  return `${whole}.${fraction.padEnd(9, "0")}Z`;
}

/** Negative, zero or positive as instant `a` is before, equal to or after instant `b`. */
export function compareTimestamps(a: string, b: string): number {
  const [wa, fa] = split(a);
  const [wb, fb] = split(b);
  if (wa !== wb) return wa < wb ? -1 : 1;
  const width = Math.max(9, fa.length, fb.length);
  const pa = fa.padEnd(width, "0");
  const pb = fb.padEnd(width, "0");
  return pa === pb ? 0 : pa < pb ? -1 : 1;
}

/** The last second a four-digit-year timestamp can write, in milliseconds. */
const LAST_MS = Date.UTC(9999, 11, 31, 23, 59, 59);

/**
 * The instant `seconds` whole seconds after `ts`, keeping its fractional
 * seconds exactly (ttl arithmetic, ADR 0025), or null when that instant is
 * past what a four-digit-year timestamp can write: such a ttl never runs out.
 */
export function addSeconds(ts: string, seconds: number): string | null {
  const [whole, fraction] = split(ts);
  const ms = Date.parse(`${whole}Z`) + seconds * 1000;
  if (!Number.isSafeInteger(ms) || ms > LAST_MS) return null;
  const head = new Date(ms).toISOString().slice(0, 19);
  return fraction === "" ? `${head}Z` : `${head}.${fraction}Z`;
}
