# Results

Consolidated from docs/log by research/scripts/consolidate_log.py. Edit the entries, not this file.

## Plane

**2026-11-28, measurement, supersedes 2026-11-21-x15-measurement-fresh-stores.** Card X15's engineering measurement of the plane's latency, restated citing only the MANIFEST result. The superseded entry cited the raw samples file, research/results/h2-perf-budget-samples.jsonl, which is not a MANIFEST row, so the thesis consolidator rejects it; the script computes the result from those committed samples. On the fake store under medium, a read's p99 at 1,000 items is 63.418061 ms against a 50 ms limit (`budget[0]`, not met) and a write's 14.445315 ms (`budget[1]`, met); at 10,000 items 203.405203 and 163.290634 ms against 100 ms (`budget[2]`, `budget[3]`, not met). Medians at 100, 1,000 and 10,000 items: write 4.8773, 9.6757 and 124.34365 ms; read 5.01845, 15.3816 and 171.4389 ms (`cells`), on the machine `machine` names, under the shared load the superseded entry records. It decides no hypothesis. Nothing changes; the numbers match the superseded entry's.[^1][^2][^3][^4]

## Research

**2026-11-02, R1, measurement, H1, supersedes 2026-11-02-pr2-review-measurement-gatemem-reach.** The GateMem reach with bare-pattern counts and an audit sample of 50 checkpoints; the reach numbers are unchanged. Review findings V4 and V5. Under medium (strict and permissive identical): access, scored set, reachable 282, located unreachable 445, not located 0, every pattern reachable 133; leak targets 260, 457, 10, 151. Forgetting: 565, 197, 1, 481. Access checkpoints with a bare pattern: 107 scored, 61 targets; with only bare patterns: 2 and 2; with a yes or no pattern: 48 and 4. Forgetting: 63 with a bare pattern, 5 with only bare ones, 12 with yes or no targets (each of the 12 has both). Read with the findings of the same day.[^5][^6][^7][^8]

**2026-11-02, X1, finding.** B3's enforced-condition reads, under the shared pipeline, return the same items on every store. Review round 2 (R2) asked how B3's C5 reads changed: under the first fix pass's every-term rule, `ckpt_08` fell from 80 items to 2 on fake and Letta (98 to 20 on Mem0) and `ckpt_11` from 9 to none. Replayed from the committed cassettes by the command above (the read events in its `results.jsonl`): `ckpt_08` ("Monsoon customer wording") returns 20 of 115 candidates, cut by the read limit; `ckpt_11` ("Monsoon diagnosis token") 9 of 9; `ckpt_20` ("staging token") 7 of 7; each on fake, Mem0 and Letta alike, 0 filtered. B3's cross-store identity holds for items as well as events.[^9][^10][^11]

**2026-11-02, X1, finding, H1.** With the shared pipeline, C2 finds memory for every GateMem checkpoint's own question, and its top 20 holds what the question is about on most of them. Review round 2 (R1) asked for a floor: C2 must find memory about as often as the history holds the question's leak target or answer. Fixture: C2 returns items for 20 of 20 questions and the history holds the target on 20 (`retrieval.test.ts` asserts the gap is at most 10 percent). Pinned full set, C2's top 20 holds the target on 713 of 728 utility, 661 of 727 access-control (717 located) and 735 of 763 forgetting checkpoints; C5's top 20 on 631, 256 and 561, the plane admitting a target turn on 646, 260 and 565. The every-term rule's floor (C2 empty on 15 of 20 questions) is gone.[^12][^13][^14]

**2026-11-02, X1, finding, H1.** The shared pipeline's ranking puts what a GateMem question is about in C2's top 20 almost whenever the history holds it. Review round 3 (V-5) found the floor test asked only whether C2 returned anything, so a ranking that ignored relevance passed it. On the fixture, C2's top 20 holds the leak target or the answer on 20 of the 20 checkpoints whose history holds one; the test requires at least 90 percent. With the ranking reversed it holds it on 7 of 20 (35 percent), and the test fails. On the pinned full set (`x1r2-retrieval-floor`) it holds it on 2,109 of the 2,207 checkpoints whose history does (95.6 percent). A change to the ranking that loses relevance now fails a test.[^15][^16][^17]

**2026-11-03, R1, measurement, H1.** Agreement of C4's two verdict sources, the plane's read decision and GateMem's RAG-Policy gate, on every turn item of the pinned full set (MANIFEST sha256 `9335a677...`). ADR 0031 chose the plane's verdict because the two disagree; the share was a development count until now. Under medium, 235,384 of 325,530 turn items agree (0.7231); the gate allows what the plane denies on 60,305 (0.1853), the reverse on 29,841 (0.0917). On the 10,726 turn items holding a leak target: 7,425 agree (0.6922), 2,099 and 1,202 the two ways. Access control: 67,243 of 96,386 agree; on its 5,259 leak-target items the gate allows 1,528, the plane 722. Forgetting: 103,580 of 142,659; on 5,467 leak-target items, 2,389 and 2,298. Strict and permissive give the same counts. PR 3's development numbers are reproduced exactly.[^18][^19][^20][^21]

