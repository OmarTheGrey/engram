---
date: 2026-11-21
author: claude-agent
type: decision
card: E9.8
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/cli/src/commands.ts
  - packages/cli/test/claude-memory.test.ts
supersedes: none
---

**What.** A pasted Claude memory is a semantic candidate in the importer's person scope at confidence 0.7, valid from the import time unless it carries an ISO date.

**Why.** The text says nothing of class, confidence or scope.

**Result.** 0.7 passes every preset's person floor (strict 0.5) and is overridable with `--confidence`; `--scope` overrides the scope. memfix (MIT), named by the card for its importer mappings, was not consulted: the mappings here follow Claude's help text, and the report follows the CLI's own adoption report.

**Consequence.** None.
