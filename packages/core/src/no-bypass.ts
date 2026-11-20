// No-bypass decisions (ADR 0014, decision D10): whether a shell command or a
// tool call would reach a store without the Plane. They decide, so they live
// in core (AGENTS.md rule 1; plan docs/tasks/gate-b-plan.md decision 6), and
// every surface that intercepts tool calls asks here: the pi extension
// (user_bash and tool_call) and the Claude Code hook (`engram hook
// claude-code`, a PreToolUse hook). The surface records what it blocks with
// Plane.recordBypass. The text and path rules and their limits are in
// no-bypass/shell.ts and no-bypass/paths.ts.
import { homedir } from "node:os";
import { resolve, sep } from "node:path";
import {
  ancestorOfRoot,
  expandHome,
  LOOPBACK_HOST,
  storeRootOf,
  toolPaths,
  uncDrivePath,
} from "./no-bypass/paths.ts";

/**
 * A loopback share or a device path inside a shell command, for shellBypass:
 * the spellings uncDrivePath maps, with or without the device namespace's
 * `\\?\UNC\` or `\\.\UNC\` (card RV3, RV-ADP-7). Any run of separators
 * stands for one, and the share's `$` may be escaped (`\$`), because a posix
 * shell reads `\\` as one backslash: the command text that reaches
 * `\\localhost\C$\x` from Git Bash, Claude Code's Bash tool on Windows, is
 * `\\\\localhost\\C$\\x` (review fix pass, RV3-2).
 */
const UNC_WORD = new RegExp(
  String.raw`[\\/]{2,}(?:[?.][\\/]+unc[\\/]+)?(?:${LOOPBACK_HOST}|\?|\.)[\\/]+[a-zA-Z]\\*[$:][^\s'"|;&<>()]*`,
  "gi",
);

/** A UNC_WORD match as the path it names: `\\` first, one `\` per run of separators, `\$` as `$`. */
const asUncPath = (word: string) =>
  `\\\\${word
    .replace(/^[\\/]+/, "")
    .replace(/\\+\$/, () => "$")
    .replace(/[\\/]+/g, "\\")}`;

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
  for (const unc of command.matchAll(UNC_WORD)) {
    const word = asUncPath(unc[0]);
    if (uncDrivePath(word) !== undefined) words.push(word);
  }
  // A protected file's folders are judged by ancestorOfRoot, below the given
  // folders only (R3-13), so a walk over the project is no hit for them.
  const recursive = check.ancestorsBelow === undefined && walksTree(words);
  for (const cwd of workingDirs(command, check)) {
    const at = { ...check, cwd };
    for (const word of words) {
      if (reaches(word, at, recursive)) return path;
      if (globReachesRoot(word, cwd, check.roots)) return path;
    }
  }
  return undefined;
}

/**
 * Quoting a shell removes inside a command name: a backslash or a pair of
 * quotes between its letters (`\cd`, `"cd"`, `c''d`) runs the same command
 * (review finding RV7-R3 of PR #61).
 */
const NAME_QUOTES = String.raw`[\\'"]*`;
/** A command name as a pattern that admits NAME_QUOTES around and between its letters. */
const quotedName = (name: string) =>
  `${NAME_QUOTES}${[...name].map((c) => (c === "-" ? "\\-" : c)).join(NAME_QUOTES)}${NAME_QUOTES}`;
/** Commands that change the folder later words are read from: `cd`, `pushd`, and their PowerShell and cmd names. */
const CD_WORD = `(?:${["cd", "pushd", "chdir", "set-location", "push-location", "sl"]
  .map(quotedName)
  .join("|")})`;
