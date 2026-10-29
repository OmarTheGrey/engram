// No-bypass decisions (ADR 0014, decision D10): whether a shell command or a
// tool call would reach a store without the Plane. They decide, so they live
// in core (AGENTS.md rule 1; plan docs/tasks/gate-b-plan.md decision 6), and
// every surface that intercepts tool calls asks here: the pi extension
// (user_bash and tool_call) and the Claude Code hook (`engram hook
// claude-code`, a PreToolUse hook). The surface records what it blocks with
// Plane.recordBypass. The text and path rules and their limits are in
// no-bypass/shell.ts and no-bypass/paths.ts.
import { resolve, sep } from "node:path";
import { ancestorOfRoot, storeRootOf, toolPaths, uncDrivePath } from "./no-bypass/paths.ts";
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
  /** The folder `~` names; the process's home when absent. */
  home?: string;
  /**
   * Also a hit: a word or path naming a folder that holds a root, strictly
   * inside one of these folders (review finding R3-13). For protected files,
   * whose folder would go with them (`rm -rf .claude`); absent for store roots.
   */
  ancestorsBelow?: readonly string[];
}

/** Whether `word` reaches a root: inside it, or an ancestor of it when the check asks. */
function reaches(word: string | undefined, check: BypassCheck, recursive: boolean): boolean {
  const base = { cwd: check.cwd, roots: check.roots, recursive, home: check.home };
  if (storeRootOf(word, base) !== undefined) return true;
  return (
    check.ancestorsBelow !== undefined &&
    ancestorOfRoot(word, { ...base, below: check.ancestorsBelow }) !== undefined
  );
}

/**
 * The words of a shell command for the path check (review finding R3-15):
 * cut at unquoted whitespace first, so a quoted argument is one word after
 * quote removal. A word that held quoted whitespace (a commit message, a
 * `bash -c` script) contributes only its inner words that look like paths
 * (a slash or backslash, or a leading `.` or `~`), so `git commit -m "fix
 * memory leak"` names no root while `bash -c "cat memory/a.md"` still does.
 * Any other word is cut at shell operators as commandWords cuts it, and every
 * piece is checked.
 */
function pathCheckWords(command: string): string[] {
  const tokens: { text: string; spaced: boolean }[] = [];
  let text = "";
  let spaced = false;
  let quote: string | undefined;
  const flush = () => {
    if (text !== "") tokens.push({ text, spaced });
    text = "";
    spaced = false;
  };
  for (let i = 0; i < command.length; i++) {
    const c = command[i] as string;
    if (quote !== undefined) {
      if (c === quote) quote = undefined;
      else {
        if (/\s/.test(c)) spaced = true;
        text += c;
      }
    } else if (c === "'" || c === '"') quote = c;
    else if (c === "\\" && quote === undefined && /\s/.test(command[i + 1] ?? "")) {
      text += command[i + 1];
      i++;
    } else if (/\s/.test(c)) flush();
    else text += c;
  }
  flush();
  return tokens.flatMap(({ text: t, spaced: s }) => {
    const words = commandWords(t).flatMap((w) => [w, ...w.split("=").slice(1)]);
    return s ? words.filter((w) => /[\\/]|^~|^\./.test(w)) : words;
  });
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
 * path (`\\localhost\C$\...`) is read as its drive path. A quoted argument is
 * one word (pathCheckWords). The cost, erring towards blocking: a bare word
 * that names a root beside the cwd (`echo memory`, `grep -rn memory src`) is
 * refused; `ls *` and `rm -rf *` with a root in the cwd, and every command
 * whose cwd is inside a root, are refused because they do reach the store.
 */
export function shellBypass(command: string, check: BypassCheck): Bypass | undefined {
  const store = blockedStoreCommand(command, check.stores ?? STORE_COMMANDS);
  if (store !== undefined) return { command, store };
  const path = { command, store: check.rootStore, route: "path" as const };
  const words = pathCheckWords(command);
  for (const unc of command.matchAll(
    /[\\/]{2}(?:localhost|127\.0\.0\.1|\?|\.)[\\/][a-zA-Z][$:][^\s'"|;&<>()]*/gi,
  ))
    if (uncDrivePath(unc[0]) !== undefined) words.push(unc[0]);
  for (const word of words) {
    if (reaches(word, check, false)) return path;
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
    if (reaches(path, check, recursive)) {
      const shown = path === undefined ? `${toolName} (no path, the cwd)` : `${toolName} ${path}`;
      return { command: shown, store: check.rootStore, route: "path" };
    }
  }
  return undefined;
}
