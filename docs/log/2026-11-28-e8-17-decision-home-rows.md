---
date: 2026-11-28
author: claude-agent
type: decision
card: E8.17
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/registry.ts
  - packages/cli/src/tui/screens/home.ts
  - packages/cli/test/tui/keys.test.ts
supersedes: none
---

**What.** `hook codex` and `hook install` are registered with `home: false`: Home reaches them from the hook setup screen (its Harness row and Install button), the palette and a typed line, not as rows of their own.

**Why.** Home at 120x40 was exactly full; two rows made it scroll, which docs/design/tui.md 8.1 forbids ("at 120x40 everything fits").

**Result.** The Home frames do not move; the keys test's 120x40 check now covers every Home row and names the two entries Home leaves to the hook screen.

**Consequence.** A new `CommandSpec.home` field; the other second-plan cards that add commands meet the same full Home (finding home-full).
