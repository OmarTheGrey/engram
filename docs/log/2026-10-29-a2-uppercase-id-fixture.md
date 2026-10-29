---
date: 2026-10-29
author: claude-agent
type: failure
card: A2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/test/letta/letta.test.ts
  - "pnpm --filter adapters exec vitest run test/letta"
supersedes: none
---

**What.** Two key-validation tests of the Letta adapter failed on their first run: an upper-case item id and an upper-case ref key were accepted.

**Why.** The tests upper-cased `01920000-0000-7000-8000-000000000001`, which has no hex letters, so the "upper-case" id was the lower-case id unchanged; the adapter was right to accept it and the fixture was wrong.

**Result.** The tests now use an id with hex letters (`...0000000000ab`); both pass, and the refusal they check fails them when the key check is loosened (mutation "a traversal id accepted", `packages/adapters/test/letta/letta.test.ts`).

**Consequence.** Any test of case rules on ids needs an id with letters in it.
