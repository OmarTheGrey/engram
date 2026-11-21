# ADR 0037: How Engram absorbs open-source work: a licence allowlist, four modes, and a register

Status: accepted, 2026-11-21, on the lead's instruction of that day (absorb any popular or useful open-source repository into the codebase); the lead may overturn it
Deciders: the orchestrating session, on the lead's instruction of 2026-11-21
Supersedes: nothing. It extends ADR 0020 (the code is Apache-2.0) and rule 11 (a dependency is one line in `docs/deps.md`) to code and data that are copied or rewritten rather than installed.

## Context

- **The instruction.** On 2026-11-21 the lead asked for the project to become as feature-rich as it can by absorbing open-source work, and for a plan of at most thirty pull requests that does so (`docs/tasks/absorb-plan.md`).
- **What was found.** The sweep behind the plan read 109 repositories at source level (`docs/research/absorb/19-github-scout.md`). Thirty-eight sources cannot be used as code, for their licence, their maintenance or their fit (`docs/research/absorb/long-list.md`, "Not absorbable").
- **What the rules cover today.** Rule 11 covers a package that is installed. Nothing says what may be copied into the tree, what a rewrite of someone's design owes them, or where either is recorded.
- **Why it matters here.** The repository is to be public under Apache-2.0 (ADR 0020), and the thesis discloses how the code was made. Code of unclear origin would put both at risk.

## Decision

1. **The allowlist.** Code is copied or ported only from sources under MIT, ISC, BSD-2-Clause, BSD-3-Clause, 0BSD, Apache-2.0, the Unlicense or CC0. A source under MPL-2.0 may be an unmodified dependency and is never copied from. Everything else is read for ideas only: AGPL, GPL, LGPL, SSPL, BUSL, the Elastic licence, any non-commercial or no-derivatives licence, and any repository with no licence file.
2. **Data.** A data set is vendored only under the allowlist or CC-BY-4.0, with attribution. Benchmark data keeps its own rule (ADR 0015, `packages/bench/PINS.md`).
3. **Four modes.** Every use of outside work is one of:
   - *copy*: the source's text, in whole or in part, with its copyright notice kept;
   - *port*: our own code written from the source's design, rules or data, in our language and style;
   - *depend*: a package or tool installed at an exact pinned version;
   - *idea*: nothing taken but the approach, which is cited.
4. **The licence is checked at the source.** Before a copy or a port, the card reads the licence file at the commit it takes from, and records that commit. A licence stated in a README, a registry or a research note is not enough.
5. **The register.** Every copy and port is a row in `docs/absorbed.md`: source, commit, licence, mode, what was taken, where it landed, the card. A copy also keeps the notice the licence requires in the root `NOTICE` file, and a comment at the top of the file that holds it naming the source. A dependency stays a row in `docs/deps.md`. An idea is cited in the card and, where the thesis relies on it, in the literature notes.
6. **Our rules still hold.** Absorbed code obeys every rule in AGENTS.md. Policy logic lands only in `packages/core`, which calls no model and does no store I/O. Anything that calls a model takes a seed and a cache key. Absorbed code arrives with tests in the same pull request, and what is not needed is not brought along.
7. **A pinned version is at least two weeks old** when it is first pinned, so a compromised release has had time to be noticed.
8. **One check.** `make lint-docs` fails when `docs/absorbed.md` names a file that does not exist. The pull request template's checklist asks whether the register and `NOTICE` were updated.

## Alternatives considered

- **Dependencies only, never copy.** Most of what is worth taking is a table of rules or sixty lines of design inside a product we do not want as a dependency. Installing a memory product to use its redaction table would add its whole surface.
- **Copy freely and sort out licences before the public release.** The origin of a file is cheap to record when it lands and expensive to reconstruct later, and the disclosure in the thesis must be true when it is written.
- **Allow LGPL as a dependency.** Possible in principle. No selected card needs one, and leaving it out keeps the rule one line. It can be added when a card needs it.
- **A vendor folder for copied code.** Copied code here is small and is edited to fit, so it lives where it is used, with its origin in the file's header and in the register.

## Consequences

- New files: `docs/conventions/absorption.md` (the procedure), `docs/absorbed.md` (the register, empty until the first card), and the root `NOTICE`.
- AGENTS.md gains rule 16 and the new paths. `docs/conventions/testing.md` is unchanged.
- The thesis methods chapter can state what was absorbed, from where and under which licence, by reading the register.
- Some attractive sources are closed to us as code, for example trufflehog (AGPL), elkjs (EPL or GPL) and Arize Phoenix (Elastic). The cards name the permitted substitute.
- The check in `make lint-docs` is implemented by the first card that adds a register row; until then the register is empty and there is nothing to check.

## Sources

- The lead's instruction of 2026-11-21, recorded in `docs/log/2026-11-21-orch-decision-absorb-plan.md`.
- `docs/tasks/absorb-plan.md`; `docs/research/absorb/19-github-scout.md`; `docs/research/absorb/long-list.md`.
- ADR 0020 (licence); ADR 0015 (vendored judges and data); AGENTS.md rule 11.
- The Apache Software Foundation's third-party licence policy (categories A, B and X), which the allowlist follows.
