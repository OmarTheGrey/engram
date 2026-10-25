---
date: 2026-10-25
author: claude-agent
type: change
card: PX1
chapter: implementation
pillar: plane
hypothesis: H1
evidence:
  - packages/pi-extension/test/attacks.test.ts
  - packages/pi-extension/test/unit/bash.test.ts
  - packages/pi-extension/test/unit/tag.test.ts
  - packages/core/test/unit/plane/check.test.ts
  - packages/core/test/unit/plane/bypass.test.ts
  - packages/runner/test/model/cassette.test.ts
  - packages/runner/test/conditions.test.ts
  - packages/runner/test/run.test.ts
  - "pnpm --filter pi-extension test"
  - "ENGRAM_OFFLINE=1 make run CONFIG=research/configs/rn1-gatemem-probe.json"
supersedes: none
---

**What.** Fixes for the fifteen review findings on PR #7 (cards PX1 and RN1), applying decisions D10 to D13.

**Why.** Store CLIs and store files were reachable past the gate; another extension could put unfiltered memory before the model as governed; writes committed before the tool ran; stored text could forge the tag; conditions differed in prompt wording; cassette keys collided and live misses were unseeded.

**Result.** Each finding has a test that failed first: 15 of 18 session attacks failed on the PR's code and all pass now. Seven mutants were killed. `pnpm --filter pi-extension test`: 124 pass. The probe replays offline with 0 new calls, byte-identical across runs; cassettes and session fixtures were re-recorded once by `make fixtures`.

**Consequence.** `Plane.checkWrite` exists; `recordBypass` takes a route and keeps the attempt. The tag counts as C5's mechanism, pending the lead (ADR 0015).