/** Where a command word may start in the raw text: its start, after a separator, a quote, a backtick or a paren. */
const CD_START = String.raw`(?:^|[\s;&|("'\x60])`;
/** One shell word as written: double-quoted, single-quoted, or a run up to a separator. */
const RAW_WORD = String.raw`("[^"]*"|'[^']*'|[^\s;&|()"'\x60]+)`;
/** Options before a `cd` target: `-P`, the end of options `--`, cmd's `/d`. */
const CD_OPTIONS = String.raw`(?:(?:-[A-Za-z]+|--|/d)\s+)*`;
/** `cd dir`, options skipped: the target is the group. */
const CD_TARGET = new RegExp(String.raw`${CD_START}${CD_WORD}\s+${CD_OPTIONS}${RAW_WORD}`, "gi");
/** A bare `cd`, which goes to the home folder. */
const CD_HOME = new RegExp(String.raw`${CD_START}${CD_WORD}(?=\s*(?:$|[;&|)\n]))`, "gi");
/** One `cd dir &&` at the very start of the text: every later word runs in `dir` or not at all (RV7-R7). */
const LEADING_CD = new RegExp(String.raw`^\s*${CD_WORD}\s+${CD_OPTIONS}${RAW_WORD}\s*&&`, "i");
/**
 * `-C dir` and `-Cdir` (git, make, tar, env), `--directory dir` or
 * `--directory=dir` (make, tar), and `--chdir dir` or `--chdir=dir` (env).
 */
const DIR_OPTION = new RegExp(
  String.raw`\s(?:-C(?:=|\s*)|--directory(?:=|\s+)|--chdir(?:=|\s+))${RAW_WORD}`,
  "g",
);
/**
 * A single-quoted `-m` or `--message` of a version-control tool in command
 * position (first in its segment, after wrappers and assignments): a message
 * that never runs, so a `cd` inside it moves nothing. Anywhere else, as in
 * `bash -c -m '...'`, the quoted text may be a script (RV7-R3).
 */
