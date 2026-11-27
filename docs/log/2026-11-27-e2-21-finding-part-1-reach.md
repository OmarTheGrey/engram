---
date: 2026-11-27
author: claude-agent
type: finding
card: E2.21
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - git diff --name-only origin/main...e2-14-grant-cap
  - research/results/MANIFEST.md
  - docs/tasks/E2.21.md
supersedes: none
---

**What.** What part 1 can reach, checked against the pre-registration guard.

**Why.** The grant cap moves GateMem, so it must not be on by default, and part 1 must move no MANIFEST row, fixture or cassette.

**Result.** `git diff --name-only origin/main...HEAD` lists 13 files: five test files (core `write-grants.test.ts`, server `errors.test.ts`, CLI `promote.test.ts`, MCP `mcp.test.ts`, pi-extension `surface.test.ts`), the card, backlog row 269, and log entries. No file under `packages/*/src`, `research/`, `fixtures/`, `sdk/` or `packages/ui/src/api/`. The tests read `sdk/openapi.json` and the twin profile and write nothing back. The cap is not built, so no preset, profile or config changes. What part 1 touches is `make test` and the five acceptance commands; `make test-repro`, `make api-check`, the cassettes and the inspector cannot see it.

**Consequence.** No MANIFEST row, fixture or cassette moves. The cap's reach belongs to part 2, listed in its step 7.
