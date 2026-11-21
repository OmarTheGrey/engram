---
date: 2026-11-21
author: claude-agent
type: change
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - README.md
  - research/README.md
  - docs/glossary.md
  - docs/tasks/backlog.md
  - AGENTS.md
  - "make lint-docs"
supersedes: none
---

**What.** The README review's 24 findings fixed after merging main at `6171785d`, plus the reviewer's two outside notes.

**Why.** The review found stale state (E2.9 and X15 merged), overclaims (doctor, conformance skips, MCP reads, the log's protection) and missing modules, scripts and terms.

**Result.** All fifteen first absorb PRs described as merged and cards 16 to 30 as in progress. The research README lists all 21 MANIFEST rows. GH-39 is a known limit. `docs/glossary.md` gained project terms. AGENTS.md and CLAUDE.md name merit and tau2 in the `make bench` line, identically. The stale `ContentGuards` comment in `packages/core/src/schema.ts` got a backlog row instead of an edit (rule 5). One correction to the reviewer: `reproduce.py` takes no row argument, so the README says to rerun one row's script by hand. Link checker: 175 links in 26 files, none broken; the quick start reran as written.

**Consequence.** None.
