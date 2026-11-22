---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.11
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/load.ts
supersedes: none
---

**What.** The new preset lives in `EXTRA_PRESETS`, not `PRESETS`.

**Why.** `PRESETS` is the registered list: a test fixes it to strict, medium and permissive, and the runner's config schema and registered scripts enumerate it.

**Result.** `loadPreset` and `presetUrl` take either list; nothing that enumerates registered conditions sees `medium-trust`.

**Consequence.** The server's `--policy` name lookup and the dogfood report do not know it by name; a file path works.