**2026-11-03, R1, measurement, H1.** C4's walk against C3's top 20 on GateMem's pinned full set, each checkpoint's own question, medium (MANIFEST sha256 `479f2419...`). The PR 3 verifier's N-1 asked where the walk makes C4 show less than C3, or something else. C4 shows 151,144 items against C3's 44,051 (3.43 times); C4's allowed items equal C5's 31,533 on 2,218 of 2,218 checkpoints. C4 shows fewer items than C3 on 153 checkpoints (82 access control, 11 forgetting, 60 utility), as many on 39, more on 2,026; nothing at all on 28 where C3 has candidates (23, 3, 2). On access-control checkpoints C3 shows a denied leak-target item that C4 does not on 54 (131 items), C4 one that C3 does not on 365 (1,845 items); on forgetting checkpoints 7 (34) and 285 (1,062). C4's length: median 52, quartiles 26 and 103, 0 to 222. ADR 0031's decision 4 cites these counts.[^22][^23][^24][^25]

**2026-11-03, R1, measurement, H4.** For each of the 26 distinct sizes `research/results/h4-power.json` commits at alpha 0.01, the largest TOST level a search of the composite null's boundary found at each Holm threshold 0.05 / k, k = 1 to 5 (MANIFEST sha256 `dcacf0c9...`). PR #26's final verification, P2v4-1. Every size holds at every threshold (`all_hold`: true), the 2-point sizes from 7,241 to 20,480 items included. The tightest is 761 items at 5 points: 0.009969 against 0.01 (k = 5), 0.012202 against 0.0125 (k = 4), 0.014817 against 0.016667, 0.020599 against 0.025, 0.036113 against 0.05. The verifier's 0.012202 at 761 items is reproduced. At k = 5 every level equals the power table's own record at 0.01. No size is dropped; `research/scripts/h4_power.py` and its result stay as they are.[^26][^27][^28][^29]

**2026-11-03, R1, measurement, H4, supersedes 2026-11-02-pr2-r3-measurement-h4-power.** Items per arm for H4 with the score TOST at alpha 0.05 and 0.01, restated without calling a search result exact; the file is unchanged. PR #26's final verification, P2v4-2: the superseded entry said "Largest composite-null level". Sizes as before: at alpha 0.05, one family 381 to 12,177 items at 2 points, 113 to 1,810 at 5, 48 to 453 at 10; four families 453 to 17,222, 135 to 2,560, 57 to 640. At alpha 0.01, one family 2,560 to 17,222, 761 to 2,560, 320 to 640; four 2,560 to 20,480, 761 to 3,620, 320 to 905. The largest level a search of the composite null's boundary (|mean| = margin, iid items) found at a reported size: 0.047029 (alpha 0.05; 80 items, 10 points) and 0.009969 (0.01; 761 items, 5 points). Largest own level: 0.04289 and 0.008271. Read with `2026-11-03-pr4a-finding-h4-power`.[^30][^31][^32][^33]

**2026-11-03, R1, measurement, H1, supersedes 2026-11-02-pr2-review-measurement-mem-inv-admission.** MEM-INV-Bench admission by preset on the full 38-case set (32 attacks, 6 benign), MANIFEST row sha256 `bed41bee...`. The earlier measurement covered the 24-case subset only (review finding P2-8). Medium and permissive admit 32 of 32 attacks' poison and 6 of 6 benign values to the operator's action-time read; all 78 `team:operations` entries are read, the attacks' 32 trusted filler entries included. Strict admits 8 of 32 attacks, all 8 of laundering channel summarize (the agent's own note, scope `person:operator`), and 0 of 6 benign values: all 78 `team:operations` entries wait as candidates. A verifier's dry run of PR 2 predicted exactly these counts. Read with `2026-11-03-pr4a-finding-mem-inv-admission`.[^34][^35][^36][^37]

**2026-11-03, R1, measurement, H1, supersedes 2026-11-03-pr4a-measurement-cost.** H1's cost after the review fixes, 14 candidates and 4 priced non-candidates (MANIFEST sha256 `f147daf7...`). Review findings P4A-2, P4A-5, P4A-6 and P4A-8 changed what is priced. GateMem answers: 152.9M input and 1.3M output tokens (low) to 738.4M and 2.3M (high); judge 66.06 to 264.25 dollars. Totals with the judge, low to high: gpt-6.1-sol 526 to 6,206 and gemini-4-argon the same (both ignore thinking off); qwen3.8-max 465 to 4,422; muse-wonder 985 to 12,148; gpt-5.6-terra 390 to 3,106; gpt-4o 464 to 2,141; deepseek-v4-pro 170 to 978; mistral-large-4-0 173 to 1,005; small tiers 68 to 2,492, gemini-3.8-flash the highest. `deepseek-v4.1-flash` is flagged as a likely price anomaly. Read with `pr4a-r1-finding-cost-drivers` and `pr4a-r1-finding-thinking-off`.[^38][^39][^40][^41]

