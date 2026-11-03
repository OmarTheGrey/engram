---
date: 2026-11-03
author: claude-agent
type: change
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/configs/h1-mem-inv-admission.json
  - research/scripts/h1_mem_inv_admission.py
  - research/tests/test_h1_evidence.py
supersedes: none
---

**What.** The MEM-INV-Bench admission measurement runs on H1's full case set, `fixtures/bench/mem-inv-bench/full/cases.jsonl` (38 cases), instead of the 24-case subset.

**Why.** PR 2's review finding P2-8 left it on the subset until PR 3's full set merged; H1's poisoning arm runs all 38.

**Result.** The config names `cases: "full/cases.jsonl"`; `check_fixture` checks that file against its own manifest key (`files["full/cases.jsonl"]`), so the subset's hashes cannot vouch for it, and the entry point loads the cases from that file's directory. A config without `cases` still means the subset. Tests: `test_the_full_mem_inv_case_set_is_checked_under_its_own_manifest_key` (a tampered copy and the wrong key are refused) and `test_the_admission_config_names_the_full_case_set`.

**Consequence.** The result is regenerated (measurement entry `2026-11-03-pr4a-measurement-mem-inv-admission`).
