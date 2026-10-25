---
date: 2026-10-25
author: claude-agent
type: change
card: E2.1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/load.ts
  - packages/core/test/unit/policy/load-edges.test.ts
supersedes: none
---

**What.** The policy loader gained tests for the edges of its YAML-to-node mapping (an alias on the error path, a key with no value, an empty document, a complex key), and an unknown complex key is now reported on its own line instead of line 1.

**Why.** The testing convention asks for full branch coverage on `policy/`, and the loader was at 41 of 48 branches; probing the uncovered branches showed the complex-key defect.

**Result.** The complex-key test failed first: the yaml package names a complex key by its flow text, while the loader compared it as JSON. The loader now renders the key through a YAML Document. 62 policy tests pass.

**Consequence.** Branch coverage is measured again at the top of the stack, where the coverage tool is installed.
