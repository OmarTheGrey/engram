---
date: 2026-10-29
author: claude-agent
type: change
card: PX1
chapter: implementation
pillar: plane
hypothesis: H1
evidence:
  - packages/pi-extension/test/attacks.test.ts
  - packages/pi-extension/test/unit/bash.test.ts
  - packages/pi-extension/test/unit/paths.test.ts
  - packages/pi-extension/test/unit/tag.test.ts
  - packages/pi-extension/test/interception.test.ts
  - fixtures/sessions/s0-interception.jsonl
  - "pnpm --filter pi-extension test"
  - "ENGRAM_OFFLINE=1 make run CONFIG=research/configs/rn1-gatemem-probe.json"
supersedes: none
---

**What.** Second review round on PR #7 (cards PX1 and RN1): the verifier's defects 1 to 6, and execute's report of a deny at the commit.

**Why.** Shell spellings, Windows drive paths and nested arguments reached store files past the gate; forged tags in other messages passed as governed memory; pi's bug-report summary sent memory text; the branch-summary handler had no test.

**Result.** Every item has a test that failed first. The bash check normalises shell text, paths map drive forms, the context handler defuses foreign tags, and the session keeps placeholders. 24 mutants were run and all are killed, two of them only after a test was added. `pnpm --filter pi-extension test`: 197 pass. The session fixture was re-recorded by `make fixtures`; cassettes came out byte-identical.

**Consequence.** ADRs 0009 and 0014 record the changes and limits; the runner reads C5's items from the read's details.
