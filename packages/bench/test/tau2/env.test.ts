import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { checkTau2, setupTau2, tau2Paths } from "../../src/tau2/env.ts";

describe("tau2's own environment", () => {
  test("lives under .engram, outside the research workspace, with the platform's Python path", () => {
    const repo = join("r");
    expect(tau2Paths(repo, "win32")).toEqual({
      upstream: join("r", ".engram", "upstream", "tau2-bench"),
      venv: join("r", ".engram", "tau2-venv"),
      python: join("r", ".engram", "tau2-venv", "Scripts", "python.exe"),
    });
    expect(tau2Paths(repo, "linux").python).toBe(
      join("r", ".engram", "tau2-venv", "bin", "python"),
    );
  });

  test("a missing checkout and environment are reported, and fetching them is refused offline", () => {
    const paths = tau2Paths(mkdtempSync(join(tmpdir(), "tau2-env-")));
    const problems = checkTau2(paths);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/not checked out/);
    expect(() => setupTau2(paths, { ENGRAM_OFFLINE: "1" })).toThrow(
      /ENGRAM_OFFLINE=1 forbids fetching/,
    );
  });
});
