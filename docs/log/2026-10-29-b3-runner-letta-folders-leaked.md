---
date: 2026-10-29
author: claude-agent
type: failure
card: B3
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/runner/src/stores.ts
  - packages/runner/test/b3.test.ts
supersedes: docs/log/2026-10-29-a2-runner-letta-store.md
---

**What.** The runner's Letta store left its temporary MemFS repositories behind: one `make test` run left 25 `engram-runner-letta-*` folders in the temporary folder. The earlier entry said they were removed when the process exits; they were not.

**Why.** The cleanup hung off `process.on("exit")`, which does not run in vitest's worker threads, and nothing closed a store after its session.

**Result.** `openStore` records each Letta store's folder and `closeStore` removes it; `runProbe` closes its store in a `finally`, and the B3 test closes the stores it opens. The B3 test checks that no `engram-runner-letta-*` folder from its run remains, after the config run and after the cross-store denial test.

**Consequence.** This entry replaces the earlier one's cleanup claim; the rest of that entry stands.
