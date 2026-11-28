---
date: 2026-11-28
author: claude-agent
type: change
card: E9.12
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/pi-package/profiles/twin.yaml
supersedes: none
---

**What.** Added a commented consent example to the twin profile, left absent.

**Why.** The card's step 3: an example in the twin profile, left absent.

**Result.** The profile parses to the same policy (load-options.test.ts: the profile sets none of the new keys); consent.test.ts uncomments the example and checks it loads and refuses a topic and an Incognito write.

**Consequence.** A dogfood member copies the block and names their own scope.
