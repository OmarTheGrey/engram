# H5P H5's prerequisites, drafted as a proposed amendment for the lead

Status: drafted on branch h5-prerequisites, awaiting the lead's review; nothing registered. Paths: docs/research/preregistration.md (section "Proposed amendments, not yet registered", subsection "H5's prerequisites, drafted for the lead"), docs/tasks/H5P.md, docs/roadmap.md (the gate work cards' table and week plan), docs/log/2026-11-27-h5p-*.

From `docs/tasks/lead-decisions.md`, item 30 (option (a): "I draft the prerequisites for you to approve") and the lead's answer to question 4 of the second absorb plan on 2026-11-25 (`docs/tasks/lead-decisions.md`, "The lead's answers to the second absorb plan's questions, 2026-11-25", row Q4: "the orchestrator drafts them as a proposed amendment pull request; nothing is registered until the lead approves the text"; `docs/log/2026-11-25-ans-2026-11-25-decision-h5-prerequisites.md`). Lane: research. Week: W8, merged by 30 November so the draft is in the tagged repository; the lead's approval may follow, and by item 9 falls before H1's data exist (1 December). Effort: S, documents only. Read AGENTS.md, the pre-registration's H5 and its section "Proposed amendments, not yet registered", ADRs 0012, 0045 and 0046, cards B11, D1, D2, D3 and X11 before starting.

Goal: Every value H5 needs to run, written once in the pre-registration's proposed section as a draft amendment the lead can approve, change or refuse, each value marked as read from a regenerable source or as proposed; and every proposed value listed here with a recommendation, so that the lead's answer is one line per item.

Why: H5's registered Stopping rule says its prerequisites (the tau2 task split, the user-simulator model, dropping the unregistered repository task set, and the harness card) are not fixed yet and that the orchestrating session drafts them (lead-decisions item 30). The cost table carries the same gap (`research/configs/cost-table.json`, row `h5-tau2`, status "no tau2 harness, no train and test split, no user-simulator model is fixed (RV-DES-5)").

What already exists (checked on main at `574b9c88`): tau2-bench pinned at `v1.0.1` (`packages/bench/PINS.md`); card B11's routing shim (`packages/bench/scripts/tau2_engram.py`); card D2's AWM induction (`packages/core/src/distill/induce.ts`, ADR 0045); card D3's replay gate (`packages/core/src/distill/validate.ts`, `packages/runner/src/replay-validate.ts`, ADR 0046); the cost table's H5 rows in `research/results/h2-cost-table.json`, priced on a design from before item 63.

Steps:

1. Draft the subsection "H5's prerequisites, drafted for the lead (lead-decisions item 30; card H5P)" inside "Proposed amendments, not yet registered", after "Scheduled by the absorb plan" and before "Not scheduled". No line of H5's registered fields, or of any other registered section, changes.
2. Write the proposed values' list below, with a recommendation each.
3. One `decision` log entry per proposed value, a `change` entry for the draft, and the cost arithmetic in its own entry.
4. Place the card in the roadmap's gate work cards.

The lead's choices (each recommended as drafted; the alternative is what a "no" leaves):

