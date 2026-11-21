---
date: 2026-11-20
author: claude-agent
type: failure
card: RV7
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/no-bypass-posix.test.ts
supersedes: none
---

**What.** Review finding RV7-R7b: the leading `cd dir &&` rule replaced the cwd even when the command went on after a `;`, `||`, a single `&` or a newline.

**Why.** Only `&&` skips later words when the `cd` fails. After the other separators a word runs in the old folder, so `cd nope && ls; cat mem/a.md` read a store in the cwd and passed the check.

**Result.** All five of the reviewer's commands passed with cwd /home/u/proj and root /home/u/proj/mem. Now each is blocked in both shell modes; `cd src && grep -r TODO .` still passes. With the guard removed, 6 of the new tests fail.

**Consequence.** The replacement now needs the rest of the command joined by `&&` and pipes alone (`joinedByAndOnly`, `packages/core/src/no-bypass.ts`). ADR 0014's amendment states the rule.
