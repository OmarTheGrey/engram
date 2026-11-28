# Decisions for the lead, 2026-11-20

Everything open that is yours to decide, from the decision sheet, the reviews of 2026-11-19 and 2026-11-20, and the ADRs. Each item gives a question, options, and the recommendation as option (a). Answer the way you did before, for example "1a 2a 3b". Items are ordered by when the answer is needed.

Sources: `docs/research/prereg-v1-decisions.md` (items 1 and 20 are still open), `docs/tasks/backlog.md`, ADRs 0005, 0006, 0010, 0013, 0018, 0027 and 0034, and the review findings in the log (`docs/log/2026-11-1*` and `2026-11-20-*`).

## A. Needed by 24 November, for Gate C (13 December)

These block the `prereg-v1` tag or the H1 run.

1. **The three models (sheet item 1).**
   - (a) M1 `openai/gpt-5.6-terra`, M2 Mistral large 4, M3 DeepSeek v4 pro, all through OpenRouter with reasoning off. H1 on M1 with the judge costs about $390 to $3,106.
   - (b) DeepSeek v4 pro or Mistral large as M1, about $170 to $1,005.
   - (c) A small model as M1, about $82 to $443, but the weakest test of H1.
2. **The utility checkpoints in H1's GateMem run (sheet item 20).**
   - (a) Include them, so H1 reports MGS. They are about 31 percent of the GateMem cost.
   - (b) Drop them: no MGS, and about 31 percent cheaper.
3. **The spend ceiling per run (card RV1).**
   - (a) 1.25 times the run's high cost estimate, per provider.
   - (b) A fixed amount you name.
4. **The turn limit per session (card RV1).**
   - (a) 8 model calls. A capped session is excluded and counted per condition.
   - (b) Another number.
5. **The label audit's rejection rule.** The audit is done by three members.
   - (a) An item is rejected when two of the three reject it.
   - (b) When all three reject it.
   - (c) When any one rejects it.
6. **If the audit's stopping rule trips (more than 10 percent rejected).**
   - (a) Drop the rejected items, list them in v1, and proceed.
   - (b) Pause for an amendment.
7. **Live checks before the tag (design review RV-DES-9).** No live call has ever been made.
   - (a) Run a smoke config on fixture items and GateMem's reference agents with a tolerance, before tagging. A code fix found then does not change the tagged code. Cost: a few dollars.
   - (b) Skip both, so the first live call is the registered run.
8. **A hypothesis that does not run (RV-DES-12).**
   - (a) It enters Holm with p = 1, so the adjustment stays over five.
   - (b) Holm adjusts over the hypotheses that ran.
9. **When H2 to H5 are fixed.**
   - (a) Before H1's data exist. Their designs are amended in the tagged text, or by amendment before H1's run.
   - (b) Later, by amendment.
10. **Gate C when H1's interim read-out is "undecided"** (p below 0.05, but 5p at or above it).
    - (a) Continue as planned, report it as undecided, and let the final Holm over all five decide.
    - (b) Treat it as not supported and take the pivot.
11. **H2's and H5's thresholds, still marked "proposed".** They are: at least 90 percent of C2's utility with at most 20 percent of its violations, and replay admission at 4 of 5.
    - (a) Confirm them as written.
    - (b) Change one; name which.
12. **H2's clock on LongMemEval (card B6).** Medium's 90-day ttl hides turns in 54 questions at read time, which can move C2 minus C5 by up to 10.8 points either way.
    - (a) Keep the registered clock and preset, and add a sensitivity analysis on the 446 unaffected questions. It is descriptive, outside Holm, and not decisive.
    - (b) A LongMemEval preset with a ttl of 365 days, by amendment.
    - (c) Read at the last session's date.
13. **LongMemEval's judge in v1's Models section.**
    - (a) `openrouter/openai/gpt-4o-2024-08-06`, seeded, the paper's model through the seeded route.
    - (b) OpenAI directly, unseeded, as an exception to ADR 0017.
14. **An answer call refused with a non-retryable error,** for example a prompt over the context limit.
    - (a) Exclude the session under its own reason, counted per condition.
    - (b) Stop the run.
15. **Capped utility sessions** leave MGS's U silently.
    - (a) Report their count per condition in the H1 table.
    - (b) Leave them in the run summary only.
16. **v1's wording of C3 and C4** (card RV1's proposal). C3 and C4 also carry an identity sentence and two instruction sentences.
    - (a) Adopt the proposed wording.
    - (b) Change the prompts to match the old wording.
17. **Who reads MEM-INV-Bench's UNREAD replies after the run.**
    - (a) Mohamad and Shady.
    - (b) Two others you name.
18. **The dates.**
    - (a) Label audit 23 to 28 November; tag and Zenodo deposit by 30 November; H1 runs 1 to 8 December, sharded.
    - (b) Other dates.
19. **The server's clock (cards RV5 and RV7: RV-SRF-2, RV-CORE-3).** Today a caller can backdate a read past a grant's expiry.
    - (a) The server and core own the access clock. A requested time is read-only, sweeps nothing, and is recorded apart from the event's time. This is a proposed amendment to ADRs 0005 and 0027.
    - (b) Keep the caller's time, and state the hole.

## B. Needed by 18 December, for Gate D (24 January)

These need answering before the frontier work (X5) starts.

20. **H4 across stores (RV-DES-1).** No condition uses a store's own search, so requests are identical on every store, and the test measures only noise.
    - (a) Restate store independence as a design property, proven by a request-identity check. Drop the store family from H4's equivalence test and from Gate D's "two stores".
    - (b) A new ADR letting H4 use each store's own search, reversing ADR 0031's decision 2.
21. **The frontier's axes (RV-DES-2).** The presets admit and deny the same items on both benchmarks; only LongMemEval's ttl differs.
    - (a) Measure candidate axes offline now (grant honouring, scope width, retention budgets), choose from the result, and register them by amendment before X6.
    - (b) Keep the three presets as they are.
22. **H2's violations (RV-DES-3).** H2's support rule needs a violation rate on LongMemEval, which has none, and H2 has no sample size.
    - (a) Violations come from GateMem's A and F at the same preset, and the sizes on M1 are fixed now.
    - (b) Another source.
