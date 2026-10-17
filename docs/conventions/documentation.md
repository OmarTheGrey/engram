# Convention: documenting every step for the thesis

The thesis is written from the repository, not from memory. Every step of the project leaves a typed, dated, machine-readable record at the moment it happens, and a script assembles those records into chapter drafts at the end. If it is not in the log, it did not happen; if it is in the log, it costs nothing to put in the thesis.

## The log

`docs/log/` holds one Markdown file per entry, named `YYYY-MM-DD-<slug>.md`. One entry per unit of work: a card finished, a decision taken, a measurement made, a thing that failed, a change of direction. Several entries per day are normal. An entry is written in the PR that does the work, never afterwards.

Every entry starts with frontmatter. The fields are fixed; CI rejects an entry with a missing or unknown field.

```yaml
---
date: 2026-11-04
author: omar
type: decision | finding | failure | measurement | change | milestone
card: E2.3            # or none
chapter: design | implementation | evaluation | results | discussion | limitations | related-work
pillar: govern | twin | distill | plane | research
hypothesis: H1        # or none
evidence:             # paths or commands; at least one for finding, failure, measurement
  - research/results/x2-frontier-2026-11-04.json
  - "make bench BENCH=gatemem"
supersedes: none      # path of an earlier entry this one replaces
---
```

Then the body, in this order, 150 words at most:

1. **What.** One sentence stating the step.
2. **Why.** The reason, or the question it answers.
3. **Result.** What came out, with numbers and their source. A number without a path or command is deleted in review.
4. **Consequence.** What changes next because of it. May be "nothing".

Entry types and what they are for:

| type | when | feeds |
|---|---|---|
| decision | a choice another person could have made differently; pair with an ADR when it affects architecture | design, discussion |
| finding | something learned about a store, a benchmark, a model, a paper, that was not known before | related-work, discussion, limitations |
| failure | anything tried that did not work, including dead ends, with the reason | implementation, limitations |
| measurement | a number produced by a script from a config | results |
| change | a schema, policy, interface or pin change, with the before and after | implementation |
| milestone | a gate, a demo, a dogfood start, a supervisor meeting | evaluation |

## Rules

1. Every PR adds at least one log entry. CI checks that `docs/log/` has a new or changed file in the diff. A PR that only fixes a typo gets a `change` entry of one line.
2. Failures are logged with the same care as successes. The limitations chapter is written from `type: failure`, and a thesis with no limitations is not believed.
3. Numbers are never typed. A measurement entry links the results file that `research/scripts/` produced and the config that produced it. The consolidation script checks that the file exists and that its hash matches the one recorded in `research/results/MANIFEST.md`.
4. Decisions that change architecture get an ADR in `docs/decisions/NNNN-<slug>.md` (context, decision, alternatives, consequences) and a `decision` entry that links it. Small decisions get only the entry.
5. Entries are immutable. To correct one, write a new entry with `supersedes:` pointing at the old one. The old one stays.
6. Friday demos produce a `milestone` entry with the recorded session or results table linked. No demo entry, no merge that week.
7. Dogfood observations are logged as aggregates only (counts, rates). No content from anyone's memory, ever.
8. Write for the reader who was not there: full names of cards, stores, benchmarks, conditions. No "the thing from Tuesday".
9. The entry is written by the person who did the work, in the same PR, before review. A reviewer who cannot reconstruct what happened from the entry sends it back.
10. Agents working a card write the entry as part of the card. The card prompt template includes it. The human reviewing the PR edits it, does not delete it.

## Consolidation

`research/scripts/consolidate_log.py` reads every entry, validates frontmatter and evidence paths, and writes `research/thesis/drafts/<chapter>.md` with entries grouped by chapter, then by pillar, then by date, each as a paragraph with its evidence as footnotes. It also writes:

- `drafts/timeline.md`: every milestone and decision in date order.
- `drafts/limitations.md`: every failure, with the consequence line.
- `drafts/results-index.md`: every measurement, with the results file, config, hypothesis and the figure it belongs to.
- `drafts/decisions.md`: every ADR with its status.

Run it weekly (`make thesis`) so the drafts are always current and the final consolidation is an edit, not a reconstruction. The script is itself under test: a fixture log of ten entries must produce byte-identical drafts.

## Thesis map

Chapters and what feeds them, so entries are tagged consistently:

| chapter | from |
|---|---|
| related-work | finding entries about papers, stores, benchmarks; `docs/readings/` notes |
| design | decision entries, ADRs, `docs/architecture.md`, `docs/glossary.md` |
| implementation | change entries, card completions, failures that shaped the code |
| evaluation | milestone entries, `docs/research/preregistration.md`, benchmark pins, conditions |
| results | measurement entries only |
| discussion | decision and finding entries tagged with a hypothesis |
| limitations | failure entries, and findings about what the design cannot do |

## What else is recorded, and where

- Architecture: `docs/architecture.md`, kept current by the PR that changes the thing it describes.
- Decisions: `docs/decisions/`.
- Task cards: `docs/tasks/`, with the acceptance command; a finished card's PR number is written back into the card.
- Reading notes: `docs/readings/<id>.md`.
- Dependencies: `docs/deps.md`, one line each with reason and licence.
- Benchmark pins: `packages/bench/PINS.md`, with the date and the reason for every change.
- Pre-registration: `docs/research/preregistration.md`, versioned; every version dated and kept.
- Results: `research/results/` with `MANIFEST.md` listing file, config, script, commit, hash.
- Meetings with the supervisor: a `milestone` entry with what was shown and what was asked.
