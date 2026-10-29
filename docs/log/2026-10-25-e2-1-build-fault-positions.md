---
date: 2026-10-25
author: claude-agent
type: change
card: E2.1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/policy/load-edges.test.ts
  - packages/core/src/policy/load.ts
supersedes: none
---

**What.** The policy loader now reports a YAML 1.1 merge source that is not a mapping, and a repeated ordered map key, at the node at fault.

**Why.** yaml 2.9.1 throws these without a position while building the value, so they landed at the first alias or line 1; a repeated scalar omap key landed at the map's tag.

**Result.** Six new tests in load-edges.test.ts assert exact line and column for three bad merge sources and three repeated omap keys, each after an unrelated earlier alias. The first five failed before the change; the sixth came with it. Branch coverage of policy/ stays at 100 percent, 83 of 83.

**Consequence.** Too many aliases is still reported at the first alias.
