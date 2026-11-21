---
date: 2026-11-21
author: claude-agent
type: change
card: D1
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/distill/scrub.ts
  - packages/core/test/unit/distill/scrub.test.ts
supersedes: docs/log/2026-11-21-d1-review-scrub.md
---

**What.** The scrub runs the bypass table, then a named-value rule (a quoted value goes whole), then a rule for the MySQL clients' `-p` flag. In tool arguments, a secret flag takes the array element after it, and `{ name, value }` loses its value when the name is a secret's. The table itself is unchanged.

**Why.** The verifier found these shapes leaking, and `Author:` lines redacted.

**Result.** 56 scrub tests pass. These shapes are tested as kept, as known limits:
- a secret with no telltale shape in prose;
- a key split across two fields or two messages.

Known limits, untested:
- a flag and its value held in two keys of one object;
- `-p` beside a tool other than the MySQL clients, where it is usually a port.

**Consequence.** Card E2.9's guard is the detector; this scrub is a floor of shapes.
