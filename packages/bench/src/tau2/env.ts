// tau2-bench's own environment (card B11): the harness at its pin in
// .engram/upstream/tau2-bench, and a Python environment for it in
// .engram/tau2-venv built from the tag's own uv.lock (`uv sync --frozen`),
// outside the research workspace. Python 3.12: the tag allows 3.12 and 3.13,
// but 3.13 has no `audioop`, which tau2 imports at start
// (docs/log/2026-11-21-b11-failure-python-313.md).
//
// `checkTau2` reads only: the checkout is at the pin with no change (a
// patched harness is not the pinned one), the environment's Python is 3.12
// with tau2 1.0.1 installed, every locked package is installed at its locked
// version (`uv sync --frozen --check`, the project itself left out, since uv
// always counts a local editable project as stale), and no `.env` file sits
// where tau2's own `load_dotenv()` looks (its utils folder and every folder
// above), since one could put a provider key into tau2's process.
// `setupTau2` fetches code and packages at the pin and is refused under
// ENGRAM_OFFLINE=1.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { TAU2_PIN } from "./config.ts";

export const TAU2_PYTHON_VERSION = "3.12";
export const TAU2_VERSION = "1.0.1";

export interface Tau2Paths {
  upstream: string;
  venv: string;
  python: string;
}

export function tau2Paths(repo: string, platform: NodeJS.Platform = process.platform): Tau2Paths {
  const upstream = join(repo, ".engram", "upstream", "tau2-bench");
  const venv = join(repo, ".engram", "tau2-venv");
  const python =
    platform === "win32" ? join(venv, "Scripts", "python.exe") : join(venv, "bin", "python");
  return { upstream, venv, python };
}

function run(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = process.env) {
  const r = spawnSync(command, args, { cwd, env, encoding: "utf8", timeout: 900_000 });
  return { ok: r.status === 0, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}

const lockArgs = (check: boolean) => [
  "sync",
  "--frozen",
  "--no-dev",
  "--python",
  TAU2_PYTHON_VERSION,
  ...(check ? ["--check", "--no-install-project", "--inexact"] : []),
];

/** `.env` files where python-dotenv's `find_dotenv()`, called from tau2's utils, would find one. */
export function dotenvFiles(upstream: string): string[] {
  const found: string[] = [];
  let dir = resolve(upstream, "src", "tau2", "utils");
  for (;;) {
    if (existsSync(join(dir, ".env"))) found.push(join(dir, ".env"));
    const up = dirname(dir);
    if (up === dir) return found;
    dir = up;
  }
}

/** What is wrong with the environment, or an empty list when it is ready. `pin` is for tests. */
export function checkTau2(paths: Tau2Paths, pin: string = TAU2_PIN.commit): string[] {
  const problems: string[] = [];
  if (!existsSync(join(paths.upstream, ".git"))) {
    problems.push(`tau2-bench is not checked out at ${paths.upstream}`);
  } else {
    const head = run("git", ["rev-parse", "HEAD"], paths.upstream);
    if (head.out !== pin) {
      problems.push(`${paths.upstream} is at ${head.out || "no commit"}, not the pin ${pin}`);
    }
    const changed = run("git", ["status", "--porcelain"], paths.upstream);
    if (!changed.ok || changed.out !== "") {
      problems.push(
        `${paths.upstream} differs from the pinned commit (a patched harness is not the pinned one): ${changed.out || changed.err}`,
      );
    }
    for (const file of dotenvFiles(paths.upstream)) {
      problems.push(`${file} would be loaded into tau2's process by its load_dotenv(); remove it`);
    }
  }
  if (!existsSync(paths.python)) {
    problems.push(`tau2's Python environment is missing: ${paths.python}`);
    return problems;
  }
  const version = run(
    paths.python,
    [
      "-I",
      "-c",
      "import sys, importlib.metadata as m; print('%d.%d' % sys.version_info[:2], m.version('tau2'))",
    ],
    paths.upstream,
  );
  if (version.out !== `${TAU2_PYTHON_VERSION} ${TAU2_VERSION}`) {
    problems.push(
      `tau2's environment runs Python and tau2 ${version.out || version.err}, not Python ${TAU2_PYTHON_VERSION} with tau2 ${TAU2_VERSION}`,
    );
  }
  if (problems.length === 0) {
    const lock = run("uv", lockArgs(true), paths.upstream, {
      ...process.env,
      UV_PROJECT_ENVIRONMENT: paths.venv,
    });
    if (!lock.ok) {
      problems.push(`tau2's environment differs from the tag's uv.lock: ${lock.err || lock.out}`);
    }
  }
  return problems;
}

/** Fetches tau2 at the pin and installs its locked requirements; refused offline. */
export function setupTau2(paths: Tau2Paths, env: NodeJS.ProcessEnv = process.env): void {
  if (env.ENGRAM_OFFLINE === "1") {
    throw new Error(
      `tau2-bench's environment is not ready and ENGRAM_OFFLINE=1 forbids fetching it: ${checkTau2(paths).join("; ")}`,
    );
  }
  const step = (command: string, args: string[], cwd: string, stepEnv?: NodeJS.ProcessEnv) => {
    const r = run(command, args, cwd, stepEnv);
    if (!r.ok) throw new Error(`${command} ${args.join(" ")} failed in ${cwd}: ${r.err || r.out}`);
  };
  if (!existsSync(join(paths.upstream, ".git"))) {
    mkdirSync(paths.upstream, { recursive: true });
    step("git", ["init", "-q"], paths.upstream);
    step("git", ["remote", "add", "origin", TAU2_PIN.repository], paths.upstream);
  }
  if (run("git", ["rev-parse", "HEAD"], paths.upstream).out !== TAU2_PIN.commit) {
    step("git", ["fetch", "-q", "--depth", "1", "origin", TAU2_PIN.commit], paths.upstream);
    step("git", ["checkout", "-q", "--detach", TAU2_PIN.commit], paths.upstream);
  }
  step("uv", lockArgs(false), paths.upstream, { ...env, UV_PROJECT_ENVIRONMENT: paths.venv });
  const problems = checkTau2(paths);
  if (problems.length > 0) throw new Error(`tau2-bench's environment: ${problems.join("; ")}`);
}
