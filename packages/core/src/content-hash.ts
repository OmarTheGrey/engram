// The normalised content hash (ADR 0018's exact-duplicate rule). One helper,
// used wherever two items are "the same content": the retired-content gate
// (card E2.4, ADR 0025), confirmations for promotion (card E2.5, ADR 0026)
// and the exact form of the duplicate lint (card L1). It compares content
// only: callers compare scope, class or anything else themselves.
//
// Normal form: text is NFKC-normalised, stripped of format characters that
// render as nothing (category Cf and U+180E), lower-cased, with every run of
// whitespace collapsed to one space and the ends trimmed, prefixed `text:`.
// Structured content (a JSON object, procedural content included) is
// canonical JSON, keys sorted at every depth, every string value normalised
// as text is (keys are kept as written; array order is content), prefixed
// `json:`, so text never collides with an object that prints the same.
import { createHash } from "node:crypto";
import type { MemoryItem } from "./schema.ts";

/**
 * Format characters (Unicode category Cf: zero-width space and joiners, the
 * soft hyphen, the byte order mark, directional marks) and U+180E render as
 * nothing, so text differing only by them reads the same (review finding P4-7).
 */
const INVISIBLE = /[\p{Cf}᠎]/gu;

const normaliseText = (s: string) =>
  s.normalize("NFKC").replace(INVISIBLE, "").toLowerCase().replace(/\s+/g, " ").trim();

function canonical(value: unknown): unknown {
  if (typeof value === "string") return normaliseText(value);
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}

/** The normal form of an item's content; two contents are the same exactly when these are equal. */
export function normaliseContent(content: MemoryItem["content"]): string {
  return typeof content === "string"
    ? `text:${normaliseText(content)}`
    : `json:${JSON.stringify(canonical(content))}`;
}

/** `sha256:<hex>` of the normal form of `content`. */
export function contentHash(content: MemoryItem["content"]): string {
  return `sha256:${createHash("sha256").update(normaliseContent(content)).digest("hex")}`;
}
