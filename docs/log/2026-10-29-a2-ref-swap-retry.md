---
date: 2026-10-29
author: claude-agent
type: decision
card: A2
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0028-letta-adapter-over-memfs.md
  - packages/adapters/test/letta/repository.test.ts
supersedes: none
---

**What.** A Letta commit refused with "cannot lock ref 'HEAD'" is retried, within the same two-second bound as an `index.lock` refusal, only while HEAD still holds the bytes it held before at every path the commit names; otherwise the write is refused and restored (ADR 0028 amendments, All or nothing).

**Why.** The refusal means another commit moved HEAD and git changed nothing, so a retry is safe unless that other commit touched the same paths, when retrying would overwrite its change (verifier note N3).

**Result.** One test retries through two refusals into one commit; another, where another client commits `engram/MEMORY.md` first, is refused with that client's commit left as HEAD.

**Consequence.** Fewer refused writes under concurrent commits; none that overwrites another client's change.
