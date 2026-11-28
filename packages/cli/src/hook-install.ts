// `engram hook install claude-code|codex` (card E8.17): merges the hook's
// PreToolUse entry into the one settings file the harness reads, idempotently.
// The idea is obsidian-second-brain's installer (MIT, idea only): it merges
// into what is there, keeps every other entry, and knows its own entries by
// their command strings, so a second run replaces rather than duplicates.
//
// The file: Claude Code's `<project>/.claude/settings.json`, or with --user
// `~/.claude/settings.json` (./harness-settings.ts); Codex's
// `<project>/.codex/hooks.json`, or with --user `$CODEX_HOME/hooks.json`
// (core's codexHomeOf, the location table `engram discover` walks). Codex
// also reads hooks from a `[hooks]` table in config.toml; the installer
// writes only hooks.json, which Codex merges with it (a warning in Codex when
// both hold hooks), and never edits TOML.
//
// What it writes: that one file (through a temporary name beside it,
// renamed over it), its folder when missing, and, when it changes a file
// that existed, one backup beside it named by the old content's sha256
// (`settings.json.engram-backup-<12 hex>`), never overwritten. A folder or
// backup path that is a link is refused. The entry protects the file it is
// installed into, and for Codex the config.toml beside it, with --protect. Nothing else. A run whose merge equals the file's JSON writes
// nothing at all, a backup included. It refuses, writing nothing, a file
// that is a link, is not a regular file, is not JSON, or is JSON whose
// `hooks` or `hooks.PreToolUse` has another shape.
//
// The entry (decided by ../tui/snippets.ts, the shape the TUI's setup screens
// show): `matcher` "*", the command (`engram`, else this node and main.ts,
// with the reason), every path flag absolute against the project, and
// `onFailure` "block", so a hook that cannot run blocks the call (Claude Code
// v2.1.295 and later; Codex's HookFailurePolicy at openai/codex ebd0765aafa2).
// Claude Code takes a command and an args list; Codex takes one command
// line, run by `sh -lc` (POSIX quoting) or, on Windows, `cmd.exe /c`
// (`commandWindows`, written only when its quoting differs). Nothing here is
// policy: the hook's decisions are core's.
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { HookHarness } from "@engram/mcp";
import { parse } from "./commands.ts";
import { codexHome, HARNESSES, userSettingsPath } from "./harness-settings.ts";
import { OPTIONS } from "./registry.ts";
import type { Io } from "./run.ts";
import { UsageError } from "./setup.ts";
import {
  absolutePaths,
  codexHookCommand,
  hookCommand,
  type Launch,
  resolveLaunch,
  thisHost,
} from "./tui/snippets.ts";

/** Where the entry goes: the settings file the harness reads, project or user. */
export function installTarget(
  harness: HookHarness,
  where: { user?: boolean; project: string },
  io: Pick<Io, "cwd" | "home" | "env">,
): string {
  if (harness === "codex")
    return where.user === true
      ? join(codexHome(io), "hooks.json")
      : join(where.project, ".codex", "hooks.json");
  return where.user === true
    ? userSettingsPath(io.home)
    : join(where.project, ".claude", "settings.json");
}

/** One hook handler of a settings file, as far as the installer reads it. */
type Handler = Record<string, unknown>;
type Group = { matcher?: unknown; hooks?: unknown } & Record<string, unknown>;

/** The handler the installer writes for a harness: the TUI's setup screens show the same. */
export const hookEntry = (
  harness: HookHarness,
  launch: Launch,
  argv: readonly string[],
): Handler => (harness === "codex" ? codexHookCommand(launch, argv) : hookCommand(launch, argv));

/**
 * Whether a handler is one an installer of this harness wrote, by its
 * command strings: `engram` or a main.ts, then the words `hook <harness>`.
 */
