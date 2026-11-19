---
date: 2026-11-19
author: claude-agent
type: change
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/scripts/label_audit_agreement.py
  - research/tests/test_label_audit.py
  - research/configs/label-audit.json
  - "uv run pytest research/tests/test_label_audit.py"
supersedes: none
---

**What.** The label-audit kit takes three members: the config names `omar`, `mohamad` and `shady`, and the agreement script rejects an item when at least two reject it and reports each pair's Cohen's kappa and Fleiss' kappa.

**Why.** The lead changed decision sheet item 16 to three members on 2026-11-19; the script refused anything but two.

**Result.** Before: exactly two members, one pair. After: two or three distinct members (`REJECT_QUORUM` 2), and for three `between_members` gives the items not labelled alike, `fleiss_kappa` and `pairs`. Tests first, 21 passing: Fleiss' kappa by hand (1/3), the rule mutated to "all three" and to "any one" each fails a test, and a two-member run on planted sheets gives byte-identical output before and after. The sampler needed only its docstring.

**Consequence.** No MANIFEST result uses the kit, so `make test-repro` is unaffected.
