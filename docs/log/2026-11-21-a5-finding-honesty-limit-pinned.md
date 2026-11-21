---
date: 2026-11-21
author: claude-agent
type: finding
card: A5
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/test/conformance/meta.test.ts
  - packages/adapters/src/files/index.ts
  - docs/decisions/0005-bi-temporal-validity.md
supersedes: docs/log/2026-11-21-a5-finding-honesty-cases-necessary-not-sufficient.md
---

**What.** The `native_validity` honesty cases are necessary conditions only, and a meta-test now shows it: the fake, which keeps no validity of its own, passes all four with the flag forced on.

**Why.** The earlier entry rested on a throwaway probe and cited ADR 0031 and 0035; judging validity at the reader's time is ADR 0005 with its RV5 amendment (`valid_at`).

**Result.** The probe found fake, Mem0, files and Letta passing every case they ran with the flag forced on, because each stores the whole item. That holds for items carrying Engram metadata only: the files adapter derives `valid_from` from the modification time of a file without it, and would fail. The meta-test pins the fake's case.

**Consequence.** "Native" is not observable through the contract without an as-of argument; the ADR 0013 amendment says so, with both qualifications.
