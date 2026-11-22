---
date: 2026-11-21
author: claude-agent
type: change
card: E1.6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/log/drift.test.ts
  - packages/core/src/log/redact.ts
supersedes: none
---

**What.** The drift test: an event redacted as offboarding redacts it keeps its skeleton hash, and every other single-field edit, removal or addition, at any depth, changes it.

**Why.** ADR 0038 decision 2: the list of committed parts must not drift from offboard.ts.

**Result.** 500 generated events keep their hash under redaction; 300 events and over 1,000 edits each change it; a real offboarding's redacted item and lint events keep their stored-commitment hashes. Mutation check: making redacted() also zero the confidence fails two of its four tests.

**Consequence.** A redaction added to offboard.ts or redact.ts that the skeleton does not know fails here.
