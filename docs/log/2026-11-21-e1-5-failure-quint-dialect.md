---
date: 2026-11-21
author: claude-agent
type: failure
card: E1.5
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - specs/commit.qnt
supersedes: none
---

**What.** The first drafts of the spec failed Quint's typecheck, and the first Apalache run failed to parse it.

**Why.** Quint reserves `head`, `item`, `next` and `Rec` as built-in names and has no string concatenation. Apalache needs a lambda, not a named operator, as foldl's argument ("Expected F to be a binary operator passed by name").

**Result.** Renamed to logHead, iid, advanced and StoreRec; the step names became a record (Step); foldl takes a lambda. Typecheck and Apalache both accept the spec.

**Consequence.** Nothing further; noted for the next spec written here.
