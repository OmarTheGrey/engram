---
date: 2026-11-28
author: claude-agent
type: decision
card: E9.12
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/consent.ts
  - docs/log/2026-11-28-e2-14-finding-consent-gaps-for-e9-12.md
supersedes: none
---

**What.** A topic matches the content's whole words: NFKC, invisible code points removed, lower case, words of letters, marks and digits, the topic's words consecutive within one string of the content (text, a record's key or value, a procedure's body or tool).

**Why.** E2.14's gap (a): items have no topic field, and adding one is a schema change the plan forbids. Matching had to be deterministic and explainable.

**Result.** "health" matches "Health insurance" and "h\u200Dealth" but not "healthy" or "healthcare"; "bank account" does not match across two record fields. No stemming, no synonyms: a person lists variants as further opt-outs.

**Consequence.** If wrong, a paraphrase slips through or a passing mention is refused; the proof of concept and the twin profile's comment say both. A topic field or a model tier would be a later card.
