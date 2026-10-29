---
date: 2026-10-29
author: claude-agent
type: failure
card: B3
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/runner/test/live.test.ts
  - "make test"
supersedes: none
---

**What.** The first `make test` after adding the Letta store to the B3 config failed two runner tests at their bounds: the B3 acceptance (120 s) and "the command replays under ENGRAM_OFFLINE=1" (120 s).

**Why.** Both ran the whole B3 config, now with three Letta sessions committing every turn, which takes minutes on Windows; the replay test also expected 12 calls, not 18.

**Result.** The B3 acceptance keeps all three stores with a 600 s bound (207 s measured); the replay test writes a copy of the config naming fake and Mem0 only, since it tests the replay command, and passes in seconds.

**Consequence.** Tests that run the B3 config for something other than the stores avoid the Letta sessions.
