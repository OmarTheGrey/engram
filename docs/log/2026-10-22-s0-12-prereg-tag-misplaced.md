---
date: 2026-10-22
author: omar
type: failure
card: S0.12
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/research/preregistration.md
  - "git rev-parse prereg-v0^{}"
supersedes: none
---

**What.** The tag `prereg-v0` was first created and pushed on commit 7515b0d, the S0.11 typing fix, instead of the pre-registration commit.

**Why.** The commit was chained behind `make lint`, which failed on a line-length error in `research/tests/test_prereg.py`, so no commit was made; the tag command ran on its own line and tagged the previous commit.

**Result.** Minutes later the remote tag was deleted and `prereg-v0` recreated on e57ac82, the pre-registration commit, and pushed; `git rev-parse prereg-v0^{}` gives e57ac82. No one had fetched the wrong tag.

**Consequence.** A tag is created only in the same chain as the commit it marks, after the commit succeeds.
