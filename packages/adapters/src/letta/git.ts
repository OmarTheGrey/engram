// The `git` executable, run without a shell (card A2, ADR 0028). Only local
// commands are ever run here: init, rev-parse, config, add, commit, reset,
// diff, log and cat-file; never fetch, pull, push, clone or anything that
// names a remote. GIT_TERMINAL_PROMPT=0 makes a credential prompt fail
// instead of waiting, and every call has a timeout.
import { spawn } from "node:child_process";

/** Every git call ends within this, hooks included. */
export const GIT_TIMEOUT_MS = 60_000;

export interface GitResult {
  code: number;
  stdout: Buffer;
  stderr: string;
}

/** `git` is not on the path. */
export class GitMissingError extends Error {
  constructor() {
    super(
      "letta adapter: the git executable is not on the path; MemFS is a git repository and needs it",
    );
    this.name = "GitMissingError";
  }
}

export interface GitOptions {
  cwd: string;
  /** Variables added to the environment, such as a fallback identity. */
  env?: Readonly<Record<string, string>>;
  /** Bytes written to standard input. */
  input?: string;
}

/** Runs git with `args` and resolves with its exit code and output; rejects only when it cannot run. */
export function runGit(args: readonly string[], options: GitOptions): Promise<GitResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", [...args], {
      cwd: options.cwd,
      // GIT_OPTIONAL_LOCKS=0: a read never takes the index lock a writer needs.
      env: { ...process.env, ...options.env, GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" },
      shell: false,
      windowsHide: true,
      timeout: GIT_TIMEOUT_MS,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on("data", (b: Buffer) => out.push(b));
    child.stderr.on("data", (b: Buffer) => err.push(b));
    child.on("error", (e: NodeJS.ErrnoException) =>
      reject(e.code === "ENOENT" ? new GitMissingError() : e),
    );
    child.on("close", (code, signal) =>
      resolve({
        code: code ?? (signal ? 128 : 1),
        stdout: Buffer.concat(out),
        stderr: Buffer.concat(err).toString("utf8"),
      }),
    );
    child.stdin.on("error", () => undefined);
    child.stdin.end(options.input ?? "");
  });
}

/** Runs git and returns its standard output; a non-zero exit rejects with git's message. */
export async function git(args: readonly string[], options: GitOptions): Promise<Buffer> {
  const result = await runGit(args, options);
  if (result.code !== 0) {
    const what = args.filter((a) => !a.startsWith("-c") && !a.includes("=")).slice(0, 2);
    throw new Error(
      `letta adapter: git ${what.join(" ")} failed (exit ${result.code}): ${result.stderr.trim() || "no message"}`,
    );
  }
  return result.stdout;
}

/** The installed git's version line, for example `git version 2.53.0`. */
export async function gitVersion(): Promise<string> {
  const out = await git(["--version"], { cwd: process.cwd() });
  return out.toString("utf8").trim();
}
