// Acceptance for step-0 task S0.3: the PR gate fails the fixture PR with no
// log entry and passes the fixture PR with a valid one.
import { spawnSync } from "node:child_process";
import { expect, test } from "vitest";

// Each case spawns make, which spawns node: about 1.5 s alone, and up to 9 s
// measured in a full parallel `make test` on Windows, past vitest's 5 s
// default (docs/log/2026-10-25-s0-3-fixtures-ci-timeout.md). 30 s is over
// three times the worst measured run. spawnSync blocks the worker, so the same
// bound is also the child's own timeout: a hung make fails instead of waiting.
const SPAWN_TIMEOUT_MS = 30_000;

const lintDocs = (pr: string) =>
  spawnSync("make", ["--no-print-directory", "lint-docs", `PR=${pr}`], {
    encoding: "utf8",
    timeout: SPAWN_TIMEOUT_MS,
  });

test(
  "make lint-docs fails on the fixture PR with no log entry",
  () => {
    const run = lintDocs("fixtures/ci/pr-no-log");
    expect(run.stderr).toContain("PR diff must add or change an entry under docs/log/");
    expect(run.status).not.toBe(0);
  },
  SPAWN_TIMEOUT_MS,
);

test(
  "make lint-docs passes on the fixture PR with a valid log entry",
  () => {
    const run = lintDocs("fixtures/ci/pr-valid");
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
  },
  SPAWN_TIMEOUT_MS,
);
