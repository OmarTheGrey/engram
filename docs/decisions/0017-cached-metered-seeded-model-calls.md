# ADR 0017: Every model call is cached, metered and seeded; cassettes are the cache

Status: accepted with amendments, 2026-11-02
Deciders: Omar (lead)
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

MERIT's full metering; the roadmap's compute ceiling; the testing convention's rule that no test reads the network.

## Decision

Cache key `(benchmark item, condition, preset, store, model, seed, prompt hash)`; value includes usage and cost from pi-ai; `ENGRAM_OFFLINE=1` refuses a miss. The cache directory is the cassette fixture set. Usage is written to a cost ledger in the event log so the frontier chart is derived, not computed by hand.

Amendments made when deciding:

- Implemented in S0.10: `ModelCall` is a type in core; the runner provides scripted, cached and pi-ai backed implementations; the cache key is (item, condition, preset, store, model, seed, prompt hash); `ENGRAM_OFFLINE=1` turns a miss into an error.

Amendments made in the review fix pass, 2026-10-25 (PR #7, findings R7-1 to R7-15):

- Finding R7-6: the session cassette's request keeps every message, system messages included, in its place; doubles braces before replacing the session's working directory with `{cwd}`, and replaces it only where it stands as a whole path; and adds the answer-changing stream options (reasoning, toolChoice, samplingParams, thinkingBudgets) besides temperature and maxTokens. Different transcripts no longer share a key.
- Finding R7-7: a live model on a miss receives the config's seed and the agent loop's sampling options. pi-ai has no seed option; the seed goes in `samplingParams`, which only its `openai-completions` API sends, so a live model on any other API is refused rather than called unseeded (AGENTS.md rule 6).
- Finding R7-10 and the cost ledger: the runner meters into a UsageRecord list written to `usage.json` beside the results, not into the event log as this ADR's decision says; results.jsonl and summary.json carry no call counts, so a recording run and a replay write them byte for byte the same. Writing the ledger into the event log is left to the card that needs it in the frontier chart.
- Finding R7-11: `make run` only replays; a miss is an error whatever ENGRAM_OFFLINE says. Scripted cassettes are recorded only by `make fixtures`, which deletes a config's cassette directory and records it again from the scripted model (`--record`), so stale cassettes do not linger.

Amendments made in card B3 (Gate B plan, PR 5, decision 1), 2026-10-29:

- `make run` gains one recording path besides `make fixtures`: `MODEL=<provider/model-id> LIVE=1` (`run.ts --live`, `packages/runner/src/live.ts`) runs a config on a named model through pi-ai's built-in providers and records its misses into a new cassette directory, by default `.engram/runs/<config>-live/<provider>/<model>/cassettes`, which git ignores; a live rerun replays what is recorded with zero calls. It refuses under `ENGRAM_OFFLINE=1`, refuses a scripted model (whose cassettes only `make fixtures` records), and refuses a cassette directory inside, equal to or containing `fixtures/` or the config's committed cassettes, and any directory inside the repository that is not under `.engram/` (review R5-4), so a live run never writes a committed cassette or a committed folder such as `research/results/`. `liveOptions` refuses `ENGRAM_OFFLINE=1` a second time (review R5-3). `MODEL=<provider/model-id> REPLAY=1` (`run.ts --replay`) replays that directory with every miss an error and is allowed under `ENGRAM_OFFLINE=1`; it refuses a directory with nothing recorded (review R5-5). The R7-7 rule stands: a live model on an API that takes no seed is refused. It is Gate B exception (c), the lead's step once the pre-registration names the primary model; no live call has been made. Tested with pi-ai's faux provider on the seeded API (`packages/runner/test/live.test.ts`).
- A runner config may name several stores (`"store": ["fake", "mem0"]`); the store is already part of the cache key, so each store's sessions have their own cassettes.

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks X1, every experiment. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)

Amendment of 2026-11-21, recording answers given on 2026-11-20 under the lead's delegation (`docs/tasks/lead-decisions.md`), carried by the answers card; the lead may overturn any:

- Item 13: LongMemEval's judge is the paper's model through OpenRouter's seeded chat completions, `openrouter/openai/gpt-4o-2024-08-06`; this ADR holds without an exception.
- The review cards' table, row RV6: each model and judge is pinned to its maker's own OpenRouter endpoint where OpenRouter lists one, otherwise to the cheapest endpoint that honours `seed`, with `allow_fallbacks: false` (`openrouter_provider`). The endpoints are named in each config before its first live run; the upstream that served each call is recorded either way.
- Items 27 and 29: ADR 0036 (cassettes deposited on Zenodo and fetched by sha256; a local cassette proxy for the outside harnesses) extends this ADR.

Amendment of 2026-11-21, the answers card's review and verification fix passes (`docs/tasks/lead-decisions.md`, item 59):

- The lead's own answer: the per-run ceilings stay at 1.25 times each run's high estimate, and a programme-wide cap equals the API credit held; a run that would cross the cap pauses, and the lead decides whether to resume.
- Added under the lead's delegation: the metered cost is pi-ai 1.3.0's (each call's `cost_usd` is `calculateCost` over the model's catalogue price, half OpenRouter's list price for M1), so the ceilings are set in these ledger dollars, and the pre-registration's Models section gives each model's list-to-catalogue ratio. The cap is in billed dollars: a card before 1 December has the runner convert each paid call's ledger cost by its model's recorded ratio, input and output apart, and a model with no recorded ratio refuses to run under the cap. Until it lands, the operator reads OpenRouter's credit balance at least every two hours while any shard runs and stops every shard when the credit left falls below one session's cost per running shard plus 10 percent. An HTTP 401, 402 or 403 from the provider stops a run. A card that records the cost OpenRouter reports for each call would make the ledger bound real spend directly (backlog).
