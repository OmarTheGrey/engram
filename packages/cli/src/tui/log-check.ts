// doctor's log check (checkLog) for a Postgres log, off the TUI's input path
// (card E8.15b, review finding I1). Opening a Postgres connection is
// synchronous in the plane's driver and can take seconds, so the TUI runs
// the check in a child process with a timeout and draws the answer when it
// comes. The URL goes to the child on stdin, never in its arguments, so it
// is not in the process list. Run as a script, this file is the child.
import { type ChildProcess, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { CheckResult } from "../doctor.ts";

/** How long the child may take before the check reports that the log did not answer. */
export const LOG_CHECK_TIMEOUT_MS = 10_000;

export interface LogCheckInput {
  db: string | undefined;
  cwd: string;
  home: string;
  env: Readonly<Record<string, string | undefined>>;
}

/** The checks whose child process is still running (for quitting, and for tests). */
const live = new Set<ChildProcess>();

/** How many log checks are running now. */
export const liveLogChecks = () => live.size;

/**
 * The check in a child process: its CheckResult, or a fail naming the
 * timeout. `signal` stops it: the child is killed and its timer cleared, so
 * quitting never waits on it (verification finding E8.15b-27).
 */
export function checkLogInChild(
  input: LogCheckInput,
  timeoutMs = LOG_CHECK_TIMEOUT_MS,
  signal?: AbortSignal,
): Promise<CheckResult> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(["skip", "the log check was stopped"]);
      return;
    }
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url)], {
      stdio: ["pipe", "pipe", "ignore"],
      windowsHide: true,
      // Not L's token or handoff, which this process holds for itself alone (final review F-2).
      env: Object.fromEntries(
        Object.entries(process.env).filter(([k]) => !k.startsWith("ENGRAM_TUI_HAND")),
      ),
    });
    live.add(child);
    let out = "";
    const timer = setTimeout(() => {
      child.kill();
      resolve(["fail", `the log did not answer within ${timeoutMs / 1000} s`]);
    }, timeoutMs);
    child.stdout.on("data", (d: Buffer) => {
      out += d.toString("utf8");
    });
    child.on("close", () => {
      live.delete(child);
      clearTimeout(timer);
      try {
        resolve(JSON.parse(out) as CheckResult);
      } catch {
        resolve(["fail", "the log check stopped without an answer"]);
      }
    });
    child.on("error", (e) => {
      live.delete(child);
      clearTimeout(timer);
      resolve(["fail", `the log check could not start: ${e.message}`]);
    });
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        live.delete(child);
        child.kill();
        // The child's own stdio never holds the TUI's process open once it is stopped.
        child.stdout.destroy();
        child.stdin.destroy();
        child.unref();
        resolve(["skip", "the log check was stopped"]);
      },
      { once: true },
    );
    child.stdin.end(JSON.stringify(input));
  });
}

/** The child: reads its input on stdin, prints checkLog's answer as JSON. */
async function child(): Promise<void> {
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  const input = JSON.parse(text) as LogCheckInput;
  const { checkLog } = await import("../doctor.ts");
  const { dbTarget } = await import("../setup.ts");
  let result: CheckResult;
  try {
    result = checkLog(dbTarget(input.db, input));
  } catch (e) {
    result = ["fail", (e as Error).message];
  }
  process.stdout.write(JSON.stringify(result));
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1])
  await child();
