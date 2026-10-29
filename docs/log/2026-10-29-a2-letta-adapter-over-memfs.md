---
date: 2026-10-29
author: claude-agent
type: change
card: A2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/src/letta/index.ts
  - packages/adapters/test/letta/letta.test.ts
  - packages/adapters/test/letta/commits.test.ts
  - packages/adapters/test/plane/replay-workload.test.ts
  - "pnpm --filter adapters exec vitest run test/conformance test/letta test/plane"
supersedes: none
---

**What.** Card A2 adds the Letta adapter over a local MemFS repository (one commit per write and per delete), its conformance registration, Gate B criterion 3 on every store, and doctor's letta check.

**Why.** Gate B needs a second real store passing the conformance suite and the cross-store acceptance (criteria 1 and 2) and a per-store replay (criterion 3); ADR 0028 chose MemFS over a Letta server.

**Result.** The acceptance command passes: 286 tests, 14 skipped. Five mutations each turned tests red: the commit skipped (12 failures), a frontmatter field dropped (40; 33 with the read-back check removed too), the index not updated (3), a traversal key accepted (6), the failed-commit restore removed (2); removing doctor's delete check failed its test.

**Consequence.** The orchestrator wires `--store letta` into the workspace opener once PR 3 lands; PR 5 adds the store to the runner.
