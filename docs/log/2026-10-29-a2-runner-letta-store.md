---
date: 2026-10-29
author: claude-agent
type: change
card: B3
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/runner/src/stores.ts
  - research/configs/b3-gatemem-plane.json
  - fixtures/cassettes/b3-gatemem-plane
  - "ENGRAM_OFFLINE=1 make run CONFIG=research/configs/b3-gatemem-plane.json"
supersedes: none
---

**What.** The runner opens a `letta` store (a Letta adapter over a fresh temporary MemFS repository, removed when the process exits), and the B3 config runs its probes on fake, Mem0 and Letta.

**Why.** The Gate B plan has PR 5 add the Letta store to the runner once PR 2 is on main; B3 merged first, so PR 2 wires it.

**Result.** `make fixtures` recorded six new cassettes for the three Letta sessions and changed none of the others; offline the config makes 18 calls from cassettes and 0 new on each of two runs. The cross-store denial test in `packages/runner/test/b3.test.ts` loops over every store the runner names, so it now covers Letta.

**Consequence.** Criterion 4's probes run on both real stores; the CLI's `--store letta` waits for PR 3.
