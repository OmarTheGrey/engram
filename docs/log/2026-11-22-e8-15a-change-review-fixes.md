---
date: 2026-11-22
author: claude-agent
type: change
card: E8.15a
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/registry.test.ts
  - packages/cli/test/served.test.ts
  - packages/cli/test/scopes.test.ts
  - packages/cli/test/policy.test.ts
  - packages/cli/scripts/refresh-help-main.ts
supersedes: none
---

**What.** The E8.15a review fix pass: findings E8.15a-1 to E8.15a-12, each test first.

**Why.** The review found four weak or missing tests and eight smaller points; nothing critical.

**Result.** Registry test 45 passed. New: a `writes` table over all 26 entries, the effective server, env names, Object's property names, subcommand suggestions; read --item's unreadable and unknown ids give equal text and --json in process and over --server; every new command over a keyed server with ENGRAM_TOKEN, refused without it; policy ids `true`, `1.0`, `#x`, `a: b` round-trip. The reviewer's mutants M2, M4, M7 and M11 now fail tests, as do the effective server ignored, the prefix tie removed and hook's CLAUDE_PROJECT_DIR dropped.

**Consequence.** The reviewer verifies; the help snapshot changed by the two policy lines only.
