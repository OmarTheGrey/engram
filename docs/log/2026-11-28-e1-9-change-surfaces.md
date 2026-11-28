---
date: 2026-11-28
author: claude-agent
type: change
card: E1.9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/log.ts
  - packages/cli/src/tui/screens/data.ts
  - packages/cli/test/log.test.ts
  - packages/cli/test/tui/__frames__/surface-log-verify-attestation-80x24-default.txt
supersedes: none
---

**What.** `engram log verify` prints the attestations check and a line `chain version N: A attestations chained, U not covered`; the TUI's log verify screen says the chain holds attestations, with a new frame of a broken one.

**Why.** The lead wants every change visible on the surfaces, and the report is where an operator reads coverage.

**Result.** log.test.ts: 7 of 7, including an attestation inserted after its event, exit 1, `first broken link: attestations, chain position 1, event seq 0`. Frames: 8 log-verify goldens updated on purpose, 8 new log-verify-attestation goldens; packages/cli/test/tui and the registry, parity and commands tests pass (706 tests).

**Consequence.** `--json` carries `version`, `counts.attested` and `counts.attestations_uncovered`.
