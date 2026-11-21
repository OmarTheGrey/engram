---
date: 2026-11-21
author: claude-agent
type: decision
card: E1.4
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/plane/crash-windows.test.ts
  - docs/absorbed.md
supersedes: none
---

**What.** EverOS's own tests of the failpoint modes are ported into the first block of crash-windows.test.ts rather than a new test file, and the register names the file at its real path, `src/everos/core/failpoints.py`.

**Why.** The absorption convention asks for the source's tests to come with a port; the card's file list has no separate test file for the helper. The card and brief name `core/failpoints.py`, which at commit e5778edb4cbac71e359ea375f38cf805aae32b0c lives under `src/everos/`.

**Result.** Seven helper tests (unarmed, raise n times, raise at a commit, pause, skip, crash, a commit point's appended events), all passing; the crash test also checks that another handle works after one died.

**Consequence.** If wrong, the helper's tests move to their own file; nothing else changes.
