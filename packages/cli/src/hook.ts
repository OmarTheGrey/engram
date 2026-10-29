// `engram hook claude-code` (ADR 0022, plan decision 6): the Claude Code
// PreToolUse hook. It reads the hook's JSON from stdin, asks core whether the
// call is a bypass (packages/mcp/src/hook.ts), records a block through the
// client, and prints Claude Code's deny decision on stdout; it prints nothing
// for any other call. It exits 0 either way: the decision is in the JSON
// (Claude Code reads it on exit 0 only, and lets the call through on any exit
// but 0 and 2). Every failure after the flags are read is a deny printed on
// stdout with exit 0: input it cannot read or that is not a PreToolUse
// object (review finding R3-6), and any error while deciding. A log that
// cannot be opened still blocks a bypass, unrecorded, and lets other calls go on.
//
// Paths (review finding R3-10): `--root` and a relative `--db` resolve
// against $CLAUDE_PROJECT_DIR, else the input's `cwd`, else the hook's own
// cwd, as Claude Code resolves the project. The protected files (R3-2) are
// the log the hook writes to (with SQLite's -wal, -shm and -journal files),
// the project's `.mcp.json`, `.claude/settings.json` and
// `.claude/settings.local.json`, and the user's `~/.claude/settings.json`,
// `~/.claude/settings.local.json` and `~/.claude.json` (R3-14), together with
// any folder holding one of them strictly inside the project or the home
// folder (`rm -rf .claude`, `rm -rf ~/.engram`: R3-13).
import { join, resolve } from "node:path";
import {
  claudeCodeHook,
  hookBypass,
  hookDeny,
  isHookInput,
  type PreToolUseInput,
} from "@engram/mcp";
import { CLIENT_OPTIONS, parse, STORE_OPTIONS } from "./commands.ts";
import { connect } from "./connect.ts";
import type { Io } from "./run.ts";
import { buildActor, dbTarget, MEMORY_DB, UsageError } from "./setup.ts";

/** The harnesses a hook exists for. */
const HARNESSES = ["claude-code"] as const;

async function readAll(stream: NodeJS.ReadableStream): Promise<string> {
  let text = "";
  for await (const chunk of stream) text += typeof chunk === "string" ? chunk : chunk.toString();
  return text;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function hookCommand(args: string[], io: Io): Promise<number> {
  const { values, positionals } = parse(
    args,
    {
      db: STORE_OPTIONS.db,
      policy: STORE_OPTIONS.policy,
      root: { type: "string", multiple: true },
      as: { type: "string" },
      ...CLIENT_OPTIONS,
    },
    true,
  );
  const [harness, ...rest] = positionals;
  if (
    harness === undefined ||
    rest.length > 0 ||
    !(HARNESSES as readonly string[]).includes(harness)
  )
    throw new UsageError(`give the harness: engram hook ${HARNESSES.join(" | ")}`);
  if (io.stdin === undefined) throw new UsageError("engram hook reads the hook's JSON on stdin");
  const print = (deny: ReturnType<typeof hookDeny>) => io.out(`${JSON.stringify(deny)}\n`);

  let input: PreToolUseInput;
  try {
    const parsed: unknown = JSON.parse(await readAll(io.stdin));
    if (!isHookInput(parsed)) {
      print(hookDeny("engram: the hook input is not a PreToolUse object"));
      return 0;
    }
    input = parsed;
  } catch (e) {
    print(hookDeny(`engram: the hook input is not JSON: ${message(e)}`));
    return 0;
  }

  try {
    const project = resolve(io.cwd, io.env.CLAUDE_PROJECT_DIR || input.cwd || ".");
    const roots = (values.root ?? []).map((r) => resolve(project, r));
    const target = dbTarget(values.db, { cwd: project, home: io.home, env: io.env });
    const log =
      target.backend === "sqlite" && target.path !== MEMORY_DB
        ? ["", "-wal", "-shm", "-journal"].map((suffix) => `${target.path}${suffix}`)
        : [];
    const protect = [
      ...log,
      join(project, ".mcp.json"),
      join(project, ".claude", "settings.json"),
      join(project, ".claude", "settings.local.json"),
      // User-level settings can switch every hook off (disableAllHooks, R3-14).
      join(io.home, ".claude", "settings.json"),
      join(io.home, ".claude", "settings.local.json"),
      join(io.home, ".claude.json"),
    ];
    const scope = { roots, protect, cwd: project, home: io.home, below: [project, io.home] };
    const actor = buildActor({ as: values.as ?? "agent:claude-code" }, undefined, "model");

    let conn: ReturnType<typeof connect>;
    try {
      conn = connect(
        { ...io, cwd: project },
        { db: values.db, policy: values.policy, server: values.server },
        () => ({ db: values.db, policy: values.policy, requireStore: false }),
        (ws) => ws.open(),
      );
    } catch (e) {
      const found = hookBypass(input, scope);
      if (found !== undefined)
        print(
          hookDeny(
            `engram: blocked ${found.store} (${found.route ?? "command"}); the block could not be recorded: ${message(e)}`,
          ),
        );
      io.err(`engram hook: ${message(e)}\n`);
      return 0;
    }
    try {
      const decision = await claudeCodeHook(input, {
        ...scope,
        client: conn.client,
        actor,
        now: io.now,
      });
      if (decision !== null) print(decision);
      return 0;
    } finally {
      conn.close();
    }
  } catch (e) {
    print(hookDeny(`engram: the hook failed, so the call is refused: ${message(e)}`));
    io.err(`engram hook: ${message(e)}\n`);
    return 0;
  }
}
