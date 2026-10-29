// No-bypass decisions (ADR 0014, decision D10): whether a shell command or a
// tool call would reach a store without the Plane. They decide, so they live
// in core (AGENTS.md rule 1; plan docs/tasks/gate-b-plan.md decision 6), and
// every surface that intercepts tool calls asks here: the pi extension
// (user_bash and tool_call) and the Claude Code hook (`engram hook
// claude-code`, a PreToolUse hook). The surface records what it blocks with
// Plane.recordBypass. The text and path rules and their limits are in
// no-bypass/shell.ts and no-bypass/paths.ts.
import { resolve, sep } from "node:path";
import { storeRootOf, toolPaths, uncDrivePath } from "./no-bypass/paths.ts";
import { blockedStoreCommand, commandWords, STORE_COMMANDS } from "./no-bypass/shell.ts";
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

/** A glob segment (`*`, `?`, `[...]`) as a whole-segment pattern; undefined for a literal one. */
function segmentGlob(segment: string): RegExp | undefined {
  if (!/[*?[]/.test(segment)) return undefined;
  const source = segment
    .split(/(\*|\?|\[[^\]]*\])/)
    .map((part) =>
      part === "*"
        ? "[^/\\\\]*"
        : part === "?"
          ? "[^/\\\\]"
          : part.startsWith("[") && part.endsWith("]") && part.length > 2
            ? `[${part.slice(1, -1).replace(/^!/, "^").replace(/\\/g, "\\\\")}]`
            : part.replace(/[.+^${}()|\\\]]/g, "\\$&"),
    )
    .join("");
  try {
    return new RegExp(`^${source}$`, process.platform === "win32" ? "i" : "");
  } catch {
    return undefined;
  }
}

/**
 * Whether a shell word holding glob characters could expand to a root or a
 * path inside one (review finding R3-7: `cat memor?/a.md` or a star in place of the y): resolved against
 * the cwd, each of its segments matches the root's segment at that depth,
 * literally or as a pattern, for at least as many segments as the root has.
 */
function globReachesRoot(word: string, cwd: string, roots: readonly string[]): boolean {
  if (!/[*?[]/.test(word)) return false;
  const fold = (s: string) => (process.platform === "win32" ? s.toLowerCase() : s);
  const parts = resolve(cwd, word)
    .split(/[\\/]+/)
    .filter(Boolean);
  return roots.some((root) => {
    const r = resolve(root)
      .split(sep === "\\" ? /[\\/]+/ : /\/+/)
      .filter(Boolean);
    if (parts.length < r.length) return false;
    return r.every((segment, i) => {
      const w = parts[i] as string;
      const glob = segmentGlob(w);
      return glob ? glob.test(segment) : fold(w) === fold(segment);
    });
  });
}

/**
 * The bypass a shell command would be: a store's CLI anywhere in it, or a
 * word that reaches a root. Every word is resolved against the cwd, not only
 * those that look like paths, so `cd memory && cat a.md` is caught by its
 * bare `memory` (review finding R3-7); a word with glob characters is caught
 * when it could expand into a root; a machine's own admin share or device
 * path (`\\localhost\C$\...`) is read as its drive path. The cost: a bare
 * word that happens to name a root beside the cwd (`echo memory`) is refused.
 */
export function shellBypass(command: string, check: BypassCheck): Bypass | undefined {
  const store = blockedStoreCommand(command, check.stores ?? STORE_COMMANDS);
  if (store !== undefined) return { command, store };
  const root = { cwd: check.cwd, roots: check.roots, recursive: false };
  const path = { command, store: check.rootStore, route: "path" as const };
  const words = commandWords(command).flatMap((w) => [w, ...w.split("=").slice(1)]);
  for (const unc of command.matchAll(
    /[\\/]{2}(?:localhost|127\.0\.0\.1|\?|\.)[\\/][a-zA-Z][$:][^\s'"|;&<>()]*/gi,
  ))
    if (uncDrivePath(unc[0]) !== undefined) words.push(unc[0]);
  for (const word of words) {
    if (storeRootOf(word, root) !== undefined) return path;
    if (globReachesRoot(word, check.cwd, check.roots)) return path;
  }
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
