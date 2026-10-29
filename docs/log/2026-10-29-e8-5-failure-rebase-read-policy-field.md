---
date: 2026-10-29
author: claude-agent
type: failure
card: E8.5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/ui/test/view.test.ts
  - packages/server/src/contract.ts
  - "make lint"
supersedes: none
---

**What.** After rebasing PR 4 onto PR 3's final branch (`6f8bf66`), `make lint` failed: the UI's view test built a `ReadResponse` without the `policy` field PR 3 added to the read route.

**Why.** PR 4 started from PR 3's server commit, before the read response named the policy label. The test's response builder is typed by the generated client, so TypeScript 7 caught it (TS2741); vitest, which strips types, did not.

**Result.** The builder sets `policy`; `make lint` passes. The rebase's other conflicts (the lockfile, AGENTS.md and CLAUDE.md, the architecture's surfaces, ADR 0027's amendments) were merged keeping both sides; `make api` produced no diff.

**Consequence.** None; the view logic does not read `policy`.
