---
date: 2026-11-22
author: claude-agent
type: failure
card: D2
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - packages/core/test/unit/distill/skill-spec/cases.json
  - packages/core/test/unit/distill/skill-spec/expected.json
  - "pnpm exec vitest run --project scripts"
supersedes: none
---

**What.** `scripts/test/no-docker.test.ts` failed on this branch: "no test source, script or vitest config calls a container runtime".

**Why.** The validator case `optional-fields` copied the specification's example `compatibility` line, which names a container runtime among its tools. The test reads every test fixture's text.

**Result.** On the lead's decision, the case now reads "Requires git, jq, make, and access to the internet", with no exemption. The upstream validator, rerun through `skill-spec-golden.py`, still gives no error for it, and only the case's sha256 in `expected.json` changed. The scripts project passes.

**Consequence.** Cases taken from the specification's examples are checked against the no-docker rule before they are committed.
