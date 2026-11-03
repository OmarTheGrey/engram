---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - research/scripts/label_audit_sample.py
  - research/scripts/label_audit_agreement.py
  - research/tests/test_label_audit.py
  - research/configs/label-audit.json
supersedes: none
---

**What.** The stop rule (D4) is strict: a benchmark stops when more than `stop_share` (0.10) of its items are rejected, so 6 of 50 or 4 of 38. `stop` is null until both members' key sheets exist, unless the rejections so far already exceed the threshold; then it is true.

**Why.** Item 16 says "more than 10 percent". GateMem's rule needs the keys. MEM-INV-Bench's family rejections can already decide a stop before phase 2.

**Result.** `agreement.json` gives `rejected` (`rule`, `refs`, `count`), `stop_share` and `stop` per benchmark. An item rejected on both family and keys counts once.

**Consequence.** A false `stop` means only that both members' key sheets are in.
