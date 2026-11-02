---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/core/test/unit/plane/retrieve.test.ts
  - packages/core/test/property/read-pipeline.test.ts
supersedes: none
---

**What.** A unit test named "the limit applies after the filter" did not catch a plane that cut to the limit before its read filter; only the core property test did.

**Why.** The test's hidden item sat outside the reader's reach, which removes it before the filter, so it tested reach, not the filter.

**Result.** A new unit test puts the best-matching item in the reader's own scope with its validity window closed, at limit 1; cutting before the filter now fails it and the property test. The old test is renamed for what it checks (reach). Ignoring the limit fails three core tests.

**Consequence.** Found by the mutation checks of the round-2 fix pass.
