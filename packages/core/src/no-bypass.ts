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
  /**
   * The shell that reads the command: `posix` (bash, sh: a backslash
   * escapes), or `powershell` or `cmd`, where a backslash is a path separator
   * on every platform, pwsh on Linux included. Default `posix`.
   */
  shell?: ShellFlavor;
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
 * The words of a shell command for the path check. Cut at unquoted whitespace
 * first; every piece of every token, quoted or not, is checked (review
 * finding R3-16: a quoted string can be a script run by `eval`, `bash <<<`,
 * a pipe into a shell, `iex`, `python -c` or `node -e`). An unquoted newline
 * ends a list segment as `;` does (R3-23). A shell's script argument
 * (`bash -c`, `pwsh -Command`, `cmd /c`) and a PowerShell encoded command are
 * checked as nested commands.
 *
 * The one exception, as small as it can be made (R3-15 to R3-25): a commit
 * message is read as one word, with only its path-like words checked, when
 * all of these hold: it is wholly single-quoted (`-m '...'`, `--message
 * '...'` or `--message='...'`), since single quotes never expand, so nothing
 * inside can run; the tool (git, hg, svn, jj, bzr) is in command position;
 * and its subcommand is a built-in that takes a message (VCS_MESSAGE_COMMANDS),
 * never an alias, which can evaluate its arguments.
 */
/** How a shell reads a backslash in a word. */
export type ShellFlavor = "posix" | "powershell" | "cmd";

