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
 * What the lock file does not list and pip adds on Windows for `click`,
 * `pytest` and `tqdm` (finding B7-8): pinned by a constraints file, so the
 * environment holds exact versions on every platform.
 */
export const MERIT_PLATFORM_PINS: readonly { requirement: string; platform: NodeJS.Platform }[] = [
  { requirement: "colorama==0.4.6", platform: "win32" },
];

/** A `name==version` line as pip and uv print it, with the name normalised (PEP 503). */
const normalise = (line: string) => {
  const [name, version] = line.trim().split("==");
  return `${(name ?? "").toLowerCase().replace(/[-_.]+/g, "-")}==${version ?? ""}`;
};

/** This platform's pins. */
const platformPins = (platform: NodeJS.Platform) =>
  MERIT_PLATFORM_PINS.filter((p) => p.platform === platform).map((p) => p.requirement);

/** The packages the environment must hold, exactly: the lock file's, and this platform's pins. */
export function expectedPackages(lockText: string, platform: NodeJS.Platform): string[] {
  const lines = lockText
    .split("\n")
    .map((l) => l.replace(/#.*/, "").trim())
    .filter((l) => l !== "");
  return [...new Set([...lines, ...platformPins(platform)].map(normalise))].sort();
}

/** What `uv pip freeze` lists differs from `expected`: the lines missing and the lines extra. */
export function packageDrift(freeze: string, expected: readonly string[]) {
  const have = new Set(
    freeze
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l !== "" && !l.startsWith("#"))
      .map(normalise),
  );
  const want = new Set(expected);
  return {
    missing: [...want].filter((p) => !have.has(p)).sort(),
    extra: [...have].filter((p) => !want.has(p)).sort(),
  };
}

const describeDrift = (d: { missing: string[]; extra: string[] }) =>
  `missing ${d.missing.join(", ") || "none"}; extra ${d.extra.join(", ") || "none"}`;

/**
 * MERIT's own environment: a uv virtual environment on Python 3.11 with the
 * checkout's requirements-lock.txt installed, constrained by the platform
 * pins. Reused while its marker names the same Python and lock file and
 * what is installed is exactly the lock's packages and the pins (checked
 * with `uv pip freeze` every time); created or refreshed otherwise.
 */
export function ensureMeritEnv(
  envDir: string,
  checkout: string,
  options: { env?: NodeJS.ProcessEnv; uv?: string } = {},
): string {
  const env = options.env ?? process.env;
  const uv = options.uv ?? env.UV ?? "uv";
  const lock = join(checkout, MERIT_PIN.requirements);
  const lockText = readFileSync(lock, "utf8");
  const expected = expectedPackages(lockText, process.platform);
  const want = {
    python: MERIT_PIN.python,
    requirements_sha256: createHash("sha256").update(readFileSync(lock)).digest("hex"),
    platform_pins: platformPins(process.platform),
  };
  const python = meritPython(envDir);
  const marker = join(envDir, MARKER);
  const freeze = () => run(uv, ["pip", "freeze", "--no-config", "--python", python]);
  let stale = "missing";
  if (existsSync(python) && existsSync(marker)) {
    const have = JSON.parse(readFileSync(marker, "utf8")) as Partial<typeof want>;
    const drift = packageDrift(freeze(), expected);
    if (have.python !== want.python || have.requirements_sha256 !== want.requirements_sha256) {
      stale = "installed from another Python or lock file";
    } else if (drift.missing.length > 0 || drift.extra.length > 0) {
      stale = `not the lock's packages (${describeDrift(drift)})`;
    } else {
      return python;
    }
  }
  if (offline(env)) {
    throw new MeritSetupError(
      `MERIT's environment at ${envDir} is ${stale}, and ENGRAM_OFFLINE=1 forbids installing it; run make bench BENCH=merit`,
    );
  }
  run(uv, ["venv", "--no-project", "--no-config", "--clear", "--python", MERIT_PIN.python, envDir]);
  const constraints = join(envDir, "engram-constraints.txt");
  writeFileSync(constraints, `${want.platform_pins.join("\n")}\n`);
  run(uv, ["pip", "install", "--no-config", "--python", python, "-r", lock, "-c", constraints]);
  const drift = packageDrift(freeze(), expected);
  if (drift.missing.length > 0 || drift.extra.length > 0) {
    throw new MeritSetupError(
      `MERIT's environment installed other packages than the lock's (${describeDrift(drift)})`,
    );
  }
  writeFileSync(marker, `${JSON.stringify(want, null, 2)}\n`);
  return python;
}
