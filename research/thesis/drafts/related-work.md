# Related work

Consolidated from docs/log by research/scripts/consolidate_log.py. Edit the entries, not this file.

## Distill

**2026-11-21, D2, finding.** The specification's validator is looser than its text in three ways. It accepts Unicode lowercase letters in a name (`café` passes), where the text says a-z and 0-9. It splits a file at the first two `---` anywhere, not on lines. It does not check `allowed-tools`. Card D2 validates against the specification, not against one harness. Case `unicode-lowercase-name` passes with no error. `toSkillMd` writes ASCII names only and never puts `---` in its frontmatter, so it satisfies both readings. A stricter harness could refuse a hand-written skill that the validator accepts. Ours are not such skills.[^1][^2]

## Plane

**2026-11-21, E1.6, decision.** caura's canonicalisation lessons and Compartment's head and count anchor are taken as ideas, not ports: no absorbed.md row, cited in the file headers. Review finding E1.6-9: the card lists both as Apache-2.0 ports, but neither repository was opened at a commit; only the research report's summary was used. chain.ts and verify.ts say the timestamp, number and anchor rules come from the research report; huqan, world-model-mcp and octopus-blackboard, read at their commits, keep their rows. A later card that ports code from caura or Compartment reads them at a commit and adds the rows.[^3][^4][^5]

**2026-11-21, E2.11, decision.** dent8 and Veracium are absorbed as ideas, not ports, so `docs/absorbed.md` gains no row. ADR 0037: a port is code written with the source open and following its structure. This card was written from ADR 0040 and `docs/research/absorb/19-github-scout.md`, with neither source open. Both, and mentisdb and Mnemowall, are cited in the header of `policy/trust.ts`. If the lead wants ports, the sources are read at a commit and the register gains rows.[^6][^7]

**2026-11-21, R3, finding.** HEAMS (Goel et al., arXiv 2611.20144) evaluates six memory systems behind one interface on five dimensions, and ships a governance layer that wraps any memory system in retention and recall policies. It is the nearest published neighbour to Engram's plane over existing stores (card R3). Policies are deterministic rules, free text read by an LLM, or hybrid (Sec. 4.2); every experiment uses free text read by gpt-4o-mini (Appendix D.2), and governance is evaluated only on MilaMem (Table 3, caption). Recall governance cuts scenario leakage from 57.61 to 31.82 percent for 4.80 points of helpfulness (Table 5); retention and recall together raise MPBench resistance from 40.00 to 88.61 percent (Table 8). One user only (Sec. 2.2). The wrapper logs each decision with a reason and a policy id (`wrapper.py`, repository at dec2874). Cited as the nearest rival toolkit in related work; nothing is taken.[^8][^9][^10]

**2026-11-21, R3, finding, supersedes 2026-11-21-r3-finding-narrowed-event-logged.** "Event-logged" alone does not separate Engram from HEAMS, and the literature note's contrast on it was wrong. HEAMS's wrapper (`wrapper.py`, repository at dec2874; paper Sec. 4.5) logs each recall decision and each retention drop (and every priming decision) with an action, a reason, a policy id and a decision source. A retention STORE outside priming goes into the entry's metadata with no reason. Pure-LLM verdicts carry the model's text and no policy id; hybrid rule matches carry the rule's id (`recall_policy_hybrid.py`). The difference that holds: Engram's log is the source of truth and item state is a projection rebuilt from it (ADR 0003; `MemoryEvent` in `schema.ts`), every decision is an event with a rule id, and each is mirrored into the pi session (AGENTS.md rule 3). HEAMS's events are run records for scoring. Supersedes the first version (review finding R3-4).[^11][^12][^13][^14]

**2026-11-21, R3, finding, supersedes 2026-11-21-r3-finding-narrowed-free-text-policy.** "Their policies are free text read by a model; ours are typed and evaluated by code", the absorb plan's wording for R3, is narrowed. HEAMS also has deterministic and hybrid modes (Sec. 4.2; `_rule_matches`); only its reported experiments all use free text read by gpt-4o-mini (Appendix D.2). SAFE-Mem's gate is code (Eq. 2; `_admits`) over labels a model partly sets (prompts Q.1 and Q.4). In Engram no model makes a decision or sets a trust-bearing input: the provenance kind and the actor come from the harness (ADR 0004, D4), the fields the writing agent chooses (scope, class, confidence; `memory_write` in `packages/pi-extension/src/tools.ts`) are checked by the gate against the policy (`forbidden_classes`, `confidence_floor` in `evaluateWrite`), and no model classifies the request at read time. Supersedes the first version, whose "no model sets any input to a decision" was false (review finding R3-1).[^15][^16][^17][^18][^19][^20]

