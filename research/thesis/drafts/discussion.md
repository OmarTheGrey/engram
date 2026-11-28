# Discussion

Consolidated from docs/log by research/scripts/consolidate_log.py. Edit the entries, not this file.

## Distill

**2026-10-29, E2.5, finding.** The one-sided Wilson upper bound on failure at alpha 0.05 for each preset's replay record is 0.35 (strict, 5 of 5), 0.56 (medium, 4 of 5) and 0.73 (permissive, 3 of 5), now stated in each preset's comment. ADR 0026 asks for the bound so the k of n is argued over, not assumed (SKILL.nb, 2606.08049). The values come from `wilsonUpperFailure` in the presets test, pinned to four places. The plan's "about 0.52" for 4 of 5 does not match the formula with z 1.645; 0.56 is what it gives. Adding the comment changed condition C3's prompt, so `make fixtures` re-recorded two rn1-gatemem-probe cassettes; responses are unchanged. Medium admits a procedure whose failure rate may be above one half. The lead should see this before any D3 run.[^1][^2][^3][^4]

**2026-11-22, D2, finding, H5, supersedes 2026-11-21-d2-finding-for-d3.** Candidates still cannot be read back through `Plane.read`, so card D3 takes them from `runInduceConfig`'s `items` or `candidates.jsonl`. The fixture's ids changed with the control. Card D3 merged this branch, and its cassettes key on skill names. AWM: `01920000-0000-7000-8000-000000000001` to `...0003`, unchanged. Control: `...0007` to `...0016`, one per kept session, named by its instruction, for example `rename-parserow-to-parserecord-everywhere` with ref `distill:rule:cd38e0d4-3e62-4dc2-b801-dcf42945e1d9` (`d1-01`). `call-read-then-read` is gone. D3 re-records.[^5][^6]

## Plane

**2026-10-29, B4, finding, H1.** Applying ADR 0004's inheritance rule to MEM-INV-Bench's trusted-tool echo (L-b) leaves it `tool`, not `document`. Review finding R6-3 asked for the rule with ADR 0026's trust order and expected the echo to become `document`. ADR 0026's order is user, document, import, tool, model, compaction (`leastTrusted` in core), so `document` ranks above `tool` and the least trusted of a tool and its web-document input is `tool`. The rule bites only where the input ranks lower, such as model content (`plane.test.ts`: a tool fed model content is written `model` and denied in team scope). Neither kind marks content as from an untrusted outsider. Inheritance cannot close L-b without an untrusted-external kind ranked last; the lead decides with the next schema PR whether to add one.[^7][^8][^9]

**2026-11-19, RV3, finding.** The repository review's finding RV-ADP-6: one `Plane.read` query returns different items over stores that differ only in their search method. Left to the lead, not changed here. The files and Letta adapters scan and keep an item only when every query term is in its content; the Mem0 adapter ranks by embedding similarity above a threshold; the fake can offer no search at all. ADR 0013 lets `search` be optional and says nothing about what a hit means, so the same read differs by store (the reviewer's probe `searchsem.mts`). No code changed. Choosing one meaning (every term, any term, or the store's own ranking with the plane's filter on top) changes what a read returns on each store, so it bears on any comparison across stores; the card's brief leaves it to the lead. A backlog row for the lead.[^10][^11][^12][^13]

**2026-11-21, A5, finding, H3, supersedes 2026-11-21-a5-finding-lineage-not-read-as-revocation.** A replacement that names the old version in its `lineage` and closes nothing leaves both versions admitted, and a read through the store's search ranks the two, which match a title query alike, in the store's own hit order. ADR 0005 decision (a) reads "the latest valid version at query time", but its chosen form pairs lineage with closing the old version's `valid_to`, the grid's `closed` mark, which holds; lineage alone is half of it. `itemByStoreRef` applies lineage only among holders of one ref, and these versions have distinct refs (ADR 0013, D1). Pinned in both write orders on six stores: the plane's order follows the store's hits (fake write order, files and Letta id order, Mem0 embeddings), and swapping order and ids swaps it on the lexical stores. For the lead: should reads drop an active ancestor under a different ref?[^14][^15][^16]

