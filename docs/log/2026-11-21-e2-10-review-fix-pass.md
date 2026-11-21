---
date: 2026-11-21
author: claude-agent
type: change
card: E2.10
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/dogfood.ts
  - packages/core/src/policy/injection-screen.ts
  - packages/core/src/policy/promotion.ts
  - NOTICE
  - docs/absorbed.md
  - docs/conventions/absorption.md
  - docs/architecture.md
  - docs/tasks/backlog.md
  - packages/core/test/unit/policy/injection-screen.test.ts
supersedes: none
---

**What.** The review fix pass: `engram/write/injection-screen` joins `ENGRAM_RULES`; OWASP's and Mnemowall's tables are registered as copies, with OWASP's copyright, Mnemowall's NOTICE and Remnic's full MIT text in `NOTICE`; the convention now asks for MIT's and BSD's permission notice; the promotion reason names the screen; a cyclic content and a throwing normaliser fail closed; the corpus driver refuses a row that is not an allow; the write path in the architecture names the stage.

**Why.** Review findings E2.10-1 to E2.10-9; the dogfood list's own test would have failed `make test` on main.

**Result.** The screen, det, evaluate, load, presets, promotion, dogfood-report, schema, simulate and bench fault tests: 469 passed in 13 files; `make test-invariants`: 17 passed; `make lint`, `make lint-docs` pass.

**Consequence.** The two delegated decisions and the new result are their own entries.
