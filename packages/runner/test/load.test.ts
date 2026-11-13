// The bench and runner import cycle (backlog, Gate B; ADR 0033). Before the fix,
// loading the runner loaded bench, which loaded the runner's index while its
// bindings were still unset, so a top-level use of one in the other read
// undefined (docs/log/2026-10-29-b3-failure-bench-runner-import-cycle.md).
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const RUNNER = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("@engram/runner loads alone", () => {
  test("in a fresh process, with bench's and the model layer's exports bound at top level", () => {
    const code = [
      'const runner = await import("@engram/runner");',
      'const bench = await import("@engram/bench");',
      'if (typeof runner.cached !== "function" || typeof runner.scriptedModelCall !== "function") process.exit(3);',
      'if (typeof bench.gatemem.turnTime !== "function") process.exit(4);',
    ].join(" ");
    const run = spawnSync(process.execPath, ["--input-type=module", "-e", code], {
      cwd: RUNNER,
      encoding: "utf8",
      timeout: 60_000,
    });
    expect(run.stderr.replace(/.*ExperimentalWarning.*\n|.*--trace-warnings.*\n/g, "")).toBe("");
    expect(run.status).toBe(0);
  });
});
