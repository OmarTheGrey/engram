---
date: 2026-11-28
author: claude-agent
type: failure
card: E8.17
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/parity.test.ts
  - make test-one T=packages/cli/test/parity.test.ts
supersedes: none
---

**What.** After merging main, card E8.16's parity suite failed: `hook codex` and `hook install` had neither a probe nor a listed exemption.

**Why.** E8.16 landed on main while this card was in flight; its suite requires every registry command to be probed or exempted with a reason.

**Result.** Both are exempted with their reasons, as `hook claude-code` is: the Codex hook reads no memory, and the installer reaches no plane; the installer's exemption is run (`hook install codex --project .` on the canary workspace) and shows no canary. 28 tests pass.

**Consequence.** Nothing further.