export function isOwnHandler(harness: HookHarness, handler: unknown): boolean {
  if (handler === null || typeof handler !== "object") return false;
  const h = handler as Handler;
  const words = [h.command, h.commandWindows, ...(Array.isArray(h.args) ? h.args : [])].filter(
    (w): w is string => typeof w === "string",
  );
  const text = words.join(" ");
  const named = new RegExp(`(?:^|[\\s"'/\\\\])hook["']?\\s+["']?${harness}(?:$|["'\\s])`);
  return (
    /(?:^|[\s"'/\\])(?:engram(?:\.exe|\.cmd)?|main\.ts)["']?(?:\s|$)/.test(text) && named.test(text)
  );
}

export interface Merge {
  /** The settings as they will be written. */
  next: Record<string, unknown>;
  /** How many earlier entries of this installer it took out. */
  replaced: number;
}

/** Thrown for a file the installer will not edit; nothing is written. */
export class InstallRefusal extends Error {}

const isObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * The settings with the entry merged in: every earlier handler of this
 * installer taken out of hooks.PreToolUse (a group it leaves empty dropped),
 * then one group `{ matcher: "*", hooks: [entry] }` where the first of them
 * stood, else at the end. Every other key, group and handler is kept as it is.
 */
export function mergeEntry(
  harness: HookHarness,
  current: unknown,
  entry: Handler,
  file: string,
): Merge {
  if (!isObject(current)) throw new InstallRefusal(`${file} is not a JSON object`);
  const hooks = current.hooks ?? {};
  if (!isObject(hooks)) throw new InstallRefusal(`${file}: hooks is not an object`);
  const pre = hooks.PreToolUse ?? [];
  if (!Array.isArray(pre)) throw new InstallRefusal(`${file}: hooks.PreToolUse is not a list`);
  let replaced = 0;
  let at: number | undefined;
  const kept: unknown[] = [];
  for (const group of pre as unknown[]) {
    if (!isObject(group) || !Array.isArray((group as Group).hooks)) {
      kept.push(group);
      continue;
    }
    const handlers = (group as Group).hooks as unknown[];
    const others = handlers.filter((h) => !isOwnHandler(harness, h));
    const own = handlers.length - others.length;
    if (own === 0) {
      kept.push(group);
      continue;
    }
    replaced += own;
    at ??= kept.length;
    if (others.length > 0) kept.push({ ...group, hooks: others });
  }
  const ours = { matcher: "*", hooks: [entry] };
  kept.splice(at ?? kept.length, 0, ours);
  return { next: { ...current, hooks: { ...hooks, PreToolUse: kept } }, replaced };
}

/** Structural equality of two JSON values, key order ignored. */
function sameJson(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => sameJson(x, b[i]));
  }
  if (isObject(a) && isObject(b)) {
    const ka = Object.keys(a);
    if (ka.length !== Object.keys(b).length) return false;
    return ka.every((k) => Object.hasOwn(b, k) && sameJson(a[k], b[k]));
  }
  return a === b;
}

export interface Installed {
  file: string;
  /** False when the file already held exactly this entry: nothing was written. */
  changed: boolean;
  /** The backup written beside the file, when it existed and changed. */
  backup: string | undefined;
  replaced: number;
  created: boolean;
}

/** The backup's name: the old content's sha256, so a later run never overwrites it with other bytes. */
export const backupPath = (file: string, before: string) =>
  `${file}.engram-backup-${createHash("sha256").update(before).digest("hex").slice(0, 12)}`;

/** The path's own lstat (a link is not followed), or undefined when there is nothing there. */
const lstatOf = (path: string) => {
  try {
    return lstatSync(path);
  } catch {
    return undefined;
  }
};

/**
 * Merges the entry into `file`, writing only the file, its folder and one
 * backup, and only on a change. The folder (`.claude`, `.codex` or the
 * Codex home) and the backup path must not be links, so no write follows
 * one out of the named files (card E8.17's review); the file is written to
 * a temporary name beside it and renamed over it, so a crash leaves the old
 * file or the new one, never half of one.
 */
