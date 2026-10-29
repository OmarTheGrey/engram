---
date: 2026-10-25
author: claude-agent
type: change
card: PX1
chapter: implementation
pillar: plane
hypothesis: H1
evidence:
  - packages/pi-extension/src/tag.ts
  - packages/pi-extension/test/attacks.test.ts
  - docs/architecture.md
supersedes: docs/log/2026-10-25-px1-extension-on-the-plane.md
---

**What.** Corrects what PX1 claimed about memory reaching the model: the tag.ts header said nothing unadmitted reaches the model through a memory result even if another extension rewrote it, and the architecture's read path said the context handler applies the same filter.

**Why.** Both were false (finding R7-2): the handler trusted any memory_read details, passed error results through, applied no filter, and another extension's memory_read was tagged as governed.

**Result.** Now the extension records what it produced per tool call and actor; the context handler shows only those results, rebuilt and escaped, and withholds every other memory_* result with an event (decision D11). It does not cover a handler that runs after Engram's. The header and docs/architecture.md say exactly that. The rest of the earlier entry stands.

**Consequence.** Claims about isolation from other extensions cite the attack tests, not the header.
