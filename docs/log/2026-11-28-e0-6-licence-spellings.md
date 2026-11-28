---
date: 2026-11-28
author: claude-agent
type: decision
card: E0.6
chapter: design
pillar: research
hypothesis: none
evidence:
  - scripts/check-absorbed.ts
  - docs/conventions/absorption.md
  - docs/decisions/0037-absorbing-open-source.md
supersedes: none
---

**What.** The check reads a licence cell's leading SPDX id or expression, and also accepts the spellings ADR 0037 and the convention use: `CC0` as `CC0-1.0`, `the Unlicense` (any case) as `Unlicense`.

**Why.** Review finding 4: a contributor writing the licence as the ADR names it would fail the check. Accepting the two spellings costs one map and leaves the ADR and convention text as they are; the allowlist itself stays exactly the ADR's eight ids, pinned by a test.

**Result.** The convention's "Recording it" section now states the form: an SPDX id or expression, the two spellings, a bracketed note after.

**Consequence.** Any other informal name (for example `BSD`) still fails and must be written as its SPDX id.
