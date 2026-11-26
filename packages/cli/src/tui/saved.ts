// The saved workspace (card E8.15b, docs/design/tui.md 8.3): <home>/.engram/
// tui.json, beside the default log and never in a project. It holds the
// workspace flags and the TUI's own options, and nothing else: never memory
// content, an item or read id, a token, a key, a password, or a URL's
// credentials. A postgres:// log is never saved, not even redacted (the
// lead's decision in the review fix pass, finding I5): the person sets
// ENGRAM_DB_URL, which then wins, or enters it again; a server or OTLP URL
// is saved without its userinfo and query. Written with the user's
// permissions only (0600 where the system has them).
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** The workspace flags tui.json may hold (8.3). */
export const SAVED_FLAGS = [
  "server",
  "db",
  "policy",
  "store",
  "root",
  "owner",
  "import-valid-from",
  "as",
  "level",
  "member",
  "otlp",
  "export-jsonl",
  "keys",
] as const;
export type SavedFlag = (typeof SAVED_FLAGS)[number];

/** The TUI's own options tui.json may hold (8.3). */
export const SAVED_OPTIONS = ["ascii", "contrast", "motion", "mouse", "line"] as const;

export interface SavedOptions {
  ascii?: boolean;
  contrast?: "high";
  motion?: "reduce";
  mouse?: boolean;
  line?: boolean;
}

export interface Saved {
  flags: Partial<Record<SavedFlag, string | string[]>>;
  options: SavedOptions;
}

/** The format's version, the file's first key. */
const VERSION = 1;

/** A Postgres log's URL, which tui.json never holds. */
export const isPostgres = (db: string) => /^postgres(ql)?:\/\//i.test(db);

/** What the TUI says when it saves a workspace whose log is a Postgres URL. */
export const POSTGRES_NOT_SAVED =
  "not saved: contains credentials; set ENGRAM_DB_URL or re-enter it";

export const savedPath = (home: string) => join(home, ".engram", "tui.json");

const isFlag = (k: string): k is SavedFlag => (SAVED_FLAGS as readonly string[]).includes(k);

/** A value fit to save: printable, one line (no control character). */
const printable = (v: string) =>
  v !== "" &&
  [...v].every((ch) => {
    const c = ch.codePointAt(0) ?? 0;
    return c >= 32 && c !== 127;
  });

/** A URL with its userinfo and query removed; the value unchanged when it is not a URL. */
function withoutCredentials(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return value;
  }
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  return url.href;
}

/** One flag's value as tui.json keeps it, or undefined when it may not be kept. */
function keep(flag: SavedFlag, value: unknown): string | string[] | undefined {
  if (flag === "member") {
    if (!Array.isArray(value)) return undefined;
    const list = value.filter((v): v is string => typeof v === "string" && printable(v));
    return list.length === value.length && list.length > 0 ? list : undefined;
  }
  if (typeof value !== "string" || !printable(value)) return undefined;
  if (flag === "db" && isPostgres(value)) return undefined;
  if (flag === "server" || flag === "otlp") return withoutCredentials(value);
  return value;
}

function keepOptions(options: Record<string, unknown>): SavedOptions {
  const out: SavedOptions = {};
  if (typeof options.ascii === "boolean") out.ascii = options.ascii;
  if (options.contrast === "high") out.contrast = "high";
  if (options.motion === "reduce") out.motion = "reduce";
  if (typeof options.mouse === "boolean") out.mouse = options.mouse;
  if (typeof options.line === "boolean") out.line = options.line;
  return out;
}

/** The listed flags of `flags`, each as tui.json keeps it; everything else is dropped. */
export function savedFlags(flags: Readonly<Record<string, unknown>>): Saved["flags"] {
  const out: Saved["flags"] = {};
  for (const flag of SAVED_FLAGS) {
    const v = keep(flag, flags[flag]);
    if (v !== undefined) out[flag] = v;
  }
  return out;
}

/** Reads tui.json: nothing when it is absent; a problem, and nothing, when it cannot be read. */
export function loadSaved(home: string): { saved?: Saved; problem?: string } {
  const path = savedPath(home);
  if (!existsSync(path)) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    return { problem: `${path} could not be read (${(e as Error).message}); it was ignored` };
  }
  const o = (parsed ?? {}) as { engram_tui?: unknown; flags?: unknown; options?: unknown };
  if (typeof o !== "object" || o.engram_tui !== VERSION)
    return { problem: `${path} is not a saved workspace this engram reads; it was ignored` };
  const flags = Object.fromEntries(
    Object.entries((o.flags ?? {}) as Record<string, unknown>).filter(([k]) => isFlag(k)),
  );
  return {
    saved: {
      flags: savedFlags(flags),
      options: keepOptions((o.options ?? {}) as Record<string, unknown>),
    },
  };
}

/** Writes tui.json with the listed flags and options only, and returns what it wrote. */
export function writeSaved(
  home: string,
  flags: Readonly<Record<string, unknown>>,
  options: Readonly<Record<string, unknown>>,
): Saved {
  const saved: Saved = { flags: savedFlags(flags), options: keepOptions(options) };
  const path = savedPath(home);
  mkdirSync(dirname(path), { recursive: true });
  const text = `${JSON.stringify({ engram_tui: VERSION, ...saved }, null, 2)}\n`;
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, text, { mode: 0o600 });
  renameSync(tmp, path);
  return saved;
}

/** Deletes tui.json; false when there was none. */
export function forgetSaved(home: string): boolean {
  const path = savedPath(home);
  if (!existsSync(path)) return false;
  rmSync(path, { force: true });
  return true;
}
