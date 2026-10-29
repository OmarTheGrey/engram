// `engram hook claude-code` (ADR 0022; plan decision 6): a Claude Code
// PreToolUse hook. Claude Code runs it before each matching tool call with the
// call as JSON on stdin (`tool_name`, `tool_input`, `cwd`, ...). It blocks a
// Bash command that names a store's CLI, and a file tool (Read, Write, Edit,
// MultiEdit, NotebookEdit, Glob, Grep, LS, and any tool with a path argument)
// on a path inside a configured store root, with the checks the pi extension
// runs (core's no-bypass.ts), and records each block as one bypass_blocked
// event through the client. A block answers on stdout with
// `hookSpecificOutput.permissionDecision: "deny"` and the reason, which Claude
// Code shows the model; anything else answers nothing, and the call goes on.
// The Engram MCP server's own tools (`mcp__engram__*`) are the governed path
// and are never checked here.
//
// It fails closed: a block whose event cannot be recorded is still a deny,
// and says the record failed. What a hook cannot do (ADR 0022): see a store
// reached through a path or name a command computes at run time, or govern
// what Claude Code already holds in its context.
import { type Actor, type Bypass, shellBypass, toolBypass } from "@engram/core";
import type { EngramClient } from "@engram/sdk";

export interface HookOptions {
  client: EngramClient;
  /** Who block events are recorded as; its source is set to `model`. */
  actor: Actor;
  /** Store roots no file tool may touch. */
  roots: readonly string[];
  /** The cwd relative paths resolve against when the input names none. */
  cwd: string;
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

/** Claude Code's tool names as the path check knows them: Glob searches a tree as find does. */
const TOOL_KIND: Record<string, string> = { glob: "find", grep: "grep", ls: "ls" };

/** The bypass a PreToolUse call would be, if any. Core decides; nothing here is policy. */
export function hookBypass(input: PreToolUseInput, roots: readonly string[], cwd: string) {
  const tool = input.tool_name ?? "";
  if (tool.startsWith("mcp__engram__")) return undefined;
  const args = input.tool_input ?? {};
  const check = { cwd: input.cwd ?? cwd, roots, rootStore: "files" };
  if (tool === "Bash" && typeof args.command === "string") {
    const found = shellBypass(args.command, check);
    if (found !== undefined) return found;
  }
  const lower = tool.toLowerCase();
  return toolBypass(TOOL_KIND[lower] ?? lower, args, check);
}

/** Runs the hook on one input: a deny to print, or null to let the call go on. */
export async function claudeCodeHook(
  input: PreToolUseInput,
  options: HookOptions,
): Promise<HookDeny | null> {
  const found: Bypass | undefined = hookBypass(input, options.roots, options.cwd);
  if (found === undefined) return null;
  const actor: Actor = { ...options.actor, source: "model" };
  let reason: string;
  try {
    const answer = await options.client.POST("/api/v1/bypass", {
      body: { actor, bypass: found, at: options.now() },
    });
    const event = answer.data?.event;
    reason =
      event === undefined
        ? `engram: blocked ${found.store} (${found.route ?? "command"}); the block could not be recorded (${answer.response.status})`
        : `engram: ${event.reason} (${event.policy_id})`;
  } catch (e) {
    reason = `engram: blocked ${found.store} (${found.route ?? "command"}); the block could not be recorded: ${e instanceof Error ? e.message : String(e)}`;
  }
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  };
}