function pathCheckWords(
  command: string,
  depth = 0,
  quotedAbove = true,
  flavor: ShellFlavor = "posix",
): string[] {
  // R3-26: single quotes do not stop an outer shell expanding first. A
  // message is exempt only when every enclosing script argument was itself
  // wholly single-quoted (`quotedAbove`), and never in a command holding a
  // heredoc of any kind (R3-27), whose body the shell may expand.
  const exemptable = quotedAbove && !HEREDOC.test(command);
  // Each token keeps its text after quote removal, whether it held quoted
  // whitespace, the quoting of each character (`s` single, `d` double, `u`
  // none), and whether it ends a list or pipeline segment (an unquoted `;`,
  // `&` or `|` at its end, or an unquoted newline after it).
  const tokens: { text: string; spaced: boolean; modes: string; ends: boolean }[] = [];
  let text = "";
  let modes = "";
  let spaced = false;
  let quote: string | undefined;
  const flush = (newline = false) => {
    if (text !== "")
      tokens.push({
        text,
        spaced,
        modes,
        ends: newline || (modes.endsWith("u") && /[;&|]$/.test(text)),
      });
    else if (newline && tokens.length > 0) (tokens.at(-1) as { ends: boolean }).ends = true;
    text = "";
    modes = "";
    spaced = false;
  };
  for (let i = 0; i < command.length; i++) {
    const c = command[i] as string;
    if (quote !== undefined) {
      if (c === quote) quote = undefined;
      else {
        if (/\s/.test(c)) spaced = true;
        text += c;
        modes += quote === "'" ? "s" : "d";
      }
    } else if (c === "'" || c === '"') quote = c;
    else if (c === "\\" && command[i + 1] === "\n") i++;
    else if (c === "\\" && /\s/.test(command[i + 1] ?? "")) {
      text += command[i + 1];
      modes += "d";
      i++;
    } else if (c === "\n") flush(true);
    else if (/\s/.test(c)) flush();
    else {
      text += c;
      modes += "u";
    }
  }
  flush();
  let shell: "sh" | "pwsh" | "cmd" | undefined;
  let next: "script" | "encoded" | "message" | "option-arg" | undefined;
  /** The VCS tool in command position, until its subcommand is known. */
  let tool: string | undefined;
  /** The subcommand words seen after the tool, options skipped. */
  let subcommand: string[] = [];
  /** The tool and subcommand take a message. */
  let messages = false;
  /** The next token is in command position: first in its segment, or after a wrapper. */
  let atCommand = true;
  let wrapperArg = false;
  return tokens.flatMap(({ text: t, spaced: s, modes: m, ends }) => {
    const words = () => {
      const out = commandWords(t).flatMap((w) => {
        // `rev:path` (git show HEAD:memory/a.md) names a path after its first colon (R3-21).
        const colon = w.indexOf(":");
        return [w, ...w.split("=").slice(1), ...(colon > 0 ? [w.slice(colon + 1)] : [])];
      });
      // And after the last colon of the raw token, before brace expansion
      // (`:memory/a.md`, `:0:memory/a.md`, `stash@{0}:memory/a.md`: R3-25).
      const last = t.lastIndexOf(":");
      const all = last >= 0 ? [...out, t.slice(last + 1)] : out;
      // PowerShell and cmd read `\` as a path separator whatever the
      // platform, so `memory\a.md` is `memory/a.md` to pwsh on Linux too.
      return flavor === "posix" ? all : all.map((w) => w.replaceAll("\\", "/"));
    };
    const pending = next;
    next = undefined;
    const commandPosition = atCommand;
    atCommand = false;
    const finish = (out: string[]) => {
      if (ends || /^(?:;|&&|\|\||\||&)$/.test(t)) {
        shell = undefined;
        tool = undefined;
        messages = false;
        atCommand = true;
      }
      return out;
    };
    if (pending === "script") {
      const inner: ShellFlavor =
        shell === "pwsh" ? "powershell" : shell === "cmd" ? "cmd" : "posix";
      // `bash -c -- "..."`: the end of options comes before the script.
      if (t === "--") {
        next = "script";
        return finish([]);
      }
      shell = undefined;
      return finish(pathCheckWords(t, depth + 1, exemptable && /^s+$/.test(m), inner));
    }
    if (pending === "encoded") {
      shell = undefined;
      const decoded = decodePowerShell(t);
      return finish(
        decoded === undefined
          ? words()
          : [...words(), ...pathCheckWords(decoded, depth + 1, false, "powershell")],
      );
    }
    const pathLike = (out: string[]) => out.filter((w) => /[\\/]|^~|^\./.test(w));
    if (exemptable && pending === "message" && /^s+$/.test(m)) return finish(pathLike(words()));
    if (exemptable && messages && /^--message=/i.test(t) && /^u{10}s+$/.test(m))
      return finish(pathLike(words()));
    if (pending === "option-arg") return finish(words());
    const name = (t.split(/[\\/]/).pop() ?? "").toLowerCase().replace(/\.exe$/, "");
    if (tool !== undefined && !messages) {
      // The subcommand: the first non-option words after the tool, skipping
      // `-c key=val` and `-C dir` pairs (R3-24).
      if (/^-[cC]$/.test(t)) next = "option-arg";
      else if (!/^-/.test(t)) {
        subcommand.push(t);
        const verdict = takesMessage(tool, subcommand);
        if (verdict === false) tool = undefined;
        else if (verdict === true) messages = true;
      }
      return finish(words());
    }
    if (commandPosition && !s) {
      if (wrapperArg) {
        wrapperArg = false;
        atCommand = true;
      } else if (
        WRAPPERS.has(name) ||
        /^[A-Za-z_][A-Za-z0-9_]*=/.test(t) ||
        (/^-/.test(t) && t !== "-")
      ) {
        // env NAME=value, sudo -u, timeout 5, nohup ...: the command follows.
        atCommand = true;
        wrapperArg = name === "timeout";
      }
    }
    if (SH_SHELLS.has(name) && !s) shell = "sh";
    else if ((name === "pwsh" || name === "powershell") && !s) shell = "pwsh";
    else if (name === "cmd" && !s) shell = "cmd";
    else if (VCS.has(name) && !s && commandPosition) {
      tool = name;
      subcommand = [];
    } else if (
      (shell === "sh" && /^-[a-z]*c$/i.test(t)) ||
      (shell === "pwsh" && /^-(?:c|command)$/i.test(t)) ||
      (shell === "cmd" && /^\/[ck]$/i.test(t))
    )
      next = depth < MAX_NESTING ? "script" : undefined;
    else if (shell === "pwsh" && isEncodedFlag(t))
      next = depth < MAX_NESTING ? "encoded" : undefined;
    else if (messages && MESSAGE_FLAGS.has(t)) next = "message";
    // Every other word, quoted or not, is checked (R3-16: err towards blocking).
    return finish(words());
  });
}

