---
date: 2026-10-29
author: claude-agent
type: failure
card: E0.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/runner/src/model/provider-keys.ts
  - Makefile
  - "make api"
supersedes: none
---

**What.** Two missteps while building the provider key list and `make test-e2e`: the generator could not read pi-ai's version, and a `git checkout -- Makefile` undid the Makefile edits.

**Why.** pi-ai 1.3.0 does not export its `package.json` (`ERR_PACKAGE_PATH_NOT_EXPORTED`), so `make api` failed on its first run. The checkout was meant to undo one probe line added to test `scripts/test/no-docker.test.ts` red, but reverted the whole file.

**Result.** The generator records the runner's exact pi-ai pin from `packages/runner/package.json` instead; `make api` passes. The `test-e2e`, `api` and `api-check` edits were made again and every gate rerun after them.

**Consequence.** Probe edits for a red test are made on a copy, not on a tracked file that holds other edits.
