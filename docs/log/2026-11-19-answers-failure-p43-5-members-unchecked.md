---
date: 2026-11-19
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/scripts/label_audit_agreement.py
  - research/tests/test_label_audit.py
supersedes: none
---

**What.** The agreement script accepted any `--members`: with a three-member config and all three sheets present, `--members omar,mohamad` wrote a two-member report.

**Why.** `--members` was required and never compared with the config's `members`.

**Result.** `--members` now defaults to the config's members, and a set other than the config's is refused, naming both. Tests first: both new tests failed (no refusal; `--members` required), then passed; removing the refusal fails the refusal test. 23 tests pass. `docs/research/label-audit.md` says what the kit does.

**Consequence.** A three-member audit cannot be reported on two members.