23. **H3's main test (RV-DES-4).** On LongMemEval's own memory only the duplicate lint fires, so C6 minus C5 will be near zero.
    - (a) Make the model tier H3's main test.
    - (b) Restrict H3 to the knowledge-update questions.
    - (c) Keep it, and accept a likely null.
24. **H4's MemoryAgentBench arm (RV-DES-7).** It has no violation definition, and card B9 builds something else.
    - (a) Run H4 on GateMem only.
    - (b) Define its violation and rewrite B9.
25. **C7, the harness claim (RV-DES-8).** C7 equals C5 in benchmark sessions, and other harnesses cannot be seeded.
    - (a) Restate the harness claim as untested, and drop C7's test.
    - (b) Give C7 a bypass channel that only the plane's read filter catches.
26. **The kill list and Gate D's fail response (RV-DES-13).** Items 1 and 3 are done, and item 2 is a harness H4 needs.
    - (a) I draft a rewrite, with an "undecided" branch for Gate C, for you to approve.
    - (b) You rewrite it.
27. **Where the live cassettes go (RV-DES-14).** About 0.9 to 2 GB for H1.
    - (a) A Zenodo deposit, with a fetch script checked by sha256.
    - (b) Kept locally only.
28. **A Knowledge-profile dogfood.** Gate D names it, and no card covers it.
    - (a) Add a card that runs it alongside the twin dogfood.
    - (b) Drop it from Gate D's criterion.
29. **The MERIT, MemoryAgentBench and tau2 harnesses (RV-DES-6).** They run their models outside the cache and seed rules.
    - (a) A local cassette proxy speaking the OpenAI API, shared by all three.
    - (b) Port each harness to TypeScript, which takes weeks each.
30. **Distill and H5 (RV-DES-5).** Almost nothing is built.
    - (a) I draft the prerequisites for you to approve: the tau2 task split, the user-simulator model, dropping the unregistered repository task set, and the harness card.
    - (b) Defer H5.
31. **The twin dogfood's start.**
    - (a) The day cards E2.6 (merged) and RV4 (adoption) are merged and you accept item 32.
    - (b) Another date.
32. **The twin profile's values** (reviewed in `docs/dogfood.md`, "The twin profile's values").
    - (a) Accept them all as reviewed.
    - (b) Change one; name which.
33. **Claude Code's own auto memory during the dogfood (RV-SRF-5).**
    - (a) Members turn auto memory off, and "zero violations" is measured on the plane, with the native path stated as outside it.
    - (b) Keep auto memory on, and state it.

## C. ADRs and open policy questions

34. **ADR 0034, the grant change.**
    - (a) Accept it, with a 1-year cap on a grant's expiry, and refuse an expired or other-class grant on a first write. That means fixing the fixtures that write such grants.
    - (b) Accept it with no cap and no first-write rule.
35. **A promotion carries a grant across a class change, which ADR 0034 says it does not.**
    - (a) Amend the ADR: a promotion keeps the grant, which then admits nothing.
    - (b) Drop the grants on a promotion that changes class.
36. **A grantee sees every grant on an item.**
    - (a) Show a non-owner only the grants naming them, in core.
    - (b) Leave it as it is.
37. **ADR 0018's amendment from card L1** (the exact-duplicate lint's strict form).
    - (a) Accept.
    - (b) Change.
38. **ADR 0010's open questions** (card E2.6). Answer each part:
    - Should an offboarded person scope refuse all later writes? (a) yes, (b) no.
    - Should the plane keep hashes of erased content, to refuse a copy written under a new id? (a) yes, (b) no.
    - Should erasure reach promotions out of the person scope made before the offboarding? (a) no, they are the scope's knowledge, (b) yes.
    - Should a Claude Code file the plane could not delete be refused while it holds any erased content, even after it is appended to? (a) yes, (b) no.
39. **Who may rewrite or move another person's item (card RV7: RV-CORE-1, -2).**
    - (a) Only the owner may rewrite an item that carries live grants, and only the owner may change an item's scope.
    - (b) Keep today's rule, membership only.
40. **Event visibility (card RV7: RV-CORE-4).**
    - (a) An event is shown only to members whose read matrix covers its scope.
    - (b) To any member, as today.
41. **What memory search means across stores (RV-ADP-6).** Today the files and Letta adapters need every term, Mem0 searches semantically, and stores without search match any term.
    - (a) Define it in ADR 0013 as any term, ranked by core, with no store-specific search.
    - (b) Keep each store's own search.
42. **The confidence floor (RV-CORE-8).** A model can write confidence 1.
    - (a) Record that the floor does not gate model and compaction sources.
    - (b) Cap the confidence of model writes in core.

## D. The lint and research details

43. **L3's pilot variance bound.** The roadmap names "variance above bound" as a risk but gives no bound.
    - (a) A standard deviation across seeds of at most 0.05 on precision and recall per lint.
    - (b) Another bound.
44. **A later update of the same attribute in L3's contradiction prompt.**
    - (a) It counts as a contradiction. Change the prompt and record the cassettes again.
    - (b) It does not.
45. **H3's deterministic claim.** On the seeded set it holds by construction.
    - (a) Restate it as precision measured on natural memory through the audit sample, and keep seeded recall as a regression check.
    - (b) Keep it as written.
46. **B5's unnamed assistant model.** It matters only for C6, where missing-provenance would flag half the memory.
    - (a) B5 names the model.
    - (b) C6 drops the missing-provenance lint on LongMemEval.
47. **The live model-lint run (L4).** It is 95,217 calls, 3,000 per seed about labelled items.
    - (a) Decide it with the spend.
    - (b) A seeded 250-question subset by amendment, about 47,600 calls.
    - (c) All 500 questions, as registered.
48. **MPBench.** It stays a candidate, and the request is not sent.
    - (a) Keep as is.
    - (b) Send the request.

## E. The absorb plan, 2026-11-21

