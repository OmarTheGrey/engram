---
date: 2026-11-20
author: claude-agent
type: decision
card: RV5
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/pi-extension/src/extension.ts
  - packages/pi-extension/test/attacks.test.ts
supersedes: none
---

**What.** The pi extension exempts a tool from the no-bypass checks only when the definition pi holds under its name is the extension's own: each registered tool carries a parameter schema object copied at registration, and `pi.getAllTools()` must report that very object for the name. The memory_write gate in tool_call applies the same test.

**Why.** pi 1.3.0's `getAllTools()` returns `parameters: definition.parameters` from the tool registry it runs (first registration per name wins, SDK tools over extension tools), so object identity tells whose definition runs, without refusing at startup. The review offered either.

**Result.** A shadowed name is checked like any other tool; the extension's own tools still run unchecked (attacks.test.ts). Mutant: comparing names only turns the two shadowing cases red.

**Consequence.** If a later pi copied `parameters` in getAllTools, every Engram tool would be checked too: safe, but its path-free arguments would pass anyway.
