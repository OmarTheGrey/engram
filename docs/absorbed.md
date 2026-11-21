# Absorbed work

The register of everything copied or ported into this repository from open-source projects (ADR 0037; the procedure is `docs/conventions/absorption.md`). One row per copy or port, added in the same pull request as the code. Dependencies are in `docs/deps.md`. Ideas are cited in their cards.

| source | commit | licence | mode | what was taken | where it landed | card |
|---|---|---|---|---|---|---|
| EverMind-AI/EverOS, `src/everos/core/failpoints.py` and its tests `tests/unit/test_core/test_failpoints.py` | e5778edb4cbac71e359ea375f38cf805aae32b0c | Apache-2.0 (LICENSE read at the commit; the file carries no other header) | port | the design of a test-only failpoint named by its step, and its four modes: a hard kill, raise the first n times, pause until released, skip the step; rewritten in TypeScript for one process (a dead handle for the kill, a call for the release), with its four mode tests | `packages/core/test/helpers/failpoint.ts`, tests in `packages/core/test/unit/plane/crash-windows.test.ts` | E1.4 |
