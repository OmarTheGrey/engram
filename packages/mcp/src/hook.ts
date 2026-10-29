// `engram hook claude-code` (ADR 0022; plan decision 6): a Claude Code
// PreToolUse hook. Claude Code runs it before each matching tool call with the
// call as JSON on stdin (`tool_name`, `tool_input`, `cwd`, ...). It blocks a
// shell command (Bash or PowerShell, in any case: review finding R3-1) that
// names a store's CLI, and a file tool (Read, Write, Edit, MultiEdit,
// NotebookEdit, Glob, Grep, LS, and any tool with a path argument) on a path
// inside a configured store root, with the checks the pi extension runs
// (core's no-bypass.ts), and records each block as one bypass_blocked event
// through the client. A block answers on stdout with
// `hookSpecificOutput.permissionDecision: "deny"` and the reason, which Claude
// Code shows the model; anything else answers nothing, and the call goes on.
// The Engram MCP server's own tools (`mcp__engram__*`) are the governed path
// and are never checked here.
//
// It also guards the files that govern the session (review finding R3-2):
// the event log, `.mcp.json` (the MCP server's launch identity) and
// `.claude/settings*.json` (this hook), reported as store `engram`, so the
// model cannot rewrite who it acts as, remove the hook or edit the log
// through Claude Code's own tools.
//
// It fails closed: a block whose event cannot be recorded is still a deny,
// and says the record failed; an input that is not a PreToolUse object is
// denied (R3-6). What a hook cannot do (ADR 0022): see a store reached
// through a path or name a command computes at run time, or govern what
// Claude Code already holds in its context.
import { type Actor, type Bypass, shellBypass, toolBypass } from "@engram/core";
import type { EngramClient } from "@engram/sdk";

/** What the hook guards; relative tool paths resolve against the input's cwd, else `cwd`. */
export interface HookScope {
  /** Store roots no file tool or shell command may touch. */
  roots: readonly string[];
  /** Files that govern the session: the log, `.mcp.json`, `.claude/settings*.json`. */
  protect: readonly string[];
  cwd: string;
  /** The folder `~` names in a tool call; the process's home when absent. */
  home?: string;
  /**
   * The project folder and the home folder: a folder strictly inside one of
   * them that holds a protected file is guarded too, since `rm -rf` or `mv`
   * of it takes the file along (review finding R3-13).
   */
  below?: readonly string[];
}

export interface HookOptions extends HookScope {
  client: EngramClient;
  /** Who block events are recorded as; its source is set to `model`. */
  actor: Actor;
  now: () => string;
}

/** What Claude Code sends a PreToolUse hook (the fields this hook reads). */
export interface PreToolUseInput {
  hook_event_name?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  cwd?: string;
}

/** A PreToolUse deny, as Claude Code reads it from the hook's stdout. */
export interface HookDeny {
  hookSpecificOutput: {
    hookEventName: "PreToolUse";
    permissionDecision: "deny";
    permissionDecisionReason: string;
  };
}

/** A deny with `reason`. */
export const hookDeny = (reason: string): HookDeny => ({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: reason,
  },
});

/** Claude Code's tool names as the path check knows them: Glob searches a tree as find does. */
const TOOL_KIND: Record<string, string> = { glob: "find", grep: "grep", ls: "ls" };
/** Tools that run a shell command, by lower-case name (R3-1). */
const SHELLS = new Set(["bash", "powershell"]);

const isObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

/** Whether a parsed input has PreToolUse's shape (R3-6); anything else is denied. */
export function isHookInput(value: unknown): value is PreToolUseInput {
  if (!isObject(value)) return false;
  return (
    (value.tool_name === undefined || typeof value.tool_name === "string") &&
    (value.tool_input === undefined || isObject(value.tool_input)) &&
    (value.cwd === undefined || typeof value.cwd === "string")
  );
}

/** The bypass a PreToolUse call would be, if any. Core decides; nothing here is policy. */
export function hookBypass(input: PreToolUseInput, scope: HookScope): Bypass | undefined {
  const tool = input.tool_name ?? "";
  if (tool.startsWith("mcp__engram__")) return undefined;
  const args = input.tool_input ?? {};
  const cwd = input.cwd ?? scope.cwd;
  const lower = tool.toLowerCase();
  const home = scope.home === undefined ? {} : { home: scope.home };
  const guarded = [
    { cwd, roots: scope.roots, rootStore: "files", ...home },
    { cwd, roots: scope.protect, rootStore: "engram", ...home, ancestorsBelow: scope.below ?? [] },
  ];
  for (const check of guarded) {
    if (SHELLS.has(lower) && typeof args.command === "string") {
      const found = shellBypass(args.command, {
        ...check,
        shell: lower === "powershell" ? "powershell" : "posix",
      });
      if (found !== undefined) return found;
    }
    const found = toolBypass(TOOL_KIND[lower] ?? lower, args, check);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** Runs the hook on one input: a deny to print, or null to let the call go on. */
export async function claudeCodeHook(
  input: unknown,
  options: HookOptions,
): Promise<HookDeny | null> {
  if (!isHookInput(input)) return hookDeny("engram: the hook input is not a PreToolUse object");
  const found = hookBypass(input, options);
  if (found === undefined) return null;
  const actor: Actor = { ...options.actor, source: "model" };
  try {
    const answer = await options.client.POST("/api/v1/bypass", {
      body: { actor, bypass: found, at: options.now() },
    });
    const event = answer.data?.event;
    return hookDeny(
      event === undefined
        ? `engram: blocked ${found.store} (${found.route ?? "command"}); the block could not be recorded (${answer.response.status})`
        : `engram: ${event.reason} (${event.policy_id})`,
    );
  } catch (e) {
    return hookDeny(
      `engram: blocked ${found.store} (${found.route ?? "command"}); the block could not be recorded: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}
