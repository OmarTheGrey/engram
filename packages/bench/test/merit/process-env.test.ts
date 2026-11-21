// The MERIT process's environment is hermetic (finding B7-2): LiteLLM loads a
// `.env` at import in its DEV mode, and the launcher sets another mode. The
// planted `.env` sits in the working directory, which python-dotenv searches
// for code run with `-c`; the control run without LITELLM_MODE shows the
// plant is on the search path, so the test can fail. Needs MERIT's
// environment, as launch.test.ts does, and is skipped without it.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MERIT_ENV_DIR, meritPython } from "../../src/merit/env.ts";
import { meritProcessEnv } from "../../src/merit/launch.ts";

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
const PYTHON = meritPython(join(REPO, MERIT_ENV_DIR));
const ready = existsSync(PYTHON);
if (!ready) console.warn(`merit process-env tests skipped: no MERIT environment at ${PYTHON}`);

const PROBE = "import os, litellm; print('planted=' + str(os.environ.get('ENGRAM_B7_PLANTED')))";

function importLitellm(env: NodeJS.ProcessEnv) {
  const cwd = mkdtempSync(join(tmpdir(), "engram-b7-dotenv-"));
  writeFileSync(join(cwd, ".env"), "ENGRAM_B7_PLANTED=leaked\nOPENAI_API_KEY=sk-planted\n");
  const r = spawnSync(PYTHON, ["-I", "-B", "-c", PROBE], {
    cwd,
    env,
    encoding: "utf8",
    timeout: 120_000,
  });
  expect(r.status, r.stderr).toBe(0);
  return r.stdout.trim();
}

describe.runIf(ready)("the MERIT process environment", () => {
  it("passes no provider key and keeps LiteLLM from loading a planted .env", () => {
    const env = meritProcessEnv({ ...process.env, OPENAI_API_KEY: "sk-real", ANTHROPIC_API_KEY: "x" });
    expect(env.OPENAI_API_KEY).toBe("engram-cassette-proxy");
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.LITELLM_MODE).toBe("PRODUCTION");
    expect(importLitellm(env)).toBe("planted=None");
  }, 300_000);

  it("would load the planted .env in LiteLLM's DEV mode (the control)", () => {
    const env = meritProcessEnv(process.env);
    delete env.LITELLM_MODE;
    expect(importLitellm(env)).toBe("planted=leaked");
  }, 300_000);
});
