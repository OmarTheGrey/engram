// doctor's log check (checkLog) for a Postgres log, off the TUI's input path
// (card E8.15b, review finding I1). Opening a Postgres connection is
// synchronous in the plane's driver and can take seconds, so the TUI runs
// the check in a child process with a timeout and draws the answer when it
// comes. The URL goes to the child on stdin, never in its arguments, so it
// is not in the process list. Run as a script, this file is the child.
import { spawn } from "node:child_process";
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

/** The check in a child process: its CheckResult, or a fail naming the timeout. */
export function checkLogInChild(
  input: LogCheckInput,
  timeoutMs = LOG_CHECK_TIMEOUT_MS,
): Promise<CheckResult> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url)], {
      stdio: ["pipe", "pipe", "ignore"],
      windowsHide: true,
    });
    let out = "";
    const timer = setTimeout(() => {
      child.kill();
      resolve(["fail", `the log did not answer within ${timeoutMs / 1000} s`]);
    }, timeoutMs);
    child.stdout.on("data", (d: Buffer) => {
      out += d.toString("utf8");
    });
    child.on("close", () => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(out) as CheckResult);
      } catch {
        resolve(["fail", "the log check stopped without an answer"]);
      }
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve(["fail", `the log check could not start: ${e.message}`]);
    });
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
