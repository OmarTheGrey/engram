---
date: 2026-11-28
author: claude-agent
type: decision
card: D4
chapter: design
pillar: distill
hypothesis: none
evidence:
  - docs/decisions/0011-one-lifecycle-replay-admission.md
  - packages/core/src/schema.ts
  - packages/core/src/plane/revalidate.ts
supersedes: none
---

**What.** A changed environment hash makes a re-validation due; it does not retire the procedure outright, as ADR 0011's text said. This departs from ADR 0011 and is written there as a dated amendment.

**Why.** E2.14's merged option already reads "re-validate when the procedure's environment hash changes", and the card says the same. Retiring outright would drop a procedure whose environment changed harmlessly; the replay is cheap and cached, so the plane can measure instead of guessing.

**Result.** `revalidationDue` returns `environment-changed` before `replay-drift` (the period); the event's policy id names the trigger. The hash is presented with the replay by the user who ran it (ADR 0046's trust), and the item carries none (no schema change).

**Consequence.** The plane cannot check the hash itself; a dogfood log replayed later knows only what the reason recorded.
