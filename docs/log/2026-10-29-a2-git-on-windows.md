---
date: 2026-10-29
author: claude-agent
type: finding
card: A2
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/test/conformance/registry.ts
  - "pnpm --filter adapters exec vitest run test/conformance -t letta"
supersedes: none
---

**What.** Git for Windows sets `core.autocrlf=true` in its system configuration, and each git process costs about 20 to 80 ms on this machine, so a MemFS write (add and commit) takes about 150 ms.

**Why.** Card A2 needed both facts to keep item bytes exact and the suite fast.

**Result.** LF-only item files are untouched by `core.autocrlf` on add, and a CRLF checkout is read back as LF (`packages/adapters/test/letta/letta.test.ts`). The Letta conformance cases take about 38 s here, the corpus cases about 2.6 s each; the registry copies one initialised template repository per case instead of running `git init`.

**Consequence.** Every later suite that writes many items through the Letta adapter shares the template (`freshLettaRepo`) and keeps its corpus small; Linux CI spawns faster.
