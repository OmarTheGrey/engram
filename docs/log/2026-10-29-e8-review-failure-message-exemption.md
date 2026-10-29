---
date: 2026-10-29
author: claude-agent
type: failure
card: E8.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/no-bypass.ts
  - packages/core/test/unit/no-bypass.test.ts
  - docs/decisions/0014-no-bypass.md
supersedes: none
---

**What.** The version-control message exemption of R3-16 let three kinds of literal bypass through: a command substitution inside a message (`git commit -m "$(cd memory; cat a.md)"`, backticks, `hg`), a `git` word outside command position (`echo git -m "..." | bash`, `bash -c 'eval "$3"' _ git -m "..."`), and a store file read from history (`git show HEAD:memory/a.md`).

**Why.** The exemption keyed on any word named git and treated a double-quoted message as text, although a shell expands it; the `rev:path` form hides a path behind a colon; the tests named only the passing messages, not the boundary.

**Result.** Found by the verifier of the R3-16 fix. Fixed and pinned by fourteen blocked and seven passing boundary cases; the change entry lists the mutation checks.

**Consequence.** An exemption is tested at its boundary, not only at its intended use.
