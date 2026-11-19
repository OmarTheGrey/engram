---
date: 2026-11-19
author: claude-agent
type: decision
card: L2
chapter: design
pillar: research
hypothesis: H3
evidence:
  - packages/bench/src/faults/labels.ts
supersedes: none
---

**What.** The four classes are injected as nine subtypes: stale as expired-validity, source-changed and superseded; contradictory as conflict; misplaced as forbidden-class and wrong-scope; unsupported as missing-provenance, orphan and unsupported-claim.

**Why.** The plan names stale as "past its validity, or its source changed" and unsupported as "missing provenance, or a claim its provenance does not support"; a supersession stated only in text is the stale case keyed lints miss. Orphan (a cited source since retired) is unsupported: the note's support is gone. Wrong-scope (a personal fact in the role scope) has no lint of either tier built for it and is labelled with none, so the gap is counted, not hidden. The duplicate lint measures no class.

**Result.** Each subtype's class, keyed flag and expected lints are one table, `SUBTYPES`; the result counts each.

**Consequence.** If wrong: L4 reports per subtype too, so a regrouping needs no new set.
