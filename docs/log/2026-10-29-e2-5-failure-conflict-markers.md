---
date: 2026-10-29
author: claude-agent
type: failure
card: E2.5
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/conventions/testing.md
  - scripts/check-prose.ts
  - fixtures/ci/conflict-markers.txt
  - "make lint-docs"
supersedes: none
---

**What.** Rebasing card E2.5 onto PR 4's fix pass left merge-conflict markers in docs/conventions/testing.md, a lead-owned file, and they were committed.

**Why.** Git reported conflicts in two files only; the third was staged with `git add` of the whole docs folder without a look, and no gate scanned for markers.

**Result.** Review P5 found them (P5-8). The paragraph is merged, and `scripts/check-prose.ts`, run by `make lint-docs`, now fails on any line in a tracked text file that is a conflict marker; it flagged the committed ones before the fix, and its red fixture is fixtures/ci/conflict-markers.txt.

**Consequence.** A rebase that leaves markers fails the docs gate.