**2026-11-21, R3, finding.** The claim "the first governance layer over existing memory stores" is withdrawn. HEAMS ships one: `PrivacyMemoryWrapper` (`memory_plugins/heams_memory_privacy_wrapper/src/heams_memory_privacy_wrapper/wrapper.py`, repository at dec2874) applies retention and recall policies around any memory system behind its common interface (Sec. 4.2). What remains is narrower and still Engram's: the layer is deterministic only, its log is the source of truth and replays state, it covers several principals with scopes and grants, and its tax is measured under a pre-registration. HEAMS evaluates its layer on MilaMem only (Table 3, caption), so neither project has measured one policy across stores. The README and `docs/architecture.md` state the narrowed claim (`docs/research/positioning.md`).[^21][^22]

**2026-11-21, R3, finding.** SAFE-Mem (Li et al., arXiv 2610.22959) is a memory system of its own, a claim graph, in which each claim carries a kind, an authority and a scope and is admitted only for the uses those labels support. It is the nearest published neighbour to Engram's typed admission (card R3). Admission is a comparison in code (Eq. 2; `_admits` in `src/ams/memory/typed.py`, repository at bac6090), over labels of which a model sets the kind at extraction and the use a request needs (prompts Q.1 and Q.4), and channel records set authority and scope (Sec. 4.1). On MPBench, attack success falls from 26.7 to 2.6 percent on GPT-5.6-terra while recall rises from 75.9 to 86.3 percent (Table 1). It is not a layer over other stores: every baseline shares one memory (Sec. 5.1). Cited as the nearest neighbour for admission, and as pressure on H2; nothing is taken.[^23][^24][^25]

**2026-11-22, E8.15d, finding.** Claude Code's hooks reference documents `"onFailure": "block"` on command hooks: "Whether the action that triggered the hook goes ahead when the hook fails: continue or block … Requires Claude Code v2.1.295 or later." The review had it second-hand; the coordinator asked for it checked against Claude Code's own documentation before any use. Read on code.claude.com/docs/en/hooks, 2026-11-23. Failures that count include a hook that cannot start and an exit code other than 0 or 2, "even if it printed JSON that allows the action". The page's own example of the exec form (`command` and `args`, no shell) writes `${CLAUDE_PROJECT_DIR}` inside `args`, so expansion there is now documented too; absolute roots stay correct either way. The snippet sets it (see the decision entry of the same day), so a hook that cannot start blocks the call on v2.1.295 and later.[^26][^27]

## Research

**2026-10-17, milestone.** The literature review was added under `docs/readings/litreview/`: one note per paper in a fixed template (claim, method, key numbers with their table or section, what Engram borrows, what it does differently, risk to our claims, open question), an index by reading tier, and a frontier summary as of 2026-10-17. The related-work chapter and the ADR decisions in step 0 draw on these notes, so they must live in the repository beside the reading list. 68 files: the README index, the template, `sota-2026.md`, and 65 notes covering the 49 listed readings plus the October 2026 sweep marked `new`. S0.6, S0.12 and S0.13 cite these notes; where a note and a later check disagree, a new log entry records it.[^28][^29][^30]

