# ADR 0018: Duplicate and near-duplicate detection without embeddings by default

Status: accepted, pending lead review, 2026-10-22
Deciders: drafted by the coding agent in step-0 task S0.13; pending review and acceptance by Omar (lead). Until then this records a recommendation the code already follows.
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

The duplicate lint must be deterministic to count in H3's deterministic tier; pi-ai does not appear to expose an embeddings API (unverified); stores differ in native search.

## Decision

Exact duplicate by normalised content hash; near-duplicate by MinHash over shingles with a fixed threshold; embedding-based similarity only through a store's native search when `native_search` is set, reported as a model-based lint. No embedding provider is a dependency of core.

Amendments made when implementing card E2.4, 2026-10-29 (pending the lead's review like the rest of this ADR):

- The normalised content hash is one helper, `contentHash(content)` with `normaliseContent(content)`, in packages/core/src/content-hash.ts and exported from `@engram/core`. Text is NFKC-normalised, lower-cased, whitespace runs collapsed to one space and trimmed, prefixed `text:`; structured content (procedural included) is canonical JSON with keys sorted at every depth and every string value normalised the same way, array order kept, prefixed `json:`; the hash is `sha256:<hex>` of that form. It hashes content only; callers compare scope and class. The retired-content gate (ADR 0025) uses it now; promotion's confirmations (ADR 0026, card E2.5) and the exact duplicate lint (card L1) use the same helper.

- Review finding P4-7 (PR 4): before whitespace is collapsed, text is stripped of format characters that render as nothing, Unicode category Cf (zero-width space and joiners, the soft hyphen, the byte order mark, directional marks) and U+180E, so a restatement padded with them is the same content. Still not caught by the exact rule, by design until L1's near-duplicate form: trailing punctuation, and text wrapped in a record such as `{"text": ...}`.

- Verification of PR 4 (finding P4-14): the stripped set is every default-ignorable code point (`\p{Default_Ignorable_Code_Point}`: format characters, variation selectors, the combining grapheme joiner, the Hangul fillers U+3164 and U+115F, named explicitly as well), and NFKC runs again after stripping. This replaces the Cf-and-U+180E set of the amendment above.

Amendments made in the review fix pass of card E2.5, 2026-10-29 (review finding P5-12; pending the lead's review like the rest of this ADR):

- There are two normal forms, exported under names that say what they do (packages/core/src/content-hash.ts). The merging form (`normaliseContentMerging`, `mergingContentHash`, also the plain `normaliseContent` and `contentHash`) applies NFKC and case folding, so "10²" and "102", or "US" and "us", are one content; it serves where merging is the safe direction, the retired-content rule. The strict form (`normaliseContentStrict`, `strictContentHash`) only drops format characters and collapses whitespace; it serves where not merging is the safe direction, promotion's confirmations and duplicate check (ADR 0026). The exact duplicate lint (L1) chooses its form when it lands.

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks L1. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
