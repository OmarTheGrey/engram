import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { checkTau2, dotenvFiles, setupTau2, tau2Paths } from "../../src/tau2/env.ts";

const git = (cwd: string, ...args: string[]) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  expect(r.status).toBe(0);
  return r.stdout.trim();
};

/** A checkout of one commit, standing in for the pinned tau2, under a fresh repository root. */
function checkout() {
  const repo = mkdtempSync(join(tmpdir(), "tau2-env-"));
  const paths = tau2Paths(repo);
  mkdirSync(join(paths.upstream, "src", "tau2", "utils"), { recursive: true });
  writeFileSync(join(paths.upstream, "src", "tau2", "utils", "utils.py"), "load_dotenv()\n");
  git(paths.upstream, "init", "-q");
  git(paths.upstream, "add", ".");
  git(paths.upstream, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "pin");
  return { paths, pin: git(paths.upstream, "rev-parse", "HEAD") };
}

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

  test("a checkout at the pin passes the checkout checks; one changed file refuses it as patched", () => {
    const { paths, pin } = checkout();
    const clean = checkTau2(paths, pin);
    expect(clean.filter((p) => !p.includes("Python environment is missing"))).toEqual([]);
    writeFileSync(join(paths.upstream, "src", "tau2", "utils", "utils.py"), "patched()\n");
    expect(checkTau2(paths, pin).join("\n")).toMatch(/differs from the pinned commit/);
  });

  test("a checkout at another commit is refused", () => {
    const { paths } = checkout();
    expect(checkTau2(paths, "fc0055dc4e0a316c3f83133267fbd6faaa770992").join("\n")).toMatch(
      /not the pin fc0055dc/,
    );
  });

  test("a .env file where tau2's load_dotenv would find it is refused", () => {
    const { paths, pin } = checkout();
    expect(dotenvFiles(paths.upstream)).toEqual([]);
    const above = join(paths.upstream, "src", ".env");
    writeFileSync(above, "OPENAI_API_KEY=sk\n");
    expect(dotenvFiles(paths.upstream)).toEqual([above]);
    expect(checkTau2(paths, pin).join("\n")).toMatch(/would be loaded into tau2's process/);
  });
});
