---
date: 2026-11-22
author: claude-agent
type: change
card: E8.14
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/read.ts
  - packages/tag/src/tag.ts
  - packages/kit/test/conformance/suite.ts
  - packages/ai-sdk/test/ai-package.test.ts
  - docs/decisions/0047-by-id-read-and-scope-list.md
  - "make test-invariants"
supersedes: none
---

**What.** Card E8.14's review fix pass: six important findings (E8.14-1 to -6) and six minor ones (E8.14-7 to -12) fixed, test first, one commit each.

**Why.** The review found a by-id read that confirmed an id exists, leak tests that skipped the reason, a suite that passed a source-keeping adapter and held a case that could not fail, pi in the kit's install, no ADR, and six smaller defects.

**Result.** A by-id read drops a candidate reached only through a grant that does not admit it; leak tests compare whole answers; the suite walks the dependency closure; the tag moved to a pi-free `@engram/tag`; ADR 0047 proposed with item 65; split and entity-written openers defused; scope listings counted apart; the recall name configurable; reasoning parts kept; `/scopes` syncs; a test under the real `ai` 7.0.163. The reviewer, as second reviewer, approved the invariants additions.

**Consequence.** The lead decides ADR 0047.
