---
date: 2026-10-29
author: claude-agent
type: failure
card: A2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/review-verification.test.ts
  - packages/cli/src/run.ts
supersedes: none
---

**What.** `make test` was red on PR #20: "doctor and write print no part of the secret" ran a full doctor per URL case, about 24 s alone against the 30 s limit (review finding R2-5).

**Why.** The letta check added about 1.1 s per doctor run on top of a loop already slow for another reason (see the finding on the host `h`).

**Result.** Doctor's store probes can be replaced through `Io.doctorProbes`; the test passes skipping probes (a doctor run went from 1138 ms to 60 ms against 127.0.0.1) and, because its remaining cost is name lookups, also has a 60 s timeout of its own.

**Consequence.** Tests about something other than the stores pass cheap probes.
