# Absorbing open-source work

How to take code, data or a design from an open-source project into this repository. The decision is ADR 0037; this is the procedure. Read it before any card whose "Absorbs" list has a line marked copy or port.

## The four modes

| mode | what you take | what you owe | where it is recorded |
|---|---|---|---|
| copy | the source's text, in whole or in part | its copyright notice kept; the licence's terms | `docs/absorbed.md`, `NOTICE`, a header comment in the file |
| port | the design, the rules or the data, rewritten as our own code | attribution | `docs/absorbed.md`, a header comment in the file |
| depend | a package or tool at an exact pinned version | the licence's terms for redistribution | `docs/deps.md` |
| idea | the approach only | a citation | the card, and the literature notes if the thesis relies on it |

If you are unsure between port and idea: when you had the source open while writing and your code follows its structure, it is a port.

## Which licences

- **Copy or port:** MIT, ISC, BSD-2-Clause, BSD-3-Clause, 0BSD, Apache-2.0, the Unlicense, CC0.
- **Depend only, unmodified:** MPL-2.0.
- **Idea only:** AGPL, GPL, LGPL, SSPL, BUSL, the Elastic licence, any non-commercial or no-derivatives licence, and any repository with no licence file. Do not keep such a source open while writing the code that replaces it.
- **Data:** the list above, or CC-BY-4.0, with attribution. Benchmark data follows `packages/bench/PINS.md` instead.

A licence named in a README, on npm or in a research note is a hint. The licence file at the commit you take from is the fact.

## Before you take anything

1. Open the source at a specific commit. Record the commit hash.
2. Read its licence file at that commit. Check the file you want carries no different header (some repositories mix licences by folder, and enterprise folders are common).
3. Confirm the repository is the origin. If the code was itself copied from elsewhere, go to that origin and start again.
4. Decide the mode and write it in the pull request's plan.

## Taking it

- **Take the part, not the product.** A table of patterns, one function, sixty lines of design. Remove the source's own names, telemetry, configuration and anything the card does not need.
- **Make it ours.** TypeScript in our style, our error types, our tests. Policy logic lands only in `packages/core` (rule 1), which calls no model and does no store I/O (rule 4). Anything that calls a model takes a seed and a cache key (rules 6 and 7).
- **A file that holds copied or ported code starts with a comment** naming the source repository, the commit, the licence and what was taken.
- **Tests arrive in the same pull request.** Where the source has tests for the part you took, port those too: they are the cheapest check that the port is faithful.
- **Regular expressions from elsewhere** get a timeout test against catastrophic backtracking before they are admitted.
- **Fixtures are synthetic.** No real secret, personal data or dogfood content, whatever the source's fixtures held (rule 12).

## Recording it

- **`docs/absorbed.md`:** one row per copy or port: source, commit, licence, mode, what was taken, where it landed, the card.
- **`NOTICE`:** for a copy, the notice the licence requires (for Apache-2.0, the source's own NOTICE content if it has one; for MIT and BSD, the copyright line and the licence name).
- **`docs/deps.md`:** for a dependency, one row with the exact version, the reason and the licence. Pin a version that is at least two weeks old. Pi packages stay at exact versions as before.
- **The log entry** for the card names what was absorbed and from where.

## What review checks

- The licence was read at the commit, and the commit is in the register.
- The mode is right: a "port" that is the source's text with renamed variables is a copy and needs its notice.
- Nothing came along that the card did not need.
- The absorbed code has tests, and the gates pass.
- No rule in AGENTS.md was bent to fit the source.

## When the source cannot be used

Say so in the card's log entry and name the substitute. The research lists the cases it found in `docs/research/absorb/long-list.md` ("Not absorbable"), for example elkjs (EPL or GPL), and the cards name others, for example trufflehog (AGPL) and Arize Phoenix (Elastic).
