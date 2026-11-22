---
date: 2026-11-22
author: claude-agent
type: failure
card: L7
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/model/src/nli.ts
supersedes: none
---

**What.** Reading the runtime's version with `require.resolve('<name>/package.json')` failed with ERR_PACKAGE_PATH_NOT_EXPORTED for @huggingface/tokenizers.

**Why.** Its exports map does not list package.json.

**Result.** `installedVersion` now walks up from the package's entry point to the package.json whose name matches; the scorer refuses to build when the installed versions differ from NLI_RUNTIME.

**Consequence.** Nothing further.
