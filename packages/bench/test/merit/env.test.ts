// MERIT's environment holds exactly its lock file's packages and the platform
// pins (finding B7-8). The last test reads the real environment and is
// skipped without it.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MERIT_PIN } from "../../src/merit/config.ts";
import {
  expectedPackages,
  MERIT_ENV_DIR,
  MERIT_UPSTREAM_DIR,
  meritPython,
  packageDrift,
} from "../../src/merit/env.ts";

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
const LOCK = join(REPO, MERIT_UPSTREAM_DIR, MERIT_PIN.requirements);
const PYTHON = meritPython(join(REPO, MERIT_ENV_DIR));

describe("MERIT's environment", () => {
  it("expects the lock's packages, names normalised, and colorama pinned on Windows only", () => {
    const lock = "Jinja2==3.1.6\ntyping_extensions==4.16.0  # a comment\n\nlitellm==1.91.1\n";
    expect(expectedPackages(lock, "linux")).toEqual([
      "jinja2==3.1.6",
      "litellm==1.91.1",
      "typing-extensions==4.16.0",
    ]);
    expect(expectedPackages(lock, "win32")).toContain("colorama==0.4.6");
  });

  it("names a package installed at another version as missing and extra", () => {
    const expected = expectedPackages("litellm==1.91.1\nopenai==2.44.0\n", "linux");
    expect(packageDrift("litellm==1.91.1\nopenai==2.45.0\n", expected)).toEqual({
      missing: ["openai==2.44.0"],
      extra: ["openai==2.45.0"],
    });
    expect(packageDrift("LiteLLM==1.91.1\nopenai==2.44.0\n", expected)).toEqual({
      missing: [],
      extra: [],
    });
  });

  it.runIf(existsSync(PYTHON) && existsSync(LOCK))(
    "holds exactly the lock's packages and this platform's pins",
    () => {
      const freeze = spawnSync(process.env.UV ?? "uv", ["pip", "freeze", "--python", PYTHON], {
        encoding: "utf8",
        timeout: 60_000,
      });
      expect(freeze.status, freeze.stderr).toBe(0);
      const expected = expectedPackages(readFileSync(LOCK, "utf8"), process.platform);
      expect(packageDrift(freeze.stdout, expected)).toEqual({ missing: [], extra: [] });
    },
  );
});
