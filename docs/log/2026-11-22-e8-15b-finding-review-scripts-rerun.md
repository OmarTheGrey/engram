---
date: 2026-11-22
author: claude-agent
type: finding
card: E8.15b
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - node scratchpad/rv/all.py (the reviewer's s1 to s10 and m-* scripts under ConPTY)
supersedes: none
---

**What.** The reviewer's pseudoconsole scripts rerun over the fixed branch.

**Why.** Each finding was reproduced with them before its fix; this is the check after.

**Result.** On fresh copies of the reviewer's folders (its own runs had left a tui.json behind), s1 to s10 and m-default, m-no-color, m-high-contrast, m-ascii and m-wt exit 0; no run writes the reviewer's title, OSC 52 or SGR 31 bytes, and no Postgres password appears in any. Differences by design: in s4 and s7 an enter or `d` in a field moves on or types (M10, M14); each m-* script needed `--root mem`, which the M13 check now asks for before the dialog. s7 found two regressions of the fix pass, logged as failures.

**Consequence.** Nothing open from the review that the scripts can see.
