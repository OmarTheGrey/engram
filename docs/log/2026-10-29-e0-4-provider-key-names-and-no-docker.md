---
date: 2026-10-29
author: claude-agent
type: decision
card: E0.4
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0019-monorepo-tooling.md
  - packages/runner/src/model/provider-keys.ts
  - packages/runner/src/model/provider-keys.json
  - packages/runner/test/model/provider-keys.test.ts
  - scripts/test/no-docker.test.ts
supersedes: none
---

**What.** The provider key names reach `engram doctor` as a JSON file the runner generates from pi-ai, and ADR 0019 is amended for the no-Docker rule.

**Why.** The CLI may not import pi-ai. Importing the runner would load pi-coding-agent and the extension on every command and add a CLI-to-runner dependency; a hand-typed list would drift from pi.

**Result.** `make api` writes `packages/runner/src/model/provider-keys.json` from pi-ai's `findEnvKeys` (42 providers, 38 variable names, pi-ai 1.3.0); `make api-check` and a runner test fail when it differs from the installed pi-ai. Doctor tests `name in env`, never a value. `scripts/test/no-docker.test.ts` fails if a Makefile target, workflow or package script calls Docker.

**Consequence.** A pi pin move reruns `make api`. `findEnvKeys` comes from pi-ai's deprecated `compat` entry point; when pi removes it the generator needs another source.
