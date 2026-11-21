---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/vendor/gitleaks-rules.ts
  - NOTICE
  - docs/absorbed.md
supersedes: none
---

**What.** The generated gitleaks table lives at `packages/core/src/vendor/gitleaks-rules.ts`, is registered as a port (as the card says), and still carries gitleaks' MIT notice in its header and in `NOTICE`; Hindsight's and caura's notices are carried too, though they are ports.

**Why.** Biome skips `src/vendor/`, so the generator's JSON output stays byte-stable without editing `biome.json`. The regular expressions are gitleaks' and caura's text, translated; keeping a notice costs nothing and settles any doubt between port and copy.

**Result.** `docs/absorbed.md` has six rows; `NOTICE` names all six sources.

**Consequence.** Coverage of `policy/` does not count the data file, which has no branches.
