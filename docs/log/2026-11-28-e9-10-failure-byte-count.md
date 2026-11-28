---
date: 2026-11-28
author: claude-agent
type: failure
card: E9.10
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/doctor-discover.test.ts
supersedes: none
---

**What.** The default-walk test first expected 73 bytes for the fake home's auto memory; the files hold 28 and 25, 53 in all.

**Why.** A number written before the fixture's sizes were read.

**Result.** The expectation was corrected to 53 from the files' sizes; the test passes.

**Consequence.** None.
