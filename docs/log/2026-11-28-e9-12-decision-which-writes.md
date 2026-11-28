---
date: 2026-11-28
author: claude-agent
type: decision
card: E9.12
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/consent.ts
  - packages/core/test/unit/policy/consent.test.ts
supersedes: none
---

**What.** Consent judges a write that records content into the scope: a first write, a move into it, or a rewrite with different content (core's normal form); a retire, and a rewrite keeping the content (status, close, grants, confidence, promotion in place), pass.

**Why.** A person who opts out of a topic must still be able to retire what was recorded before; refusing a retire would keep the content they want gone.

**Result.** Unit tests: a retire and a same-content rewrite of a covered item are allowed, a changed rewrite and a move into the person scope refused. The property guards require a covered retire and a covered restatement allowed.

**Consequence.** If wrong, a status change could record nothing new yet be blocked, or the reverse; nothing registered is reached.
