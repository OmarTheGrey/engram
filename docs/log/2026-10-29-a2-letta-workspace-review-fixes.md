---
date: 2026-10-29
author: claude-agent
type: change
card: A2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/workspace.ts
  - packages/adapters/src/letta/deferred.ts
  - packages/adapters/test/letta/repository.test.ts
  - packages/cli/test/letta.test.ts
supersedes: none
---

**What.** Three review findings on `--store letta`: workspace flags are checked before the store is built and the deferred adapter opens on its first call (I-1); read, explain and retain open the store with `create: false`, refusing a missing or empty folder by name (M-1); openers racing to initialise one empty folder retry once a `.git` exists (M-2).

**Why.** A usage error could follow an initialised folder; a read could initialise a repository; 9 of 20 writes failed in a four-way first-open race.

**Result.** New tests: a bad `--db` leaves `--root` missing; read and retain refuse; four parallel openers land all 20 writes over one setup commit. Each fix's mutation fails its test; the guard that a racer's repository is the folder's own survived its mutation and is kept.

**Consequence.** ADR 0028's Surfaces amendment states it.
