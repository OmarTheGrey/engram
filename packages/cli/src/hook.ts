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
// folder (`rm -rf .claude`, `rm -rf ~/.engram`: R3-13). With `--server` the
// hook cannot see the log the server writes (card RV5, finding RV-SRF-9):
// `--db` names the server's workspace and is refused, so the default path was
// protected instead of the real one. `--protect <file>` names it (and any
// other file to guard), with the same SQLite companions; docs/dogfood.md has
// members pass the log `engram serve --db` names.
//
// `engram hook codex` (card E8.17) is the same hook for Codex, with Codex's
// reading of the input (packages/mcp/src/hook.ts) and Codex's paths: Codex
// starts a hook in the session's folder and exports no project variable, so
// `--root` and a relative `--db` resolve against the hook's own cwd. The
// protected files are the log, the project's `.codex/config.toml` (the MCP
// server's launch identity) and `.codex/hooks.json` (this hook), and the
// Codex home's `config.toml` and `hooks.json` (`$CODEX_HOME`, else
// `~/.codex`, by core's location table: codexHomeOf, in ./harness-settings.ts), with any folder holding
// one strictly inside the project or the home. Its default actor is
// `agent:codex`. `engram hook install` is ./hook-install.ts.
import { join, resolve } from "node:path";
import {
  type HookHarness,
  harnessBypass,
  harnessHook,
  hookDeny,
  isHarnessInput,
  type PreToolUseInput,
} from "@engram/mcp";
import { parse } from "./commands.ts";
import { connect } from "./connect.ts";
import { codexHome, HARNESSES, HOOK_AGENT } from "./harness-settings.ts";
import { OPTIONS } from "./registry.ts";
import type { Io } from "./run.ts";
import { buildActor, dbTarget, MEMORY_DB, UsageError } from "./setup.ts";

/** The project a harness's hook runs for: Claude Code's CLAUDE_PROJECT_DIR, Codex's session folder. */
export const hookProject = (
  harness: HookHarness,
  io: Pick<Io, "cwd" | "env">,
  input: { cwd?: string } = {},
): string =>
  harness === "codex"
    ? resolve(io.cwd)
    : resolve(io.cwd, io.env.CLAUDE_PROJECT_DIR || input.cwd || ".");

/** The files that govern a harness's session, beside the log: its MCP launch and its hook. */
export function governingFiles(
  harness: HookHarness,
  project: string,
  io: Pick<Io, "cwd" | "home" | "env">,
): string[] {
  if (harness === "codex") {
    const home = codexHome(io);
    return [
      join(project, ".codex", "config.toml"),
      join(project, ".codex", "hooks.json"),
      join(home, "config.toml"),
      join(home, "hooks.json"),
    ];
  }
  return [
    join(project, ".mcp.json"),
    join(project, ".claude", "settings.json"),
    join(project, ".claude", "settings.local.json"),
    // User-level settings can switch every hook off (disableAllHooks, R3-14).
    join(io.home, ".claude", "settings.json"),
    join(io.home, ".claude", "settings.local.json"),
    join(io.home, ".claude.json"),
  ];
}

async function readAll(stream: NodeJS.ReadableStream): Promise<string> {
  let text = "";
  for await (const chunk of stream) text += typeof chunk === "string" ? chunk : chunk.toString();
  return text;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function hookCommand(args: string[], io: Io): Promise<number> {
  if (args[0] === "install")
    return (await import("./hook-install.ts")).installCommand(args.slice(1), io);
  const { values, positionals } = parse(args, OPTIONS.hook, true);
  const [named, ...rest] = positionals;
  if (named === undefined || rest.length > 0 || !(HARNESSES as readonly string[]).includes(named))
    throw new UsageError(`give the harness: engram hook ${HARNESSES.join(" | ")} | install`);
  const harness = named as HookHarness;
  if (io.stdin === undefined) throw new UsageError("engram hook reads the hook's JSON on stdin");
  const print = (deny: ReturnType<typeof hookDeny>) => io.out(`${JSON.stringify(deny)}\n`);

  let input: PreToolUseInput;
  try {
    const parsed: unknown = JSON.parse(await readAll(io.stdin));
    if (!isHarnessInput(harness, parsed)) {
      print(hookDeny("engram: the hook input is not a PreToolUse object"));
      return 0;
    }
    input = parsed;
  } catch (e) {
    print(hookDeny(`engram: the hook input is not JSON: ${message(e)}`));
    return 0;
  }

  try {
    const project = hookProject(harness, io, input);
    const roots = (values.root ?? []).map((r) => resolve(project, r));
    const target = dbTarget(values.db, { cwd: project, home: io.home, env: io.env });
    const sqliteFiles = (path: string) =>
      ["", "-wal", "-shm", "-journal"].map((suffix) => `${path}${suffix}`);
    const log =
      target.backend === "sqlite" && target.path !== MEMORY_DB ? sqliteFiles(target.path) : [];
    const guarded = (values.protect ?? []).flatMap((f) => sqliteFiles(resolve(project, f)));
    const protect = [...log, ...guarded, ...governingFiles(harness, project, io)];
    const scope = { roots, protect, cwd: project, home: io.home, below: [project, io.home] };
    const actor = buildActor({ as: values.as ?? HOOK_AGENT[harness] }, undefined, "model");

    let conn: ReturnType<typeof connect>;
    try {
      conn = connect(
        { ...io, cwd: project },
        {
          db: values.db,
          policy: values.policy,
          server: values.server,
          otlp: values.otlp,
          "export-jsonl": values["export-jsonl"],
        },
        () => ({ db: values.db, policy: values.policy, requireStore: false }),
        (ws) => ws.open(),
      );
    } catch (e) {
      const found = harnessBypass(harness, input, scope);
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
      const decision = await harnessHook(harness, input, {
        ...scope,
        client: conn.client,
        actor,
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
