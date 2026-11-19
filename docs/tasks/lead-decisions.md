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