| # | Proposed value | Recommendation | If refused |
|---|---|---|---|
| 1 | Each domain's tau2 `train` list split once into an induction half and a validation half by a seeded shuffle, `draw_seed` 20261125: airline 15 and 15, retail 37 and 37 | accept: without the halves, D3's `heldOutTasks` leaves only the tasks the agent failed as the replay's pool | induction and replay share the whole train list, and the replay is drawn from failed tasks |
| 2 | Telecom, `banking_knowledge` and the repository task set dropped from H5 | accept: none is in H5's registered benchmark row, and card B11 showed tau2 runs unmodified | the repository set needs its own registration and harness |
| 3 | The induction half's trajectories come from C1 on M1 at seed 1; reward 1 is a success; the harness converts tau2 records into card D1's episode form | accept: C1 is the only arm that exists before any procedure | trajectories from another arm, or seeds 1 to 3 (three times the sessions) |
| 4 | One library per domain, induced once with the config's first seed, examples in task-id order, chunked by whole example when over M1's context | accept: as MEM-INV-Bench's note serves all three seeds (item 8) | a library per seed, which measures the induction's variance at three times the induction and replay cost |
| 5 | At most 20 procedures per domain, the first 20 in reply order; C2 and C5 start from the same capped library | accept: the shared read limit is 20, and H5's Test requires the same induction in both arms | an uncapped C2, whose prompt grows with the library |
| 6 | The replay's without-arm is the validation half's C1 sessions at seeds 1 to 3, run once and shared by every candidate | accept: a session without a candidate is a C1 session | 15 more sessions per candidate |
| 7 | The replay scores tau2's own reward, `tau2_reward`; the harness card changes `tau2Reward` in `packages/runner/src/replay-validate.ts`, which reads the database check alone | accept: the replay and H5's metric then read the same number (`docs/log/2026-11-22-d3-finding-tau2-reward-db-only.md`) | a task with no database part always fails the replay |
| 8 | No H5 session offers `memory_write` or `memory_read`; procedures installed by card D3's `procedureBlock`, at most 20, item-id order; C2 lists the store directly, C5 reads through `Plane.read` under preset medium on store files | accept: H5 measures procedural memory alone | episodic memory in C2 and C5 that C1 lacks |
| 9 | Drift and the safety scan off in every H5 config; card D5's scan run once after the run, model-free, descriptive | accept: H5 registers admission, not retirement | cards D4 and D5 enter H5's design, and the run needs their configs |
| 10 | Primary outcome: mean over the 60 evaluation tasks of the seed-averaged tau2 reward; "policy violations" reported as none under that name, the scan count in their place | accept: tau2 at the pin labels no violation | a violation label defined before the run, which tau2 does not give |
| 11 | The two domains pooled in the primary test (60 tasks), each domain's contrast reported beside it, unadjusted | accept: 20 airline tasks alone give little power | two tests, which would add to the Holm family |
| 12 | A run that reaches its ceiling or the programme-wide cap pauses with its sessions kept, and the lead decides on `RESUME=1` | accept: as H1 | a completed subset, the contrast on whichever tasks ran first |
| 13 | A seeded power simulation with the analysis code's own bootstrap before registration, as `research/results/h4-power.json` for H4; the size stays 60 whatever it shows | accept: a fixed-size benchmark still owes its power | H5 runs with no power figure, a stated limit |
| 14 | User simulator `openrouter/openai/gpt-4.1`, temperature 0, seeded, pinned to an OpenRouter upstream; retail's judge routed to the same alias | accept: tau2's paper's simulator; pi-ai 1.3.0 lists no dated gpt-4.1 | another simulator, which moves the comparison with tau2's published numbers |
| 15 | The counts of the cost bounds: 208 training sessions, 2 to 104 induction calls, 240 to 600 replay sessions, 540 evaluation sessions; 84.58 to 1,029.69 billed dollars at list prices, 56.93 to 721.40 ledger dollars, a ceiling of 901.75 ledger dollars | accept as bounds; `COUNT=1` on the harness card's configs replaces them before any spend | nothing runs until the cost table counts H5's configs |
| 16 | If the induction yields no candidate in either domain, H5 does not run and enters Holm with p = 1; if the replay admits none, C5 is C1 and the report says so | accept: fixed before any data (item 8) | an outcome decided after the induction is seen |
| 17 | Card X11 rewritten, before H5's run, to build exactly the draft, with a fixture slice replayed from scripted cassettes as its acceptance | accept | X11 stays as the roadmap names it, with the repository tasks |

Files: docs/research/preregistration.md (the proposed subsection only), docs/tasks/H5P.md (new), docs/roadmap.md (the gate work cards' table and week plan), docs/log/

Depends on: none

Decision: none of the seventeen values is decided by this card; each is the lead's. The card decides only how the draft is laid out and that it sits in the proposed section.

Acceptance: `make lint-docs` and `uv run pytest research/tests/test_prereg.py`; and `git diff origin/main -- docs/research/preregistration.md` adds lines only inside the subsection "H5's prerequisites, drafted for the lead" and removes none.

Risks: The split counts and the two `split_tasks.json` hashes were read in card B11's tau2 checkout on 2026-11-25 and are not regenerated by a script; the harness card's config records them and its test checks them at the pin. The cost bounds scale the cost table's per-session shapes, which predate item 63 and any tau2 run; they stand until `COUNT=1` on H5's configs. The draft must be approved, changed or refused before 1 December (item 9); a later approval is an amendment after the tag, with its reason.

Must not move before the tag: any registered line of `docs/research/preregistration.md` (H5's fields included), the Versions table, any config under `research/configs/`, any MANIFEST row, any cassette or fixture. A registration of this draft is the lead's, by amendment, with a row in the Versions table.

Out of scope: registering any of it; card X11's rewrite and build (the harness, the configs `research/configs/h5-*.json`, the power script, `research/scripts/h5_table.py`); pinning H5's OpenRouter endpoints, which happens before its first live run; any change to the registered replay threshold, seeds or number of replay tasks.
