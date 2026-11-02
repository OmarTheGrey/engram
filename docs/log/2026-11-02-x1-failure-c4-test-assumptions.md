---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/test/x1-gatemem.test.ts
  - packages/runner/test/conditions.test.ts
supersedes: none
---

**What.** Two new tests failed on their first run for reasons the code did not cause: C4's prompt was compared with C3's including each session's temporary working directory, and C4's GateMem read was expected to show the family member's own turn as `allowed`.

**Why.** Every session has its own `<cwd>` in the system prompt; and the RAG-Policy gate denies the asker's own question turn on the medical checkpoint (it carries no topic tag, and a family member may see only `schedule` and `logistics` items), while it allows the scheduler's turns (tagged `schedule`).

**Result.** The prompt comparison now masks the working directory; the read test expects the scheduler's turns `allowed` and the family member's `denied`, which is upstream's verdict (the golden test holds the gate to it).

**Consequence.** The gate can deny an asker their own words; C4's model sees that verdict, which is upstream's behaviour, not a port error.
