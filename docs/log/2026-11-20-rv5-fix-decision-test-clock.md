---
date: 2026-11-20
author: claude-agent
type: decision
card: RV5
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/commands.ts
  - packages/cli/src/run.ts
  - packages/core/scripts/faults.ts
  - packages/cli/test/clock.test.ts
supersedes: docs/log/2026-11-20-rv5-decision-cli-at.md
---

**What.** In process, `--at` on `engram write`, `promote`, `retain` and `lint` is a usage error unless `--test-clock` is also given; over `--server` it is refused even with it. `engram read --at` is unchanged (its valid_at, which sweeps nothing).

**Why.** The review asked for a flag clearly named for tests or fixtures. Checked: `make fixtures` and `make test-e2e` pass no `--at`; the fault workspace prints `engram lint ... --at`, now with `--test-clock`; `packages/cli/test/client.test.ts` passes it in two cases.

**Result.** clock.test.ts covers every command, the retain case and the flag; mutants (no refusal, flag ignored) turn it red.

**Consequence.** Supersedes rv5-decision-cli-at for the in-process case; ADR 0027's amendment and `docs/dogfood.md` say so.
