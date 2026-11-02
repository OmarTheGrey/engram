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