**2026-10-29, B4, finding, H1.** MEM-INV-Bench at `cf3c9a4` defines its laundering-channel attacks in code, not in its Hugging Face Parquet tables. Card B4 had to find where an attack case, its origin channels, its laundering channel, its action and its scoring live before vendoring. `code/scenarios.py` authors 8 attack scenarios (pay, send_data, update_setting, purchase) and 6 legitimate actions; `code/exp1_propensity.py` builds memory per channel: direct (one web item), summarize L-a (the agent's paraphrase of a web item), tool_echo L-b (a trusted lookup echoing it), corroborate L-c (web plus inbox), each with a trusted erp filler. Scoring is `review.bucket_of` with recorded readings first (`score.verdict_of`); HIT is attack success. The Parquet tables hold the five extension plans. All 24 rebuilt memories equal the recorded study's (`manifest.json`, `recorded_prompt_sha256`); the reference model's recorded replies are HIT on 17 of 20 attacks (`upstream-golden.json`). No Parquet reader or new dependency; X3 can extend the subset from the same script.[^31][^32][^33][^34]

**2026-11-19, B8, finding, H3.** HaluMem's release was checked on 2026-11-19 through `gh api`, the Hugging Face API and arXiv (2511.03506, v3). The lead chose to register it for H3; a pin needs its commit, licence, data, judge and plug-in point. https://github.com/MemTensor/HaluMem: head of `main` `d653749586bfc7d13f5b68e8851f52155b5b1650` (2026-10-28, rechecked with `gh api`), no tags or releases; `LICENSE.txt` is CC-BY-NC-ND-4.0 for the whole repository, code included. Data: Hugging Face `IAAR-Shanghai/HaluMem` at `cb04336aa1b732d4b24f5186c552456b4099806e`, card licence cc-by-nc-nd-4.0; Medium (33,511,525 bytes) holds 20 users, 1,387 sessions, 14,948 memory points (3,122 updates) and 3,467 questions; Long is 106,535,674 bytes. The judge is model-based, `gpt-4o` at temperature 0 by default, no dated snapshot. Each system plugs in as `eval/eval_<system>.py`, scored by `eval/evaluation.py`. NoDerivatives forbids the committed adapted fixture subset and ported judge every pinned benchmark here has; NonCommercial conflicts with Apache-2.0 (ADR 0020).[^35][^36][^37][^38]

**2026-11-21, E8.13, change, supersedes 2026-11-21-e8-13-finding-genai-memory-span.** The literature note `repo-otel-genai-semconv.md` gains a dated correction: release v0.1.0 of `open-telemetry/semantic-conventions-genai` (commit d0e74ba, 2026-11-21) defines the memory span `gen_ai.memory.client`, with its seven operations and its attributes, the content ones opt-in. Review finding E8.13-5. The literature review is the project's source of truth, and three of the note's lines said no memory span was defined and asked whether to propose one. The original lines are kept, each marked as corrected, with the correction at the end; it also corrects the note's `sdk-trace-base` 2.12.0 pin. The earlier finding's last line, that the note was left for its owner, no longer holds.[^39][^40]

**2026-11-21, finding.** The absorb and state-of-the-art research of 2026-11-21 is committed under `docs/research/absorb/`: seventeen area studies, four gap studies, a GitHub sweep and the merged long list. The lead asked what Engram could absorb from open-source work and the state of the art, and for the research to be kept. The long list holds 166 candidate plans (18 before the tag, 48 before Gate D, 100 after). The sweep found 152 repositories and read 109 at source level; 38 sources cannot be used as code, for licence, maintenance or fit. Counts are those of `long-list.md` and section 1 of `19-github-scout.md`. The thirty-PR plan is selected from this list (`docs/tasks/absorb-plan.md`). The reports are notes, not commitments; claims about our own code that were read and not run are tested first (card E2.7).[^41][^42][^43][^44]

**2026-11-21, finding.** 111 literature notes were added under `docs/readings/litreview/`, in the template's format with `tier: new`. They were written by seventeen research agents and four gap agents covering the frontier since 2026-10-17 and the open-source repositories Engram could absorb, and a separate agent fact-checked each one. The README indexes them, and `sota-2026.md` gains a November update. The lead asked for a deep sweep of state-of-the-art methods and of repositories to absorb, with the research recorded in the literature review. Two new systems wrap existing memory stores with governance: HEAMS (2611.20144) and SAFE-Mem (2610.22959). Both must be cited. 2610.28315 is a mild threat to H1 for Twin, and 2611.01386 a mild threat to H5. The novelty claim narrows to "the first deterministic, event-logged, replayable plane across stores with a measured tax". The PR plans go to the lead as a separate report.[^45][^46]

**2026-11-21, R2, change.** `docs/research/baselines.md` is the baseline matrix of memory architectures: Mem0 and Letta as the only wrapped upstream stores, and A-Mem, MemoryOS and Letta sleep-time compute as candidates labelled "algorithm re-implementation". MemOS, Graphiti, MIRIX, LightMem, Supermemory, FadeMem and Human-Inspired Memory are listed as ideas or spikes. Card R2, step 5. The thesis needs an honest answer to "compared against what", and a re-implementation must never be claimed as the upstream product. Each licence, star count and push date was read with `gh api` on 2026-11-21. The A-Mem licence that the gap study left unverified is MIT on both of its repositories. The file registers nothing and sketches the shape a baseline arm would take. A baseline arm needs its own card, and the lead's registration as a descriptive arm.[^47][^48]

**2026-11-21, R3, change.** The review fix pass of card R3: findings R3-1 to R3-7 fixed; R3-8 (the `make thesis` blocker) is left to the coordinator. The independent review found three important and several minor issues, all overclaims or citation slips. R3-1: no model makes a decision or sets a trust-bearing input, with the agent's scope, class and confidence checked by the gate. R3-2: the H2 bullet gives both SAFE-Mem baselines. R3-3: the literature notes corrected in place. R3-4: HEAMS logs recall decisions and retention drops, not every retention decision. R3-5: the README, `docs/architecture.md` and the positioning say `prereg-v1` is tagged before the first run. R3-6: H2 on three models, H1 on M1. R3-7: `PERMISSION_TRUST`, `RetrievalResult` in `base.py`, the erasure exception in `itemsAt`. Six entries superseded, each by a `-v2` or `-applied` entry. `make lint-docs` passes. The branch is ready for re-review.[^49][^50][^51][^52][^53][^54]

**2026-11-21, R3, change.** `README.md` and `docs/architecture.md` each gained one short paragraph that states the claim: to our knowledge, the first deterministic, event-logged, replayable control plane across memory stores, with a pre-registered measurement of its governance tax. Each names HEAMS and SAFE-Mem as the nearest neighbours and points at `docs/research/positioning.md`. Card R3, step 3. Before this card neither file stated what is new. The grep the card names (`first`, `novel`, `no existing`, `nobody`, `none of`) over `README.md`, `docs/architecture.md`, `docs/research/` and `research/thesis/` found no novelty sentence; every hit was about something else, such as a first run or a first draft. Two paragraphs added, no other sentence changed. The architecture paragraph also names the two limits of the claim (ADR 0032 and ADR 0035). The README overhaul by another agent should keep the paragraph or move it whole.[^55][^56][^57]

**2026-11-21, R3, decision.** HEAMS and SAFE-Mem reach the thesis's related-work notes through `finding` log entries with `chapter: related-work`, not through a hand edit of `research/thesis/drafts/related-work.md`, and the drafts were not regenerated in this branch. The drafts are written by `research/scripts/consolidate_log.py`, and `related-work.md` says "Edit the entries, not this file." The committed drafts hold about sixty dated paragraphs against about 1,560 entries on main, so regenerating them here would rewrite every draft and collide with ten parallel branches. Ten of this card's entries have `chapter: related-work`, led by `2026-11-21-r3-finding-heams.md` and `2026-11-21-r3-finding-safe-mem.md`. The consolidator's own `validate` passes all eighteen, and its `render_chapter` puts both papers in a related-work draft rendered from them; a full `make thesis` fails on main for another reason (`docs/log/2026-11-21-r3-failure-make-thesis-on-main.md`). The next `make thesis` on main puts them in the committed draft.[^58][^59][^60][^61]

**2026-11-21, R3, finding, supersedes 2026-11-21-r3-finding-litreview-corrections.** The literature notes were corrected against the full texts, now in card R3's scope. The notes read parts of each paper; R3 read both, and the review brought the notes into scope. `2610.22959-safe-mem.md`: no-defence recall 75.9 and 79.5, not 41.1 (Table 1); "what Engram does differently"; the H2 risk names both baselines (Appendix G, Table 6); v2 date and Apache-2.0. `2611.20144-heams.md`: four new benchmarks, not three; governance evaluated only with MilaMem (Table 3); Tables 7 and 8 numbers; deterministic, LLM and hybrid policies, logging as run records, no delete or consolidate governance; the risk paragraph quotes the new claim; Apache-2.0. `sota-2026.md`, November section, and the same paragraph in `docs/research/absorb/16-frontier-sweep.md`: MilaMem only, Table 8, policy modes, recall 75.9, the claim. `README.md`, novelty line: pre-registered measurement. Supersedes the first version, which left the notes unedited.[^62][^63][^64][^65][^66][^67]

**2026-11-21, R3, finding, H2, supersedes 2026-11-21-r3-finding-narrowed-measured-tax.** "With a measured governance tax" was narrowed to "with a pre-registered measurement of its governance tax". Both neighbours measure a trade-off: HEAMS's governance costs 4.80 points of helpfulness (Table 5) and permitted recall falls to 84.47 percent (Table 7); SAFE-Mem's admission costs 3.6 and 3.8 LoCoMo points against its own graph (Appendix G). Engram's tax is not measured yet; the live runs start on 2026-12-01. The distinguishing part is the registration: H2 at three presets against C1 and C2, H1 against instruction (C3, C4), with seeded, cached calls, H2 on three models (M2, M3 on fixed subsets), H1 on M1. It is to be tagged as `prereg-v1` before the first run (ADR 0023); only `prereg-v0` is tagged today. Once H2 reports, the claim may say "measured" with the result's path. Supersedes the first version, which said "on three models" for H1 too (review finding R3-6).[^68][^69][^70][^71][^72]

**2026-11-21, R3, change.** `docs/research/positioning.md` was added: the novelty claim, what was read of HEAMS and SAFE-Mem, a table of eleven differences with the paper section or source file behind each cell and the Engram file or ADR behind each Engram cell, what the neighbours mean for H1, H2 and H4, and four corrections to the literature notes. Card R3: HEAMS (2611.20144) and SAFE-Mem (2610.22959) made "the first governance layer over existing stores" untrue, and an examiner will know both papers. Both papers were read from their PDFs (HEAMS v1, 69 pages, body and most appendices; SAFE-Mem v2, all 18 pages), and both repositories at a fixed commit: `milatechtransfer/heams` at dec2874 and `LVenum/SAFE-Mem` at bac6090, both Apache-2.0. Six claims were narrowed, each in its own finding entry. The README, `docs/architecture.md` and the thesis point at one statement of the claim.[^73][^74][^75]

**2026-11-21, R4, finding, supersedes 2026-11-21-r4-finding-primary-texts-checked.** The primary texts checked again, correcting what the earlier entry said of Regulation (EU) 2026/1744. The review found that the Omnibus's point (18) adds AI Act Article 42(3), which deems high-risk systems within the scope of Regulation (EU) 2024/2847, under the conditions of its Article 12(1), to comply with the cybersecurity requirements of Article 15, which rows AIA-15-1 and AIA-15-5 cite. The Omnibus amends none of the texts of Articles 12, 13, 14, 15, 19 and 26, and its point (18) bears on Article 15 through Article 42(3). Its new Article 113 point (c) applies Chapter III, Sections 1 to 3, with the exception of Article 6(5), from 2 December 2027 (Annex III) and 2 August 2028 (Annex I). AI Act 12(1), 19(1) and 26(6) are as the research note said. All 27 quotations stand. GDPR corrigenda remain unread.[^76][^77][^78]

**2026-11-22, L7, finding, H3.** Checked the training data licence of cross-encoder/nli-deberta-v3-small, as card R2's proposal asks. P3 rules out a model trained on non-commercial data such as ANLI. The model card at fa2804872c3b names SNLI and MultiNLI only, Apache-2.0, base microsoft/deberta-v3-small (MIT). stanfordnlp/snli at cdb5c3d5 is CC-BY-SA-4.0; nyu-mll/multi_nli at da70db2a is mostly OANC's permissive licence, with fiction under CC-BY-SA-3.0, CC-BY-3.0 or public domain. No non-commercial licence appears. The model is usable under P3. The thesis states the training data. Arm P3 is proposed, not registered: this is an engineering check, not a thesis result.[^79][^80]

**2026-11-25, finding.** Five premises about sources changed since 2026-11-21: one licence and four repository names, and one pin. Every source was rechecked with `gh api` and crates.io on 2026-11-25. `modelcontextprotocol/servers` reports NOASSERTION: its LICENSE is a transition from MIT to Apache-2.0, both allowed. `caura-ai/caura-memclaw` redirects to `caura-ai/caura`, `informalsystems/quint` to `quint-co/quint`, `secure-systems-lab/dsse` to `dsse-lf/dsse`. `cedar-policy-symcc` 0.9.0 is from 16 November, under two weeks old, so 0.8.1 is the pin. Cards A6, D5, E2.17, E1.8, E9.15 and E2.18 name the current names and commits.[^81][^82]

[^1]: `packages/core/test/unit/distill/skill-spec/expected.json`
[^2]: `packages/core/test/unit/distill/skill-spec/cases.json`
[^3]: `packages/core/src/log/chain.ts`
[^4]: `packages/core/src/log/verify.ts`
[^5]: `docs/absorbed.md`
[^6]: `packages/core/src/policy/trust.ts`
[^7]: `docs/absorbed.md`
[^8]: `docs/research/positioning.md`
[^9]: <https://arxiv.org/abs/2611.20144>
[^10]: <https://github.com/milatechtransfer/heams>
[^11]: `docs/research/positioning.md`
[^12]: `docs/decisions/0003-event-log-and-sqlite.md`
[^13]: `packages/core/src/schema.ts`
[^14]: <https://github.com/milatechtransfer/heams>
[^15]: `docs/research/positioning.md`
[^16]: `docs/decisions/0006-scope-owner-grants-typed-policy.md`
[^17]: `packages/pi-extension/src/tools.ts`
[^18]: `packages/core/src/policy/evaluate.ts`
[^19]: <https://arxiv.org/abs/2611.20144>
[^20]: <https://arxiv.org/abs/2610.22959>
[^21]: `docs/research/positioning.md`
[^22]: <https://arxiv.org/abs/2611.20144>
[^23]: `docs/research/positioning.md`
[^24]: <https://arxiv.org/abs/2610.22959>
[^25]: <https://github.com/LVenum/SAFE-Mem>
[^26]: <https://code.claude.com/docs/en/hooks>
[^27]: `fixtures/harness/claude-code/.claude/settings.json`
[^28]: `docs/readings/litreview/README.md`
[^29]: `docs/readings/litreview/sota-2026.md`
[^30]: `docs/readings/litreview/TEMPLATE.md`
[^31]: `fixtures/bench/mem-inv-bench/README.md`
[^32]: `fixtures/bench/mem-inv-bench/manifest.json`
[^33]: `packages/bench/scripts/vendor-mem-inv-bench.py`
[^34]: `packages/bench/PINS.md`
[^35]: `gh api repos/MemTensor/HaluMem`
[^36]: `gh api repos/MemTensor/HaluMem/contents/LICENSE.txt`
[^37]: `packages/bench/PINS.md`
[^38]: `docs/readings/litreview/2511.03506-halumem.md`
[^39]: `docs/readings/litreview/repo-otel-genai-semconv.md`
[^40]: `gh api repos/open-telemetry/semantic-conventions-genai/git/ref/tags/v0.1.0`
[^41]: `docs/research/absorb/README.md`
[^42]: `docs/research/absorb/long-list.md`
[^43]: `docs/research/absorb/19-github-scout.md`
[^44]: `docs/research/absorb/00-master-plan.md`
[^45]: `docs/readings/litreview/README.md`
[^46]: `docs/readings/litreview/sota-2026.md`
[^47]: `docs/research/baselines.md`
[^48]: `docs/research/absorb/18d-memory-system-baselines.md`
[^49]: `docs/research/positioning.md`
[^50]: `README.md`
[^51]: `docs/architecture.md`
[^52]: `docs/readings/litreview/2611.20144-heams.md`
[^53]: `docs/readings/litreview/2610.22959-safe-mem.md`
[^54]: `make lint-docs`
[^55]: `README.md`
[^56]: `docs/architecture.md`
[^57]: `docs/research/positioning.md`
[^58]: `research/thesis/drafts/related-work.md`
[^59]: `docs/conventions/documentation.md`
[^60]: `make thesis`
[^61]: `docs/log/2026-11-21-r3-failure-make-thesis-on-main.md`
[^62]: `docs/readings/litreview/2610.22959-safe-mem.md`
[^63]: `docs/readings/litreview/2611.20144-heams.md`
[^64]: `docs/readings/litreview/sota-2026.md`
[^65]: `docs/readings/litreview/README.md`
[^66]: `docs/research/absorb/16-frontier-sweep.md`
[^67]: `docs/research/positioning.md`
[^68]: `docs/research/positioning.md`
[^69]: `docs/research/preregistration.md`
[^70]: `docs/decisions/0023-preregistration-in-repo.md`
[^71]: <https://arxiv.org/abs/2611.20144>
[^72]: <https://arxiv.org/abs/2610.22959>
[^73]: `docs/research/positioning.md`
[^74]: <https://arxiv.org/abs/2611.20144>
[^75]: <https://arxiv.org/abs/2610.22959>
[^76]: `research/configs/crosswalk.json`
[^77]: `docs/compliance/README.md`
[^78]: `uv run python research/scripts/crosswalk.py --config research/configs/crosswalk.json --out research/results/h1-crosswalk.json --legal .engram/upstream/legal --fetch`
[^79]: `docs/deps.md`
[^80]: `docs/readings/litreview/repo-nli-onnx-stack.md`
[^81]: `docs/tasks/absorb-plan-2.md`
[^82]: `gh api repos/modelcontextprotocol/servers/contents/LICENSE`
