---
date: 2026-11-21
author: claude-agent
type: decision
card: E1.6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/log/verify.ts
  - packages/core/test/unit/log/attacks.test.ts
  - packages/cli/src/run.ts
  - AGENTS.md
supersedes: docs/log/2026-11-21-e1-6-decision-checkpoint-format.md
---

**What.** Under the lead's decision on review finding E1.6-4, OK (exit 0) means a signed checkpoint, verified under the pinned public key, covers the whole chain; anything less is UNSIGNED (exit 3), and a failed check is FAILED.

**Why.** The verdict was OK whenever the latest checkpoint by size was signed, even with entries after it or with no key pinned; the reviewer forged three tampered logs that verified OK.

**Result.** The three cases (an edit after the latest checkpoint, the newest checkpoint deleted, a history re-signed with another key) are UNSIGNED unpinned and UNSIGNED or FAILED pinned. Each UNSIGNED carries a note naming why. The help text and AGENTS.md describe UNSIGNED completely (E1.6-11).

**Consequence.** A script reading the exit code accepts only a log a pinned signature vouches for in full.
