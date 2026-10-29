// Regression test for the hotfix of 2026-10-29: a vitest run that loads core's
// embedded-postgres global setup exited 0 with a failing test, because
// embedded-postgres's async-exit-hook called process.exit(0) on beforeExit
// (docs/log/2026-10-29-exit-code-0-on-failing-tests.md). The fixture project
// in fixtures/ci/vitest-exit/ uses that global setup and runs one always
// failing and one always passing test; it is outside every normal project.
import { execFile } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));
const vitest = join(root, "node_modules", "vitest", "vitest.mjs");
const config = join(root, "fixtures", "ci", "vitest-exit", "vitest.config.ts");

/** The text without ANSI escape sequences (colour and style codes). */
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[A-Za-z]`, "g");
const stripAnsi = (text: string) => text.replace(ANSI, "");

/** Runs the fixture project on one file with the embedded Postgres started; resolves to its exit code. */
function run(file: string): Promise<{ code: number; output: string }> {
  // Plain output: CI sets FORCE_COLOR, and colour codes would sit between the words.
  const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" };
  delete env.ENGRAM_PG;
  delete env.ENGRAM_PG_URL;
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [vitest, "run", "--config", config, file],
      { cwd: join(root, "fixtures", "ci", "vitest-exit"), env },
      (error, stdout, stderr) => {
        const code = error ? Number((error as { code?: unknown }).code ?? 1) : 0;
        resolve({ code, output: stripAnsi(`${stdout}${stderr}`) });
      },
    );
  });
}

describe("a vitest run with core's embedded-postgres global setup", () => {
  test("exits nonzero when a test fails", async () => {
    const { code, output } = await run("fail.fixture.ts");
    expect(output).toMatch(/Tests\s+1 failed/);
    expect(code, output).not.toBe(0);
  }, 180_000);

  test("exits 0 when every test passes", async () => {
    const { code, output } = await run("pass.fixture.ts");
    expect(output).toMatch(/Tests\s+1 passed/);
    expect(code, output).toBe(0);
  }, 180_000);
});
