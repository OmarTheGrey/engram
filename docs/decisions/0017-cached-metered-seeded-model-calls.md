# ADR 0017: Every model call is cached, metered and seeded; cassettes are the cache

Status: accepted with amendments, pending lead review, 2026-10-22
Deciders: drafted by the coding agent in step-0 task S0.13; pending review and acceptance by Omar (lead). Until then this records a recommendation the code already follows.
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

MERIT's full metering; the roadmap's compute ceiling; the testing convention's rule that no test reads the network.

## Decision

Cache key `(benchmark item, condition, preset, store, model, seed, prompt hash)`; value includes usage and cost from pi-ai; `ENGRAM_OFFLINE=1` refuses a miss. The cache directory is the cassette fixture set. Usage is written to a cost ledger in the event log so the frontier chart is derived, not computed by hand.

Amendments made when deciding:

- Implemented in S0.10: `ModelCall` is a type in core; the runner provides scripted, cached and pi-ai backed implementations; the cache key is (item, condition, preset, store, model, seed, prompt hash); `ENGRAM_OFFLINE=1` turns a miss into an error.

Amendments made in the review fix pass, 2026-10-25 (PR #7, findings R7-1 to R7-15; pending the lead's review like the rest of this ADR):

- Finding R7-6: the session cassette's request keeps every message, system messages included, in its place; doubles braces before replacing the session's working directory with `{cwd}`, and replaces it only where it stands as a whole path; and adds the answer-changing stream options (reasoning, toolChoice, samplingParams, thinkingBudgets) besides temperature and maxTokens. Different transcripts no longer share a key.
- Finding R7-7: a live model on a miss receives the config's seed and the agent loop's sampling options. pi-ai has no seed option; the seed goes in `samplingParams`, which only its `openai-completions` API sends, so a live model on any other API is refused rather than called unseeded (AGENTS.md rule 6).
- Finding R7-10 and the cost ledger: the runner meters into a UsageRecord list written to `usage.json` beside the results, not into the event log as this ADR's decision says; results.jsonl and summary.json carry no call counts, so a recording run and a replay write them byte for byte the same. Writing the ledger into the event log is left to the card that needs it in the frontier chart.
- Finding R7-11: `make run` only replays; a miss is an error whatever ENGRAM_OFFLINE says. Scripted cassettes are recorded only by `make fixtures`, which deletes a config's cassette directory and records it again from the scripted model (`--record`), so stale cassettes do not linger.

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks X1, every experiment. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
