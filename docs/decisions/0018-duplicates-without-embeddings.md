# ADR 0018: Duplicate and near-duplicate detection without embeddings by default

Status: accepted, 2026-11-02
Deciders: Omar (lead)
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

The duplicate lint must be deterministic to count in H3's deterministic tier; pi-ai does not appear to expose an embeddings API (unverified); stores differ in native search.

## Decision

Exact duplicate by normalised content hash; near-duplicate by MinHash over shingles with a fixed threshold; embedding-based similarity only through a store's native search when `native_search` is set, reported as a model-based lint. No embedding provider is a dependency of core.

Amendments made when implementing card E2.4, 2026-10-29:

- The normalised content hash is one helper, `contentHash(content)` with `normaliseContent(content)`, in packages/core/src/content-hash.ts and exported from `@engram/core`. Text is NFKC-normalised, lower-cased, whitespace runs collapsed to one space and trimmed, prefixed `text:`; structured content (procedural included) is canonical JSON with keys sorted at every depth and every string value normalised the same way, array order kept, prefixed `json:`; the hash is `sha256:<hex>` of that form. It hashes content only; callers compare scope and class. The retired-content gate (ADR 0025) uses it now; promotion's confirmations (ADR 0026, card E2.5) and the exact duplicate lint (card L1) use the same helper.

- Review finding P4-7 (PR 4): before whitespace is collapsed, text is stripped of format characters that render as nothing, Unicode category Cf (zero-width space and joiners, the soft hyphen, the byte order mark, directional marks) and U+180E, so a restatement padded with them is the same content. Still not caught by the exact rule, by design until L1's near-duplicate form: trailing punctuation, and text wrapped in a record such as `{"text": ...}`.

- Verification of PR 4 (finding P4-14): the stripped set is every default-ignorable code point (`\p{Default_Ignorable_Code_Point}`: format characters, variation selectors, the combining grapheme joiner, the Hangul fillers U+3164 and U+115F, named explicitly as well), and NFKC runs again after stripping. This replaces the Cf-and-U+180E set of the amendment above.

Amendments made in the review fix pass of card E2.5, 2026-10-29 (review finding P5-12):

- There are two normal forms, exported under names that say what they do (packages/core/src/content-hash.ts). The merging form (`normaliseContentMerging`, `mergingContentHash`, also the plain `normaliseContent` and `contentHash`) applies NFKC and case folding, so "10²" and "102", or "US" and "us", are one content; it serves where merging is the safe direction, the retired-content rule. The strict form (`normaliseContentStrict`, `strictContentHash`) only drops format characters and collapses whitespace; it serves where not merging is the safe direction, promotion's confirmations and duplicate check (ADR 0026). The exact duplicate lint (L1) chooses its form when it lands.

Amendment made when implementing card L1, 2026-11-06, accepted on 2026-11-20 under the lead's delegation (`docs/tasks/lead-decisions.md`, item 37):

- The exact duplicate lint uses the strict form (`strictContentHash`): an active item is flagged when an active item of the same scope and class with a smaller id (earlier, since ids are UUIDv7) has the same strict hash; the earliest is kept and not flagged. Flagging is advisory, so not merging is the safe direction: "US" and "us" stay two items, while whitespace and format characters do not separate them. Retired and candidate items are not compared. The near-duplicate form (MinHash) is not part of card L1.

Note made when implementing card L5, 2026-11-21 (the promise of the decision kept; drafted by card L5 of the absorb plan, for the lead's acceptance):

- The near-duplicate form is a deterministic lint of its own id, `near-duplicate-tier` (`packages/core/src/lint/near-duplicate.ts`, beside `duplicates()` in `lint/det.ts`), run only when a policy lists that id; no registered preset does, so `duplicate` stays exact-only and every registered lint report is unchanged (`packages/core/test/unit/lint/near-duplicate-presets.test.ts`). It reads its fixed threshold from `lints.thresholds.near-duplicate` (0.85 when unset). MinHash with a fixed seed: 128 permutations in 32 bands of 4 rows, over character 3-grams of text under 32 words and word 2-grams from 32. A pair it estimates at or above the threshold is then held to a precision tier: an IDF-weighted cosine over the scope's items at the same threshold, and vetoes when each side holds a rare term the other lacks, when a number of one kind differs, or when a word one side negates the other states plainly. Exact copies stay the exact lint's. No embedding is used.

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks L1. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