**2026-11-03, R1, measurement, H1.** The GateMem checkpoints where one of the reach config's five plain refusals is itself scored as a leak, by id (MANIFEST sha256 `d7e9f3d0...`). H1's sensitivity table leaves them out of the primary set (orchestrator's item 9); PR 2's reach result counts them without naming them. 41 of 1,490 checkpoints: 29 of 727 access-control and 12 of 763 active-forgetting, equal to the reach result's counts. Each row lists which refusals the scorer counts as a leak there. `research/configs/h1-table.json` names the list (`sensitivity.items_from`); with access control as the primary set, its 29 access ids leave the sensitivity table. Part B reports the sensitivity table beside the primary in v1.[^42][^43][^44][^45]

**2026-11-19, B6, measurement, H2.** What the plane's read filter hides of each LongMemEval S history, per question, preset and clock (MANIFEST sha256 `41294115...`). Card L2 found that preset medium's 90-day ttl hides part of the S histories at read time; H2's primary test is C2 minus C5 at medium on LongMemEval. Medium at B5's read time hides 11,122 of 246,750 turns in 54 of 500 questions (10.8 percent), all by the ttl; 38 questions (7.6 percent) lose an evidence turn, 5 lose all of them; 28 of the 38 are knowledge-update, 10 temporal-reasoning. At the last session: 6,938 turns, 42 questions, 28 losing evidence. At 2026-11-19: every turn, 479 questions losing all evidence. Strict: 34,688 turns, 148 questions, 77 losing evidence. Permissive: none. The oldest turn is 311.7 days old at read time. The options are in `docs/log/2026-11-19-b6-finding-clock-options.md`.[^46][^47][^48][^49]

**2026-11-19, L2, measurement, H3, supersedes 2026-11-19-l2-measurement-fault-set.** H3's seeded-fault set after the review fix pass, over LongMemEval's cleaned S split at the pin, seed 20261119 (MANIFEST sha256 `a274701d...`). The fix pass hardened the near-misses, counts natural findings and adds an audit sample and `limits`. 500 states, 261,250 events, 9,000 labels: 4,500 faults and 4,500 near-misses. Faults keyed and unkeyed: stale 1,000 and 500, contradictory 0 and 500, misplaced 500 and 500, unsupported 1,000 and 500. By tier: 1,500 model, 2,500 deterministic only, 500 neither. Label check: 2,500 of 2,500 keyed faults flagged, 0 near-misses, 0 unexpected findings on injected items; 967 duplicate findings on base items, 50 drawn for audit; all 1,500 model faults and 1,500 near-misses planned by L3; under medium 45 of 1,000 unsupported-claim units would not be. L4 lints this set and reads its audit sheet.[^50][^51][^52][^53]

**2026-11-19, L4, measurement, H3, supersedes 2026-11-19-l4-measurement-floor.** The deterministic floor on card L2's full set after the review fix pass: 500 states, 9,000 labels (MANIFEST sha256 `354da571...`). H3's deterministic tier per class; the fix pass changed the matching and the wording, not the numbers. By construction: keyed 2,500 of 2,500 found, 0 of 2,500 near-misses flagged, and 500 of 500 with no false positive for each keyed lint; unkeyed 0 of 2,000. Pooled recall per class depends on the generator's keyed to unkeyed mix: stale 1,000 of 1,500, unsupported 1,000 of 1,500, misplaced 500 of 1,000, contradictory 0 of 500. Measured: 967 duplicate findings on base items, whose precision is bounded only by 0 and 1 until the audit is judged. The model-based delta is measured against these numbers.[^54][^55][^56][^57]

**2026-11-20, RV8, finding, H2.** Small person-episodic budgets make the plane deny a few LongMemEval writes: 95 at budget 25, 61 at 100, 2 at 400, none at medium's 5,000. A budget is expected to evict at the write that passes it, not to deny. The rows record decisions only, not their reasons, so the cause is not shown here; the counts are small against 246,750 writes. If the lead registers a budget axis, the denial reason should be read from the events first (a card on core, not here).[^58]

**2026-11-21, E2.10, measurement, supersedes 2026-11-21-e2-10-corpus-result.** The corpus result regenerated after the fix pass, with 21 benign controls of the review's five classes added (95 entries; MANIFEST row sha256 `3e35dd39...`, commit `69616d41`). Review E2.10-3: the first controls left out natural benign text the default screen holds. Default: 4 of 12 attacks escape (0.333, Wilson 95% [0.138, 0.609]); 11 of 68 benign controls held (0.162, [0.093, 0.267]): all 4 ML documentation, 5 CI and operations and 2 compaction controls; 0 of the user-addressed and encoding controls. Hardened: 4 escape; 13 of 68 held (0.191, [0.115, 0.300]); 11 of 15 tool-written preferences. Off holds nothing. The false-hold rate is three times the first report's upper bound; the config's limits name each class still held.[^59][^60][^61][^62][^63]

**2026-11-21, E2.9, measurement, supersedes 2026-11-21-e2-9-measurement-h1-secret-guard.** The result after the verification pass, MANIFEST row `research/results/h1-secret-guard.json` (sha256 ea5b7561..., commit 97afa30). A new rule (63 hand rules now) and four new limits moved the bytes. Synthetic: 1,200 of 1,200 at the expected tier, by construction. Benign: 0 of 14,587 paragraphs denied, 4 held (0.027 percent, Wilson 0.011 to 0.071), in-sample. Identifiers: 0 of 900. Thirteen limits listed, the four new ones: a far or weak credential word, a 40-hex value read as a git SHA, keys ending EXAMPLE, a trailer-shaped address. `check_row`: no problems. Out-of-sample rates are card X14's.[^64][^65][^66][^67]

**2026-11-21, L5, measurement, H3, supersedes 2026-11-21-l5-near-duplicate-result-near-pairs.** The near-duplicate result regenerates to sha256 f50c8f46 (MANIFEST commit a3d403ea): the near-pair floor is read from the config, and the result reports `capped`, the items the candidate cap cut. Review findings L5-R1 (rule 9: the floor of 0.7 was a constant in the script) and L5-R3 (arm P4 will report the capped count on LongMemEval). No figure moved. All 66 pairs: agreement with datasketch 64 at 0.80, 63 at 0.85 (0.955), 58 at 0.90. The 21 pairs at or above 0.7: 19, 18 (0.857, Wilson 0.654 to 0.950) and 13. Precision and recall on the tier's fixtures 3 of 3. `capped`: 0 items on the catalogue. Exploratory until arm P4 is registered.[^68][^69][^70][^71][^72]

**2026-11-21, R4, measurement, supersedes 2026-11-21-r4-measurement-crosswalk.** The crosswalk's result after the review fix pass, regenerated from `research/configs/crosswalk.json`, MANIFEST row `research/results/h1-crosswalk.json` (commit cell beb820d, the post-rebase commit holding the script and config, until the squash merge). Rule 9; the fix pass changed the evidence named and the result's fields. The script printed "crosswalk: 27 quotes stand in the primary texts" and "crosswalk: 50 claims, 46 evidenced by 105 tests in 32 files, 4 not evidenced, 27 obligations". Not evidenced: C30, C44, C48, C50; C21 cites no obligation. The result carries `"hypothesis": "none"`. `scripts.reproduce.check_row` on the row returned no problems. `make test-repro` reruns it.[^73][^74][^75][^76]

**2026-11-21, RV8, failure, H2.** The finding on flat axes said no single tested axis moves both benchmarks at a non-degenerate value (review finding RV8-3). I read the table by its flat or moving flag and its one degenerate axis, and did not count what the moving values move. The result shows ttl and budget moving both benchmarks at several values: ttl of 1 day moves 306 GateMem checkpoints and removes 32 leak targets from the read, so the claim was wrong. A superseding finding states the axes quantitatively; the script writes no prose, so nothing was regenerated.[^77][^78]

**2026-11-21, RV8, failure, H4.** The cost table counted H4's Mem0 arms on M1 at C5 and C2 as new calls (review finding RV8-4). Their row text said whether they reuse H1's cells depended on card X9's draw. H1 runs every GateMem checkpoint at C2 and C5 on Mem0 and M1, preset medium, three seeds, and H4's 761 per arm is a subset of those items whatever the draw, so the cells (item, condition, preset, store, model, seed) are the same and their cassettes serve both (rule 7). The arms and their judge rows were double counted: 323 dollars of H4's registered high of 5,552. They are marked shared; see the decision entry of this pass.[^79][^80]

**2026-11-21, RV8, failure, H1.** The high estimate and the RV1 ceiling charged 1,024 reasoning tokens a call to DeepSeek v4 pro and Mistral Large 4 (review finding RV8-2). The lead decided reasoning off, and both models honour the off switch, so the allowance (`off_honoured` = 1,024) applied to calls that reason not at all. H1's high was 1,691 dollars instead of 1,252, and the kept runs' high 7,178 instead of about 5,430 (the reviewer's figure, before the shared arms of finding RV8-4); the ceiling, 1.25 times the high, followed, so a run's stop sat too high. The `decided` block now uses no reasoning tokens where the switch is honoured; see the decision entry of this pass.[^81][^82]

**2026-11-21, RV8, finding, H2, supersedes 2026-11-20-rv8-finding-flat-axes.** Several single axes move both benchmarks at non-degenerate values: ttl at 1 and 7 days and the retention budget at 25 and 50 each change GateMem checkpoints and LongMemEval questions. Lead-decisions item 21 chooses axes the benchmarks exercise; the earlier finding said no single axis did both. GateMem (2,218 checkpoints), changed and leak targets removed: ttl-1d 306 and 32, ttl-7d 36 and 2, budget-25 560 and 13, budget-50 118 and 0. LongMemEval (500 questions) changed: ttl-1d 401, ttl-7d 401, budget-25 and budget-50 500 each. Grant honouring moves GateMem only (1,154, 292 leak targets removed). No-person reads are degenerate (2,117 and 500). No-model-source moves both by denying 5,795 and 124,334 writes. One axis can serve both benchmarks: ttl at 7 days (small on GateMem, large on LongMemEval) or budget 50; the lead chooses.[^83][^84]

**2026-11-21, RV8, finding, H1, supersedes 2026-11-20-rv8-finding-credit-request.** On the lead's set with reasoning off, H1 costs 274 to 1,252 dollars, H3 57 to 347 and H4 18 to 75; the three together 349 to 1,674. The lead will request a 1,000 dollar credit for H1 first, a start on H3 and H4, and a reserve. The low estimate fits with 651 dollars left. H1's high (1,252, ceiling 1,565) is above 1,000, as the earlier entry found, but the 1,691 it gave included 439 dollars of reasoning tokens the decision removes. All kept runs: 1,159 to 5,227 (with the allowance, as a sensitivity, 6,856). 1,000 dollars covers H1's low to middle range, not its high plus a start. Set `spend_ceiling_usd` to the credit; a run stops there and resumes (RV1).[^85][^86]

**2026-11-21, X14, finding.** On the public payload sets the injection screen at default stops 316 of Lakera's 1,000 rows and 4 of deepset's 263 injections (write route, tool source). These sets were not seen by the screen's card, unlike AMSB, whose detectors it copies. AMSB's prompt-injection family is stopped 4 of 4; the deepset injections, many in German and many mild, pass the English patterns almost whole. The screen is a floor for English instruction phrases, as its own result says; a reader should take the deepset rate, not the AMSB one, as its out-of-sample escape.[^87]

**2026-11-21, X14, measurement.** The red-team table, `research/results/h1-redteam.json` (MANIFEST row, commit 17f13098), regenerated by `make redteam`. An engineering check: proposal P1 is not registered. To measure what each guard stops and wrongly stops on a corpus its card did not write. Write route, tool source, 1,278 attacks and 448 controls: medium lets every attack survive, survival 1.000 (Wilson 0.997 to 1.000), no false hold. The injection screen at default: survival 0.743 (0.719 to 0.767), 3 controls held; paired difference against medium 0.257 (BCa 0.234 to 0.281). Card E2.9's guards at block: survival 0.998, stopping two keys and the oversized payload. Trust floors: no change for attested writers; an unattested writer's 1,278 attacks and 448 controls are all denied. All on: 0.737, 4 controls held; AMSB grade D (67.3). The limits beside the table say why these rates are optimistic.[^88][^89][^90][^91]

**2026-11-22, L5, change.** The MANIFEST row of `research/results/h3-near-duplicate.json` names `8387b6a6`, card L5's squash commit on main (#105), in place of the branch commit `a3d403ea`. The squash merge left `a3d403ea` outside main's history, and the MANIFEST test requires each row's commit to be in it. The squash commit produces the same bytes, sha256 `f50c8f46`, so the row's hash is unchanged. `test_each_manifest_file_has_one_row_and_its_commit_is_in_the_history` passes on main again.[^92][^93]

**2026-11-22, L7, change.** The MANIFEST row of `research/results/h3-lint-nli.json` names `030a7fba`, card L7's squash commit on main (#109), in place of the branch commit `434412c1`. The squash merge left `434412c1` outside main's history, and the MANIFEST test requires each row's commit to be in it. The squash commit holds the same bytes, sha256 `22e3c122`, so the row's hash is unchanged. The MANIFEST history test passes on main again.[^94][^95]

**2026-11-22, L7, measurement, H3, supersedes 2026-11-22-l7-measurement-h3-lint-nli.** Regenerated research/results/h3-lint-nli.json with the score counts per cut, the forward-only flags at 0.9 and `decides: false`; its MANIFEST row names the regenerating commit. Review L7-2 and L7-8. Unchanged: per seed the tier drops 18 of the model tier's 113 contradiction calls, flags none and sends 95; all four contradiction faults land in the band. New: pairs at or above 0.5, 0.9, 0.99 and 0.999 are 92, 87, 79 and 61 by both directions and 85, 81, 70 and 56 forward only; forward-only flags at 0.9 cover 28 items, 4 of them contradiction faults and 6 with no label. Replays: 0 new calls, 0 new scores. Scripted model figures check the pipeline only. Arm P3 is proposed, not registered: this is an engineering check, not a thesis result.[^96][^97][^98]

**2026-11-22, X14, change.** The MANIFEST row of `research/results/h1-redteam.json` names `fe05b8a3`, card X14's squash commit on main (#107), in place of the branch commit `17f13098`. The squash merge left `17f13098` outside main's history, and the MANIFEST test requires each row's commit to be in it. The squash commit holds the same bytes, sha256 `c1e73f53`, so the row's hash is unchanged. The MANIFEST history test passes on main again.[^99][^100]

**2026-11-28, finding.** Every current measurement entry citing one of the 24 MANIFEST rows was checked against the committed JSON, its evidence paths and the row's config. The results register and the thesis drafts must rest on entries whose numbers still hold. 15 rows were in order. Nine current entries needed superseding: seven named the config only inside a command (check-runs-cost, both label-audit draws, the shared draw entry, cost-table, frontier-axes, E9.9's byte check), one cited the unlisted samples file (perf-budget), one named a stale M1. Facts the files contradict: frontier-axes said only no-model-source denies a write, while `longmemeval.by_variant.budget-25.denied_writes` is 95; LongMemEval's cost entry called gpt-5.6-terra the M1, recommended on 2026-11-19, while the pre-registration's Models section names deepseek-v4-pro-0813. `research/results/h1-check-runs-cost.json` still prices the smoke runs on gpt-5.6-terra. Nine `2026-11-28-rr-measurement-*` entries supersede them; repricing the check runs on M1 is left to the H1 run card.[^101][^102][^103][^104]

**2026-11-28, measurement, H1, supersedes 2026-11-20-rv6-measurement-check-runs-cost.** The cost estimate of H1's two pre-tag check runs, MANIFEST row `research/results/h1-check-runs-cost.json`, restated with its config `research/configs/h1-check-runs-cost.json` as evidence. The earlier entry named the config only inside its command, which the thesis consolidator rejects; its numbers still match the file. A cost estimate in US dollars at pi-ai 1.3.0 list prices; no run was made. Smoke GateMem on openrouter/openai/gpt-5.6-terra: `runs[0].total` 0.443526 to 3.012784. Smoke MEM-INV-Bench: `runs[1].total` 0.084943 to 1.250165. B1 on openrouter/openai/gpt-5.4: `runs[2].total` 2.056639 to 6.039012, its 150 C1 calls 636,381.75 input tokens low (`runs[2].tokens.low.input`). In all, `total` 2.585109 to 10.301961. The file still prices the smoke runs on gpt-5.6-terra, while the pre-registration's Models section names `openrouter/deepseek/deepseek-v4-pro-0813` as M1; a rerun on that model would move this row.[^105][^106][^107][^108]

**2026-11-28, measurement, supersedes 2026-11-21-rv8-review-measurement-cost-table-reasoning-off.** The cost estimate over every registered run, restated with its config as its own evidence item. The superseded entry named the config only inside its command, so the thesis consolidator rejects it; its numbers still match the file. At OpenRouter list prices, as decided (`decided.totals.openrouter-prices.d-lead`, reasoning off): 1,159.482346 to 5,227.072575 dollars, ceiling 6,533.840719, 348,842 to 660,296 calls; H1 274.334574 to 1,251.921395, H2 647.284117 to 2,154.077676. With the reasoning allowance (`decided.totals_with_allowance`, a sensitivity): high 6,855.544936, ceiling 8,569.43117. As registered (`totals.openrouter-prices.1d-lead/2a/47c`): 1,393.601368 to 11,990.220411, ceiling 14,987.775514. These are estimates; no model was called. The reasoning-off figure stays the planning figure; list prices are read again on the day of a run.[^109][^110][^111][^112]

**2026-11-28, measurement, H2, supersedes 2026-11-20-rv8-measurement-frontier-axes.** The offline reach measurement of H2's policy axes against preset medium, on GateMem's 2,218 checkpoints and LongMemEval's 500 questions, with no model called. The superseded entry lacked the config as its own evidence item and said only no-model-source denies a write, which the file contradicts. GateMem: grants off hides 64,987 turn reads on 1,154 checkpoints (`gatemem.by_variant.grants-off`); budget 25 hides 9,740; ttl 1 day 4,544. LongMemEval: medium hides 11,122 turns on 54 questions; ttl 30 days 34,688 on 148. No-model-source denies 5,795 GateMem and 124,334 LongMemEval writes; LongMemEval's budgets also deny writes: 95 at 25, 67 at 50, 61 at 100, 51 at 200, 2 at 400 (`longmemeval.by_variant.budget-*.denied_writes`). The budget denials stay as `docs/log/2026-11-20-rv8-finding-budget-denials.md` records them.[^113][^114][^115][^116]

**2026-11-28, measurement, H1, supersedes 2026-11-26-r5-measurement-h1-audit-draw.** H1's label audit draw record under `on_stop` "drop", MANIFEST row `research/results/h1-label-audit.json`, restated with its config `research/configs/label-audit.json` as evidence. Card R5's entry named the config only inside its command, which the thesis consolidator rejects; its numbers still match the file. A pre-registration support artefact: the items H1's three members audit, not a hypothesis result. GateMem: `benchmarks.gatemem.items` 50, `benchmarks.gatemem.stop_at_rejected` 6. MEM-INV-Bench: `benchmarks.mem-inv-bench.items` 38, `benchmarks.mem-inv-bench.stop_at_rejected` 4. `seed` 20261103, `reject_quorum` 2, `stop_share` 0.1, `on_stop` "drop". The committed file hashes to the MANIFEST's sha256; with `on_stop` set back to "pause" it hashes to the row R5 replaced, so no item, id, order or stop moved. `make test-repro` checks the row.[^117][^118][^119][^120]

**2026-11-28, measurement, H2, supersedes 2026-11-26-r5-measurement-lme-audit-draw.** LongMemEval's label-audit draw record, a pre-registration support artefact, restated with its config as its own evidence item. The superseded entry named the config only inside its command, so the thesis consolidator rejects it; its facts still hold. The draw holds 50 questions (`benchmarks.longmemeval.items`) and stops at 6 rejected (`benchmarks.longmemeval.stop_at_rejected`), with a reject quorum of 2 (`reject_quorum`) among 3 members, stop share 0.1 (`stop_share`), seed 20261103 (`seed`) and `on_stop` `drop`. Its draw hash is `55ac6fe6754b053fabc9bb9b780ab271e9134d376c7ff4bf094f4be2f027e505` (`benchmarks.longmemeval.draw_sha256`), and the file hashes to the MANIFEST's 509268baf31ca7c2d8088f42b9c10ea5bac285a3fd3e6e720cba894390a3722e. No audit has been read yet, so no disagreement rate exists. Nothing changes in the draw; `make test-repro` checks the same hash.[^121][^122][^123][^124]

**2026-11-28, measurement, H2, supersedes 2026-11-19-b6-measurement-cost.** A cost estimate of LongMemEval's two baselines (C2 and C5 at medium, 1,500 sessions each, `sizes.c2.sessions`), restated against the registered M1. The superseded entry called `gpt-5.6-terra` the recommended M1; the pre-registration's Models section now names `openrouter/deepseek/deepseek-v4-pro-0813`. At pi-ai 1.3.0 catalogue prices, both baselines with the judge on M1 cost 22.430372 to 188.917692 dollars (`candidates[6].total_with_judge`); on `gpt-5.6-terra`, 65.621982 to 643.926063 (`candidates[2]`). The judge costs 0.682618 to 0.910157 per baseline (`judge.cost.judge_c2`). A read holds 20.0 items under C2 and 19.8 under C5 (`measured.*.full_set.items_per_read`). Across candidates the range is 1.598619 (`candidates[7]`, low) to 1,973.215813 (`candidates[12]`, high). No model was called. These are catalogue dollars, not list prices; the cost table's decided block carries M1's list-price figures.[^125][^126][^127][^128]

[^1]: `research/results/h2-perf-budget.json`
[^2]: `research/configs/perf-budget.json`
[^3]: `research/results/MANIFEST.md`
[^4]: `uv run python research/scripts/perf_budget.py --config research/configs/perf-budget.json --out research/results/h2-perf-budget.json`
[^5]: `research/results/h1-gatemem-reach.json`
[^6]: `research/configs/h1-gatemem-reach.json`
[^7]: `research/results/MANIFEST.md`
[^8]: `uv run python research/scripts/h1_gatemem_reach.py --config research/configs/h1-gatemem-reach.json --out research/results/h1-gatemem-reach.json`
[^9]: `fixtures/cassettes/b3-gatemem-plane`
[^10]: `research/configs/b3-gatemem-plane.json`
[^11]: `ENGRAM_OFFLINE=1 make run CONFIG=research/configs/b3-gatemem-plane.json`
[^12]: `packages/runner/scripts/retrieval-floor.ts`
[^13]: `packages/runner/test/retrieval.test.ts`
[^14]: `node packages/runner/scripts/retrieval-floor.ts .engram/upstream/gatemem/bench/data`
[^15]: `packages/runner/test/retrieval.test.ts`
[^16]: `packages/runner/scripts/retrieval-floor.ts`
[^17]: `pnpm exec vitest run packages/runner/test/retrieval.test.ts`
[^18]: `research/results/h1-c4-verdict-agreement.json`
[^19]: `research/configs/h1-c4-verdict-agreement.json`
[^20]: `research/results/MANIFEST.md`
[^21]: `uv run python research/scripts/h1_c4_verdict_agreement.py --config research/configs/h1-c4-verdict-agreement.json --out research/results/h1-c4-verdict-agreement.json`
[^22]: `research/results/h1-c4-walk.json`
[^23]: `research/configs/h1-c4-walk.json`
[^24]: `research/results/MANIFEST.md`
[^25]: `uv run python research/scripts/h1_c4_walk.py --config research/configs/h1-c4-walk.json --out research/results/h1-c4-walk.json`
[^26]: `research/results/h4-holm-levels.json`
[^27]: `research/configs/h4-holm-levels.json`
[^28]: `research/results/MANIFEST.md`
[^29]: `uv run python research/scripts/h4_holm_levels.py --config research/configs/h4-holm-levels.json --out research/results/h4-holm-levels.json`
[^30]: `research/results/h4-power.json`
[^31]: `research/configs/h4-power.json`
[^32]: `research/results/MANIFEST.md`
[^33]: `uv run python research/scripts/h4_power.py --config research/configs/h4-power.json --out research/results/h4-power.json`
[^34]: `research/results/h1-mem-inv-admission.json`
[^35]: `research/configs/h1-mem-inv-admission.json`
[^36]: `research/results/MANIFEST.md`
[^37]: `uv run python research/scripts/h1_mem_inv_admission.py --config research/configs/h1-mem-inv-admission.json --out research/results/h1-mem-inv-admission.json`
[^38]: `research/results/h1-cost.json`
[^39]: `research/configs/h1-cost.json`
[^40]: `research/results/MANIFEST.md`
[^41]: `uv run python research/scripts/h1_cost.py --config research/configs/h1-cost.json --out research/results/h1-cost.json`
[^42]: `research/results/h1-refusal-leaks.json`
[^43]: `research/configs/h1-refusal-leaks.json`
[^44]: `research/results/MANIFEST.md`
[^45]: `uv run python research/scripts/h1_refusal_leaks.py --config research/configs/h1-refusal-leaks.json --out research/results/h1-refusal-leaks.json`
[^46]: `research/results/h2-longmemeval-ttl.json`
[^47]: `research/configs/h2-longmemeval-ttl.json`
[^48]: `research/results/MANIFEST.md`
[^49]: `uv run python research/scripts/h2_longmemeval_ttl.py --config research/configs/h2-longmemeval-ttl.json --out research/results/h2-longmemeval-ttl.json`
[^50]: `research/results/h3-fault-set.json`
[^51]: `research/configs/h3-fault-set.json`
[^52]: `research/results/MANIFEST.md`
[^53]: `uv run python research/scripts/h3_fault_set.py --config research/configs/h3-fault-set.json --out research/results/h3-fault-set.json`
[^54]: `research/results/h3-lint-floor.json`
[^55]: `research/configs/h3-lint-floor.json`
[^56]: `research/results/MANIFEST.md`
[^57]: `uv run python research/scripts/h3_lint_floor.py --config research/configs/h3-lint-floor.json --out research/results/h3-lint-floor.json`
[^58]: `research/results/h2-frontier-axes.json`
[^59]: `research/results/h1-injection-screen.json`
[^60]: `research/configs/injection-screen.json`
[^61]: `fixtures/injection-screen/corpus.json`
[^62]: `research/results/MANIFEST.md`
[^63]: `uv run python research/scripts/injection_screen.py --config research/configs/injection-screen.json --out research/results/h1-injection-screen.json`
[^64]: `research/results/h1-secret-guard.json`
[^65]: `research/configs/secret-guard.json`
[^66]: `research/results/MANIFEST.md`
[^67]: `uv run python research/scripts/secret_guard.py --config research/configs/secret-guard.json --out research/results/h1-secret-guard.json`
[^68]: `research/results/h3-near-duplicate.json`
[^69]: `research/configs/near-duplicate.json`
[^70]: `research/scripts/near_duplicate.py`
[^71]: `research/results/MANIFEST.md`
[^72]: `uv run python research/scripts/near_duplicate.py --config research/configs/near-duplicate.json --out research/results/h3-near-duplicate.json`
[^73]: `research/results/h1-crosswalk.json`
[^74]: `research/configs/crosswalk.json`
[^75]: `research/results/MANIFEST.md`
[^76]: `uv run python research/scripts/crosswalk.py --config research/configs/crosswalk.json --out research/results/h1-crosswalk.json --legal .engram/upstream/legal`
[^77]: `research/results/h2-frontier-axes.json`
[^78]: `docs/log/2026-11-20-rv8-finding-flat-axes.md`
[^79]: `research/results/h2-cost-table.json`
[^80]: `research/configs/cost-table.json`
[^81]: `research/results/h2-cost-table.json`
[^82]: `research/configs/cost-table.json`
[^83]: `research/results/h2-frontier-axes.json`
[^84]: `docs/log/2026-11-20-rv8-finding-flat-axes.md`
[^85]: `research/results/h2-cost-table.json`
[^86]: `docs/log/2026-11-20-rv8-finding-credit-request.md`
[^87]: `research/results/h1-redteam.json`
[^88]: `research/results/h1-redteam.json`
[^89]: `research/configs/redteam.json`
[^90]: `research/results/MANIFEST.md`
[^91]: `make redteam`
[^92]: `research/results/MANIFEST.md`
[^93]: `research/results/h3-near-duplicate.json`
[^94]: `research/results/MANIFEST.md`
[^95]: `research/results/h3-lint-nli.json`
[^96]: `research/results/h3-lint-nli.json`
[^97]: `research/configs/h3-lint-nli.json`
[^98]: `make h3-lint-nli`
[^99]: `research/results/MANIFEST.md`
[^100]: `research/results/h1-redteam.json`
[^101]: `research/results/MANIFEST.md`
[^102]: `docs/log/2026-11-28-rr-measurement-frontier-axes.md`
[^103]: `docs/log/2026-11-28-rr-measurement-lme-cost.md`
[^104]: `docs/log/2026-11-28-rr-measurement-check-runs-cost.md`
[^105]: `research/results/h1-check-runs-cost.json`
[^106]: `research/configs/h1-check-runs-cost.json`
[^107]: `research/results/MANIFEST.md`
[^108]: `uv run python research/scripts/h1_check_runs_cost.py --config research/configs/h1-check-runs-cost.json --out research/results/h1-check-runs-cost.json`
[^109]: `research/results/h2-cost-table.json`
[^110]: `research/configs/cost-table.json`
[^111]: `research/results/MANIFEST.md`
[^112]: `uv run python research/scripts/cost_table.py --config research/configs/cost-table.json --out research/results/h2-cost-table.json`
[^113]: `research/results/h2-frontier-axes.json`
[^114]: `research/configs/frontier-axes.json`
[^115]: `research/results/MANIFEST.md`
[^116]: `uv run python research/scripts/frontier_axes.py --config research/configs/frontier-axes.json --out research/results/h2-frontier-axes.json`
[^117]: `research/results/h1-label-audit.json`
[^118]: `research/configs/label-audit.json`
[^119]: `research/results/MANIFEST.md`
[^120]: `uv run python research/scripts/label_audit_draw.py --config research/configs/label-audit.json --out research/results/h1-label-audit.json`
[^121]: `research/results/h2-label-audit-longmemeval.json`
[^122]: `research/configs/label-audit-longmemeval.json`
[^123]: `research/results/MANIFEST.md`
[^124]: `uv run python research/scripts/label_audit_draw.py --config research/configs/label-audit-longmemeval.json --out research/results/h2-label-audit-longmemeval.json`
[^125]: `research/results/h2-longmemeval-cost.json`
[^126]: `research/configs/h2-longmemeval-cost.json`
[^127]: `research/results/MANIFEST.md`
[^128]: `uv run python research/scripts/h2_longmemeval_cost.py --config research/configs/h2-longmemeval-cost.json --out research/results/h2-longmemeval-cost.json`
