---
date: 2026-11-21
author: claude-agent
type: failure
card: none
chapter: implementation
pillar: research
hypothesis: H3
evidence:
  - docs/research/preregistration.md
supersedes: none
---

**What.** H3's fallback was registered in its Analysis but not its Test field (verification finding V-6).

**Why.** The rule was placed where the bound was.

**Result.** The Test field states it too.

**Consequence.** A rule that changes the primary test goes in the Test field.
