---
date: 2026-11-21
author: claude-agent
type: change
card: E2.9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/scripts/gitleaks-rules.ts
  - packages/core/src/vendor/gitleaks-rules.ts
  - "node packages/core/scripts/gitleaks-rules.ts"
supersedes: none
---

**What.** A committed generator reads gitleaks' `config/gitleaks.toml` at commit 5f6ec56 (sha256 pinned), translates each rule from RE2 to JavaScript, times it on adversarial inputs, and writes `packages/core/src/vendor/gitleaks-rules.ts`.

**Why.** Card E2.9 and ADR 0037: gitleaks' rules as generated data, only those that translate.

**Result.** 212 of 222 rules admitted. Every regex translated (a mid-pattern `(?i)` becomes a `(?i:...)` group reopened after each `|`, POSIX classes become ranges). Left out: 4 path-only rules, 1 with no regex, 5 over the backtracking bound. The generic rule is the REVIEW tier, all others BLOCK; gitleaks' digit rule for generic secrets, entropy floors, stopwords and allowlists are kept. The file sits under `src/vendor/`, which biome skips, so regeneration is byte-stable.

**Consequence.** A gitleaks update is a regenerated file and a new pin.
