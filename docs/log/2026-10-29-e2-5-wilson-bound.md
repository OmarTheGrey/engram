---
date: 2026-10-29
author: claude-agent
type: finding
card: E2.5
chapter: discussion
pillar: distill
hypothesis: none
evidence:
  - packages/core/test/unit/policy/presets.test.ts
  - packages/core/policies/medium.yaml
  - fixtures/cassettes/rn1-gatemem-probe
  - "make fixtures MSG=..."
supersedes: none
---

**What.** The one-sided Wilson upper bound on failure at alpha 0.05 for each preset's replay record is 0.35 (strict, 5 of 5), 0.56 (medium, 4 of 5) and 0.73 (permissive, 3 of 5), now stated in each preset's comment.

**Why.** ADR 0026 asks for the bound so the k of n is argued over, not assumed (SKILL.nb, 2606.08049).

**Result.** The values come from `wilsonUpperFailure` in the presets test, pinned to four places. The plan's "about 0.52" for 4 of 5 does not match the formula with z 1.645; 0.56 is what it gives. Adding the comment changed condition C3's prompt, so `make fixtures` re-recorded two rn1-gatemem-probe cassettes; responses are unchanged.

**Consequence.** Medium admits a procedure whose failure rate may be above one half. The lead should see this before any D3 run.
