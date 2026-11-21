---
date: 2026-11-21
author: claude-agent
type: change
card: E8.11
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/ui/src/diff.ts
  - packages/ui/src/TextDiff.tsx
  - packages/ui/test/diff.test.ts
  - test/e2e/item-page.e2e.test.ts
supersedes: none
---

**What.** The item page diffs two versions of the item, or of an ancestor it may see, side by side with jsdiff, line by line and word by word, and names the event that made the later version.

**Why.** A rewrite is a diff, and the event that made it is the explanation.

**Result.** `textDiff` in diff.ts is pure; `TextDiff` takes two labelled texts and nothing about items. A version is a state a visible event carries, or the read's state when no event carries it. The e2e test diffs the fixture's team item, Monday against Tuesday, and checks the event id.

**Consequence.** Card E8.10 (the scope snapshot diff) can reuse `TextDiff` and `textDiff` as they are.