const VCS_MESSAGE =
  /((?:^|[;&|\n(])\s*(?:[\w./=-]+\s+)*?(?:git|hg|svn|jj|bzr)(?:\.exe)?\s[^;&|\n']*?)(?:-m|--message)(?:=|\s+)'[^']*'/gi;
/** How many folders one command may be read from, at most. */
const MAX_DIRS = 32;

/** A folder a `cd` names, with no expansion left for the shell (`$`, a backtick, a glob). */
const literalDir = (dir: string) => dir !== "-" && !/[$\x60*?[\]{}]/.test(dir);
const unquote = (word: string) => word.replace(/^["']|["']$/g, "");

/**
 * Whether every word of `rest` runs only after the commands before it
 * succeeded: it holds no `;`, `||`, single `&` or newline outside quotes.
 * Pipes and `&&` are fine, and so are the `&` of a redirection (`2>&1`,
 * `&>`) and of `|&`. A double-quoted string holding `$(` or a backtick runs
 * a script, so it counts as holding a separator; inside single quotes
 * nothing runs. Errs towards false (RV7-R7b).
 */
function joinedByAndOnly(rest: string): boolean {
  for (let i = 0; i < rest.length; i++) {
    const c = rest[i] as string;
    if (c === "\\" || c === "`") {
      // an escaped separator is read as a separator; a backtick is a substitution or a PowerShell escape
      if (c === "`") return false;
      const next = rest[i + 1];
      if (next === ";" || next === "&" || next === "|") return false;
      i++;
    } else if (c === "'") {
      const end = rest.indexOf("'", i + 1);
      if (end < 0) return false;
      i = end;
    } else if (c === '"') {
      let j = i + 1;
      for (; j < rest.length && rest[j] !== '"'; j++) {
        if (rest[j] === "\\") j++;
        else if (rest[j] === "`" || (rest[j] === "$" && rest[j + 1] === "(")) return false;
      }
      if (j >= rest.length) return false;
      i = j;
    } else if (c === ";" || c === "\n" || c === "\r") {
      return false;
    } else if (c === "|") {
      if (rest[i + 1] === "|") return false;
      if (rest[i + 1] === "&") i++;
    } else if (c === "&") {
      if (rest[i + 1] === "&") i++;
      else if (rest[i - 1] === ">" || rest[i - 1] === "<" || rest[i + 1] === ">") continue;
      else return false;
    }
  }
  return true;
}

/**
 * Every folder a word of `command` may be resolved against (card RV7, core
 * review finding RV-CORE-5; review fix pass of PR #61, RV7-R3 and R7): the
 * cwd, and every folder a `cd`, `pushd`, `Push-Location`, `-C`,
 * `--directory` or `--chdir` in it names, each resolved against the cwd and
 * every folder named before it, so `cd .. && cat mem/a.md` and `cd /a; cd b`
 * are followed; a bare `cd` adds the home folder. The text is read as
 * written, quotes and nested scripts included, erring towards blocking: a
 * word is checked against folders the command may never enter. One
 * narrowing: a chain of literal `cd dir &&` at the very start of the command
 * replaces the cwd when everything after it is joined by `&&` and pipes alone
 * (so every later word runs there or not at all), and `cd src && grep -r TODO .`
 * is judged in `src` alone; after a `;`, `||`, a single `&` or a newline a word
 * runs in the old folder if the `cd` failed, so the cwd stays.
 */
function workingDirs(command: string, check: BypassCheck): string[] {
  const home = check.home ?? homedir();
  let text = command;
  for (let before = ""; before !== text; ) {
    before = text;
    text = text.replace(VCS_MESSAGE, "$1 ");
  }
  const resolveIn = (base: string, dir: string) => resolve(base, expandHome(dir, home) ?? dir);
  let dirs = [check.cwd];
  let moved: string | undefined;
  let rest = text;
  for (let m = LEADING_CD.exec(rest); m; m = LEADING_CD.exec(rest)) {
    const dir = unquote(m[1] as string);
    if (!literalDir(dir)) break;
    moved = resolveIn(moved ?? check.cwd, dir);
    rest = rest.slice(m[0].length);
  }
  // The chain moves the later words only when each runs after the `cd`
  // succeeded: joined by `&&` and pipes alone (RV7-R7b of the second review
  // pass). After `;`, `||`, a single `&` or a newline a word still runs in the
  // old folder when the `cd` failed.
  if (moved !== undefined && joinedByAndOnly(rest)) dirs = [moved];
  const named: { at: number; dir: string }[] = [];
  for (const re of [CD_TARGET, DIR_OPTION])
    for (const m of text.matchAll(re))
      named.push({ at: m.index ?? 0, dir: unquote(m[1] as string) });
  for (const m of text.matchAll(CD_HOME)) named.push({ at: m.index ?? 0, dir: home });
  named.sort((a, b) => a.at - b.at);
  for (const { dir } of named) {
    for (const base of [...dirs]) {
      if (dirs.length >= MAX_DIRS) break;
      const next = resolveIn(base, dir);
      if (!dirs.includes(next)) dirs.push(next);
    }
  }
  return dirs;
}

/** Commands that always walk the trees their paths name. */
const WALKERS = new Set(["find", "rg", "ag", "ack", "fd", "tree", "du", "tar", "rsync"]);
/**
 * Commands that walk a tree under a flag, with the short flag letters that
 * make them do so (PowerShell's `-r` included); the long forms
 * `--recursive`, `-Recurse` (any prefix of at least `-rec`) and cp's
 * `--archive` count too.
 */
const WALK_FLAGS: Readonly<Record<string, string>> = {
  grep: "rR",
  egrep: "rR",
  fgrep: "rR",
  cp: "rRa",
  scp: "r",
  rm: "rR",
  ls: "R",
  chmod: "R",
  chown: "R",
  chgrp: "R",
  zip: "r",
  diff: "r",
  "get-childitem": "r",
  gci: "r",
  dir: "r",
  "remove-item": "r",
  "copy-item": "r",
};

/**
 * Whether `command`'s words include a command that walks a directory tree
 * (RV-CORE-5): then every word is also a hit when a root lies inside the
 * folder it names (`grep -r x ~`, `find .. -name a.md`, `cp -r ~ /tmp`), as
 * for pi's grep and find tools. Judged over the whole command, not per
 * segment, erring towards blocking. A walk with no path, from the folder
 * holding a root (`find`, `rg x`), is not seen: ADR 0014's stated limit.
 */
function walksTree(words: readonly string[]): boolean {
  const names = words.map((w) =>
    (w.split(/[\\/]/).pop() ?? "").toLowerCase().replace(/\.exe$/, ""),
  );
  if (names.some((n) => WALKERS.has(n))) return true;
  const flagged = names.filter((n) => WALK_FLAGS[n] !== undefined);
  if (flagged.length === 0) return false;
  return words.some((w) => {
    if (/^--(?:recursive|archive)$/i.test(w) || /^-rec(?:u(?:r(?:s(?:e)?)?)?)?$/i.test(w))
      return true;
    if (!/^-[A-Za-z]+$/.test(w)) return false;
    return flagged.some((n) => [...(WALK_FLAGS[n] as string)].some((l) => w.includes(l)));
  });
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
