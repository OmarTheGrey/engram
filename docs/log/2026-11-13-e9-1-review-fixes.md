---
date: 2026-11-13
author: claude-agent
type: finding
card: E9.1
chapter: implementation
pillar: govern
hypothesis: none
evidence:
  - packages/core/test/unit/profiles/knowledge.test.ts
  - fixtures/profiles/knowledge-writes.json
  - packages/pi-package/profiles/knowledge.yaml
  - "pnpm --filter core exec vitest run test/unit/profiles/knowledge.test.ts"
supersedes: none
---

**What.** Review of PR #30 found three gaps: the fixture checked no deny reason; the model-note promotion test accepted an ask and named a reviewer it never used; nothing tested that tool content admitted to team cannot be promoted into org.

**Why.** A denial for the wrong clause passed, and org's first-hand rule was proven only for direct writes, not promotion (ADR 0026).

**Result.** Every fixture case now names its reason; the model-note test requires deny under `profile.knowledge/write/org`; a new test reviews a tool item into team, then has a reviewer promote it to org: denied. 19 tests pass; allowing `tool` in org fails 3.

**Consequence.** The profile comment now says contradiction is listed as in strict only, and that no conflict lint runs until L1 (duplicate) and L3 (contradiction) land.
