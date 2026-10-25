---
date: 2026-10-25
author: claude-agent
type: failure
card: A4
chapter: limitations
pillar: plane
hypothesis: H4
evidence:
  - packages/adapters/test/conformance/broken.ts
  - packages/adapters/test/conformance/meta.test.ts
  - "pnpm exec vitest run packages/adapters/test/conformance/meta.test.ts"
supersedes: none
---

**What.** The conformance suite as first written for card A4 passed twelve adapters with planted bugs, among them dropping grants, nulling the validity window, truncating content to 200 characters, listing by scope prefix and accepting another adapter's ref on delete.

**Why.** Its corpus used only plain short text with empty grants and open validity, and most cases compared ids or a few fields, never the whole item.

**Result.** Run against the old cases, the meta-test failed on all twelve variants (12 of 13 tests failed); after the corpus and the whole-item comparisons were added, all twelve fail the suite and the honest fake passes it.

**Consequence.** The meta-test stays committed, so a weakened case or corpus fails the build. Store results on H4 rest on a suite that checks every field.
