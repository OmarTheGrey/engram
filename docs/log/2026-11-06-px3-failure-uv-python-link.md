---
date: 2026-11-06
author: shady
type: failure
card: PX3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - "uv sync"
supersedes: none
---

**What.** `uv sync` in a fresh worktree failed with "Missing expected target directory for Python minor version link" for the managed CPython 3.12.16.

**Why.** The minor version junction `cpython-3.12-windows-x86_64-none` was recreated minutes earlier, likely by a concurrent session, and uv rejected it although the target held `python.exe`.

**Result.** Setting `UV_PYTHON` to the 3.12.16 interpreter's path with `--python-preference only-system` let `uv sync` finish; nothing in the repository changed.

**Consequence.** Nothing for the code. A member who meets the error can point `UV_PYTHON` at the managed interpreter.
