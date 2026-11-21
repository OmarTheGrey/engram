---
date: 2026-11-21
author: claude-agent
type: finding
card: D1
chapter: limitations
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/plane/bypass.ts
  - packages/core/test/unit/distill/scrub.test.ts
supersedes: none
---

**What.** The bypass redactor's last rule, `\b[A-Za-z0-9_-]{32,}\b`, matches every canonical UUID, git SHA and long hash, and so does any long identifier made of letters, digits and hyphens.

**Why.** Card D1 runs the table over whole sessions, which are full of such strings. A bypass reason, by contrast, is one short command.

**Result.** In free text, such strings are replaced by `<redacted>`, for example a commit SHA in a `git log` result. The scrub exempts pi's own id shapes so that sessions are not held for their ids.

**Consequence.** Card E2.9, which unifies its guard with this table, should give the 32-character rule an entropy check or exclude hex and UUID shapes. Until then, episodes lose some evidence to over-redaction.
