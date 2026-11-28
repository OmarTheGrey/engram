// Quote grounding for the model-based lints (card L9 of the second absorb
// plan, policy option `lints.model.evidence`). Ported from
// obsidian-second-brain (https://github.com/eugeniughelbur/obsidian-second-brain,
// commit 7f4ddfdafa4e4652b01209f1847c3a3fc7d07754, scripts/verify_quotes.py,
// MIT, copyright 2026 Eugeniu Ghelbur): a flag is acted on only when the
// model can quote the words behind it, word for word; the quote must be at
// least MIN_QUOTE characters, since a short one such as "the" matches almost
// anything and proves nothing; matching is exact after Unicode NFC and a
// whitespace fold; and one quote that fails fails the flag. Its tests that
// apply here are ported in packages/core/test/unit/lint/evidence.test.ts.
//
// Two divergences. The source checks a quote against one line of a note
// file named by a path; an item has no lines and no path, so a quote is
// checked against the item's whole text (structured content as canonical
// JSON, as the lint sends it), and every whitespace run, line breaks
// included, folds to one space, where the source folds spaces and tabs and
// refuses a quote spanning two lines. Pure: no I/O, no clock.
import { canonicalJson } from "../model.ts";
import type { MemoryItem } from "../schema.ts";

/** The shortest quote that grounds a flag, in characters after folding. */
export const MIN_QUOTE = 12;

/** `text` as quotes are matched: NFC, every whitespace run one space, trimmed. */
export function foldQuoteText(text: string): string {
  return text.normalize("NFC").replace(/\s+/gu, " ").trim();
}

/** An item's text as a quote is checked against it: a string as it is, structured content as canonical JSON. */
export const quotableText = (content: MemoryItem["content"]): string =>
  typeof content === "string" ? content : canonicalJson(content);

/** Whether a quote was found in the text it must come from, and why not when it was not. */
export type QuoteCheck =
  | { found: true; quote: string }
  | { found: false; quote: string | null; reason: string };

/**
 * Checks that `quote` (what the model returned, any value) is a span of
 * `text`, exactly after folding both, and at least MIN_QUOTE characters
 * once folded. `found.quote` is the folded quote; a quote that is not a
 * string is `null`.
 */
export function checkQuote(quote: unknown, text: string): QuoteCheck {
  if (typeof quote !== "string") return { found: false, quote: null, reason: "no quote given" };
  const wanted = foldQuoteText(quote);
  if (wanted === "") return { found: false, quote: wanted, reason: "no quote given" };
  if ([...wanted].length < MIN_QUOTE)
    return {
      found: false,
      quote: wanted,
      reason: `the quote is shorter than ${MIN_QUOTE} characters and proves nothing`,
    };
  if (!foldQuoteText(text).includes(wanted))
    return { found: false, quote: wanted, reason: "the quote is not in the item" };
  return { found: true, quote: wanted };
}
