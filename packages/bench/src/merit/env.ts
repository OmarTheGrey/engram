// MERIT's checkout and its own Python environment (card B7). The harness is
// merit-bench at the pin, run as an external process and never edited: a
// checkout at another commit, or with any change to a tracked file, is
// refused, since a patched harness is no longer the pinned one (PINS.md,
// AGENTS.md rule 8). Its environment lives under .engram/, apart from the
// research uv workspace, and is installed the way upstream's REPRODUCE.md
// says (`python3.11 -m venv`, then `pip install -r requirements-lock.txt`):
// uv creates the virtual environment on Python 3.11 and installs the lock
// file's exact versions into it. Fetching code and installing packages is
// the only network this file uses, and only when something is missing; it
// is refused under ENGRAM_OFFLINE=1, like every data fetch (testing.md).
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MERIT_PIN } from "./config.ts";

/** Where the launcher looks for the checkout and the environment by default, from the repository root. */
export const MERIT_UPSTREAM_DIR = ".engram/upstream/merit-bench";
export const MERIT_ENV_DIR = ".engram/merit-env";

/** What the environment was installed from: refreshed when the Python or the lock file differs. */
const MARKER = "engram-merit-env.json";

export class MeritSetupError extends Error {
  constructor(message: string) {
    super(`merit: ${message}`);
    this.name = "MeritSetupError";
  }
}

function run(cmd: string, args: string[], cwd?: string): string {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", timeout: 900_000 });
  if (r.error) throw new MeritSetupError(`${cmd} ${args.join(" ")}: ${r.error.message}`);
  if (r.status !== 0) {
    throw new MeritSetupError(`${cmd} ${args.join(" ")} exited ${r.status}: ${r.stderr.trim()}`);
  }
  return r.stdout;
}

const offline = (env: NodeJS.ProcessEnv) => env.ENGRAM_OFFLINE === "1";

/**
 * The checkout at the pin: fetched when missing (git, depth 1, line endings
 * as committed), then checked: HEAD is the pinned commit and no tracked file
 * differs from it.
 */
export function ensureMeritCheckout(dir: string, env: NodeJS.ProcessEnv = process.env): string {
  if (!existsSync(join(dir, "merit", "runner.py"))) {
    if (offline(env)) {
      throw new MeritSetupError(
        `no MERIT checkout at ${dir}, and ENGRAM_OFFLINE=1 forbids fetching it; run make bench BENCH=merit (it fetches before replaying offline)`,
      );
    }
    mkdirSync(dir, { recursive: true });
    run("git", ["init", "-q"], dir);
    // The files byte for byte as committed: core.autocrlf=true would check text out with CRLF.
    run("git", ["config", "core.autocrlf", "false"], dir);
    run("git", ["remote", "add", "origin", `${MERIT_PIN.repository}.git`], dir);
    run("git", ["fetch", "-q", "--depth", "1", "origin", MERIT_PIN.commit], dir);
    run("git", ["checkout", "-q", "FETCH_HEAD"], dir);
  }
  const head = run("git", ["rev-parse", "HEAD"], dir).trim();
  if (head !== MERIT_PIN.commit) {
    throw new MeritSetupError(`${dir} is at ${head}; the pin is ${MERIT_PIN.commit} (PINS.md)`);
  }
  const changed = run("git", ["status", "--porcelain", "--untracked-files=no"], dir).trim();
  if (changed !== "") {
    throw new MeritSetupError(
      `${dir} has changes to tracked files, so it is not the pinned harness:\n${changed}`,
    );
  }
  return dir;
}

/** The environment's interpreter. */
export const meritPython = (envDir: string) =>
  process.platform === "win32"
    ? join(envDir, "Scripts", "python.exe")
    : join(envDir, "bin", "python");

/**
 * MERIT's own environment: a uv virtual environment on Python 3.11 with the
 * checkout's requirements-lock.txt installed (with what each package needs
 * on this platform, as pip does). Reused while its marker names the same
 * Python and lock file; created or refreshed otherwise.
 */
export function ensureMeritEnv(
  envDir: string,
  checkout: string,
  options: { env?: NodeJS.ProcessEnv; uv?: string } = {},
): string {
  const env = options.env ?? process.env;
  const uv = options.uv ?? env.UV ?? "uv";
  const lock = join(checkout, MERIT_PIN.requirements);
  const want = {
    python: MERIT_PIN.python,
    requirements_sha256: createHash("sha256").update(readFileSync(lock)).digest("hex"),
  };
  const python = meritPython(envDir);
  const marker = join(envDir, MARKER);
  if (existsSync(python) && existsSync(marker)) {
    const have = JSON.parse(readFileSync(marker, "utf8")) as typeof want;
    if (have.python === want.python && have.requirements_sha256 === want.requirements_sha256) {
      return python;
    }
  }
  if (offline(env)) {
    throw new MeritSetupError(
      `MERIT's environment at ${envDir} is missing or stale, and ENGRAM_OFFLINE=1 forbids installing it; run make bench BENCH=merit`,
    );
  }
  run(uv, ["venv", "--no-project", "--no-config", "--clear", "--python", MERIT_PIN.python, envDir]);
  run(uv, ["pip", "install", "--no-config", "--python", python, "-r", lock]);
  writeFileSync(marker, `${JSON.stringify(want, null, 2)}\n`);
  return python;
}
