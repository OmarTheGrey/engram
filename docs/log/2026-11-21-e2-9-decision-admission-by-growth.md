---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.9
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/scripts/admission.ts
  - packages/core/src/policy/secrets.ts
  - packages/core/src/vendor/gitleaks-rules.ts
supersedes: docs/log/2026-11-21-e2-9-decision-time-bound.md
---

**What.** A rule is admitted when, on each adversarial input, its time grows under 6 times from n to 4n (n = 4,096; confirmed from 4n to 16n before a refusal) and its summed time is at most 20 times gitleaks' keyword prefix on the same inputs; `SCAN_LIMIT` falls from 1M to 64K characters.

**Why.** The superseded entry called admitted rules linear: they were timed at one size under an absolute bound, which missed growth (`pii/email` took 18.8 s at 262K) and depended on the machine. Ratios of two timings do not; 64K is what the confirmation covers.

**Result.** 210 of 222 gitleaks rules admitted, two runs byte-identical under load; the curl rules refused for growth, five for cost. Content holding every keyword took about 1.8 s at 64K.

**Consequence.** Larger content with a guard on is held unscanned. Growth is evidence, not proof.