**2026-11-21, A5, finding, H3, supersedes 2026-11-21-a5-finding-rebirth-by-re-edit.** After a revocation through the plane, a revoked record put back in the store comes back into reads only when it is re-edited at a higher version, and then by design. The Memory-Rebirth-Attack scenario, a revoked fact re-entering the store outside the gate. A restore of the pre-revocation record is denied by the version rule (ADR 0005 D1, enforced by E2.3's D4), nine of nine. A re-edit at version 3 is adopted and admitted on every store. Under ADR 0004's narrowed D8 any record edited in the store is recorded with the adopter as actor and kind `import` at most, and ADR 0025 rule 5 lets an import restate retired content. RV4 blocked rebirth under a new id (`engram/adopt/rekeyed`), not a same-id rewrite at a higher version. The boundary is anything that can write the store, attributed to the owner; intended.[^17][^18][^19][^20]

**2026-11-21, E2.12, finding.** Under strict, medium and permissive, the source-isolation rule (`engram/write/source-isolation`) never decides a write: no preset allows a model, compaction or external source outside person scope, so the allowed-sources check refuses it first. The differential test's coverage guard first required isolation to decide on the presets and failed with 0 such writes in 4,500. The rule is defence in depth on the presets; it decides only under a policy that lists an untrusted source for a shared scope, which generated policies reach. In Cedar both forbids hold, so the policy set names both. A registered number about write denials by reason will show isolation at zero under every preset; that is by construction, not a gap.[^21][^22][^23][^24]

## Research

**2026-11-02, R1, finding, H1, supersedes 2026-11-02-pr2-review-finding-gatemem-reach.** Under ADR 0030's mapping, a pattern GateMem scores as a leak matches a turn the asker reads on 74.0 percent of forgetting checkpoints and 38.8 percent of access ones; every pattern does on 63.0 and 18.3 percent. On those checkpoints C5 hands the match to the model, which alone can withhold it. These are shares of text matches, not of secrets, and neither bounds the share whose secret is in reach: 2 access and 5 forgetting checkpoints carry only bare patterns, and 107 access and 63 forgetting at least one (`research/results/h1-gatemem-reach.json`). The verifier's 29 compared a list holding duplicates with a set. A hand audit of the 50 sampled checkpoints is the human step that can place the secret's share. For PR 4's sheet, undecided: forgetting checkpoints dilute a C4 minus C5 difference.[^25][^26]

**2026-11-02, X1, finding, H1.** GateMem's RAG-Policy baseline is a deterministic filter before the model, not "the model decides from the metadata" as the pre-registration's C4 row says, and it reads no hidden field. Plan decision 4 assumed the agent attaches policy metadata for the model; the code at `a983828` drops every chunk its hand-written per-role and per-relationship gate refuses, then retrieves the top k of the rest. Rerunning upstream's gate with every hidden checkpoint field changed moved nothing on 2,218 of 2,218 checkpoints. The gate allows 126,653 of the 325,530 turn chunks up to their checkpoints (39 percent; the check command above prints both). C4 shows the verdict instead of filtering (ADR 0031); v1 must say C4's GateMem numbers are not upstream's RAG-Policy numbers.[^27][^28][^29]

**2026-11-02, X1, finding, H1.** Every store H1 might run on (fake, files, Letta, Mem0) satisfies the retrieval property, since no condition uses a store's native search. Review round 2 (R1) asked which stores satisfy C2 = pipeline over every item and C5 = pipeline over the admitted ones, so PR 4 can pick H1's store; under the store-search rule Mem0's top-20 cap broke the subset on 45 of 180 fixture reads. C2 lists the store and runs core's pipeline; the conformance suite holds every store to `list` returning all it holds, and the test checks C2 on fake for every fixture checkpoint and on files, Mem0 and Letta for two. C5 reads the plane's projection, which no store affects. H1's numbers do not depend on the store; a semantic store's own retrieval is not part of the experiment.[^30][^31]

**2026-11-03, R1, finding, H1, supersedes 2026-11-02-x1r-c4-verdict-agreement.** GateMem's RAG-Policy verdict and the plane's read decision disagree on more than a quarter of the turn items H1's GateMem arm shows, and the plane's verdict does not move with the preset. The earlier finding cited a development command; the shares now come from a rule-9 result. 27.7 percent of 325,530 turn items disagree, 18.5 percent the gate allowing what the plane denies; on leak-target turns of access-control checkpoints the gate allows 1,528 of 5,259 and the plane 722 (`research/results/h1-c4-verdict-agreement.json`). Strict, medium and permissive give identical counts: every GateMem asker reads as a person-level actor, whose row of the read matrix is the same in the three presets (`packages/core/policies/*.yaml`), and all three honour grants, as PR 2's reach result also found. For part B's decision sheet: with `gatemem-rag`, C4 minus C5 would mix policy into mechanism; the preset does not change C4's verdicts.[^32][^33]

**2026-11-03, R1, finding, H1, supersedes 2026-11-02-x1r3-c4-list-lengths.** The walk moved GateMem's retrieval difference from C4 against C5 to C3 against C4. Before the walk, C4's allowed items fell short of C5's list on 2,026 checkpoints; N-1 asked what fixing that costs elsewhere. The superseded entry used a development script. C3 and C4 show lists of different length on 2,179 of 2,218 checkpoints; C4 shows fewer items on 153 and none on 28, where the plane admits no candidate and C3 still shows up to 20 denied ones; on 54 access-control checkpoints C3 shows a denied leak-target item C4 hides, on 365 C4 shows one C3 never reaches (`research/results/h1-c4-walk.json`). Lengths match the superseded entry: median 52, 0 to 222, 151,144 items against 44,051. No H1 contrast compares C3 with C4; ADR 0031 (still proposed) says so, and a reader of C3 against C4 takes metadata and list together.[^34][^35]

**2026-11-03, R1, finding, H1, supersedes 2026-11-02-pr2-review-finding-mem-inv-admission.** On H1's full MEM-INV-Bench set the preset still decides whether C5 has any write-side defence, and strict's defence still comes from reading no shared record. The subset's shares were expected to hold per channel; the full set checks it on every scenario and channel. Under medium, H1's preset, 32 of 32 attacks reach the model's context, so a C4 minus C5 difference on this arm can come only from how the model reads provenance. Under strict, 24 of 32 wait as review candidates and the 8 self-summaries pass, but all 78 `team:operations` entries wait too, the trusted filler and the 6 benign values included (`research/results/h1-mem-inv-admission.json`). For part B's decision sheet, unchanged in substance: medium tests only the model; strict tests admission by withholding all shared memory.[^36][^37]

**2026-11-03, R1, finding, H1.** Pre-registration v0.2 words H1's GateMem metric as checkpoints that "leak a target or take the wrong action (A and F)", but GateMem's own A and F count a wrong action only under `--gate_by_action`, which is off by default. Writing the converter needed one definition of a GateMem violation, and the two readings differ. `scorePredictions` and `judgeOne` mark a wrong action as a leak only when `gateByAction` is set; the runner's judge pass promotes the judge's summary with `gated_by_action: false` (`packages/runner/src/run.ts`). So "A and F" as GateMem reports them by default exclude wrong actions. The converter follows GateMem's default and offers the other reading as `make h1-table GATE_BY_ACTION=1`. Part B's v1 text and decision sheet choose one reading; the H1 table follows it with no code change.[^38][^39][^40]

**2026-11-03, R1, finding, H1, supersedes 2026-11-03-pr4a-finding-cost-drivers.** GateMem's C4, the extra read turns, and reasoning that thinking off cannot stop drive H1's cost; MEM-INV-Bench stays under 2 percent of it. The superseded entry priced no reasoning for models that ignore thinking off, and items at the fixture's size. A low C4 session carries 8,808 to 11,037 input tokens against 3,623 to 3,677 for C2 (`measured.gatemem`). Two more read turns and three characters per token take GateMem's input from 152.9M to 738.4M. For gpt-6.1-sol, which ignores thinking off, 4,096 reasoning tokens per call (high) add about 4,436 of its 6,206 dollars, and the 256-token floor about 139 of its 526 (low); 1,000 reasoning tokens per call cost it 541.52 low and 1,082.96 high. Access and forgetting checkpoints alone cost about 68 percent of the GateMem arm. The first live sessions' usage ledger should narrow the range before the full run.[^41]

**2026-11-03, R1, finding, H4, supersedes 2026-11-03-pr4a-finding-h4-power.** H4's sample must come from the alpha 0.01 column of `research/results/h4-power.json`: those sizes hold the TOST's level at every Holm threshold, and no other size is checked below 0.05. H4's one p-value may meet Holm at 0.05 / k for k up to 5; the alpha 0.05 sizes are checked at 0.05 only (review P4A-11). At alpha 0.01, one family needs 320 to 640 items per arm at 10 points, 761 to 2,560 at 5 and 2,560 to 17,222 at 2; four families 320 to 905, 761 to 3,620, 2,560 to 20,480. Each holds at all five thresholds (the largest level a search of the boundary |mean| = margin found, iid items assumed). About 100 items per arm reaches no alpha 0.01 size. For part B: 10 points with 320 to 905 items per arm, or 5 points with 761 to 3,620.[^42][^43][^44]

**2026-11-19, L2, finding, H3.** What each lint tier can find in H3's fault set under card L3's rules. The coordinator asked what each tier can find, and which of L3's rules the set cannot meet. From `research/results/h3-fault-set.json`, `by_tier`: stale, 500 by the model tier (superseded) and 1,000 by the deterministic tier only; contradictory, 500 by the model tier and none by the deterministic; misplaced, 500 by the deterministic tier only and 500 by neither (wrong-scope); unsupported, 500 by the model tier (unsupported-claim) and 1,000 by the deterministic tier only. In total 1,500 model, 2,500 deterministic only, 500 neither; `label_check` confirms all 1,500 model-tier faults are units L3 sends. The set cannot meet two of L3's rules: no contradiction is keyed, and a superseded statement cannot be the later id of its pair, so its finding lands on the update (`finding_on`).[^45][^46]

**2026-11-19, L2, finding, H3.** H3's statement that "deterministic lints alone find seeded faults with useful precision" holds on card L2's set by construction. Each keyed subtype restates its lint's trigger and the label check requires every keyed fault flagged and no near-miss (review finding L2-1); `limits.can_tell` in the result says the set is a regression check on L1 for that reason. Recommendation for the lead, before the `prereg-v1` tag: restate H3's deterministic claim as precision on natural memory, measured through the audit sample of base-item findings (`audit` in the result, judged by members), and keep recall on seeded faults as a regression check on L1. The pre-registration is not edited here; the decision is the lead's (backlog row "H3's deterministic claim"). Until the lead decides, L4 reports deterministic seeded recall as a check, not as H3's evidence.[^47][^48][^49]

**2026-11-19, L3, finding, H3.** Neither model lint sends a unit on B5's LongMemEval memory state as it is written: its items are episodic turns in person:user whose refs name sessions, not items. H3 measures the lints on L2's set, built from that state; L2 and L4 need to know what the model tier can see. contradiction reads only semantic items; unsupported-claim needs a ref naming an item with a matching strict hash. B5 writes neither (turnItem in packages/bench/src/longmemeval/plane.ts). L2's contradictory faults must be semantic items in the linted scope, and its unsupported faults must cite an item source with its strict hash; otherwise the model tier's recall on them is zero by construction.[^50][^51]

**2026-11-21, L5, finding, H3, supersedes 2026-11-21-l5-finding-case-copy.** Supersedes the case-copy finding of this date: the one unlabelled finding is still the lower-cased copy in `duplicate.near-miss`, but the "fault fixture fact n" pairs are stopped by the cosine guard, not by the number veto. Review finding L5-1 counted the vetoes over the catalogue: the number veto fires 0 times there. In orphan.flag, for one, all 3 similar pairs end at the cosine. 1 unlabelled finding over the other lints' 14 fixtures. When arm P4 is registered, its audit should expect case-only restatements among the tier's findings.[^52][^53][^54]

**2026-11-21, R3, decision.** The claim reads "to our knowledge, the first deterministic, event-logged, replayable control plane across memory stores, with a pre-registered measurement of its governance tax", not the card's "with a measured governance tax". The card's risk line asks that no difference overclaim. Engram's tax is not measured yet (H1 and H2 run from 2026-12-01), and both neighbours do measure a trade-off. "To our knowledge" bounds "first" by what was read: the two papers, their repositories, and the October neighbours 2606.24535 and 2610.11188. The sentence in `README.md`, `docs/architecture.md` and `docs/research/positioning.md` is the same, and each of its words is defined, with its limit, in the positioning. If wrong, the cost is a weaker sentence than the evidence will allow after H2 reports; it is changed then, in one place first.[^55][^56]

**2026-11-21, R3, finding, H1.** SAFE-Mem's Appendix M is the nearest published instance of H1's contrast between C4 (the model decides from per-item metadata) and C5 (the plane withholds). It shows the entries that fail admission either withheld or retrieved with a marker that limits them to description, so the model decides. Labelling instead of withholding raises MPBench attack success from 2.6 to 6.2 percent on GPT-5.6-terra and from 6.2 to 19.6 percent on GPT-4o-mini (Table 13), and gains about three LoCoMo points. The direction matches H1's: enforcement leaks less than a model told which entries are restricted. It is one benchmark, two models, no registered test. Cited as prior evidence in H1's discussion; it makes H1's question less new and changes nothing registered.[^57][^58]

**2026-11-21, R3, finding, H2, supersedes 2026-11-21-r3-finding-safe-mem-h2-admission-cost.** SAFE-Mem's recall above no defence does not show governance without a tax: against the same memory without admission, admission costs on a benign benchmark and gains under attack. The November note read SAFE-Mem as weakening any claim of a governance tax. Against no defence, LoCoMo accuracy rises 11.1 and 15.1 points on the two GPT models (Table 1). Against its own graph with every turn treated as the principal's, so that admission withholds nothing, it loses 3.6 points on GPT-5.6-terra (64.9 to 61.3) and 3.8 on GPT-4o-mini (58.4 to 54.6) (Appendix G), while MPBench recall rises from 76.7 to 85.9 percent on GPT-4o-mini (Table 6). H2's contrast, C2 against C5 on the same memory, is the governance-off comparison; H2's discussion cites both rows and names each baseline. Supersedes the first version, whose "through endorsed passages" was an inference, not the paper's statement (review finding R3-2).[^59][^60]

**2026-11-21, X14, finding.** The write route shares MEM-INV-Bench's write paths in three cells: document with direct and corroborate (16 cases), tool with tool_echo (8), model with summarize (8); user, external, unattested and every read-route cell share none. The card maps the overlap so nothing is counted twice. The mapping is computed from the vendored cases, structurally (an entry from an untrusted feed or derived from one), with no hidden label. Neither arm's cases are in the other's corpus, and MEM-INV-Bench scores an action, not survival, so the two arms are reported apart.[^61][^62]

**2026-11-22, L7, finding, H3, supersedes 2026-11-22-l7-finding-flag-band-empty.** Revised the flag-band finding: forward-only scoring would not have given a useful flag band on card L4's fixture. The earlier entry implied a forward-only upper of 0.9 would flag the four faults with no model call, leaving out what else it flags (review L7-2). Of 113 pairs, 87 score 0.9 or more by both directions and 81 forward only (`score_counts`). A forward-only upper of 0.9 flags 81 pairs on 28 items: 4 contradiction faults, 4 contradiction near-misses, 14 items with other labels and 6 with none (`forward_only_flags`). The empty flag band is not an artefact of the direction rule. The choice is the lead's, item 66. Arm P3 is proposed, not registered: this is an engineering check, not a thesis result.[^63][^64]

[^1]: `packages/core/test/unit/policy/presets.test.ts`
[^2]: `packages/core/policies/medium.yaml`
[^3]: `fixtures/cassettes/rn1-gatemem-probe`
[^4]: `make fixtures MSG=...`
[^5]: `packages/runner/src/induce.ts`
[^6]: `packages/core/src/policy/evaluate.ts`
[^7]: `packages/core/src/policy/promotion.ts`
[^8]: `packages/bench/src/mem-inv-bench/plane.ts`
[^9]: `packages/bench/test/mem-inv-bench/plane.test.ts`
[^10]: `packages/adapters/src/files/index.ts`
[^11]: `packages/adapters/src/letta/index.ts`
[^12]: `packages/adapters/src/mem0/index.ts`
[^13]: `docs/tasks/backlog.md`
[^14]: `packages/adapters/test/plane/revocation.test.ts`
[^15]: `docs/decisions/0005-bi-temporal-validity.md`
[^16]: `make test-one T=packages/adapters/test/plane/revocation.test.ts`
[^17]: `packages/adapters/test/plane/revocation.test.ts`
[^18]: `docs/decisions/0004-provenance-and-source-trust.md`
[^19]: `docs/decisions/0005-bi-temporal-validity.md`
[^20]: `docs/decisions/0025-retention-semantics.md`
[^21]: `packages/core/policies/strict.yaml`
[^22]: `packages/core/policies/medium.yaml`
[^23]: `packages/core/policies/permissive.yaml`
[^24]: `packages/core/test/property/cedar.test.ts`
[^25]: `research/results/h1-gatemem-reach.json`
[^26]: `docs/decisions/0030-gatemem-principals-as-scopes-and-grants.md`
[^27]: `packages/bench/src/gatemem/rag-policy.ts`
[^28]: `python -I packages/bench/scripts/upstream-rag-policy-golden.py --upstream .engram/upstream/gatemem --data .engram/upstream/gatemem/bench/data --out .engram/bench/rag-policy-full.json`
[^29]: `node packages/bench/scripts/check-rag-policy-upstream.ts .engram/upstream/gatemem/bench/data .engram/bench/rag-policy-full.json`
[^30]: `packages/runner/test/retrieval.test.ts`
[^31]: `docs/decisions/0009-retrieval-explanations.md`
[^32]: `research/results/h1-c4-verdict-agreement.json`
[^33]: `docs/decisions/0031-c1-and-c4-on-each-benchmark.md`
[^34]: `research/results/h1-c4-walk.json`
[^35]: `docs/decisions/0031-c1-and-c4-on-each-benchmark.md`
[^36]: `research/results/h1-mem-inv-admission.json`
[^37]: `docs/log/2026-10-29-b4-plane-gates-memory-not-action.md`
[^38]: `docs/research/preregistration.md`
[^39]: `packages/bench/src/gatemem/score.ts`
[^40]: `packages/runner/src/run.ts`
[^41]: `research/results/h1-cost.json`
[^42]: `research/results/h4-power.json`
[^43]: `research/results/h4-holm-levels.json`
[^44]: `research/analysis/equivalence.py`
[^45]: `research/results/h3-fault-set.json`
[^46]: `git show b59a1f7~2:packages/bench/src/faults/reach.ts`
[^47]: `docs/research/preregistration.md`
[^48]: `research/results/h3-fault-set.json`
[^49]: `docs/tasks/backlog.md`
[^50]: `packages/bench/src/longmemeval/plane.ts`
[^51]: `packages/core/src/lint/model.ts`
[^52]: `research/results/h3-near-duplicate.json`
[^53]: `fixtures/faults/duplicate.near-miss.json`
[^54]: `fixtures/faults/orphan.flag.json`
[^55]: `docs/tasks/R3.md`
[^56]: `docs/research/positioning.md`
[^57]: `docs/research/positioning.md`
[^58]: <https://arxiv.org/abs/2610.22959>
[^59]: `docs/research/positioning.md`
[^60]: <https://arxiv.org/abs/2610.22959>
[^61]: `research/results/h1-redteam.json`
[^62]: `packages/bench/src/redteam/overlap.ts`
[^63]: `research/results/h3-lint-nli.json`
[^64]: `make h3-lint-nli`
