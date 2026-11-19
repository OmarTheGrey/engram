---
date: 2026-11-19
author: claude-agent
type: failure
card: RV2
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/research/h1-sessions.ts
  - research/tests/test_h1_pipeline.py
supersedes: none
---

**What.** The blind readings kit did not keep the two readers independent, and it accepted a dropped reply (RV-EXP-7).

**Why.** `make h1-table READINGS=` took one `h1-blind-readings/1` file that held both readers' verdicts. So the readers either filled one shared copy, each seeing the other's verdicts, or someone merged two copies by hand. `joinBlindReadings` never checked that every key entry had a reply. A filled copy with a reply removed was accepted, and that session stayed UNREAD and was excluded. Decision sheet item 14 and v1 say a missing verdict is refused.

**Result.** The pipeline test did exactly that. Its filled copy kept only the reply read as a HIT and dropped the other, and the converter accepted it ("1 UNREAD sessions decided by readings").

**Consequence.** Each reader now fills their own file, and a dropped reply is refused (`docs/log/2026-11-19-rv2-readings-kit.md`).
