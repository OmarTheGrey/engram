---
date: 2026-11-19
author: claude-agent
type: decision
card: B6
chapter: implementation
pillar: research
hypothesis: H2
evidence:
  - packages/runner/src/count.ts
  - research/scripts/h2_longmemeval_ttl.py
supersedes: none
---

**What.** COUNT does not fetch LongMemEval's S split; a missing file is refused with the command that fetches it, `h2_longmemeval_ttl.py --fetch-only`.

**Why.** COUNT fetches GateMem's data, but the S split's fetch already exists as card L2's `ensure_pinned_file`, and the task says to reuse it, not reimplement it in TypeScript.

**Result.** `--fetch-only` calls `ensure_pinned_file` (sha256 checked, refused under ENGRAM_OFFLINE=1); COUNT refuses a missing or changed file as UnpinnedData naming that command (`packages/runner/test/b6.test.ts`).

**Consequence.** One more step before COUNT on a fresh clone; AGENTS.md says so. Both H2 scripts fetch it as well.
