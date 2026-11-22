---
date: 2026-11-21
author: claude-agent
type: decision
card: E8.14
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/deps.md
  - packages/ai-sdk/package.json
supersedes: none
---

**What.** `@ai-sdk/provider` 4.0.36 is the pinned development version, the peer range is `>=4.0.36 <5`, and the `ai` package is not a dependency.

**Why.** 4.0.36 (published 2026-11-05) is the newest release at least two weeks old, since 4.0.37 is exactly fourteen days old. The middleware needs only the provider's types, and rule 15 prefers a scripted model of our own to the SDK's mock.

**Result.** The Apache-2.0 licence was read in the 4.0.36 tarball's LICENSE. The tools are plain objects with a zod input schema, the shape `ai`'s `tools` option takes; they are not checked against `ai`'s own types.

**Consequence.** If `ai` changes its tool shape the tools need an update; a later card may add `ai` as a dev dependency to test `wrapLanguageModel` itself.
