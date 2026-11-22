---
date: 2026-11-21
author: claude-agent
type: change
card: E1.6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/log.ts
  - packages/cli/src/signing.ts
  - packages/server/src/workspace.ts
  - packages/cli/test/log.test.ts
supersedes: none
---

**What.** engram log verify and engram log checkpoint, and every in-process CLI command (connect.ts, serve.ts) keeps the chain with node:crypto salts.

**Why.** The card's acceptance names engram log verify on a fixture log; the key is the operator's.

**Result.** On the fixture memory folder read through the plane: no checkpoint gives `engram log verify: UNSIGNED`, exit 3; a checkpoint signed with an operator key and the public key pinned gives OK, exit 0; an edited body gives `first broken link: links, chain position 2, event seq 1`, exit 1; a log rebuilt in place fails against the checkpoint kept with --out. signing.ts is octopus-blackboard's, copied (NOTICE).

**Consequence.** The help snapshot in packages/cli/test/commands.test.ts gained the two commands.
