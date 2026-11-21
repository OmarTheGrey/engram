---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.9
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/secrets.ts
  - research/configs/secret-guard.json
supersedes: none
---

**What.** A match lying wholly inside a UUID or an Engram content hash (`sha256:` and 64 hex digits) is no match, kept as it is.

**Why.** Card numbers pass Luhn inside UUIDs (Hindsight), and the label rule took a content hash beside the word "secret" for key material. The cost is that 64 hex digits written after `sha256:` pass whatever they are: a hex secret so prefixed is not found.

**Result.** Kept: a hex secret is caught only beside a credential word, and someone who writes `sha256:` before it can as easily drop the word.

**Consequence.** Listed in the result's limits and pinned by a test.
