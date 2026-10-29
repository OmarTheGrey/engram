---
date: 2026-10-29
author: claude-agent
type: failure
card: E8.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/no-bypass.test.ts
  - packages/mcp/test/hook.test.ts
supersedes: none
---

**What.** Two mutation checks first survived: removing `notebook_path` from the path keys, and removing the CLI's input-shape check.

**Why.** The NotebookEdit tests used absolute paths, which the path-like rule catches whatever the key; the CLI's check is backed by the same check in `claudeCodeHook` and by its catch-all deny, so that mutant changes no answer.

**Result.** The NotebookEdit tests now use the relative `memory/n.ipynb`, and the mutant fails them; `claudeCodeHook` got its own tests for `null`, arrays, strings and a non-object `tool_input`, which fail when its check is removed (7 tests). The CLI's check stays as a second layer.

**Consequence.** Mutation checks are run against the layer that decides, not a redundant one.
