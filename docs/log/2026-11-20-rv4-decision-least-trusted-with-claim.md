---
date: 2026-11-20
author: claude-agent
type: decision
card: RV4
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0004-provenance-and-source-trust.md
  - packages/core/src/plane/write.ts
supersedes: none
---

**What.** An adopted record's kind is the least trusted of three: the record's own claim, the plane's item of that id, and `import`. The reviewer proposed the last two only.

**Why.** The claim can only lower the kind, so adding it is narrower. Without it, a file the plane never saw that says `model` (an agent writing Engram metadata itself) would be adopted as `import`, raising it; with it, it stays `model`. "Unchanged" for keeping the plane's provenance means content and provenance both equal the plane's item; any other field edited (grants, validity) still keeps the plane's provenance only if those two match.

**Result.** The four kinds tested: `model` kept, `user` edited to `import`, a `model` item claiming `user` kept `model`, an unknown imported file `import`.

**Consequence.** Cost if wrong: an imported record that honestly claims `model` is adopted as `model`, so its owner cannot grant it.
