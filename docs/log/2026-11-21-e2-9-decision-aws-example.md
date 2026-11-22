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
  - packages/core/scripts/faults.ts
supersedes: none
---

**What.** AWS's documented example keys are allowed: the key id rule skips ids ending EXAMPLE, and the high-entropy rule secret keys ending EXAMPLEKEY.

**Why.** gitleaks allows them (`.+EXAMPLE$`), and documentation quotes them constantly (E2.9-8).

**Result.** The fault fixture's key id is now made up here; two walrus vectors built on the example secret end EXAMPLEKEz, as the ported test file says.

**Consequence.** A real key ending EXAMPLE would pass; AWS issues none.
