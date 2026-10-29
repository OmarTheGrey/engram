// What every command assembles before it calls the Plane: the event log, the
// policy, the actor and the store. No policy decision is made here (AGENTS.md
// rule 1); the Plane makes them all.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  type Actor,
  type Adapter,
  type Db,
  loadPreset,
  MIGRATIONS,
  migrate,
  openPostgres,
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

/** The variable that names the event log when --db is not given (ADR 0024). */
export const DB_URL_ENV = "ENGRAM_DB_URL";

/**
 * Where an event log lives: SQLite in memory, a SQLite file, or a Postgres
 * database (ADR 0024). `label` is what the CLI prints: the path, or the URL
 * with its userinfo and every secret-like query parameter replaced by `***`.
 * `source` says where the target came from, so a hint can say how to name it
 * again without printing a secret.
 */
export type DbTarget = (
  | { backend: "sqlite"; path: string }
  | { backend: "postgres"; url: string }
) & { label: string; source: "flag" | "env" | "default" };

/** Any `scheme://`: a URL, never a SQLite path. */
const SCHEME = /^([a-z][a-z0-9+.-]*):\/\//i;
const POSTGRES_SCHEMES = new Set(["postgres", "postgresql"]);
/** Query parameters whose value is treated as a secret (password, sslpassword, passfile, tokens, keys). */
const SECRET_PARAM = /pass|secret|token|key/i;

const safeDecode = (text: string) => {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
};

/**
 * A URL cut into its scheme, userinfo (everything up to the last `@`, so a
 * password holding an unencoded `@`, `/` or `?` is still inside it) and the
 * rest. String-based, so it works on URLs no parser accepts.
 */
function splitUrl(url: string): { scheme: string; userinfo: string | undefined; rest: string } {
  const m = SCHEME.exec(url);
  if (!m) return { scheme: "", userinfo: undefined, rest: url };
  const after = url.slice(m[0].length);
  const at = after.lastIndexOf("@");
  return at < 0
    ? { scheme: m[0], userinfo: undefined, rest: after }
    : { scheme: m[0], userinfo: after.slice(0, at), rest: after.slice(at + 1) };
}

/** Each `name=value` of the query in `rest`, with its raw text. */
const queryParams = (rest: string) => {
  const q = rest.indexOf("?");
  if (q < 0) return [];
  return rest
    .slice(q + 1)
    .split("#")[0]
    ?.split("&")
    .map((raw) => {
      const eq = raw.indexOf("=");
      return {
        raw,
        name: eq < 0 ? raw : raw.slice(0, eq),
        value: eq < 0 ? undefined : raw.slice(eq + 1),
      };
    });
};

/** A URL with its userinfo and every secret-like query value replaced by `***`. */
export function redactUrl(url: string): string {
  const { scheme, userinfo, rest } = splitUrl(url);
  const q = rest.indexOf("?");
  const base = q < 0 ? rest : rest.slice(0, q);
  const params = (queryParams(rest) ?? []).map((p) =>
    p.value !== undefined && SECRET_PARAM.test(safeDecode(p.name)) ? `${p.name}=***` : p.raw,
  );
  const query = q < 0 ? "" : `?${params.join("&")}`;
  return `${scheme}${userinfo === undefined ? "" : "***@"}${base}${query}`;
}

/** The secrets a URL holds: its password and secret-like query values, raw and decoded. */
function urlSecrets(url: string): string[] {
  const { userinfo, rest } = splitUrl(url);
  const found: string[] = [];
  if (userinfo?.includes(":")) found.push(userinfo.slice(userinfo.indexOf(":") + 1));
  for (const p of queryParams(rest) ?? [])
    if (p.value !== undefined && SECRET_PARAM.test(safeDecode(p.name))) found.push(p.value);
  const all = new Set(found.flatMap((s) => [s, safeDecode(s), encodeURIComponent(safeDecode(s))]));
  return [...all].filter((s) => s !== "").sort((a, b) => b.length - a.length);
}

/** `text` with the URL replaced by its redacted form and every secret it holds by `***`. */
export function redactSecrets(text: string, url: string): string {
  let out = text.split(url).join(redactUrl(url));
  for (const secret of urlSecrets(url)) out = out.split(secret).join("***");
  return out;
}

/**
 * Throws unless postgres.js can parse `url`: the same steps as its parseUrl
 * (the first host of a host list, then WHATWG URL, then decodeURIComponent of
 * the user and the password), so a URL it would choke on is refused here,
 * at once, as usage.
 */
function checkPostgresUrl(url: string): void {
  let host = url.slice(url.indexOf("://") + 3).split(/[?/]/)[0] ?? "";
  host = decodeURIComponent(host.slice(host.indexOf("@") + 1));
  const u = new URL(url.replace(host, host.split(",")[0] ?? ""));
  decodeURIComponent(u.username);
  decodeURIComponent(u.password);
}

/**
 * The log a command uses: `--db`, else `ENGRAM_DB_URL`, else the per-user
 * default. Either names `:memory:`, a SQLite file path (resolved against
 * `cwd`) or a `postgres://` URL. Any other `scheme://`, and a Postgres URL
 * postgres.js cannot parse, is a UsageError that prints no secret.
 */