export function installInto(harness: HookHarness, file: string, entry: Handler): Installed {
  let before: string | undefined;
  const folder = lstatOf(dirname(file));
  if (folder?.isSymbolicLink() === true)
    throw new InstallRefusal(
      `${dirname(file)} is a link; the installer writes only into a real folder`,
    );
  if (folder !== undefined && !folder.isDirectory())
    throw new InstallRefusal(`${dirname(file)} is not a folder`);
  const stat = lstatOf(file);
  if (stat !== undefined) {
    if (stat.isSymbolicLink())
      throw new InstallRefusal(`${file} is a link; the installer edits only a regular file`);
    if (!stat.isFile()) throw new InstallRefusal(`${file} is not a regular file`);
    before = readFileSync(file, "utf8");
  }
  let current: unknown = {};
  if (before !== undefined && before.trim() !== "") {
    try {
      current = JSON.parse(before);
    } catch (e) {
      throw new InstallRefusal(
        `${file} is not JSON (${e instanceof Error ? e.message : String(e)}); fix it or move it aside`,
      );
    }
  }
  const { next, replaced } = mergeEntry(harness, current, entry, file);
  if (before !== undefined && sameJson(current, next))
    return { file, changed: false, backup: undefined, replaced: 0, created: false };
  let backup: string | undefined;
  if (before !== undefined) {
    backup = backupPath(file, before);
    const held = lstatOf(backup);
    if (held?.isSymbolicLink() === true || (held !== undefined && !held.isFile()))
      throw new InstallRefusal(`${backup} is a link or not a regular file; move it aside`);
    // Named by the old content's hash: a backup already there holds these bytes.
    if (held === undefined) writeFileSync(backup, before, { encoding: "utf8", flag: "wx" });
  } else mkdirSync(dirname(file), { recursive: true });
  const temp = `${file}.engram-${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  try {
    renameSync(temp, file);
  } catch (e) {
    rmSync(temp, { force: true });
    throw e;
  }
  return { file, changed: true, backup, replaced, created: before === undefined };
}

/** The hook flags an entry carries, in the hook's own spelling. */
const CARRIED = [
  "root",
  "protect",
  "as",
  "db",
  "policy",
  "server",
  "otlp",
  "export-jsonl",
] as const;

export async function installCommand(args: string[], io: Io, launch?: Launch): Promise<number> {
  const { values, positionals } = parse(args, OPTIONS["hook install"], true);
  const [named, ...rest] = positionals;
  if (named === undefined || rest.length > 0 || !(HARNESSES as readonly string[]).includes(named))
    throw new UsageError(`give the harness: engram hook install ${HARNESSES.join(" | ")}`);
  const harness = named as HookHarness;
  const project = resolve(io.cwd, values.project ?? ".");
  const argv: string[] = ["hook", harness];
  for (const flag of CARRIED) {
    const v = values[flag];
    if (Array.isArray(v)) for (const one of v) argv.push(`--${flag}`, one);
    else if (typeof v === "string") argv.push(`--${flag}`, v);
  }
  const file = installTarget(harness, { user: values.user === true, project }, io);
  // The hook guards the file it is installed into, and for Codex the config.toml beside it,
  // wherever Codex starts the session (card E8.17's review: a session in a subfolder).
  const guard = [file, ...(harness === "codex" ? [join(dirname(file), "config.toml")] : [])];
  const given = new Set((values.protect ?? []).map((f) => resolve(project, f)));
  for (const f of guard) if (!given.has(f)) argv.push("--protect", f);
  const words = absolutePaths(argv, project);
  const how = launch ?? resolveLaunch(thisHost(io.env));
  let done: Installed;
  try {
    done = installInto(harness, file, hookEntry(harness, how, words));
  } catch (e) {
    if (!(e instanceof InstallRefusal)) throw e;
    io.err(`engram hook install: ${e.message}; nothing was written\n`);
    return 1;
  }
  if (how.note !== undefined) io.out(`${how.note}\n`);
  if (!done.changed) {
    io.out(`unchanged: ${file} already holds this hook; nothing was written\n`);
    return 0;
  }
  const said = [
    `installed: ${file} ${done.created ? "created with" : "now holds"} the engram hook ${harness} entry in hooks.PreToolUse`,
  ];
  if (done.replaced > 0)
    said.push(
      `replaced ${done.replaced} earlier engram hook ${harness} ${done.replaced === 1 ? "entry" : "entries"}`,
    );
  if (done.backup !== undefined) said.push(`the file as it was is in ${done.backup}`);
  io.out(`${said.join("; ")}\n`);
  if (harness === "codex")
    io.out(
      "Codex runs a hook only once you trust it, at the project or the user level alike, and again after each change to the entry: review it in /hooks.\n",
    );
  return 0;
}
