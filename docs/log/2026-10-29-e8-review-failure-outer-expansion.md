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

**What.** The single-quoted message exemption of R3-23 to R3-25 still let a command substitution run when an outer shell expanded first: inside a double-quoted `bash -c "..."` or `sh -c "..."` script, and in the body of a heredoc with an unquoted delimiter (`cat <<EOF`, also piped to bash). The verifier confirmed with a real shell that these read the store.

**Why.** The rule judged a message's quoting only in the innermost command; single quotes inside a double-quoted script or an expanding heredoc body are plain characters to the outer shell, which runs `$(...)` and backticks before the inner shell sees the quotes.

**Result.** Found by the verifier (finding R3-26). Fixed by tracking quoting through every enclosing script and withholding the exemption around unquoted heredocs.

**Consequence.** A quoting argument is judged across every shell that reads the text, not only the last.
