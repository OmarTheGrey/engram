// The normalised content hash (ADR 0018's exact-duplicate rule). One helper,
// used wherever two items are "the same content": the retired-content gate
// (card E2.4, ADR 0025), confirmations for promotion (card E2.5, ADR 0026)
// and the exact form of the duplicate lint (card L1). It compares content
// only: callers compare scope, class or anything else themselves.
//
// Normal form: text is NFKC-normalised, stripped of default-ignorable code
// points (they render as nothing), NFKC-normalised again, lower-cased, with every run of
// whitespace collapsed to one space and the ends trimmed, prefixed `text:`.
// Structured content (a JSON object, procedural content included) is
// canonical JSON, keys sorted at every depth, every string value normalised
// as text is (keys are kept as written; array order is content), prefixed
// `json:`, so text never collides with an object that prints the same.
import { createHash } from "node:crypto";
import type { MemoryItem } from "./schema.ts";

/**
 * Default-ignorable code points render as nothing: zero-width spaces and
 * joiners, the soft hyphen, the byte order mark, variation selectors, the
 * combining grapheme joiner, the Hangul fillers (U+3164 and U+115F, listed
 * explicitly as well) and the like, so text differing only by them reads the
 * same (review findings P4-7 and P4-14).
 */
const INVISIBLE = /[\p{Default_Ignorable_Code_Point}\u3164\u115F]/gu;

/** NFKC runs again after stripping, so a mark stranded by a stripped character composes. */
const normaliseText = (s: string) =>
  s
    .normalize("NFKC")
    .replace(INVISIBLE, "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

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

// Two forms, named for what they do (review finding P5-12). The merging form
// above (NFKC and case folding: "10²" is "102", "US" is "us") is right where
// merging is the safe direction: the retired-content rule, which then blocks
// more. The strict form is right where not merging is safe: confirmations
// and the duplicate check of a promotion, where two texts that differ in
// case or compatibility form must not corroborate each other. It only
// collapses whitespace and drops format characters (category Cf and U+180E);
// it has its own character set, kept apart from the merging form's wider
// default-ignorable set, and never runs NFKC.

/** The merging normal form (the one `normaliseContent` gives). */
export const normaliseContentMerging = normaliseContent;
/** `sha256:<hex>` of the merging normal form (the one `contentHash` gives). */
export const mergingContentHash = contentHash;

/** What the strict form drops: format characters (Cf) and U+180E, nothing wider. */
const FORMAT = /[\p{Cf}᠎]/gu;

const strictText = (s: string) => s.replace(FORMAT, "").replace(/\s+/g, " ").trim();

function strictCanonical(value: unknown): unknown {
  if (typeof value === "string") return strictText(value);
  if (Array.isArray(value)) return value.map(strictCanonical);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, strictCanonical(v)]),
    );
  return value;
}

/** The strict normal form: whitespace collapsed and format characters dropped; no NFKC, no case folding. */
export function normaliseContentStrict(content: MemoryItem["content"]): string {
  return typeof content === "string"
    ? `text:${strictText(content)}`
    : `json:${JSON.stringify(strictCanonical(content))}`;
}

/** `sha256:<hex>` of the strict normal form. */
export function strictContentHash(content: MemoryItem["content"]): string {
  return `sha256:${createHash("sha256").update(normaliseContentStrict(content)).digest("hex")}`;
}
