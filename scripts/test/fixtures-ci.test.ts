// Acceptance for step-0 task S0.3: the PR gate fails the fixture PR with no
// log entry and passes the fixture PR with a valid one.
import { spawnSync } from "node:child_process";
import { expect, test } from "vitest";

const lintDocs = (pr: string) =>
  spawnSync("make", ["--no-print-directory", "lint-docs", `PR=${pr}`], { encoding: "utf8" });

test("make lint-docs fails on the fixture PR with no log entry", () => {
  const run = lintDocs("fixtures/ci/pr-no-log");
  expect(run.stderr).toContain("PR diff must add or change an entry under docs/log/");
  expect(run.status).not.toBe(0);
});

test("make lint-docs passes on the fixture PR with a valid log entry", () => {
  const run = lintDocs("fixtures/ci/pr-valid");
  expect(run.stderr).toBe("");
  expect(run.status).toBe(0);
});
