---
date: 2026-10-29
author: claude-agent
type: failure
card: B4
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/cli/src/doctor.ts
  - packages/cli/test/doctor.test.ts
supersedes: none
---

**What.** B4's first doctor change checked a manifest's `files` and then skipped its `selection`, and hashed only `cases.jsonl` of the MEM-INV-Bench fixture.

**Why.** The `files` branch ended with `continue`, written for a manifest with one shape; the scripts and goldens were not thought of as vendored data.

**Result.** Review R6-8. Doctor now checks both when a manifest has both, and the manifest lists `script.json`, `probe-script.json` and `upstream-golden.json`. Tests edit each of the three and add `files` to GateMem's manifest; putting the `continue` back fails the latter.

**Consequence.** Doctor covers every vendored file of the fixture.
