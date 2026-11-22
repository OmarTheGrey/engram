---
date: 2026-11-21
author: claude-agent
type: failure
card: E2.12
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - docs/deps.md
supersedes: none
---

**What.** Two tool failures on Windows: a Python edit of `docs/deps.md` in text mode rewrote every line end as CRLF, and the mutation script crashed decoding vitest's output as cp1252.

**Why.** Python on Windows writes `\n` as `\r\n` in text mode, and `subprocess` decodes with the locale's code page unless told otherwise.

**Result.** `file docs/deps.md` showed CRLF; `sed -i 's/\r$//'` restored LF and the diff is one line. The script now decodes UTF-8 with replacement, and its runs completed.

**Consequence.** Edits to shared files go through the Edit tool or a binary-mode write.
