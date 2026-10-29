// No-bypass decisions (ADR 0014, decision D10): whether a shell command or a
// tool call would reach a store without the Plane. They decide, so they live
// in core (AGENTS.md rule 1; plan docs/tasks/gate-b-plan.md decision 6), and
// every surface that intercepts tool calls asks here: the pi extension
// (user_bash and tool_call) and the Claude Code hook (`engram hook
// claude-code`, a PreToolUse hook). The surface records what it blocks with
// Plane.recordBypass. The text and path rules and their limits are in
// no-bypass/shell.ts and no-bypass/paths.ts.
import { storeRootOf, toolPaths } from "./no-bypass/paths.ts";
import { blockedStoreCommand, pathWords, STORE_COMMANDS } from "./no-bypass/shell.ts";
import type { Bypass } from "./plane.ts";

export * from "./no-bypass/paths.ts";
export { blockedStoreCommand, commandWords, pathWords, STORE_COMMANDS } from "./no-bypass/shell.ts";

export interface BypassCheck {
  /** The directory relative paths are resolved against: the session's or the hook's cwd. */
  cwd: string;
  /** Directories holding store files (a files adapter's root). */
  roots: readonly string[];
  /** Store CLIs blocked in shell commands; STORE_COMMANDS by default. */
  stores?: readonly string[];
  /** The store a path inside a root is reported as reaching. */
  rootStore: string;
}

/** The bypass a shell command would be: a store's CLI anywhere in it, or a word that is a path in a root. */
export function shellBypass(command: string, check: BypassCheck): Bypass | undefined {
  const store = blockedStoreCommand(command, check.stores ?? STORE_COMMANDS);
  if (store !== undefined) return { command, store };
  for (const word of pathWords(command))
    if (storeRootOf(word, { cwd: check.cwd, roots: check.roots, recursive: false }) !== undefined)
      return { command, store: check.rootStore, route: "path" };
  return undefined;
}

/**
 * The bypass a tool call would be: a path argument, at any depth, inside a
 * store root (or, for a recursive tool, a root inside the path it searches).
 */
export function toolBypass(
  toolName: string,
  input: Record<string, unknown>,
  check: BypassCheck,
): Bypass | undefined {
  const { paths, recursive } = toolPaths(toolName, input);
  for (const path of paths) {
    if (storeRootOf(path, { cwd: check.cwd, roots: check.roots, recursive }) !== undefined) {
      const shown = path === undefined ? `${toolName} (no path, the cwd)` : `${toolName} ${path}`;
      return { command: shown, store: check.rootStore, route: "path" };
    }
  }
  return undefined;
}
