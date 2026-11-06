// The bench and runner import cycle (backlog, Gate B; ADR 0032). @engram/bench
// must load alone in a fresh process and use its exports at module top level, and
// it must not depend on @engram/runner again: the shared model layer lives in
// @engram/model, which imports neither of them.
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const PACKAGES = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Imports `specifier` in a new Node process started in `cwd`, then runs `check`. */
function loadAlone(cwd: string, specifier: string, check: string) {
  const code = `const m = await import(${JSON.stringify(specifier)}); ${check}`;
  return spawnSync(process.execPath, ["--input-type=module", "-e", code], {
    cwd,
    encoding: "utf8",
    timeout: 60_000,
  });
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && e.name.endsWith(".ts"))
    .map((e) => join(e.parentPath, e.name));
}

function dependsOn(pkg: string): string[] {
  const json = JSON.parse(readFileSync(join(PACKAGES, pkg, "package.json"), "utf8"));
  return Object.keys({ ...json.dependencies, ...json.devDependencies });
}

describe("@engram/bench loads without @engram/runner", () => {
  test("loads alone in a fresh process and its exports are bound at top level", () => {
    const run = loadAlone(
      join(PACKAGES, "bench"),
      "@engram/bench",
      'if (typeof m.gatemem.turnTime !== "function" || typeof m.memInvBench !== "object") process.exit(3);',
    );
    expect(run.stderr.replace(/.*ExperimentalWarning.*\n|.*--trace-warnings.*\n/g, "")).toBe("");
    expect(run.status).toBe(0);
  });

  test("bench declares no dependency on the runner", () => {
    expect(dependsOn("bench")).not.toContain("@engram/runner");
  });

  test("no bench source, script or test imports the runner", () => {
    const dirs = ["src", "scripts", "test"].map((d) => join(PACKAGES, "bench", d));
    const importers = dirs
      .flatMap(sourceFiles)
      .filter((f) => /from\s+["']@engram\/runner["']/.test(readFileSync(f, "utf8")));
    expect(importers).toEqual([]);
  });

  test("the shared model layer depends on neither bench nor runner", () => {
    const deps = dependsOn("model");
    expect(deps).not.toContain("@engram/bench");
    expect(deps).not.toContain("@engram/runner");
    const importers = sourceFiles(join(PACKAGES, "model", "src")).filter((f) =>
      /from\s+["']@engram\/(bench|runner)["']/.test(readFileSync(f, "utf8")),
    );
    expect(importers).toEqual([]);
  });
});
