---
date: 2026-11-28
author: claude-agent
type: failure
card: E1.9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/flows-surfaces.test.ts
  - packages/cli/src/tui/screens/data.ts
supersedes: none
---

**What.** A first rewording of the log verify screen's sentence broke flows-surfaces.test.ts, which looks for "The chain proves no event was changed".

**Why.** The sentence was rewritten from its start.

**Result.** The new wording keeps that start and adds the attestation; flows-surfaces and frames-surfaces pass (137 tests).

**Consequence.** nothing