Put on 2026-11-21 and closed the same day under the lead's delegation (the answers are in the last section, "Decided on 2026-11-21"). These come from `docs/tasks/absorb-plan.md`, the thirty pull requests chosen from that day's research. None blocks the `prereg-v1` tag or H1's runs. The first card that waits on one is E2.8 in the week of 14 December. Answer as before, for example "49a 50a".

49. **The tamper-evident log's design (ADR 0038, card E1.6).** A hash chain makes an edit of the log detectable, and offboarding has to edit the log to erase a person's content.
    - (a) Accept ADR 0038: a chain in a side table over a skeleton of each event that holds no content, salted commitments for the fields an erasure removes, signed checkpoints with the key held by the operator. Erasure by key destruction stays a later decision.
    - (b) A chain over full event bodies, with an erasure recorded as a redaction entry. Simpler, and the digest of a short erased value stays guessable.
    - (c) No chain: state in the thesis that the log is append-only by convention.
50. **Content guards at the write gate (ADR 0039, cards E2.8 to E2.10).** The gate does not look at content today.
    - (a) Accept ADR 0039: deterministic detectors for secrets, personal data and injected instructions; a match denies the write or holds it as a candidate, never rewrites it; off in every registered preset.
    - (b) Secrets and personal data only, without the injection screen.
    - (c) Leave the gate as it is and keep content safety out of scope.
