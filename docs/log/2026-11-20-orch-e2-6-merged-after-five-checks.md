---
date: 2026-11-20
author: claude-orchestrator
type: decision
card: E2.6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/plane/cross-handle-verify.test.ts
  - packages/core/test/property/invariants.test.ts
  - "make test-invariants"
supersedes: none
---

**What.** Card E2.6 (PR #50) merged on the orchestrator's own gate run after one review and four verifications. The fourth verification found every fix holding except V4-1, and the fix for V4-1 was not verified again.

**Why.** The fourth verifier described V4-1 as a check plus tests: re-check a first write's lineage when it commits. The fix does that, and the verifier's own probes, P8 and P8b, are committed on both backends and failed before it. Every round found something narrower than the round before: a race, then a crash, then a fresh id, then the commit-time check.

**Result.** On the rebased head, every gate and the six invariants pass.

**Consequence.** The core review of the repository starts on this code. Three policy questions in ADR 0010 wait on the lead.