/**
 * A heredoc, whatever its delimiter (`<<EOF`, `<<-EOF`, `<<!`, `<<.`,
 * `<<$X`, `<<'EOF'`): any `<<` that is not part of a here-string `<<<`.
 * Telling an expanding delimiter from a quoted one proved error-prone
 * (R3-27), so no heredoc keeps the message exemption.
 */
const HEREDOC = /(?<!<)<<(?!<)/;
/** Commands that run the command after them, so it is still in command position (R3-20). */
const WRAPPERS = new Set([
  "env",
  "sudo",
  "xargs",
  "nohup",
  "time",
  "timeout",
  "command",
  "exec",
  "nice",
  "doas",
]);
/** Version-control tools whose built-in commit commands take a `-m`/`--message`. */
const VCS = new Set(["git", "hg", "svn", "jj", "bzr"]);
/**
 * The built-in subcommands that take a message, per tool, as word sequences
 * (`git stash push`). Anything else, an alias included, gets no exemption.
 */
const VCS_MESSAGE_COMMANDS: Readonly<Record<string, readonly (readonly string[])[]>> = {
  git: [["commit"], ["tag"], ["merge"], ["notes"], ["stash", "push"], ["stash", "save"]],
  hg: [["commit"], ["tag"]],
  svn: [["commit"], ["ci"]],
  jj: [["commit"], ["describe"], ["new"]],
  bzr: [["commit"]],
};

/** true when `words` is a message-taking subcommand, false when it cannot become one, else undefined. */
function takesMessage(tool: string, words: readonly string[]): boolean | undefined {
  const forms = (VCS_MESSAGE_COMMANDS[tool] ?? []).filter((f) => words.every((w, i) => f[i] === w));
  if (forms.some((f) => f.length === words.length)) return true;
  return forms.length > 0 ? undefined : false;
}

/** The message flags of those subcommands. */
const MESSAGE_FLAGS = new Set(["-m", "--message"]);
/** Whether a PowerShell argument is a prefix of `-EncodedCommand` (or its `-ec` alias). */
function isEncodedFlag(token: string): boolean {
  const flag = token.toLowerCase();
  return flag === "-ec" || (flag.length >= 2 && "-encodedcommand".startsWith(flag) && flag !== "-");
}

/** A PowerShell encoded command (base64 of UTF-16LE) as text, or undefined. */
export function decodePowerShell(encoded: string): string | undefined {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return undefined;
  const text = Buffer.from(encoded, "base64").toString("utf16le");
  return text.length > 0 ? text : undefined;
}

/** Shells whose `-c` argument is a script. */
const SH_SHELLS = new Set(["sh", "bash", "zsh", "dash", "ksh", "ash", "fish"]);
/** How deep `bash -c "bash -c ..."` is followed. */
const MAX_NESTING = 8;

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
  // A store's CLI inside a PowerShell encoded command (R3-17).
  for (const m of command.matchAll(/\s-(e|ec|en[a-z]*)\s+["']?([A-Za-z0-9+/]{8,}={0,2})/gi)) {
    if (!isEncodedFlag(`-${m[1]}`)) continue;
    const decoded = decodePowerShell(m[2] as string);
    const inner = decoded && blockedStoreCommand(decoded, check.stores ?? STORE_COMMANDS);
    if (inner) return { command, store: inner };
  }
  const path = { command, store: check.rootStore, route: "path" as const };
  const words = pathCheckWords(command, 0, true, check.shell ?? "posix");
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
