// What every command assembles before it calls the Plane: the event log, the
// policy, the actor and the store. No policy decision is made here (AGENTS.md
// rule 1); the Plane makes them all.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  type Actor,
  type Adapter,
  type Db,
  loadPreset,
  migrate,
  openSqlite,
  type Policy,
  PRESETS,
  type PresetName,
  parsePolicy,
  Scope,
  ScopeLevel,
  scopeLevel,
  Timestamp,
} from "@engram/core";

/** Bad input: printed with the command name, exit code 2. */
export class UsageError extends Error {}

/**
 * The event log when --db is not given: per user, under the home folder, so
 * dogfood content never lands inside a repository by default (AGENTS.md
 * rule 12, decision D9). `home` comes from the Io, injected in tests.
 */
export const defaultDb = (home: string) => join(home, ".engram", "engram.db");
export const MEMORY_DB = ":memory:";

/** Where the log for `spec` lives: :memory:, the path resolved against `cwd`, or the per-user default. */
export function logPath(spec: string | undefined, cwd: string, home: string): string {
  if (spec === MEMORY_DB) return MEMORY_DB;
  return spec === undefined ? defaultDb(home) : resolve(cwd, spec);
}

export interface Log {
  db: Db;
  /** The resolved path, or :memory:. */
  path: string;
  /** The migrations this open applied; empty when the log was up to date. */
  applied: number[];
}

/** Opens and migrates the log; `mustExist` refuses to create one. */
export function openLog(
  spec: string | undefined,
  cwd: string,
  home: string,
  mustExist = false,
): Log {
  const path = logPath(spec, cwd, home);
  if (path !== MEMORY_DB) {
    if (mustExist && !existsSync(path)) throw new Error(`no event log at ${path}`);
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = openSqlite(path);
  try {
    return { db, path, applied: migrate(db) };
  } catch (e) {
    db.close();
    throw e;
  }
}

/** A bundled preset by name, or a policy YAML file by path. */
export function loadPolicy(spec: string | undefined, cwd: string): Policy {
  const name = spec ?? "medium";
  if ((PRESETS as readonly string[]).includes(name)) return loadPreset(name as PresetName);
  const path = resolve(cwd, name);
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new UsageError(
      `--policy ${name} is neither a preset (${PRESETS.join(", ")}) nor a readable file`,
    );
  }
  return parsePolicy(text, name);
}

export function checkTime(flag: string, value: string | undefined): string | undefined {
  if (value !== undefined && !Timestamp.safeParse(value).success)
    throw new UsageError(
      `${flag} ${value} is not an ISO 8601 UTC time such as 2026-10-25T12:00:00Z`,
    );
  return value;
}

/** A decimal number, optionally signed and with an exponent; never hex, binary, octal or `_`. */
const DECIMAL = /^[+-]?(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/;

/**
 * A number flag such as --confidence: any finite decimal; its range is the
 * schema's to judge. Number() alone would also read `0x10` as 16 and `0b1`
 * as 1 (finding R6-6), so the text must be decimal first.
 */
export function checkNumber(flag: string, value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!DECIMAL.test(value.trim()) || !Number.isFinite(n))
    throw new UsageError(`${flag} ${JSON.stringify(value)} is not a number`);
  return n;
}

export interface ActorFlags {
  as?: string;
  level?: string;
  member?: string[];
}

/**
 * The actor: `--as`, else `person:<owner>`. Its level and membership default
 * to its own scope when its id is one (`person:omar` reads as person, member
 * of `person:omar`); otherwise level person and no membership. `source` is
 * the provenance kind the plane records for what it writes (decision D4).
 */
export function buildActor(
  flags: ActorFlags,
  owner: string | undefined,
  source?: Actor["source"],
): Actor {
  const id = flags.as ?? (owner === undefined ? undefined : `person:${owner}`);
  if (id === undefined) throw new UsageError("give --as <principal> or --owner <id>");
  const ownScope = Scope.safeParse(id).success ? id : undefined;
  let level = ownScope ? scopeLevel(ownScope) : "person";
  if (flags.level !== undefined) {
    const parsed = ScopeLevel.safeParse(flags.level);
    if (!parsed.success)
      throw new UsageError(`--level ${flags.level} is not one of ${ScopeLevel.options.join(", ")}`);
    level = parsed.data;
  }
  for (const m of flags.member ?? [])
    if (!Scope.safeParse(m).success) throw new UsageError(`--member ${m} is not a scope`);
  const memberships = flags.member ?? (ownScope ? [ownScope] : []);
  return source ? { id, level, memberships, source } : { id, level, memberships };
}

/**
 * Who adopts a store's own memories: its owner, with source import, whoever
 * reads (decision D8). Adoption records what the owner's store holds; the
 * reader's capacity governs only what the read returns.
 */
export function storeOwner(owner: string): Actor {
  const id = `person:${owner}`;
  return { id, level: "person", memberships: [id], source: "import" };
}

/** An adapter for commands that never touch a store (explain): any call is a bug. */
export const NO_STORE: Adapter = {
  name: "none",
  capabilities: {
    native_validity: false,
    native_history: false,
    native_search: false,
    native_graph: false,
  },
  write: () => Promise.reject(new Error("no store is open for this command")),
  read: () => Promise.reject(new Error("no store is open for this command")),
  delete: () => Promise.reject(new Error("no store is open for this command")),
  list: () => Promise.reject(new Error("no store is open for this command")),
};