export function dbTarget(
  spec: string | undefined,
  where: { cwd: string; home: string; env: Readonly<Record<string, string | undefined>> },
): DbTarget {
  const fromEnv = where.env[DB_URL_ENV] || undefined;
  const given = spec ?? fromEnv;
  const source = spec !== undefined ? "flag" : fromEnv !== undefined ? "env" : "default";
  const named = source === "env" ? DB_URL_ENV : "--db";
  const scheme = given === undefined ? undefined : SCHEME.exec(given)?.[1];
  if (given !== undefined && scheme !== undefined) {
    if (!POSTGRES_SCHEMES.has(scheme.toLowerCase()))
      throw new UsageError(
        `${named}: the ${scheme}:// scheme is not supported; give a SQLite path, :memory: or a postgres:// URL`,
      );
    const label = redactUrl(given);
    try {
      checkPostgresUrl(given);
    } catch {
      throw new UsageError(`${named} is not a valid Postgres URL: ${label}`);
    }
    return { backend: "postgres", url: given, label, source };
  }
  const path =
    given === MEMORY_DB
      ? MEMORY_DB
      : given === undefined
        ? defaultDb(where.home)
        : resolve(where.cwd, given);
  return { backend: "sqlite", path, label: path, source };
}

/**
 * Opens the backend a target names, without migrating it. SQLite files are
 * opened as they are, so the caller decides whether one may be created;
 * Postgres connects to a database that must exist (the CLI never creates
 * one), and any error it raises names the target by its redacted label with
 * every secret of the URL scrubbed from the message.
 */
export function openDb(target: DbTarget): Db {
  if (target.backend === "sqlite") return openSqlite(target.path);
  try {
    return openPostgres(target.url);
  } catch (e) {
    throw new Error(`${target.label}: ${redactSecrets((e as Error).message, target.url)}`);
  }
}

/** Whether an open database holds an event log: the migrations table exists. */
export function hasLog(db: Db): boolean {
  const sql =
    db.dialect === "postgres"
      ? "SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = current_schema() AND tablename = 'schema_migrations'"
      : "SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'";
  return Number(db.prepare(sql).get()?.n) > 0;
}

/** What a target holds, found without changing it (`engram doctor`). */
export type LogState =
  | { state: "absent" }
  | { state: "foreign" }
  | { state: "engram"; pending: number[]; unknown: number[] };

/** The tables, the migrations table's columns and its rows, by read-only queries. */
interface Contents {
  tables: string[];
  columns(): string[];
  rows(): { id: number; name: string }[];
}

/** Classifies a database's contents against MIGRATIONS. */
function classify(c: Contents): LogState {
  if (c.tables.length === 0) return { state: "absent" };
  if (!c.tables.includes("schema_migrations")) return { state: "foreign" };
  const columns = c.columns();
  if (!columns.includes("id") || !columns.includes("name")) return { state: "foreign" };
  const rows = c.rows();
  const known = new Map(MIGRATIONS.map((m) => [m.id, m.name]));
  const unknown: number[] = [];
  for (const row of rows) {
    const name = known.get(Number(row.id));
    if (name === undefined) unknown.push(Number(row.id));
    else if (name !== row.name) return { state: "foreign" };
  }
  if (rows.length === 0 || unknown.length === rows.length) return { state: "foreign" };
  const done = new Set(rows.map((r) => Number(r.id)));
  const pending = MIGRATIONS.map((m) => m.id).filter((id) => !done.has(id));
  return { state: "engram", pending, unknown };
}

/**
 * What a target holds, without creating or changing anything: a SQLite file
 * is opened read-only (and not at all when it does not exist), Postgres sees
 * SELECT queries only. Never migrates.
 */
export function inspectLog(target: DbTarget): LogState {
  if (target.backend === "sqlite") {
    if (target.path === MEMORY_DB || !existsSync(target.path)) return { state: "absent" };
    const db = new DatabaseSync(target.path, { readOnly: true });
    try {
      return classify({
        tables: db
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
          .all()
          .map((r) => String(r.name)),
        columns: () =>
          db
            .prepare("SELECT name FROM pragma_table_info('schema_migrations')")
            .all()
            .map((r) => String(r.name)),
        rows: () =>
          db.prepare("SELECT id, name FROM schema_migrations").all() as {
            id: number;
            name: string;
          }[],
      });
    } finally {
      db.close();
    }
  }
  const db = openDb(target);
  try {
    return classify({
      tables: db
        .prepare("SELECT tablename FROM pg_tables WHERE schemaname = current_schema()")
        .all()
        .map((r) => String(r.tablename)),
      columns: () =>
        db
          .prepare(
            "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'schema_migrations'",
          )
          .all()
          .map((r) => String(r.column_name)),
      rows: () =>
        db.prepare("SELECT id, name FROM schema_migrations").all() as {
          id: number;
          name: string;
        }[],
    });
  } finally {
    db.close();
  }
}

export interface Log {
  db: Db;
  target: DbTarget;
  /** The migrations this open applied; empty when the log was up to date. */
  applied: number[];
}

/** Opens and migrates the log; `mustExist` refuses to create one on either backend. */
export function openLog(target: DbTarget, mustExist = false): Log {
  if (target.backend === "sqlite" && target.path !== MEMORY_DB) {
    if (mustExist && !existsSync(target.path)) throw new Error(`no event log at ${target.path}`);
    mkdirSync(dirname(target.path), { recursive: true });
  }
  const db = openDb(target);
  try {
    if (mustExist && target.backend === "postgres" && !hasLog(db))
      throw new Error(`no event log at ${target.label}`);
    return { db, target, applied: migrate(db) };
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
