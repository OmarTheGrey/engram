---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.12
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/cedar.ts
  - packages/core/src/policy/secrets.ts
supersedes: docs/log/2026-11-21-e2-12-decision-refuse-guards.md
---

**What.** `exportCedar` refuses a policy that turns on any content guard (`secrets`, `pii`, `max_content_bytes`, `injection_screen`) or trust option, and exports one whose blocks are all `off` as one without them.

**Why.** The superseded entry said E2.9 had not landed. It has: main at 0102643f enforces the secret and personal-data guard and the size limit in `evaluateWrite` (`contentGuard`), and E2.10's injection screen was already there. Both are pattern scans over content, which Cedar's `like` cannot express. Trust options (E2.11) are not enforced yet and stay refused, so the export never silently lags the evaluator.

**Result.** No registered preset sets either block, so all three export. The refusal and the all-`off` case are tested.

**Consequence.** A policy with a guard on has no Cedar export until a card translates the guard or states another exclusion.
