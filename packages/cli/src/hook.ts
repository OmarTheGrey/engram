// `engram hook claude-code` (ADR 0022, plan decision 6): the Claude Code
// PreToolUse hook. It reads the hook's JSON from stdin, asks core whether the
// call is a bypass (packages/mcp/src/hook.ts), records a block through the
// client, and prints Claude Code's deny decision on stdout; it prints nothing
// for any other call. It exits 0 either way: the decision is in the JSON
// (Claude Code reads it on exit 0 only; any exit but 0 and 2 lets the call
// through). An input it cannot read is denied too (fail closed).
import { resolve } from "node:path";
import { claudeCodeHook, type HookDeny, hookBypass, type PreToolUseInput } from "@engram/mcp";
import { CLIENT_OPTIONS, parse, STORE_OPTIONS } from "./commands.ts";
import { connect } from "./connect.ts";
import type { Io } from "./run.ts";
import { buildActor, UsageError } from "./setup.ts";

/** The harnesses a hook exists for. */
const HARNESSES = ["claude-code"] as const;

async function readAll(stream: NodeJS.ReadableStream): Promise<string> {
  let text = "";
  for await (const chunk of stream) text += typeof chunk === "string" ? chunk : chunk.toString();
  return text;
}

const deny = (reason: string): HookDeny => ({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: reason,
  },
});

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
  const actor = buildActor({ as: values.as ?? "agent:claude-code" }, undefined, "model");
  const roots = (values.root ?? []).map((r) => resolve(io.cwd, r));

  let input: PreToolUseInput;
  try {
    input = JSON.parse(await readAll(io.stdin)) as PreToolUseInput;
  } catch (e) {
    io.out(
      `${JSON.stringify(deny(`engram: the hook input is not JSON: ${(e as Error).message}`))}\n`,
    );
    return 0;
  }
  let conn: ReturnType<typeof connect>;
  try {
    conn = connect(
      io,
      { db: values.db, policy: values.policy, server: values.server },
      () => ({ db: values.db, policy: values.policy, requireStore: false }),
      (ws) => ws.open(),
    );
  } catch (e) {
    // Claude Code lets a call through on any exit but 0 with a deny or 2, so a
    // log that cannot be opened still blocks a bypass (unrecorded) and lets
    // every other call go on.
    const found = hookBypass(input, roots, io.cwd);
    if (found !== undefined)
      io.out(
        `${JSON.stringify(deny(`engram: blocked ${found.store} (${found.route ?? "command"}); the block could not be recorded: ${(e as Error).message}`))}
`,
      );
    io.err(`engram hook: ${(e as Error).message}
`);
    return 0;
  }
  try {
    const decision = await claudeCodeHook(input, {
      client: conn.client,
      actor,
      roots,
      cwd: io.cwd,
      now: io.now,
    });
    if (decision !== null)
      io.out(`${JSON.stringify(decision)}
`);
    return 0;
  } finally {
    conn.close();
  }
}
