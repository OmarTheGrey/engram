---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.14
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/tag/src/tag.ts
  - packages/tag/test/tag.test.ts
  - packages/pi-extension/test/unit/entity-openers.test.ts
  - packages/ai-sdk/test/middleware.test.ts
supersedes: none
---

**What.** An opener written as a numeric character reference (`&#60;engram`, `&#x3c;engram`) is defused only on the framework adapters' path, and the pi path's `neutraliseTags` and `TAG_OPENER` are restored to main's (the lead's decision on review finding E8.14-13).

**Why.** The pi extension's context handler defuses every message a registered condition sends, so a wider pattern there would change a registered condition's prompt for any input holding those sequences, which the pre-registration guard forbids.

**Result.** `@engram/tag` exports `neutraliseTags`, byte for byte main's pattern, and `neutraliseEntities` and `neutraliseAcross` with the entity forms; `@engram/ai-sdk` uses the latter two. A pi-extension test shows `&#60;engram` passing through `neutraliseTags`, `defuseMessage` and `withoutMemory` unchanged, and fails when `neutraliseTags` takes the entity pattern (3 tests fail); the ai-sdk test shows the middleware defusing both forms.

**Consequence.** Extending the pi path to entity forms is a change for after the tag, by amendment.