51. **Trust floors (ADR 0040, cards E2.7, E2.8 and E2.11).** A write whose actor names no source keeps the provenance it claims, and an eviction may ignore how trusted its victim is (the second is unconfirmed until card E2.7's tests run).
    - (a) Accept ADR 0040: prove both with tests first; then a floor for unattested writes and protection of more trusted items, both opt-in and off in the H1 to H4 presets, on in a new preset, with an eighth invariant.
    - (b) Make both the default now, and amend the registered conditions before the tag.
    - (c) Test and document only; change nothing.
52. **Cedar (ADR 0041, card E2.12).** ADR 0006 deferred Cedar to after the thesis.
    - (a) Accept ADR 0041: export the policy to Cedar and test the evaluator against Cedar's engine; the typed evaluator stays the authority and a disagreement is a finding.
    - (b) Keep ADR 0006's deferral and drop card E2.12.
53. **What "who can read this memory" reveals (card E2.13).**
    - (a) It answers only for an actor who may already read the item or who owns the scope, and names grant holders to the owner only.
    - (b) Any member of the scope sees the full reader set, grant holders included.
54. **Verified actors (card E8.12).** Every surface takes the actor's id on trust today.
    - (a) Tokens from an external issuer verified with jose, plus hashed API keys for the local server; an ADR fixes how a token's subject maps to an actor before any code; no identity provider is bundled.
    - (b) Bundle an identity provider (better-auth) so sign-up and sessions work out of the box.
    - (c) Stay on loopback with self-asserted actors until after the thesis.
55. **The trust of imported memories (card E9.8).**
    - (a) A dedicated import actor with provenance kind `import`; every imported row starts as a candidate; grants are dropped; a ChatGPT parser only once a real export is seen to contain memories.
    - (b) Imported rows keep the provenance and status their bundle states when the bundle came from Engram.
56. **The pre-registration proposals (card R2).**
    - (a) One documents-only pull request adds every proposed arm to the section "Proposed amendments, not yet registered"; you register each arm separately, by amendment, before its run.
    - (b) One pull request per arm, each opened only when its card is about to run.

## Decided on 2026-11-20, under the lead's delegation

On 2026-11-20 the lead delegated the open decisions to the orchestrating session. It closes every item it can and brings back only the highest-priority ones it cannot. These answers are binding until the lead overturns one, and each carries its reason.

Prices come from `research/results/h2-cost-table.json` (card RV8, OpenRouter's list of 2026-11-20; on branch `rv8` until that card merges). Two decisions needed new ADRs: [ADR 0035](../decisions/0035-store-independence-is-a-design-property.md) and [ADR 0036](../decisions/0036-cassettes-beyond-the-repository.md).

**Put to the lead:** item 1, the three models, which the lead answered the same day (row 1 below). Nothing is open now. (Items 49 to 56, added on 2026-11-21 in section E, came later; they were closed the same day, in the last section.)

### A. Gate C

| item | answer | reason |
|---|---|---|
| 1 | the lead's own answer, 2026-11-20: M1 `openrouter/deepseek/deepseek-v4-pro-0813`, M2 `openrouter/z-ai/glm-5.3-flash`, M3 `openrouter/mistralai/mistral-large-4-0`; reasoning off; judges as registered | Three makers (DeepSeek, Zhipu, Mistral), as ADR 0016 requires. Each exact id is OpenRouter's dated or versioned name, never a `~latest` alias. The set is priced again in card RV8 before any ceiling is set. |
| 2 | (a) include the utility checkpoints | Dropping them saves under 3% overall. H2's C2 and C5 need the same utility cells, so dropping them in H1 only makes them new calls in H2. H1 keeps MGS as registered. |
| 3 | (a) 1.25 times the run's high estimate, per provider | A formula, valid whichever models item 1 picks. A sharded run divides it by n and may overshoot by up to n sessions (card RV6). |
| 4 | (a) 8 model calls; a capped session is excluded and counted per condition | No GateMem or MEM-INV-Bench session in the fixtures needs more than 4. |
| 5 | (a) two of three auditors reject | One auditor can be noisy; all three is too lenient for a stopping rule. |
| 6 | (a) drop the rejected items, list them in v1, proceed | It keeps the 13 December gate, and the rejected items are reported, never silently lost. |
| 7 | (a) run the smoke config and B1 before the tag | A few dollars, against the first live call being the registered run. At 50 checkpoints B1's band accepts A = 0 and F = 0, so B1 checks utility (U) above all; v1 says so. |
| 8 | (a) a hypothesis not run enters Holm with p = 1 | Conservative, and it matches the guard card X4 built. |
| 9 | (a) H2 to H5 are fixed before H1's data exist | Otherwise H1's results could shape the other designs. |
| 10 | (a) an "undecided" read-out continues and is reported as undecided | The final Holm over all five decides. A pivot on a non-result would waste the run. |
| 11 | (a) confirm H2's and H5's thresholds as written | No data argues for a change, and a change after the review would look tuned. |
| 12 | (a) the registered clock, plus a descriptive sensitivity analysis on the 446 unaffected questions, outside Holm | It keeps the registered design and shows the ttl's effect openly. |
| 13 | (a) `openrouter/openai/gpt-4o-2024-08-06`, seeded | It is the paper's judge, and OpenRouter lists it ($2.50 and $10 per million tokens). ADR 0017 holds without an exception. |
| 14 | (a) exclude the session under its own reason, counted per condition | One over-long prompt should not stop a multi-day run. |
| 15 | (a) report capped utility sessions per condition in the H1 table | Visible where the result is read. |
| 16 | (a) adopt card RV1's wording for C3 and C4 | The prompts are what ran, so the text should match them. |
| 17 | (a) Mohamad and Shady read the UNREAD replies | Both are on the team the lead named. The readings are blind and pseudonymous (card RV2). |
| 18 | (a) the audit 23 to 28 November; the tag and Zenodo deposit by 30 November; H1 1 to 8 December on 4 shards | Card RV6 estimates 13 to 49 hours for H1's GateMem arm on 4 shards. |
| 19 | (a) the server and core own the access clock | Built and merged in card RV5 (#59), with the log's high-water mark. |

### B. Gate D

| item | answer | reason |
|---|---|---|
| 20 | (a) store independence is a design property, proven by a request-identity check; the store family leaves H4's equivalence test and Gate D's "two stores" | No condition uses a store's own search (ADR 0031), so a cross-store test measures only noise. See [ADR 0035](../decisions/0035-store-independence-is-a-design-property.md). |
| 21 | (a) measure candidate axes offline, choose from the result, register them by amendment before X6 | Card RV8 measured them; the choice is made from that result when it merges. |
| 22 | (a) H2's violations come from GateMem's A and F at the same preset, and the sizes on M1 are fixed now | LongMemEval has no violation labels. |
| 23 | (a) the model tier is H3's main test | On LongMemEval only the duplicate lint fires deterministically, so the deterministic test is close to a certain null. |
| 24 | (a) H4 runs on GateMem only | MemoryAgentBench has no violation definition, and card B9 builds something else. See ADR 0035. |
| 25 | (a) the harness claim is restated as untested, and C7's test is dropped | C7 equals C5 in benchmark sessions, and the other harnesses cannot be seeded. |
| 26 | (a) the orchestrator drafts the kill-list rewrite, with Gate C's "undecided" branch, for the lead | |
| 27 | (a) a Zenodo deposit with a fetch script checked by sha256 | As the lead chose for the data (decision-sheet item 3a). See [ADR 0036](../decisions/0036-cassettes-beyond-the-repository.md). |
| 28 | (a) a card runs a Knowledge-profile dogfood beside the twin dogfood | Gate D names it. |
| 29 | (a) a local cassette proxy speaking the OpenAI API, shared by the three harnesses | Days of work rather than weeks per harness, and it brings them under rules 6 and 7. See ADR 0036. |
| 30 | (a) the orchestrator drafts H5's prerequisites for the lead | The tau2 split, the user-simulator model, dropping the unregistered repository set, and the harness card. |
| 31 | (a), with one more condition: the day card RV7 (owner rules, #61) merges | E2.6 and RV4 are merged. RV7 closes a co-holder's way of taking an owner's item, and the twin dogfood exercises that. |
| 32 | (a) accept the twin profile's values as reviewed | |
| 33 | (a) members turn Claude Code's auto memory off | "Zero violations" is measured on the plane, and the native path is stated as outside it (`docs/dogfood.md`). |

### C. ADRs and policy

| item | answer | reason |
|---|---|---|
| 34 | (a) accept ADR 0034, with a 1-year cap on a grant's expiry, and refuse an expired or other-class grant on a first write | The fixtures that write such grants are fixed in the same card. |
| 35 | (a) amend ADR 0034: an owner's promotion keeps the grant, which then admits nothing across a class change | A non-owner's promotion now drops grants (card RV7). |
| 36 | (a) a non-owner sees only the grants naming them, in core | The API should not leak more than the inspector does. |
| 37 | (a) accept card L1's amendment to ADR 0018 | |
| 38 | (a) on all four parts | An offboarded person scope refuses later writes. The plane keeps hashes of erased content (built in E2.6 and RV4). Promotions made before the offboarding stay as the scope's knowledge. A file holding erased content is refused while it holds it. |
| 39 | (a) only the owner rewrites an item carrying grants, or moves an item | Built in card RV7. |
| 40 | (a) events follow the read matrix | Built in card RV7. |
| 41 | (a) ADR 0013 defines memory search as any term, ranked by core | One meaning on every store, explainable. |
| 42 | (a) record that the confidence floor does not gate model and compaction sources | A model can claim confidence 1. Capping it in core would still gate on a number the writer chose. |

### D. Lints and research

| item | answer | reason |
|---|---|---|
| 43 | (a) a standard deviation across seeds of at most 0.05 on precision and recall, per lint | |
| 44 | (a) a later update of the same attribute counts as a contradiction; change the prompt and re-record the cassettes | Two live items holding conflicting values are the hygiene problem the lint exists to flag. |
| 45 | (a) restate H3's deterministic claim as precision on natural memory, through the audit sample; seeded recall stays as a regression check | |
| 46 | (a) B5 names its assistant model | |
| 47 | (c) all 500 questions, as registered | The 250-question subset saves under 4% of the total and would need an amendment. |
| 48 | (a) MPBench stays a candidate; the request is not sent | |

### Decisions the review cards left open

| from | answer | reason |
|---|---|---|
| RV6, shard count | 4 shards for H1 | Card RV6's wall-time estimate fits the 1 to 8 December window. |
| RV6, B1 band and smoke pass rule | accept the band as computed (U 40 to 50, A 0 to 12, F 0 to 6 of 50) and the pass rule as proposed | See item 7 on what B1 can show. |
| RV6, OpenRouter upstreams | pin each model to its maker's own endpoint where OpenRouter lists one, otherwise to the cheapest that honours `seed`, with `allow_fallbacks: false` | Named per model once item 1 is answered. |
| RV7, expired grants and the owner rule | expired grants count, and the owner's own agent may rewrite | An expired grant can be renewed by the owner alone, and the owner's agent acts under the owner's id. |
| RV4, the invariants file's second reviewer | the PR #58 verifier counts, and approved invariants 6 and 7 | `docs/log/2026-11-20-orch-rv4-verification-follow-ups.md` |

The answers card that carries these into the pre-registration, the ADRs and the roadmap follows as its own PR, as on 2026-11-19.

## F. Proposed by the absorb cards, 2026-11-21

Answered by the lead on 2026-11-25, every item (a) (section "The lead's answers, 2026-11-25" at the end). Each was drafted by a card's agent while implementing it; the card ships the recommendation behind it, and accepting or changing it is a `decision` log entry plus a status change in the ADR.

60. **ADR 0042, verified actors (card E8.12).** Answered 2026-11-25 by the lead: (a). Item 54 chose tokens from an external issuer and hashed local API keys; the ADR fixes how a credential becomes an actor.
    - (a) Accept ADR 0042: the operator's subjects file maps a token's exact issuer and subject (and the key file maps a key) to one actor with its level, memberships and source; no claim sets any of them, a request may only narrow its memberships, and a source sent on an authenticated call is ignored; a served surface needs a credential flag or `--insecure-loopback`; each event a served surface appends gets a row in a side table naming the authenticated requester or the waiver.
    - (b) Accept it, but derive an actor from a subject the subjects file does not name (`person:<sub>`, a member of its own scope only), so a new person needs no file edit.
    - (c) Keep self-asserted actors on loopback, with the ADR as the design for after the thesis.
61. **ADR 0043, decision export and egress (card E8.13).** Answered 2026-11-25 by the lead: (a). Decisions can be sent as OpenTelemetry spans to a collector, which takes them off the machine (rule 12).
    - (a) Accept ADR 0043: off unless the operator names a sink (`--otlp` or `--export-jsonl`, or their `ENGRAM_` variables; `OTEL_*` never turns it on); a span carries the decision, its rule, the actor, the scopes and ids, never content, a content hash, a store path or a reason clause outside the content-free templates; no content mode exists.
    - (b) Accept it, and add an opt-in content mode as the GenAI conventions allow, off by default.
    - (c) Keep the JSONL sink only, so nothing leaves the machine, and drop OTLP until after the thesis.

62. **ADR 0044, the CLI's terminal interface (card E8.15).** Answered 2026-11-25 by the lead: (a). The six delegated calls below stand. On 2026-11-26 the lead decided to merge branch `cliupgrade`, where the TUI was built, into main as one pull request (`docs/log/2026-11-26-e8-15-decision-merge-to-main.md`). Card E8.15 is the lead's own request of 2026-11-21 for a TUI, not one of the absorb plan's thirty pull requests; it is listed here with the absorb cards' proposals because it was drafted with them. The design is `docs/design/tui.md`.
    - Open for the lead: accept ADR 0044 (pi-tui at the pi pin, only under `packages/cli/src/tui/`), or (b) Ink 8.0.0 with React 19.3.1, or (c) no TUI until after the thesis. Until then the design proceeds on (a), as decided below.
    - Decided on 2026-11-22 under the lead's delegation, six calls the design raised; binding until the lead overturns one:

| call | answer | reason |
|---|---|---|
| 1. library | pi-tui 1.3.0 at the pi pin, imported only under `packages/cli/src/tui/`, AGENTS.md's "What not to do" line amended; ADR 0044 stayed proposed until the lead accepted it on 2026-11-25 | no new package in the lockfile, the pi family's own library, an injectable terminal for headless tests, Windows input handled; the spike passed under ConPTY and Git Bash |
| 2. entry | bare `engram` keeps its help on stderr and exit 2; the TUI opens only with `engram tui`; HELP's first line names `engram tui` | one word doing two things by TTY detection misleads in tmux, SSH and mintty; the first line makes the TUI findable |
| 3. new commands | `check`, `events`, `policy`, `grants` in E8.15a; `scopes` and `read --item <id>` in E8.15a once E8.14 merges | every TUI screen needs a plain command to teach; without them the timeline, grants, policy view and write preview are lost |
| 4. shared view logic | not an `@engram/ui/view` export: `view.ts` and `provenance.ts` move into a new React-free package, `@engram/view`, which the inspector and the TUI import | the CLI never depends on React, xyflow, dagre or tanstack, and the leak rule exists once |
| 5. mouse | on by default, `--no-mouse` to turn it off; the help overlay says Shift+drag selects text | clicks and the wheel help most people; the waiver keeps terminal selection and accessibility tools for those who need them |
| 6. commands on quit | a short list of the session's commands on every quit; `--quiet` turns it off | it teaches the CLI, which is the point of the TUI |

63. **ADR 0046, the replay validation record's source (card D3).** Answered 2026-11-25 by the lead: (a). ADR 0026 left open where a procedural candidate's validation record comes from; ADR 0046 fills it. The lead answered two of its questions on 2026-11-22 (review findings D3-1 and D3-2), and ADR 0046 now carries both:
    - D3-1, the pass rule: "5 tasks, no worse". "4 of 5 runs" means n = 5 held-out tasks, drawn by the config's seed from the split. A task passes when the candidate's mean reward over the 3 seeds reaches the threshold and is not below the mean reward without it on that task. Admit at 4 of 5. The plane computes all of it from the outcomes, and refuses a replay of any other number of held-out tasks.
    - D3-2, the threshold: "Fixed at 2/3". A task's mean reward must be at least 2/3, which for 0 or 1 rewards is success on at least 2 of 3 seeds. The value is fixed in core as the registered one, and the plane refuses a replay naming any other.
    - D3-13, the seeds (the lead's reading of "3 seeds", 2026-11-22): the seed set is exactly 1, 2 and 3, fixed in core (`REPLAY_SEEDS`). A replay on any other set (one seed, or seeds the caller picked) is refused as an invalid call before the log is touched, like the threshold.

    What is left is accepting the ADR's text:
    - (a) Accept ADR 0046 as written. A user-sourced actor presents the held-out outcomes, and the plane counts k of n itself. The replay is bound to the item's id, content hash and distill ref, through an injected session index. A mismatch is a deny event, the replay's sha256 is in every reason, and no surface exposes `replay` before verified actors (ADR 0042).
    - (b) Accept it, and record each replay in the log in a schema card, so the oracle and the dogfood report can judge a replay admission from the log alone.
    - (c) Keep procedural candidates unpromotable through the plane until a replay can be measured, not presented: admission waits for H5's runner (card X11) to call the plane itself.
64. **ADR 0045, the AWM induction prompt adapted to tool use (card D2).** Answered 2026-11-25 by the lead: (a). ADR 0012 says the prompt is vendored verbatim; card D2 asks for it adapted from web tasks to tool-use sessions (review finding D2-1). The lead answered on 2026-11-22: adapt, and record it in a new ADR ("Adapt, new ADR"). What is left is accepting the ADR's text, which lists every change.
    - (a) Accept ADR 0045: the adapted prompt pinned in `packages/core/src/distill/induce.ts`, the eighteen changes it lists, and ADR 0012's verbatim clause superseded.
    - (b) Accept it with changes to the list.
    - (c) Reject it and vendor the WebArena prompt verbatim, as ADR 0012 says.

65. **ADR 0047, the by-id read and the scope list (card E8.14).** Answered 2026-11-25 by the lead: (a). What a read of one id and a list of visible scopes may reveal, and how a framework adapter writes.
    - (a) Accept ADR 0047: a by-id read drops a candidate reached only through a grant that does not admit it, so such an id, one out of reach and one never held answer alike; a scope list holds the readable member scopes and the scopes of items a live grant admits; both are read events, a by-id read marked by a reason clause; `POST /read/{itemId}` and `POST /scopes` join the route table; the kit forces source `model`.
    - (b) Accept it, but answer a by-id read as a text read does (`filtered: 1` for a grant that does not admit), keeping one rule for every read at the cost of confirming the id exists.
    - (c) Drop the scope list and keep only the by-id read, so no listing reveals a grant-reached scope.

66. **ADR 0048, the contradiction lint's local NLI tier (card L7, arm P3).** Answered 2026-11-25 by the lead: (a); this closes the item. The tier scores each contradiction pair locally, flags at or above an upper threshold, drops below a lower one and sends the band to the model. On card L4's fixture (`research/results/h3-lint-nli.json`) the scores do not separate contradictions from unrelated pairs: 87 of 113 pairs score 0.9 or more by the larger of both directions, 81 forward only. With the frozen thresholds (upper 1, lower 0.1) the tier flags nothing, drops 18 pairs and sends 95, and no contradiction fault is dropped.
    - (a) Accept ADR 0048 as written: both directions, the threshold rule on card L3's fixtures, so on this fixture the flag band is empty and the tier only drops.
    - (b) Accept it with forward-only scoring. Its cost on the fixture: an upper of 0.9 flags 81 pairs on 28 items with no model call, of which 4 items are contradiction faults, 4 are contradiction near-misses, 14 carry other labels and 6 carry none (`forward_only_flags`), so most findings would be false and the model would never see them.
    - (c) Drop the flag band, so the tier only drops pairs below its lower threshold and every other pair goes to the model; the upper threshold and the `contradiction-nli` finding go.

## Decided on 2026-11-21, under the lead's delegation

On 2026-11-21 the lead delegated items 49 to 56 as well: close them with the best answer the project's record supports. Every item takes option (a). These answers are binding until the lead overturns one. ADRs [0038](../decisions/0038-tamper-evident-log-that-keeps-erasure.md), [0039](../decisions/0039-content-guards-at-the-write-gate.md), [0040](../decisions/0040-trust-floors.md) and [0041](../decisions/0041-cedar-export-for-analysis.md) are accepted with them.

| item | answer | reason |
|---|---|---|
| 49 | (a) accept ADR 0038: a side-table chain over each whole event with the erasable parts as salted commitments, a manifest per offboarding, signed checkpoints | It is the only option that keeps both tamper evidence and erasure. It changes no event body, so no committed result moves. Option (b) leaves the digest of a short erased value guessable, and (c) leaves every guarantee resting on an editable table. Built in W14, after Gate C. |
| 50 | (a) accept ADR 0039 in full, the injection screen included | The guards are deterministic, so rule 4 holds, and off in every registered preset, so no registered number moves. The screen is reported as a floor with its escape and false-hold rates, and card X14 measures it against controls. Dropping the screen (b) would leave the poisoning arm with no deterministic floor. |
| 51 | (a) accept ADR 0040: tests first, then both floors opt-in, off in the H1 to H4 presets, on in a new preset, with an eighth invariant | Option (b) would amend registered conditions nine days before the tag for a gap that is not yet confirmed. Option (c) leaves a hole in the provenance model the thesis rests on. It matches cards RV4 and RV7: narrow, never widen. |
| 52 | (a) accept ADR 0041: export to Cedar and a differential test; the evaluator stays the authority | It gives the evaluator its first independent check for one development dependency and no runtime change. It is on the product lane and is among the first cards cut, so it cannot delay Gate D. |
| 53 | (a) answer only for an actor who may read the item or owns the scope; grant holders named to the owner only | The least disclosure that still answers the owner's question, and the same rule as item 36 (a non-owner sees only the grants that name them). |
| 54 | (a) tokens from an external issuer verified with jose, hashed API keys for the local server, an ADR on subject mapping before any code, no bundled identity provider | An identity provider is a product of its own and a large dependency. The card runs in W17, after Gate D, and leaves stdio and the registered harness fixtures alone, so H4's surface does not move. |
| 55 | (a) a dedicated import actor, kind `import`, every row a candidate, grants dropped | A bundle that states its own trust could launder content: card RV4 already holds adoption to never raising trust and never widening grants, and import follows it. A ChatGPT parser waits for a real export seen to contain memories. |
| 56 | (a) one documents-only pull request of proposals; each arm registered separately by amendment before its run | One review of the whole set shows overlaps between arms. Registration stays one arm at a time, so nothing is registered by accident. |
| B7, C1 on MERIT and tau2-bench | ADR 0031's amendment of 2026-11-21: C1 on MERIT is MERIT's FullReplay (the whole arc's history in context, no memory system); on tau2-bench tau2's own `LLMAgent` with no memory, card B11's choice | It applies ADR 0031's decision 3, C1 as the benchmark's long-context reading with no memory system, and changes no registered GateMem or MEM-INV-Bench condition. MERIT's `C0` was the alternative; it is MERIT's floor, not "long context only" (`docs/log/2026-11-21-b7-decision-c1-adr-0031.md`) |
| E2.8, the schema version | an additive, optional field of the never-persisted policy document does not bump schema_version (ADR 0002, D2) | The bump would move 46 committed cassette keys (C3 and C4 embed the parsed policy, `schema_version` included, in their prompts) and H3's pinned fault-set hashes, nine days before the tag (`docs/log/2026-11-21-e2-8-version-bump-moves-cassette-keys.md`) |

**What stays with the lead.** Two things this delegation does not cover, because they change the pre-registration: registering any proposed arm (item 56 only writes the proposals), and what to do if card E2.7 confirms a trust gap that can move a registered H1 to H4 number. The second comes back as a finding before the `prereg-v1` tag.

### The lead's own answers, 2026-11-21

Three questions the answers card's review raised (findings ANS-2 and ANS-6 of its review, and the spend against the credit) went to the lead, who answered them directly the same day. They are the lead's answers, not answers under the delegation.

| item | answer | reason |
|---|---|---|
| 57, M2's reasoning (ANS-2) | the lead's answer: keep GLM 5.3 Flash and amend v1's Models rule: a model that cannot switch reasoning off runs at its provider's default effort, on a pinned endpoint; its reasoning tokens are metered, and the report states this; M2 is named as such a model; M1 and M3 run with reasoning off. Added under the delegation: its cost is estimated with the reasoning allowance; the comparison across models (H4, and H2's subsets) is therefore across configurations, each stated; and, since the ledger counts reasoning tokens inside output tokens, "metered" means counted and priced there until `reasoning_tokens` is recorded | pi-ai 1.3.0 maps GLM 5.3 Flash's reasoning off to nothing (`docs/log/2026-11-21-answers-finding-m2-reasoning-off.md`), and the lead keeps the choice of three makers |
| 58, H3's fallback (ANS-6) | if card L3's pilot shows a standard deviation across seeds above 0.05 on precision or recall for a lint, the deterministic tier becomes H3's primary test and the model tier is reported as secondary; the rule is fixed before any pilot data | item 23 made the model tier primary and item 43 set the bound, but nothing said what a pilot above the bound does to the primary test |
| 59, the spend cap | the lead's answer: keep the per-run ceilings at 1.25 times each run's high estimate, and add a programme-wide cap equal to the API credit held; a run that would cross that cap pauses, and the lead decides whether to resume. Added under the delegation: the ceilings are in ledger dollars (pi-ai's catalogue prices); the cap is in billed dollars, the ledger converted by each model's list-to-catalogue ratio, and a model with no recorded ratio refuses to run under it; the runner card for it before 1 December (a real-spend total across runs, checked before each session, the cap read from a config or the environment); and until it lands, the operator's check of OpenRouter's credit balance at least every two hours, stopping every shard below one session's cost per running shard plus 10 percent | the per-run ceilings sum to more than the credit the lead requests (`docs/log/2026-11-21-rv8-review-finding-credit-request-reasoning-off.md`) |

## The lead's answers, 2026-11-25

On 2026-11-25 the lead wrote "accept the adrs". That sentence is the lead's own answer, not an answer under the delegation; the rows below read it as option (a) of each item. They cover every ADR still proposed: 0034 and 0042 to 0048. Each takes option (a) of its item. Items 34 and 35 had been answered (a) under the delegation on 2026-11-20; the lead's acceptance confirms them. Card ANS-2026-11-25 (`docs/tasks/ANS-2026-11-25.md`) carries them into the ADRs.

| item | answer | reason |
|---|---|---|
| 34 | (a) accept ADR 0034, with a 1-year cap on a grant's expiry, and refuse an expired or other-class grant on a first write | the lead accepted the ADR, with decisions 3 and 6 amended to the 2026-11-20 answers; decision 3 fixes the year as 365 days from the write's event time, refused under `engram/write/grant-expiry-cap` (`docs/log/2026-11-25-ans-2026-11-25-decision-adr-0034-expiry-cap.md`). The lead's acceptance lifts the condition that the ADR stay proposed until the rule is built. The rule is not built yet: card E2.21 builds it and fixes the fixtures that write such grants (`docs/tasks/backlog.md`, "ADR 0034's cap and first-write rule"; `docs/log/2026-11-25-ans-2026-11-25-finding-adr-0034-cap-not-built.md`) |
| 35 | (a) "Amend the ADR: a promotion keeps the grant, which then admits nothing.", with RV7's amendment (a non-owner's promotion carries none), accepted with the ADR | the lead accepted the ADR, with decisions 3 and 6 amended to the 2026-11-20 answers; decision 6 carries item 35, and the rule is built (`packages/core/src/policy/promotion.ts`, card RV7) |
| 60 | (a) accept ADR 0042 | the lead accepted the ADR as written |
| 61 | (a) accept ADR 0043 | the lead accepted the ADR as written |
| 62 | (a) accept ADR 0044, pi-tui at the pi pin, only under `packages/cli/src/tui/` | the lead accepted the ADR as written; the six calls of item 62's table were decided under the delegation and stand, since the lead has not overturned them |
| 63 | (a) accept ADR 0046 | the lead accepted the ADR as written |
| 64 | (a) accept ADR 0045 | the lead accepted the ADR as written |
| 65 | (a) accept ADR 0047 | the lead accepted the ADR as written |
| 66 | (a) accept ADR 0048 as written: both directions; on card L4's fixture the flag band is empty and the tier only drops | the lead accepted the ADR as written; two sentences that had left item 66 open now record the answer; this closes item 66 |

### The lead's answers to the second absorb plan's questions, 2026-11-25

The lead also answered directly four of the five questions of `docs/tasks/absorb-plan-2.md`, section 8 (merged as #112). These are the lead's own answers, not answers under the delegation. Question 2 (quote-grounding for H3, card L9) stays open, as the plan recommends: it is decided from L9's fixture result.

| question | answer | reason |
|---|---|---|
| Q1, the spend cap (item 59, pre-tag condition 7) | the operator's fallback caps H1: OpenRouter's credit balance read at least every two hours, and the shards stopped below the margin; the runner card that enforces the cap follows in W10, before any later live run | the plan's recommendation: no card enforcing the cap can be written, reviewed and merged before the tag on 30 November (`docs/log/2026-11-25-ans-2026-11-25-decision-spend-cap-fallback.md`) |
| Q3, the arms U6 and U7 (cards X18 and X19) | U7 is registered as a descriptive arm, by amendment, once X19's check merges; U6 stays an engineering check unless H3's primary test is undecided | the plan's recommendation: U7 is the only measured evidence for Twin's offboarding claim (`docs/log/2026-11-25-ans-2026-11-25-decision-u6-u7.md`) |
| Q4, H5's prerequisites (item 30) | the orchestrator drafts them as a proposed amendment pull request; nothing is registered until the lead approves the text | item 9 fixes them before H1's data exist, and a registration is the lead's (`docs/log/2026-11-25-ans-2026-11-25-decision-h5-prerequisites.md`) |
| Q5, ADR 0034's cap after H1 (card E2.21) | `grants.expiry_cap` stays opt-in until the thesis runs are done: on in the twin and knowledge profiles only, never in a registered preset; H2 to H4 run under H1's policy | the plan's recommendation: as a default the cap would refuse 1,633 of 2,490 GateMem fixture writes, and H2 to H4's GateMem cells would run under a policy other than H1's (`docs/log/2026-11-25-ans-2026-11-25-decision-grant-cap-opt-in.md`) |

**The other open items, resolved the same day.** The lead also asked for the remaining open items to be resolved on 2026-11-25. Each is resolved by its own card, not by this one:

- item 36 (a non-owner sees only the grants naming them, in core), and the read route naming lineage ids its reader cannot read: card RD1;
- `Plane.lint`'s reach (`docs/log/2026-11-22-l6-finding-lint-reads-scope.md`): card L8;
- an owner's acceptance of their own candidates in their own person scope (`docs/log/2026-11-22-e9-8-finding-owner-acceptance-after-tag.md`): card E9.9, with a new ADR 0049.

## The lead's answers, 2026-11-26

The verification of the gate-work cards' fix pass (finding N3) found two changes to registered text made under the delegation, which the standing rule promotes to the lead: pre-tag condition 3's stopping set (card X20) and the Models section's endpoint rule (card R6). The lead answered both directly on 2026-11-26, not under the delegation (`docs/log/2026-11-26-gwfix-decision-lead-answers.md`). Each card rewrites its sentence in its own pull request.

| question | answer | reason |
|---|---|---|
| A, condition 3's stopping set (card X20, item 14) | "Amend: 404 + backstop". A 401, 402, 403 or 404 stops the run and is never a per-session exclusion, except that a 403 OpenRouter marks as a moderation flag is an exclusion for that session; and the run stops when five distinct items in a row each end in a refused answer call | a pinned endpoint that is gone answers every call with a 404, which would otherwise exclude a whole run; a moderation 403 refuses one prompt; the backstop counts items, since one item runs as consecutive sessions and an over-long item is refused in all of them |
| B, the Models rule's endpoint choice (card R6) | "Seed first". The maker's own endpoint is used only if it honours `seed`, otherwise the cheapest endpoint that does | rule 6: every sampled call takes a seed, so an endpoint that drops it cannot serve a registered run |

## The lead's answers, 2026-11-27

The independent review of card R6 (finding 1) found that M1's pinned endpoint, Wafer's `wafer/us`, serves an mxfp4 build of the model, a 4-bit quantisation as OpenRouter lists it, and that the registered text did not say so. Since the property is the registered model's, the question went to the lead before the tag. The lead answered directly on 2026-11-27 (`docs/log/2026-11-27-r6-decision-lead-keeps-mxfp4.md`).

| question | answer | reason |
|---|---|---|
| M1's endpoint under the seed-first rule (card R6, review finding 1) | Keep `wafer/us` (mxfp4, about 92 dollars at H1's token mix), as the seed-first rule picks it, and disclose it: the pre-registration's Models sentence names the mxfp4 quantisation, and the thesis reports results as served by the 4-bit build. No pin change | the rule as registered picks it; the next seeded endpoint not quantised to 4 bits costs several times more; disclosure lets a reader or a replication know which build served the results |

## The lead's answers, 2026-11-28

The lead asked on 2026-11-28 for the thirty cards of the second absorb plan (`docs/tasks/absorb-plan-2.md`) to be built and merged, with the terminal interface wired to them, proof-of-concept results added to the results register, and the system tuned before the benchmark runs. The plan scheduled 25 of the 30 after H1's `MERGE=4`, so the timing went to the lead (`docs/log/2026-11-28-ap2run-decision-lead-merge-before-tag.md`).

| question | answer | reason |
|---|---|---|
| When the second absorb plan's thirty cards merge | All thirty merge to main before the `prereg-v1` tag, each proven by `make test-repro` to move no registered result; E2.21's part 2, on which E2.15 depends, comes forward with them. H1 then runs on the code as tagged | the lead's choice over building them on an integration branch until `MERGE=4`; the freeze between the tag and `MERGE=4` is unchanged |
| Tuning before the benchmarks | Allowed for the plane's speed and overhead, for opt-in features, and on data outside H1 to H5's registered evaluation sets; a change to a registered preset or condition is proposed to the lead as an amendment before the tag, never made on evaluation items | tuning registered behaviour on the evaluation items would make the confirmatory tests exploratory (the orchestrating session's rule under the delegation, stated to the lead on 2026-11-28) |
| New ADRs | The cards may add ADRs as needed; none may contradict another or an accepted ADR, and every new ADR is checked against the set before it merges | the lead's instruction of 2026-11-28 |
